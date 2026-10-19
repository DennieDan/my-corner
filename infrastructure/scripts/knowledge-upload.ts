import { createHash } from "node:crypto";

import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

export interface KnowledgeObjectMetadata {
  Metadata?: Record<string, string>;
}

export interface KnowledgeObjectStore {
  headObject(bucket: string, key: string): Promise<KnowledgeObjectMetadata | undefined>;
  putObject(input: PutObjectCommandInput): Promise<void>;
}

export interface KnowledgeObjectInventory {
  listObjectKeys(bucket: string, prefix: string): Promise<string[]>;
  deleteObjects(bucket: string, keys: string[]): Promise<void>;
}

export type UploadResult = "new" | "changed" | "unchanged";

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404;
}

export class S3KnowledgeObjectStore implements KnowledgeObjectStore, KnowledgeObjectInventory {
  public constructor(private readonly client: S3Client) {}

  public async headObject(
    bucket: string,
    key: string,
  ): Promise<KnowledgeObjectMetadata | undefined> {
    try {
      return await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  public async putObject(input: PutObjectCommandInput): Promise<void> {
    await this.client.send(new PutObjectCommand(input));
  }

  public async listObjectKeys(bucket: string, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      for (const object of result.Contents ?? []) {
        if (object.Key) {
          keys.push(object.Key);
        }
      }
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }

  public async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    for (let offset = 0; offset < keys.length; offset += 1_000) {
      const batch = keys.slice(offset, offset + 1_000);
      const result = await this.client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }));
      if (result.Errors && result.Errors.length > 0) {
        const failures = result.Errors.map((error) =>
          `${error.Key ?? "unknown key"}: ${error.Code ?? "unknown error"}`
        );
        throw new Error(`Failed to delete obsolete knowledge objects:\n${failures.join("\n")}`);
      }
    }
  }
}

export function isManagedKnowledgeKey(key: string): boolean {
  return key.endsWith(".md") || key.endsWith(".md.metadata.json");
}

export function findObsoleteKnowledgeKeys(
  remoteKeys: string[],
  expectedKeys: ReadonlySet<string>,
): string[] {
  return remoteKeys
    .filter((key) => isManagedKnowledgeKey(key) && !expectedKeys.has(key))
    .sort();
}

interface UploadKnowledgeObjectInput {
  store: KnowledgeObjectStore;
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType: string;
}

export async function uploadKnowledgeObject({
  store,
  bucket,
  key,
  body,
  contentType,
}: UploadKnowledgeObjectInput): Promise<UploadResult> {
  const checksum = createHash("sha256").update(body).digest("hex");
  const existing = await store.headObject(bucket, key);

  if (existing?.Metadata?.sha256 === checksum) {
    return "unchanged";
  }

  await store.putObject({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: { sha256: checksum },
  });

  return existing ? "changed" : "new";
}
