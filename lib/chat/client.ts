export interface ChatSource {
  id: string;
  title: string;
  url: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatEvent =
  | { type: "sources"; sources: ChatSource[] }
  | { type: "delta"; text: string }
  | { type: "done"; usage?: { input_tokens?: number; output_tokens?: number } }
  | { type: "error"; code?: string; message: string };

export const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARACTERS = 12_000;

export function boundedHistory(messages: HistoryMessage[]): HistoryMessage[] {
  const result: HistoryMessage[] = [];
  let characters = 0;
  for (const item of messages.slice().reverse()) {
    const content = item.content.trim();
    if (content.length === 0 || content.length > 4_000) continue;
    if (result.length >= MAX_HISTORY_MESSAGES || characters + content.length > MAX_HISTORY_CHARACTERS) break;
    result.unshift({ role: item.role, content });
    characters += content.length;
  }
  return result;
}

export function safeSource(value: unknown): ChatSource | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (typeof source.id !== "string" || !/^S\d{1,3}$/.test(source.id) ||
      typeof source.title !== "string" || !source.title.trim() || source.title.length > 160 ||
      typeof source.url !== "string" || source.url.length > 2_048) return null;
  try {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
  } catch { return null; }
  return { id: source.id, title: source.title, url: source.url };
}

export function parseFrame(frame: string): ChatEvent | null {
  let event = "";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  let value: Record<string, unknown>;
  try {
    const parsed = JSON.parse(data.join("\n"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    value = parsed as Record<string, unknown>;
  } catch { return null; }
  if (event === "sources" && Array.isArray(value.sources)) {
    return { type: "sources", sources: value.sources.map(safeSource).filter((item): item is ChatSource => !!item).slice(0, 12) };
  }
  if (event === "delta" && typeof value.text === "string") return { type: "delta", text: value.text };
  if (event === "done") {
    const raw = value.usage && typeof value.usage === "object" ? value.usage as Record<string, unknown> : null;
    const usage = raw ? {
      ...(typeof raw.input_tokens === "number" ? { input_tokens: raw.input_tokens } : {}),
      ...(typeof raw.output_tokens === "number" ? { output_tokens: raw.output_tokens } : {}),
    } : undefined;
    return { type: "done", ...(usage ? { usage } : {}) };
  }
  if (event === "error") return { type: "error", ...(typeof value.code === "string" ? { code: value.code } : {}), message: typeof value.message === "string" ? value.message : "Dennie is temporarily unavailable." };
  return null;
}

export class SseParser {
  private buffer = "";

  push(chunk: string): ChatEvent[] {
    this.buffer = (this.buffer + chunk).replace(/\r\n/g, "\n").replace(/\r(?=.)/g, "\n");
    if (this.buffer.length > 1_000_000) throw new Error("The response was too large.");
    const events: ChatEvent[] = [];
    let boundary: number;
    while ((boundary = this.buffer.indexOf("\n\n")) >= 0) {
      const frame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const event = parseFrame(frame);
      if (event) events.push(event);
    }
    return events;
  }
}

export function chatEndpoint(configuredUrl: string): string | null {
  if (!configuredUrl.trim()) return null;
  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/$/, "")}${url.pathname.endsWith("/v1/chat") ? "" : "/v1/chat"}`;
    return url.toString();
  } catch { return null; }
}

export async function streamChat(
  endpoint: string,
  request: { message: string; history: HistoryMessage[]; sessionId: string },
  signal: AbortSignal,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(request),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Could not connect to Dennie. Please try again.");
  }
  if (!response.ok) {
    let message = "Dennie is temporarily unavailable. Please try again.";
    try {
      const body = await response.json() as { message?: unknown };
      if (typeof body.message === "string") message = body.message;
    } catch { /* keep the safe fallback */ }
    throw new Error(message);
  }
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("Dennie returned an unexpected response. Please try again.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      for (const event of parser.push(decoder.decode(value, { stream: !done }))) {
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "done") complete = true;
        onEvent(event);
      }
      if (done || complete) break;
    }
    if (!complete) throw new Error("Dennie's response was interrupted. Please try again.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
