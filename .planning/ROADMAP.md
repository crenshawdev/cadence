# Roadmap

## Overview

**`v3.5.0 - the check that proves it ran`, opened 2026-08-15.** Scoped off the
Forgejo milestone, which holds one issue: #130.

**The theme is one sentence: the only gate live on a default install fires on a
model reading a prose list, and leaves no record either way.** `risk_surface` is
`blocking` at every stakes level, and at the shipped default it is the only
trigger that fires at all. Its firing condition is `workflows/execute.md`
instructing the orchestrator to check a diff against the eight categories in
`references/review-triggers.md`. A fire writes a lifecycle event; a non-match
writes nothing. The run record therefore cannot tell "the detection step was
skipped" from "it ran and matched nothing".

`lib/surface-scan.mjs` is not the missing piece - it is explicitly a scoping
aid, returns every category unconditionally, and never inspects source text. No
risk-check seam exists under `cadence-core/bin/` at all.

RSK-01 is the seam that always records `{checked, categories, matches,
inconclusive}` for a diff range; RSK-02 is what makes plan and task completion
require it. Semantic detection stays heuristic on purpose - what changes is that
"did not run" stops masquerading as "ran clean".

## Phases

- [ ] **Phase 1: The check that proves it ran** - a seam answers a diff range with a risk record, match or no match, and plan and task completion require it

## Phase Details

### Phase 1: The check that proves it ran
**Goal:** A completed diff range cannot report done without an executable risk
record, so the run record distinguishes "the detection step was skipped" from
"it ran and matched nothing".
**Depends on:** Nothing (first phase)
**Requirements:** RSK-01, RSK-02

`risk_surface` is `blocking` at every stakes level and, at the shipped default
`stakes: shipped`, it is the only review trigger that fires at all - `plan`,
`diff` and `phase_diff` all resolve `off`. Its entire firing condition is prose:
`cadence-core/workflows/execute.md:248-258` tells the orchestrator to check
`git diff {pre-plan HEAD}..HEAD` against the eight categories at
`cadence-core/references/review-triggers.md:369-378`, and
`cadence-core/workflows/task.md:73-91` says the same thing a second time for the
task path. A match fires the trigger and writes a lifecycle event; a non-match
writes nothing at all. The two indistinguishable states are the defect: a model
that never performed the check leaves exactly the bytes a model that performed
it and found nothing leaves.

`cadence-core/bin/lib/surface-scan.mjs:170-188` is not the missing detector and
was never meant to be. It is the one-time SCOPE question - which categories this
project answers for - it never inspects source text, and its own comment
explains why it returns `recommended = [...CATEGORIES]` unconditionally:
absence is not provable from structure. No per-range risk-check seam exists
anywhere under `cadence-core/bin/`.

The seam is the smaller half. The load-bearing half is RSK-02 - completion
requiring the record - because a seam that plan completion does not consult
leaves the gate exactly as skippable as it is today, just with a script beside
it. Detection stays heuristic on purpose: this cycle does not claim to find
risky diffs more accurately, it claims that whether the finding step ran is now
a fact in the record rather than an inference from silence.

Success criteria:
1. A seam under `cadence-core/bin/` answers a diff range with
   `{checked, categories, matches, inconclusive}` and returns that record on a
   matching range AND on a clean one. `categories` uses exactly the eight tokens
   already carried by `route-table.json`'s `risk_surface_categories` and
   `review.triggers.risk_surface.surfaces` - no new vocabulary is introduced.
   Proved by failing-capable tests over both a risky and a clean fixture range,
   not by inspection.
2. The record is written on EVERY invocation, non-match included, so a reader of
   `.planning/trace.jsonl` can tell "not run" from "ran clean". Proved by a test
   asserting the no-match invocation still appends its record.
3. `inconclusive` stays honest and is not collapsed into `matches: []`. A range
   the heuristics cannot judge reads `inconclusive: true`, and that state is
   distinguishable by the caller from a judged-clean range. Proved by a test
   over a range that produces it.
4. Both completion paths require the record: `workflows/execute.md`'s post-plan
   `risk_surface` step and `workflows/task.md`'s `risk_check` step call the seam
   instead of instructing the model to read a prose list, and a plan or task
   whose range has no record does not report done. The blocking-on-match
   behaviour and the ONE-round re-arm cap
   (`references/triage-gate.md`) are unchanged.
5. The enforcement is watched to FAIL against the tree as it stands today - a
   completed range with no risk record reported by name - before the wiring
   lands. Proved by running the check against the unpatched files.
6. `lib/surface-scan.mjs` keeps its scoping role and does not become a detector.
   The SUMMARY names which file answers "which categories does this project
   scope" and which answers "did this range touch one", and no caller confuses
   them.
7. The new seam takes its `CONTRACTS` row in `cadence-core/bin/self-verify.mjs`
   so the invocation lint covers it, and no config key, flag or route-table cell
   changes: `risk_surface`'s gate at every stakes level reads exactly as it does
   today.
8. `node --test cadence-core/bin/*.test.mjs` and
   `node cadence-core/bin/self-verify.mjs` both run clean, with the tests from
   criteria 1, 2, 3 and 5 in the suite.

