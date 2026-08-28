---
phase: 1
plan: 1
requirements:
  - EXP-04
files:
  - cadence-core/workflows/execute.md
  - cadence-core/references/execute-parallel.md
  - cadence-core/workflows/task.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The fix pass is a dispatch - Plan 1

## Goal

A blocking review gate that FAILs on a plan's committed range is cleared by a
`cad-executor` continuation dispatched under that plan's worker key, carrying
the findings, so the coordinator writes no source and the fix is a worker's
reviewed-shape commit rather than the orchestrator's unreviewed one. This plan
states that rule at every FAIL site that has a plan key.

## Must be true when done

- Reading `cadence-core/workflows/execute.md`'s blocking-gate FAIL arm tells you
  WHO fixes: a continuation `cad-executor` dispatched under worker key `<k>`,
  its prompt carrying the plan file, the persisted findings PATH, and the
  instruction to fix the blocker/high findings and return the digest.
- `execute.md`'s `<guardrails>` forbids this workflow's coordinator from issuing
  an `Edit` or `Write` against any path outside `.planning/`, stated by PATH and
  with no exception clause.
- A fix whose findings name a path outside the plan's declared `files:` lease is
  unblocked by AMENDING `PLAN-<k>.md`'s `files:` before dispatching - never by
  exempting the fix from `lease-check` and never by sending the refusal back to
  the user.
- Every FAIL site that has a plan key names that same dispatch: `execute.md`'s
  `risk_surface` arm and its `diff`-at-`adjudicated` arm,
  `references/execute-parallel.md`'s per-plan risk sequence, and
  `workflows/task.md`'s `--plan` path.
- `task.md`'s INLINE path states instead that it has no plan key and no
  dispatch, so its `risk_surface` FAIL stays with the user - the file no longer
  carries two readings of what to do there.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` after these edits.

## Context

CONTEXT.md's locked decisions bind this plan: D-01 (widen the lease, never
exempt the check), D-02 (the rule binds wherever a plan key exists, and nowhere
else), D-03 (the fix dispatch does not rotate the plan's report), D-07 (reuse
`handle_checkpoint`'s continuation whole), D-09 (`PLAN COMPLETE`, `Tasks: 1 of
1`, no fourth return arm), D-10 (a parallel-path fix runs in the main tree),
D-11 (`/cad-task`'s inline carve-out), D-12 (no lease gate on the `/cad-task`
`--plan` path), D-13 (the guardrail is stated by PATH), D-17 (every surface here
is at exactly its byte ceiling).

Out of scope for this plan and this phase: `workflows/debug.md` and
`workflows/verify.md`, whose staged fixes have no plan key and keep the
coordinator as fix author by design; `workflows/plan.md` and
`references/git-guard.md`, for the same reason; any change to what the gates
detect, to the adjudication format, or to the triage presentation; and any edit
to `skills/cad-executor-contract/SKILL.md`.

Two mechanical rails bind every edit below. First, each of these surfaces sits
at EXACTLY its `cadence-core/bin/weight-budgets.json` ceiling, so every commit
that grows one re-pins that surface's entry in the same commit or
`self-verify.mjs`'s budget check refuses `budget-overrun`. Second,
`cadence-core/bin/trace.test.mjs`'s per-file bracket census counts, per file,
every occurrence of `--bracket-read` followed by whitespace as an OPEN and every
line naming both `planning.mjs` and `trace close` as a CLOSE, and asserts the
two counts are EQUAL - so these edits add neither half alone.

## Tasks

### Task 1: Name the owner of a blocking `risk_surface` FAIL in execute.md

- **Files:** cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** In the `execute_sequential` step, the paragraph that begins "On a
  fire, write `git diff`" ends "Blocking: on FAIL the findings are fixed or the
  user explicitly overrides" - an owner-less passive that in practice the
  coordinator answers itself. Replace that clause with the owner: the findings
  are fixed by a continuation `cad-executor` dispatched through the spawn-agent
  seam under the SAME worker key `<k>` the first dispatch took. The paragraph
  headed "The worker key of a SECOND dispatch" already names "a `risk_surface`
  fix pass" as one of the three second dispatches against one plan's range -
  point at it and restate none of it. The dispatch prompt carries four things
  and nothing distilled by the coordinator: the plan file; the PATH of the
  findings file `references/review-triggers.md` step 5 has already persisted at
  the `plan-<k>` discriminator (`.planning/phases/<N>/REVIEW-risk_surface-plan-<k>.md`,
  the path `references/risk-surface.md` states), never the findings copied into
  the prompt; the instruction to fix the blocker/high findings only; and the
  instruction NOT to rotate the plan's report but to append its fix row to the
  existing `<plandir>/reports/plan-<k>.md`, because the executor contract's
  rotation rule is unconditional and a fix dispatch obeying it renames the
  completed plan's report aside, leaving the `summary` step to read a one-row
  fix report as that plan's whole record. State that it returns on the existing
  complete arm - `PLAN COMPLETE` with `Tasks: 1 of 1` - so no fourth return arm
  is introduced beside complete/partial/checkpoint. Bracket it exactly as the
  "lifecycle bracket (both paths)" paragraph above already states, adding no new
  occurrence of `--bracket-read` and no new line naming both `planning.mjs` and
  `trace close`: those are the two halves `trace.test.mjs`'s per-file bracket
  census counts and requires to be equal, so an unmatched half reddens the
  suite. Read `docs/rationale/execute.md` before editing, as this file's own
  `<purpose>` block instructs. Re-pin `cadence-core/workflows/execute.md` in
  `weight-budgets.json` in this same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, `node cadence-core/bin/trace.test.mjs` and
  `node cadence-core/bin/prose-agreement.test.mjs` both pass, and reading the
  `execute_sequential` step shows the FAIL clause naming `cad-executor`, the
  worker key `<k>`, the `REVIEW-risk_surface-plan-<k>.md` path, the no-rotation
  instruction and `Tasks: 1 of 1`.

### Task 2: State the coordinator's write boundary in execute.md's guardrails

- **Files:** cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** Add one bullet to the `<guardrails>` block stating that this
  workflow's coordinator issues no `Edit` or `Write` against a path outside
  `.planning/`. State it by PATH, not by role and not by artifact, and give it
  NO exception clause: that wording already permits the `plan` gate's fix (the
  artifact is `PLAN*.md`), the `summary` and `state` steps' own writes, and the
  lease amendment task 3 adds, because every one of those is inside
  `.planning/`. Do not scope the bullet to the `risk_surface` trigger - it binds
  the whole workflow - and do not widen it beyond this file: the guardrail block
  is `execute.md`'s alone, and `workflows/debug.md` and `workflows/verify.md`
  keep the coordinator as fix author by design because their staged fixes have
  no plan and no key to dispatch under. Re-pin the surface's ceiling in
  `weight-budgets.json` in this same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, `node cadence-core/bin/test.mjs` is green, and reading the
  `<guardrails>` block shows one bullet naming `Edit`, `Write` and `.planning/`
  with no "except" clause beside it.

### Task 3: Widen the lease before the fix dispatch, never exempt the check

- **Files:** cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** In the same FAIL arm task 1 wrote, state what happens when a
  finding names a path outside the plan's declared `files:` lease: the
  coordinator AMENDS `PLAN-<k>.md`'s `files:` to cover that path BEFORE
  dispatching, so `lease-check` still runs and still answers on the fix commit's
  staged set. Name both rejected alternatives and why: a lease-exempt flag for
  the fix dispatch deletes the one gate that catches an unlicensed path, and
  routing the refusal back through the ask-user seam consults exactly the seam
  the fix dispatch exists to keep out of the loop. Name why the amendment is
  permitted by task 2's guardrail with no exception clause: `PLAN-<k>.md` is
  inside `.planning/`. `cadence-core/bin/planning/lease-check.mjs`'s
  `undeclared-files` hint already states this same remedy ("add these paths to
  the plan's files: list, or unstage them"), so this is the workflow adopting
  the seam's own answer rather than a new rule. Re-pin the surface's ceiling in
  `weight-budgets.json` in this same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, `node cadence-core/bin/prose-agreement.test.mjs` passes, and
  reading the FAIL arm shows the amendment sentence naming `PLAN-<k>.md`'s
  `files:` and the word "before" ahead of the dispatch, with no exemption flag
  proposed anywhere in the file.

### Task 4: Point the `diff`-at-`adjudicated` FAIL arm at the same dispatch

- **Files:** cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** The `diff` trigger's `adjudicated` arm in the same step blocks
  before the next dispatch and hands the user a numbered survivor list. Add one
  clause naming the owner of whatever the user names for action: the same
  continuation `cad-executor` under worker key `<k>` that task 1 stated, by
  pointing at that arm and restating none of its mechanics - the phase's rule is
  that each site NAMES the dispatch, and a second copy of the mechanics is how
  two statements come to disagree. Leave the triage presentation exactly as it
  is: the survivors stay a numbered list, NONE stays the default, and only what
  the user names is acted on. Do not touch the `advisory` arm, which halts
  nothing and has no fix to own, and do not touch the sentence stating that the
  `risk_surface` fire is untouched by the TRIAGE rule. Re-pin the surface's
  ceiling in `weight-budgets.json` in this same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, `node cadence-core/bin/test.mjs` is green, and reading the
  `adjudicated` arm shows it naming the continuation `cad-executor` and worker
  key `<k>` while the numbered-list-with-NONE-default sentences are unchanged.

### Task 5: Name the fix dispatch on the parallel path, in the main tree

- **Files:** cadence-core/references/execute-parallel.md, cadence-core/bin/weight-budgets.json
- **Action:** In step 5's per-plan risk sequence, name the fix dispatch and the
  one fact `workflows/execute.md` cannot state for this path: it runs in the
  MAIN tree, never a worktree, because step 4 has already removed each merged
  worktree and deleted its branch before step 5's risk sequence fires, so
  `<worktree_mode>` is not entered for a fix on either path. Restate nothing
  else - this step already defers the fire, the range-diff file, its rails and
  the capped re-arm to `workflows/execute.md`'s `execute_sequential` step, and
  `cadence-core/bin/prose-agreement.test.mjs` asserts this file carries no copy
  of that sequence (it checks the markers `inconclusive` and `never stage it`
  appear in `execute.md` and NOT here). Add no fenced command block: this file
  has none today, and the per-file bracket census in
  `cadence-core/bin/trace.test.mjs` counts both bracket halves per file. Re-pin
  `cadence-core/references/execute-parallel.md` in `weight-budgets.json` in this
  same commit - it sits at exactly its ceiling too, though CONTEXT's D-17 list
  names only six files.
- **Verify:** `node cadence-core/bin/prose-agreement.test.mjs` passes (the
  no-copy assertion on this file still holds),
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, and reading step 5 shows the fix dispatch named together
  with "main tree" and the reason drawn from step 4's ordering.

### Task 6: Name the fix dispatch on `/cad-task`'s `--plan` path

- **Files:** cadence-core/workflows/task.md, cadence-core/bin/weight-budgets.json
- **Action:** The `risk_check` step ends by naming the one-round cap and sending
  the reader to `references/triage-gate.md` before fixing a FAIL, with no owner
  for the fix. On the `--plan` path, name the owner: a continuation
  `cad-executor` dispatched with `.planning/tasks/{slug}/PLAN.md` and the
  persisted findings path, bracketed like any executor. Its worker key is the
  plan key `1` - `skills/cad-executor-contract/SKILL.md` derives `k` from the
  plan file's own name and `1` for a bare `PLAN.md` - which is deliberately a
  different key from this run's own `--plan <the task's slug>` `cad-task`
  bracket, so the two workers do not pair FIFO against each other. State that
  its lease gate does not fire at all: the executor contract skips `lease-check`
  whenever `<plandir>` is not `.planning/phases/<N>/`, and `/cad-task`
  dispatches from `.planning/tasks/<slug>/`. Name the dispatch and restate none
  of `execute.md`'s mechanics, and add no new occurrence of `--bracket-read` and
  no new line naming both `planning.mjs` and `trace close` - the per-file
  bracket census in `cadence-core/bin/trace.test.mjs` counts those two halves
  and requires them equal in this file. Then correct the `done` step, which
  currently opens "Close the bracket first - this is the only closing call in
  this workflow": that becomes false the moment a fix executor is dispatched, so
  say instead that it is the only close of THIS RUN's own `cad-task` bracket,
  and that a dispatched worker's bracket takes its own close keyed to that
  worker. Leave the reason the sentence carries intact - one close per dispatch
  moment, because a second close on ONE moment appends a duplicate terminal.
  Re-pin the surface's ceiling in `weight-budgets.json` in this same commit.
- **Verify:** `node cadence-core/bin/prose-agreement.test.mjs` and
  `node cadence-core/bin/trace.test.mjs` both pass (task.md's `written: false`
  enforcement assertion and the per-file bracket count are unchanged),
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, and reading `risk_check` and `done` shows the `--plan`
  path's fix named as a `cad-executor` dispatch under plan key `1` and the
  "only closing call" sentence scoped to this run's own `cad-task` bracket.

### Task 7: Carve the inline path out explicitly

- **Files:** cadence-core/workflows/task.md, cadence-core/bin/weight-budgets.json
- **Action:** In the same `risk_check` step, state the INLINE path's arm
  explicitly: it has no plan key and no dispatch, so its `risk_surface` FAIL
  stays with the user. Without that sentence the file carries two readings of
  the same moment - task 6's dispatch instruction beside the `<guardrails>` line
  "Never spawn a subagent on the inline path" - and which one a run obeys is
  unpredictable. Say it as the consequence of the missing key, not as a second
  enumerated exception list, so the carve-out follows from the same rule task 6
  states rather than sitting beside it. Leave the `<guardrails>` line itself
  unchanged: it is still true, and this step is where the reader is standing
  when the question arises. Re-pin the surface's ceiling in
  `weight-budgets.json` in this same commit.
- **Verify:** `node cadence-core/bin/test.mjs` is green,
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, and reading the `risk_check` step shows both arms - the
  `--plan` path dispatching and the inline path stating no plan key, no dispatch
  and the FAIL staying with the user - with the `<guardrails>` line untouched.

## Notes

- Plan structure follows CONTEXT's `Plan shape` directive (multiple plans, same
  phase). PLAN-1 and PLAN-2 share exactly one declared path,
  `cadence-core/bin/weight-budgets.json`, which CONTEXT anticipated: every plan
  that edits a prose surface must declare it or `/cad-plan`'s `check_census`
  refuses `census-at-risk`. `plan-overlap` will therefore route these two
  sequentially, which is correct - PLAN-2's `prose-agreement.test.mjs`
  assertions pin prose PLAN-1 writes.
- `cadence-core/references/execute-parallel.md` is at 5711 of 5711 bytes, so it
  is a SEVENTH zero-headroom surface beside the six D-17 lists. Same remedy, and
  it is already covered by this plan's declaration of `weight-budgets.json`.
- Residual tension recorded, not scoped: `skills/cad-executor-contract/SKILL.md`
  states report rotation unconditionally, so D-03's no-rotation instruction
  reaches the fix executor as a dispatch-prompt exception to its own preloaded
  contract. CONTEXT authorises no contract edit and none is planned here.
