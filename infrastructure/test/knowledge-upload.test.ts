import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  findObsoleteKnowledgeKeys,
  isManagedKnowledgeKey,
  uploadKnowledgeObject,
  type KnowledgeObjectStore,
  type KnowledgeObjectMetadata,
} from "../scripts/knowledge-upload.js";

function makeStore(existing?: KnowledgeObjectMetadata) {
  const headObject = vi.fn(async () => existing);
  const putObject = vi.fn(async () => undefined);
  const store: KnowledgeObjectStore = { headObject, putObject };
  return { store, headObject, putObject };
}

const body = Buffer.from("# Approved knowledge\n");
const commonInput = {
  bucket: "private-knowledge-bucket",
  key: "documents/profile.md",
  body,
  contentType: "text/markdown; charset=utf-8",
};

describe("uploadKnowledgeObject", () => {
  it("uploads a new object with its SHA-256 checksum", async () => {
    const { store, headObject, putObject } = makeStore();

    await expect(uploadKnowledgeObject({ store, ...commonInput })).resolves.toBe("new");

    expect(headObject).toHaveBeenCalledWith(commonInput.bucket, commonInput.key);
    expect(putObject).toHaveBeenCalledOnce();
    expect(putObject).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: commonInput.bucket,
      Key: commonInput.key,
      Body: body,
      ContentType: commonInput.contentType,
      Metadata: {
        sha256: createHash("sha256").update(body).digest("hex"),
      },
    }));
  });

  it("skips an object when the stored checksum matches", async () => {
    const checksum = createHash("sha256").update(body).digest("hex");
    const { store, putObject } = makeStore({ Metadata: { sha256: checksum } });

    await expect(uploadKnowledgeObject({ store, ...commonInput })).resolves.toBe("unchanged");

    expect(putObject).not.toHaveBeenCalled();
  });

  it("uploads an object when the stored checksum differs", async () => {
    const { store, putObject } = makeStore({ Metadata: { sha256: "old-checksum" } });

    await expect(uploadKnowledgeObject({ store, ...commonInput })).resolves.toBe("changed");

    expect(putObject).toHaveBeenCalledOnce();
  });

  it("uploads an existing object that has no checksum metadata", async () => {
    const { store, putObject } = makeStore({ Metadata: {} });

    await expect(uploadKnowledgeObject({ store, ...commonInput })).resolves.toBe("changed");

    expect(putObject).toHaveBeenCalledOnce();
  });
});

describe("managed knowledge inventory", () => {
  it.each([
    "documents/profile.md",
    "documents/profile.md.metadata.json",
  ])("recognizes %s as a managed object", (key) => {
    expect(isManagedKnowledgeKey(key)).toBe(true);
  });

  it.each([
    "documents/readme.txt",
    "documents/metadata/source-registry.json",
    "documents/folder/",
  ])("does not treat %s as a managed object", (key) => {
    expect(isManagedKnowledgeKey(key)).toBe(false);
  });

  it("returns sorted managed objects that are no longer expected", () => {
    const expected = new Set([
      "documents/profile.md",
      "documents/profile.md.metadata.json",
    ]);
    const remote = [
      "documents/removed.md.metadata.json",
      "documents/readme.txt",
      "documents/profile.md",
      "documents/removed.md",
      "documents/profile.md.metadata.json",
    ];

    expect(findObsoleteKnowledgeKeys(remote, expected)).toEqual([
      "documents/removed.md",
      "documents/removed.md.metadata.json",
    ]);
  });
});
