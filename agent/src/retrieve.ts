import { BedrockAgentRuntimeClient, RetrieveCommand, type KnowledgeBaseRetrievalResult, type RetrievalFilter } from "@aws-sdk/client-bedrock-agent-runtime";

import { AgentError, retryTransient } from "./errors.js";

export interface Evidence {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  text: string;
  score: number;
}

export interface Retriever {
  retrieve(query: string, knowledgeBaseId: string, signal: AbortSignal): Promise<Evidence[]>;
}

const approvedFilter: RetrievalFilter = { andAll: [
  { equals: { key: "visibility", value: "public" } },
  { equals: { key: "sensitivity", value: "public-safe" } },
  { equals: { key: "reviewStatus", value: "approved" } },
] };

function cleanResult(result: KnowledgeBaseRetrievalResult): Omit<Evidence, "id"> | null {
  const meta = result.metadata ?? {};
  const score = result.score;
  const text = result.content?.text?.trim();
  const sourceId = meta.sourceId;
  const title = meta.title;
  const url = meta.canonicalUrl;
  let safeUrl = false;
  if (typeof url === "string" && url.length <= 2_048) {
    try {
      const parsed = new URL(url);
      safeUrl = parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password;
    } catch { /* invalid citation URL */ }
  }
  if (typeof score !== "number" || score < 0.65 || !Number.isFinite(score) || !text ||
      meta.visibility !== "public" || meta.sensitivity !== "public-safe" || meta.reviewStatus !== "approved" ||
      typeof sourceId !== "string" || !sourceId || typeof title !== "string" || !title ||
      typeof url !== "string" || !safeUrl) return null;
  return { sourceId: sourceId.slice(0, 128), title: title.slice(0, 160), url, text: text.slice(0, 6_000), score };
}

export function selectEvidence(results: KnowledgeBaseRetrievalResult[]): Evidence[] {
  return results.slice(0, 12).flatMap((result) => {
    const evidence = cleanResult(result);
    return evidence ? [evidence] : [];
  }).slice(0, 12).map((evidence, index) => ({ ...evidence, id: `S${index + 1}` }));
}

export class BedrockRetriever implements Retriever {
  constructor(private readonly client = new BedrockAgentRuntimeClient({ maxAttempts: 1 })) {}

  async retrieve(query: string, knowledgeBaseId: string, signal: AbortSignal): Promise<Evidence[]> {
    const command = new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: { vectorSearchConfiguration: {
        numberOfResults: 12,
        overrideSearchType: "SEMANTIC",
        filter: approvedFilter,
      } },
    });
    try {
      const response = await retryTransient(async () => {
        try { return await this.client.send(command, { abortSignal: signal }); }
        catch (error) {
          const name = error instanceof Error ? error.name : "";
          const status = typeof error === "object" && error !== null && "$metadata" in error
            ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined;
          const transient = ["ThrottlingException", "ServiceUnavailableException", "InternalServerException"].includes(name) ||
            (typeof status === "number" && status >= 500);
          throw new AgentError("UPSTREAM_UNAVAILABLE", 503, transient);
        }
      }, signal);
      return selectEvidence(response.retrievalResults ?? []);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      throw error;
    }
  }
}
