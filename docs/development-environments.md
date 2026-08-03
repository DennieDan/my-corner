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
npm run knowledge:upload
npm run knowledge:sync
AGENT_API_URL=https://example.test/v1/chat npm run evaluate
```

The upload command sends Markdown and Bedrock metadata sidecars under `knowledge/` to the configured private bucket and prefix. The sync command starts a Bedrock Knowledge Base ingestion job and waits for completion. Evaluation responses are written under the ignored `evaluations/results/` directory.

## Environment variable contract

| Variable | Consumer | Purpose | Secret |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_AGENT_API_URL` | Website | Public base URL for the deployed agent API | No |
| `DENNIE_ENVIRONMENT` | Agent/infrastructure | One of `development`, `staging`, or `production` | No |
| `AWS_REGION` | Agent/AWS SDK | AWS service region | No |
| `CDK_DEFAULT_ACCOUNT` | CDK | Target AWS account ID | No |
| `CDK_DEFAULT_REGION` | CDK | Target AWS region | No |
| `BEDROCK_KNOWLEDGE_BASE_ID` | Agent/sync | Knowledge Base identifier | No |
| `BEDROCK_DATA_SOURCE_ID` | Sync | Knowledge Base data source identifier | No |
| `KNOWLEDGE_BUCKET_NAME` | Upload | Private source bucket name | No |
| `KNOWLEDGE_PREFIX` | Upload | Object-key prefix, default `documents` | No |
| `OPENAI_API_KEY_SECRET_ARN` | Agent | Secrets Manager ARN containing the OpenAI key | No |
| `OPENAI_MODEL` | Agent | OpenAI model name, default `gpt-5.6-luna` | No |
| `ALLOWED_ORIGIN` | Agent | Exact browser origin allowed by CORS | No |
| `LOG_LEVEL` | Agent | `debug`, `info`, `warn`, or `error` | No |
| `AGENT_API_URL` | Evaluations | Full chat endpoint used by the runner | No |

The OpenAI API key itself is never an environment variable in the deployed agent or a committed file. It will be stored in AWS Secrets Manager; local credentials belong only in ignored local configuration.
