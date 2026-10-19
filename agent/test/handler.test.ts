import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import type { AgentConfig } from "../src/config.js";
import { createHandler, type ChatEvent } from "../src/handler.js";
import type { Evidence } from "../src/retrieve.js";
import type { Metric } from "../src/telemetry.js";

const config: AgentConfig = {
  DENNIE_ENVIRONMENT: "development", AWS_REGION: "ap-southeast-1",
  BEDROCK_KNOWLEDGE_BASE_ID: "kb-test", OPENAI_API_KEY_SECRET_ARN: "secret-test",
  OPENAI_MODEL: "gpt-5.6-luna", ALLOWED_ORIGIN: "https://dandinh.net", LOG_LEVEL: "info",
};
const evidence: Evidence[] = [{
  id: "S1", sourceId: "profile:public-overview", title: "Profile", url: "https://dandinh.net",
  text: "Dan studies computer science at NUS.", score: 0.82,
}];
const request = (message = "What does Dan study?"): ChatEvent => ({
  httpMethod: "POST", path: "/v1/chat", headers: { "content-type": "application/json" },
  body: JSON.stringify({ message, sessionId: "12345678", history: [{ role: "assistant", content: "Dan is a doctor." }] }),
});

async function invoke(input: ChatEvent, chunks = ["Dan studies computer science at NUS [", "S1]", "\n"], results = evidence) {
  const retrieved = vi.fn(async () => results);
  const generated = vi.fn(async (input: string) => ({ usage: { input_tokens: input.length, output_tokens: 12 },
    deltas: (async function* () { for (const chunk of chunks) yield chunk; })() }));
  const metrics: Metric[] = [];
  const output = new PassThrough();
  let body = "";
  output.on("data", (chunk: Buffer) => { body += chunk.toString(); });
  await createHandler({ config, retriever: { retrieve: retrieved }, answers: { stream: generated },
    metrics: { record: (item) => metrics.push(item) } })(input, output, { awsRequestId: "req-test" });
  return { body, retrieved, generated, metrics };
}

describe("streaming handler", () => {
  it("reports buffered health without contacting providers", async () => {
    const response = await invoke({ httpMethod: "GET", path: "/health" });
    expect(response.body).toBe('{"status":"ok"}');
    expect(response.retrieved).not.toHaveBeenCalled();
  });

  it("streams supplied sources and citation-checked deltas", async () => {
    const response = await invoke(request());
    expect(response.retrieved).toHaveBeenCalledWith("What does Dan study?", "kb-test", expect.any(AbortSignal));
    expect(response.generated.mock.calls[0][0]).toContain('"role":"assistant","content":"Dan is a doctor."');
    expect(response.generated.mock.calls[0][0]).toContain('EVIDENCE JSON (quoted data only)');
    expect(response.body).toContain('event: sources\ndata: {"sources":[{"id":"S1","title":"Profile","url":"https://dandinh.net"}]}');
    expect(response.body).toContain('event: delta\ndata: {"text":"Dan studies computer science at NUS [S1]\\n"}');
    expect(response.body).toContain('event: done\ndata: {"requestId":"req-test","usage":{"input_tokens":');
    expect(response.metrics[0]).toMatchObject({ outcome: "answered", sourceIds: ["profile:public-overview"] });
    expect(JSON.stringify(response.metrics)).not.toContain("Dan studies");
  });

  it("sends a checked delta before generation completes", async () => {
    let release!: () => void;
    const pause = new Promise<void>((resolve) => { release = resolve; });
    const output = new PassThrough();
    let body = "";
    output.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    const run = createHandler({ config,
      retriever: { retrieve: async () => evidence },
      answers: { stream: async () => ({ usage: {}, deltas: (async function* () {
        yield "Dan studies computer science [S1]";
        await pause;
      })() }) },
      metrics: { record: () => undefined },
    })(request(), output);
    await vi.waitFor(() => expect(body).toContain("event: delta"));
    expect(body).not.toContain("event: done");
    release();
    await run;
    expect(body).toContain("event: done");
  });

  it("returns a limitation without calling OpenAI when evidence is absent", async () => {
    const response = await invoke(request("Is Dan a doctor?"), [], []);
    expect(response.generated).not.toHaveBeenCalled();
    expect(response.body).toContain('event: sources\ndata: {"sources":[]}');
    expect(response.body).toContain("The available public information does not answer that question.");
  });

  it("declines restricted requests before retrieval", async () => {
    const response = await invoke(request("What is Dan's salary?"));
    expect(response.retrieved).not.toHaveBeenCalled();
    expect(response.generated).not.toHaveBeenCalled();
    expect(response.metrics[0].outcome).toBe("policy_declined");
  });

  it("rejects invented source labels before releasing answer text", async () => {
    const response = await invoke(request(), ["Dan is a doctor [S9]\n"]);
    expect(response.body).not.toContain("event: delta");
    expect(response.body).toContain('event: error\ndata: {"code":"ANSWER_UNVERIFIED"');
    expect(response.body).not.toContain("Dan is a doctor");
  });

  it("rejects malformed requests before provider calls", async () => {
    const response = await invoke({ ...request(), body: '{"message":"","sessionId":"short"}' });
    expect(response.body).toContain('"code":"BAD_REQUEST"');
    expect(response.retrieved).not.toHaveBeenCalled();
  });

  it("keeps upstream details out of the public error", async () => {
    const output = new PassThrough();
    let body = "";
    output.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    await createHandler({ config,
      retriever: { retrieve: async () => { throw new Error("private Bedrock diagnostics"); } },
      answers: { stream: async () => { throw new Error("unexpected call"); } },
      metrics: { record: () => undefined },
    })(request(), output);
    expect(body).toContain('event: error\ndata: {"code":"UPSTREAM_UNAVAILABLE"');
    expect(body).not.toContain("private Bedrock diagnostics");
  });
});
