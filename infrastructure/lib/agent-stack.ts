import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  aws_apigateway as apigateway,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
  type StackProps,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

import type { EnvironmentConfig } from "./config.js";

export interface AgentStackProps extends StackProps {
  config: EnvironmentConfig;
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
}

export class AgentStack extends Stack {
  public readonly api: apigateway.RestApi;
  public readonly agentFunction: nodejs.NodejsFunction;
  public readonly functionLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const agentDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../agent");
    const secret = new secretsmanager.Secret(this, "OpenAIKey", {
      description: "OpenAI project API key for the Dennie chat agent; replace the generated placeholder before live chat testing",
      generateSecretString: { passwordLength: 40, excludePunctuation: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.functionLogGroup = new logs.LogGroup(this, "AgentLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.agentFunction = new nodejs.NodejsFunction(this, "ChatHandler", {
      functionName: `${props.config.stackPrefix}-chat`,
      description: "Streams source-grounded Dennie answers through API Gateway",
      entry: resolve(agentDirectory, "src/handler.ts"),
      handler: "handler",
      depsLockFilePath: resolve(agentDirectory, "package-lock.json"),
      projectRoot: agentDirectory,
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      logGroup: this.functionLogGroup,
      bundling: {
        target: "node24",
        format: nodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: false,
        externalModules: [],
      },
      environment: {
        DENNIE_ENVIRONMENT: props.config.name,
        BEDROCK_KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        OPENAI_API_KEY_SECRET_ARN: secret.secretArn,
        OPENAI_MODEL: "gpt-5.6-luna",
        OPENAI_REASONING_EFFORT: "low",
        ALLOWED_ORIGINS: props.config.allowedOrigins.join(","),
        LOG_LEVEL: "info",
      },
    });
    secret.grantRead(this.agentFunction);
    this.agentFunction.addToRolePolicy(new iam.PolicyStatement({
      sid: "RetrieveApprovedKnowledgeBase",
      actions: ["bedrock:Retrieve"],
      resources: [props.knowledgeBaseArn],
    }));

    const accessLogs = new logs.LogGroup(this, "ApiAccessLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.api = new apigateway.RestApi(this, "AgentApi", {
      restApiName: `${props.config.stackPrefix}-chat-api`,
      description: "Regional streaming API for the Dennie agent",
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      cloudWatchRole: true,
      deployOptions: {
        stageName: props.config.name,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: false,
        throttlingRateLimit: 2,
        throttlingBurstLimit: 5,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogs),
        accessLogFormat: apigateway.AccessLogFormat.custom(JSON.stringify({
          requestId: "$context.requestId",
          status: "$context.status",
          responseLatency: "$context.responseLatency",
          resourcePath: "$context.resourcePath",
        })),
      },
    });

    let apiTarget: lambda.IFunction = this.agentFunction;
    let liveAlias: lambda.CfnAlias | undefined;
    if (props.config.name === "production") {
      const bootstrapVersion = new lambda.CfnVersion(this, "BootstrapVersion", {
        functionName: this.agentFunction.functionName,
      });
      liveAlias = new lambda.CfnAlias(this, "LiveAlias", {
        functionName: this.agentFunction.functionName,
        functionVersion: "1",
        name: "live",
      });
      liveAlias.addResourceDependency(bootstrapVersion);
      apiTarget = lambda.Function.fromFunctionAttributes(this, "LiveAgentAlias", {
        functionArn: `${this.agentFunction.functionArn}:live`,
        sameEnvironment: true,
      });
    }

    const integration = new apigateway.LambdaIntegration(apiTarget, {
      proxy: true,
      responseTransferMode: apigateway.ResponseTransferMode.STREAM,
      allowTestInvoke: false,
    });
    const cors = {
      allowOrigins: props.config.allowedOrigins,
      allowMethods: ["POST", "GET", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      maxAge: Duration.minutes(10),
    };
    const chat = this.api.root.addResource("v1").addResource("chat");
    chat.addCorsPreflight(cors);
    chat.addMethod("POST", integration);
    const health = this.api.root.addResource("health");
    health.addCorsPreflight(cors);
    health.addMethod("GET", integration);

    if (liveAlias) {
      for (const construct of this.node.findAll()) {
        if (construct instanceof lambda.CfnPermission) construct.addResourceDependency(liveAlias);
      }
      new CfnOutput(this, "AgentLiveAliasArn", { value: `${this.agentFunction.functionArn}:live` });
    }

    new CfnOutput(this, "AgentApiChatUrl", { value: this.api.urlForPath("/v1/chat") });
    new CfnOutput(this, "AgentApiHealthUrl", { value: this.api.urlForPath("/health") });
    new CfnOutput(this, "AgentFunctionName", { value: this.agentFunction.functionName });
    new CfnOutput(this, "OpenAIKeySecretArn", { value: secret.secretArn });
  }
}
