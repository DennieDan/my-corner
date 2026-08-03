import {
  BedrockAgentClient,
  GetIngestionJobCommand,
  StartIngestionJobCommand,
} from "@aws-sdk/client-bedrock-agent";

import { requireEnvironment } from "./env.js";

const knowledgeBaseId = requireEnvironment("BEDROCK_KNOWLEDGE_BASE_ID");
const dataSourceId = requireEnvironment("BEDROCK_DATA_SOURCE_ID");
const client = new BedrockAgentClient({});

const started = await client.send(new StartIngestionJobCommand({ knowledgeBaseId, dataSourceId }));
const ingestionJobId = started.ingestionJob?.ingestionJobId;
if (!ingestionJobId) {
  throw new Error("Bedrock did not return an ingestion job ID");
}

console.log(`Started ingestion job ${ingestionJobId}`);
let status = started.ingestionJob?.status;

while (status === "STARTING" || status === "IN_PROGRESS") {
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const result = await client.send(new GetIngestionJobCommand({
    knowledgeBaseId,
    dataSourceId,
    ingestionJobId,
  }));
  status = result.ingestionJob?.status;
  console.log(`Ingestion job ${ingestionJobId}: ${status ?? "UNKNOWN"}`);
}

if (status !== "COMPLETE") {
  throw new Error(`Ingestion job ${ingestionJobId} ended with status ${status ?? "UNKNOWN"}`);
}
