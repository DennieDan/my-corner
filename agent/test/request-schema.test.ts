import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "../src/request-schema.js";

describe("chatRequestSchema", () => {
  it("accepts a bounded chat request", () => {
    const parsed = chatRequestSchema.parse({
      message: "What projects has Dan built?",
      sessionId: "session-1234",
    });

    expect(parsed.history).toEqual([]);
  });

  it("normalizes whitespace and Unicode before sending text to providers", () => {
    const parsed = chatRequestSchema.parse({ message: "  Cafe\u0301\n  projects? ", sessionId: "session-1234",
      history: [{ role: "user", content: "  Dan\t studies  " }] });
    expect(parsed.message).toBe("Café projects?");
    expect(parsed.history[0].content).toBe("Dan studies");
  });

  it("rejects oversized conversation history", () => {
    const result = chatRequestSchema.safeParse({
      message: "Continue",
      sessionId: "session-1234",
      history: Array.from({ length: 4 }, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: "x".repeat(3_500),
      })),
    });

    expect(result.success).toBe(false);
  });
});
