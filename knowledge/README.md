# Dennie knowledge corpus

This directory contains focused Markdown sources for Dennie's Bedrock Knowledge Base. Only files listed in `metadata/source-registry.json` are eligible for upload.

## Layout

- Profile, education, experience, skills, leadership, and hobby documents at the directory root.
- `projects/` contains one focused document per approved project.
- `metadata/source-registry.json` is the authoritative source registry and provenance map.
- Every ingestible Markdown document has a neighboring `file.md.metadata.json` sidecar in Amazon Bedrock's S3 metadata format.

## Validation and approval

Run structural and evaluation-source coverage checks with:

```bash
npm run knowledge:validate
```

All new or changed sources begin as `pending-owner-review`. The upload command requires every registered source to be `approved`, so a draft cannot be uploaded accidentally. Review instructions are in `docs/phase-2-owner-review.md`.

The upload command also compares managed `.md` and `.md.metadata.json` objects under the configured S3 prefix with the source registry. It reports obsolete objects and stops before uploading by default. After reviewing the reported keys, explicitly remove them with:

```bash
npm run knowledge:upload -- --delete-obsolete
```

After source review, run the complete validation, upload, and Bedrock ingestion workflow with:

```bash
npm run knowledge:ingest
```

## Maintenance checklist

1. Confirm every fact is approved for public release and resolve conflicts using the authority order in `docs/phase-0-product-requirements.md`.
2. Give each source a stable ID, owner, canonical public URL, topic, visibility, and sensitivity classification.
3. Record `lastReviewedAt`; also record `effectiveDate` for current roles and project status.
4. Keep sections self-contained and avoid duplicating a fact across many documents.
5. Review changes for stale contact, role, education, URL, and availability-adjacent information.
6. Set `reviewStatus` to `approved` in the registry and matching sidecar only after Dan explicitly approves the content.
7. Run the evaluation bank before uploading, then upload and synchronize ingestion for the intended environment.
