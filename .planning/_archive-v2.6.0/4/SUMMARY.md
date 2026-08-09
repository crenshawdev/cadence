---
phase: 4
status: complete
completed: 2026-08-09
---

# Phase 4: Token accounting - Summary

`trace append` now takes `--tokens`, `--role` and `--read` on lifecycle events,
`renderTrace` aggregates per-role token totals that distinguish `unrecorded`
from zero, and all five phase-scoped dispatch sites carry written brackets that
a per-file producer census holds in place.

## What shipped

- Three new flags on `trace append` - `--tokens` (int-validated, negatives
  refused under the same `bad-args`), `--role`, `--read` (one comma-separated
  list) - with their `CONTRACTS` row and header usage line -
  `cadence-core/bin/planning.mjs`, `cadence-core/bin/self-verify.mjs`
- Per-role aggregation as a `roles` field on `TraceRender`, computed in the lib -
  token total omitted when nothing was recorded, `unrecorded` a dispatch count
  omitted at zero - `cadence-core/bin/lib/trace.mjs`
- Lifecycle brackets at the three unbracketed sites: `context.md` (1 dispatch),
  `plan.md` (4 dispatch moments including BOTH revision re-dispatches),
  `review-triggers.md`'s claude-subagent arm - each closed at its own step
- `--role`, `--tokens` and `--read` on the two brackets that already shipped
  (`execute.md`, `verify-deep.md`); `execute.md`'s `phase_start` anchor
  deliberately left with none of the three
- The per-role block in `/cad-progress --trace` with its
  absent-total-is-`unrecorded`-never-`0` reading rule -
  `cadence-core/workflows/progress.md`
- Per-file bracket coverage in the producer census: dispatch minimums per file,
  terminals >= dispatches, returns >= dispatches, plus global `--role` and
  non-empty `--read` assertions - `cadence-core/bin/trace.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | db9301b | token, role and read-set flags on `trace append` (11 new tests) |
| 1 | 2 | 219cc22 | per-role token and dispatch totals inside `renderTrace` (11 new tests) |
| 1 | 3 | a02f4d0 | bracket the context and plan dispatches in the run record |
| 1 | 4 | 602545e | bracket the reviewer dispatch and key the shipped brackets by role |
| 1 | 5 | c4e0a98 | `/cad-progress --trace` prints the per-role token totals |
| 1 | 6 | ffd73e7 | bind the producer census to per-file bracket coverage |
| 1 | 7 | (no commit) | gate sweep only - `weight-budgets.json` reported zero stale entries, the plan's stated condition for touching it |

## Deviations

- [deviation] Task 4 named ONE terminal bracket for `review-triggers.md`. A
  failed, empty or unparseable reviewer return would leave that bracket open
  forever, so a second `--event checkpoint` arm was written beside it carrying
  `--tokens` - a reviewer that burned its budget and came back unusable is
  exactly the dispatch whose cost must still reach the record. Commit 602545e.
- [deviation] Task 6's proof (4) assumed `plan.md` carries four closing lines; it
  carries EIGHT, because every dispatch moment writes two mutually exclusive
  closing ARMS (a `return` form and a `checkpoint` form) - also true of the other
  four bracketing files. Under the plan's stated `TERMINAL >= dispatches`
  assertion alone, deleting one close from `plan.md` leaves 7 >= 4 and the suite
  stays green, so proof (4) could not land and a site could lose BOTH arms
  undetected. Fixed inline with a sharper assertion beside the stated one:
  `--event return` closes >= dispatches. Proof (4) then lands verbatim at 4/3.
  Commit ffd73e7. Independently re-checked by a `cad-plan-checker` dispatch,
  which confirmed the premise and noted the same defect silently rescued the
  plan's proof (3) as well.

## Open items

- The cross-model review arm is unmeasured by design (CONTEXT D-12). Under a
  panel, `cad-reviewer`'s per-role total covers the claude-subagent voice only
  and is short by the provider call(s) beside it, by an unstated amount.
  `review-triggers.md` states the carve-out in its own prose. The honest fix is a
  per-adapter `extractUsage`, and no provider response body has been confirmed to
  carry a usage block.
- [diff review, confirmed by reproduction] A `__proto__` role key is lost
  entirely: `out.roles['__proto__'] = row` sets the object's prototype rather
  than an own row, so `Object.keys(r.roles).length` is 0 and `cmdTrace` omits the
  whole `roles` block - both events still render under `events`. One-line fix:
  `Object.create(null)` for `roles`.
- [diff review, confirmed by reproduction] A terminal event's `--role` is not
  validated against its paired dispatch's role. Bracketing a dispatch as
  `cad-executor` and closing it as `cad-reviewer` renders
  `cad-executor:{dispatches:1,unrecorded:1}` and
  `cad-reviewer:{dispatches:0,tokens:500}` - a role with zero dispatches carrying
  a token total.
- [diff review, plausible, not reproduced] `recorded` is counted per
  token-bearing event rather than per matched dispatch, so a duplicated terminal
  event could satisfy two dispatches' worth of accounting and hide an
  `unrecorded` one.
- [diff review, by design] A bare `--role` is accepted and silently dropped to
  the `""` key while malformed `--tokens` and `--read` fail atomically. This is
  PLAN Task 1 as written (a forgotten flag stays visible rather than vanishing),
  but the reviewer's point stands that role is the aggregation key and arguably
  deserves the same atomicity.
- [checker warning] The census does not guard the `checkpoint` arm: deleting all
  four of `plan.md`'s checkpoint closes leaves 4 dispatches / 4 returns and every
  assertion green, yet deviation 1 argues that arm is load-bearing. Symmetric
  per-file `checkpoint >= dispatches` assertion would close it (holds on the tree
  today at 4/4 and 1/1).
- [checker warning] `trace.test.mjs:758` uses a literal `'return'` against PLAN
  Task 6's instruction to read lifecycle names from `lib/trace.mjs` exports. It
  fails loudly rather than silently, so it is a spurious-failure source rather
  than a hole; a named `PRIMARY_CLOSE` export would fix it.

## Goal check

The phase goal was that what a dispatch costs is recorded where it happens, at
every phase-scoped site, and rendered per role. The six commits deliver that end
to end and it was proved on live data rather than argued: after the phase, a real
`cad-plan-checker` dispatch bracketed through this repo's own script (never the
installed 2.5.0 plugin, per D-16) returned `subagent_tokens: 47717`, and
`trace render --phase 4` printed
`"cad-plan-checker":{"dispatches":1,"tokens":47717}` beside
`"cad-verifier":{"dispatches":1,"unrecorded":1}` - AC6 and AC3's
unrecorded-is-not-zero distinction confirmed in one output. The `""` row in that
same render is plan 1's own executor bracket, written through the installed seam
that predates `--role`; it is visible rather than silently dropped, which is what
the empty-string key convention was chosen for. Coverage is mechanical, not
asserted: all six AC5 patch-and-rerun proofs failed as specified and are recorded
verbatim in `reports/plan-1.md`, including the one the plan could not have landed
before deviation 2 sharpened the assertion. Gates are green (1451/1451 tests,
`tsc` silent, `self-verify` `"ok":true` with zero problems and no stale budget).
What is NOT delivered, and is stated rather than implied: the cross-model review
arm carries no bracket and no token field, so a panel's `cad-reviewer` total is
short by the provider call beside it - locked out of scope by D-12, stated in
`review-triggers.md`'s own prose, and filed above. The `diff` review also surfaced
three real defects in the new renderer (the `__proto__` key, the unvalidated
terminal role, the per-event rather than per-dispatch `recorded` count); two
reproduce on demand. None of them breaks the phase's own evidence - every role in
this phase's trace is a legitimate name and every bracket is role-consistent - but
they are accounting bugs in shipped code and belong to `/cad-verify` or a
follow-up, not to a silent pass here.
