import { describe, expect, it } from "vitest";

import { handler } from "../src/handler.js";

describe("handler", () => {
  it("reports buffered health without contacting providers", async () => {
    const response = await handler({
      rawPath: "/health",
      requestContext: { http: { method: "GET" } },
    } as never, {} as never, () => undefined);

    expect(response).toMatchObject({ statusCode: 200 });
  });
});
