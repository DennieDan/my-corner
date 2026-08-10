import { describe, expect, it } from "vitest";

import {
  buildSourceHintIndex,
  evaluateRetrieval,
  resolveSourceHints,
  summarizeDistribution,
} from "../scripts/knowledge-retrieval-evaluation.js";
import type { RecordedRetrievalResult } from "../scripts/knowledge-retrieval.js";

const sources = [
  { sourceId: "source:education", aliases: ["timeline:2020-01"] },
  { sourceId: "source:project-a", aliases: ["resume:projects", "project:a"] },
  { sourceId: "source:project-b", aliases: ["resume:projects", "project:b"] },
];

function result(rank: number, sourceId: string, score: number): RecordedRetrievalResult {
  return {
    rank,
    score,
    text: "Evidence",
    contentType: "TEXT",
    sourceId,
    canonicalUrl: null,
    topic: null,
    title: null,
    owner: null,
    lastReviewedAt: null,
    visibility: null,
    sensitivity: null,
    reviewStatus: null,
    aliases: [],
    s3Location: null,
    locationType: null,
    documentId: null,
    metadata: {},
  };
}

describe("source hint resolution", () => {
  it("resolves source IDs, one-to-one aliases, and shared aliases", () => {
    const index = buildSourceHintIndex(sources);

    expect(resolveSourceHints([
      "source:education",
      "timeline:2020-01",
      "resume:projects",
    ], index)).toEqual([
      { sourceHint: "source:education", sourceIds: ["source:education"] },
      { sourceHint: "timeline:2020-01", sourceIds: ["source:education"] },
      {
        sourceHint: "resume:projects",
        sourceIds: ["source:project-a", "source:project-b"],
      },
    ]);
  });

  it("fails when a source hint is not registered", () => {
    expect(() => resolveSourceHints(["missing"], buildSourceHintIndex(sources))).toThrow(
      "Evaluation source hint has no registered source: missing",
    );
  });
});

describe("evaluateRetrieval", () => {
  it("calculates hit rates, reciprocal rank, and per-question matches", () => {
    const evaluation = evaluateRetrieval([
      {
        id: "rank-1",
        sourceHints: ["timeline:2020-01"],
        results: [result(1, "source:education", 0.9), result(2, "source:project-a", 0.7)],
      },
      {
        id: "rank-3",
        sourceHints: ["project:a"],
        results: [
          result(1, "source:education", 0.8),
          result(2, "source:project-b", 0.75),
          result(3, "source:project-a", 0.6),
        ],
      },
      {
        id: "miss",
        sourceHints: ["project:b"],
        results: [result(1, "source:education", 0.85)],
      },
      {
        id: "unanswerable",
        sourceHints: [],
        results: [result(1, "source:education", 0.5)],
      },
    ], sources);

    expect(evaluation.queries["rank-1"]).toMatchObject({
      answerable: true,
      expectedSourceIds: ["source:education"],
      firstExpectedRank: 1,
      hitAt1: true,
      hitAt3: true,
      hitAt5: true,
      reciprocalRank: 1,
    });
    expect(evaluation.queries["rank-3"]).toMatchObject({
      firstExpectedRank: 3,
      hitAt1: false,
      hitAt3: true,
      hitAt5: true,
      reciprocalRank: 1 / 3,
    });
    expect(evaluation.queries.miss).toMatchObject({
      firstExpectedRank: null,
      hitAt1: false,
      hitAt3: false,
      hitAt5: false,
      reciprocalRank: 0,
    });
    expect(evaluation.summary).toMatchObject({
      answerableQuestionCount: 3,
      unanswerableQuestionCount: 1,
      evaluatedAnswerableQuestionCount: 3,
      retrievalFailureCount: 0,
      hitRateAt1: { hits: 1, total: 3, rate: 1 / 3 },
      hitRateAt3: { hits: 2, total: 3, rate: 2 / 3 },
      hitRateAt5: { hits: 2, total: 3, rate: 2 / 3 },
      meanReciprocalRank: (1 + 1 / 3) / 3,
    });
    expect(evaluation.summary.scoreDistributions.expectedResults.count).toBe(2);
    expect(evaluation.summary.scoreDistributions.topResultPerUnanswerableQuestion).toMatchObject({
      count: 1,
      mean: 0.5,
    });
  });

  it("excludes retrieval failures from hit-rate and MRR denominators", () => {
    const evaluation = evaluateRetrieval([
      {
        id: "success",
        sourceHints: ["project:a"],
        results: [result(1, "source:project-a", 0.9)],
      },
      {
        id: "credentials-failed",
        sourceHints: ["project:b"],
        results: [],
        error: { name: "CredentialsProviderError" },
      },
    ], sources);

    expect(evaluation.queries["credentials-failed"]).toMatchObject({
      answerable: true,
      evaluated: false,
      hitAt1: null,
      hitAt3: null,
      hitAt5: null,
      reciprocalRank: null,
    });
    expect(evaluation.summary).toMatchObject({
      answerableQuestionCount: 2,
      evaluatedAnswerableQuestionCount: 1,
      retrievalFailureCount: 1,
      hitRateAt1: { hits: 1, total: 1, rate: 1 },
      meanReciprocalRank: 1,
    });
  });

  it("summarizes score distributions with percentiles", () => {
    expect(summarizeDistribution([0.1, 0.2, 0.3, null, undefined])).toEqual({
      count: 3,
      minimum: 0.1,
      maximum: 0.3,
      mean: 0.20000000000000004,
      median: 0.2,
      percentile25: 0.15000000000000002,
      percentile75: 0.25,
      percentile90: 0.28,
      percentile95: 0.29,
    });
  });
});
