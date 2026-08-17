---
phase: 4
status: complete
completed: 2026-08-17
---

# Phase 4: Costs argued from the new record - Summary

A live dispatch window is now budgeted off the run record the way prose surfaces
are budgeted off `weight-budgets.json`, bulk tool OUTPUT rides a scratch file at
the five sites that prescribed it inline, and `workflow.max_plan_tasks` is
re-decided against both of its forces and left at 8 with the arithmetic written
down where a milestone close cannot prune it.

## What shipped

- Six `workflow.max_dispatch_tokens.<role>` ceilings, each defaulted to that
  role's p75 terminal window on this repo's own record rounded up to the next
  25,000 - `cadence-core/config.schema.json:32-37`, argued in
  `cadence-core/references/seams.md`
- `windowBudget()`, the pure rule turning bracket rows plus ceilings into
  crossings in self-verify's own `budget-overrun` shape -
  `cadence-core/bin/lib/window-budget.mjs`
- `planning.mjs trace window [--phase <N>]`, the report that applies it, and a
  `/cad-report` shape line that prints it as two numbers and never their
  quotient - `cadence-core/bin/planning.mjs`, `cadence-core/workflows/report.md`
- The bulk-output rule stated once, and the four prose sites converted to a
  redirect plus a targeted field read - `cadence-core/references/conventions.md`,
  `references/triage-gate.md`, `workflows/progress.md`, `workflows/report.md`
- A 17-row register of every bulk-output call in the tree, its pure rule, and
  self-verify check 20 walking it - `cadence-core/bin/lib/bulk-output.mjs`
- The plan-task ceiling re-decided against cold-prefix cost and context risk,
  landing on 8 unchanged - `design-notes/dd-plan-task-ceiling.md`, published on
  the two surfaces a check binds
- Three falsifiers, each carrying the SHA it was watched failing at -
  `cadence-core/bin/window-budget.test.mjs`, `cadence-core/bin/prose-agreement.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | a79aad2 | Per-role dispatch-window ceilings become configuration, argued from the record |
| 1 | 2 | a7646fe | The pure rule turning bracket rows plus per-role ceilings into crossings |
| 1 | 3 | e63dbba | `trace window` reports a per-role window crossing off the project's own record |
| 1 | (lease) | 5f2230f | The two census pins the window budget moved (user-granted two-line edit in PLAN-2's file) |
| 1 | 4 | 609bb20 | `/cad-report` reads the window budget off the same brackets |
| 1 | 5 | 86cd45d | The MSR-03 falsifier, watched failing at 9b1fe53 |
| 2 | 1 | 08a34be | The bulk-output rule, stated once in conventions.md |
| 2 | 2 | c360346 | The re-arm lookup reads a file, not the render envelope |
| 2 | 3 | 935e6f8 | `/cad-progress --trace` prints the counts without buying the brackets |
| 2 | 4 | 1c4001a | `/cad-report` composes from the file, with the read-back bound stated |
| 2 | 5 | 5f105b4 | The bulk-output register and the pure rule over it |
| 2 | 6 | a445685 | self-verify walks the bulk-output register |
| 2 | 7 | 617a2a1 | The TRN-02 falsifier, watched failing at 86cd45d |
| 3 | 1 | 3bf1653 | The plan-task ceiling re-decided against both forces, with the arithmetic |
| 3 | 2 | a8d7946 | The ceiling decision lands on the schema purpose and the catalog row |
| 3 | 3 | 9e5529e | The PLN-01 falsifier, watched failing at 617a2a1 |
| 3 | (gate) | b52fd6c | The schema states the task ceiling the planner actually enforces (risk_surface blocker fix) |

## Deviations

- [deviation] PLAN-1's task-1 Action states per-role p75 figures the record does
  not reproduce under either nearest-rank or linear interpolation. The MEASURED
  figures were written instead (`cad-executor` p75 182,631 at n=72,
  `cad-verifier` 82,633 at n=24, `cad-planner` 188,135 at n=28) with the
  nearest-rank rule that produced them. No default changes - every figure still
  rounds up to the same 25,000 multiple. `a79aad2`
- [deviation] PLAN-1 could not reach its own `## Must be true when done` (full
  suite green) from its declared lease: two pins in `self-verify.test.mjs`, a
  PLAN-2 file, reddened under its changes. Returned as a structural checkpoint;
  the user granted a two-line lease and the plan continued. `5f2230f`
- [deviation] PLAN-3: CONTEXT D-10 asserts `design-notes/` is tracked.
  `.gitignore:23` ignores `/design-notes/dd-*.md`, so the note is `git add -f`-ed
  and states in its own header why it is tracked past that line. `3bf1653`
- [deviation] PLAN-3: CONTEXT D-17's 20 checkpoints / 14 executor / 177 dispatch
  / 153 return re-counted at execution as 21 / 15 / 182 / 157 - phase 4 wrote to
  the record while it ran, so the checkpoint numerator moves too. `3bf1653`
- [deviation] PLAN-3: CONTEXT D-09's `zeroResidentBytes` 38,492 reads 40,577
  live, and the executor mean return re-derived over every tokens-bearing
  terminal is 147,740 at n=75, not 144,752. The four `dispatchBytes` figures and
  the ~2%-of-a-dispatch conclusion both reproduce. `3bf1653`
- [deviation] PLAN-3 names `37796d0` as the unpatched tip for its falsifier
  header. Plans 1 and 2 landed first, so the watched SHA is `617a2a1`. `9e5529e`
- [deviation] PLAN-3's task 4 assigns `SUMMARY.md` to an executor, which the
  executor contract's `<never>` list forbids and which could not run in any case
  (the file did not exist yet, and the task runs after the dispatch returns).
  Returned as a structural checkpoint and executed here by the orchestrator; the
  AC6 section below is the block PLAN-3 prepared and proved.

All three CONTEXT decisions the deviations refute - D-09, D-10, D-17 - carry a
`[corrected by plan-3 deviation: ...]` clause in
`.planning/phases/4/CONTEXT.md`, so a later planner inherits the true figure.

## Open items

- `cadence-core/bin/lib/window-budget.mjs` hardening, three findings in one
  file: the `unbudgeted` counter is a prototype-bearing `{}`, so a role named
  `__proto__` or `constructor` silently drops or corrupts its count; token
  figures are accepted for being finite alone, so a negative or fractional
  `tokens` counts as `compared` and passes every ceiling; and the overrun's
  `where` template throws on a wrong-typed identity field instead of returning
  the report.
- `cadence-core/bin/planning.mjs:3287` coerces an explicitly null per-role
  ceiling to the default, while `usableCeiling`'s own docstring names null
  unusable and requires the row under `unbudgeted`. Null is the only value where
  the callsite and the rule disagree.
- `cadence-core/bin/lib/bulk-output.mjs` checker gaps, three findings in one
  file: one register row per `(surface, shape, call)` collapses two occurrences,
  so the `git diff --cached` row's `transport: 'none'` masks the occurrence that
  does redirect; `seen.redirected` proves redirect SYNTAX and not that the target
  is a scratch file, so `> /dev/stdout` and `> ./artifact.json` both pass; and
  `shape.bounded.some(...)` exempts a call for any occurrence of a bounding flag,
  so `git diff A..B --stat --patch` and `git diff A..B -- --stat` are both
  skipped.
- The bulk-output transport uses a fixed shared scratch path at five sites
  (`references/triage-gate.md:81`, `references/review-triggers.md:192,193,230`,
  `workflows/progress.md:99`) with no `mktemp` and no `&&` coupling the read-back
  to the write succeeding. Two concurrent runs collide, and a failed redirect
  leaves a stale file to be read as current - which on `triage-gate.md` is the
  one-round re-arm cap reading another repo's count.
- `cadence-core/workflows/progress.md:101`'s read-back has no parse guard and no
  envelope validation: a truncated file throws a raw stack, and a stale `{}`
  prints successfully with every field `undefined`.
- `design-notes/dd-plan-task-ceiling.md` carries three argument holes the
  decision rests on: the cold-cost term charges a split plan's whole dispatch as
  re-bought when only shared context and duplicated files are genuine split
  overhead; the "15 executor checkpoints of 21, every one under the ceiling"
  claim is evidenced for four of them and the note itself says older plans were
  pruned; and "lowering the ceiling would not have prevented any checkpoint" does
  not follow from the checkpoints having occurred below 8, since the note names a
  context-related partial return from a 5-task plan.
- `cadence-core/bin/self-verify.test.mjs:1555`'s test TITLE still reads "ELEVEN
  callsites over EIGHT files" while the pins are 13 and 9. It was already stale
  at 12/9 before this phase; the granted lease was two lines only.
- `.gitignore:23`'s `/design-notes/dd-*.md` and the now-tracked
  `dd-plan-task-ceiling.md` disagree in spirit - the file is tracked by force
  rather than by rule. One-line fix is a negation or a rename into the dated
  tracked family the same comment describes.

## Goal check

The phase delivers all three of its decisions, and each one is falsifiable
rather than asserted. (1) The window budget exists end to end: six ceilings in
`cadence-core/config.schema.json:32-37`, the pure rule in
`cadence-core/bin/lib/window-budget.mjs`, and the `trace window` arm run live on
this repo returning 25 `budget-overrun` problems against `compared` 153,
`unrecorded` 9 and `unbudgeted {"(no role)":10}` - which is the phase's own claim
that a ceiling read after the fact is a report and not a bound, since 25
crossings refused nothing. (2) Bulk output rides a file at every site that
prescribed it inline, and the claim is enforced rather than stated: check 20 in
`cadence-core/bin/self-verify.mjs` walks a 17-row register, and PLAN-2 watched it
bite by deleting `triage-gate.md`'s redirect and seeing self-verify exit 1 with
`bulk-output-inline` naming that file (`a445685`). (3) The ceiling is re-decided
in `design-notes/dd-plan-task-ceiling.md` against a measured 12,488-byte executor
dispatch prefix (~2% of a dispatch) and 15 of 21 executor checkpoints, and lands
on 8 unchanged. All three falsifiers carry the SHA they were watched failing at
and the AC6 audit below extracts and compares those SHAs per requirement rather
than counting occurrences.

Two things are honestly short of the goal. The third decision's ARGUMENT is
weaker than the phase claims: the cross-model `risk_surface` review of PLAN-3's
range raised - and grounding confirmed - that the cold-cost term charges a split
plan's entire second dispatch as re-bought work when only the shared prefix and
duplicated files actually are, and that the "every checkpoint came from a plan
under the ceiling" figure is evidenced for four of fifteen because
`milestone-prune` removed the older plans. The value 8 is not thereby wrong - a
corrected split-cost analysis moves the number up or leaves it, never down - but
"argued from the new record" is a stronger claim than the note currently
supports, and both surfaces repeat the unsupported figure. Separately, the
schema's `purpose` string described a per-PHASE refusal while
`cadence-core/workflows/plan.md:139` and `references/config-catalog.md:30` both
define a per-PLAN ceiling that splits; that shipped as a blocking `risk_surface`
finding and was fixed in `b52fd6c`, but the phase's own new agreement test
compares the extracted NUMBERS and not the behaviour, so it passed over the
contradiction and would pass over the next one.

Verification state at close: `node --test cadence-core/bin/*.test.mjs` 2,150 pass
/ 0 fail, `node cadence-core/bin/self-verify.mjs` exit 0 with 24 checks and an
empty `problems` array, `npx tsc -p tsconfig.ci.json` exit 0.

## AC6: watched failures

Each requirement's falsifier carries a `WATCHED FAILING AT <sha>` header naming
the commit it was watched failing at, quoted here from the header as it stands
rather than from the plan. The audit EXTRACTS the SHA from each line and from
the named file's headers and compares the two per requirement; it never counts
occurrences of the phrase, and two of the three share one file, so a per-file
count proves nothing.

- MSR-03 - falsifier in `cadence-core/bin/window-budget.test.mjs` ("the falsifier: a live window is budgeted the way prose surfaces are"), header `WATCHED FAILING AT 9b1fe53`. Re-watch: `git worktree add --detach <tmp> 9b1fe53`, copy that file into `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/window-budget.test.mjs` from `<tmp>`, then `git worktree remove <tmp>`.
- TRN-02 - falsifier in `cadence-core/bin/prose-agreement.test.mjs` ("TRN-02: the bulk-output rule, stated once, and the sites that obey it"), header `WATCHED FAILING AT 86cd45d`. Re-watch: `git worktree add --detach <tmp> 86cd45d`, copy that file into `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs` from `<tmp>`, then `git worktree remove <tmp>`.
- PLN-01 - falsifier in `cadence-core/bin/prose-agreement.test.mjs` ("PLN-01: the plan-task ceiling's decision, read off both bound surfaces"), header `WATCHED FAILING AT 617a2a1`. Re-watch: `git worktree add --detach <tmp> 617a2a1`, copy that file into `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs` from `<tmp>`, then `git worktree remove <tmp>`.
