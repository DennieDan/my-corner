import { readFile } from "node:fs/promises";
import path from "node:path";

import type { RetrievalFilter } from "@aws-sdk/client-bedrock-agent-runtime";

import { repositoryDirectory } from "./knowledge-manifest.js";
import type { RetrievalSearchType } from "./knowledge-retrieval.js";

export interface RetrievalCliOptions {
  mode: "single" | "bulk";
  query?: string;
  questionsPath: string;
  outputDirectory: string;
  knowledgeBaseId?: string;
  numberOfResults: number;
  searchType: RetrievalSearchType;
  filterJson?: string;
  filterFile?: string;
}

const valueOptions = new Set([
  "--query",
  "--questions",
  "--output-dir",
  "--knowledge-base-id",
  "--results",
  "--search-type",
  "--filter",
  "--filter-file",
]);

export const retrievalUsage = `Usage:
  npm run knowledge:retrieve -- --query "What projects has Dan worked on?" --results 8
  npm run knowledge:retrieve -- --bulk [--questions evaluations/questions.jsonl]

Options:
  --knowledge-base-id <id>  Override BEDROCK_KNOWLEDGE_BASE_ID
  --results <1-100>         Number of chunks to request (default: 8)
  --search-type <type>      default, semantic, or hybrid (default: default)
  --filter <json>           Bedrock metadata filter JSON
  --filter-file <path>      Read Bedrock metadata filter JSON from a file
  --output-dir <path>       Results directory (default: evaluations/results/retrieval)
  --help                    Show this help`;

export function parseRetrievalCliArguments(arguments_: string[]): RetrievalCliOptions {
  const values = new Map<string, string>();
  let bulk = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help") {
      throw new Error(retrievalUsage);
    }
    if (argument === "--bulk") {
      bulk = true;
      continue;
    }
    if (!valueOptions.has(argument)) {
      throw new Error(`Unknown option: ${argument}\n\n${retrievalUsage}`);
    }
    if (values.has(argument)) {
      throw new Error(`Option ${argument} may only be provided once`);
    }
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Option ${argument} requires a value`);
    }
    values.set(argument, value);
    index += 1;
  }

  const query = values.get("--query")?.trim();
  const questionsOption = values.get("--questions");
  if (query && (bulk || questionsOption)) {
    throw new Error("Use either --query for single mode or --bulk/--questions for bulk mode");
  }
  if (!query && !bulk && !questionsOption) {
    throw new Error(`Choose single or bulk mode\n\n${retrievalUsage}`);
  }

  const resultsValue = values.get("--results") ?? "8";
  const numberOfResults = Number(resultsValue);
  if (!Number.isInteger(numberOfResults) || numberOfResults < 1 || numberOfResults > 100) {
    throw new Error("--results must be an integer from 1 to 100");
  }

  const searchTypeValue = (values.get("--search-type") ?? "default").toUpperCase();
  if (!(["DEFAULT", "SEMANTIC", "HYBRID"] as string[]).includes(searchTypeValue)) {
    throw new Error("--search-type must be default, semantic, or hybrid");
  }

  const filterJson = values.get("--filter");
  const filterFile = values.get("--filter-file");
  if (filterJson && filterFile) {
    throw new Error("Use either --filter or --filter-file, not both");
  }

  return {
    mode: query ? "single" : "bulk",
    query,
    questionsPath: path.resolve(
      repositoryDirectory,
      questionsOption ?? "evaluations/questions.jsonl",
    ),
    outputDirectory: path.resolve(
      repositoryDirectory,
      values.get("--output-dir") ?? "evaluations/results/retrieval",
    ),
    knowledgeBaseId: values.get("--knowledge-base-id")?.trim(),
    numberOfResults,
    searchType: searchTypeValue as RetrievalSearchType,
    filterJson,
    filterFile: filterFile ? path.resolve(repositoryDirectory, filterFile) : undefined,
  };
}

const filterOperators = new Set([
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEquals",
  "lessThan",
  "lessThanOrEquals",
  "in",
  "notIn",
  "startsWith",
  "listContains",
  "stringContains",
  "andAll",
  "orAll",
]);

export async function loadMetadataFilter(
  options: Pick<RetrievalCliOptions, "filterJson" | "filterFile">,
): Promise<RetrievalFilter | undefined> {
  const raw = options.filterFile
    ? await readFile(options.filterFile, "utf8")
    : options.filterJson;
  if (!raw) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Metadata filter is not valid JSON: ${(error as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata filter must be a JSON object");
  }
  const keys = Object.keys(parsed);
  if (keys.length !== 1 || !filterOperators.has(keys[0] ?? "")) {
    throw new Error("Metadata filter must contain exactly one supported Bedrock filter operator");
  }

  return parsed as RetrievalFilter;
}
