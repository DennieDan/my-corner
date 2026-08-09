import { readFile } from "node:fs/promises";
import path from "node:path";

import { S3Client } from "@aws-sdk/client-s3";

import { requireEnvironment } from "./env.js";
import { knowledgeDirectory, loadAndValidateKnowledge } from "./knowledge-manifest.js";
import {
  S3KnowledgeObjectStore,
  uploadKnowledgeObject,
  type UploadResult,
} from "./knowledge-upload.js";

const bucket = requireEnvironment("KNOWLEDGE_BUCKET_NAME");
const prefix = (process.env.KNOWLEDGE_PREFIX ?? "documents").replace(/^\/+|\/+$/g, "");
const store = new S3KnowledgeObjectStore(new S3Client({}));

const sources = await loadAndValidateKnowledge({ requireApproved: true });
const files = sources.flatMap((source) => {
  const document = path.join(knowledgeDirectory, source.path);
  return [document, `${document}.metadata.json`];
});
const totals: Record<UploadResult, number> = { new: 0, changed: 0, unchanged: 0 };

for (const file of files) {
  const body = await readFile(file);
  const relativePath = path.relative(knowledgeDirectory, file).split(path.sep).join("/");
  const key = `${prefix}/${relativePath}`;
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

console.log(
  `Knowledge upload complete: ${totals.new} new, ${totals.changed} changed, ${totals.unchanged} unchanged.`,
);
