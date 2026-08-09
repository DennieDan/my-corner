import { describe, expect, it, vi } from "vitest";

import {
  runKnowledgeIngestion,
  type IngestionJobSnapshot,
  type KnowledgeIngestionService,
} from "../scripts/knowledge-ingestion.js";

function makeService(started: IngestionJobSnapshot, updates: IngestionJobSnapshot[] = []) {
  const startIngestion = vi.fn(async () => started);
  const getIngestion = vi.fn(async () => updates.shift() ?? started);
  const service: KnowledgeIngestionService = { startIngestion, getIngestion };
  return { service, startIngestion, getIngestion };
}

function makeLogger() {
  return { log: vi.fn(), error: vi.fn() };
}

const identifiers = {
  knowledgeBaseId: "knowledge-base-id",
  dataSourceId: "data-source-id",
};

describe("runKnowledgeIngestion", () => {
  it("prints final ingestion statistics and reports no failure reasons", async () => {
    const complete: IngestionJobSnapshot = {
      ingestionJobId: "job-123",
      status: "COMPLETE",
      statistics: {
        numberOfDocumentsScanned: 14,
        numberOfMetadataDocumentsScanned: 14,
        numberOfNewDocumentsIndexed: 1,
        numberOfModifiedDocumentsIndexed: 2,
        numberOfMetadataDocumentsModified: 2,
        numberOfDocumentsDeleted: 1,
        numberOfDocumentsFailed: 0,
        numberOfDocumentsSkipped: 10,
      },
    };
    const { service, getIngestion } = makeService(
      { ingestionJobId: "job-123", status: "STARTING" },
      [complete],
    );
    const logger = makeLogger();

    await expect(runKnowledgeIngestion({
      service,
      ...identifiers,
      timeoutMs: 10_000,
      pollIntervalMs: 1,
      logger,
      sleep: async () => undefined,
    })).resolves.toBe(complete);

    expect(getIngestion).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith("- Documents scanned: 14");
    expect(logger.log).toHaveBeenCalledWith("- Documents failed: 0");
    expect(logger.log).toHaveBeenCalledWith("Bedrock failure reasons: none reported");
  });

  it("prints Bedrock failure reasons before failing", async () => {
    const { service } = makeService({
      ingestionJobId: "job-failed",
      status: "FAILED",
      statistics: { numberOfDocumentsFailed: 2 },
      failureReasons: ["The source document could not be parsed", "Metadata is invalid"],
    });
    const logger = makeLogger();

    await expect(runKnowledgeIngestion({
      service,
      ...identifiers,
      timeoutMs: 10_000,
      logger,
    })).rejects.toThrow("status FAILED and 2 failed document(s)");

    expect(logger.error).toHaveBeenCalledWith("Bedrock failure reasons:");
    expect(logger.error).toHaveBeenCalledWith("- The source document could not be parsed");
    expect(logger.error).toHaveBeenCalledWith("- Metadata is invalid");
  });

  it("fails a completed job when Bedrock reports failed documents", async () => {
    const { service } = makeService({
      ingestionJobId: "job-partial",
      status: "COMPLETE",
      statistics: { numberOfDocumentsFailed: 1 },
    });

    await expect(runKnowledgeIngestion({
      service,
      ...identifiers,
      timeoutMs: 10_000,
      logger: makeLogger(),
    })).rejects.toThrow("status COMPLETE and 1 failed document(s)");
  });

  it("stops polling at the configured timeout", async () => {
    const { service, getIngestion } = makeService(
      { ingestionJobId: "job-slow", status: "STARTING" },
      [{ ingestionJobId: "job-slow", status: "IN_PROGRESS" }],
    );
    let currentTime = 0;

    await expect(runKnowledgeIngestion({
      service,
      ...identifiers,
      timeoutMs: 10_000,
      pollIntervalMs: 5_000,
      logger: makeLogger(),
      now: () => currentTime,
      sleep: async (milliseconds) => {
        currentTime += milliseconds;
      },
    })).rejects.toThrow("Timed out after 10 seconds waiting for ingestion job job-slow");

    expect(getIngestion).toHaveBeenCalledOnce();
  });

  it("rejects invalid timeout and polling values", async () => {
    const { service } = makeService({ ingestionJobId: "job", status: "COMPLETE" });

    await expect(runKnowledgeIngestion({
      service,
      ...identifiers,
      timeoutMs: 0,
    })).rejects.toThrow("Ingestion timeout must be a positive number");

    await expect(runKnowledgeIngestion({
      service,
      ...identifiers,
      timeoutMs: 1_000,
      pollIntervalMs: Number.NaN,
    })).rejects.toThrow("Ingestion poll interval must be a positive number");
  });
});
