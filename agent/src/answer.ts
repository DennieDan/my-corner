import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { AgentError, retryTransient } from "./errors.js";
import { SYSTEM_PROMPT } from "./prompt.js";

export interface Usage { input_tokens?: number; output_tokens?: number }
export interface AnswerStream { deltas: AsyncIterable<string>; usage: Usage }
export interface AnswerProvider {
  stream(input: string, model: string, signal: AbortSignal, reasoningEffort?: "none" | "low"): Promise<AnswerStream>;
}

export interface KeyProvider {
  get(signal: AbortSignal): Promise<string>;
  invalidate?(): void;
}

export class SecretKeyProvider {
  private cached?: string;
  constructor(private readonly secretArn: string, private readonly client = new SecretsManagerClient({ maxAttempts: 1 })) {}

  invalidate(): void { this.cached = undefined; }

  async get(signal: AbortSignal): Promise<string> {
    if (this.cached) return this.cached;
    const result = await retryTransient(async () => {
      try { return await this.client.send(new GetSecretValueCommand({ SecretId: this.secretArn }), { abortSignal: signal }); }
      catch (error) {
        const name = error instanceof Error ? error.name : "";
        const status = typeof error === "object" && error !== null && "$metadata" in error
          ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined;
        throw new AgentError("UPSTREAM_UNAVAILABLE", 503,
          name === "ThrottlingException" || (typeof status === "number" && status >= 500));
      }
    }, signal);
    let key = result.SecretString;
    if (key?.trimStart().startsWith("{")) {
      try {
        const fields = JSON.parse(key) as { apiKey?: string; api_key?: string; OPENAI_API_KEY?: string };
        key = fields.apiKey ?? fields.api_key ?? fields.OPENAI_API_KEY;
      } catch { throw new AgentError("UPSTREAM_UNAVAILABLE", 503); }
    }
    if (!key) throw new AgentError("UPSTREAM_UNAVAILABLE", 503);
    this.cached = key;
    return key;
  }
}

export class OpenAIAnswerProvider implements AnswerProvider {
  constructor(
    private readonly keys: KeyProvider,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async stream(input: string, model: string, signal: AbortSignal, reasoningEffort: "none" | "low" = "none"): Promise<AnswerStream> {
    const apiKey = await this.keys.get(signal);
    const response = await retryTransient(async () => {
      let result: Response;
      try {
        result = await this.fetcher("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            reasoning: { effort: reasoningEffort },
            store: false,
            stream: true,
            max_output_tokens: 800,
            input: [
              { role: "developer", content: SYSTEM_PROMPT },
              { role: "user", content: input },
            ],
          }),
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        throw new AgentError("UPSTREAM_UNAVAILABLE", 503, error instanceof TypeError);
      }
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) this.keys.invalidate?.();
        // Rate and quota responses are deliberately never retried.
        throw new AgentError("UPSTREAM_UNAVAILABLE", 503, result.status === 408 || result.status >= 500);
      }
      if (!result.body) throw new AgentError("UPSTREAM_UNAVAILABLE", 503);
      return result;
    }, signal);
    const usage: Usage = {};
    return { deltas: parseResponsesStream(response.body!, usage, signal), usage };
  }
}

export async function* parseResponsesStream(body: ReadableStream<Uint8Array>, usage: Usage, signal: AbortSignal): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
      if (buffer.length > 1_000_000) throw new AgentError("UPSTREAM_UNAVAILABLE", 503);
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!data || data === "[DONE]") continue;
        let event: { type?: string; delta?: string; response?: { usage?: Usage } };
        try { event = JSON.parse(data) as typeof event; }
        catch { throw new AgentError("UPSTREAM_UNAVAILABLE", 503); }
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") yield event.delta;
        if (event.type === "response.completed") {
          Object.assign(usage, event.response?.usage ?? {});
          completed = true;
        }
        if (event.type === "response.failed" || event.type === "error" || event.type === "response.incomplete") {
          throw new AgentError("UPSTREAM_UNAVAILABLE", 503);
        }
      }
      if (done) break;
    }
    if (!completed) throw new AgentError("UPSTREAM_UNAVAILABLE", 503);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
