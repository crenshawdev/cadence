---
phase: 1
plan: 1
requirements:
  - PHS-03
files:
  - cadence-core/workflows/task.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The next step it names is one you can take - Plan 1

# SEQUENTIAL: run first, before PLAN-2, PLAN-3 and PLAN-4

## Goal

`/cad-task` stops charging an engineer branch questions for work it is not
going to do, and its phase-sized arm names a door that exists on the repository
it is actually standing in.

## Must be true when done

- A `/cad-task` run whose description classifies as phase-sized prints its
  phase-sized message and stops without ever asking a protected-branch or an
  integration-branch question.
- The inline and planned arms still pass the rail-1 guard before their first
  commit, and there is still exactly one guard step in the file.
- The phase-sized arm run in a repository with no `.planning/` directory names
  `/cad-adopt` and `/cad-new-project`, and never `/cad-phase add`.
- The phase-sized arm run on an initialised project still resolves the phase
  number from `planning.mjs status` and `total + 1`, and still names
  `/cad-phase add` before `/cad-context` and `/cad-plan`.
- The `PHS-02` prose tests read the WHOLE arm: a multi-paragraph arm can no
  longer fall outside the slice and pass those assertions vacuously.
- `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`.

## Context

CONTEXT.md D-07 (guard site) and D-08 (status call) and D-09 (test movement)
bind this plan; D-05 binds task 2. This plan is SEQUENTIAL and runs FIRST: it
shares `cadence-core/bin/prose-agreement.test.mjs` and
`cadence-core/bin/weight-budgets.json` with PLAN-3, and
`cadence-core/bin/weight-budgets.json` with PLAN-4. It shares no file with
PLAN-2.

`cadence-core/workflows/task.md` is budgeted at EXACTLY its current 14991 B in
`cadence-core/bin/weight-budgets.json`, so any prose either task adds overruns
the ceiling unless the row is re-pinned in the same commit.

Out of scope: the `<guardrails>` mid-task re-route sentence, which already
names `/cad-phase add` and is pinned by `PHS-02 (4)`; anything under
`/cad-progress` or the auto-resume claims, which are PLAN-2's and PLAN-3's.

## Tasks

### Task 1: Run the branch guard after classification, on the two arms that commit

- **Files:** cadence-core/workflows/task.md,
  cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/weight-budgets.json
  (anchors: `<step name="git_guard">`, `<step name="scope">` and
  `<step name="bracket">` in `task.md`; the `execute.md` step-order assertion
  in `prose-agreement.test.mjs` is the shape to copy)
- **Action:** Move the EXISTING `<step name="git_guard">` block so it opens
  after `<step name="scope">` closes and before `<step name="bracket">` opens,
  and re-scope its body to the inline and planned arms. Classification costs
  one read of the task description and nothing else, so it runs first and the
  guard is paid only by work that will reach a commit. Keep ONE guard step:
  copying a guard sentence into each arm instead would ship two copies of the
  same rail in one file, and they drift. Placing it before `bracket` rather
  than after is load-bearing - the guard's `ask` arm has an Abort option, and
  an abort taken after the bracket is open would leave a dispatch event with
  nothing to close it, which `task.md`'s own `bracket` step already explains is
  why that step excludes the too-big arm. Do not reword the
  `<success_criteria>` line "Protected-branch guard applied before the first
  commit": it still holds, because the two arms that commit still run the guard
  before their first commit. Do not add a second guard call anywhere and do not
  touch `references/git-guard.md`. Then add one test to
  `prose-agreement.test.mjs` beside the `PHS-02` block: `task.md` opens
  `<step name="scope">` before `<step name="git_guard">` and `git_guard` before
  `<step name="bracket">` (the same index-comparison shape the file already
  uses to assert `execute.md`'s `locate` opens before its `git_guard`), and the
  `git_guard` step body names the inline and planned arms. Finally re-pin the
  `cadence-core/workflows/task.md` row in `weight-budgets.json` to the file's
  new `wc -c` byte count in this same commit.
- **Verify:** `grep -n '<step name=' cadence-core/workflows/task.md` lists
  `scope` before `git_guard` and `git_guard` before `bracket`, and
  `grep -c '<step name="git_guard">' cadence-core/workflows/task.md` prints 1;
  `node --test cadence-core/bin/prose-agreement.test.mjs` passes including the
  new step-order test; `node cadence-core/bin/self-verify.mjs` prints
  `"problems":[]`.

### Task 2: The phase-sized arm branches on what is actually on disk

- **Files:** cadence-core/workflows/task.md,
  cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/weight-budgets.json
  (anchors: the `- **Too big**` bullet inside `<step name="scope">` in
  `task.md`; `tooBigArm` and the five `PHS-02` tests in
  `prose-agreement.test.mjs`)
- **Action:** Rewrite the `- **Too big**` arm so the `planning.mjs status` call
  it already makes decides the route instead of being read unconditionally for
  `total + 1`. On `ok:true`, nothing changes: take `total + 1` as the phase
  number and print the existing sequence, `/cad-phase add $TASK` first and then
  `/cad-context {N}` and `/cad-plan {N}`, with the capture alternative. On
  `ok:false` with reason `no-planning-dir`, do NOT compute `total + 1` - there
  is no roadmap to add a phase to - and instead NAME BOTH doors and let the
  user pick: `/cad-adopt` for a repository that already has code and history,
  `/cad-new-project` for a blank page. That branch must not name
  `/cad-phase add` at all, because it is the command that is unreachable there.
  On any other `ok:false`, relay the envelope's `reason` and `hint` and stop,
  the way `progress.md`'s derive step already relays a seam refusal. The arm
  NAMES the two doors rather than measuring which one applies: Cadence has no
  seam for "existing code" versus "blank repository" - `status` collapses every
  treeless repository into the one `no-planning-dir` reason - and a
  `git rev-parse --show-toplevel` probe here would make `/cad-task` answer
  differently than `/cad-progress` on the same tree (D-05). Add no
  `[ -d .planning ]` filesystem probe: the seam's own answer is the gate, and
  two ways of asking "is there a project here" must not ship in one workflow
  (D-08). Keep the initialised-project branch FIRST in the prose so
  `/cad-phase add` still precedes `/cad-context` and `/cad-plan` in reading
  order, which is what `PHS-02 (1)` pins. Then move the `PHS-02` tests with the
  arm IN THIS SAME COMMIT (D-09): `tooBigArm` currently slices from the
  `- **Too big**` marker to the FIRST BLANK LINE, so a two-branch arm written
  as separate paragraphs falls outside the slice and every one of those
  assertions passes vacuously - widen the slice to run from the marker to the
  end of the `scope` step body, and add assertions that the slice names
  `/cad-adopt` and `/cad-new-project` and that the treeless branch does not
  name `/cad-phase add`. Re-pin the `cadence-core/workflows/task.md` row in
  `weight-budgets.json` to the file's new `wc -c` in this same commit.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes,
  including the widened-slice assertions - and the widened slice is provably
  non-vacuous because it now matches `/cad-adopt` and `/cad-new-project`, two
  strings the old first-blank-line slice could not reach;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `node cadence-core/bin/test.mjs prose` reports 0 failures.

## Notes

**Requirements.** This plan declares `PHS-03` - "/cad-task classifies before it
guards, and its phase-sized arm stops assuming a planning tree" (`GH-233`),
successor to `PHS-02`, which fixed the same arm's destination and not its
reachability. The id was minted into `REQUIREMENTS.md`'s `## Active` at plan
time, after the `plan` review raised as a blocker that the ROADMAP success
criterion "`GH-233`, `GH-232` and `GH-218` each trace to a REQUIREMENTS row
pointing at Phase 1" was served by no task in any of these plans. No task here
edits `REQUIREMENTS.md`; `/cad-plan`'s `seed-reqs` seeds the Traceability row
and `/cad-verify` is still the only writer of any status but `Pending`.

**Why four sequential plans.** CONTEXT.md's `Plan shape` directive names three
separable surfaces; the middle surface is delivered as two plans (PLAN-2 the
seam, PLAN-3 the workflow prose) because one plan over both exceeded the
declared-bytes ceiling once `lease-check` added the four census holders the
seam work puts at risk. The plans are NOT independent slices: PLAN-1 and PLAN-3
both declare `cadence-core/bin/prose-agreement.test.mjs`, PLAN-3 and PLAN-4
both declare `cadence-core/workflows/progress.md`, and PLAN-1, PLAN-3 and
PLAN-4 all declare `cadence-core/bin/weight-budgets.json`. So they run
SEQUENTIALLY in number order and never on the parallel path - which
`plan-overlap` also routes on its own, since it reports the shared
declarations.
