import { describe, expect, it, vi } from "vitest";

import { OpenAIAnswerProvider, parseResponsesStream } from "../src/answer.js";

function stream(...frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({ start(controller) {
    for (const frame of frames) controller.enqueue(encoder.encode(frame));
    controller.close();
  } });
}

describe("OpenAI Responses stream", () => {
  it("parses split SSE frames and usage", async () => {
    const usage: Record<string, number> = {};
    const frames = stream(
      'event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta","delta":"Hello"}\r',
      '\n\r\nevent: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":2,"output_tokens":1}}}\n\n',
    );
    const deltas: string[] = [];
    for await (const delta of parseResponsesStream(frames, usage, new AbortController().signal)) deltas.push(delta);
    expect(deltas).toEqual(["Hello"]);
    expect(usage).toEqual({ input_tokens: 2, output_tokens: 1 });
  });

  it("retries 5xx twice, but does not retry quota responses", async () => {
    const completed = stream('data: {"type":"response.completed"}\n\n');
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(completed, { status: 200 }));
    const provider = new OpenAIAnswerProvider({ get: async () => "test-key" }, fetcher);
    const result = await provider.stream("question", "model", new AbortController().signal);
    for await (const delta of result.deltas) { expect(delta).toBe(""); }
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toMatchObject({ stream: true, store: false,
      reasoning: { effort: "none" } });

    const quota = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(new OpenAIAnswerProvider({ get: async () => "test-key" }, quota)
      .stream("question", "model", new AbortController().signal)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    expect(quota).toHaveBeenCalledTimes(1);
  });

  it("invalidates a cached secret after provider authentication fails", async () => {
    const invalidate = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    await expect(new OpenAIAnswerProvider({ get: async () => "stale-key", invalidate }, fetcher)
      .stream("question", "model", new AbortController().signal)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    expect(invalidate).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
