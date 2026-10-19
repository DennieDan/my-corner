import assert from "node:assert/strict";
import { test } from "node:test";

import { scoreQuality, scoreRun, scoreVariant, sourceGroups } from "../evaluations/score-evaluation.mjs";

const aliases = { "timeline:2020-01": "education-and-journey", "profile:education": "education-and-journey" };

test("retrieval groups resolve aliases and count a top-five hit", () => {
  const question = { expectedBehavior: "answer", sourceHintGroups: [["timeline:2020-01"], ["profile:education"]] };
  assert.deepEqual(sourceGroups(question, aliases), [["education-and-journey"], ["education-and-journey"]]);
  const score = scoreVariant(question, { sourceIds: ["education-and-journey"], sources: [{ id: "S1" }],
    answer: "Dan learned Python in 2020 [S1]\n", outcome: "answered", usage: { input_tokens: 100, output_tokens: 50 } }, aliases);
  assert.equal(score.retrievalHitAtFive, true);
  assert.equal(score.allSourceGroupsHitAtFive, true);
  assert.equal(score.invalidCitationCount, 0);
  assert.equal(score.linesCited, true);
  assert.equal(score.estimatedOpenAiUsd, 0.00008);
});

test("unverified citations and provider failures fail gates", () => {
  const report = { config: { efforts: ["none", "low"], sourceAliases: aliases }, questions: [{
    id: "q1", expectedBehavior: "decline-missing-evidence", category: "missing-evidence", sourceHints: [],
    variants: {
      none: { answer: "Invented [S2]", sources: [{ id: "S1" }], sourceIds: [], outcome: "answered", durationMs: 100, firstTokenMs: 50 },
      low: { answer: "", sources: [], sourceIds: [], outcome: "UPSTREAM_UNAVAILABLE", errorCode: "UPSTREAM_UNAVAILABLE", durationMs: 100 },
    },
  }] };
  const summary = scoreRun(report);
  assert.equal(summary.gatesPass, false);
  assert.deepEqual(summary.byEffort.none.refusalMisses, ["q1"]);
  assert.equal(summary.byEffort.none.invalidCitations, 1);
  assert.equal(summary.byEffort.low.failures[0].code, "UPSTREAM_UNAVAILABLE");
});

test("quality summary counts missing facts and unsupported claims", () => {
  const report = { config: { efforts: ["none"] }, questions: [{
    id: "q1", expectedBehavior: "answer", requiredFacts: ["first", "second"],
    variants: { none: { outcome: "answered" } },
  }] };
  const review = { results: { "q1:none": { factPresent: [true, false],
    unsupportedClaims: ["Unsupported sentence"], criticalCompromise: false } } };
  const score = scoreQuality(report, review).byEffort.none;
  assert.equal(score.essentialFactRecall, 0.5);
  assert.equal(score.completeAnswerRate, 0);
  assert.equal(score.groundedAnswerRate, 0);
  assert.deepEqual(score.missingFacts, [{ id: "q1", facts: ["second"] }]);
});

test("a cited statement that information is unavailable counts as refusal", () => {
  const question = { expectedBehavior: "decline-missing-evidence" };
  const score = scoreVariant(question, { outcome: "answered", errorCode: null,
    answer: "Dan's availability is not available in public information. [S1]\n",
    sources: [{ id: "S1" }], sourceIds: [] });
  assert.equal(score.refused, true);
});
