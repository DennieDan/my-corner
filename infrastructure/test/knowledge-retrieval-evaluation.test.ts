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
        language: "en",
        question: "English rank one",
        sourceHints: ["timeline:2020-01"],
        results: [result(1, "source:education", 0.9), result(2, "source:project-a", 0.7)],
      },
      {
        id: "rank-3",
        language: "vi",
        question: "Vietnamese rank three",
        sourceHints: ["project:a"],
        results: [
          result(1, "source:education", 0.8),
          result(2, "source:project-b", 0.75),
          result(3, "source:project-a", 0.6),
        ],
      },
      {
        id: "miss",
        language: "vi",
        question: "Vietnamese miss",
        sourceHints: ["project:b"],
        results: [result(1, "source:education", 0.85)],
      },
      {
        id: "unanswerable",
        language: "en",
        question: "Private information",
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
      allSourceGroupsHitRateAt5: { hits: 2, total: 3, rate: 2 / 3 },
      meanSourceGroupCoverageAt5: 2 / 3,
    });
    expect(evaluation.summary.scoreDistributions.expectedResults.count).toBe(2);
    expect(evaluation.summary.scoreDistributions.topResultPerUnanswerableQuestion).toMatchObject({
      count: 1,
      mean: 0.5,
    });
    expect(evaluation.summary.languageBreakdown.en).toMatchObject({
      questionCount: 2,
      answerableQuestionCount: 1,
      hitRateAt1: { hits: 1, total: 1, rate: 1 },
      meanReciprocalRank: 1,
    });
    expect(evaluation.summary.languageBreakdown.vi).toMatchObject({
      questionCount: 2,
      answerableQuestionCount: 2,
      hitRateAt1: { hits: 0, total: 2, rate: 0 },
      hitRateAt3: { hits: 1, total: 2, rate: 0.5 },
      hitRateAt5: { hits: 1, total: 2, rate: 0.5 },
      meanReciprocalRank: 1 / 6,
    });
    expect(evaluation.queries.unanswerable.strongestIrrelevantResult).toMatchObject({
      rank: 1,
      score: 0.5,
      sourceId: "source:education",
    });
    expect(evaluation.failures).toEqual([
      expect.objectContaining({
        questionId: "miss",
        language: "vi",
        question: "Vietnamese miss",
        reason: "expected-source-not-in-top-5",
        expectedSourceIds: ["source:project-b"],
        returnedSources: [expect.objectContaining({
          rank: 1,
          score: 0.85,
          sourceId: "source:education",
        })],
      }),
    ]);
  });

  it("requires every source group while allowing alternatives within a group", () => {
    const evaluation = evaluateRetrieval([
      {
        id: "complete-multi-source",
        language: "en",
        sourceHintGroups: [
          ["timeline:2020-01"],
          ["project:a", "project:b"],
        ],
        results: [
          result(1, "source:project-b", 0.9),
          result(3, "source:education", 0.8),
        ],
      },
      {
        id: "partial-multi-source",
        language: "vi",
        question: "Needs education and a project",
        sourceHintGroups: [
          ["timeline:2020-01"],
          ["project:a", "project:b"],
        ],
        results: [
          result(1, "source:project-a", 0.85),
          result(6, "source:education", 0.7),
        ],
      },
    ], sources);

    expect(evaluation.queries["complete-multi-source"]).toMatchObject({
      sourceHintGroupResolutions: [
        { sourceHints: ["timeline:2020-01"], sourceIds: ["source:education"] },
        {
          sourceHints: ["project:a", "project:b"],
          sourceIds: ["source:project-a", "source:project-b"],
        },
      ],
      sourceGroupCoverageAt1: { covered: 1, total: 2, rate: 0.5 },
      sourceGroupCoverageAt3: { covered: 2, total: 2, rate: 1 },
      sourceGroupCoverageAt5: { covered: 2, total: 2, rate: 1 },
      allSourceGroupsHitAt1: false,
      allSourceGroupsHitAt3: true,
      allSourceGroupsHitAt5: true,
    });
    expect(evaluation.queries["partial-multi-source"]).toMatchObject({
      hitAt1: true,
      hitAt5: true,
      sourceGroupCoverageAt5: { covered: 1, total: 2, rate: 0.5 },
      allSourceGroupsHitAt5: false,
    });
    expect(evaluation.summary).toMatchObject({
      hitRateAt5: { hits: 2, total: 2, rate: 1 },
      allSourceGroupsHitRateAt3: { hits: 1, total: 2, rate: 0.5 },
      allSourceGroupsHitRateAt5: { hits: 1, total: 2, rate: 0.5 },
      meanSourceGroupCoverageAt5: 0.75,
    });
    expect(evaluation.failures).toContainEqual(expect.objectContaining({
      questionId: "partial-multi-source",
      reason: "required-source-groups-not-in-top-5",
      missingSourceHintGroups: [{
        sourceHints: ["timeline:2020-01"],
        sourceIds: ["source:education"],
      }],
    }));
  });

  it("rejects ambiguous or empty source-group declarations", () => {
    expect(() => evaluateRetrieval([{
      id: "both-fields",
      sourceHints: ["project:a"],
      sourceHintGroups: [["project:a"]],
      results: [],
    }], sources)).toThrow("cannot use both sourceHints and sourceHintGroups");

    expect(() => evaluateRetrieval([{
      id: "empty-group",
      sourceHintGroups: [[]],
      results: [],
    }], sources)).toThrow("sourceHintGroups must contain non-empty groups");
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
        language: "vi",
        question: "Failed request",
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
    expect(evaluation.failures).toContainEqual(expect.objectContaining({
      questionId: "credentials-failed",
      language: "vi",
      question: "Failed request",
      reason: "retrieval-error",
      returnedSources: [],
    }));
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
