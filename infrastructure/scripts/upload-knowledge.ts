import { readFile } from "node:fs/promises";
import path from "node:path";

import { S3Client } from "@aws-sdk/client-s3";

import { requireEnvironment } from "./env.js";
import { knowledgeDirectory, loadAndValidateKnowledge } from "./knowledge-manifest.js";
import {
  findObsoleteKnowledgeKeys,
  S3KnowledgeObjectStore,
  uploadKnowledgeObject,
  type UploadResult,
} from "./knowledge-upload.js";

const bucket = requireEnvironment("KNOWLEDGE_BUCKET_NAME");
const prefix = (process.env.KNOWLEDGE_PREFIX ?? "documents").replace(/^\/+|\/+$/g, "");
const objectPrefix = prefix === "" ? "" : `${prefix}/`;
const deleteObsolete = process.argv.includes("--delete-obsolete");
const store = new S3KnowledgeObjectStore(new S3Client({}));

const sources = await loadAndValidateKnowledge({ requireApproved: true });
const files = sources.flatMap((source) => {
  const document = path.join(knowledgeDirectory, source.path);
  return [document, `${document}.metadata.json`];
});
const expectedKeys = new Set(files.map((file) => {
  const relativePath = path.relative(knowledgeDirectory, file).split(path.sep).join("/");
  return `${objectPrefix}${relativePath}`;
}));
const remoteKeys = await store.listObjectKeys(bucket, objectPrefix);
const obsoleteKeys = findObsoleteKnowledgeKeys(remoteKeys, expectedKeys);

if (obsoleteKeys.length > 0) {
  console.error(`Found ${obsoleteKeys.length} obsolete managed S3 object(s):`);
  for (const key of obsoleteKeys) {
    console.error(`- s3://${bucket}/${key}`);
  }

  if (!deleteObsolete) {
    throw new Error(
      "Obsolete managed S3 objects found. Review them, then rerun with --delete-obsolete to remove them.",
    );
  }
}

const totals: Record<UploadResult, number> = { new: 0, changed: 0, unchanged: 0 };

for (const file of files) {
  const body = await readFile(file);
  const relativePath = path.relative(knowledgeDirectory, file).split(path.sep).join("/");
  const key = `${objectPrefix}${relativePath}`;
  const result = await uploadKnowledgeObject({
    store,
    bucket,
    key,
    body,
    contentType: file.endsWith(".json")
      ? "application/json"
      : "text/markdown; charset=utf-8",
  });
  totals[result] += 1;

  if (result === "unchanged") {
    console.log(`Skipped unchanged s3://${bucket}/${key}`);
  } else {
    console.log(`Uploaded ${result} s3://${bucket}/${key}`);
  }
}

if (obsoleteKeys.length > 0) {
  await store.deleteObjects(bucket, obsoleteKeys);
  for (const key of obsoleteKeys) {
    console.log(`Deleted obsolete s3://${bucket}/${key}`);
  }
}

console.log(
  `Knowledge upload complete: ${totals.new} new, ${totals.changed} changed, ${totals.unchanged} unchanged, ${obsoleteKeys.length} obsolete deleted.`,
);
