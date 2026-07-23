---
phase: 4
plan: 1
requirements: [REV-02]
files: [cadence-core/bin/review-provider.mjs, cadence-core/bin/review-provider.test.mjs, cadence-core/config.schema.json, cadence-core/templates/config.json, cadence-core/references/provider-api.md, cadence-core/references/model-hints.json, .planning/config.json]
---

# Phase 4: DeepSeek cross-model review provider - Plan

> Retroactive plan. This work was built ad-hoc during Phase 3 UAT (to verify
> DEC-02's cross-model panel path, k9, against a real provider) and documented
> here afterward so REV-02 traces requirement -> phase -> plan -> verification.
> The tasks below describe what actually shipped, not a pre-execution design.

## Goal

Cadence can run a live cross-model review through DeepSeek: a dedicated Chat
Completions adapter (not the OpenAI Responses API the openai adapter uses),
registered in config, wire-pinned, model-classified, and tested - so
`review.reviewers` can name `deepseek` and the review subsystem resolves and
calls a real DeepSeek model through the repaired REV-01 seam.

## Must be true when done

- `review-provider.mjs review --provider deepseek --model <id>` returns a
  schema-valid `{ok:true, findings:[...]}` from a live DeepSeek call.
- `review-provider.mjs detect-models --provider deepseek` lists the account's
  model ids, soft-tiered by model-hints.
- `deepseek` is a valid `review.reviewers` entry and `review.providers.deepseek.tiers.*`
  is settable; config validate passes.
- The full test suite, tsc, and self-verify stay green; no CONTRACTS change.

## Tasks

### Task 1: DeepSeek Chat Completions adapter + key resolution + wire docs

- **Files:** cadence-core/bin/review-provider.mjs, cadence-core/references/provider-api.md, cadence-core/references/model-hints.json
- **Action:** Add a `deepseek` adapter to `ADAPTERS` (base `https://api.deepseek.com`, Bearer auth, `POST /chat/completions` with `response_format:{type:'json_object'}` + an in-prompt schema, `reasoning_effort` from the effort dial, `choices[].message.content` extraction, `GET /models` detect). Add `deepseek: 'DEEPSEEK_API_KEY'` to `ENV_VAR`. Update the design-contract comment to record DeepSeek's json_object (no server-side schema) exception. Pin the wire shapes in provider-api.md and add soft tier rules for the v4 families to model-hints.json.
- **Verify:** `detect-models --provider deepseek` against a live key returns tiered model ids; `review --provider deepseek` returns validate-passing findings.

### Task 2: Register deepseek in the config schema and template

- **Files:** cadence-core/config.schema.json, cadence-core/templates/config.json
- **Action:** Add `deepseek` to the `review.reviewers` array_enum values and add `review.providers.deepseek.tiers.{flagship,balanced,cheap}` (string_or_null, null default) to schema + template. No gate/enabled key; selection follows `review.reviewers` like the other providers.
- **Verify:** `config.mjs validate` passes; `config.mjs get review.providers.deepseek.tiers.flagship` returns null by default; self-verify's inert-config-key check passes (the `<name>` prose auto-covers the new keys).

### Task 3: Tests for the adapter and key resolution

- **Files:** cadence-core/bin/review-provider.test.mjs
- **Action:** Add unit tests for `ADAPTERS.deepseek` extractText/extractModels/structuredRequest (json_object + in-prompt schema + reasoning_effort present/absent), a `classify('deepseek', ...)` tier test, and a CLI no-key test naming `DEEPSEEK_API_KEY`; guard `DEEPSEEK_API_KEY` out of the test env.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes; `tsc -p tsconfig.ci.json` clean; `self-verify.mjs` prints `ok:true`.

### Task 4: Wire deepseek into this repo's review path

- **Files:** .planning/config.json
- **Action:** Set `review.reviewers=["claude-subagent","deepseek"]` and `review.providers.deepseek.tiers.flagship=deepseek-v4-pro` (balanced/cheap left null, so DeepSeek co-reviews only at flagship-tier gates).
- **Verify:** a live `review-provider.mjs review --provider deepseek --model deepseek-v4-pro --effort high` returns valid findings, exercising the cross-model panel end to end.

## Notes

- json_object mode (not strict `json_schema`) is DeepSeek's only structured
  mode; the shape is asserted on return by the existing `validateFindings`/
  `validateConsult` guard, so a schema-ignoring response degrades to a
  structured `bad-shape` rather than bad data.
- No `review-provider.mjs` FINDING_SCHEMA change and no self-verify CONTRACTS
  change - the CLI subcommands/flags are unchanged.
