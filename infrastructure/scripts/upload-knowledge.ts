import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { requireEnvironment } from "./env.js";
import { knowledgeDirectory, loadAndValidateKnowledge } from "./knowledge-manifest.js";

const bucket = requireEnvironment("KNOWLEDGE_BUCKET_NAME");
const prefix = (process.env.KNOWLEDGE_PREFIX ?? "documents").replace(/^\/+|\/+$/g, "");
const client = new S3Client({});

const sources = await loadAndValidateKnowledge({ requireApproved: true });
const files = sources.flatMap((source) => {
  const document = path.join(knowledgeDirectory, source.path);
  return [document, `${document}.metadata.json`];
});

for (const file of files) {
  const body = await readFile(file);
  const relativePath = path.relative(knowledgeDirectory, file).split(path.sep).join("/");
  const key = `${prefix}/${relativePath}`;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: file.endsWith(".json") ? "application/json" : "text/markdown; charset=utf-8",
    Metadata: { sha256: createHash("sha256").update(body).digest("hex") },
  }));
  console.log(`Uploaded s3://${bucket}/${key}`);
}
