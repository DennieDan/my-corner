#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";

import { AgentStack } from "../lib/agent-stack.js";
import { getEnvironmentConfig } from "../lib/config.js";
import { KnowledgeStack } from "../lib/knowledge-stack.js";
import { MonitoringStack } from "../lib/monitoring-stack.js";

const app = new App();
const baseConfig = getEnvironmentConfig(app.node.tryGetContext("environment"));
const budgetContext = app.node.tryGetContext("awsBudgetUsd");
const budgetAmount = budgetContext === undefined ? null : Number(budgetContext);
if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount <= 0)) {
  throw new Error("awsBudgetUsd context must be a positive number");
}
const config = { ...baseConfig, awsBudgetUsd: budgetAmount };
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
};
const commonProps = { env, terminationProtection: config.terminationProtection };

const knowledge = config.name === "production"
  ? null
  : new KnowledgeStack(app, `${config.stackPrefix}-Knowledge`, commonProps);
const sharedKnowledgeBaseId = process.env.DENNIE_SHARED_KNOWLEDGE_BASE_ID;
const sharedKnowledgeBaseArn = process.env.DENNIE_SHARED_KNOWLEDGE_BASE_ARN;
if (config.name === "production" && (!sharedKnowledgeBaseId || !sharedKnowledgeBaseArn)) {
  throw new Error("Production requires DENNIE_SHARED_KNOWLEDGE_BASE_ID and DENNIE_SHARED_KNOWLEDGE_BASE_ARN");
}
const agent = new AgentStack(app, `${config.stackPrefix}-Agent`, {
  ...commonProps,
  config,
  knowledgeBaseId: knowledge?.knowledgeBaseId ?? sharedKnowledgeBaseId!,
  knowledgeBaseArn: knowledge?.knowledgeBaseArn ?? sharedKnowledgeBaseArn!,
});
new MonitoringStack(app, `${config.stackPrefix}-Monitoring`, {
  ...commonProps,
  config,
  alertEmail: process.env.DENNIE_ALERT_EMAIL ?? (config.name === "production" ? "dandinh1922@gmail.com" : undefined),
  agentFunction: agent.agentFunction,
  api: agent.api,
  functionLogGroup: agent.functionLogGroup,
});

Tags.of(app).add("Project", "Dennie");
Tags.of(app).add("Environment", config.name);
Tags.of(app).add("Name", "my-corner-chatbot");
Tags.of(app).add("Workload", "my-corner-chatbot");
