import type { RecordedRetrievalResult } from "./knowledge-retrieval.js";

export interface RetrievalEvaluationSource {
  sourceId: string;
  aliases: string[];
}

export interface RetrievalEvaluationQuery {
  id: string;
  language?: string;
  question?: string;
  sourceHints?: string[];
  results: RecordedRetrievalResult[];
  error?: unknown;
}

export interface SourceHintResolution {
  sourceHint: string;
  sourceIds: string[];
}

export interface QueryRetrievalEvaluation {
  answerable: boolean;
  evaluated: boolean;
  sourceHintResolutions: SourceHintResolution[];
  expectedSourceIds: string[];
  firstExpectedRank: number | null;
  firstExpectedScore: number | null;
  hitAt1: boolean | null;
  hitAt3: boolean | null;
  hitAt5: boolean | null;
  reciprocalRank: number | null;
  strongestIrrelevantResult: EvaluatedSourceResult | null;
}

export interface EvaluatedSourceResult {
  rank: number;
  score: number | null;
  sourceId: string | null;
  canonicalUrl: string | null;
  topic: string | null;
  title: string | null;
  s3Location: string | null;
}

export interface DistributionSummary {
  count: number;
  minimum: number | null;
  maximum: number | null;
  mean: number | null;
  median: number | null;
  percentile25: number | null;
  percentile75: number | null;
  percentile90: number | null;
  percentile95: number | null;
}

export interface RetrievalMetricGroupSummary {
  questionCount: number;
  answerableQuestionCount: number;
  unanswerableQuestionCount: number;
  evaluatedAnswerableQuestionCount: number;
  retrievalFailureCount: number;
  hitRateAt1: { hits: number; total: number; rate: number };
  hitRateAt3: { hits: number; total: number; rate: number };
  hitRateAt5: { hits: number; total: number; rate: number };
  meanReciprocalRank: number;
  scoreDistributions: {
    allResults: DistributionSummary;
    expectedResults: DistributionSummary;
    unexpectedResults: DistributionSummary;
    firstExpectedResultPerAnswerableQuestion: DistributionSummary;
    topResultPerAnswerableQuestion: DistributionSummary;
    topResultPerUnanswerableQuestion: DistributionSummary;
  };
}

export interface RetrievalEvaluationSummary extends RetrievalMetricGroupSummary {
  languageBreakdown: Record<string, RetrievalMetricGroupSummary>;
}

export interface RetrievalFailure {
  questionId: string;
  language: string | null;
  question: string;
  reason: "retrieval-error" | "expected-source-not-in-top-5";
  sourceHintResolutions: SourceHintResolution[];
  expectedSourceIds: string[];
  returnedSources: EvaluatedSourceResult[];
  error?: unknown;
}

export interface RetrievalEvaluation {
  summary: RetrievalEvaluationSummary;
  queries: Record<string, QueryRetrievalEvaluation>;
  failures: RetrievalFailure[];
}

export function buildSourceHintIndex(
  sources: RetrievalEvaluationSource[],
): Map<string, string[]> {
  const index = new Map<string, Set<string>>();

  for (const source of sources) {
    for (const key of new Set([source.sourceId, ...source.aliases])) {
      const sourceIds = index.get(key) ?? new Set<string>();
      sourceIds.add(source.sourceId);
      index.set(key, sourceIds);
    }
  }

  return new Map(
    [...index.entries()].map(([key, sourceIds]) => [key, [...sourceIds].sort()]),
  );
}

export function resolveSourceHints(
  sourceHints: string[],
  sourceHintIndex: ReadonlyMap<string, string[]>,
): SourceHintResolution[] {
  return sourceHints.map((sourceHint) => {
    const sourceIds = sourceHintIndex.get(sourceHint);
    if (!sourceIds || sourceIds.length === 0) {
      throw new Error(`Evaluation source hint has no registered source: ${sourceHint}`);
    }
    return { sourceHint, sourceIds };
  });
}

function quantile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) {
    return null;
  }
  const position = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex] as number;
  const upper = sortedValues[upperIndex] as number;
  return lower + (upper - lower) * (position - lowerIndex);
}

export function summarizeDistribution(values: Array<number | null | undefined>): DistributionSummary {
  const sortedValues = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  const count = sortedValues.length;

  return {
    count,
    minimum: count > 0 ? sortedValues[0] as number : null,
    maximum: count > 0 ? sortedValues[count - 1] as number : null,
    mean: count > 0
      ? sortedValues.reduce((total, value) => total + value, 0) / count
      : null,
    median: quantile(sortedValues, 0.5),
    percentile25: quantile(sortedValues, 0.25),
    percentile75: quantile(sortedValues, 0.75),
    percentile90: quantile(sortedValues, 0.9),
    percentile95: quantile(sortedValues, 0.95),
  };
}

function hitRate(
  evaluations: QueryRetrievalEvaluation[],
  key: "hitAt1" | "hitAt3" | "hitAt5",
): { hits: number; total: number; rate: number } {
  const evaluated = evaluations.filter((evaluation) => evaluation.evaluated);
  const hits = evaluated.filter((evaluation) => evaluation[key] === true).length;
  return {
    hits,
    total: evaluated.length,
    rate: evaluated.length > 0 ? hits / evaluated.length : 0,
  };
}

function evaluatedSourceResult(result: RecordedRetrievalResult): EvaluatedSourceResult {
  return {
    rank: result.rank,
    score: result.score,
    sourceId: result.sourceId,
    canonicalUrl: result.canonicalUrl,
    topic: result.topic,
    title: result.title,
    s3Location: result.s3Location,
  };
}

function summarizeQueryGroup(
  queries: RetrievalEvaluationQuery[],
  queryEvaluations: Readonly<Record<string, QueryRetrievalEvaluation>>,
): RetrievalMetricGroupSummary {
  const evaluations = queries.map((query) => queryEvaluations[query.id] as QueryRetrievalEvaluation);
  const answerableEvaluations = evaluations.filter((evaluation) => evaluation.answerable);
  const evaluatedAnswerable = answerableEvaluations.filter((evaluation) => evaluation.evaluated);
  const allScores: number[] = [];
  const expectedScores: number[] = [];
  const unexpectedScores: number[] = [];
  const firstExpectedScores: number[] = [];
  const answerableTopScores: number[] = [];
  const unanswerableTopScores: number[] = [];

  for (const query of queries) {
    const evaluation = queryEvaluations[query.id] as QueryRetrievalEvaluation;
    const expectedSourceIds = new Set(evaluation.expectedSourceIds);
    for (const result of query.results) {
      if (result.score === null) {
        continue;
      }
      allScores.push(result.score);
      if (
        evaluation.answerable &&
        result.sourceId !== null &&
        expectedSourceIds.has(result.sourceId)
      ) {
        expectedScores.push(result.score);
      } else {
        unexpectedScores.push(result.score);
      }
    }
    if (evaluation.firstExpectedScore !== null) {
      firstExpectedScores.push(evaluation.firstExpectedScore);
    }
    const topScore = query.results.find((result) => result.rank === 1)?.score;
    if (topScore !== null && topScore !== undefined) {
      (evaluation.answerable ? answerableTopScores : unanswerableTopScores).push(topScore);
    }
  }

  return {
    questionCount: queries.length,
    answerableQuestionCount: answerableEvaluations.length,
    unanswerableQuestionCount: queries.length - answerableEvaluations.length,
    evaluatedAnswerableQuestionCount: evaluatedAnswerable.length,
    retrievalFailureCount: evaluations.filter((evaluation) => !evaluation.evaluated).length,
    hitRateAt1: hitRate(answerableEvaluations, "hitAt1"),
    hitRateAt3: hitRate(answerableEvaluations, "hitAt3"),
    hitRateAt5: hitRate(answerableEvaluations, "hitAt5"),
    meanReciprocalRank: evaluatedAnswerable.length > 0
      ? evaluatedAnswerable.reduce(
        (total, evaluation) => total + (evaluation.reciprocalRank ?? 0),
        0,
      ) / evaluatedAnswerable.length
      : 0,
    scoreDistributions: {
      allResults: summarizeDistribution(allScores),
      expectedResults: summarizeDistribution(expectedScores),
      unexpectedResults: summarizeDistribution(unexpectedScores),
      firstExpectedResultPerAnswerableQuestion: summarizeDistribution(firstExpectedScores),
      topResultPerAnswerableQuestion: summarizeDistribution(answerableTopScores),
      topResultPerUnanswerableQuestion: summarizeDistribution(unanswerableTopScores),
    },
  };
}

export function evaluateRetrieval(
  queries: RetrievalEvaluationQuery[],
  sources: RetrievalEvaluationSource[],
): RetrievalEvaluation {
  const sourceHintIndex = buildSourceHintIndex(sources);
  const queryEvaluations: Record<string, QueryRetrievalEvaluation> = {};

  for (const query of queries) {
    if (query.id in queryEvaluations) {
      throw new Error(`Duplicate evaluation question ID: ${query.id}`);
    }

    const sourceHintResolutions = resolveSourceHints(query.sourceHints ?? [], sourceHintIndex);
    const expectedSourceIds = [...new Set(
      sourceHintResolutions.flatMap((resolution) => resolution.sourceIds),
    )].sort();
    const expectedSourceIdSet = new Set(expectedSourceIds);
    const answerable = expectedSourceIds.length > 0;
    const evaluated = query.error === undefined;
    const expectedResults = query.results.filter(
      (result) => result.sourceId !== null && expectedSourceIdSet.has(result.sourceId),
    );
    const firstExpectedResult = expectedResults.reduce<RecordedRetrievalResult | undefined>(
      (first, result) => !first || result.rank < first.rank ? result : first,
      undefined,
    );
    const firstExpectedRank = firstExpectedResult?.rank ?? null;
    const firstExpectedScore = firstExpectedResult?.score ?? null;
    const strongestReturnedResult = query.results
      .slice()
      .sort((left, right) => left.rank - right.rank)[0];
    const evaluation: QueryRetrievalEvaluation = {
      answerable,
      evaluated,
      sourceHintResolutions,
      expectedSourceIds,
      firstExpectedRank,
      firstExpectedScore,
      hitAt1: evaluated ? firstExpectedRank !== null && firstExpectedRank <= 1 : null,
      hitAt3: evaluated ? firstExpectedRank !== null && firstExpectedRank <= 3 : null,
      hitAt5: evaluated ? firstExpectedRank !== null && firstExpectedRank <= 5 : null,
      reciprocalRank: evaluated ? firstExpectedRank === null ? 0 : 1 / firstExpectedRank : null,
      strongestIrrelevantResult: !answerable && evaluated && strongestReturnedResult
        ? evaluatedSourceResult(strongestReturnedResult)
        : null,
    };
    queryEvaluations[query.id] = evaluation;
  }

  const languages = [...new Set(queries.map((query) => query.language ?? "unknown"))].sort();
  const languageBreakdown = Object.fromEntries(languages.map((language) => [
    language,
    summarizeQueryGroup(
      queries.filter((query) => (query.language ?? "unknown") === language),
      queryEvaluations,
    ),
  ]));
  const failures: RetrievalFailure[] = queries.flatMap((query) => {
    const evaluation = queryEvaluations[query.id] as QueryRetrievalEvaluation;
    const reason = !evaluation.evaluated
      ? "retrieval-error"
      : evaluation.answerable && evaluation.hitAt5 === false
        ? "expected-source-not-in-top-5"
        : null;
    if (!reason) {
      return [];
    }
    return [{
      questionId: query.id,
      language: query.language ?? null,
      question: query.question ?? "",
      reason,
      sourceHintResolutions: evaluation.sourceHintResolutions,
      expectedSourceIds: evaluation.expectedSourceIds,
      returnedSources: query.results
        .slice()
        .sort((left, right) => left.rank - right.rank)
        .map(evaluatedSourceResult),
      ...(query.error !== undefined ? { error: query.error } : {}),
    }];
  });

  return {
    summary: {
      ...summarizeQueryGroup(queries, queryEvaluations),
      languageBreakdown,
    },
    queries: queryEvaluations,
    failures,
  };
}
