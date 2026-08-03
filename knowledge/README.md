# Dennie knowledge corpus

This directory will contain the reviewed, public-safe Markdown sources built in Phase 2. It is intentionally empty of factual corpus content during Phase 1.

## Planned layout

- `profile.md`, `experience.md`, `education.md`, `skills.md`, and `faq.md`
- `projects/` for one focused document per project
- `metadata/` for source registry and validation data
- Bedrock metadata sidecars next to their corresponding documents

## Maintenance checklist

1. Confirm every fact is approved for public release and resolve conflicts using the authority order in `docs/phase-0-product-requirements.md`.
2. Give each source a stable ID, owner, canonical public URL, topic, visibility, and sensitivity classification.
3. Record `lastReviewedAt`; also record `effectiveDate` for current roles and project status.
4. Keep sections self-contained and avoid duplicating a fact across many documents.
5. Review changes for stale contact, role, education, URL, and availability-adjacent information.
6. Run the evaluation bank before uploading, then upload and synchronize ingestion for the intended environment.
