---
phase: 1
plan: 3
requirements:
  - RTE-01
files:
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/plan-gaps.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  # Census holder `lease-check --plan-time` names for the two tasks below:
  # the per-workflow seam-invocation counts.
  - cadence-core/bin/seam-calls.test.mjs
---

# Phase 1: The next step it names is one you can take - Plan 3

# SEQUENTIAL: run after PLAN-2, before PLAN-4

## Goal

`/cad-progress` stops reading a SUMMARY as the end of the work - an executed
phase with dispatches still outstanding routes to `/cad-execute` - and
`/cad-plan --gaps` writes a plan the seam can actually see.

## Must be true when done

- With an unexecuted gap plan beside an existing SUMMARY, `/cad-progress`
  routes to `/cad-execute {N}`.
- A phase whose outstanding set is empty still routes to `/cad-verify {N}`: the
  new row narrows the executed case, it does not invert it.
- `/cad-progress` reads the fact off the one `status` line it already fetches,
  and spawns no second seam call per phase.
- The cursor `/cad-progress` writes is unchanged: no new status, no change to
  the `reconcile` step's status mapping.
- `/cad-plan --gaps` on a phase that already has `PLAN.md` writes `PLAN-2.md`
  and leaves the existing `PLAN.md` and its report byte-identical.
- `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`.

## Context

CONTEXT.md D-01 (gap plan naming) and D-10 (route row placement) bind this
plan. It consumes the `outstanding` key PLAN-2's task 2 puts on the
`planning.mjs status` envelope, so it must run AFTER PLAN-2.

This plan is SEQUENTIAL. It shares `cadence-core/bin/prose-agreement.test.mjs`
and `cadence-core/bin/weight-budgets.json` with PLAN-1, and
`cadence-core/workflows/progress.md` plus `cadence-core/bin/weight-budgets.json`
with PLAN-4, so it runs after PLAN-1 and before PLAN-4.

`cadence-core/workflows/progress.md` (13513 B), `plan.md` (29658 B) and
`plan-gaps.md` (939 B) are budgeted at exactly their current byte counts in
`weight-budgets.json`, which holds ceilings - so prose added to any of them
overruns unless the row is re-pinned in the same commit.

Out of scope: the seam itself, which is PLAN-2's; `execute.md`, which already
reads `dispatch_set` off `replay-check` and is fixed by D-01's rename alone; a
`--resume` flag; the auto-resume wording, which is PLAN-4's.

## Tasks

### Task 1: `/cad-progress` routes an executed phase with outstanding dispatches to `/cad-execute`

- **Files:** cadence-core/workflows/progress.md,
  cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/weight-budgets.json,
  cadence-core/bin/seam-calls.test.mjs
  (anchors: the `<step name="derive">` key list and the `<step name="route">`
  table in `progress.md`; the existing
  `progress.md: the deferred count is read off the envelope at both its sites`
  test in `prose-agreement.test.mjs`, whose `region()` helper and D-05
  no-new-cursor-status assertion are the shapes to copy. `seam-calls.test.mjs`
  is a census holder, edited only if this workflow's seam-invocation count
  moves.)
- **Action:** In the `derive` step's list of the keys the one `status` line
  carries, add a bullet for the outstanding-plan key next to the `deferred`
  one, stating what it holds (the plans a phase still has to dispatch, the same
  fact `execute.md` reads off `replay-check`'s `dispatch_set`) and that it is
  ALWAYS present, so an absent key means a seam that predates the field and
  never "nothing is outstanding". The key is named `outstanding`, which PLAN-2
  task 2 puts on the envelope. In the `route` table insert exactly ONE new row,
  between `Lowest **planned** phase` and `Lowest **executed** phase`: the
  lowest executed phase that key names routes to `/cad-execute {N}`. Below the
  table, say why in the prose the surrounding rows already use: a SUMMARY on
  disk is not the end of the work, a `/cad-plan --gaps` plan can sit beside it
  unexecuted, and this row NARROWS the executed case rather than inverting it -
  the existing `Lowest **executed** phase` row stays exactly where it is and
  still routes to `/cad-verify {N}`, which is what an empty outstanding set
  gets. Add no second seam call: the fact rides the `status` line this step
  already fetches, because the route table scans all phases lowest-first and a
  per-phase call would cost one process spawn per executed phase on every run
  (D-03). Leave the `reconcile` step untouched: the derived status stays
  `executed`, its status mapping is unchanged, and the cursor this workflow
  writes is unchanged - a status outside the seam's agreement map would be
  reported as `cursor` drift and rewritten by the very next `/cad-progress`
  (D-10). Add one test to `prose-agreement.test.mjs`, built on the same
  `regionLabels`/`region` helpers the existing progress.md test uses: the
  `derive` region names the new key and says it is always present; the `route`
  region carries the new row, it names `/cad-execute`, and its index sits below
  `Lowest **planned** phase` and above `Lowest **executed** phase`; and the
  `reconcile` region does NOT mention the key, the mirror of the assertion
  already made there for the deferred queue. Re-pin the
  `cadence-core/workflows/progress.md` row in `weight-budgets.json` to the
  file's new `wc -c` in this same commit.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes
  including the new row-order test;
  `grep -n 'Lowest' cadence-core/workflows/progress.md` shows the new row's
  line number between the planned row's and the executed row's;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`.

### Task 2: `/cad-plan --gaps` writes the next free plan number

- **Files:** cadence-core/workflows/plan-gaps.md,
  cadence-core/workflows/plan.md,
  cadence-core/bin/weight-budgets.json,
  cadence-core/bin/seam-calls.test.mjs
  (anchors: step 3 of `plan-gaps.md`; `<step name="load_phase">` item 3 and the
  `Write .planning/phases/{N}/PLAN.md per ...` block inside
  `<step name="spawn_planner">` in `plan.md`. `seam-calls.test.mjs` is a census
  holder, edited only if either workflow's seam-invocation count moves.)
- **Action:** Make the gaps path write a NEW numbered plan instead of
  overwriting `PLAN.md`. In `plan-gaps.md`, before it rejoins `plan.md` at
  `spawn_planner`, add a step that lists `.planning/phases/<N>/PLAN*.md` and
  resolves the next free plan number, counting a bare `PLAN.md` as plan 1 - so
  a phase holding `PLAN.md` alone gets `PLAN-2.md` - and carries that exact
  filename forward as the planner's write target. In `plan.md`'s
  `spawn_planner` prompt, where the block today tells the planner to write
  `.planning/phases/{N}/PLAN.md`, add a gaps-mode line naming that resolved
  target instead. Do NOT edit `skills/cad-planner-contract/SKILL.md`: it
  already states "write the next free plan number (an unnumbered PLAN.md counts
  as plan 1)", and the defect is that the coordinator's prompt overrides it by
  naming `PLAN.md`. Also correct `plan.md`'s `load_phase` item 3, whose
  `(and not --gaps)` exemption from the overwrite question now has a different
  reason: a gaps plan writes a new numbered file and overwrites nothing, so
  there is nothing to ask about. Record the measured reason in the prose you
  add rather than leaving it to be rediscovered: on a fixture on 2026-08-31,
  with the gap plan written over `PLAN.md` the prior run's `reports/plan-1.md`
  still read `PLAN COMPLETE` and `replay-check` answered `dispatch_set: []`, so
  nothing routing off the seam could see the gap plan at all, and renaming it
  `PLAN-2.md` in the same fixture returned `dispatch_set: ["PLAN-2.md"]` -
  which is what also makes `/cad-execute` reach it (D-01). An mtime comparison
  was rejected: it does not survive a fresh clone or a checkout. Re-pin the
  `cadence-core/workflows/plan-gaps.md` and `cadence-core/workflows/plan.md`
  rows in `weight-budgets.json` to their new `wc -c` in this same commit.
- **Verify:** First the wiring, which the fixture below cannot reach:
  `grep -n 'PLAN.md' cadence-core/workflows/plan.md` shows the `spawn_planner`
  write-target line carrying a gaps-mode alternative that names the RESOLVED
  filename rather than a literal `PLAN.md`, and
  `grep -c 'next free' cadence-core/workflows/plan-gaps.md` is non-zero. Without
  this pair the fixture below passes on a hand-made file while a real
  `/cad-plan --gaps` still overwrites `PLAN.md` - the `plan` review raised
  exactly that at high severity. Then the behaviour: build a scratch fixture
  under this run's own temp directory
  holding `<root>/phases/1/PLAN.md` and `<root>/phases/1/reports/plan-1.md`
  whose first line is `PLAN COMPLETE`; record `sha256sum` of both files;
  follow the resolution step `plan-gaps.md` now states and confirm it names
  `PLAN-2.md`; create that file; then
  `node cadence-core/bin/planning.mjs replay-check --phase 1 --dir <root>`
  returns `dispatch_set: ["PLAN-2.md"]` and the two `sha256sum` values are
  unchanged. `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`.

## Notes

**Requirements.** This plan declares `RTE-01` - "/cad-progress stops reading a
SUMMARY as the end of the work" (`GH-232`). It is shared with PLAN-2, which
writes the `outstanding` key this plan's route row reads; that shared id is a
second reason the two are strictly ordered. The id was minted into
`REQUIREMENTS.md`'s `## Active` at plan time, after the `plan` review raised as
a blocker that the ROADMAP success criterion "`GH-233`, `GH-232` and `GH-218`
each trace to a REQUIREMENTS row pointing at Phase 1" was served by no task in
any of these plans. No task here edits `REQUIREMENTS.md`.

**Why this plan is separate from PLAN-2.** The seam and this workflow prose
were one plan until `lease-check --plan-time` added the four census holders the
seam tasks put at risk; the combined declaration then measured 876,210 B
against the 675,000 B ceiling. The split is by declared bytes, not by concern:
PLAN-2 declares 620,764 B and this plan 255,446 B, and this plan reads a key
PLAN-2 writes, so the two are strictly ordered.
