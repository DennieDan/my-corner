import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  type KnowledgeBaseRetrievalResult,
  type RetrievalFilter,
  type SearchType,
} from "@aws-sdk/client-bedrock-agent-runtime";

export type RetrievalSearchType = "DEFAULT" | SearchType;

export interface RetrievalConfiguration {
  knowledgeBaseId: string;
  numberOfResults: number;
  searchType: RetrievalSearchType;
  metadataFilter?: RetrievalFilter;
}

export interface RecordedRetrievalResult {
  rank: number;
  score: number | null;
  text: string;
  contentType: string | null;
  sourceId: string | null;
  canonicalUrl: string | null;
  topic: string | null;
  title: string | null;
  owner: string | null;
  lastReviewedAt: string | null;
  visibility: string | null;
  sensitivity: string | null;
  reviewStatus: string | null;
  aliases: string[];
  s3Location: string | null;
  locationType: string | null;
  documentId: string | null;
  metadata: Record<string, unknown>;
}

export interface KnowledgeRetrievalService {
  retrieve(query: string, configuration: RetrievalConfiguration): Promise<RecordedRetrievalResult[]>;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function metadataStringList(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return [];
  }

  return value.map((item) => {
    try {
      const parsed: unknown = JSON.parse(item);
      return typeof parsed === "string" ? parsed : item;
    } catch {
      return item;
    }
  });
}

export function recordRetrievalResult(
  result: KnowledgeBaseRetrievalResult,
  rank: number,
): RecordedRetrievalResult {
  const metadata: Record<string, unknown> = { ...result.metadata };

  return {
    rank,
    score: result.score ?? null,
    text: result.content?.text ?? "",
    contentType: result.content?.type ?? null,
    sourceId: metadataString(metadata, "sourceId"),
    canonicalUrl: metadataString(metadata, "canonicalUrl"),
    topic: metadataString(metadata, "topic"),
    title: metadataString(metadata, "title"),
    owner: metadataString(metadata, "owner"),
    lastReviewedAt: metadataString(metadata, "lastReviewedAt"),
    visibility: metadataString(metadata, "visibility"),
    sensitivity: metadataString(metadata, "sensitivity"),
    reviewStatus: metadataString(metadata, "reviewStatus"),
    aliases: metadataStringList(metadata, "aliases"),
    s3Location: result.location?.s3Location?.uri ?? null,
    locationType: result.location?.type ?? null,
    documentId: result.documentId ?? null,
    metadata,
  };
}

export class BedrockKnowledgeRetrievalService implements KnowledgeRetrievalService {
  public constructor(private readonly client: BedrockAgentRuntimeClient) {}

  public async retrieve(
    query: string,
    configuration: RetrievalConfiguration,
  ): Promise<RecordedRetrievalResult[]> {
    const vectorSearchConfiguration = {
      numberOfResults: configuration.numberOfResults,
      ...(configuration.searchType === "DEFAULT"
        ? {}
        : { overrideSearchType: configuration.searchType }),
      ...(configuration.metadataFilter ? { filter: configuration.metadataFilter } : {}),
    };
    const response = await this.client.send(new RetrieveCommand({
      knowledgeBaseId: configuration.knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: { vectorSearchConfiguration },
    }));

    return (response.retrievalResults ?? []).map((result, index) =>
      recordRetrievalResult(result, index + 1)
    );
  }
}
