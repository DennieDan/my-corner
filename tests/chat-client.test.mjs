import assert from "node:assert/strict";
import { test } from "node:test";

import { boundedHistory, chatEndpoint, safeSource, SseParser, streamChat } from "../lib/chat/client.ts";

test("SSE frames survive UTF-8, newline, and chunk boundaries", () => {
  const parser = new SseParser();
  assert.deepEqual(parser.push('event: sources\r'), []);
  assert.deepEqual(parser.push('\ndata: {"sources":[{"id":"S1","title":"Résumé","url":"https://example.com/resume"}]}\r\n\r\n'), [
    { type: "sources", sources: [{ id: "S1", title: "Résumé", url: "https://example.com/resume" }] },
  ]);
  assert.deepEqual(parser.push('event: delta\ndata: {"text":"Hello [S1]"}\n\nevent: done\ndata: {}\n\n'), [
    { type: "delta", text: "Hello [S1]" }, { type: "done" },
  ]);
});

test("invalid citation URLs cannot become links", () => {
  assert.equal(safeSource({ id: "S1", title: "Bad", url: "javascript:alert(1)" }), null);
  assert.equal(safeSource({ id: "S1", title: "Bad", url: "https://user:pass@example.com" }), null);
  assert.equal(chatEndpoint("http://example.com/api"), null);
  assert.equal(chatEndpoint("https://example.com/development"), "https://example.com/development/v1/chat");
  assert.equal(chatEndpoint("https://example.com/development/v1/chat"), "https://example.com/development/v1/chat");
});

test("history respects message and character limits", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "x".repeat(1_100) }));
  const bounded = boundedHistory(messages);
  assert.equal(bounded.length, 10);
  assert.equal(bounded.reduce((sum, item) => sum + item.content.length, 0), 11_000);
});

test("client reads a streamed reply and requires done", async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const events = [];
  try {
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: sources\ndata: {"sources":[]}\n\nevent: del'));
        controller.enqueue(encoder.encode('ta\ndata: {"text":"Hello"}\n\nevent: done\ndata: {}\n\n'));
        controller.close();
      },
    }), { headers: { "content-type": "text/event-stream" } });
    await streamChat("https://example.com/v1/chat", { message: "Hi", history: [], sessionId: "12345678" }, new AbortController().signal, (event) => events.push(event));
    assert.deepEqual(events, [{ type: "sources", sources: [] }, { type: "delta", text: "Hello" }, { type: "done" }]);

    globalThis.fetch = async () => new Response('event: delta\ndata: {"text":"Partial"}\n\n', { headers: { "content-type": "text/event-stream" } });
    await assert.rejects(streamChat("https://example.com/v1/chat", { message: "Hi", history: [], sessionId: "12345678" }, new AbortController().signal, () => {}), /interrupted/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stream errors reach the retry state without treating a partial answer as complete", async () => {
  const originalFetch = globalThis.fetch;
  const events = [];
  try {
    globalThis.fetch = async () => new Response(
      'event: delta\ndata: {"text":"Partial"}\n\nevent: error\ndata: {"code":"UPSTREAM_UNAVAILABLE","message":"Dennie is temporarily unavailable."}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
    await assert.rejects(
      streamChat("https://example.com/v1/chat", { message: "Hi", history: [], sessionId: "12345678" }, new AbortController().signal, (event) => events.push(event)),
      /temporarily unavailable/,
    );
    assert.deepEqual(events, [{ type: "delta", text: "Partial" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
