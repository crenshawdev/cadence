---
phase: 4
status: complete
completed: 2026-08-24
---

# Phase 4: Split planning.mjs by command - Summary

The 32 `cmd*` handlers left `cadence-core/bin/planning.mjs` for 30 per-command
modules under `cadence-core/bin/planning/`, the 477-arm `planning.test.mjs`
split into 21 per-command test stems, and every citation that named a moved line
was repointed and pinned by a census that reddens when one goes stale.

## What shipped

- 30 per-command handler modules - `cadence-core/bin/planning/`, carrying all 32
  handlers; `core.mjs` holds the 28 shared symbols
- A 360-line entry file - `cadence-core/bin/planning.mjs`, dispatch and the
  `COMMANDS` table only, zero `cmd*` declarations
- 21 per-command test stems - `cadence-core/bin/planning-*.test.mjs`, all named
  in the runner's `GROUPS.planning`
- A citation census - `cadence-core/bin/citation-census.test.mjs`, 3 inline rows
  plus 4 `DOCS-CLAIMS.md` line-range rows, failing by name when one goes stale
- The measured read cost, before and after - `.planning/phases/4/READ-COST.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 3e17270b | Extract the shared core into `planning/core.mjs` (28 symbols) |
| 1 | 2 | b323f835 | Move status, cursor and phase-done into modules |
| 1 | 3 | 9a3979d6 | Move the plan-and-criteria readers into modules |
| 1 | 4 | bca6a4b1 | Move the record-and-lease commands into modules |
| 1 | 5 | 643541b3 | Move the project-scan and file-writing commands into modules |
| 1 | 6 | 402b2861 | Move the trace family into `planning/trace.mjs` |
| 1 | 7 | 72ac054c | Move the risk-check family into `planning/risk-check.mjs` |
| 1 | 8 | 52068a0b | Move the fire-record and renumber commands; close the entry file |
| 2 | 1 | 77c9c620 | Export the fixture harness; split the status arms out |
| 2 | 2 | 5a93f99f | Split the cursor, phase-done and uat arms out |
| 2 | 3 | 73a5f5ea | Split the audit, criteria and plan-file arms out |
| 2 | 4 | 3e4546e9 | Split the renumber, seed-reqs, recall, detect and lease-check arms out |
| 2 | 5 | 9ed65ec9 | Split the trace-ignore, debt-harvest, milestone-prune and capture-sections arms out |
| 2 | 6 | aec03d17 | Split the fire-record and read-back arms out, leaving the harness |
| 2 | 7 | 4ba85c1a | Declare the split planning stems in the test runner's group |
| 3 | 1 | ea21a2fb | Pin the three live inline citations that survived the split |
| 3 | 2 | a738b93b | Add the DOCS-CLAIMS line-range grammar and repoint its four rows |
| 3 | 3 | a054af4d | Measure the read cost the split bought, before vs. after |

18 commits, `66ce9bd5..a054af4d`.

## Deviations

All three executors reported none - every `Verify:` was met as written. Two
departures were made at the orchestrator, not inside a plan:

- [deviation] **PLAN-1's `files:` lease was amended mid-phase.** The first plan-1
  dispatch halted `structural` at task 1 with 0 of 8 tasks and no commits:
  `trace.test.mjs` requires four refusal sentences to appear exactly once in
  `planning.mjs`'s source bytes, and `self-verify.test.mjs` check 12 hardcodes a
  `mergeLayers` callsite-file count over `cadence-core/bin/**`. Both pin
  `planning.mjs`'s physical layout, which this phase exists to change, and
  neither was in the lease. The user approved adding both files; a fresh
  executor then completed all 8 tasks. Cost of the halt: 151,683 tokens for zero
  commits, then 242,318 to redo the work.
- [deviation] **Plan 2's `risk_surface` gate was overridden by the user**
  (`override` receipt on `52068a0b..4ba85c1a`). The detector matched
  `destructive` and `untrusted_input`, but cancelling verbatim moves out of the
  range leaves 677 genuinely-new and 27 genuinely-gone lines, and all four
  risk-signal hits among them are `import { ... rmSync ... } from 'node:fs'`
  statements in the newly split test files. Every file in the range is a
  `*.test.mjs`. Plan 1's gate had fired for real on a structurally identical
  range and returned one blocker that was false - it claimed
  `planning/core.mjs` never imports `fileURLToPath`, when `core.mjs:25` is that
  import; the narrowing needed to fit the 120,000-token payload cap is what hid
  the import block from the reviewer. Recorded at
  `ADJUDICATION-risk_surface-plan-1.json` (1 raised, 0 survived, 1 refuted).

One numbered context decision was refuted and corrected in place: CONTEXT D-06
called `DISPATCH_WINDOW_DEFAULTS` "genuinely shared", but measured over
comment-stripped source its only reader is `cmdTrace`.

## Open items

Five filed to `.planning/CAPTURE.md` against phase 4. Two are local to this
phase; three came out of measuring the run record while it executed.

- `skim.test.mjs:99` walks `bin/` and `bin/lib/` only, so the 30 new modules
  under `bin/planning/` fall outside its coverage. Nothing fails.
- No census pins the `planning-*.test.mjs` stem list, so a stem added later runs
  silently in the `other` group unless someone names it in `GROUPS.planning`.
- `DISPATCH_WINDOW_DEFAULTS` sits in `core.mjs` per the plan's task 1, though
  only `trace.mjs` reads it (the corrected D-06 above).
- **Build a census registry and a plan-time lease check.** 20 of 39 checkpoints
  here (51%) and 7 of 15 on verbatim (47%) have one cause: a plan's lease omits
  a test file holding a hand-maintained census count the plan's own work must
  change, and `lease-check` only refuses at commit time, after the work is done.
  Worth 14.8% of executor spend here, 17.4% on verbatim. Repeat offenders:
  `self-verify.test.mjs` (8), `arg-contract.test.mjs` (8), `trace.test.mjs` (5).
  Approved as its own phase, to run before phases 2 and 3.
- **The risk-routing floor reads whole-file body lines, not the diff.** Any plan
  declaring `planning.mjs` inherits its `secrets`/`destructive` matches and can
  never earn the discount below `shipped`. 233 of 239 executor dispatches across
  both projects ran opus at `shipped`; the discount fired 6 times in total. The
  split makes a narrow declaration possible, but nothing tells planners to make
  one.

## Goal check

The phase delivers its goal, and both success criteria are met against the
committed tree. AC1: `grep -cE '^(async )?function cmd[A-Z]'
cadence-core/bin/planning.mjs` prints `0` and `wc -l` prints `360`, against a
stated ceiling of 2,000, with 30 modules under `cadence-core/bin/planning/`
carrying all 32 handlers. AC2: `node cadence-core/bin/test.mjs` reports `tests
3076 / pass 3076 / fail 0`, `node cadence-core/bin/self-verify.mjs` returns
`"problems":[]` across all 26 named checks, and `npx tsc -p tsconfig.ci.json`
exits 0. The `risk_surface` gate is settled on all three ranges - `recorded` for
plans 1 and 2, no match on plan 3.

What the goal line overstates, named honestly because `READ-COST.md` now
measures it: "an agent touching one command reads about 2,400 tokens" is one
command module in isolation. A dispatch that opens a command also reads
`planning.mjs` for dispatch and `planning/core.mjs` for the shared helpers, so
the real floor is 71,985 bytes / ~17,996 tokens at the median and 117,473 bytes
/ ~29,368 tokens at the worst case (`trace.mjs`), against 417,009 bytes /
~104,252 tokens before. The defensible claim is not a 43x saving but this one:
every command is now reachable inside a single 50,000-token read, where the file
was previously 2.1x that cap. The saving also reaches only a dispatch that reads
the source to edit it - roughly 10.7% of this repo's commits touch these two
files - and none of it reaches agent startup, because agents invoke
`planning.mjs` as a subprocess, which costs no context at all. `READ-COST.md`
states all three limits rather than the headline alone.
