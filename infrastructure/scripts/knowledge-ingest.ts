export interface KnowledgeIngestStep {
  name: string;
  script: string;
  arguments: string[];
}

export const knowledgeIngestSteps: KnowledgeIngestStep[] = [
  {
    name: "Validate corpus and enforce approval gate",
    script: "validate-knowledge.ts",
    arguments: ["--require-approved"],
  },
  {
    name: "Compare and upload knowledge objects",
    script: "upload-knowledge.ts",
    arguments: [],
  },
  {
    name: "Start ingestion and wait for Bedrock",
    script: "sync-knowledge.ts",
    arguments: [],
  },
];

interface Logger {
  log(message: string): void;
}

interface RunKnowledgeIngestPipelineInput {
  runStep(step: KnowledgeIngestStep): Promise<void>;
  logger?: Logger;
}

export async function runKnowledgeIngestPipeline({
  runStep,
  logger = console,
}: RunKnowledgeIngestPipelineInput): Promise<void> {
  for (const [index, step] of knowledgeIngestSteps.entries()) {
    logger.log(`[${index + 1}/${knowledgeIngestSteps.length}] ${step.name}`);
    await runStep(step);
  }

  logger.log("Knowledge ingestion pipeline completed successfully.");
}
