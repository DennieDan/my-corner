import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const knowledgeDirectory = path.join(repositoryDirectory, "knowledge");
export const registryPath = path.join(
  knowledgeDirectory,
  "metadata/source-registry.json",
);

type ReviewStatus = "pending-owner-review" | "approved";

export interface RegistrySource {
  sourceId: string;
  aliases: string[];
  path: string;
  title: string;
  canonicalUrl: string;
  topic: string;
  owner: string;
  lastReviewedAt: string;
  visibility: "public";
  sensitivity: "public-safe";
  reviewStatus: ReviewStatus;
  provenance: string[];
}

interface SourceRegistry {
  schemaVersion: number;
  sources: RegistrySource[];
}

interface MetadataAttribute {
  value?: {
    type?: string;
    stringValue?: string;
    stringListValue?: string[];
  };
  includeForEmbedding?: boolean;
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(
  value: unknown,
  label: string,
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item === "")
  ) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
}

export async function loadAndValidateKnowledge(
  options: { requireApproved?: boolean } = {},
) {
  const raw = JSON.parse(
    await readFile(registryPath, "utf8"),
  ) as Partial<SourceRegistry>;
  if (
    raw.schemaVersion !== 1 ||
    !Array.isArray(raw.sources) ||
    raw.sources.length === 0
  ) {
    throw new Error(
      "source-registry.json must use schemaVersion 1 and contain sources",
    );
  }

  const sourceIds = new Set<string>();
  const paths = new Set<string>();
  const knownAliases = new Set<string>();

  for (const [index, source] of raw.sources.entries()) {
    const label = `sources[${index}]`;
    assertString(source.sourceId, `${label}.sourceId`);
    assertStringArray(source.aliases, `${label}.aliases`);
    assertString(source.path, `${label}.path`);
    assertString(source.title, `${label}.title`);
    assertString(source.canonicalUrl, `${label}.canonicalUrl`);
    assertString(source.topic, `${label}.topic`);
    assertString(source.owner, `${label}.owner`);
    assertString(source.lastReviewedAt, `${label}.lastReviewedAt`);
    assertStringArray(source.provenance, `${label}.provenance`);

    if (
      source.visibility !== "public" ||
      source.sensitivity !== "public-safe"
    ) {
      throw new Error(`${label} must be public and public-safe`);
    }
    if (
      source.reviewStatus !== "pending-owner-review" &&
      source.reviewStatus !== "approved"
    ) {
      throw new Error(`${label}.reviewStatus is invalid`);
    }
    if (options.requireApproved && source.reviewStatus !== "approved") {
      throw new Error(`${source.sourceId} is not approved for ingestion`);
    }
    if (sourceIds.has(source.sourceId) || paths.has(source.path)) {
      throw new Error(`Duplicate sourceId or path: ${source.sourceId}`);
    }
    sourceIds.add(source.sourceId);
    paths.add(source.path);
    knownAliases.add(source.sourceId);
    source.aliases.forEach((alias) => knownAliases.add(alias));

    const documentPath = path.join(knowledgeDirectory, source.path);
    const metadataPath = `${documentPath}.metadata.json`;
    await access(documentPath);
    await access(metadataPath);

    const document = await readFile(documentPath, "utf8");
    for (const expected of [
      source.sourceId,
      source.title,
      source.canonicalUrl,
      source.lastReviewedAt,
    ]) {
      if (!document.includes(expected)) {
        throw new Error(
          `${source.path} does not contain required value: ${expected}`,
        );
      }
    }

    if ((await stat(metadataPath)).size > 1024) {
      throw new Error(
        `${source.path}.metadata.json exceeds Bedrock's 1 KB limit`,
      );
    }
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
      metadataAttributes?: Record<string, MetadataAttribute>;
    };
    const attributes = metadata.metadataAttributes;
    if (!attributes || typeof attributes !== "object") {
      throw new Error(`${source.path}.metadata.json has no metadataAttributes`);
    }
    for (const key of [
      "sourceId",
      "aliases",
      "title",
      "canonicalUrl",
      "topic",
      "owner",
      "lastReviewedAt",
      "visibility",
      "sensitivity",
      "reviewStatus",
    ]) {
      if (!(key in attributes)) {
        throw new Error(`${source.path}.metadata.json is missing ${key}`);
      }
    }
    if (Object.keys(attributes).length > 50) {
      throw new Error(`${source.path}.metadata.json exceeds 50 attributes`);
    }

    const expectedStrings: Record<string, string> = {
      sourceId: source.sourceId,
      title: source.title,
      canonicalUrl: source.canonicalUrl,
      topic: source.topic,
      owner: source.owner,
      lastReviewedAt: source.lastReviewedAt,
      visibility: source.visibility,
      sensitivity: source.sensitivity,
      reviewStatus: source.reviewStatus,
    };
    for (const [key, expected] of Object.entries(expectedStrings)) {
      const attribute = attributes[key];
      if (
        attribute.value?.type !== "STRING" ||
        attribute.value.stringValue !== expected
      ) {
        throw new Error(
          `${source.path}.metadata.json ${key} does not match the registry`,
        );
      }
    }
    const aliases = attributes.aliases;
    if (
      aliases.value?.type !== "STRING_LIST" ||
      JSON.stringify(aliases.value.stringListValue) !==
        JSON.stringify(source.aliases)
    ) {
      throw new Error(
        `${source.path}.metadata.json aliases do not match the registry`,
      );
    }
  }

  const questionsPath = path.join(
    repositoryDirectory,
    "evaluations/questions.jsonl",
  );
  const questions = (await readFile(questionsPath, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as {
      id: string;
      sourceHints?: string[];
      sourceHintGroups?: string[][];
    });
  for (const question of questions) {
    if (question.sourceHints !== undefined && question.sourceHintGroups !== undefined) {
      throw new Error(
        `Evaluation question ${question.id} cannot use both sourceHints and sourceHintGroups`,
      );
    }
    if (question.sourceHints !== undefined) {
      assertStringArray(question.sourceHints, `${question.id}.sourceHints`);
    }
    if (question.sourceHintGroups !== undefined) {
      if (!Array.isArray(question.sourceHintGroups) || question.sourceHintGroups.length === 0) {
        throw new Error(`${question.id}.sourceHintGroups must be a non-empty array`);
      }
      question.sourceHintGroups.forEach((group, groupIndex) =>
        assertStringArray(group, `${question.id}.sourceHintGroups[${groupIndex}]`)
      );
      if (question.sourceHintGroups.some((group) => group.length === 0)) {
        throw new Error(`${question.id}.sourceHintGroups cannot contain an empty group`);
      }
    }
  }
  const missingAliases = questions.flatMap((question) =>
    (question.sourceHintGroups?.flat() ?? question.sourceHints ?? [])
      .filter((hint) => !knownAliases.has(hint))
      .map((hint) => `${question.id}: ${hint}`),
  );
  if (missingAliases.length > 0) {
    throw new Error(
      `Evaluation source hints without corpus coverage:\n${missingAliases.join("\n")}`,
    );
  }

  return raw.sources;
}
