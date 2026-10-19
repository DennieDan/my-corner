# Phase 4 baseline retrieval report

## Report status

- Phase: 4 — Implement ingestion and validate retrieval
- Status: Complete with documented limitations
- Report date: 10 August 2026 (Asia/Singapore)
- Final ingestion completed: 10 August 2026 at 16:54:40 SGT (`2026-08-10T08:54:40.076758Z`)
- Repository baseline: `1ac9f154c2cb664504448a2af946d8dabd3a2de1`

Phase 4 established a repeatable validated ingestion workflow, a direct Bedrock retrieval harness, machine-readable bulk evaluation, bilingual and multi-source metrics, a baseline retrieval configuration, and a documented handoff to the Phase 5 generation layer.

## Knowledge Base and ingestion identifiers

| Item | Value |
| --- | --- |
| AWS Region | `ap-southeast-1` |
| Knowledge Base ID | `0DHVJWVXZG` |
| Data source ID | `ENAGNFLKA3` |
| Source bucket | `dennie-development-knowle-mycornerknowledgesourceb-mvlh8pjrpmif` |
| Source prefix | `documents` |
| Final ingestion job ID | `FATRZMBDO5` |
| Final ingestion status | `COMPLETE` |
| Documents scanned | 14 |
| Metadata documents scanned | 14 |
| New documents indexed | 0 |
| Modified documents indexed | 3 |
| Metadata documents modified | 0 |
| Documents deleted | 0 |
| Documents failed | 0 |

The final job was verified through the Bedrock `GetIngestionJob` API on 10 August 2026.

## Corpus and evaluation-bank versions

### Corpus

- Source-registry schema: version 1.
- Registered sources: 14.
- Approved sources: 14.
- Source review date: 3 August 2026.
- Registry SHA-256: `b7b019e7045b7164a2d607410508786044235e39a44bc172f3eef795bad5c8bc`.
- Aggregate knowledge-directory SHA-256: `018ad8c2fdf44d38dc9330216685743dec1641bca7eab115ba913f55a05d46d4`.

The aggregate fingerprint is the SHA-256 of the sorted per-file SHA-256 list for tracked knowledge documents, registry data, and Bedrock metadata sidecars, excluding `.DS_Store`.

### Evaluation bank

- Questions: 73.
- English questions: 57.
- Vietnamese questions: 16.
- Questions with expected source evidence: 56 — 45 English and 11 Vietnamese.
- Questions without expected source evidence: 17 — 12 English and 5 Vietnamese.
- Approval states: 67 Phase 0 approved and 6 Phase 2 owner approved.
- Retrieval-result schema: version 2.
- Evaluation-bank SHA-256: `53be6c7f6b02f17369483bd10272f1b880ab2c424876b12f8931870bb10c1a80`.

Version 2 adds grouped source expectations. A flat `sourceHints` list represents acceptable alternatives. `sourceHintGroups` requires every outer group, while allowing any registered source or alias within one group to satisfy that group.

## Tested configurations

No metadata filter was applied in the baseline tests.

| Results | Search type | Requests | Outcome |
| ---: | --- | ---: | --- |
| 8 | `DEFAULT` | 73/73 succeeded | Historical grouped-evaluation baseline before the final source-group remediation |
| 12 | `DEFAULT` | 73/73 succeeded | Same retrieval quality as explicit semantic search |
| 12 | `SEMANTIC` | 73/73 succeeded | Selected search configuration |
| 12 | `HYBRID` | 0/73 succeeded | Unsupported by the configured Bedrock index; every request returned `ValidationException` |

Default and explicit semantic search produced identical source ordering for 72 of 73 questions in the final comparison. The single-run mean durations were approximately 342 ms for default and 299 ms for semantic. These timings are directional only and are not a statistically significant benchmark.

## Baseline retrieval results

The selected-run metrics below come from the 12-result semantic run generated at `2026-08-10T09:58:54.549Z`.

### Any expected source

These metrics preserve the conventional definition: a hit occurs when any acceptable expected source appears by rank K.

| Group | Hit@1 | Hit@3 | Hit@5 | MRR |
| --- | ---: | ---: | ---: | ---: |
| Collective | 44/56 — 78.6% | 53/56 — 94.6% | 56/56 — 100.0% | 0.872 |
| English | 37/45 — 82.2% | 43/45 — 95.6% | 45/45 — 100.0% | — |
| Vietnamese | 7/11 — 63.6% | 10/11 — 90.9% | 11/11 — 100.0% | — |

### Complete required-source groups

For multi-source questions, this stricter metric requires every evidence group to appear by rank K.

| Group | All groups @1 | All groups @3 | All groups @5 | Mean group coverage @5 |
| --- | ---: | ---: | ---: | ---: |
| Collective | 40/56 — 71.4% | 49/56 — 87.5% | 51/56 — 91.1% | 95.1% |
| English | 34/45 — 75.6% | 41/45 — 91.1% | 42/45 — 93.3% | 96.1% |
| Vietnamese | 6/11 — 54.5% | 8/11 — 72.7% | 9/11 — 81.8% | 90.9% |

A rank-depth analysis of the same 12-result semantic run found complete group coverage for 52/56 questions at rank 8, 53/56 at rank 10, and 55/56 at rank 12.

The Phase 4 top-five exit target is met by both conventional Hit@5 and the stricter collective all-groups Hit@5. Vietnamese complete-group Hit@5 is below 90%, so bilingual multi-source behavior remains an explicit Phase 5/8 quality target.

## Unanswerable-question threshold analysis

The 17 questions without expected evidence include missing-evidence, restricted, out-of-scope, and prompt-injection cases.

| Distribution | Minimum | Median | Mean | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Top result for answerable questions | 0.734 | 0.796 | 0.800 | 0.902 |
| First expected result | 0.710 | 0.796 | 0.796 | 0.902 |
| Top result for unanswerable questions | 0.627 | 0.730 | 0.715 | 0.794 |

The ranges overlap. The strongest unanswerable result was `unknown-001`, “What is Dan's current GPA?”, at 0.794 because the Education source is topically relevant even though it does not disclose a GPA. Retrieval relevance therefore cannot, by itself, determine whether the requested fact exists or whether policy allows an answer.

Filtering the 12-result candidate set produced the following trade-off:

| Candidate threshold | Questions with complete source groups | Mean group coverage | Unanswerable questions whose top score meets threshold |
| ---: | ---: | ---: | ---: |
| None | 55/56 | 99.7% | 17/17 |
| 0.65 | 55/56 | 99.5% | 16/17 |
| 0.68 | 53/56 | 98.3% | 13/17 |
| 0.70 | 53/56 | 97.4% | 9/17 |
| 0.71 | 51/56 | 95.1% | 9/17 |
| 0.75 | 45/56 | 82.7% | 4/17 |

The selected 0.65 value is a conservative candidate-quality floor, not an answer/refusal boundary. Security, restricted, and out-of-scope decisions must be enforced separately. The generation layer must determine whether the retained chunks explicitly support the requested fact and decline or qualify the answer when they do not.

## Failure analysis and remediation performed

### Remediation completed during Phase 4

- Added approved-only validation for the source registry, Markdown files, metadata sidecars, aliases, and evaluation coverage.
- Added changed-file upload detection and safe reporting for managed S3 objects that are no longer registered.
- Combined validation, approval gating, upload, ingestion, timeout handling, job ID reporting, statistics, and failure reasons into `knowledge:ingest`.
- Added a direct Bedrock retrieval CLI with single-question and bulk modes, configurable result count, search type, and metadata filters.
- Added timestamped machine-readable raw results without writing retrieved text to terminal logs.
- Added source resolution, Hit@1/3/5, MRR, score distributions, bilingual breakdowns, strongest irrelevant results, and detailed failure lists.
- Added multi-source evaluation with AND-across-groups and OR-within-a-group semantics.
- Tuned the ARAAg, Gym Crowd Prediction, and Data Analyzer documents. The RAG paraphrase moved from rank 7 to rank 2.
- Corrected the cloud-project paraphrase to accept the Skills source when it contains the required Gym/AWS evidence.
- Reworded an ambiguous non-programmer question so it uniquely targets the Data Analyzer project.
- Tested default, semantic, and hybrid retrieval. Hybrid was rejected as unsupported; semantic was selected explicitly.

### Failures in the selected run

At rank 5, five broad multi-source questions still lacked one or more required evidence groups: `multi-en-001`, `multi-en-002`, `multi-en-003`, `multi-vi-001`, and `multi-vi-002`. Increasing the inspected depth to 12 resolved four of the five.

`multi-en-003`, “How has Dan's technical focus changed over time?”, remained incomplete at rank 12. Its current evaluation definition also contains both the newer evidence alternatives and three older timeline-only groups, making it stricter than its four declared required facts. The evaluation definition should be normalized before using this case as a release gate.

Broad synthesis questions expose a structural limitation of one-shot vector retrieval: general profile, skills, and activity documents can outrank one of several individually required project documents. Planned remediation is query decomposition or iterative retrieval in Phase 5, followed by end-to-end generation evaluation in Phase 8. Further global chunking changes are not justified by the current evidence.

## Selected retrieval configuration

```text
Search type: SEMANTIC
Bedrock candidates requested: 12
Candidate score floor: 0.65
Maximum chunks passed to OpenAI: 12
Metadata filter: none for the public approved corpus
```

Runtime policy:

1. Enforce security, restricted-topic, and out-of-scope policy independently of retrieval score.
2. Retrieve 12 semantic candidates.
3. Remove candidates below 0.65.
4. Pass up to 12 retained chunks to OpenAI, preserving source metadata for citations.
5. Require explicit evidence for factual claims.
6. Decline or qualify the answer when the requested fact is absent.

The 12-result runs contained 12 distinct source IDs per query. Passing all 12 unfiltered results would add approximately 14,800 characters, roughly 3,500–4,000 tokens, on average. Applying the 0.65 floor retained about 9.7 chunks per query on average in the baseline simulation. Generation-quality, latency, and token-cost evaluation may reduce the final pass-through count later.

## Remaining known limitations

- Retrieval scores overlap between answerable and unanswerable questions; no reliable score-only refusal threshold exists.
- `multi-en-003` is over-constrained in the current evaluation bank and still misses one required group at rank 12.
- Broad multi-source questions may require query decomposition or iterative retrieval.
- Vietnamese has only 11 answerable evaluation cases and materially lower complete-group results than English.
- Hybrid retrieval is unavailable for the configured Bedrock index.
- Default and semantic latency were measured once; repeated runs are needed before treating the observed difference as stable.
- Result ordering showed minor run-to-run variation, so release decisions should use repeated evaluations rather than a single borderline rank.
- Passing up to 12 chunks increases irrelevant context relative to the original 3–5 chunk proposal; end-to-end generation evaluation must check distraction, groundedness, citation accuracy, latency, and cost.
- The 0.65 candidate floor and 12-chunk maximum are Phase 5 baseline settings, not immutable production values.

## Raw-result file locations

- `evaluations/results/retrieval/retrieval-bulk-2026-08-10T09-34-11-091Z.json` — 8-result default grouped baseline.
- `evaluations/results/retrieval/retrieval-bulk-2026-08-10T09-58-10-477Z.json` — 12-result default comparison.
- `evaluations/results/retrieval/retrieval-bulk-2026-08-10T09-58-54-549Z.json` — 12-result semantic comparison and selected-run baseline.
- `evaluations/results/retrieval/retrieval-bulk-2026-08-10T09-59-18-515Z.json` — 12-result hybrid attempt; all requests failed because hybrid search is unsupported.

These files are intentionally stored in the ignored `evaluations/results/retrieval/` directory because they include retrieved document content. They are local evaluation artifacts and are not committed.

## Phase 4 conclusion

Phase 4 is complete with documented limitations. The ingestion and retrieval workflows are repeatable, the selected configuration meets the collective top-five target, citation metadata is available, and known multi-source and threshold limitations have explicit Phase 5/8 remediation. Phase 5 may proceed without changing the global chunking configuration.
