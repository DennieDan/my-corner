# Phase 6 development agent deployment

The development deployment adds a Node.js 24 ARM64 Lambda, a Regional REST API that uses `AWS_PROXY` response streaming, a generated placeholder in Secrets Manager, 30-day Lambda and API access logs, conservative throttling, a CloudWatch dashboard, six alarms, and an SNS alert topic. Lambda can read only its OpenAI secret and retrieve only from the existing Dennie Knowledge Base. It does not run in a VPC.

## Current development deployment

- Chat: `https://13qkqk965i.execute-api.ap-southeast-1.amazonaws.com/development/v1/chat`
- Health: `https://13qkqk965i.execute-api.ap-southeast-1.amazonaws.com/development/health`
- Secret to update: `arn:aws:secretsmanager:ap-southeast-1:520070583275:secret:OpenAIKeyDF28CBE2-FinN2z2XbEeJ-vMJyrl`
- SNS topic to subscribe: `arn:aws:sns:ap-southeast-1:520070583275:Dennie-development-alerts`
- CloudWatch dashboard: `Dennie-development-agent`

The deployed basic smoke checks pass. A retrieval-backed request returned ten labeled sources and a safe `UPSTREAM_UNAVAILABLE` SSE event with the placeholder key. That failure emitted the `ProviderFailures` metric and moved its alarm to `ALARM`. Successful answer generation remains to be verified after the key is installed.

## Prepare and deploy

From the repository root:

```bash
npm --prefix agent ci
npm --prefix infrastructure ci
npm run agent:check
npm run infra:check
npm --prefix infrastructure run synth:development
cd infrastructure
npx cdk diff -c environment=development
npx cdk deploy -c environment=development --all
```

Use AWS credentials for the intended account and region (`ap-southeast-1`). The Agent stack references the existing Knowledge stack, so the deployment can add a CloudFormation export to that stack. Record the `AgentApiChatUrl`, `AgentApiHealthUrl`, `OpenAIKeySecretArn`, and `AlertTopicArn` outputs.

The generated secret is a **placeholder**, not a working OpenAI key. In the AWS Secrets Manager console, replace its value with a project-scoped OpenAI API key, either as the raw key or `{"apiKey":"..."}`. Keep the key out of shell history, `.env` files, source control, and support messages. The Lambda reads the secret at runtime, caches it per warm invocation environment, and refreshes it after an OpenAI authentication failure.

## Smoke checks

The basic smoke test checks health, allowed and disallowed browser preflight, request validation, and an SSE policy refusal without contacting Bedrock or OpenAI:

```bash
AGENT_API_URL="<AgentApiChatUrl output>" npm --prefix infrastructure run agent:smoke
```

After replacing the secret, run a live evidence-backed request:

```bash
AGENT_API_URL="<AgentApiChatUrl output>" SMOKE_LIVE=1 npm --prefix infrastructure run agent:smoke
```

The live response should begin with `sources`, include citation-checked `delta` events, and end with `done`. A safe provider failure is returned as an SSE `error` event. Because the HTTP stream may already have started, a provider failure can have HTTP status 200; the `ProviderFailures` CloudWatch log metric alarm counts these outcomes separately from Lambda and API 5xx errors.

## Alerts and spend controls

Subscribe an operator email or another endpoint to the `AlertTopicArn` in the SNS console, then confirm the subscription. Until that is done, the alarms have no human recipient. The topic carries Lambda errors/throttles, API 5xx, provider failures, latency, and high-volume alarms.

The account already has an account-wide **$0.20 monthly AWS Budget** with 85%, 100%, and forecast alerts. Phase 6 leaves it untouched and does not create a second budget by default. If a separate budget is wanted, pass `-c awsBudgetUsd=<positive amount>` to CDK synth/deploy; this creates an additional account-wide budget and routes its 80% and 100% alerts to the same SNS topic. AWS Budgets alerts do not stop spending.

The CDK-managed chatbot resources carry `Workload=my-corner-chatbot`, including the Knowledge Base, API stage, Lambda, secret, and monitoring resources. The Knowledge Base keeps its resource-specific `Name=my-corner-knowledge-base`; the agent and monitoring resources use `Name=my-corner-chatbot`. For a manually created chatbot cost budget, activate `Workload` under Billing → Cost allocation tags, then choose the **Tag** budget filter `user:Workload` with value `my-corner-chatbot`. Allow billing data to catch up after activation, and check Cost Explorer for any service charges that remain untagged.

In the OpenAI API project used by this agent, configure a monthly spend alert and an enforced project hard spend limit under Project settings → Limits → Spend. The project limit and AWS budget are separate controls. The API stage throttle of two requests per second with burst five limits how fast this development endpoint can consume provider capacity; it is not a monthly cost cap.

## Operational settings

- Allowed browser origins in development: `https://dandinh.net` and `http://localhost:3000`. Production permits only `https://dandinh.net`.
- Request body limit in the handler: 25,000 characters, with stricter message and history limits in the Zod schema.
- Lambda memory: 1,024 MB. Lambda timeout: 30 seconds. The agent uses shorter retrieval and generation deadlines.
- The account currently has a Lambda concurrency quota of ten. Reserving two executions failed because AWS requires ten unreserved executions to remain, so the function uses the shared account quota. A reserved cap can be added after a quota increase.
- Log retention: 30 days. Routine metrics include request ID, duration, outcome, source IDs and token usage, without full prompts, retrieved chunks or answers.
- The API remains a separate endpoint for Phase 7. The existing site and Voiceflow deployment are unchanged at this stage.
