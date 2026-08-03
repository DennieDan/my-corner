#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";

import { AgentStack } from "../lib/agent-stack.js";
import { getEnvironmentConfig } from "../lib/config.js";
import { KnowledgeStack } from "../lib/knowledge-stack.js";
import { MonitoringStack } from "../lib/monitoring-stack.js";

const app = new App();
const config = getEnvironmentConfig(app.node.tryGetContext("environment"));
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
};
const commonProps = { env, terminationProtection: config.terminationProtection };

new KnowledgeStack(app, `${config.stackPrefix}-Knowledge`, commonProps);
new AgentStack(app, `${config.stackPrefix}-Agent`, commonProps);
new MonitoringStack(app, `${config.stackPrefix}-Monitoring`, commonProps);

Tags.of(app).add("Project", "Dennie");
Tags.of(app).add("Environment", config.name);
