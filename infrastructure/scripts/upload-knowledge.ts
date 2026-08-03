import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { requireEnvironment } from "./env.js";

const infrastructureDirectory = path.dirname(fileURLToPath(import.meta.url));
const knowledgeDirectory = path.resolve(infrastructureDirectory, "../../knowledge");
const bucket = requireEnvironment("KNOWLEDGE_BUCKET_NAME");
const prefix = (process.env.KNOWLEDGE_PREFIX ?? "documents").replace(/^\/+|\/+$/g, "");
const client = new S3Client({});

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return files.flat();
}

const files = (await listFiles(knowledgeDirectory)).filter((file) =>
  file.endsWith(".md") || file.endsWith(".metadata.json"),
);

if (files.length === 0) {
  throw new Error("No Markdown or metadata files were found under knowledge/");
}

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
