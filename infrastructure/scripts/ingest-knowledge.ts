import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runKnowledgeIngestPipeline,
  type KnowledgeIngestStep,
} from "./knowledge-ingest.js";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));

async function runStep(step: KnowledgeIngestStep): Promise<void> {
  const scriptPath = path.join(scriptsDirectory, step.script);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", scriptPath, ...step.arguments],
      { cwd: path.dirname(scriptsDirectory), env: process.env, stdio: "inherit" },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const outcome = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      reject(new Error(`${step.name} failed with ${outcome}`));
    });
  });
}

await runKnowledgeIngestPipeline({ runStep });
