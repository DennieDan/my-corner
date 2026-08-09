import { describe, expect, it, vi } from "vitest";

import {
  knowledgeIngestSteps,
  runKnowledgeIngestPipeline,
} from "../scripts/knowledge-ingest.js";

describe("runKnowledgeIngestPipeline", () => {
  it("runs validation, upload, and ingestion in order", async () => {
    const executedScripts: string[] = [];
    const runStep = vi.fn(async (step: { script: string }) => {
      executedScripts.push(step.script);
    });
    const logger = { log: vi.fn() };

    await expect(runKnowledgeIngestPipeline({ runStep, logger })).resolves.toBeUndefined();

    expect(executedScripts).toEqual([
      "validate-knowledge.ts",
      "upload-knowledge.ts",
      "sync-knowledge.ts",
    ]);
    expect(knowledgeIngestSteps[0]?.arguments).toEqual(["--require-approved"]);
    expect(logger.log).toHaveBeenLastCalledWith(
      "Knowledge ingestion pipeline completed successfully.",
    );
  });

  it("stops immediately and propagates a non-zero step failure", async () => {
    const failure = new Error("upload exited with code 1");
    const runStep = vi.fn(async (step: { script: string }) => {
      if (step.script === "upload-knowledge.ts") {
        throw failure;
      }
    });
    const logger = { log: vi.fn() };

    await expect(runKnowledgeIngestPipeline({ runStep, logger })).rejects.toBe(failure);

    expect(runStep.mock.calls.map(([step]) => step.script)).toEqual([
      "validate-knowledge.ts",
      "upload-knowledge.ts",
    ]);
    expect(logger.log).not.toHaveBeenCalledWith(
      "Knowledge ingestion pipeline completed successfully.",
    );
  });
});
