import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.AGENT_API_URL?.trim();
if (!apiUrl) {
  throw new Error("AGENT_API_URL is required");
}

const questions = (await readFile(path.join(directory, "questions.jsonl"), "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const results = [];

for (const question of questions) {
  const startedAt = Date.now();
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: question.question,
      history: [],
      sessionId: `evaluation-${question.id}`,
    }),
  });
  const body = await response.text();
  results.push({
    id: question.id,
    status: response.status,
    durationMs: Date.now() - startedAt,
    response: body,
  });
  console.log(`${question.id}: ${response.status}`);
}

const resultsDirectory = path.join(directory, "results");
await mkdir(resultsDirectory, { recursive: true });
const outputPath = path.join(resultsDirectory, `${new Date().toISOString().replaceAll(":", "-")}.json`);
await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
