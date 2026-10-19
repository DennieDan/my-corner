import {
  ArnFormat,
  CfnOutput,
  Duration,
  Stack,
  aws_apigateway as apigateway,
  aws_budgets as budgets,
  aws_cloudwatch as cloudwatch,
  aws_cloudwatch_actions as cloudwatchActions,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_sns as sns,
  aws_sns_subscriptions as snsSubscriptions,
  type StackProps,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

import type { EnvironmentConfig } from "./config.js";

export interface MonitoringStackProps extends StackProps {
  config: EnvironmentConfig;
  alertEmail?: string;
  agentFunction: lambda.IFunction;
  api: apigateway.RestApi;
  functionLogGroup: logs.ILogGroup;
}

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const alerts = new sns.Topic(this, "AgentAlerts", {
      topicName: `${props.config.stackPrefix}-alerts`,
      displayName: `${props.config.name} Dennie agent alerts`,
    });
    if (props.alertEmail) alerts.addSubscription(new snsSubscriptions.EmailSubscription(props.alertEmail));
    const topicPolicy = new sns.TopicPolicy(this, "AgentAlertPolicy", { topics: [alerts] });
    if (props.config.awsBudgetUsd !== null) {
      topicPolicy.document.addStatements(new iam.PolicyStatement({
        sid: "AllowBudgetsPublishing",
        principals: [new iam.ServicePrincipal("budgets.amazonaws.com")],
        actions: ["sns:Publish"],
        resources: [alerts.topicArn],
        conditions: {
          StringEquals: { "aws:SourceAccount": this.account },
          ArnLike: { "aws:SourceArn": `arn:aws:budgets::${this.account}:*` },
        },
      }));
    }
    topicPolicy.document.addStatements(new iam.PolicyStatement({
      sid: "AllowCloudWatchAlarmPublishing",
      principals: [new iam.ServicePrincipal("cloudwatch.amazonaws.com")],
      actions: ["sns:Publish"],
      resources: [alerts.topicArn],
      conditions: {
        StringEquals: { "aws:SourceAccount": this.account },
        ArnLike: { "aws:SourceArn": this.formatArn({ service: "cloudwatch", resource: "alarm", resourceName: "*", arnFormat: ArnFormat.COLON_RESOURCE_NAME }) },
      },
    }));

    const period = Duration.minutes(5);
    const providerNamespace = `Dennie/Agent/${props.config.name}`;
    const providerMetricName = "ProviderFailures";
    for (const outcome of ["UPSTREAM_UNAVAILABLE", "AGENT_TIMEOUT", "ANSWER_UNVERIFIED"]) {
      new logs.MetricFilter(this, `${outcome}Filter`, {
        logGroup: props.functionLogGroup,
        filterPattern: logs.FilterPattern.literal(`{ $.type = "agent_metric" && $.outcome = "${outcome}" }`),
        metricNamespace: providerNamespace,
        metricName: providerMetricName,
        metricValue: "1",
      });
    }
    const providerFailures = new cloudwatch.Metric({
      namespace: providerNamespace,
      metricName: providerMetricName,
      statistic: "Sum",
      period,
    });

    const alarmSpecs = [
      { id: "LambdaErrors", metric: props.agentFunction.metricErrors({ period }), threshold: 1 },
      { id: "LambdaThrottles", metric: props.agentFunction.metricThrottles({ period }), threshold: 1 },
      { id: "ApiServerErrors", metric: props.api.metricServerError({ period }), threshold: 1 },
      { id: "ProviderFailures", metric: providerFailures, threshold: 1 },
      { id: "HighLatency", metric: props.api.metricLatency({ period, statistic: "p95" }), threshold: 20_000 },
      { id: "HighVolume", metric: props.api.metricCount({ period }), threshold: 100 },
    ];
    for (const { id: alarmId, metric, threshold } of alarmSpecs) {
      const alarm = new cloudwatch.Alarm(this, `${alarmId}Alarm`, {
        alarmName: `${props.config.stackPrefix}-${alarmId}`,
        metric,
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(alerts));
    }

    const dashboard = new cloudwatch.Dashboard(this, "AgentDashboard", {
      dashboardName: `${props.config.stackPrefix}-agent`,
    });
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({ title: "Requests and API 5xx", left: [props.api.metricCount({ period }), props.api.metricServerError({ period })] }),
      new cloudwatch.GraphWidget({ title: "Latency p95 (ms)", left: [props.api.metricLatency({ period, statistic: "p95" })] }),
      new cloudwatch.GraphWidget({ title: "Lambda errors and throttles", left: [props.agentFunction.metricErrors({ period }), props.agentFunction.metricThrottles({ period })] }),
      new cloudwatch.GraphWidget({ title: "Safe provider failures", left: [providerFailures] }),
    );

    if (props.config.awsBudgetUsd !== null) {
      const budget = new budgets.CfnBudget(this, "MonthlyAccountBudget", {
        budget: {
          budgetName: `${props.config.stackPrefix}-account-cost-guardrail`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: props.config.awsBudgetUsd, unit: "USD" },
        },
        notificationsWithSubscribers: [80, 100].map((threshold) => ({
          notification: {
            comparisonOperator: "GREATER_THAN",
            notificationType: "ACTUAL",
            threshold,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "SNS", address: alerts.topicArn }],
        })),
      });
      budget.node.addDependency(topicPolicy);
    }

    new CfnOutput(this, "AlertTopicArn", { value: alerts.topicArn });
    new CfnOutput(this, "DashboardName", { value: dashboard.dashboardName });
  }
}
