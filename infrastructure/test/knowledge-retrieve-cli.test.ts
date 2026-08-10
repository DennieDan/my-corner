import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadMetadataFilter,
  parseRetrievalCliArguments,
} from "../scripts/knowledge-retrieve-cli.js";
import { repositoryDirectory } from "../scripts/knowledge-manifest.js";

describe("parseRetrievalCliArguments", () => {
  it("parses single-question debugging mode", () => {
    const options = parseRetrievalCliArguments([
      "--query",
      "What projects has Dan worked on?",
      "--results",
      "8",
      "--knowledge-base-id",
      "KB123",
      "--search-type",
      "semantic",
    ]);

    expect(options).toMatchObject({
      mode: "single",
      query: "What projects has Dan worked on?",
      numberOfResults: 8,
      knowledgeBaseId: "KB123",
      searchType: "SEMANTIC",
    });
  });

  it("uses the evaluation bank and ignored results directory in bulk mode", () => {
    const options = parseRetrievalCliArguments(["--bulk"]);

    expect(options.mode).toBe("bulk");
    expect(options.numberOfResults).toBe(8);
    expect(options.searchType).toBe("DEFAULT");
    expect(options.questionsPath).toBe(path.join(repositoryDirectory, "evaluations/questions.jsonl"));
    expect(options.outputDirectory).toBe(
      path.join(repositoryDirectory, "evaluations/results/retrieval"),
    );
  });

  it("accepts --questions as bulk mode and parses inline filters", async () => {
    const options = parseRetrievalCliArguments([
      "--questions",
      "evaluations/questions.jsonl",
      "--filter",
      '{"equals":{"key":"reviewStatus","value":"approved"}}',
    ]);

    expect(options.mode).toBe("bulk");
    await expect(loadMetadataFilter(options)).resolves.toEqual({
      equals: { key: "reviewStatus", value: "approved" },
    });
  });

  it("rejects ambiguous modes and invalid result counts", () => {
    expect(() => parseRetrievalCliArguments([
      "--query",
      "Question",
      "--bulk",
    ])).toThrow("Use either --query");

    expect(() => parseRetrievalCliArguments([
      "--bulk",
      "--results",
      "0",
    ])).toThrow("--results must be an integer from 1 to 100");
  });

  it("rejects malformed or unsupported filters", async () => {
    await expect(loadMetadataFilter({ filterJson: "not-json" })).rejects.toThrow(
      "Metadata filter is not valid JSON",
    );
    await expect(loadMetadataFilter({ filterJson: '{"unsupported":{}}' })).rejects.toThrow(
      "exactly one supported Bedrock filter operator",
    );
  });
});
