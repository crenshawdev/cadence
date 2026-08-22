---
phase: 2
status: complete
completed: 2026-08-22
---

# Phase 2: Both callers on the journal - Summary

`cmdPhaseDone` and `release-bump` both route their whole write set through phase
1's `runTransition` primitive: each reads and validates every document it will
write before the first `atomicWrite`, and each reports which documents actually
landed instead of an undifferentiated `{"ok":false,"reason":"internal"}`.

## What shipped

- `phase-done` as one ordered transition with a pre-flight refusal -
  `cadence-core/bin/planning.mjs`, `cmdPhaseDone`. The
  `all-or-nothing` comment is gone rather than merely qualified:
  `sed -n '/^function cmdPhaseDone/,/^}/p' cadence-core/bin/planning.mjs | grep -c "all-or-nothing"`
  prints `0`.
- REQUIREMENTS.md as a three-state fact - absent / present-but-unreadable /
  present-and-read (`planning.mjs:700-703`). Absent keeps the roadmap-only
  `ok:true` write (D-03); unreadable refuses before ROADMAP.md is touched.
- A `wrote` field on `phase-done`'s success envelope naming which of the two
  documents moved, with `roadmap.{line,now}` and `reqs[]` unchanged (D-04).
- A `partial-flip` envelope for a step failure the pre-flight cannot see,
  carrying what landed instead of `internal` (`planning.mjs`, task 4).
- `release-bump`'s whole write set read and decided before the first write -
  `cadence-core/bin/release-bump.mjs`. The first `atomicWrite(` is at line 361;
  the last `readManifest(` in `bump()` is at 280 and the changelog read at 329,
  so the ordering is structural rather than conventional.
- Two new refusal codes with their own identities, `unreadable-sibling-manifest`
  and `unreadable-changelog`, plus `partial-bump` for a write that fails anyway.
- A regular-file check in `readChangelog` (gate fix, see Deviations) so a FIFO or
  a device at `CHANGELOG.md` reaches the `unreadable-changelog` refusal instead
  of hanging or reading as empty.
- `cadence-core/workflows/milestone.md`'s halt prose, its `weight-budgets.json`
  entry (14222 -> 14937) and the `.planning/DOCS-CLAIMS.md` MILESTONE-06 row all
  moved with the behaviour.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 2 | 1 | b03e2f1b | read and decide the whole release write set before the first write |
| 1 | 1 | 6d580c88 | cmdPhaseDone's two writes become one ordered transition |
| 2 | 2 | 1b36a7ca | an unreadable sibling manifest refuses the run under its own code |
| 1 | 2 | f74d778a | an unreadable REQUIREMENTS.md refuses before the first write |
| 2 | 3 | c7921b29 | the CHANGELOG joins the validated write set |
| 1 | 3 | 52485605 | phase-done's success envelope names the documents it wrote |
| 2 | 4 | bbef0931 | a write that fails anyway names what landed |
| 2 | 5 | 0be88849 | the halt prose, the budget and the ledger move with the behaviour |
| 1 | 4 | 46f625cb | a step failure past the pre-flight reports what moved, not internal |
| - | gate | a90d8b12 | fix(2-2): reject a non-regular CHANGELOG.md before the first write |

Plans ran in parallel worktrees; `776c1d8e` and `649f1694` are the two merges,
and `33973b10` / `776c1d8e` carry the executor reports.

## Deviations

- [deviation] (plan 1) PLAN-1's `Must be true when done` asserts zero removed
  lines in `planning.test.mjs`, while task 4's Action names the exact
  `e && e.message ? e.message : String(e)` idiom. `planning.test.mjs:5846` is a
  COUNT census over that idiom, so both could not hold. Kept the idiom, re-pinned
  the census from eleven to twelve and extended its comment to name `partial-flip`
  and why it stays unwrapped. Cost: 8 deleted lines, all inside that one census
  test; zero pre-existing `phase-done` cases were edited. Commit `46f625cb`.
- [deviation] (plan 1) The worktree carries no `node_modules`, so the literal
  `./node_modules/.bin/tsc` in every task's Verify is unrunnable there. Ran the
  same config through the main checkout's install with the worktree as cwd; exit
  0 at every task.
- [deviation] (plan 2) Task 5's Verify asserts the full
  `node --test 'cadence-core/bin/*.test.mjs'` exits 0. Observed 2640 tests,
  1 failing: `milestone-prune.test.mjs`'s corpus case, red at the dispatch base
  `5dd8cdca` and caused by `.planning/REQUIREMENTS.md:16` stating `JRN-01` on one
  unwrapped line. Left it - the repair is outside plan 2's lease. Filed below.
- [deviation] (gate) The blocking `risk_surface` review on plan 2's range raised
  one high finding that survived adjudication: `readChangelog`'s doc promised a
  readable REGULAR file and the code checked only that reading did not throw, so
  a FIFO would block the CLI forever and `/dev/null` would read as an empty
  changelog and scaffold over the release history. Plan 2's own open item (4) had
  declined exactly this probe pending "a shape readFileSync classifies
  differently"; the review named one. Fixed in `a90d8b12` with a
  `statSync().isFile()` check and a symlink-to-`/dev/null` regression test.

## Open items

- `.planning/REQUIREMENTS.md:16` - wrap the `JRN-01` Active bullet across lines,
  or relax the corpus assertion, to clear the one pre-existing red in
  `milestone-prune.test.mjs`.
- `cadence-core/bin/planning.mjs:701` - `read(reqFile)` accepts any existing
  filesystem object, so a FIFO at `.planning/REQUIREMENTS.md` hangs `phase-done`
  before its refusal can run. Raised medium by the `risk_surface` review and
  downgraded at adjudication; it is the same class as the plan-2 blocker that was
  fixed, one seam over.
- `cadence-core/bin/lib/release-decision.mjs` - its JSDoc code set was already
  missing `bad-date` and `missing-flag-value` before this phase, and the three
  codes added here are deliberately not there either.
- `planning.mjs`'s `partial-flip` envelope carries `wrote` but not `cmdRenumber`'s
  `failed` key. Add it when a caller branches on it.
- `unreadable-requirements` refuses with no `hint`; the condition's own
  description supplies the path to repair.
- `cadence-core/bin/release-bump.test.mjs:424-428` still names the retired
  `optionalFlag` in a comment about the `--date` seam.

## Goal check

The sum of these commits delivers the phase goal. Both dishonest claims are gone
at their source: `grep -c "all-or-nothing"` inside `cmdPhaseDone` prints `0`
(criterion 1), and in `release-bump.mjs` the first `atomicWrite(` sits at line
361 against the last `readManifest(` at 280 and the changelog read at 329, so the
whole write set is read and decided before the first write structurally rather
than by convention (criterion 3). The committed evidence for the refusals is
real, not probe-only: `planning.test.mjs` is 455 passing with a case driving a
DIRECTORY at REQUIREMENTS.md to `{"ok":false,"reason":"unreadable-requirements"}`
at exit 1 with ROADMAP.md's sha256 byte-identical across the run (criterion 2),
and `release-bump.test.mjs` is 36 passing including the malformed-sibling case
that leaves `plugin.json` at the old version under an `ok:false` envelope
(criterion 4), with `bump: a SIBLING that would downgrade is recorded as a
refusal, not silently written (D-08)` still passing by name (criterion 5). What
is NOT covered: the `partial-flip` and `partial-bump` arms - the envelopes for a
write that fails past the pre-flight - are probe-proven only and ship with no
committed regression test, because every uid-independent way to force that
failure was converted into a pre-write refusal by the tasks above and D-02
forbids `chmodSync`. Both executors' probes are recorded in their reports with
the exact envelopes observed, but a reader should treat those two arms as
untested in CI rather than as verified behaviour.
