import assert from "node:assert/strict";

const chatUrl = process.env.AGENT_API_URL;
if (!chatUrl || !chatUrl.endsWith("/v1/chat")) {
  throw new Error("AGENT_API_URL must be the full deployed /v1/chat URL");
}
const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:3000";
const healthUrl = chatUrl.replace(/\/v1\/chat$/, "/health");

function events(body: string): string[] {
  return body.split(/\r?\n\r?\n/).map((frame) => frame.match(/^event: (\w+)/m)?.[1]).filter((name): name is string => !!name);
}

function frames(body: string): { event: string; data: Record<string, unknown> }[] {
  return body.split(/\r?\n\r?\n/).flatMap((frame) => {
    const event = frame.match(/^event: (\w+)/m)?.[1];
    const data = frame.match(/^data: (.+)$/m)?.[1];
    return event && data ? [{ event, data: JSON.parse(data) as Record<string, unknown> }] : [];
  });
}

const health = await fetch(healthUrl);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: "ok" });

const preflight = await fetch(chatUrl, {
  method: "OPTIONS",
  headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type" },
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("access-control-allow-origin"), origin);

const disallowed = await fetch(chatUrl, {
  method: "OPTIONS",
  headers: { Origin: "https://not-allowed.example", "Access-Control-Request-Method": "POST" },
});
assert.notEqual(disallowed.headers.get("access-control-allow-origin"), "https://not-allowed.example");

const invalid = await fetch(chatUrl, {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ message: "", sessionId: "short" }),
});
assert.equal(invalid.status, 400);
assert.equal((await invalid.json() as { code: string }).code, "BAD_REQUEST");

const policy = await fetch(chatUrl, {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ message: "What is Dan's salary?", sessionId: "smoke-test-123" }),
});
assert.equal(policy.status, 200);
assert.match(policy.headers.get("content-type") ?? "", /^text\/event-stream/);
assert.equal(policy.headers.get("access-control-allow-origin"), origin);
assert.deepEqual(events(await policy.text()), ["sources", "delta", "done"]);

if (process.env.SMOKE_LIVE === "1") {
  const live = await fetch(chatUrl, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What does Dan study?", sessionId: "smoke-live-123" }),
  });
  assert.equal(live.status, 200);
  const response = await live.text();
  const sequence = events(response);
  assert.equal(sequence[0], "sources");
  assert.ok(sequence.includes("delta"));
  assert.equal(sequence.at(-1), "done");
  assert.ok(!sequence.includes("error"));
  const parsed = frames(response);
  const sources = parsed[0].data.sources as { id: string }[];
  const labels = new Set(sources.map((source) => source.id));
  const answer = parsed.filter((frame) => frame.event === "delta").map((frame) => frame.data.text).join("");
  assert.match(answer, /\[S\d+\]/);
  for (const match of answer.matchAll(/\[(S\d+(?:,\s*S\d+)*)\]/g)) {
    for (const label of match[1].split(/,\s*/)) assert.ok(labels.has(label), `Unknown citation ${label}`);
  }
}

process.stdout.write(`Agent smoke test passed${process.env.SMOKE_LIVE === "1" ? " (including live generation)" : " (without provider calls)"}.\n`);
