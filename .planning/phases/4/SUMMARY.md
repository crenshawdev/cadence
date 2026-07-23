---
phase: 4
status: complete
completed: 2026-07-22
---

# Phase 4: DeepSeek cross-model review provider - Summary

A dedicated DeepSeek Chat Completions adapter for `review-provider.mjs` (json_object + in-prompt schema, `reasoning_effort` dial), registered in config, wire-pinned, model-classified, tested, and verified with a live cross-model review through the repaired REV-01 seam.

## What shipped

- DeepSeek adapter - `ADAPTERS.deepseek` in `cadence-core/bin/review-provider.mjs`: `POST /chat/completions`, Bearer auth, `response_format:{type:'json_object'}` with the finding schema injected into the system prompt, `reasoning_effort` from the effort dial, `choices[].message.content` extraction, `GET /models` detect. `ENV_VAR` gains `deepseek: 'DEEPSEEK_API_KEY'`; the design-contract comment records the json_object (no server-side schema) exception.
- Config registration - `deepseek` added to the `review.reviewers` enum and `review.providers.deepseek.tiers.{flagship,balanced,cheap}` in `cadence-core/config.schema.json` + `cadence-core/templates/config.json`.
- Wire + hints - DeepSeek section in `cadence-core/references/provider-api.md`; v4-family soft tier rules in `cadence-core/references/model-hints.json`.
- Tests - adapter extractText/extractModels/structuredRequest, `classify('deepseek')`, and a no-key CLI test in `cadence-core/bin/review-provider.test.mjs`.
- Repo wiring - `.planning/config.json`: `review.reviewers=["claude-subagent","deepseek"]`, `review.providers.deepseek.tiers.flagship=deepseek-v4-pro` (balanced/cheap null).

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1-3 | 09ef378 | DeepSeek adapter + config schema/template + wire-pin + model-hints + tests |
| 1 | 4 | 4a8c888 | Wire deepseek into the repo review panel at flagship tier |

## Deviations

- [deviation] This phase was built ad-hoc during Phase 3 UAT to verify DEC-02's cross-model panel path (k9) against a real provider, then documented retroactively (requirement REV-02, this roadmap phase, and this plan) so it traces cleanly for the milestone audit. The code, tests, and live verification are real; the PLAN.md reconstructs the executed tasks rather than pre-dating them.

## Open items

- `review.providers.deepseek.tiers.{balanced,cheap}` are unset, so DeepSeek fires only at flagship-tier gates (plan, risk_surface, pre_ship, decision_review). Assign them via `/cad-config` if DeepSeek should also cover balanced/cheap-tier reviews (e.g. the diff trigger).

## Goal check

The sum of the two commits delivers REV-02, proven by a live run rather than asserted. `detect-models --provider deepseek` returned `deepseek-v4-pro` (flagship) and `deepseek-v4-flash` (balanced), correctly tiered by the new model-hints rules and with the key pulled from `$DEEPSEEK_API_KEY` and never printed. `review-provider.mjs review --provider deepseek --model deepseek-v4-pro --effort high` returned `{ok:true, provider:"deepseek", model:"deepseek-v4-pro", findings:[3]}` where all three findings passed `validateFindings()` - so the adapter's `/chat/completions` request (json_object + in-prompt schema + `reasoning_effort:high`) and `choices[].message.content` extraction work against the live API. The full bar is green: `node --test cadence-core/bin/*.test.mjs` 253/253, `tsc -p tsconfig.ci.json` clean, `self-verify.mjs` `ok:true` (the new provider keys auto-covered by the `<name>` prose in the inert-key check), `config.mjs validate` clean. No FINDING_SCHEMA or self-verify CONTRACTS change - the CLI surface is unchanged. What is not independently machine-checked: the cross-model panel's downstream adjudication is exercised by the DEC-02 skill (verified in Phase 3 k9), not re-run here.
