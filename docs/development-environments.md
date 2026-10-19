# Dennie development environments

## Runtime baseline

- Node.js and npm versions are defined by the repository `.nvmrc` and root `package.json`.
- AWS region: `ap-southeast-1` unless a later service-availability check requires a documented change.
- Configuration names: `development`, `staging`, and `production`.
- Production CDK stacks have termination protection enabled by default.

Install each package independently:

```bash
npm ci
npm --prefix agent ci
npm --prefix infrastructure ci
```

## Local checks

```bash
npm run build
npm run agent:check
npm run agent:build
npm run infra:check
npm run infra:build
npm run infra:synth -- -c environment=development
```

The root website build remains independent of the agent and infrastructure dependencies. Voiceflow stays in place until the custom chatbot passes the production cutover checks.

## Infrastructure commands

Run CDK commands with AWS credentials for the intended account:

```bash
npm --prefix infrastructure run synth:development
npm --prefix infrastructure run synth:staging
npm --prefix infrastructure run synth:production

npm --prefix infrastructure run deploy:development
npm --prefix infrastructure run deploy:staging
npm --prefix infrastructure run deploy:production
```

Deployment changes AWS resources and may incur charges. Review the synthesized template and CDK confirmation before approving a deployment.

## Knowledge and evaluation commands

After copying variable names from `infrastructure/.env.example` into your local shell or an untracked environment file:

```bash
# make sure already inside infrastructure/
npm run knowledge:validate
npm run knowledge:validate:approved
npm run knowledge:upload # Upload to S3. requires .env.local values (KNOWLEDGE_BUCKET_NAME, KNOWLEDGE_PREFIX,AWS_REGION)
npm run knowledge:sync # Synchronize S3 into Bedrock. requires .env.local values (BEDROCK_KNOWLEDGE_BASE_ID, BEDROCK_DATA_SOURCE_ID, AWS_REGION)
npm run knowledge:ingest # Validate approved sources, upload changes, then synchronize Bedrock
npm run knowledge:retrieve -- --query "What projects has Dan worked on?" --results 8
npm run knowledge:retrieve -- --bulk --results 8
AGENT_API_URL=https://example.test/v1/chat npm run evaluate
```

```bash
# verify retrieval and security
aws bedrock-agent-runtime retrieve \
  --region ap-southeast-1 \
  --knowledge-base-id "$BEDROCK_KNOWLEDGE_BASE_ID" \
  --retrieval-query '{"text":"What projects has Dan worked on?"}'
```

The validation command checks the source registry, document/sidecar pairs, required metadata, and evaluation source coverage. The upload command sends only registered and owner-approved Markdown documents and Bedrock metadata sidecars to the configured private bucket and prefix; it refuses pending drafts. The ingest command runs approved-only validation, upload, and synchronization in order and stops immediately if any step fails. The sync step starts a Bedrock Knowledge Base ingestion job, reports its job ID, final statistics, and failure reasons, and waits up to 15 minutes by default. Set `KNOWLEDGE_INGESTION_TIMEOUT_SECONDS` to a positive number to override that timeout. The retrieval command calls the Bedrock `Retrieve` API directly; bulk mode reads `evaluations/questions.jsonl`. Timestamped retrieval JSON is written under the ignored `evaluations/results/retrieval/` directory. Terminal logs contain question IDs and result counts but not retrieved chunk text. Evaluation responses are written under the ignored `evaluations/results/` directory.

Bulk retrieval resolves each question's source hints through the source registry and records the acceptable canonical source IDs. A flat `sourceHints` list means that any listed hint is acceptable. Multi-source questions use `sourceHintGroups`: every outer group is required, while any hint within one group may satisfy that group. Its `evaluationSummary` contains collective and per-language Hit@1, Hit@3, Hit@5, mean reciprocal rank, all-source-group hit rates, mean source-group coverage, and score distributions. Rates are decimals from 0 to 1. The original Hit@K metrics continue to measure whether any expected source appeared, while `allSourceGroupsHitRateAtK` measures whether every required evidence group appeared. Each successfully retrieved unanswerable question records its strongest returned candidate as `strongestIrrelevantResult`. `evaluationFailures` lists retrieval errors, single-group questions whose expected sources missed the top five, and multi-source questions with missing required groups, together with expected and returned source rankings and scores. Questions whose Bedrock request fails are marked `evaluated: false` and excluded from metric denominators rather than being counted as retrieval misses.

Strongest Irrelevant Score: 0.68

Rank 1 retrieved chunk for an unanswerable question is maximum 0.68. So our threshold 0.69 can do its work already.

| Group      | Questions | Answerable | Unanswerable |
| ---------- | --------: | ---------: | -----------: |
| Collective |        73 |         56 |           17 |
| English    |        57 |         45 |           12 |
| Vietnamese |        16 |         11 |            5 |

### Runtime decision

1. Apply security/restricted/out-of-scope policy.
2. Retrieve 12 semantically.
3. Remove chunks below 0.65.
4. Pass at most 12 chunks to OpenAI.
5. Instruct OpenAI to use only explicit evidence.
6. If the requested fact is absent, state that it is unavailable.

## Environment variable contract

| Variable                              | Consumer             | Purpose                                          | Secret |
| ------------------------------------- | -------------------- | ------------------------------------------------ | ------ |
| `NEXT_PUBLIC_AGENT_API_URL`           | Website              | Public base URL for the deployed agent API       | No     |
| `DENNIE_ENVIRONMENT`                  | Agent/infrastructure | One of `development`, `staging`, or `production` | No     |
| `AWS_REGION`                          | Agent/AWS SDK        | AWS service region                               | No     |
| `CDK_DEFAULT_ACCOUNT`                 | CDK                  | Target AWS account ID                            | No     |
| `CDK_DEFAULT_REGION`                  | CDK                  | Target AWS region                                | No     |
| `BEDROCK_KNOWLEDGE_BASE_ID`           | Agent/sync           | Knowledge Base identifier                        | No     |
| `BEDROCK_DATA_SOURCE_ID`              | Sync                 | Knowledge Base data source identifier            | No     |
| `KNOWLEDGE_BUCKET_NAME`               | Upload               | Private source bucket name                       | No     |
| `KNOWLEDGE_PREFIX`                    | Upload               | Object-key prefix, default `documents`           | No     |
| `KNOWLEDGE_INGESTION_TIMEOUT_SECONDS` | Sync                 | Maximum ingestion wait, default `900`            | No     |
| `OPENAI_API_KEY_SECRET_ARN`           | Agent                | Secrets Manager ARN containing the OpenAI key    | No     |
| `OPENAI_MODEL`                        | Agent                | OpenAI model name, default `gpt-5.6-luna`        | No     |
| `ALLOWED_ORIGIN`                      | Agent                | Exact browser origin allowed by CORS             | No     |
| `LOG_LEVEL`                           | Agent                | `debug`, `info`, `warn`, or `error`              | No     |
| `AGENT_API_URL`                       | Evaluations          | Full chat endpoint used by the runner            | No     |

The OpenAI API key itself is never an environment variable in the deployed agent or a committed file. It will be stored in AWS Secrets Manager; local credentials belong only in ignored local configuration.
