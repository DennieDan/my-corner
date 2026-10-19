# Phase 9 release runbook

The website is a Next.js static export hosted in the versioned S3 bucket behind the CloudFront distribution for `https://dandinh.net`. The chat API is a production API Gateway stage invoking the `live` alias of `Dennie-production-chat`. Development and production use the **same development Knowledge Base** and its source bucket. Production has its own agent, API, secret, and monitoring.

Production alarms publish to the `Dennie-production-alerts` SNS topic, subscribed to `dandinh1922@gmail.com`. AWS sends a confirmation message that must be accepted before alert emails arrive. `DENNIE_ALERT_EMAIL` overrides this recipient for another deployment.

## Prerequisites

Use Node 24.14.1 (`nvm use`), npm 11, AWS CLI credentials for account `520070583275` in `ap-southeast-1`, and `npm ci` in the repository root, `agent/`, and `infrastructure/`. The CDK account must already be bootstrapped. Set `S3_BUCKET_NAME=my-corner-static-blogs-520070583275-ap-southeast-1-an` and `CLOUDFRONT_DISTRIBUTION_ID=E38Y5VZ6174ATP` for website releases. The website bucket must have versioning enabled. The release commands write ignored JSON records under `.releases/`; keep these records to roll back a specific release. GitHub Actions uploads the website record as a workflow artifact.

## Independent releases

Run each command from the repository root. `DENNIE_ENVIRONMENT` defaults to `production`; set it to `development` for development infrastructure or knowledge releases. Agent and website release commands target production. The infrastructure command queries the existing development Knowledge Base outputs and injects its ID and ARN into production CDK synthesis.

```sh
npm run release:infra
npm run release:knowledge
npm run release:agent
npm run release:website
```

- **Infrastructure** runs typecheck, lint, tests, CDK synth, template diff, deployment, and records all stack outputs. Review its diff in the terminal. Production CDK creates only Agent and Monitoring stacks; the shared Knowledge Base stays in `Dennie-development-Knowledge`. For a standalone production CDK synth, set `DENNIE_SHARED_KNOWLEDGE_BASE_ID` and `DENNIE_SHARED_KNOWLEDGE_BASE_ARN` from that stack's outputs.
- **Knowledge** validates approved Markdown and metadata, uploads only changed objects, waits for Bedrock ingestion, then requires expected source hits for three release questions. A failed ingestion or retrieval exits nonzero.
- **Agent** checks types, lint, and tests; bundles and publishes an immutable Lambda version; invokes that version directly for health, policy, and grounded live-answer checks; then moves `live` and runs the production API smoke suite. If the API smoke fails, it restores the prior alias version. The first production setup also runs `npm run release:seed-secret`, which copies the existing project API key from the development secret into the separate production secret without printing it. Replace it with a dedicated production key when available.
- **Website** checks types and UI tests, builds `out/` with the production API URL, records S3 object versions, syncs changed files, and publishes extensionless HTML keys so `/dennie` works on S3/CloudFront. It invalidates changed public paths, waits for completion, then tests the live site and API. Old hashed assets remain available for cached pages.

The order above is required for a first release. Later releases can run only the affected command. A clean checkout can reproduce all commands after installing dependencies and configuring AWS credentials. The site URL comes from the production Agent stack output unless `NEXT_PUBLIC_AGENT_API_URL` is explicitly set.

The website GitHub workflow runs on relevant pushes to `main` and on manual dispatch. Its repository variables must include `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, and `NEXT_PUBLIC_AGENT_API_URL` (the full production `/v1/chat` URL). Its OIDC role needs S3 read/write/version permissions and CloudFront invalidation rights; it does not deploy CDK or Lambda.

## Rollback

Find the JSON record for the release under `.releases/` (or download the website workflow artifact):

```sh
npm run release:rollback:agent -- .releases/agent-production-<timestamp>.json
npm run release:rollback:website -- .releases/website-production-<timestamp>.json
```

The agent command moves `live` to the recorded prior immutable version. The website command copies prior S3 object versions back as current versions, removes keys created by that release, and invalidates affected CloudFront paths. Roll back website releases in reverse order if multiple releases have occurred. Knowledge S3 source files are versioned; reupload approved earlier source files and run `release:knowledge` to revert content and reingest. CDK infrastructure rollback uses the previous Git revision and `release:infra` after inspecting its diff.

## Production checks

`npm run release:website` verifies `https://dandinh.net/dennie` after CloudFront invalidation. The agent smoke checks health, CORS, request validation, owner-restricted policy response, live generation, and citation labels. You can view the app at [dandinh.net](https://dandinh.net) and open the chat from the Dennie page.
