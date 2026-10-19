import assert from "node:assert/strict";
import { test } from "node:test";
import { PassThrough } from "node:stream";

import { createHandler } from "../agent/dist/handler.js";
import { SseParser, streamChat } from "../lib/chat/client.ts";

const config = {
  DENNIE_ENVIRONMENT: "development", AWS_REGION: "ap-southeast-1",
  BEDROCK_KNOWLEDGE_BASE_ID: "test-kb", OPENAI_API_KEY_SECRET_ARN: "test-secret",
  OPENAI_MODEL: "gpt-5.6-luna", OPENAI_REASONING_EFFORT: "none",
  ALLOWED_ORIGINS: ["http://localhost:3000"], LOG_LEVEL: "info",
};
const evidence = [{ id: "S1", sourceId: "profile:public-overview", title: "Profile",
  url: "https://dandinh.net", text: "Dan studies computer science.", score: 0.9 }];

async function handlerResponse(deltas) {
  const output = new PassThrough();
  const chunks = [];
  output.on("data", (chunk) => chunks.push(chunk));
  await createHandler({
    config,
    retriever: { retrieve: async () => evidence },
    answers: { stream: async () => ({ usage: { input_tokens: 12, output_tokens: 7 }, deltas: (async function* () { for (const delta of deltas) yield delta; })() }) },
    metrics: { record: () => undefined },
  })({ httpMethod: "POST", path: "/v1/chat", headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "What does Dan study?", history: [], sessionId: "contract-test-123" }) }, output);
  return Buffer.concat(chunks).toString("utf8");
}

test("UI parser and fetch client consume real agent SSE frames", async () => {
  const body = await handlerResponse(["Dan studies computer science [", "S1]\n"]);
  const parser = new SseParser();
  const split = Math.floor(body.length / 3);
  const parsed = [
    ...parser.push(body.slice(0, split)),
    ...parser.push(body.slice(split, split * 2)),
    ...parser.push(body.slice(split * 2)),
  ];
  assert.deepEqual(parsed, [
    { type: "sources", sources: [{ id: "S1", title: "Profile", url: "https://dandinh.net" }] },
    { type: "delta", text: "Dan studies computer science [S1]\n" },
    { type: "done", usage: { input_tokens: 12, output_tokens: 7 } },
  ]);

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(body, { headers: { "content-type": "text/event-stream" } });
    const consumed = [];
    await streamChat("https://example.com/v1/chat", { message: "What does Dan study?", history: [], sessionId: "contract-test-123" },
      new AbortController().signal, (event) => consumed.push(event));
    assert.deepEqual(consumed, parsed);
  } finally { globalThis.fetch = originalFetch; }
});

test("agent invalid citation reaches the UI as a safe error", async () => {
  const body = await handlerResponse(["Invented answer [S9]\n"]);
  const events = new SseParser().push(body);
  assert.equal(events[0].type, "sources");
  assert.deepEqual(events[1], { type: "error", code: "ANSWER_UNVERIFIED",
    message: "Dennie could not verify this answer. Please try again." });
  assert.equal(events.some((event) => event.type === "delta"), false);
});
