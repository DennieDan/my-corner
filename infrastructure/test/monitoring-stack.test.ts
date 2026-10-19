import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";

import { AgentStack } from "../lib/agent-stack.js";
import { getEnvironmentConfig } from "../lib/config.js";
import { MonitoringStack } from "../lib/monitoring-stack.js";

describe("MonitoringStack", () => {
  it("counts safe provider failures and provisions alarms, dashboard, and budget", () => {
    const app = new App();
    const config = { ...getEnvironmentConfig("development"), awsBudgetUsd: 25 };
    const env = { account: "123456789012", region: "ap-southeast-1" };
    const agent = new AgentStack(app, "TestAgent", {
      env, config, knowledgeBaseId: "kb-test",
      knowledgeBaseArn: "arn:aws:bedrock:ap-southeast-1:123456789012:knowledge-base/kb-test",
    });
    const monitoring = new MonitoringStack(app, "TestMonitoring", {
      env, config, agentFunction: agent.agentFunction, api: agent.api,
      functionLogGroup: agent.functionLogGroup,
    });
    const built = Template.fromStack(monitoring);
    built.resourceCountIs("AWS::Logs::MetricFilter", 3);
    built.resourceCountIs("AWS::CloudWatch::Alarm", 6);
    built.resourceCountIs("AWS::CloudWatch::Dashboard", 1);
    built.hasResourceProperties("AWS::Budgets::Budget", { Budget: Match.objectLike({
      BudgetType: "COST", TimeUnit: "MONTHLY", BudgetLimit: { Amount: 25, Unit: "USD" },
    }) });
    built.hasResourceProperties("AWS::SNS::TopicPolicy", {
      PolicyDocument: { Statement: Match.arrayWith([
        Match.objectLike({ Principal: { Service: "budgets.amazonaws.com" }, Action: "sns:Publish" }),
      ]) },
    });
    const topicPolicy = JSON.stringify(built.findResources("AWS::SNS::TopicPolicy"));
    if (!topicPolicy.includes("alarm:*")) throw new Error("CloudWatch alarm ARN pattern must use a colon");
  });
});
