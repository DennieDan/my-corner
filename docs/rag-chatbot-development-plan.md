# Dennie RAG Chatbot Development Plan

## 1. Goal

Replace the Voiceflow widget with a custom chatbot that answers questions about Dan using a controlled set of source documents, provides citations, and declines questions that are unsupported or outside its intended scope.

The existing Next.js site remains a static export hosted on Amazon S3. The chatbot interface stays in this repository, while the agent runs as a separately deployed AWS backend.

## 2. Agreed architecture

```text
Visitor browser
  |
  +-- Static website and chat interface
  |     S3 + CloudFront
  |
  +-- POST /api/chat
        API Gateway REST API (streaming)
          |
          Lambda agent (TypeScript)
            |
            +-- Bedrock Knowledge Base Retrieve API
            |     |
            |     +-- S3 source documents
            |     +-- Cohere Embed Multilingual v3
            |     +-- S3 Vectors
            |
            +-- OpenAI Responses API
                  gpt-5.6-luna
```

### Responsibilities

| Component                    | Responsibility                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Next.js chat interface       | Conversation UI, browser-side history, streaming display, citations, errors, and reset controls          |
| API Gateway                  | Public HTTPS endpoint, request throttling, CORS, and streaming transport                                 |
| Lambda agent                 | Validation, retrieval, prompt construction, OpenAI invocation, citation mapping, and safe error handling |
| Bedrock Knowledge Base       | Managed document ingestion, chunking, embeddings, synchronization, and retrieval                         |
| Cohere Embed Multilingual v3 | Multilingual document and query embeddings in the Singapore region                                       |
| S3 Vectors                   | Vector index used by the Knowledge Base                                                                  |
| OpenAI                       | Generates the final answer from retrieved evidence                                                       |
| Secrets Manager              | Stores the OpenAI API key                                                                                |
| CloudWatch                   | Backend logs, metrics, dashboards, and alarms                                                            |

## 3. Version-one boundaries

Version one will:

- Answer questions about Dan's public background, work, skills, education, and projects.
- Use only approved source documents.
- Provide citations that map back to retrieved sources.
- Say that it does not know when the evidence is missing.
- Stream answers to the browser.
- Keep short conversation history in the visitor's browser.
- Avoid storing complete chat transcripts on the server.
- Support clearing local conversation history.
- Remain usable on mobile and with keyboard navigation.

Version one will not:

- Behave as a general-purpose assistant.
- Browse the web.
- Take autonomous external actions.
- Submit contact forms or send email from the agent.
- Maintain long-term user memory.
- Require user accounts.
- Fine-tune a model.
- Use an additional reranker unless retrieval evaluation shows that one is needed.

Keeping action-taking tools out of version one reduces security, privacy, and abuse risks. A conventional contact link or form can remain separate from the chatbot.

## 4. Proposed repository layout

The existing website does not need to be reorganized into a new monorepo structure. Add isolated backend and infrastructure packages instead.

```text
my-corner/
  app/
  components/
    chat/
      chat-widget.tsx
      chat-panel.tsx
      chat-message.tsx
      chat-input.tsx
      source-list.tsx
      chat-error.tsx

  agent/
    package.json
    tsconfig.json
    src/
      handler.ts
      request-schema.ts
      retrieve.ts
      answer.ts
      prompt.ts
      citations.ts
      stream.ts
      errors.ts
      telemetry.ts
    test/

  knowledge/
    profile.md
    experience.md
    education.md
    skills.md
    projects/
    faq.md
    metadata/

  evaluations/
    questions.jsonl
    expected-sources.json
    run-evaluation.ts

  infrastructure/
    package.json
    bin/
    lib/
      knowledge-stack.ts
      agent-stack.ts
      monitoring-stack.ts

  docs/
    rag-chatbot-development-plan.md
    operations-runbook.md
```

Use separate package manifests for `agent/` and `infrastructure/` so backend dependencies do not inflate or interfere with the static website build.

## 5. API contract

Define the contract before building the interface or backend so both sides can be developed and tested independently.

### Request

```http
POST /v1/chat
Content-Type: application/json
```

```json
{
  "message": "What AWS projects has Dan worked on?",
  "history": [
    { "role": "user", "content": "What is Dan's background?" },
    { "role": "assistant", "content": "..." }
  ],
  "sessionId": "browser-generated-random-id"
}
```

Rules:

- `message` is required and length-limited.
- `history` is optional, contains only user and assistant messages, and is capped by message count and total characters.
- `sessionId` is an opaque identifier for diagnostics and rate analysis, not authentication.
- The backend never trusts client-supplied assistant messages as factual evidence.

### Streaming response

Use Server-Sent Events over the streamed HTTP response.

```text
event: sources
data: {"sources":[{"id":"S1","title":"AWS Infrastructure","url":"..."}]}

event: delta
data: {"text":"Dan has worked..."}

event: done
data: {"requestId":"...","usage":{...}}
```

Errors use a stable public error code without exposing provider responses or secrets:

```text
event: error
data: {"code":"UPSTREAM_UNAVAILABLE","message":"Dennie is temporarily unavailable."}
```

## 6. Development phases

### Phase 0 - Confirm product, privacy, and evaluation requirements (complete)

Approved requirements are recorded in `docs/phase-0-product-requirements.md`; the Phase 0 baseline contains 67 questions in `evaluations/questions.jsonl`. Six owner-approved Phase 2 coverage cases bring the current bank to 73 questions.

#### Work

1. Confirm that all knowledge supplied to the chatbot is safe to make public.
2. Define the exact supported topic categories.
3. Define refusal behavior for unsupported, sensitive, and high-stakes questions.
4. Confirm the supported input and response languages. The agreed embedding model is Cohere Embed Multilingual v3.
5. Confirm that the OpenAI credits are Platform API credits.
6. Create an initial evaluation set of 40-60 questions covering:

- Simple factual questions.
- Questions requiring two sources.
- Paraphrased questions.
- Questions with false assumptions.
- Questions whose answers are absent.
- Out-of-scope requests.
- Prompt-injection attempts.
- Casual conversational questions.

1. Record the expected source documents and essential facts for every factual evaluation question.

#### Deliverables

- Approved version-one scope.
- Privacy and retention decisions.
- Initial evaluation dataset under `evaluations/`.
- Written refusal and tone requirements.

#### Exit criteria

- Every intended capability has at least one evaluation question.
- Every factual evaluation answer has an approved source or is explicitly marked as unanswerable.
- No private or confidential information is included in the planned corpus.

---

### Phase 1 - Prepare the repository and development environments

#### Work

1. Add the `agent/`, `knowledge/`, `evaluations/`, and `infrastructure/` directories.
2. Configure the Lambda agent as a separate TypeScript package.
3. Configure AWS CDK in TypeScript for infrastructure-as-code.
4. Add scripts for:

- Agent type checking and tests.
- Infrastructure synthesis and deployment.
- Knowledge upload and ingestion synchronization.
- Evaluation execution.

1. Add `.env.example` files containing names only, never credentials.
2. Define development, staging, and production configuration names.
3. **Add linting and test commands for the new packages without changing the current website build behavior.**
4. **L**eave existing Voiceflow code intact during development so it remains available for comparison or rollback.

#### Deliverables

- Buildable agent package.
- Synthesizable infrastructure package.
- Documented local commands.
- Environment variable contract.

#### Exit criteria

- Website, agent, and infrastructure packages build independently.
- No secret is committed to Git.
- The existing static website still builds successfully.

---

### Phase 2 - Build the knowledge corpus (complete)

Completed on 3 August 2026. Fourteen focused corpus documents and matching Bedrock metadata sidecars were reviewed and approved by Dan. Structural validation confirms coverage for every source hint in the 73-question evaluation bank, every source has provenance and a canonical citation destination, and the approved-only ingestion gate passes. Owner decisions are recorded in `docs/phase-2-owner-review.md`.

#### Work

1. Convert approved information into focused Markdown documents.
2. Split information by stable topic rather than placing everything in one large file.
3. Give every document:

- A descriptive title.
- A canonical public URL when available.
- A topic/category.
- A last-updated date.
- Visibility and sensitivity classification.

1. Write information in self-contained sections so a retrieved chunk remains understandable without the rest of the file.
2. Avoid duplicated facts across many documents where possible.
3. Add Bedrock-compatible metadata sidecar files for filtering and citation display.
4. Assign stable source identifiers that do not change when a document is re-uploaded.
5. Add a review checklist for factual accuracy and staleness.

Suggested starting documents:

- Personal overview.
- Work experience.
- Education and certifications.
- Technical skills.
- One document per major project.
- Frequently asked questions.
- Contact and collaboration preferences.

#### Deliverables

- Reviewed Markdown corpus under `knowledge/`.
- Metadata for every source.
- Mapping from source identifier to public citation URL.

#### Exit criteria

- Every answerable evaluation question is covered by at least one source.
- Every source has an owner, last-updated date, and citation destination.
- Content reviewers can read each chunk-sized section in isolation and understand it.

---

### Phase 3 - Provision the AWS retrieval infrastructure

#### Work

1. Select `ap-southeast-1` as the primary region unless service verification at implementation time requires another region.
2. Create a private S3 bucket or isolated prefix for Knowledge Base source documents.
3. Enable encryption, block public access, and add lifecycle/versioning rules appropriate for source recovery.
4. Create an S3 vector bucket and vector index.
5. Configure the vector index for the dimensions and data type required by Cohere Embed Multilingual v3.
6. Create a Bedrock Knowledge Base using:

- S3 as the data source.
- Cohere Embed Multilingual v3 as the embedding model.
- S3 Vectors as the vector store.

1. Create least-privilege IAM roles for ingestion and retrieval.
2. Configure inclusion prefixes so the Knowledge Base cannot ingest unrelated S3 content.
3. Add tags for project, environment, owner, and cost allocation.
4. Express resources in CDK where supported. If a newly released AWS resource is not yet supported cleanly by CDK/CloudFormation, use a small, idempotent provisioning script or custom resource and document why.

#### Deliverables

- Development Knowledge Base.
- Private source bucket/prefix.
- S3 vector index.
- IAM roles and policies.
- Reproducible infrastructure deployment.

#### Exit criteria

- No knowledge or vector bucket is publicly accessible.
- The Knowledge Base can ingest a sample document successfully.
- An authorized test identity can call `Retrieve`.
- An unauthorized identity cannot read documents, vectors, or Knowledge Base results.

#### Completion record

- Deployment: 2026-08-03 in AWS account `520070583275`, region `ap-southeast-1`. The stack was created at `2026-08-03T07:34:37Z`, last updated at `2026-08-03T09:24:52Z`, and was `UPDATE_COMPLETE` when verified.
- Stack: `Dennie-development-Knowledge`.
- Bedrock Knowledge Base: `0DHVJWVXZG`.
- Bedrock data source: `ENAGNFLKA3`.
- Successful ingestion: job `KPEBF5MNVL` completed with 14 documents and 14 metadata documents scanned, one modified document indexed, zero failed documents, and no failure reasons. This incremental job completed the corpus after the preceding ingestion had indexed the other 13 documents.
- Retrieval smoke test: an authorized `Retrieve` request for `What projects has Dan worked on?` succeeded and returned 10 results. The results included `activities-and-reflections.md`, `projects/data-analyzer.md`, and `projects/dennie-my-corner.md`. Retrieval ranking and top-five relevance remain Phase 4 evaluation work.
- Negative authorization test: an unsigned `Retrieve` request was denied with `MissingAuthenticationTokenException`, confirming that unauthenticated callers cannot retrieve Knowledge Base results. No temporary authenticated-but-unauthorized IAM principal was created for this test.
- Configuration deviations and implementation notes:
  - The primary region, embedding model, 1,024-dimension `float32` vectors, S3 data source, and S3 Vectors store match the plan.
  - Resources use `Project=Learning`, `Name=my-corner-knowledge-base`, and the inherited `Environment=development` tag. Separate owner and cost-allocation tags from the original plan were not added.
  - Metadata sidecars are limited to 1,024 bytes for S3 Vectors. `includeForEmbedding` was removed because the same metadata already appears in each Markdown header and prepending it caused one Cohere input to exceed the model's 2,048-character request limit.
  - All retrieval infrastructure was expressed with CDK/CloudFormation; no custom resource or separate provisioning script was required.

---

### Phase 4 - Implement ingestion and validate retrieval

#### Work

1. Build a repeatable command that:

- Validates document and metadata files.
- Uploads changed documents to the correct S3 prefix.
- Starts a Knowledge Base ingestion job.
- Waits for completion and reports failures.

1. Run the first complete ingestion.
2. Build a retrieval-only test harness that calls the Bedrock `Retrieve` API.
3. Evaluate different retrieval settings, including result count and search type where supported.
4. Inspect chunks for boundaries, duplication, missing context, and metadata quality.
5. Tune document structure and chunking before tuning the generation prompt.
6. Establish a relevance threshold using evaluation results rather than choosing an arbitrary score.
7. Decide how many retrieved candidates to request and how many to pass to OpenAI. A reasonable initial experiment is retrieve 8 and pass the best 3-5.

#### Deliverables

- Repeatable ingestion command.
- Retrieval-only test harness.
- Baseline retrieval evaluation report.
- Selected retrieval configuration.

#### Exit criteria

- Expected evidence appears in the top five results for at least 90% of answerable evaluation questions, or misses have documented remediation work.
- Unanswerable questions generally return no strong evidence above the selected threshold.
- Retrieved results include enough metadata to build valid citations.

#### Completion Records

**Status:** Complete with documented limitations on 10 August 2026.

- Baseline report: [`docs/phase-4-baseline-retrieval-report.md`](./phase-4-baseline-retrieval-report.md).
- Final ingestion job: `FATRZMBDO5` (`COMPLETE`), with 14 documents and 14 metadata documents scanned, 3 modified documents indexed, and 0 failed documents.
- Evaluation bank: 73 questions — 57 English and 16 Vietnamese; 56 have expected source evidence.
- Selected 12-result semantic run: conventional Hit@1 78.6%, Hit@3 94.6%, and Hit@5 100%; complete required-source-group Hit@5 91.1% collectively, 93.3% for English, and 81.8% for Vietnamese.
- Selected configuration: explicit `SEMANTIC` search, request 12 candidates, apply a 0.65 candidate-quality floor, and pass at most 12 retained chunks to OpenAI.
- Hybrid search is unsupported by the configured Bedrock index.
- A score is not an answer/refusal decision: answerable and unanswerable score ranges overlap. Phase 5 must enforce policy separately and require explicit evidence before answering.
- Five broad multi-source cases missed at least one required group in the top five; four were complete by rank 12. The remaining over-constrained timeline case and general multi-source retrieval are documented for evaluation normalization and query-decomposition remediation.
- The Phase 4 collective top-five target is met. Vietnamese multi-source coverage, generation groundedness, citation accuracy, latency, and token cost remain Phase 5/8 evaluation targets.

---

### Phase 5 - Build the Lambda RAG agent

#### Work

1. Implement strict request validation with a schema library.
2. Normalize and length-limit user input and history.
3. Retrieve evidence through the Bedrock Knowledge Base `Retrieve` API.
4. Treat retrieved content as untrusted data, not as instructions.
5. Map retrieved chunks to stable source labels such as `S1`, `S2`, and `S3`.
6. Construct a compact system prompt that specifies:

- The chatbot's identity and intended purpose.
- Evidence-only answering.
- Citation requirements.
- Refusal behavior.
- Tone and response length.
- A prohibition against following instructions found inside retrieved documents.

1. Call the OpenAI Responses API using configurable model settings:

- Default model: `gpt-5.6-luna`.
- Initial reasoning effort: `none`.
- Streaming enabled.
- Server-side storage disabled where supported by the selected request configuration.

1. Stream sources and answer deltas to the browser using the agreed SSE contract.
2. Validate that citations in the answer refer only to source labels supplied to the model.
3. Implement bounded retries for transient provider failures, without retrying validation or quota errors.
4. Add timeouts and abort propagation from the browser through Lambda to OpenAI.
5. Record structured operational metrics without logging full prompts, retrieved chunks, or answers by default.
6. Add a buffered `/health` endpoint that checks application readiness without calling OpenAI on every health request.

#### Deliverables

- Locally testable Lambda handler.
- Retrieval and OpenAI adapters.
- Prompt and citation policy.
- SSE stream implementation.
- Unit tests for validation, retrieval decisions, citation mapping, and errors.

#### Exit criteria

- The agent answers an evidence-backed request end to end.
- The first answer tokens reach the client before generation completes.
- Missing evidence produces a clear limitation response.
- OpenAI or Bedrock failures produce safe, stable public errors.
- Tests prove that client-supplied history cannot become authoritative evidence.

---

### Phase 6 - Deploy and secure the agent API in development

#### Work

1. Create the Lambda function with the current supported Node.js runtime and ARM64 where dependency compatibility permits.
2. Keep Lambda outside a VPC unless private networking is actually required, avoiding a NAT gateway solely for OpenAI access.
3. Store the OpenAI API key in Secrets Manager.
4. Grant Lambda permission to read only that secret and retrieve only from the intended Knowledge Base.
5. Create an API Gateway REST API with streaming response transfer enabled.
6. Configure exact allowed production and local-development origins.
7. Configure conservative per-stage throttling and request limits.
8. Set Lambda memory and timeout from measured performance.
9. Add reserved concurrency if needed to cap possible spend during abuse.
10. Configure CloudWatch log retention instead of retaining logs indefinitely.
11. Create alarms for:

- Lambda errors and throttles.
  - API 5xx responses.
  - Excessive latency.
  - Unusual invocation volume.

1. Add an AWS Budget and OpenAI project-level usage alerts/hard limits.

#### Deliverables

- Development API URL.
- Secrets and least-privilege IAM configuration.
- Throttling and concurrency controls.
- Basic dashboard and alarms.

#### Exit criteria

- The development API streams from an allowed origin.
- Disallowed origins do not receive browser access.
- No OpenAI credential appears in the frontend bundle, API response, or logs.
- A forced provider failure triggers the expected alarm and safe response.

---

### Phase 7 - Build the custom chatbot interface

#### Work

1. Build a first-party floating chat launcher matching the site's visual language.
2. Build the chat panel with:

- Header and chatbot identity.
- Introductory message and suggested questions.
- User and assistant message bubbles.
- Streaming cursor/loading state.
- Source citation list.
- Retry and error states.
- Clear-history control.
- Link to the Dennie information page.

1. Implement an SSE client that handles `sources`, `delta`, `done`, and `error` events.
2. Abort the active request if the user cancels, clears the conversation, or navigates away.
3. Store only a bounded recent conversation in `localStorage`.
4. Generate a random browser session identifier without collecting a real identity.
5. Cap history before sending it to the backend.
6. Render assistant content safely. Do not render arbitrary model-generated HTML.
7. Make citation links explicit and open external sources safely.
8. Add accessibility behavior:

- Keyboard-operable launcher and controls.
  - Focus management when opening and closing.
  - Screen-reader labels.
  - Live-region treatment that does not announce every streamed token individually.
  - Reduced-motion support.

1. Test desktop, tablet, and small mobile viewports.
2. Add a build-time API base URL such as `NEXT_PUBLIC_AGENT_API_URL`.

#### Deliverables

- Custom chat widget components.
- Streaming API client.
- Browser history and reset behavior.
- Responsive and accessible styling.

#### Exit criteria

- A visitor can complete, interrupt, retry, and clear a conversation.
- The widget remains usable on a narrow mobile viewport.
- Keyboard-only and screen-reader smoke tests pass.
- No secret or privileged AWS identifier is included in the static bundle.

---

### Phase 8 - Integrate, test, and evaluate the complete system

#### Automated testing

1. Agent unit tests:

- Request validation.
- History limits.
- Retrieval threshold behavior.
- Prompt construction.
- Citation validation.
- Provider timeout and error mapping.

1. Interface tests:

- Open/close behavior.
- Stream parsing.
- Partial-answer display.
- Clear-history behavior.
- Error and retry states.

1. Contract tests between the UI SSE parser and agent stream format.
2. Infrastructure assertions for encryption, public-access blocks, log retention, and least-privilege boundaries.
3. End-to-end tests against the development API.

#### RAG evaluation

Run the complete evaluation set and measure:

- Retrieval hit rate at K.
- Correctness of essential facts.
- Groundedness in retrieved evidence.
- Citation validity.
- Appropriate refusal on missing evidence.
- Resistance to prompt injection.
- Response latency and time to first token.
- Input/output tokens and estimated cost per answer.

Compare at least these configurations on the same questions:

- `gpt-5.6-luna` with reasoning `none`.
- `gpt-5.6-luna` with reasoning `low`.
- A stronger OpenAI model only if the Luna baseline has material quality gaps.

Do not select the stronger model merely because it is newer; require a measured improvement on the site's evaluation set.

#### Initial quality gates

- 100% of displayed citations reference a supplied source.
- At least 90% retrieval hit rate at five on answerable factual questions.
- At least 90% appropriate refusal on deliberately unanswerable questions.
- No critical prompt-injection test causes the assistant to reveal secrets, invent private information, or abandon its scope.
- No full chat content appears in normal operational logs.

These targets can be tightened after the first baseline; failures must be reviewed rather than hidden by changing the test set.

#### Deliverables

- Automated test suite.
- Evaluation report with failure analysis.
- Selected generation and retrieval configuration.
- Known-limitations list.

#### Exit criteria

- All critical test and evaluation gates pass.
- Remaining failures are low risk and documented.
- Cost per representative conversation is understood.

---

### Phase 9 - Build deployment automation

#### Work

Create independent deployment workflows so a content or agent change does not require an unnecessary website migration.

#### Infrastructure workflow

1. Validate and synthesize CDK.
2. Show an infrastructure diff.
3. Deploy approved changes.
4. Record stack outputs such as API URL and Knowledge Base ID.

#### Knowledge workflow

1. Validate Markdown and metadata.
2. Upload changed knowledge files.
3. Start and monitor the ingestion job.
4. Run retrieval smoke tests after synchronization.
5. Stop the release if expected sources cannot be retrieved.

#### Agent workflow

1. Type-check, lint, and test.
2. Build the Lambda artifact.
3. Deploy a versioned Lambda release.
4. Run API smoke tests.
5. Shift the production alias only after tests pass.

#### Website workflow

1. Type-check and build the static export.
2. Run UI tests.
3. Upload `out/` to the website bucket.
4. Invalidate only necessary CloudFront paths.
5. Run production smoke tests.

Deployment order for the first release:

```text
Infrastructure
  -> Knowledge ingestion
  -> Agent API
  -> Chat interface
  -> Production smoke test
```

#### Deliverables

- Reproducible deployment commands or CI workflows.
- Development and production configurations.
- Versioned Lambda deployment and rollback procedure.
- Post-deployment smoke tests.

#### Exit criteria

- A clean checkout can reproduce the deployment using documented prerequisites.
- Failed ingestion or agent smoke tests stop the release.
- The previous Lambda version and previous static site build can be restored.

---

### Phase 10 - Production cutover and Voiceflow retirement

#### Work

1. Deploy the custom widget behind a build-time feature flag if a gradual cutover is desired.
2. Run production smoke tests from the real domain.
3. Test rate limits, mobile behavior, citations, reset, and provider failures.
4. Update the Dennie information page to accurately describe:

- AWS and OpenAI processing.
- What is stored and for how long.
- Browser-side conversation history.
- How visitors can clear local history.
- Whether content is used for model training, based on the actual API configuration and applicable provider terms.

1. Remove Voiceflow imports, scripts, environment variables, API routes, Lambda code, types, and form extension only after the custom system is stable.
2. Verify that no Voiceflow configuration remains in deployed assets or documentation.
3. Keep the final pre-cutover build or Git revision as a rollback point.

#### Deliverables

- Live custom chatbot.
- Updated transparency/privacy content.
- Removed obsolete Voiceflow implementation.
- Verified rollback reference.

#### Exit criteria

- The production chatbot passes the full smoke-test checklist.
- Monitoring shows normal error and latency levels during the observation period.
- The published data-handling description matches the deployed behavior.
- Voiceflow is no longer loaded or called by the website.

---

### Phase 11 - Operate and improve

#### Routine operations

- Review CloudWatch errors, throttles, latency, and request volume.
- Review OpenAI and AWS spend against budgets.
- Re-run evaluations after model, prompt, retrieval, or corpus changes.
- Review every knowledge document's freshness date periodically.
- Re-ingest only after validation succeeds.
- Rotate the OpenAI secret according to the operations policy.
- Test the rollback procedure periodically.

#### Feedback loop

Add a privacy-conscious thumbs-up/down mechanism only after launch. Store:

- Request identifier.
- Rating.
- Optional user-supplied comment.
- Source identifiers and model/configuration version.

Do not automatically store the complete conversation merely to support feedback.

#### Possible later improvements

- Add a reranker if retrieval evaluation demonstrates a need.
- Add hybrid or metadata-filtered retrieval.
- Route only difficult questions to a stronger OpenAI model.
- Add server-side short-term memory with DynamoDB TTL if browser history becomes insufficient.
- Add a separate, deliberately secured contact-form API.
- Replace managed embeddings with a self-hosted model if custom ingestion becomes an explicit project goal.
- Proxy the API behind the existing CloudFront distribution at `/api/*` to use one public origin.

## 7. Configuration inventory

The final names can change, but configuration should be explicit and environment-specific.

### Frontend build variables

```text
NEXT_PUBLIC_AGENT_API_URL
NEXT_PUBLIC_CHATBOT_ENABLED
```

### Agent variables

```text
AWS_REGION
BEDROCK_KNOWLEDGE_BASE_ID
OPENAI_SECRET_ARN
OPENAI_MODEL
OPENAI_REASONING_EFFORT
ALLOWED_ORIGINS
MAX_MESSAGE_CHARACTERS
MAX_HISTORY_MESSAGES
RETRIEVAL_RESULT_COUNT
RETRIEVAL_CONTEXT_COUNT
LOG_LEVEL
```

Avoid placing the OpenAI API key directly in source control, frontend variables, or plaintext deployment configuration.

## 8. Definition of done

The migration is complete when:

1. The static site continues to deploy successfully to S3/CloudFront.
2. The custom chat interface is responsive, accessible, and streams answers.
3. The Lambda agent retrieves only from the approved Knowledge Base.
4. OpenAI answers are grounded in retrieved evidence and include valid citations.
5. Unsupported questions produce an honest limitation response.
6. Secrets are server-side and IAM permissions are least privilege.
7. Abuse controls, budgets, dashboards, and alarms are active.
8. The agreed evaluation thresholds pass.
9. Privacy and transparency documentation matches actual behavior.
10. Voiceflow code and deployed configuration are removed after the stable cutover.
11. Deployment and rollback procedures are documented and tested.

## 9. Recommended implementation order

The immediate working sequence is:

1. Scaffold the agent and infrastructure packages.
2. Normalize and approve the source corpus.
3. Provision a development Knowledge Base and ingest a small sample.
4. Prove retrieval quality before integrating OpenAI.
5. Build and deploy the streaming agent endpoint.
6. Build the chat interface against the stable API contract.
7. Run complete evaluations and security tests.
8. Automate deployment.
9. Cut over production and then remove Voiceflow.

The most important early checkpoint is Phase 4. If retrieval is poor, pause generation and interface work long enough to fix the documents, metadata, and retrieval configuration. A stronger generation model should not be used to conceal weak retrieval.
