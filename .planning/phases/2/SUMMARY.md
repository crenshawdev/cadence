---
phase: 2
status: complete
completed: 2026-09-05
---

# Phase 2: Routing resolves from the roles block - Summary

Twelve `roles.<role>.{model, effort}` config keys now decide a dispatch's model
and start rung directly, with the `stakes` matrix, `model.effort.<role>` and
`model.overrides.<role>` still answering per key wherever the roles block is
silent.

## What shipped

- Twelve settable `roles.<role>.{model, effort}` keys - `cadence-core/config.schema.json:26-38`, with matching reach rows in `cadence-core/references/config-reach.md`
- The effort drift guard walking both spellings - `effortEnumIssues` in `cadence-core/bin/lib/rung-agent.mjs`, exporting `ROLES_PREFIX`/`ROLES_EFFORT_SUFFIX`
- Start-rung resolution off the roles block - `readConfig.roles` and `roleEntryIn` in `cadence-core/bin/route.mjs:1047-1058`, with the deciding key interpolated into all four rung arms
- Model resolution plus a `model_source` field naming the key that decided (`roles.<role>.model` / `model.overrides.<role>` / `cell`) - `cadence-core/bin/route.mjs:1404-1445`
- Eighteen stakes-only fallback cases, one per (level, role) cell - `cadence-core/bin/route.test.mjs`
- A **Per-role model** bullet in `cadence-core/references/seam-spawn-agent.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | a504d234 | Land the twelve roles keys as config surface: 12 schema keys, 12 reach rows, a `<role>` placeholder in self-verify's `expand`, budgets re-pinned for the two grown reference docs |
| 1 | 2 | 761a5c3f | Extend the effort drift guard to the roles spelling; `roles.<role>.model` deliberately unclassified |
| 1 | 3 | 7f3c1db9 | Resolve the start rung from the roles block, the older key as fallback; clamp terms unchanged |
| 1 | 4 | eff12f2c | Resolve the model and name its source; a rejected roles string never falls through to the pin |
| 1 | 5 | b9b4ca82 | Pin the stakes-only fallback across all eighteen cells, mutation-checked on shipped/cad-verifier |

## Deviations

- [deviation] Task 1 predicted `node --test cadence-core/bin/self-verify.test.mjs` green after the new case; observed the pre-existing "placeholder keys expand" case at `:345` failing, because its fixture prose must name every schema family and the twelve new keys had no token in it. Added `roles.<role>.model` / `roles.<role>.effort` to that fixture and corrected its comment, which claimed `expand()` carries no `<role>` placeholder. Commit a504d234.

## Open items

- The pin-conflict warning at `cadence-core/bin/route.mjs:1401` says `roles.<role>.model` "decides this role's model" before the alias is validated, so on a rejected alias it names a key that did not decide the resulting model - the cell's model stands and `model_source` reports `cell`. Confirmed and not fixed: the very next warning names the rejected string and `reason` says the cell stands, so the picture is corrected one line later. Raised `low` by the `diff` review and recorded as `survived` in `.planning/phases/2/ADJUDICATION-diff-plan-1.json`.

## Goal check

The five commits plausibly deliver the phase goal. The additive half is present
and reachable: `cadence-core/config.schema.json:26-38` carries all twelve keys
as settable surface, and `cadence-core/bin/route.mjs:1047-1058` and `:1404-1445`
read them, with `model_source` always present in the envelope. The fallback half
is the one that could have been stranded and was not - `b9b4ca82` pins all
eighteen (level, role) cells against a fixture carrying no `roles` key, and a
live `route.mjs resolve --role cad-executor --phase 2 --plan 1` during this run
returned `model_source` absent from the roles path with `reason` naming
`model.effort.cad-executor="xhigh"`, which is the older key answering exactly as
before. Whole-suite evidence: `node cadence-core/bin/test.mjs` 3845 pass 0 fail,
`npx tsc -p tsconfig.ci.json` clean, `node cadence-core/bin/self-verify.mjs`
`ok:true` with zero problems, its checked list including `effort-enums`. Nothing
in the phase goal looks missing. Two review gates fired on the committed range
and both passed: `risk_surface` raised 2 and both were refuted against D-09's
per-key fallback rule, `diff` raised 2 with the `high` one refuted against the
five cad-planner rung files phase 1 shipped, leaving one `low` survivor recorded
as an open item above.
