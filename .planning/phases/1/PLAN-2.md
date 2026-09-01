---
phase: 1
plan: 2
requirements:
  - RTE-01
files:
  - cadence-core/bin/planning/core.mjs
  - cadence-core/bin/planning/replay-check.mjs
  - cadence-core/bin/planning/status.mjs
  - cadence-core/bin/planning-status.test.mjs
  - cadence-core/bin/planning-files.test.mjs
  # Census holders `lease-check --plan-time` names for the two tasks above:
  # the mergeLayers callsite count, the four refusing trace flags' sentences,
  # the 14 planning error-detail sites, and the 21 phase-argument callsites.
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  # DELIBERATELY NOT DECLARED: cadence-core/bin/planning-replay-check.test.mjs.
  # Task 1 must leave replay-check's envelope byte-identical, and an unleased
  # test file is what makes that unfakeable - lease-check refuses the commit.
  # `censusesAtRisk` over this declared list is empty, so nothing demands it.
---

# Phase 1: The next step it names is one you can take - Plan 2

# SEQUENTIAL: run after PLAN-1, before PLAN-3

## Goal

The planning seam can say what work a phase still has outstanding: one
definition of "this plan's report says it is complete", read by both
`replay-check` and `status`, with `status` carrying the answer on every call.

## Must be true when done

- `planning.mjs status` carries the outstanding-plan fact on EVERY successful
  call, empty rather than absent when nothing is outstanding.
- For any phase, the plan list `status` reports as outstanding is the same list
  `replay-check --phase <N>` returns as `dispatch_set` without `--rerun`, from
  one shared definition rather than two copies.
- A phase holding a SUMMARY, a complete `PLAN.md` report and an unexecuted
  `PLAN-2.md` is derived `executed` AND appears in the outstanding set, and a
  test pins that against a fixture.
- A phase whose plans all report complete appears in no entry, and the key is
  still present as an empty list.
- `CURSOR_STATUSES` still holds exactly its six values, and no new derived
  phase status exists.
- `replay-check`'s emitted envelope is unchanged, proved by its own test file
  passing unedited.

## Context

CONTEXT.md D-02 (additive field, no new status), D-03 (the read lands in
`status`, not a second `replay-check` spawn per executed phase), D-04 (one
definition, hoisted into `core.mjs`) and D-06 (numeric phase resolution, not
widened) bind this plan.

This plan is SEQUENTIAL. It shares no declared file with PLAN-1, but PLAN-3's
`progress.md` route row consumes the `status` key task 2 emits, so it must run
BEFORE PLAN-3 and after PLAN-1. None of its files is a weighed prose surface,
so it touches `weight-budgets.json` not at all.

The four census holders in the `files:` list are declarations, not work: they
are the hand-maintained counts `lease-check --plan-time` says these two tasks
put at risk. Only re-pin one if the change actually moves its count.

Out of scope: `progress.md`, `plan.md` and `plan-gaps.md`, all of which are
PLAN-3's; `execute.md`, which already reads `dispatch_set` off `replay-check`
and needs no edit; widening `derivePhases` to resolve phase directories by
spelling.

## Tasks

### Task 1: One definition of "this plan's report says it is complete"

- **Files:** cadence-core/bin/planning/core.mjs,
  cadence-core/bin/planning/replay-check.mjs,
  cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/trace.test.mjs,
  cadence-core/bin/planning-lease-check.test.mjs,
  cadence-core/bin/phase-spelling.test.mjs
  (anchors: `planNumber`, `firstLine` and `cmdReplayCheck` in
  `replay-check.mjs`; `listPlanFiles` and the `export {` list in `core.mjs`.
  The four test files are census holders, edited only if a count moves.)
- **Action:** Hoist the per-plan report reading out of `replay-check.mjs` into
  `cadence-core/bin/planning/core.mjs` as ONE exported reader, and have
  `replay-check.mjs` import it rather than keep its own copy. The reader takes
  a phase directory and that directory's plan filenames and returns one row per
  plan carrying the plan name, its numeric key, the `reports/plan-<k>.md`
  path RELATIVE to the phase directory, whether that report exists, its first
  line, and whether that first line is exactly `PLAN COMPLETE`. Carry both
  existing rules and their comments across intact: the EXACT filename and never
  a `plan-*.md` glob, because `report-rotation.mjs` mints `plan-<k>.<n>.md`
  siblings and a glob would let an old one decide; and the FIRST line only,
  because a `PLAN COMPLETE` quoted in a Note is prose about a status and not a
  claim of one. `replay-check` keeps composing its own emitted `report` value
  with the `phases/<the raw phase spelling>/` prefix it builds today - that
  prefix must NOT move into the shared reader, because `status` resolves phase
  directories numerically as `String(n)` and would emit a different prefix for
  a sub-phase, so one shared reader that also owned the prefix would make the
  two envelopes disagree. This task changes no behaviour: `replay-check`'s
  flags, refusals, key order and every emitted value stay as they are. Add the
  reader to `core.mjs`'s single `export {` list rather than prefixing its
  declaration, which is the convention that file states. The four census
  holders are declared so a moved count can be re-pinned in the same commit;
  do not edit one whose count this change does not move.
- **Verify:** `node --test cadence-core/bin/planning-replay-check.test.mjs`
  passes with that test file UNEDITED - it is not in this plan's declared
  files, so `lease-check` refuses any commit that touches it, which is what
  makes "the envelope did not change" unfakeable;
  `node cadence-core/bin/test.mjs planning` reports 0 failures;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: `status` reports the outstanding executable plan set

- **Files:** cadence-core/bin/planning/core.mjs,
  cadence-core/bin/planning/status.mjs,
  cadence-core/bin/planning-status.test.mjs,
  cadence-core/bin/planning-files.test.mjs,
  cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/trace.test.mjs,
  cadence-core/bin/planning-lease-check.test.mjs,
  cadence-core/bin/phase-spelling.test.mjs
  (anchors: `derivePhases` in `core.mjs`; `cmdStatus` and its final `ok({...})`
  in `status.mjs`; `CURSOR_STATUSES` in `lib/planning-files.mjs`, imported by
  the test. The four census holders again, edited only if a count moves.)
- **Action:** Using task 1's shared reader, derive per phase the plan files
  whose report does not say complete, and put that fact on the `status`
  envelope as ONE new top-level key beside `deferred`. Name the key
  `outstanding` (this name is the planner's choice, recorded here so PLAN-3's
  workflow prose and the tests agree). Shape it as an ARRAY, one entry per
  phase whose list is non-empty, ordered by phase ascending, each entry
  carrying the phase number exactly as `phases[]` reports it plus the plan
  filenames. It is ALWAYS PRESENT on an `ok:true` answer and is `[]` rather
  than absent when nothing is outstanding - the same always-present rule
  `deferred` carries and for the same reason: a caller has to be able to tell
  "nothing is outstanding" from "this seam predates the field", and a key that
  vanishes in the empty state collapses those into the fail-open answer on a
  surface that decides routing. Resolve each phase directory through the SAME
  path expression `derivePhases` already builds, so a `phases/1.10` tree
  resolves to `phases/1.1` exactly as `status` already reports under its
  `phase-dir-collision` drift kind; do NOT widen `derivePhases` to resolve by
  spelling, because that changes `status` and `audit` behaviour on collision
  trees at the same time and is not this phase's decision (D-06). Mint NO new
  cursor status and NO new derived phase status: `CURSOR_STATUSES` keeps its
  six values, because adding one moves `status`, `audit`, `phase-done` and the
  cursor at once and makes every cursor written by a prior Cadence version read
  as drift (D-02). Do not add a second `replay-check` process spawn anywhere -
  the whole reason this fact lives on `status` is that `/cad-progress`'s route
  table scans ALL phases lowest-first, so a per-phase spawn would cost one
  process per executed phase on every run (D-03). Then add tests to
  `planning-status.test.mjs` over fixtures built with the existing `makeTree`
  harness: a phase with `SUMMARY.md`, a `PLAN.md` whose `reports/plan-1.md`
  first line reads `PLAN COMPLETE`, and a `PLAN-2.md` with no report at all is
  derived `executed` AND is listed in `outstanding` carrying `PLAN-2.md`; the
  same fixture with a complete report for both plans lists that phase nowhere
  and answers `outstanding` as an empty array that is present, not absent; and
  one test asserting the plan list `status` reports for that phase is
  deep-equal to what `replay-check --phase <N>` returns as `dispatch_set` on
  the same fixture without `--rerun`, which is the one-definition claim made
  observable. In `planning-files.test.mjs`, pin `CURSOR_STATUSES` by set
  equality to the six values it holds today.
- **Verify:** `node cadence-core/bin/test.mjs planning` reports 0 failures
  including the new fixture tests; `node cadence-core/bin/planning.mjs status`
  run in this repository prints one JSON line carrying an `outstanding` key;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `npx tsc -p tsconfig.ci.json` exits 0.

## Notes

**Requirements.** This plan declares `RTE-01` - "/cad-progress stops reading a
SUMMARY as the end of the work" (`GH-232`), whose OQ-1 this phase's CONTEXT
settled at D-02 and D-03. It is shared with PLAN-3, which carries the reading
half; this plan is the writing half. The id was minted into `REQUIREMENTS.md`'s
`## Active` at plan time, after the `plan` review raised as a blocker that the
ROADMAP success criterion "`GH-233`, `GH-232` and `GH-218` each trace to a
REQUIREMENTS row pointing at Phase 1" was served by no task in any of these
plans. No task here edits `REQUIREMENTS.md`.

**The field name is the planner's choice.** CONTEXT D-02 locks the SHAPE (an
additive field on the `status` envelope beside `deferred`, no new cursor or
derived status) and leaves the spelling open; `outstanding` is chosen here so
this seam, PLAN-3's workflow prose and both tests name one thing.

**Prior art weighed.** Recalled from `v3.5.7`'s phase 2 UAT: the deferred count
was moved onto the `planning.mjs status` envelope rather than parsed back out
of the cursor's `Next:` text. Task 2 puts the outstanding set on that same
envelope under the same always-present rule.

**Why this plan is separate from PLAN-3.** The seam and the workflow prose were
one plan until `lease-check --plan-time` added the four census holders these
two tasks put at risk; the combined declaration then measured 876,210 B against
the 675,000 B ceiling. Split here rather than dropping a census declaration,
which is the only other way the number comes down and is not available. This
plan declares 620,764 B, PLAN-3 declares 255,446 B.
