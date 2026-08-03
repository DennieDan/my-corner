import { z } from "zod";

export const environmentNames = ["development", "staging", "production"] as const;

const configSchema = z.object({
  DENNIE_ENVIRONMENT: z.enum(environmentNames),
  AWS_REGION: z.string().min(1),
  BEDROCK_KNOWLEDGE_BASE_ID: z.string().min(1),
  OPENAI_API_KEY_SECRET_ARN: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  ALLOWED_ORIGIN: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AgentConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  return configSchema.parse(env);
}
