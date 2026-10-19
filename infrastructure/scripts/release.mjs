#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InvokeWithResponseStreamCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetSecretValueCommand, PutSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const infra = path.join(root, "infrastructure");
const environment = process.env.DENNIE_ENVIRONMENT || "production";
const releases = path.join(root, ".releases");
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const command = process.argv[2];
const region = process.env.AWS_REGION || "ap-southeast-1";
process.env.AWS_REGION = region;
mkdirSync(releases, { recursive: true });

function run(bin, args, options = {}) {
  return execFileSync(bin, args, { cwd: root, encoding: "utf8", stdio: options.quiet ? ["ignore", "pipe", "inherit"] : "inherit", env: process.env, ...options });
}
function aws(args) { return JSON.parse(run("aws", [...args, "--output", "json"], { quiet: true })); }
function outputs(stack, targetEnvironment = environment) {
  const result = aws(["cloudformation", "describe-stacks", "--stack-name", `Dennie-${targetEnvironment}-${stack}`]);
  return Object.fromEntries(result.Stacks[0].Outputs.map(({ OutputKey, OutputValue }) => [OutputKey, OutputValue]));
}
function config() {
  const knowledge = outputs("Knowledge", environment === "production" ? "development" : environment);
  const agent = outputs("Agent");
  return {
    bucket: knowledge.MyCornerKnowledgeBucketName,
    knowledgeBaseId: knowledge.MyCornerBedrockKnowledgeBaseId,
    dataSourceId: knowledge.MyCornerBedrockDataSourceId,
    functionName: agent.AgentFunctionName,
    chatUrl: agent.AgentApiChatUrl,
    secretArn: agent.OpenAIKeySecretArn,
  };
}
function save(name, value) {
  const file = path.join(releases, `${name}-${environment}-${timestamp}.json`);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  console.log(`Release record: ${file}`);
  return file;
}
function setKnowledgeEnv(c) {
  Object.assign(process.env, {
    KNOWLEDGE_BUCKET_NAME: c.bucket,
    BEDROCK_KNOWLEDGE_BASE_ID: c.knowledgeBaseId,
    BEDROCK_DATA_SOURCE_ID: c.dataSourceId,
    KNOWLEDGE_PREFIX: "documents",
  });
}
function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}
function versions(bucket) {
  const listed = aws(["s3api", "list-object-versions", "--bucket", bucket]);
  return Object.fromEntries((listed.Versions || []).filter((item) => item.IsLatest).map((item) => [item.Key, item.VersionId]));
}
function invalidate(distribution, keys) {
  const paths = [...new Set(keys)].map((key) => `/${key}`);
  if (paths.length === 0) return;
  const batches = [];
  for (let i = 0; i < paths.length; i += 1000) batches.push(paths.slice(i, i + 1000));
  for (const batch of batches) {
    const created = aws(["cloudfront", "create-invalidation", "--distribution-id", distribution, "--paths", ...batch]);
    run("aws", ["cloudfront", "wait", "invalidation-completed", "--distribution-id", distribution, "--id", created.Invalidation.Id], { quiet: true });
  }
}
function webPaths(keys) {
  const paths = new Set();
  for (const key of keys) {
    if (key.startsWith("_next/static/")) continue;
    paths.add(key);
    if (key === "index.html") paths.add("");
  }
  return [...paths];
}
async function candidateSmoke(functionName, version) {
  const client = new LambdaClient({ region });
  for (const [name, event, expected] of [
    ["health", { httpMethod: "GET", path: "/health" }, /"status":"ok"/],
    ["policy", { httpMethod: "POST", path: "/v1/chat", headers: { origin: "https://dandinh.net", "content-type": "application/json" }, body: JSON.stringify({ message: "What is Dan's salary?", sessionId: "candidate-smoke-123" }) }, /event: done/],
    ["live", { httpMethod: "POST", path: "/v1/chat", headers: { origin: "https://dandinh.net", "content-type": "application/json" }, body: JSON.stringify({ message: "What does Dan study?", sessionId: "candidate-live-123" }) }, /\[S\d+\]/],
  ]) {
    const result = await client.send(new InvokeWithResponseStreamCommand({ FunctionName: functionName, Qualifier: version, Payload: Buffer.from(JSON.stringify(event)) }));
    assert.equal(result.StatusCode, 200, `${name} Lambda invocation failed`);
    const chunks = [];
    for await (const part of result.EventStream) {
      if (part.InvokeComplete?.ErrorCode) throw new Error(`${name} failed: ${part.InvokeComplete.ErrorCode}`);
      if (part.PayloadChunk?.Payload) chunks.push(Buffer.from(part.PayloadChunk.Payload));
    }
    const body = Buffer.concat(chunks).toString("utf8");
    assert.match(body, expected, `${name} candidate smoke failed`);
    assert.doesNotMatch(body, /event: error/, `${name} emitted error`);
    console.log(`Candidate ${version}: ${name} passed`);
  }
}

switch (command) {
  case "infra": {
    if (environment === "production") {
      const shared = outputs("Knowledge", "development");
      process.env.DENNIE_SHARED_KNOWLEDGE_BASE_ID = shared.MyCornerBedrockKnowledgeBaseId;
      process.env.DENNIE_SHARED_KNOWLEDGE_BASE_ARN = shared.MyCornerBedrockKnowledgeBaseArn;
    }
    run("npm", ["run", "check"], { cwd: infra });
    const cdk = path.join(infra, "node_modules/.bin/cdk");
    process.env.CDK_DEFAULT_ACCOUNT ||= aws(["sts", "get-caller-identity"]).Account;
    process.env.CDK_DEFAULT_REGION = region;
    run(cdk, ["synth", "-c", `environment=${environment}`], { cwd: infra });
    run(cdk, ["diff", "--method", "template", "-c", `environment=${environment}`], { cwd: infra });
    run(cdk, ["deploy", "--all", "-c", `environment=${environment}`, "--require-approval", "never"], { cwd: infra });
    save("infra", { environment, knowledge: outputs("Knowledge", environment === "production" ? "development" : environment), agent: outputs("Agent"), monitoring: outputs("Monitoring") });
    break;
  }
  case "knowledge": {
    const c = config(); setKnowledgeEnv(c);
    run("npm", ["run", "knowledge:validate:approved"], { cwd: infra });
    run("npm", ["run", "knowledge:upload"], { cwd: infra });
    run("npm", ["run", "knowledge:sync"], { cwd: infra });
    const dir = mkdtempSync(path.join(os.tmpdir(), "dennie-retrieval-"));
    run("npm", ["run", "knowledge:retrieve", "--", "--bulk", "--questions", "evaluations/release-smoke.jsonl", "--output-dir", dir], { cwd: infra });
    const report = JSON.parse(readFileSync(path.join(dir, readdirSync(dir)[0]), "utf8"));
    assert.equal(report.summary.failed, 0, "Retrieval provider failed");
    assert.equal(report.evaluationFailures.length, 0, "Expected release sources were not retrieved");
    save("knowledge", { knowledgeBaseId: c.knowledgeBaseId, retrieval: report.evaluationSummary });
    break;
  }
  case "seed-secret": {
    assert.equal(environment, "production");
    const client = new SecretsManagerClient({ region });
    const source = outputs("Agent", "development").OpenAIKeySecretArn;
    const destination = outputs("Agent", "production").OpenAIKeySecretArn;
    const value = await client.send(new GetSecretValueCommand({ SecretId: source }));
    assert.ok(value.SecretString?.startsWith("sk-"), "Development secret does not contain an OpenAI API key");
    await client.send(new PutSecretValueCommand({ SecretId: destination, SecretString: value.SecretString }));
    console.log("Production OpenAI secret seeded from the existing development project key.");
    break;
  }
  case "agent": {
    assert.equal(environment, "production", "The versioned agent release targets the production live alias");
    const c = config();
    run("npm", ["run", "check"], { cwd: path.join(root, "agent") });
    const dir = mkdtempSync(path.join(os.tmpdir(), "dennie-agent-"));
    run(path.join(infra, "node_modules/.bin/esbuild"), ["agent/src/handler.ts", "--bundle", "--platform=node", "--target=node24", "--format=cjs", "--minify", `--outfile=${path.join(dir, "index.js")}`]);
    run("zip", ["-q", "agent.zip", "index.js"], { cwd: dir });
    const prior = aws(["lambda", "get-alias", "--function-name", c.functionName, "--name", "live"]).FunctionVersion;
    const published = aws(["lambda", "update-function-code", "--function-name", c.functionName, "--zip-file", `fileb://${path.join(dir, "agent.zip")}`, "--publish"]);
    const version = published.Version;
    run("aws", ["lambda", "wait", "function-updated", "--function-name", c.functionName]);
    await candidateSmoke(c.functionName, version);
    const record = save("agent", { functionName: c.functionName, previousVersion: prior, candidateVersion: version, chatUrl: c.chatUrl });
    aws(["lambda", "update-alias", "--function-name", c.functionName, "--name", "live", "--function-version", version]);
    try {
      Object.assign(process.env, { AGENT_API_URL: c.chatUrl, SMOKE_ORIGIN: "https://dandinh.net", SMOKE_LIVE: "1" });
      run("npm", ["run", "agent:smoke"], { cwd: infra });
    } catch (error) {
      aws(["lambda", "update-alias", "--function-name", c.functionName, "--name", "live", "--function-version", prior]);
      throw new Error(`Production smoke failed; alias restored to ${prior}. Record: ${record}`, { cause: error });
    }
    break;
  }
  case "rollback-agent": {
    const record = JSON.parse(readFileSync(process.argv[3], "utf8"));
    assert.match(record.functionName, /^Dennie-/);
    aws(["lambda", "update-alias", "--function-name", record.functionName, "--name", "live", "--function-version", record.previousVersion]);
    console.log(`Restored ${record.functionName}:live to ${record.previousVersion}`);
    break;
  }
  case "website": {
    assert.equal(environment, "production", "The website release targets dandinh.net");
    const c = process.env.NEXT_PUBLIC_AGENT_API_URL ? { chatUrl: process.env.NEXT_PUBLIC_AGENT_API_URL } : config();
    const bucket = process.env.S3_BUCKET_NAME;
    const distribution = process.env.CLOUDFRONT_DISTRIBUTION_ID;
    assert.ok(bucket && distribution, "S3_BUCKET_NAME and CLOUDFRONT_DISTRIBUTION_ID are required");
    process.env.NEXT_PUBLIC_AGENT_API_URL = c.chatUrl;
    run(path.join(root, "node_modules/.bin/tsc"), ["--noEmit"]);
    run("npm", ["run", "test:ui"]);
    run("npm", ["run", "build"]);
    const out = path.join(root, "out");
    assert.ok(statSync(path.join(out, "index.html")).isFile());
    const before = versions(bucket);
    run("aws", ["s3", "sync", out, `s3://${bucket}`, "--no-progress", "--exclude", "*.DS_Store"]);
    for (const file of listFiles(out).filter((item) => item.endsWith(".html"))) {
      const key = path.relative(out, file).replaceAll(path.sep, "/").replace(/\.html$/, "");
      if (key === "index") continue;
      run("aws", ["s3api", "put-object", "--bucket", bucket, "--key", key, "--body", file, "--content-type", "text/html; charset=utf-8"], { quiet: true });
    }
    const after = versions(bucket);
    const changed = Object.keys(after).filter((key) => after[key] !== before[key]);
    const record = save("website", { bucket, distribution, previous: Object.fromEntries(changed.map((key) => [key, before[key] || null])), changed, chatUrl: c.chatUrl });
    invalidate(distribution, webPaths(changed));
    try {
      const html = await fetch("https://dandinh.net/dennie", { headers: { "cache-control": "no-cache" } });
      assert.equal(html.status, 200);
      assert.match(await html.text(), /Dennie|Dan/i);
      Object.assign(process.env, { AGENT_API_URL: c.chatUrl, SMOKE_ORIGIN: "https://dandinh.net", SMOKE_LIVE: "1" });
      run("npm", ["run", "agent:smoke"], { cwd: infra });
    } catch (error) {
      throw new Error(`Website smoke failed. Restore with npm run release:rollback:website -- ${record}`, { cause: error });
    }
    break;
  }
  case "rollback-website": {
    const record = JSON.parse(readFileSync(process.argv[3], "utf8"));
    for (const [key, version] of Object.entries(record.previous)) {
      if (version) {
        const source = `${record.bucket}/${key.split("/").map(encodeURIComponent).join("/")}?versionId=${encodeURIComponent(version)}`;
        run("aws", ["s3api", "copy-object", "--bucket", record.bucket, "--key", key, "--copy-source", source], { quiet: true });
      } else run("aws", ["s3api", "delete-object", "--bucket", record.bucket, "--key", key], { quiet: true });
    }
    invalidate(record.distribution, webPaths(record.changed));
    console.log(`Restored ${Object.keys(record.previous).length} website objects`);
    break;
  }
  default: throw new Error("Usage: release.mjs <infra|knowledge|seed-secret|agent|website|rollback-agent|rollback-website> [record.json]");
}
