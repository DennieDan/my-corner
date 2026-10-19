import type { Writable } from "node:stream";

export type SseEvent = "sources" | "delta" | "done" | "error";

export function writeEvent(stream: Writable, event: SseEvent, data: unknown): void {
  stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
