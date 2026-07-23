---
phase: 3
status: complete
completed: 2026-07-22
---

# Phase 3: Decision rigor - Summary

Durable-decision recall + on-demand `/cad-decision-review`: cad-context now splits confirmed decisions into a `## Durable decisions` section (recall-indexed) and a phase-local `## Decisions` section, and a new refute-then-adjudicate skill grounds one decision doc against Context7 and the codebase.

## What shipped

- Durable-first recall parser - `parseContextDecisions` reads `## Durable decisions` first, falls back to `## Decisions` only when that heading is absent (`sectionBody(...) === null`, never `!durable`/`||`) - `cadence-core/bin/lib/planning-files.mjs`, four new tests in `cadence-core/bin/planning.test.mjs`.
- Durability filter + heading split in cad-context - three-part filter prose (hard-to-reverse, surprising-without-context, real trade-off) in `confirm_decisions`; the CONTEXT.md template writes `## Durable decisions` + `## Decisions` with one continuous D-NN sequence - `cadence-core/workflows/context.md` (budget bumped 14312 -> 15701).
- `review.decision_review.{tier,effort}` config group (flagship/high defaults) + the on-demand refute-then-adjudicate procedure - `cadence-core/config.schema.json`, `cadence-core/templates/config.json`, `cadence-core/workflows/decision-review.md` (8016 B, budgeted).
- `/cad-decision-review <path>` skill (Context7 MCP tools declared on the skill surface, D-08) + its budget entry + a COMMANDS.md row - `skills/cad-decision-review/SKILL.md`, `cadence-core/bin/weight-budgets.json`, `cadence-core/references/COMMANDS.md`.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 5c74e5d | Retarget recall's decision parser to `## Durable decisions` with a null-only legacy `## Decisions` fallback + four tests |
| 1 | 2 | c10682e | Add the durability filter and durable/phase-local heading split to cad-context; bump context.md budget |
| 1 | 3 | 645c4e1 | Add the `review.decision_review` config group and the decision-review workflow |
| 1 | 4 | 7c6e7ed | Add the cad-decision-review skill, its budget entry, and a COMMANDS.md row |
| 1 | 5 | (none) | Verification-only: full green bar + human-verify staging |

## Deviations

- [deviation] Task 1 - the originally-specified empty-durable test (`durableDecisions: []` via `makeTree`'s default section ordering) did not actually distinguish the `=== null` fix from a naive `!durable`/`||` bug: `sectionBody` returns a literal `""` only when the durable heading is the last content in the file; any trailing `## Decisions` leaves a truthy residual `"\n"`. Fixed by hand-constructing that one CONTEXT.md (Decisions first, empty Durable decisions last) to reach the genuine `""` case, then confirmed by patching the parser to the naive `||` form and observing only that test fail (commit 5c74e5d).
- [deviation] Task 4 - `self-verify.test.mjs`'s placeholder-key-expansion test hardcodes an enumeration of every schema key; Task 3's two new `review.decision_review.*` keys were absent, so it failed after the schema addition. Added the two keys to that fixture list - `cadence-core/bin/self-verify.test.mjs` (commit 7c6e7ed).

## Open items

- Human-verify (staged, routed to CAPTURE): a live `/cad-decision-review <path>` run on a symlinked install showing a per-objection `survives | partial | refuted` ruling plus a concrete amendment list naming the providers/models/effort that ran.
- Human-verify: during that run, the adjudicator citing >=1 Context7-verified library/API claim and >=1 codebase-verified claim.
- Human-verify: with a cross-model provider key configured, the panel running through the REV-01 review seam with the model resolved from `review.decision_review.{tier,effort}`, versus single-model `claude-subagent` when none is configured.

## Goal check

The four commits deliver the phase goal's machine-checkable surface in full, and the three inherently-live behaviors are correctly staged for human UAT rather than claimed. The recall retargeting (5c74e5d) and its four tests pass as part of `node --test cadence-core/bin/*.test.mjs` (249/249), including the empty-durable falsification test that fails against a `!durable`/`||` implementation and passes only against `=== null` - the exact D-02 regression the plan review flagged. The cad-context split (c10682e) writes both headings with the budget reconciled (`context.md` 15701 B == its weight-budgets.json entry; `self-verify.mjs` -> `"ok":true`). The config group and workflow (645c4e1) validate (`config.mjs validate` clean, `get review.decision_review.tier` -> `flagship`) and every key/seam the workflow references was independently confirmed to exist by the advisory diff review (`review.reviewers[]`, `review.providers.<name>.tiers`, `review.key_file`, and the `review-provider.mjs review` stdin invocation). The skill, its budget, and the COMMANDS.md row (7c6e7ed) pass the drift/budget linter and `self-verify.test.mjs`. `tsc -p tsconfig.ci.json` is clean and `grep` confirms no `decision_review` row in `review-triggers.md`'s wiring table, so the skill fires only on explicit invocation (D-11). What is NOT machine-provable here, by design: that a live `/cad-decision-review` run actually emits the per-objection ruling, that the adjudicator's Context7 + codebase grounding fires, and that the cross-model panel resolves through `review.decision_review.{tier,effort}` - these need a real run on a symlinked install and are carried as open items to /cad-verify 3.
