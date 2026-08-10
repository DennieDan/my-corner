import type { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { describe, expect, it, vi } from "vitest";

import {
  BedrockKnowledgeRetrievalService,
  recordRetrievalResult,
} from "../scripts/knowledge-retrieval.js";

describe("recordRetrievalResult", () => {
  it("records rank, score, text, citation metadata, and S3 location", () => {
    const recorded = recordRetrievalResult({
      content: { type: "TEXT", text: "Dan worked on the Dennie RAG chatbot." },
      score: 0.91,
      documentId: "document-123",
      location: { type: "S3", s3Location: { uri: "s3://private/documents/profile.md" } },
      metadata: {
        sourceId: "profile:public-overview",
        canonicalUrl: "https://dandinh.net",
        topic: "profile",
        title: "Dan's public profile",
        owner: "Dan",
        lastReviewedAt: "2026-08-03",
        visibility: "public",
        sensitivity: "public-safe",
        reviewStatus: "approved",
        aliases: ['"profile:identity"', "profile:contact"],
        extraCitationField: "preserved",
      },
    }, 2);

    expect(recorded).toMatchObject({
      rank: 2,
      score: 0.91,
      text: "Dan worked on the Dennie RAG chatbot.",
      sourceId: "profile:public-overview",
      canonicalUrl: "https://dandinh.net",
      topic: "profile",
      aliases: ["profile:identity", "profile:contact"],
      s3Location: "s3://private/documents/profile.md",
      documentId: "document-123",
      metadata: { extraCitationField: "preserved" },
    });
  });
});

describe("BedrockKnowledgeRetrievalService", () => {
  it("calls Retrieve with configurable result count, search type, and filter", async () => {
    let sentCommand: unknown;
    const send = vi.fn(async (command: unknown) => {
      sentCommand = command;
      return {
        retrievalResults: [{ content: { type: "TEXT", text: "Evidence" }, score: 0.8 }],
      };
    });
    const client = { send } as unknown as BedrockAgentRuntimeClient;
    const service = new BedrockKnowledgeRetrievalService(client);
    const filter = { equals: { key: "reviewStatus", value: "approved" } } as const;

    const results = await service.retrieve("What projects?", {
      knowledgeBaseId: "KB123",
      numberOfResults: 8,
      searchType: "SEMANTIC",
      metadataFilter: filter,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.rank).toBe(1);
    expect(send).toHaveBeenCalledOnce();
    const command = sentCommand as { input: unknown };
    expect(command.input).toEqual({
      knowledgeBaseId: "KB123",
      retrievalQuery: { text: "What projects?" },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 8,
          overrideSearchType: "SEMANTIC",
          filter,
        },
      },
    });
  });

  it("lets Bedrock choose the search type when configured as default", async () => {
    let sentCommand: unknown;
    const send = vi.fn(async (command: unknown) => {
      sentCommand = command;
      return { retrievalResults: [] };
    });
    const client = { send } as unknown as BedrockAgentRuntimeClient;
    const service = new BedrockKnowledgeRetrievalService(client);

    await service.retrieve("Question", {
      knowledgeBaseId: "KB123",
      numberOfResults: 5,
      searchType: "DEFAULT",
    });

    const command = sentCommand as {
      input: { retrievalConfiguration: { vectorSearchConfiguration: object } };
    };
    expect(command.input.retrievalConfiguration.vectorSearchConfiguration).toEqual({
      numberOfResults: 5,
    });
  });
});
