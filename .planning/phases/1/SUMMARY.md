---
phase: 1
status: complete
completed: 2026-08-22
---

# Phase 1: The transaction that was never there - Summary

`cadence-core/bin/lib/file-transition.mjs` now owns the ordered-step-list-with-a-completed/failed-record idiom, and `cmdRenumber` and `cmdMilestonePrune` both run their multi-file writes through it instead of each keeping its own try/catch loop.

## What shipped

- `runTransition({steps, discipline, preflight})` returning `{ok, refused, completed, failures}` - `cadence-core/bin/lib/file-transition.mjs`
- Two disciplines, D-03's arms: `stop-at-first-failure` (renumber) and `continue-past-failure` (milestone-prune) - `cadence-core/bin/lib/file-transition.mjs:148-172`
- A lazy pre-flight stage whose first unsatisfied condition returns `{ok:false, refused:<its description>}` before any thunk runs - `cadence-core/bin/lib/file-transition.mjs:148-152`
- `cmdRenumber`'s apply block on the primitive, envelope unchanged - `cadence-core/bin/planning.mjs:6023`
- `cmdMilestonePrune`'s directory pass on the primitive, envelope unchanged - `cadence-core/bin/planning.mjs:6495`
- 12 behavioural cases for the module - `cadence-core/bin/file-transition.test.mjs`
- A ninth `HELPERS` census row that reddens if the module's body is copied under any name - `cadence-core/bin/helper-census.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 61460139 | feat(1-1): one home for running an ordered multi-file step list |
| 1 | 2 | f99e8943 | feat(1-1): a pre-flight stage whose refusal writes nothing |
| 1 | 3 | 7d7deb3d | refactor(1-1): cmdRenumber's apply loop runs through the transition module |
| 1 | 4 | 12260963 | refactor(1-1): cmdMilestonePrune's directory pass runs through the transition module |
| 1 | 5 | e84c35c2 | test(1-1): census the transition step loop so 'one, not four' is mechanical |

## Deviations

None - plans executed as written.

## Open items

- `runTransition` does not catch a throw from a caller's pre-flight `satisfied()` thunk; a throw propagates, matching `withPlanningFileLock`'s precedent with `fn`. Stated in the module header rather than branched on. Give it a result arm if a phase-2 caller declares a condition that can genuinely throw while answering.
- The JSDoc at `cadence-core/bin/lib/file-transition.mjs:124` reads "no thunk runs, nothing is written", but only the first clause is enforceable - `satisfied` is arbitrary caller code. Adjudicated down to `low` from the `risk_surface` review (medium raised): both live call sites omit `preflight` entirely, and the same block already bounds its scope at line 141 ("this classifies a transition, it does not police its caller"). Reword the sentence to describe what `runTransition` does rather than to promise a guarantee over caller predicates. Record: `.planning/phases/1/ADJUDICATION-risk_surface-plan-1.json`.
- The pre-flight stage has no production caller yet: `planning.mjs:6023` and `planning.mjs:6495` both omit `preflight`, so it is exercised only by `file-transition.test.mjs`. Phase 2's two callers are what justify it; if they land without using it, it is dead flexibility to delete.

## Goal check

The phase goal was one shared primitive expressing a multi-file state transition - step ordering, pre-flight validation and the completed/failed record - with `renumber` and `milestone-prune` reporting partial state through it rather than each through its own hand-written loop, and neither operation's observable envelope changing. The five commits deliver that. The primitive exists and is singular: `node --test cadence-core/bin/helper-census.test.mjs` reports 10 pass / 0 fail, and the executor's probe run (`cp lib/file-transition.mjs lib/census-probe.mjs`) exited 1 naming both copies, so "one, not four" is mechanically enforced rather than asserted. Both hand-written loops are gone: `grep -n "for (const [op, runStep] of steps)" cadence-core/bin/planning.mjs` and `grep -n "for (const n of completed) {" cadence-core/bin/planning.mjs` each exit 1 with no output, and the two call sites now read `runTransition({steps, discipline: 'stop-at-first-failure'})` at `planning.mjs:6023` and `runTransition({steps, discipline: 'continue-past-failure'})` at `planning.mjs:6495`. The envelopes are unchanged where the plan said they must be: `node --test cadence-core/bin/planning.test.mjs` reports 452 tests / 0 failures with that file unedited, which is the same 452 the plan named, and `node --test cadence-core/bin/file-transition.test.mjs` reports 12 / 0. The blocking `risk_surface` gate fired on the committed range (detector matched `destructive`) and settled: one finding raised at `medium`, adjudicated to `downgraded`, nothing `blocker`/`high` surviving. What is NOT yet delivered by this phase and was never in its scope: the two operations that motivated the primitive - `phase-done` and `release-bump` - still do their own thing; that is phase 2. The one gap worth naming inside phase 1's own scope is that `preflight` shipped with no production caller, so the "pre-flight validation" third of the goal is present as capability and untested against a real caller's conditions until phase 2 uses it.
