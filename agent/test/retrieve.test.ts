import { describe, expect, it, vi } from "vitest";
import { type BedrockAgentRuntimeClient, type KnowledgeBaseRetrievalResult, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRetriever, selectEvidence } from "../src/retrieve.js";

function result(score: number, metadata: Record<string, unknown> = {}): KnowledgeBaseRetrievalResult {
  return { score, content: { text: "Approved factual text" }, metadata: {
    sourceId: "profile:public-overview", title: "Profile", canonicalUrl: "https://dandinh.net",
    visibility: "public", sensitivity: "public-safe", reviewStatus: "approved", ...metadata,
  } };
}

describe("Phase 4 evidence selection", () => {
  it("applies the 0.65 floor, approval gate and stable labels", () => {
    expect(selectEvidence([result(0.64), result(0.65), result(0.9, { reviewStatus: "pending" }),
      result(0.8), result(0.85, { canonicalUrl: "javascript:alert(1)" })]
    ).map(({ id, score }) => [id, score])).toEqual([["S1", 0.65], ["S2", 0.8]]);
  });

  it("requests 12 semantic candidates with an approved-public filter", async () => {
    const sent: RetrieveCommand[] = [];
    const send = vi.fn(async (command: RetrieveCommand) => { sent.push(command); return { retrievalResults: [result(0.8)] }; });
    const retriever = new BedrockRetriever({ send } as unknown as BedrockAgentRuntimeClient);
    const selected = await retriever.retrieve("What does Dan study?", "kb-test", new AbortController().signal);
    const command = sent[0];
    expect(command.input.retrievalConfiguration?.vectorSearchConfiguration).toMatchObject({
      numberOfResults: 12, overrideSearchType: "SEMANTIC",
      filter: { andAll: [{ equals: { key: "visibility", value: "public" } },
        { equals: { key: "sensitivity", value: "public-safe" } },
        { equals: { key: "reviewStatus", value: "approved" } }] },
    });
    expect(selected[0].id).toBe("S1");
  });
});
