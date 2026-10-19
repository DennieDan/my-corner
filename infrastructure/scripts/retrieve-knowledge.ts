import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";

import {
  loadMetadataFilter,
  parseRetrievalCliArguments,
  retrievalUsage,
} from "./knowledge-retrieve-cli.js";
import {
  BedrockKnowledgeRetrievalService,
  type RecordedRetrievalResult,
  type RetrievalConfiguration,
} from "./knowledge-retrieval.js";
import { evaluateRetrieval } from "./knowledge-retrieval-evaluation.js";
import { loadAndValidateKnowledge } from "./knowledge-manifest.js";

interface EvaluationQuestion {
  id: string;
  language?: string;
  category?: string;
  question: string;
  expectedBehavior?: string;
  sourceHints?: string[];
  sourceHintGroups?: string[][];
}

interface RecordedQuery {
  id: string;
  language?: string;
  category?: string;
  question: string;
  expectedBehavior?: string;
  sourceHints?: string[];
  sourceHintGroups?: string[][];
  retrievedAt: string;
  durationMs: number;
  resultCount: number;
  results: RecordedRetrievalResult[];
  error?: { name: string; message: string };
}

function requireKnowledgeBaseId(cliValue: string | undefined): string {
  const value = cliValue || process.env.BEDROCK_KNOWLEDGE_BASE_ID?.trim();
  if (!value) {
    throw new Error(
      "Knowledge Base ID is required via --knowledge-base-id or BEDROCK_KNOWLEDGE_BASE_ID",
    );
  }
  return value;
}

async function loadQuestions(filePath: string): Promise<EvaluationQuestion[]> {
  const lines = (await readFile(filePath, "utf8")).split("\n").filter(Boolean);
  return lines.map((line, index) => {
    const parsed = JSON.parse(line) as Partial<EvaluationQuestion>;
    if (!parsed.id || !parsed.question) {
      throw new Error(`Invalid evaluation question on line ${index + 1} of ${filePath}`);
    }
    return parsed as EvaluationQuestion;
  });
}

function safeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: "Retrieval failed with a non-Error value" };
}

if (process.argv.includes("--help")) {
  console.log(retrievalUsage);
  process.exit(0);
}

const options = parseRetrievalCliArguments(process.argv.slice(2));
const metadataFilter = await loadMetadataFilter(options);
const configuration: RetrievalConfiguration = {
  knowledgeBaseId: requireKnowledgeBaseId(options.knowledgeBaseId),
  numberOfResults: options.numberOfResults,
  searchType: options.searchType,
  ...(metadataFilter ? { metadataFilter } : {}),
};
const questions: EvaluationQuestion[] = options.mode === "single"
  ? [{ id: "single", question: options.query as string }]
  : await loadQuestions(options.questionsPath);
const service = new BedrockKnowledgeRetrievalService(new BedrockAgentRuntimeClient({}));
const recordedQueries: RecordedQuery[] = [];
let failureCount = 0;

for (const question of questions) {
  const startedAt = Date.now();
  try {
    const results = await service.retrieve(question.question, configuration);
    recordedQueries.push({
      ...question,
      retrievedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      resultCount: results.length,
      results,
    });
    console.log(`Retrieved ${question.id}: ${results.length} result(s)`);
  } catch (error) {
    failureCount += 1;
    const recordedError = safeError(error);
    recordedQueries.push({
      ...question,
      retrievedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      resultCount: 0,
      results: [],
      error: recordedError,
    });
    console.error(`Retrieval failed for ${question.id}: ${recordedError.name}`);
  }
}

const generatedAt = new Date().toISOString();
const timestamp = generatedAt.replaceAll(":", "-").replaceAll(".", "-");
const outputPath = path.join(
  options.outputDirectory,
  `retrieval-${options.mode}-${timestamp}.json`,
);
const evaluation = options.mode === "bulk"
  ? evaluateRetrieval(recordedQueries, await loadAndValidateKnowledge())
  : null;
const outputQueries = recordedQueries.map((query) => ({
  ...query,
  ...(evaluation ? { evaluation: evaluation.queries[query.id] } : {}),
}));
const output = {
  schemaVersion: 2,
  generatedAt,
  mode: options.mode,
  configuration: {
    knowledgeBaseId: configuration.knowledgeBaseId,
    numberOfResults: configuration.numberOfResults,
    searchType: configuration.searchType,
    metadataFilter: configuration.metadataFilter ?? null,
  },
  summary: {
    queryCount: recordedQueries.length,
    succeeded: recordedQueries.length - failureCount,
    failed: failureCount,
  },
  evaluationSummary: evaluation?.summary ?? null,
  evaluationFailures: evaluation?.failures ?? null,
  queries: outputQueries,
};

await mkdir(options.outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
console.log(`Wrote machine-readable retrieval results to ${outputPath}`);

if (failureCount > 0) {
  process.exitCode = 1;
}
