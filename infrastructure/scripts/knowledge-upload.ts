import { createHash } from "node:crypto";

import {
  HeadObjectCommand,
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

export class S3KnowledgeObjectStore implements KnowledgeObjectStore {
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
