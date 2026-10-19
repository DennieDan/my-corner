import { loadAndValidateKnowledge } from "./knowledge-manifest.js";

const requireApproved = process.argv.includes("--require-approved");
const sources = await loadAndValidateKnowledge({ requireApproved });
const pending = sources.filter((source) => source.reviewStatus !== "approved");

console.log(`Validated ${sources.length} knowledge sources.`);
if (pending.length > 0) {
  console.log(`${pending.length} sources are pending owner review.`);
} else {
  console.log("All sources are approved for ingestion.");
}
