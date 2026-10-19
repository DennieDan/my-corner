import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAIAnswerProvider, SecretKeyProvider } from "../agent/dist/answer.js";
import { createHandler } from "../agent/dist/handler.js";
import { BedrockRetriever } from "../agent/dist/retrieve.js";
import { SseParser } from "../lib/chat/client.ts";
import { scoreRun } from "./score-evaluation.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(directory, "results", "phase8-comparison.json");
const required = ["BEDROCK_KNOWLEDGE_BASE_ID", "OPENAI_API_KEY_SECRET_ARN", "AWS_REGION"];
for (const name of required) if (!process.env[name]?.trim()) throw new Error(`${name} is required`);
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.slice(8)) : Infinity;
if ((!Number.isInteger(limit) && limit !== Infinity) || limit < 1) throw new Error("--limit must be a positive integer");
const resume = process.argv.includes("--resume");
const questions = (await readFile(path.join(directory, "questions.jsonl"), "utf8"))
  .split("\n").filter(Boolean).map((line) => JSON.parse(line)).slice(0, limit);
const registry = JSON.parse(await readFile(path.join(directory, "../knowledge/metadata/source-registry.json"), "utf8"));
const sourceRevision = createHash("sha256").update((await Promise.all([
  "../agent/src/prompt.ts", "../agent/src/policy.ts", "../agent/src/retrieve.ts",
].map((file) => readFile(path.join(directory, file), "utf8")))).join("\n")).digest("hex");
const sourceAliases = Object.fromEntries(registry.sources.flatMap((source) =>
  [source.sourceId, ...(source.aliases ?? [])].map((alias) => [alias, source.sourceId])));

let previous = null;
if (resume) {
  try { previous = JSON.parse(await readFile(outputPath, "utf8")); }
  catch { throw new Error("--resume requires an existing phase8-comparison.json"); }
  if (previous.config.model !== "gpt-5.6-luna" || previous.config.knowledgeBaseId !== process.env.BEDROCK_KNOWLEDGE_BASE_ID ||
      previous.config.sourceRevision !== sourceRevision) {
    throw new Error("Saved evaluation configuration does not match this run");
  }
}
const report = previous ?? {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  config: { model: "gpt-5.6-luna", efforts: ["none", "low"], knowledgeBaseId: process.env.BEDROCK_KNOWLEDGE_BASE_ID,
    sourceRevision,
    retrieval: "12 semantic candidates, approved-public filter, score >= 0.65", sourceAliases },
  questions: [],
};

const retriever = new BedrockRetriever();
const answers = new OpenAIAnswerProvider(new SecretKeyProvider(process.env.OPENAI_API_KEY_SECRET_ARN));
const baseConfig = {
  DENNIE_ENVIRONMENT: "development", AWS_REGION: process.env.AWS_REGION,
  BEDROCK_KNOWLEDGE_BASE_ID: process.env.BEDROCK_KNOWLEDGE_BASE_ID,
  OPENAI_API_KEY_SECRET_ARN: process.env.OPENAI_API_KEY_SECRET_ARN,
  OPENAI_MODEL: "gpt-5.6-luna", ALLOWED_ORIGINS: ["http://localhost:3000"], LOG_LEVEL: "info",
};

async function save() {
  report.updatedAt = new Date().toISOString();
  report.summary = scoreRun(report);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, outputPath);
}

async function runVariant(question, effort, cachedRetriever) {
  const started = Date.now();
  const parser = new SseParser();
  const decoder = new TextDecoder();
  const raw = new PassThrough();
  const result = { effort, answer: "", sources: [], firstTokenMs: null, durationMs: null,
    usage: null, outcome: null, errorCode: null, sourceIds: [] };
  let metric = null;
  raw.on("data", (chunk) => {
    for (const event of parser.push(decoder.decode(chunk, { stream: true }))) {
      if (event.type === "sources") result.sources = event.sources;
      if (event.type === "delta") {
        if (result.firstTokenMs === null) result.firstTokenMs = Date.now() - started;
        result.answer += event.text;
      }
      if (event.type === "done") result.usage = event.usage ?? null;
      if (event.type === "error") result.errorCode = event.code ?? "UNKNOWN";
    }
  });
  const handler = createHandler({
    config: { ...baseConfig, OPENAI_REASONING_EFFORT: effort },
    retriever: cachedRetriever,
    answers,
    metrics: { record: (item) => { metric = item; } },
  });
  await handler({ httpMethod: "POST", path: "/v1/chat", headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: question.question, history: [], sessionId: `evaluation-${question.id}` }) }, raw);
  result.durationMs = Date.now() - started;
  result.outcome = metric?.outcome ?? "missing_metric";
  result.sourceIds = cachedRetriever.lastEvidence.map((item) => item.sourceId);
  return result;
}

for (const question of questions) {
  if (report.questions.some((entry) => entry.id === question.id && entry.variants?.none && entry.variants?.low)) continue;
  const cache = new Map();
  const cachedRetriever = {
    lastEvidence: [],
    async retrieve(query, knowledgeBaseId, signal) {
      if (!cache.has(query)) cache.set(query, retriever.retrieve(query, knowledgeBaseId, signal));
      let evidence;
      try { evidence = await cache.get(query); }
      catch (error) { cache.delete(query); throw error; }
      this.lastEvidence = evidence;
      return evidence;
    },
  };
  const entry = report.questions.find((item) => item.id === question.id) ?? {
    id: question.id, language: question.language, category: question.category,
    question: question.question, expectedBehavior: question.expectedBehavior,
    requiredFacts: question.requiredFacts ?? [], sourceHints: question.sourceHints ?? [],
    sourceHintGroups: question.sourceHintGroups ?? [], variants: {},
  };
  for (const effort of ["none", "low"]) {
    if (entry.variants[effort]) continue;
    entry.variants[effort] = await runVariant(question, effort, cachedRetriever);
    process.stdout.write(`${question.id} ${effort}: ${entry.variants[effort].outcome}\n`);
  }
  if (!report.questions.includes(entry)) report.questions.push(entry);
  await save();
}

await save();
process.stdout.write(`Saved ${report.questions.length}/${questions.length} questions to ${outputPath}\n`);
if (report.questions.length !== 73 || report.summary.gatesPass === false) process.exitCode = 1;
