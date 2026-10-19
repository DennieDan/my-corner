# Phase 8 evaluation report

Run date: 19 October 2026. The final comparison used all 73 approved questions in `evaluations/questions.jsonl`, the development Bedrock Knowledge Base, the same retrieval results for both efforts on each question, and the agent handler's real citation gate and SSE format. Raw question responses and the detailed quality review are kept in ignored, mode-0600 files under `evaluations/results/`.

## Decision

Use `gpt-5.6-luna` with reasoning `low`, 12 semantic Bedrock candidates, the approved-public metadata filter, and a minimum retrieval score of 0.65. The `low` run passed all initial critical gates. It answered 55 of 56 answerable questions; the remaining case was a safe refusal to a false-premise question about a full-time Cyber Sierra role. The `none` run had one `ANSWER_UNVERIFIED` failure and answered 53 of 56. No stronger generation model was selected: the main remaining issues involve source coverage, requested-detail selection, and the evaluation rubric, for which a more costly model has no demonstrated benefit.

The selected agent code and `low` setting were deployed to `Dennie-development-Agent`. The deployment changed the Lambda code and environment. A live smoke test of the development API passed after deployment, and the Lambda configuration reports `OPENAI_REASONING_EFFORT=low`.

## Full-set metrics

| Measure | Luna `none` | Luna `low` |
| --- | ---: | ---: |
| Questions completed | 73/73 | 73/73 |
| Retrieval hit@5 on answerable questions | 56/56 (100%) | 56/56 (100%) |
| All expected source groups in top five | 51/56 (91.1%) | 51/56 (91.1%) |
| Appropriate refusal on deliberately unanswerable questions | 17/17 (100%) | 17/17 (100%) |
| Answered when expected | 53/56 (94.6%) | 55/56 (98.2%) |
| Supplied-label citation errors | 0 of 115 | 0 of 114 |
| Unverified-answer stream errors | 1 | 0 |
| Prompt-injection cases resisted | 5/5 | 5/5 |
| Mean end-to-end latency | 1.86 s | 1.65 s |
| Mean first token latency | 1.55 s | 1.29 s |
| Mean input / output tokens for generated responses | 3,071 / 53 | 3,080 / 62 |
| Estimated OpenAI cost for 73 questions | $0.0441 | $0.0455 |

The refusal measure includes explicit, cited statements that a private or unknown detail is unavailable. The prompt-injection cases were also inspected for secrets, invented private details, and scope abandonment; none appeared. The agent emits operational metrics without request bodies, history, retrieved text, prompts, answers, or API keys. The CDK tests assert 30-day log retention, disabled API data tracing, scoped Bedrock and Secrets Manager access, bucket encryption, and public-access blocks.

The cost estimate uses [OpenAI's published standard short-context Luna prices](https://developers.openai.com/api/docs/pricing) of $0.20 per million input tokens and $1.20 per million output tokens, assumes uncached input, and excludes AWS charges. At this question mix, three turns cost about $0.0019 in OpenAI tokens. This is an estimate, not a billing measurement.

## Essential facts and grounding review

An evaluator checked each generated answer against the approved public documents for the source IDs returned by retrieval. It counted semantic paraphrases of the question's required facts and flagged material claims absent from those documents. This is a model-assisted review using Luna `low`; the cited documents are a superset of the exact retrieved chunks, so its groundedness result may be optimistic. One false-premise rubric item, “do not infer more,” produced a one-element fact array where two items were requested from the evaluator for each effort. Both answers were manually checked: they correctly say Dan placed third in an Inter-Hall Games swim event and do not claim a first-place win. The automated counts conservatively treat both required facts for that question as missing.

| Measure | Luna `none` | Luna `low` |
| --- | ---: | ---: |
| Required facts present (conservative automated count) | 122/149 (81.9%) | 125/149 (83.9%) |
| All required facts in an answerable response | 39/56 (69.6%) | 39/56 (69.6%) |
| Generated responses without a flagged unsupported claim | 54/57 (94.7%) | 55/57 (96.5%) |
| Critical privacy or injection compromises flagged | 0 | 0 |

Manually including the unscored safe answer raises the `low` groundedness count to 56/57. The model-assisted review should be treated as a diagnostic, not an independent proof of factual correctness.

## Failure analysis and known limitations

- `false-002` asks about a full-time Cyber Sierra role. The approved source says this was an internship, but both Luna settings returned the safe generic limitation instead of correcting the premise. This is a missed answer, with no unsupported claim.
- `fact-en-008` asks about Cyber Sierra AI work. The `low` answer focused on go-to-market and customer workflows while omitting AI agents and automation documented in the approved source. The evaluation's source-level hit@5 therefore overstates whether the most useful chunk reached generation.
- Several answers omit secondary rubric facts that the question does not explicitly request, such as the internship's exact months in `fact-en-007`. Required-fact recall is intentionally strict and exposes incomplete answers; the question set was not changed to improve the metric.
- `para-en-003` uses “exploratory statistical analysis” where the public project source says “exploratory data analysis.” The evaluator flagged that wording as unsupported. The answer should use the source's narrower wording. The `none` run also supplied the wrong LinkedIn URL in `contact-en-001`; `low` supplied the approved URL.
- The comparison is a single run of each model setting. Latency and answer details may vary. Quality review used the full approved source documents corresponding to retrieved source IDs, not captured per-chunk retrieval text. AWS request costs and cache discounts were not measured.

## Verification and rerun

`npm run agent:check`, `npm run infra:check`, `npm run test:chat`, `npm run test:contract`, `npm run test:ui`, and `npm run build` pass. The development API smoke test also passed health, CORS, validation, policy refusal, live source and delta streaming, and citation-label checks. The interface tests cover open/close and focus, partial text, cited answers, history clearing, errors, retry, and cancellation.

To repeat the local handler evaluation, set `AWS_REGION` and `OPENAI_API_KEY_SECRET_ARN` in the shell and run `npm run evaluate`. Use `npm run evaluate -- --resume` to continue the same source revision after interruption. Then run `npm run evaluate:quality` for the source-backed review. Both commands use the configured development Knowledge Base and OpenAI key; they produce live provider charges. The committed report contains aggregate results, while raw answers stay outside source control.
