export interface Metric {
  requestId: string;
  outcome: string;
  durationMs: number;
  evidenceCount: number;
  sourceIds?: string[];
  inputTokens?: number;
  outputTokens?: number;
}

export interface Metrics { record(metric: Metric): void }

export class JsonMetrics implements Metrics {
  record(metric: Metric): void {
    // Never include the request, history, evidence text, prompt, answer or secret.
    process.stdout.write(`${JSON.stringify({ type: "agent_metric", ...metric })}\n`);
  }
}
