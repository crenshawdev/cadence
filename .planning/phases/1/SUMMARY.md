---
phase: 1
status: complete
completed: 2026-07-24
---

# Phase 1: Silent data-file failures - Summary

Malformed or absent data/config files are now surfaced (`{ok:false}` degrade or additive `warnings[]`) across the four flagged seams instead of being silently swallowed into defaults, with a failing-capable regression test per finding.

## What shipped

- Guarded route-table / config-schema loads - `cadence-core/bin/route.mjs`, `cadence-core/bin/config.mjs`: the module-top `route-table.json` / `config.schema.json` reads moved behind the dispatch `try`, so a bad or absent shipped file degrades to `{ok:false, reason:'bad-table'|'bad-schema', detail}` (one JSON line, no stack) instead of a module-load throw. Env-path seams `CADENCE_ROUTE_TABLE` / `CADENCE_CONFIG_SCHEMA` inject fixtures hermetically. (#40)
- `warnings[]` on config-layer merge - `cadence-core/bin/lib/config-merge.mjs` (new exported `readLayer`, `mergeLayers` gains a third `warnings` field) + `config.mjs get`: a malformed global/repo layer is skipped and named in `warnings[]` while `values`/`source` stay byte-identical to the absent case; a merely-absent layer stays silent. (#39)
- `warnings[]` on model-hints load - `cadence-core/bin/review-provider.mjs` (extracted `readModelHints`, pure `detectEnvelope` builder): a malformed `model-hints.json` surfaces a warning in the detect envelope while `classify` still returns candidates with the exclude filter intact (fail-safe); absent and valid-ruleless files stay silent. (#43)
- self-verify full-tree gate - `cadence-core/bin/self-verify.mjs`: keyed on `.claude-plugin/plugin.json` as the real-install marker, a missing always-expected input (a core surface dir, `weight-budgets.json`, `INTERNALS.md`) now exits `ok:false` naming it on a full tree, while a minimal `--root` fixture stays `ok:true`. (#44)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 70742b5 | Relocate route-table / config-schema loads behind the dispatch guard (#40) |
| 1 | 2 | 2001e32 | Surface a malformed config layer via warnings[] in the merge lib (#39) |
| 1 | 3 | 8d94836 | Surface a malformed model-hints load via warnings[] (#43) |
| 1 | 4 | c900e02 | Gate self-verify on missing always-expected inputs (#44) |
| 1 | 5 | (none) | Full-suite + type-check integration gate - verification-only, no diff |

## Deviations

None - plans executed as written. Every prediction-then-verify check matched expected output.

## Open items

- The `warnings[]` merge mechanism (#39) is consumed only by `config.mjs get`; the other six `mergeLayers` callers (`route.mjs` `readConfig`, `git-guard.mjs`, `land-cleanup.mjs`, `planning.mjs`, ...) still silently drop a malformed repo/global config layer and fall to defaults with no diagnostic. Deliberate per Task 2's "do not touch them" and #39's AC scope (surfacing on the `config.mjs get` inspection path only), but it means malformed *user* config is surfaced on inspection, not on the routing/guard consumption paths. (diff review: `route.mjs:47`, `git-guard.mjs:126`)
- `git-guard.mjs` fail-open: a malformed `.planning/config.json` reverts to the default `protected_branches` with no diagnostic - a known v1.2.0 by-design holdout, restated by the diff review; left as-is.
- `self-verify.mjs` full-tree gate keys on `.claude-plugin/plugin.json`; a real install missing exactly that marker disengages every always-expected-input check and stays green. Inherent to the D-03 marker choice and low practical risk (a plugin without its manifest does not load in Claude Code). (diff review: `self-verify.mjs:154`)

## Goal check

The four commits plausibly deliver the phase goal: an absent or malformed data/config file is surfaced rather than silently swallowed, and the degraded seams return `{ok:false}`/`warnings[]` rather than crashing. Evidence, run directly against HEAD (`c900e02`): `CADENCE_ROUTE_TABLE=/nonexistent route.mjs table` -> `{"ok":false,"reason":"bad-table",...}` and `CADENCE_CONFIG_SCHEMA=/nonexistent config.mjs keys` -> `{"ok":false,"reason":"bad-schema",...}`, both one JSON line with no stack (#40); `config.mjs get --file <torn-json>` -> `ok:true, source:"global"` plus a `warnings[]` naming the file, versus `--file <absent>` -> identical `values`/`source` with no `warnings` (#39, distinguishable); the full bin suite is `tests 266 / pass 266 / fail 0` and `tsc -p tsconfig.ci.json` exits 0 (integration gate). #43 is proved at the envelope level by the hermetic `detectEnvelope`/`readModelHints` tests (malformed -> warning, valid-ruleless and absent -> none) since `detect-models` needs a live key; #44 by the full-fixture missing-input tests plus the real repo passing self-verification. The one honest gap, recorded above, is that #39's warning surfacing stops at `config.mjs get`; a malformed user config remains silent on the routing and git-guard paths by plan scope. The shipped-data-file failure class the phase targeted (#40 route-table/schema, #43 hints, #44 inputs) is closed.
