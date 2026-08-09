import { BedrockAgentClient } from "@aws-sdk/client-bedrock-agent";

import { requireEnvironment } from "./env.js";
import {
  BedrockKnowledgeIngestionService,
  runKnowledgeIngestion,
} from "./knowledge-ingestion.js";

const knowledgeBaseId = requireEnvironment("BEDROCK_KNOWLEDGE_BASE_ID");
const dataSourceId = requireEnvironment("BEDROCK_DATA_SOURCE_ID");
const timeoutSecondsValue = process.env.KNOWLEDGE_INGESTION_TIMEOUT_SECONDS?.trim() || "900";
const timeoutSeconds = Number(timeoutSecondsValue);
if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
  throw new Error("KNOWLEDGE_INGESTION_TIMEOUT_SECONDS must be a positive number");
}

await runKnowledgeIngestion({
  service: new BedrockKnowledgeIngestionService(new BedrockAgentClient({})),
  knowledgeBaseId,
  dataSourceId,
  timeoutMs: timeoutSeconds * 1_000,
});
