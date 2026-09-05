PLAN CHECKPOINT: structural
Plan: .planning/phases/3/PLAN-1.md
Tasks: 2 of 6
| Task | Commit | Note |
|---|---|---|
| 1: The rung ladder has one statement, beside the map it orders | 34de9d68 | `RUNG_ORDER` + `rungOrderIssues` exported from `lib/rung-agent.mjs`; `effortEnumIssues` signature unchanged; every `route-table` mention gone from the lib (grep 0). Test file reads the export instead of `route-table.json`. Verify: 52/52 pass, export prints the five rungs, self-verify `ok:true`, `npx tsc -p tsconfig.ci.json` clean. |
| 2: Review gates, tiers and efforts carry real defaults | b275c82a | Twelve schema rows off the `null` sentinel onto the `solo` row's values; purposes re-stated as ``Defaults to `<value>` ``. `gateAgreementIssues(schemaKeys)` now takes the schema alone and walks gate+tier+effort; `gate-default-drift`/`gate-grid-missing` retired. self-verify calls it outside the route-table block. `config.mjs` `LEVEL_KEY`/`LEVEL_KEY_NOUN`/level warning deleted. Verify: scratch `get` answers `advisory`/`cheap`/`low` with no `warnings`; gate-agreement 26/26, config 102/102, self-verify 181/181, prose-agreement 74/74; self-verify `ok:true`; tree copies seeded with `"adivsory"` and with `null` each report `gate-default-invalid` naming `review.triggers.plan.gate`; tsc clean. |
| 3: Gates, tiers, efforts and the deep-verify switch answer from the schema | NOT COMMITTED | Written in full and green on every part of `Verify:` EXCEPT `self-verify ok: true`. See the deviation below. |

Deviations:

[deviation] CONTEXT D-14 asserts "`route.mjs replay` has no prose caller"; its
evidence is scoped to "no workflow or SKILL invocation", which is true, but
`cadence-core/references/seam-spawn-agent.md:251` names the subcommand in prose:
"`route.mjs replay` answers what the floor does to this project's own phases".
self-verify's check 2 reads every prose site spelling `route.mjs <subcommand>`
and requires a matching row in `CONTRACTS['route.mjs']`
(`self-verify.mjs:657-667`), so deleting the `replay` row - which Task 3's
Action requires - makes that line report
`{"kind":"unknown-subcommand","file":"cadence-core/references/seam-spawn-agent.md","detail":"route.mjs replay"}`.
That is the ONLY problem self-verify reports on the live tree, and it is also
why `self-verify.test.mjs`'s `the repo itself passes self-verification` and
`entry: a valueless or empty --root refuses instead of linting the cwd` fail.
The fix is a three-line paragraph deletion in a file PLAN-1 does not declare -
PLAN-3 declares it - so Task 3's `Verify:` cannot be met inside this plan's
lease. Stopped rather than committing a task whose stated verification fails.

Open items: none

## State of the working tree at this checkpoint

Tasks 1 and 2 are committed. Task 3 is written, UNCOMMITTED, and passes every
part of its `Verify:` except the self-verify line. Modified and unstaged:

- `cadence-core/bin/route.mjs` - reads `config.schema.json` beside `HERE`
  (`CADENCE_CONFIG_SCHEMA` honoured only under `testSeamOpen()`, unreadable is
  `fail('bad-schema', ...)`); `review`, `reviewer_tiers` and `reviewer_efforts`
  resolve off the schema rows via `gateTriggers`; `DEFAULT_GATES`,
  `DEFAULT_TIER_NAMES`, `DEFAULT_EFFORT_NAMES`, `UNSET_FLOOR`, `RAISE_TARGET`,
  `stakesOrder`, `higherLevel` deleted; `levelFor` rewritten as `floorFor`
  returning `{raised, surface, signal, file, bytes}` and no level; the floor's
  two effects (plan gate to `blocking`, `verify: on`) applied at one site; the
  D-08 rung clamp and its rung-comparison warning deleted; `replay`,
  `parseReplayArgs`, the `SYNOPSIS` arm and the dispatch arm deleted;
  `stakes = cfg.stakes` still selects a cells row for Task 4.
- `cadence-core/bin/route.test.mjs` - 187/187 pass. Sections rewritten per the
  Action, plus the `destructive` fixture pair the `Verify:` names verbatim; the
  whole `replay:` section deleted and replaced with one usage-refusal case.
- `cadence-core/bin/lib/arg-contract.mjs` - the `replay` row under
  `CONTRACTS['route.mjs']` deleted.
- `cadence-core/bin/arg-contract.test.mjs` - the flag-entry census moved
  201 -> 200 (the deleted row's `--file`). `lib/census-registry.mjs` carries no
  figure, so it needed no edit.
- `cadence-core/bin/config-seams.test.mjs` - the `risk.override` floor test now
  asserts `review.plan === 'blocking'`, `verify === 'on'` and `model`/`effort`
  equal to the same role on a clean fixture.
- `cadence-core/bin/prose-agreement.test.mjs` - the `RNG-04` README arm deleted.

`npx tsc -p tsconfig.ci.json` is clean. `node --test` is green for
`route.test.mjs`, `config-seams.test.mjs`, `prose-agreement.test.mjs`,
`arg-contract.test.mjs`, `gate-agreement.test.mjs`, `config.test.mjs`,
`rung-agent.test.mjs`. No arm of `prose-agreement.test.mjs` pins a per-level
statement in `references/review-triggers.md` any more, so that file needs no
edit in this task and its full sweep stays PLAN-3's.

## What unblocks it

Add `cadence-core/references/seam-spawn-agent.md` to PLAN-1's `files:` lease
(PLAN-3 already declares it, and the three plans are sequential, so the overlap
costs nothing), and the edit is: delete the paragraph at lines 251-253 -

    `route.mjs replay` answers what the floor does to this project's own phases -
    one row per phase directory, live and archived, today's level against the
    computed one and the evidence behind any raise, regression list always present.

The same file's lines 240-249 are also false after Task 3 - the waiver
"lowers to the configured `stakes`", and "A raise floors the RUNG too" - so the
same edit should carry them, or PLAN-3 must be told they are already stale.

The alternative, which was rejected: keep an empty `replay: {}` row in
`CONTRACTS` so the prose still lints. That leaves CI green about a subcommand
route.mjs no longer implements, which is the control-reports-success shape this
repo closes rather than opens, and the Action explicitly says delete the row.
