PLAN COMPLETE
Plan: .planning/phases/3/PLAN-1.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1: The rung ladder has one statement, beside the map it orders | 34de9d68 | `RUNG_ORDER` + `rungOrderIssues` exported from `lib/rung-agent.mjs`; `effortEnumIssues` signature unchanged; every `route-table` mention gone from the lib (grep 0). Test file reads the export instead of `route-table.json`. Verify: 52/52 pass, export prints the five rungs, self-verify `ok:true`, `npx tsc -p tsconfig.ci.json` clean. |
| 2: Review gates, tiers and efforts carry real defaults | b275c82a | Twelve schema rows off the `null` sentinel onto the `solo` row's values; purposes re-stated as ``Defaults to `<value>` ``. `gateAgreementIssues(schemaKeys)` now takes the schema alone and walks gate+tier+effort; `gate-default-drift`/`gate-grid-missing` retired. self-verify calls it outside the route-table block. `config.mjs` `LEVEL_KEY`/`LEVEL_KEY_NOUN`/level warning deleted. Verify: scratch `get` answers `advisory`/`cheap`/`low` with no `warnings`; gate-agreement 26/26, config 102/102, self-verify 181/181, prose-agreement 74/74; self-verify `ok:true`; tree copies seeded with `"adivsory"` and with `null` each report `gate-default-invalid` naming `review.triggers.plan.gate`; tsc clean. |
| 3: Gates, tiers, efforts and the deep-verify switch answer from the schema | 6d55fdfc | Written by the prior (checkpointed) executor and committed here after the approved lease addition unblocked it. `route.mjs` reads `config.schema.json` beside `HERE` (`CADENCE_CONFIG_SCHEMA` gated on `testSeamOpen()`, unreadable is `fail('bad-schema', ...)`); `review`/`reviewer_tiers`/`reviewer_efforts` resolve off the schema rows via `gateTriggers`; `DEFAULT_GATES`, `DEFAULT_TIER_NAMES`, `DEFAULT_EFFORT_NAMES`, `UNSET_FLOOR`, `RAISE_TARGET`, `stakesOrder`, `higherLevel` deleted; `levelFor` -> `floorFor` returning `{raised, surface, signal, file, bytes}`; the two floor effects applied at one site; the D-08 rung clamp and its warning deleted; `replay`, `parseReplayArgs`, the `SYNOPSIS` arm, the dispatch arm and the `CONTRACTS['route.mjs']` row deleted. Added this dispatch: the `route.mjs replay` paragraph deleted from `references/seam-spawn-agent.md` (the lease addition), plus the two now-orphaned `replay` comments in `route.mjs` (the `bytes` doc block and the waiver-vocabulary block). Verify: route 187/187; `route.mjs replay` -> `{"ok":false,"reason":"usage"}`; prose-agreement + config-seams 90/90; self-verify `ok:true` with an empty `problems` list; tsc clean. |
| 4: Model and effort come from the roles block and the schema; the cells, the alias list and the level leave the resolver | 1f4436b9 | Six `roles.<role>.effort` defaults set to the `solo` row (planner/analyzer/verifier/executor `high`, reviewer `medium`, plan-checker `low`); six `model.overrides.<role>` rows off the alias enum onto `string_or_null`; twelve purposes rewritten as the narrower-fallback pair. `route.mjs`: start rung is the first of three sources naming a FILED rung (roles, then `model.effort`, then the schema default), a losing source warns and the next answers, none answering is `unresolved`; model is `roles.<role>.model` then `model.overrides.<role>` then `null`, judged against a frozen `HOST_MODELS` (opus, sonnet, haiku, fable, verified 2026-09-04) with a rejected string resolving `model: null` + `model_source: "session"` + a warning; escalation is one rung up `RUNG_ORDER`, holding at the top; `stakes`/`stakesSet`/`DEFAULTS.stakes` out of `readConfig`, `stakes`/`stakes_set` off the envelope, the trace event drops `stakes` and gains `model_source`. `effortEnumIssues` files `effort-default-invalid` on the roles spelling only. Verify: route 150/150 (no-config `cad-executor` -> `model:null`/`session`/`high`/`cad-executor` with no `stakes` key; `notamodel` -> `ok:true`, `model:null`, warning naming it; trace event carries `model_source` and no `stakes`; `--attempt 2` high->xhigh escalated, `max` holds); rung-agent 55/55 including the null-default case; `test.mjs routing` 469/469; self-verify `ok:true`, 0 problems; tsc clean. |
| 5: The run record's consumers stop naming a level, and the suggest ladders stop reading the table | b9e2f86f | `planning/trace.mjs`'s `suggestResolution` drops the `e.stakes` read and the `stakes` field it returned; `lib/trace-suggest.mjs`'s `Resolution` typedef loses `stakes` and `unsetCurrent()` takes no argument, answering `unset: no config layer pins this, so the schema default decides it`. `SUGGEST_KEY_DEFAULTS` untouched. `routeLadder` reads `config.schema.json` beside `HERE` through an explicit key->row map (`gates` -> `review.triggers.plan.gate`, `risk_surface_categories` -> `review.triggers.risk_surface.surfaces`) with `rung_order` -> `RUNG_ORDER`; the degraded arm and the no-env-override rule are unchanged. Verify: `test.mjs planning` 1168/1168; `git grep -nw stakes` over the four files prints nothing; `grep -c route-table planning/core.mjs` prints 0; self-verify `ok:true`; tsc clean. |
| 6: route.mjs reads no table | 76e2b20f | Written by the prior (checkpointed) executor and committed here after the approved lease addition unblocked it. `route.mjs`: `TABLE`, `TABLE_PATH`, the `CADENCE_ROUTE_TABLE` seam, the `bad-table` failure and the `table` subcommand deleted; `riskCategories` is `schemaValues('review.triggers.risk_surface.surfaces')`; usage detail is `subcommand: resolve`. `lib/arg-contract.mjs`: the `table` row under `CONTRACTS['route.mjs']` deleted. `lib/test-seam.mjs`: two redirected ground-truth files named, not three. `route.test.mjs`: `opts.table` plumbing gone, the `#40` section re-keyed onto `config.schema.json` (absent AND malformed both answer `bad-schema` with a hint naming the file), the `EXP-01` gate re-keyed onto `CADENCE_CONFIG_SCHEMA`, `SHIPPED_TABLE` deleted and the frontmatter walk re-keyed onto `RUNG_FILES` (30 stems, up from 19), the two `table` dump tests deleted. `trace-suggest.test.mjs`: the `SGT-01` unset assertion re-keyed off `/shipped/`. Added this dispatch: `reason-census.test.mjs` drops its `'bad-table'` entry (the approved lease addition), and one ragged comment wrap in `route.mjs` reflowed. Verify: route 147/147; `git grep -n "route-table\|CADENCE_ROUTE_TABLE\|\bTABLE\b" cadence-core/bin/route.mjs` prints nothing (exit 1); with `cadence-core/route-table.json` moved out of the tree `resolve --role cad-executor` returns `ok:true` (restored, unmodified); reason-census 5/5; `node cadence-core/bin/test.mjs` 3811/3811; tsc clean; self-verify `ok:true`. |
Deviations:

[deviation] CONTEXT D-14 asserts "`route.mjs replay` has no prose caller"; its
evidence only searched for a "workflow or SKILL invocation" and never covered
`references/`, and `cadence-core/references/seam-spawn-agent.md:251` named the
subcommand in prose. self-verify check 2 reads every prose site spelling
`route.mjs <subcommand>` and requires a matching `CONTRACTS['route.mjs']` row
(`self-verify.mjs:657-667`), so deleting the `replay` row made that line report
`{"kind":"unknown-subcommand",...}` and Task 3's `Verify:` could not be met
inside the original lease. The prior executor checkpointed; the structural
request was APPROVED, `references/seam-spawn-agent.md` was added to PLAN-1's
`files:`, and the paragraph is deleted in `6d55fdfc`. D-14 is refuted as
written and the coordinator annotates CONTEXT.md.

[deviation] Task 5's Action names two ladders for `routeLadder` (gates, rungs);
`planning/risk-check.mjs:50` calls it with a THIRD key,
`risk_surface_categories`. A first cut that treated every non-`rung_order` key
as the gate ladder handed risk-check `[off, advisory, deferred, blocking,
adjudicated]` as its surface vocabulary and 14 `planning-adjudication.test.mjs`
cases turned into `surfaces-unanswered` refusals. Closed inside the plan's
lease with an explicit key->row map in `core.mjs`; the third ladder now reads
`review.triggers.risk_surface.surfaces`, whose `values` are byte-identical to
the table's `risk_surface_categories` and to `lib/surface-scan.mjs`'s
`CATEGORIES`, so nothing observable moved. `risk-check.mjs` is not in this
plan's `files:` and needed no edit, but its `surfaceVocabulary` doc comment
still says "the risk-surface vocabulary `route-table.json` states" - see Open
items.

[deviation] Task 6's `Verify:` ends "then the whole tree:
`node cadence-core/bin/test.mjs` passes", and it could not be met inside the
plan's ORIGINAL lease. The Action requires deleting the `bad-table` failure
from `route.mjs`; `cadence-core/bin/reason-census.test.mjs:104` carried
`'bad-table'` in its hand-maintained `REASON_TOKENS` list, and its own refusal
message says the fix is "it was deliberately removed, in which case delete its
entry here in the same commit". Two cases failed on it - `every committed
refusal token is still produced by the live tree` and `the census is
ONE-DIRECTIONAL` - and they were the only two red in the tree (3809 of 3811).
The prior executor checkpointed rather than commit a task whose stated
verification failed; the structural request was APPROVED,
`cadence-core/bin/reason-census.test.mjs` was added to PLAN-1's `files:`, and
the entry is deleted in `76e2b20f` alongside the `route.mjs` failure it named.
The tree is 3811/3811 at that commit.

Open items:

- `cadence-core/references/seam-spawn-agent.md:239-249` is also false after
  Task 3 - the waiver "lowers to the configured `stakes`", and "A raise floors
  the RUNG too: a configured `model.effort` rung below the floored cell's rung
  does not apply". Left for PLAN-3, which declares the file and owns the prose
  sweep; only the `replay` paragraph was in this dispatch's approved scope.
- D-14 also names `replay` comments in `lib/phase-plans.mjs:19,256`,
  `lib/why-corpus.mjs:212` and `lib/task-record.mjs:44`. None is in PLAN-1's
  lease; all four files are declared by PLAN-3.
- `cadence-core/bin/planning/risk-check.mjs:34-46` documents `surfaceVocabulary`
  as reading `route-table.json`, which is false after task 5. The file is in no
  PLAN-1 task's `files:` list; PLAN-2 declares neither, PLAN-3 declares
  `lib/surface-scan.mjs` but not `planning/risk-check.mjs`. Whoever sweeps the
  `route-table.json` prose needs this comment on the list.
- No lint command exists for this project: `planning.mjs detect-commands
  --root /code/cadence` answers `lint: null`, `typecheck: "npx tsc -p
  tsconfig.ci.json"`. The typecheck ran clean before every commit; there was no
  lint to run.

Notes on this continuation dispatch:

- Tasks 1-5 were already committed and were not re-run. Task 6's in-lease work
  was on disk from the prior executor, was checked against the plan's Action
  line by line before anything was added to it, and needed no rework.
- The full suite ran ONCE, as task 6's own `Verify:` line, on byte-identical
  content to what `76e2b20f` carries (`git status --short` showed no source
  drift between the run and the commit). That green run is what this file's
  `PLAN COMPLETE` rests on.
- The prior run's report was rotated to
  `.planning/phases/3/reports/plan-1.2.md` before this file was written
  (`plan-1.1.md` was already there from an earlier rotation).
