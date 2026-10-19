import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import { AgentStack } from "../lib/agent-stack.js";
import { getEnvironmentConfig } from "../lib/config.js";

function template(environment: "development" | "production" = "development"): Template {
  const app = new App();
  const stack = new AgentStack(app, "TestAgent", {
    env: { account: "123456789012", region: "ap-southeast-1" },
    config: getEnvironmentConfig(environment),
    knowledgeBaseId: "kb-test",
    knowledgeBaseArn: "arn:aws:bedrock:ap-southeast-1:123456789012:knowledge-base/kb-test",
  });
  return Template.fromStack(stack);
}

describe("AgentStack", () => {
  it("bundles a streaming Lambda outside a VPC", () => {
    const built = template();
    built.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs24.x", Architectures: ["arm64"], MemorySize: 1024, Timeout: 30,
      Environment: { Variables: Match.objectLike({
        BEDROCK_KNOWLEDGE_BASE_ID: "kb-test",
        OPENAI_REASONING_EFFORT: "low",
        ALLOWED_ORIGINS: "https://dandinh.net,http://localhost:3000",
      }) },
    });
    const fn = Object.values(built.findResources("AWS::Lambda::Function"))[0] as { Properties: Record<string, unknown> };
    expect(fn.Properties).not.toHaveProperty("VpcConfig");
    expect(fn.Properties).not.toHaveProperty("ReservedConcurrentExecutions");
    expect(JSON.stringify(fn.Properties)).not.toContain("OPENAI_API_KEY:");
  });

  it("limits IAM and enables REST proxy streaming", () => {
    const built = template();
    built.hasResourceProperties("AWS::IAM::Policy", { PolicyDocument: { Statement: Match.arrayWith([
      Match.objectLike({ Action: "bedrock:Retrieve", Resource: "arn:aws:bedrock:ap-southeast-1:123456789012:knowledge-base/kb-test" }),
    ]) } });
    built.hasResourceProperties("AWS::ApiGateway::Method", {
      HttpMethod: "POST", Integration: Match.objectLike({
        Type: "AWS_PROXY", ResponseTransferMode: "STREAM",
        Uri: Match.anyValue(),
      }),
    });
    expect(JSON.stringify(built.findResources("AWS::ApiGateway::Method"))).toContain("response-streaming-invocations");
    built.resourceCountIs("AWS::SecretsManager::Secret", 1);
    built.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 30 });
    const policies = JSON.stringify(built.findResources("AWS::IAM::Policy"));
    expect(policies).toContain("secretsmanager:GetSecretValue");
    expect(policies).not.toContain('"Action":"*"');
    const stages = JSON.stringify(built.findResources("AWS::ApiGateway::Stage"));
    expect(stages).toContain('"DataTraceEnabled":false');
    expect(stages).not.toContain("$context.requestBody");
  });

  it("routes production traffic through a fixed live alias", () => {
    const built = template("production");
    built.hasResourceProperties("AWS::Lambda::Version", { FunctionName: Match.anyValue() });
    built.hasResourceProperties("AWS::Lambda::Alias", {
      Name: "live", FunctionVersion: "1", FunctionName: Match.anyValue(),
    });
    expect(JSON.stringify(built.findResources("AWS::ApiGateway::Method"))).toContain(":live");
    const permissions = built.findResources("AWS::Lambda::Permission");
    expect(Object.keys(permissions).length).toBeGreaterThan(0);
    for (const value of Object.values(permissions)) {
      expect((value as { DependsOn?: string[] }).DependsOn ?? []).toContain("LiveAlias");
    }
  });
});
