import { randomUUID } from "node:crypto";
import type { Writable } from "node:stream";
import { z } from "zod";

import { OpenAIAnswerProvider, SecretKeyProvider, type AnswerProvider } from "./answer.js";
import { CitationGate } from "./citations.js";
import { loadConfig, type AgentConfig } from "./config.js";
import { AgentError, operationSignal, providerError, publicMessage } from "./errors.js";
import { buildInput, limitation } from "./prompt.js";
import { mustDecline } from "./policy.js";
import { chatRequestSchema } from "./request-schema.js";
import { BedrockRetriever, type Retriever } from "./retrieve.js";
import { writeEvent } from "./stream.js";
import { JsonMetrics, type Metrics } from "./telemetry.js";

export interface ChatEvent {
  httpMethod?: string;
  path?: string;
  rawPath?: string;
  requestContext?: { http?: { method?: string }; requestId?: string };
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface ChatContext { awsRequestId?: string; getRemainingTimeInMillis?: () => number }

export interface Dependencies {
  config: AgentConfig;
  retriever: Retriever;
  answers: AnswerProvider;
  metrics: Metrics;
}

type Metadata = { statusCode: number; headers: Record<string, string> };
type LambdaStreamRuntime = {
  streamifyResponse: (fn: typeof runHandler) => typeof runHandler;
};

function runtime(): LambdaStreamRuntime | undefined {
  return (globalThis as unknown as { awslambda?: LambdaStreamRuntime }).awslambda;
}

const baseHeaders = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

function responseStream(raw: Writable, statusCode: number, type: string, origin?: string): Writable {
  const headers = { ...baseHeaders, "content-type": type, ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}) };
  // API Gateway's streaming proxy requires metadata followed by eight NUL bytes.
  // Writing the framing explicitly avoids depending on HttpResponseStream.from,
  // which is not available in every managed Node.js streaming runtime.
  if (runtime()?.streamifyResponse) {
    const metadata: Metadata = { statusCode, headers };
    raw.write(JSON.stringify(metadata));
    raw.write(Buffer.alloc(8));
  }
  return raw;
}

function methodAndPath(event: ChatEvent): [string, string] {
  return [event.httpMethod ?? event.requestContext?.http?.method ?? "", event.path ?? event.rawPath ?? ""];
}

function requestBody(event: ChatEvent): unknown {
  if (!event.body || event.body.length > 25_000) throw new AgentError("BAD_REQUEST", 400);
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body); }
  catch { throw new AgentError("BAD_REQUEST", 400); }
}

function originFor(event: ChatEvent, allowed: string[]): string | undefined {
  const header = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === "origin")?.[1];
  return header && allowed.includes(header) ? header : undefined;
}

export function createHandler(deps: Dependencies) {
  return async (event: ChatEvent, raw: Writable, context: ChatContext = {}): Promise<void> => {
    const started = Date.now();
    const requestId = context.awsRequestId ?? event.requestContext?.requestId ?? randomUUID();
    const [method, path] = methodAndPath(event);
    const origin = originFor(event, deps.config.ALLOWED_ORIGINS);
    let stream: Writable | undefined;
    let outcome = "unknown";
    let evidenceCount = 0;
    let sourceIds: string[] = [];
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    const parent = new AbortController();
    const onClose = () => { if (!raw.writableEnded) parent.abort(new AgentError("AGENT_TIMEOUT", 504)); };
    raw.on("close", onClose);
    const remaining = Math.max(1_000, (context.getRemainingTimeInMillis?.() ?? 30_000) - 500);
    const deadline = operationSignal(parent.signal, Math.min(25_000, remaining));
    try {
      if (method === "GET" && path.endsWith("/health")) {
        stream = responseStream(raw, 200, "application/json; charset=utf-8", origin);
        stream.end(JSON.stringify({ status: "ok" }));
        outcome = "healthy";
        return;
      }
      if (method !== "POST" || !path.endsWith("/chat")) throw new AgentError("METHOD_NOT_ALLOWED", 405);
      const contentType = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === "content-type")?.[1];
      if (contentType && !contentType.toLowerCase().startsWith("application/json")) throw new AgentError("BAD_REQUEST", 400);
      const request = chatRequestSchema.parse(requestBody(event));
      stream = responseStream(raw, 200, "text/event-stream; charset=utf-8", origin);
      if (mustDecline(request.message)) {
        writeEvent(stream, "sources", { sources: [] });
        writeEvent(stream, "delta", { text: limitation(request.message) });
        writeEvent(stream, "done", { requestId, usage: {} });
        outcome = "policy_declined";
        return;
      }
      const retrieval = operationSignal(deadline.signal, 8_000);
      let evidence;
      try { evidence = await deps.retriever.retrieve(request.message, deps.config.BEDROCK_KNOWLEDGE_BASE_ID, retrieval.signal); }
      finally { retrieval.clear(); }
      evidenceCount = evidence.length;
      sourceIds = [...new Set(evidence.map((item) => item.sourceId))];
      writeEvent(stream, "sources", { sources: evidence.map(({ id, title, url }) => ({ id, title, url })) });
      if (deadline.signal.aborted) throw deadline.signal.reason;
      if (evidence.length === 0) {
        writeEvent(stream, "delta", { text: limitation(request.message) });
        writeEvent(stream, "done", { requestId, usage: {} });
        outcome = "no_evidence";
        return;
      }
      const generation = operationSignal(deadline.signal, 15_000);
      try {
        const answer = await deps.answers.stream(buildInput(request, evidence), deps.config.OPENAI_MODEL, generation.signal, deps.config.OPENAI_REASONING_EFFORT);
        const gate = new CitationGate(new Set(evidence.map(({ id }) => id)));
        for await (const delta of answer.deltas) {
          if (generation.signal.aborted) throw generation.signal.reason;
          for (const text of gate.push(delta)) writeEvent(stream, "delta", { text });
        }
        const ending = gate.finish();
        for (const text of ending.remaining) writeEvent(stream, "delta", { text });
        if (ending.refusal) writeEvent(stream, "delta", { text: limitation(request.message) });
        inputTokens = answer.usage.input_tokens;
        outputTokens = answer.usage.output_tokens;
        writeEvent(stream, "done", { requestId, usage: answer.usage });
        outcome = ending.refusal ? "no_evidence" : "answered";
      } finally { generation.clear(); }
    } catch (error) {
      const safe = error instanceof z.ZodError ? new AgentError("BAD_REQUEST", 400) :
        deadline.signal.aborted ? new AgentError("AGENT_TIMEOUT", 504) : providerError(error);
      outcome = safe.code;
      if (!stream) {
        stream = responseStream(raw, safe.status, "application/json; charset=utf-8", origin);
        stream.write(JSON.stringify({ code: safe.code, message: publicMessage(safe.code) }));
      } else if (!raw.destroyed) {
        writeEvent(stream, "error", { code: safe.code, message: publicMessage(safe.code) });
      }
    } finally {
      deadline.clear();
      raw.off("close", onClose);
      if (stream && !stream.writableEnded) stream.end();
      deps.metrics.record({ requestId, outcome, durationMs: Date.now() - started, evidenceCount, sourceIds, inputTokens, outputTokens });
    }
  };
}

let productionHandler: ReturnType<typeof createHandler> | undefined;
async function runHandler(event: ChatEvent, stream: Writable, context: ChatContext): Promise<void> {
  if (!productionHandler) {
    let config: AgentConfig;
    try { config = loadConfig(); }
    catch {
      const response = responseStream(stream, 503, "application/json; charset=utf-8");
      response.end(JSON.stringify({ code: "UPSTREAM_UNAVAILABLE", message: publicMessage("UPSTREAM_UNAVAILABLE") }));
      return;
    }
    productionHandler = createHandler({
      config,
      retriever: new BedrockRetriever(),
      answers: new OpenAIAnswerProvider(new SecretKeyProvider(config.OPENAI_API_KEY_SECRET_ARN)),
      metrics: new JsonMetrics(),
    });
  }
  await productionHandler(event, stream, context);
}

export const handler = typeof runtime()?.streamifyResponse === "function"
  ? runtime()!.streamifyResponse(runHandler) : runHandler;
