import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const streamChat = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/chat/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/chat/client")>(), streamChat,
}));

let ChatWidget: typeof import("@/components/chat/chat-widget").ChatWidget;
const source = { id: "S1", title: "Public profile", url: "https://dandinh.net" };

beforeAll(async () => {
  process.env.NEXT_PUBLIC_AGENT_API_URL = "https://example.com";
  ChatWidget = (await import("@/components/chat/chat-widget")).ChatWidget;
});
beforeEach(() => {
  localStorage.clear();
  streamChat.mockReset();
  let sequence = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `12345678-1234-1234-1234-${String(++sequence).padStart(12, "0")}` });
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function openChat() {
  render(<ChatWidget />);
  fireEvent.click(screen.getByRole("button", { name: "Chat with Dennie" }));
}

describe("Dennie chat widget", () => {
  it("opens with focus, closes on Escape, and restores launcher focus", () => {
    openChat();
    expect(screen.getByRole("dialog", { name: "Dennie" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message Dennie" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Chat with Dennie" }));
  });

  it("shows partial text, then saves a cited answer and clears history", async () => {
    let finish!: () => void;
    const pause = new Promise<void>((resolve) => { finish = resolve; });
    streamChat.mockImplementation(async (_url, _request, _signal, onEvent) => {
      onEvent({ type: "sources", sources: [source] });
      onEvent({ type: "delta", text: "Dan builds websites [S1]" });
      await pause;
      onEvent({ type: "done" });
    });
    openChat();
    await userEvent.click(screen.getByRole("button", { name: "What projects has Dan worked on?" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop response" })).toBeTruthy());
    expect(screen.getByRole("link", { name: /Source S1/ }).getAttribute("href")).toBe(source.url);
    finish();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("finished"));
    expect(screen.getByLabelText("Conversation").textContent).toContain("Dan builds websites");
    expect(JSON.parse(localStorage.getItem("dennie:history:v2") ?? "{}").messages).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Clear conversation" }));
    expect(screen.getByRole("status").textContent).toContain("cleared");
    expect(localStorage.getItem("dennie:history:v2")).toBeNull();
  });

  it("shows a safe error and retries the pending question", async () => {
    streamChat.mockRejectedValueOnce(new Error("Dennie is temporarily unavailable."));
    streamChat.mockImplementationOnce(async (_url, _request, _signal, onEvent) => {
      onEvent({ type: "sources", sources: [source] });
      onEvent({ type: "delta", text: "Dan builds websites [S1]\n" });
      onEvent({ type: "done" });
    });
    openChat();
    fireEvent.change(screen.getByRole("textbox", { name: "Message Dennie" }), { target: { value: "What does Dan build?" } });
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("temporarily unavailable"));
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("finished"));
    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(streamChat.mock.calls[1][1].message).toBe("What does Dan build?");
  });

  it("cancels a stream without saving its partial answer", async () => {
    streamChat.mockImplementation(async (_url, _request, signal, onEvent) => {
      onEvent({ type: "delta", text: "partial answer" });
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    });
    openChat();
    await userEvent.click(screen.getByRole("button", { name: "What is Dan's background?" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop response" })).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Stop response" }));
    expect(screen.getByRole("status").textContent).toContain("stopped");
    expect(screen.getByLabelText("Conversation").textContent).not.toContain("partial answer");
    expect(localStorage.getItem("dennie:history:v2")).toBeNull();
  });

  it("expires stored history and its session after seven days", async () => {
    localStorage.setItem("dennie:history:v2", JSON.stringify({
      savedAt: Date.now() - 8 * 24 * 60 * 60 * 1_000,
      messages: [{ role: "user", content: "Old private text" }],
    }));
    localStorage.setItem("dennie:session:v2", "12345678-1234-1234-1234-000000000999");
    openChat();
    await waitFor(() => expect(localStorage.getItem("dennie:history:v2")).toBeNull());
    expect(screen.getByLabelText("Conversation").textContent).not.toContain("Old private text");
    expect(localStorage.getItem("dennie:session:v2")).not.toBe("12345678-1234-1234-1234-000000000999");
  });
});
