import {
  BedrockAgentClient,
  GetIngestionJobCommand,
  StartIngestionJobCommand,
  type IngestionJobStatistics,
  type IngestionJobStatus,
} from "@aws-sdk/client-bedrock-agent";

export interface IngestionJobSnapshot {
  ingestionJobId?: string;
  status?: IngestionJobStatus;
  statistics?: IngestionJobStatistics;
  failureReasons?: string[];
}

export interface KnowledgeIngestionService {
  startIngestion(knowledgeBaseId: string, dataSourceId: string): Promise<IngestionJobSnapshot>;
  getIngestion(
    knowledgeBaseId: string,
    dataSourceId: string,
    ingestionJobId: string,
  ): Promise<IngestionJobSnapshot>;
}

export class BedrockKnowledgeIngestionService implements KnowledgeIngestionService {
  public constructor(private readonly client: BedrockAgentClient) {}

  public async startIngestion(
    knowledgeBaseId: string,
    dataSourceId: string,
  ): Promise<IngestionJobSnapshot> {
    const result = await this.client.send(new StartIngestionJobCommand({
      knowledgeBaseId,
      dataSourceId,
    }));
    return result.ingestionJob ?? {};
  }

  public async getIngestion(
    knowledgeBaseId: string,
    dataSourceId: string,
    ingestionJobId: string,
  ): Promise<IngestionJobSnapshot> {
    const result = await this.client.send(new GetIngestionJobCommand({
      knowledgeBaseId,
      dataSourceId,
      ingestionJobId,
    }));
    return result.ingestionJob ?? {};
  }
}

interface Logger {
  log(message: string): void;
  error(message: string): void;
}

interface RunKnowledgeIngestionInput {
  service: KnowledgeIngestionService;
  knowledgeBaseId: string;
  dataSourceId: string;
  timeoutMs: number;
  pollIntervalMs?: number;
  logger?: Logger;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const statisticLabels: Array<[keyof IngestionJobStatistics, string]> = [
  ["numberOfDocumentsScanned", "Documents scanned"],
  ["numberOfMetadataDocumentsScanned", "Metadata documents scanned"],
  ["numberOfNewDocumentsIndexed", "New documents indexed"],
  ["numberOfModifiedDocumentsIndexed", "Modified documents indexed"],
  ["numberOfMetadataDocumentsModified", "Metadata documents modified"],
  ["numberOfDocumentsDeleted", "Documents deleted"],
  ["numberOfDocumentsFailed", "Documents failed"],
  ["numberOfDocumentsSkipped", "Documents skipped"],
];

function reportFinalJob(job: IngestionJobSnapshot, logger: Logger): void {
  logger.log(`Ingestion job ${job.ingestionJobId ?? "unknown"} final statistics:`);
  for (const [key, label] of statisticLabels) {
    logger.log(`- ${label}: ${job.statistics?.[key] ?? "not reported"}`);
  }

  if (job.failureReasons && job.failureReasons.length > 0) {
    logger.error("Bedrock failure reasons:");
    for (const reason of job.failureReasons) {
      logger.error(`- ${reason}`);
    }
  } else {
    logger.log("Bedrock failure reasons: none reported");
  }
}

export async function runKnowledgeIngestion({
  service,
  knowledgeBaseId,
  dataSourceId,
  timeoutMs,
  pollIntervalMs = 5_000,
  logger = console,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: RunKnowledgeIngestionInput): Promise<IngestionJobSnapshot> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Ingestion timeout must be a positive number of milliseconds");
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new Error("Ingestion poll interval must be a positive number of milliseconds");
  }

  let job = await service.startIngestion(knowledgeBaseId, dataSourceId);
  const ingestionJobId = job.ingestionJobId;
  if (!ingestionJobId) {
    throw new Error("Bedrock did not return an ingestion job ID");
  }

  logger.log(`Started ingestion job ${ingestionJobId}`);
  const deadline = now() + timeoutMs;

  while (job.status === "STARTING" || job.status === "IN_PROGRESS") {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new Error(
        `Timed out after ${Math.ceil(timeoutMs / 1_000)} seconds waiting for ingestion job ${ingestionJobId}. The Bedrock job may still be running.`,
      );
    }

    await sleep(Math.min(pollIntervalMs, remainingMs));
    if (now() >= deadline) {
      throw new Error(
        `Timed out after ${Math.ceil(timeoutMs / 1_000)} seconds waiting for ingestion job ${ingestionJobId}. The Bedrock job may still be running.`,
      );
    }

    job = await service.getIngestion(knowledgeBaseId, dataSourceId, ingestionJobId);
    logger.log(`Ingestion job ${ingestionJobId}: ${job.status ?? "UNKNOWN"}`);
  }

  reportFinalJob(job, logger);

  const failedDocuments = job.statistics?.numberOfDocumentsFailed ?? 0;
  if (job.status !== "COMPLETE" || failedDocuments > 0) {
    throw new Error(
      `Ingestion job ${ingestionJobId} ended with status ${job.status ?? "UNKNOWN"} and ${failedDocuments} failed document(s)`,
    );
  }

  logger.log(`Ingestion job ${ingestionJobId} completed successfully.`);
  return job;
}
