---
phase: 2
plan: 1
requirements:
  - EXP-03
files:
  - cadence-core/workflows/execute.md
  - cadence-core/references/execute-parallel.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  - docs/rationale/execute.md
---

# Phase 2: Refuse the replay - Plan

## Goal

A session that dies between the last task's commit and the SUMMARY write leaves
a phase deriving `planned` with real commits on the branch. The next
`/cad-execute <N>` must stop instead of dispatching, so the user pays nothing
and the run record claims nothing.

## Must be true when done

- On a phase deriving `planned` where EVERY plan file has a
  `reports/plan-<k>.md` whose first line reads `PLAN COMPLETE`,
  `/cad-execute <N>` stops inside `locate` - naming the phase, each report file
  it read, and both remedies (`/cad-undo <N>`, or `--rerun`) - with no
  protected-branch question asked, no `phase_start` line appended to
  `.planning/trace.jsonl`, and no executor dispatched.
- The stop does NOT fire for a phase with plans and no `reports/` directory,
  nor for one whose report's first line reads `PLAN PARTIAL` or
  `PLAN CHECKPOINT: <type>`; both still reach the dispatch.
- `/cad-execute <N> --rerun` reaches the dispatch on the very phase the stop
  would otherwise refuse.
- A phase whose plan 1 report reads `PLAN COMPLETE` and whose plan 2 has no
  report reaches the dispatch with plan 1 not re-dispatched: `.planning/trace.jsonl`
  shows exactly one executor dispatch for that run, keyed to plan 2.
  (human-verify: needs a live /cad-execute run)
- Against the spike's own probe shape - tasks committed, report on disk, no
  `SUMMARY.md` - the run stops with zero executors dispatched, verified by the
  absence of a `dispatch` event in `.planning/trace.jsonl` for that run.
  (human-verify: needs a live /cad-execute run)
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with
  `weight-budgets.json` re-pinned to `execute.md`'s new size.

## Context

CONTEXT.md's decisions bind this plan and are implemented exactly: D-01 the
guard lives in `execute.md`'s `locate` step and NOT in `derivePhases`; D-02 it
fires only when every plan has a `PLAN COMPLETE` report; D-03 the report file's
text is the whole discriminator and `locate` makes no git read to cross-check
it; D-04 no resume path and no subset-execution flag, `--rerun` stays the only
override. Out of scope by the same file: a new derived status, a resume path, a
`<report>` digest field for "no new commits" (deferred to its own issue), and
the planner-contract line about end-state criteria (deferred).

Two facts read out of the tree that bind the tasks. `cadence-core/workflows/execute.md`
is 29001 bytes and its `weight-budgets.json` entry is 29001 - a CEILING with
zero headroom, so every task that adds a byte to it re-pins that entry or
`self-verify`'s `budget-overrun` arm fails. And `prose-agreement.test.mjs:717`
(the `#195` test) finds its refusal arm by the FIRST `/cad-undo` inside the
`locate` step, so a new arm naming `/cad-undo` must sit BELOW the existing
`executed`/`complete` arm or that test reads the wrong one.

## Tasks

### Task 1: Stop the run in `locate` when every plan already reports complete

- **Files:** cadence-core/workflows/execute.md (`<step name="locate">`, and the
  "Open a report file at two kinds of moment only" sentence in
  `<step name="execute_sequential">`), cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Add one bullet to `locate`, placed immediately AFTER the existing
  "DERIVED status `executed` or `complete`, and no `--rerun` -> stop:" bullet
  and before the "Read the phase goal from ROADMAP.md" paragraph. Below that
  arm and never above it: `prose-agreement.test.mjs:717` locates the arm it
  pins with `arms.find((a) => a.includes('/cad-undo'))`, so a replay arm
  carrying `/cad-undo` placed higher would be read as the arm that must trigger
  on `executed` and `complete`, and that test would fail on a correct change.
  Give the new arm the same `-> stop:` shape its neighbours use, so its trigger
  clause can be read apart from its rationale.
  The trigger, exactly: no `--rerun` token on the command line, AND for EVERY
  plan file the phase lists, `<plandir>/reports/plan-<k>.md` exists and its
  FIRST LINE reads exactly `PLAN COMPLETE`. `k` is the number in `PLAN-<k>.md`
  and `1` for a bare `PLAN.md`, the same derivation `<report_file>` in
  `skills/cad-executor-contract/SKILL.md` states. Say that the `status`
  envelope OMITS `plans` for a phase holding exactly one `PLAN.md`
  (`bin/planning/status.mjs:288-290` lists them only when they deviate from
  that), so an absent `plans` key means one plan at `k` of 1 and never an empty
  set that would make the trigger vacuously true.
  Three constraints inside the arm, each with its reason on the page. Read the
  FIRST LINE only - `head -1` and not a whole-file Read - because the report
  holds the task table this workflow deliberately keeps out of the
  orchestrator's context and `locate` has no use for it; the first line is also
  the only place the status word is grammatically pinned, so a `PLAN COMPLETE`
  quoted in a Note or an open item cannot fire the stop. Name the exact
  per-plan filenames and never a `plan-*.md` glob: `bin/lib/report-rotation.mjs`
  mints `plan-<k>.<n>.md` siblings when an executor rotates a prior run's
  report aside, and a glob would let an older run's rotated report decide this
  one. And make no git read here (D-03): the report file is the whole
  discriminator, on the spike's evidence that both probes had one.
  State the not-fire cases in the arm rather than leaving them to inference -
  no `reports/` directory, a missing report for any one plan, or a first line
  reading `PLAN PARTIAL` or `PLAN CHECKPOINT: <type>` - each is a genuine
  continuation and the run proceeds. The stop text names the phase number, each
  report path it read, and both remedies: `/cad-undo <N>` then
  `/cad-execute <N>`, or `/cad-execute <N> --rerun` to run over the record
  anyway. Close the arm with the same ordering sentence the neighbouring arm
  carries - stop HERE, before `git_guard`: before the protected-branch guard,
  before the `phase_start` trace anchor, and before any executor dispatch.
  Then amend `execute_sequential`'s "Open a report file at two kinds of moment
  only" sentence to name this read as a third moment, bounded to the status
  line: leaving it at two makes the file contradict itself the moment this arm
  lands, and the rail it protects (never re-inline the table, never back into a
  dispatch prompt) is unchanged and must stay stated.
  Pin the arm in `cadence-core/bin/prose-agreement.test.mjs`, in a new test
  beside the `#195` one and reusing that file's existing `doc` and `stepBody`
  helpers. Find the arm by `PLAN COMPLETE` and assert exactly one arm carries
  it - not by `/cad-undo`, which two arms now share. Assert on the trigger
  clause taken before `-> stop:`, so a rationale sentence below cannot satisfy
  it: it names `PLAN COMPLETE`, it quantifies over every plan rather than any
  plan, and it excludes `--rerun`. Assert on the whole arm: it names the
  `reports/plan-<k>.md` path shape, it carries no `plan-*.md` glob, it names
  `PLAN PARTIAL` as a case that does not fire, and it names both `/cad-undo <N>`
  and `--rerun`. Assert the ordering twice over, since both halves can regress
  silently: the arm's index inside `locate` is greater than the
  `executed`/`complete` arm's, and `<step name="locate">` opens before
  `<step name="git_guard">` in the file. Do not assert any prose the same
  commit invents beyond these, and pin no byte counts - the `#195` test's own
  header states why a literal this commit writes could never fail.
  Last, re-pin the `cadence-core/workflows/execute.md` entry in
  `cadence-core/bin/weight-budgets.json` to the count
  `node cadence-core/bin/weight.mjs` reports for that surface after the edit.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes, the `#195` test
  included. Deleting the new arm's trigger clause from `execute.md` and
  re-running that group FAILS naming the missing arm, and re-running it again
  with the arm restored passes - the deletion is reverted before the commit.
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` problem for `cadence-core/workflows/execute.md`.

### Task 2: Dispatch only the plans that have no completed report

- **Files:** cadence-core/workflows/execute.md (`<step name="locate">` and the
  first sentence of `<step name="execute_sequential">`),
  cadence-core/references/execute-parallel.md (step 1's dispatch sentence),
  cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Task 1's read already answers the question per plan; this task
  spends that answer. In `locate`, right after the new arm, name the DISPATCH
  SET: the phase's plan files minus every plan whose `<plandir>/reports/plan-<k>.md`
  first line reads `PLAN COMPLETE`. Under `--rerun` the dispatch set is every
  plan the phase lists, unchanged, which is what keeps that override meaning
  what it says. State the rail once and for both paths - no step below
  dispatches a plan outside the dispatch set, on the sequential path or the
  parallel one - and state the two things the set does NOT govern, because each
  would otherwise be guessed at: the `plan-overlap` seam call in `choose_path`
  is a question about the phase's DECLARED plan files and stays exactly as it
  is, an `overlaps` entry naming only skipped plans still routing sequential
  because widening toward sequential is the safe direction and re-deciding a
  seam's answer in prose is how the two come to disagree; and the `summary`
  step still reads EVERY plan's report, a skipped plan's included, because
  SUMMARY.md is the phase's record and that plan's work is part of the phase.
  A skipped plan is not dispatched, so it gets no bracket, no `risk-check`
  range and no `diff` fire - that follows from not being dispatched and needs
  no separate rule.
  Then change `execute_sequential`'s opening sentence from "For each plan in
  order" to iterate the dispatch set in order, leaving the rest of that
  sentence (one cad-executor, the spawn-agent seam, the normal working tree,
  wait before the next) byte-identical.
  Then do the same at the parallel path's OWN dispatch site: in
  `cadence-core/references/execute-parallel.md`, change step 1's "dispatch one
  cad-executor per plan" to dispatch one per plan IN THE DISPATCH SET, leaving
  the rest of that step (the batch key, the worktree branch name, the ONE-message
  batch, the resolve-once rule) byte-identical. The `locate` rail names both
  paths, but this file is the site that ACTS on the parallel one and today its
  sentence still says "per plan" - a rail stated at one step and contradicted at
  the step that dispatches is how plan 1 gets re-dispatched under AC3 on a
  non-overlapping two-plan phase. Do NOT edit `<step name="execute_parallel">`
  in `execute.md`: that step's region is anchored by the deferred-read register
  (`bin/lib/deferred-reads.mjs`), whose consult-site rule is checked per anchor,
  and a second sentence naming that reference there is new surface for no
  behaviour - the constraint is on the ANCHOR in `execute.md`, not on the
  consulted file, which is why the edit lands in the consulted file.
  Pin it in `cadence-core/bin/prose-agreement.test.mjs`, in the same test as
  task 1's or a sibling beside it: `locate` defines a dispatch set excluding a
  plan whose report reads `PLAN COMPLETE` and names both paths;
  `execute_sequential`'s dispatch sentence iterates that set rather than every
  plan; `execute-parallel.md`'s step 1 dispatch sentence names the dispatch set
  rather than every plan; and the `summary` step still reads every plan's
  report. Re-pin `cadence-core/bin/weight-budgets.json` for BOTH
  `cadence-core/workflows/execute.md` and
  `cadence-core/references/execute-parallel.md` from
  `node cadence-core/bin/weight.mjs`.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes. Reverting
  `execute_sequential`'s sentence to "For each plan in order" makes the new
  test FAIL naming that sentence, and the revert is undone before the commit.
  Reverting `execute-parallel.md` step 1's sentence to "dispatch one
  cad-executor per plan" ALSO makes that group FAIL naming that sentence, and
  that revert is undone before the commit too - two reverts, two failures, or
  the parallel half is unpinned.
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` problem for either
  `cadence-core/workflows/execute.md` or
  `cadence-core/references/execute-parallel.md`.

### Task 3: Record why the guard reads a file and not the derivation

- **Files:** docs/rationale/execute.md
- **Action:** Add two `## locate - ...` sections beside the two already there,
  in the file's existing voice: short, reason-first, no restatement of the
  workflow's own instructions. The runtime file carries the rule; this file
  carries why, and it is read before EDITING `execute.md` - which is what stops
  the next editor removing a step for looking redundant.
  First section: why the stop lives here and not in `derivePhases` (D-01).
  Minting a new derived status is the more honest place, because the wrong
  answer IS the derivation's - `bin/planning/core.mjs:191-206` moves nothing on
  committed work - but it teaches `status`, `audit`, `phase-done` and the
  cursor a new value at once and every consumer switching on the status string
  would have to learn it. `locate` already stops before `git_guard` and the
  `phase_start` anchor, so the ordering comes free.
  Second section: why the discriminator is the report FILE and why the trigger
  quantifies over every plan (D-03, D-02). Cite
  `.planning/spikes/execute-replay-blast-radius/SPIKE.md`: two real executor
  dispatches against already-committed work produced zero commits and zero byte
  changes, so the cost is money and a false record rather than a corrupted
  tree - which is why this is a guard and not a resume path - and both probes
  had the report file on disk with no `SUMMARY.md` beside it. Record that the
  rejected simpler rule, any `PLAN COMPLETE` report is a replay, would strand a
  multi-plan phase mid-flight and force a `/cad-undo` of commits that are fine.
  Record the one state this guard cannot see, as a stated fail-open rather than
  an omission: a parallel-path plan whose report was written inside an unmerged
  worktree leaves nothing at `.planning/phases/<N>/reports/` for `locate` to
  read, so the stop does not fire for it and that run behaves as it does today.
- **Verify:** `grep -n '^## locate' docs/rationale/execute.md` lists four
  sections; `grep -n 'worktree' docs/rationale/execute.md` shows the fail-open
  named inside the new replay section. `node cadence-core/bin/test.mjs` is
  green and `node cadence-core/bin/self-verify.mjs` reports `ok:true` -
  `docs/` is not a measured prose surface, so no budget moves for this task.

## Notes

Both of CONTEXT's flagged assumptions were checked before the tasks were
written, and both resolve.

The first - that `execute.md` has no per-plan skip today - HOLDS.
`execute_sequential` opens "For each plan in order: dispatch ONE cad-executor",
with no report read anywhere ahead of it, so task 2 adds surface the file does
not have rather than reusing a branch.

The second - that `reports/plan-<k>.md` hangs off the plan file's OWN directory,
which is not always `.planning/phases/<N>/` - resolves by notation rather than
by a new rule: the tasks keep the file's existing `<plandir>` spelling, which
for every plan `/cad-execute` dispatches is `.planning/phases/<N>/`. The other
`<plandir>` this repository has, `.planning/tasks/<slug>/`, belongs to
`workflows/task.md` and never enters this workflow. What remains is the
unmerged-worktree case, which is a fail-open and is written down in task 3
instead of being papered over.

Prior art. `.planning/CAPTURE.md` carries "Interrupted execution can replay
already-committed work" as the filed observation behind GH-137. Two earlier UAT
items of exactly this shape were both recorded human-verify and are the
precedent for tagging the live-run truths that way here: "Live /cad-execute
refuses an already-executed phase" (v3.5.6 phase 1 UAT) and "/cad-execute <N>
--rerun completes with no override of a blocking gate" (v3.5.6 phase 3 UAT).

Plan shape: one plan, as CONTEXT directs. The three tasks share
`cadence-core/workflows/execute.md` and `cadence-core/bin/weight-budgets.json`,
so no split was available in any case.

Plan review, open items. The `plan` trigger (cross-model, `openai`, tier
`balanced`, effort `medium`) raised two findings. The high one is FIXED in task
2: the parallel path's own dispatch sentence in
`cadence-core/references/execute-parallel.md` still read "per plan", so a rail
stated only in `locate` left AC3 open on a non-overlapping two-plan phase.

The medium one is recorded here rather than folded in, because the blocking gate
acts on blocker/high: task 1's prose test asserts the trigger clause NAMES
`PLAN COMPLETE`, quantifies over every plan and excludes `--rerun`, but it does
not assert the clause pins the FIRST LINE reading EXACTLY that. The arm's own
prose does state it (task 1 Action), so this is a test that under-pins prose that
is correct - a later edit loosening the arm to a substring or whole-body match
would still pass. If the executor can add that one assertion without inventing
prose, it should; it is not a task and it is not a gate.
