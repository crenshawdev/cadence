---
phase: 2
plan: 2
requirements:
  - RBK-01
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/workflows/plan.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/seam-calls.test.mjs
---

# Phase 2: The read-back gate - Plan 2

## Goal

`/cad-plan` runs the count at both of its points and REPORTS a plan citing zero
of a non-empty surfaced set, without refusing it, re-dispatching the planner or
editing the plan - and the figures reach `.planning/trace.jsonl` as their own
`outcome`-family event, so the legitimate-zero rate is measurable across phases
rather than visible only in the session that produced it.

## Must be true when done

- A `/cad-plan` run writes the recall envelope it was actually handed to a file
  belonging to that run, and the count reads that file rather than re-running
  recall from a re-typed query.
- The count runs twice on a run - once after the planner returns and before the
  plan-checker gate, once on the plan as it finally stands - and the record
  carries the pair.
- The report names both counts and calls out a plan that cited zero of a
  non-empty surfaced set; the plan file's bytes are unchanged by it, no second
  planner dispatch occurs, and the workflow proceeds to its next step.
- The `--inline` under-threshold path gets the same payload and the same two
  counts as the dispatch path.
- `.planning/trace.jsonl` gains an `outcome`-family event carrying both figures
  under the run's correlation id, and the seam's envelope says `written` plus a
  `reason` when it is false.
- `cadence-core/workflows/plan.md` sits inside a re-pinned weight budget and a
  re-pinned seam-invocation census, each carrying the measurement that justified
  it.

## Context

Runs AFTER plan 1: the subcommand this plan invokes and the envelope this plan
extends are plan 1's, and both declare `cadence-core/bin/planning.mjs` and
`cadence-core/bin/planning.test.mjs`.
Locked by `phases/2/CONTEXT.md`: D-08 makes the seam append its OWN
`outcome`-family event in code and report `{written, reason}` on the envelope,
the `risk-check run` precedent, rather than leaving `/cad-plan` to issue a
separate `trace append` and retype both figures onto flags. D-03 makes the
surfaced set a payload FILE holding the envelope the plan-time call actually
returned, because the query at `plan.md:117` is model-authored and re-typed
terms produce a different top-5. D-05 runs the count at BOTH points because
`plan.md:309-313` drives a checker revision that edits the plan and
`plan.md:356-359` applies an adjudicated survivor that edits it again. D-12
extends both counts to the `--inline` path. D-13 forbids putting `recall` and
`planning.mjs` together on any line of new prose. D-14 re-pins the weight budget
and the seam-call census. D-15 bounds the trace at 1 MiB and makes
`written: false` the only place a caller learns the write was dropped.
Advisory, never a refusal: this phase never blocks a plan, never re-dispatches
the planner and never edits a plan to add a citation.

## Tasks

### Task 1: The seam records its own count

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Make the `cite-count` handler append its own event through
  `appendEvent` before the envelope is emitted, exactly as `cmdRiskCheckRun`
  does and for the stated reason: an in-code producer means the coordinator
  never retypes a figure onto a flag, which is the transcription surface this
  file already condemns. The event is `family: 'outcome'` with its own event
  name - `outcome` is one of `FAMILIES`, so it counts where `renderTrace`
  counts. Carry the phase in the caller's own spelling, the `point` when one was
  given, the `backend` when it is `none`, and both figures with their id lists
  and the `cited_by_kind` breakdown, so the record answers the same question the
  envelope does without a reader having to join back to a session. The write may
  NOT change the verdict and `appendEvent` never throws and never speaks, so its
  `{written, reason}` rides the envelope as its own field, present on every
  path, with the reason only when the write failed - `MAX_TRACE_BYTES` is
  1,048,576, `appendEvent` stats before writing and `.planning/trace.jsonl` was
  419,756 B holding 1,762 events on 2026-08-23, so `size-cap` is a stated
  failure mode and a `written: false` is the only place a caller could learn the
  figures were dropped (D-15). Do not name the event anything containing
  `recall`, and do not add a `--tokens`, `--role` or any lifecycle field to it -
  this seam opens no bracket and bills no worker. Add the seam-side assertions
  to the `cite-count` section plan 1 opened: the event lands under the phase's
  correlation id, it carries both figures, and a trace file at the cap comes
  back `written: false` with its reason on the envelope while the counts
  themselves are unchanged.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs
  cadence-core/bin/trace.test.mjs` reports 0 failures, and a fixture run's
  `trace.jsonl` last line parses as an `outcome`-family object carrying the
  surfaced and cited figures under the same `corr` the phase's other events
  carry.

### Task 2: The surfaced set reaches disk as this run's payload

- **Files:** cadence-core/workflows/plan.md
- **Action:** At `spawn_planner`, the gated call that fetches prior memory keeps
  its query and its `<recalled_memory>` rendering exactly as they are, and gains
  a destination: this run's own scratch directory, made with `mktemp -d` on the
  template `references/conventions.md` states, a run token written beside it,
  the call's output redirected into a file in that directory, and the directory
  and token ECHOED once so the two later blocks can name them as literals - the
  split-block rule that reference states, and the shape
  `workflows/report.md:31` and `references/review-triggers.md:202` already ship.
  The step still needs the results in hand to build the block, so read them back
  in the SAME invocation by chaining on the write with `&&`; a redirect that
  leaves the step blind would cost a second round trip on a response measured at
  8,617 B, under the threshold, which is why `lib/bulk-output.mjs` registers this
  site as owing no transport. Keep the registered call string intact: the row in
  `lib/bulk-output.mjs` for this surface matches the call as written up to the
  redirect, so appending a redirect keeps it matching and moving the query or
  the flags would not. Never assemble that scratch path from a shell variable
  read in another block, and never spell a fixed path under `/tmp` -
  `lib/scratch-path.mjs` files both. Say in one line why the file exists: it is
  the surfaced set the count reads, and re-running the search from a re-typed
  query would produce a different top-5 so a plan that cited every real hit
  would report zero (D-03).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` reports no
  `bulk-output-unregistered`, `bulk-output-inline`, `scratch-shared-path` or
  `scratch-fixed-target` problem for `cadence-core/workflows/plan.md`, and
  running the block by hand in a scratch tree leaves a parseable JSON envelope in
  the echoed directory while still printing it.

### Task 3: Both count points

- **Files:** cadence-core/workflows/plan.md
- **Action:** Add the two invocations D-05 locks. The first is its own step
  between `check_size` and `check_gate` - after `handle_return`, which is the
  criterion's literal "after the planner returns" - passing the phase, the
  planned point and the payload file in the echoed directory. The second runs
  after `commit`, on the plan as it finally stands, so a checker revision and an
  applied adjudicated survivor are both inside what it measures; that is the
  whole reason the pair is recorded rather than one end alone. Each block first
  compares the echoed run token against the token file in the echoed directory
  and refuses with a named reason and a non-zero exit when they differ, then
  chains the count call - the carried-path arm is the one place an EARLIER run's
  well-formed file still resolves, and the token is what separates them. State
  the `none` arm in prose beside the calls: when the effective `memory.backend`
  read at `parse` is `none` no search ran and no payload exists, so the same two
  calls run with the payload flag omitted and the seam answers with its
  backend-off state. State plainly that both calls are ADVISORY - they never
  refuse the plan, never re-dispatch the planner and never edit the plan file -
  and that a non-zero exit from either is reported and the workflow continues,
  because a measurement that could halt planning is the gate this cycle
  deliberately did not ship. Keep each block to ONE seam invocation; a second
  spelling of the same call is a round trip the census will report.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` reports no
  `unknown-subcommand` or `unknown-flag` problem for
  `cadence-core/workflows/plan.md`, and the census counter in
  `cadence-core/bin/seam-calls.test.mjs` measures exactly 11 invocations in that
  file - 9 before this phase plus these two and no others.

### Task 4: The under-threshold path counts too

- **Files:** cadence-core/workflows/plan.md
- **Action:** Extend `inline_plan` to the same payload file and the same two
  count points, the way that step already extends the memory fetch to itself -
  "a real task-breakdown moment with no cad-planner dispatch, so it must not
  skip prior memory" is the same argument one step further on (D-12). Criterion
  2 names `/cad-plan`, not a dispatch mode, and leaving this path out would make
  the cheap planning path the one path with no citation data. Write it as a
  reference to the steps that already carry the calls rather than a second copy
  of them: a restated invocation is a second call the census counts and a second
  spelling that can drift from the first. The inline path writes `PLAN.md` from
  the same template, so the count reads it with no special case.
- **Verify:** The census counter in `cadence-core/bin/seam-calls.test.mjs` still
  measures exactly 11 invocations in `cadence-core/workflows/plan.md` after this
  edit - proving the inline arm was written as a reference to the existing
  steps and not as a third and fourth invocation - and `inline_plan`'s prose
  names both count points and the payload file by the same names those steps
  use.

### Task 5: The report, and what it may not do

- **Files:** cadence-core/workflows/plan.md
- **Action:** Add a line to the `done` step's report block naming both counts
  and the state they describe: how many of the surfaced set the plan cited at
  each point, and the three cases apart - the search was off, the search
  surfaced nothing, or it surfaced a non-empty set the plan cited zero of. The
  zero-of-a-non-empty-set case is the one this phase exists to make visible, so
  it is stated as such in the report and not left for a reader to derive from
  two numbers. Repeat in that step, once, that this is advisory: the plan is not
  refused, the planner is not re-dispatched, the plan file is not edited to add
  a citation, and the run's one suggestion is unchanged. Do not add a second
  suggestion, a new ask, or any branch on the count - a near-zero count has two
  readings that need opposite fixes and this cycle produces the data that
  settles which, it does not act on it.
- **Verify:** A `/cad-plan` run on a phase whose plan cites zero of a non-empty
  surfaced set prints a report naming both counts and the zero case; `git diff
  --stat` over that run shows the plan file's bytes unchanged after the first
  count, and the run's `trace.jsonl` holds exactly one `lifecycle` `dispatch`
  event for `cad-planner` (human-verify: run `/cad-plan` on a live phase and
  read the report block and the diff, since the workflow is executed by the
  host and not by a command this task can run).

### Task 6: The two re-pinned rows

- **Files:** cadence-core/bin/weight-budgets.json, cadence-core/bin/seam-calls.test.mjs
- **Action:** LAST of this plan's tasks, because both rows pin what
  `cadence-core/workflows/plan.md` finally holds. That file was at 22,638 B
  against a `weight-budgets.json` budget of 22,638 with zero headroom, and
  self-verify files `budget-overrun` on `bytes > budget`, so re-measure with
  `weight.mjs --root .` and write the measured figure into that surface's entry
  - the figure the measurement produced, never a rounded-up allowance. In
  `seam-calls.test.mjs`, raise the `plan.md` CENSUS row from 9 to 11 and extend
  its `note` with the arithmetic that produced it, the way the file's header
  derives both of its existing figures: the two count points this phase adds,
  named, so a twelfth still reads as a call that came back rather than as a
  number to re-pin. The numbers are DERIVED, never baselined - a census that
  pins whatever it finds records the bug as correct and can never show a drift.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []`, and `node --test cadence-core/bin/seam-calls.test.mjs`
  reports 0 failures while removing either count point from
  `cadence-core/workflows/plan.md` makes that row fail.

## Notes

- SEQUENTIAL with plans 1 and 3: all three declare
  `cadence-core/bin/planning.mjs` and `cadence-core/bin/planning.test.mjs`, and
  plan 3 must not touch `cadence-core/workflows/plan.md` because task 6 pins
  that file's byte count.
- Task 5's verification is `human-verify` because `/cad-plan` is a workflow the
  host executes; there is no command an executor can run that drives the whole
  workflow and returns its report.
- `cadence-core/references/recall.md` is deliberately not in this plan's files:
  it documents the return shape and states that `/cad-plan` does not read it,
  and the payload file changes nothing about what the search returns.
</content>
