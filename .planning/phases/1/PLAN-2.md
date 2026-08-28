---
phase: 1
plan: 2
requirements:
  - EXP-04
files:
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The fix pass is a dispatch - Plan 2

## Goal

The fix dispatch PLAN-1 states can actually be reviewed and actually be proven:
the one-round re-arm cap is keyed per plan so a second plan's fix still gets its
narrowed round, the lease widening is proven to unblock the fix commit, the run
record is proven to show the fix as an executor bracket, and a check goes RED if
`execute.md`'s FAIL branch or its guardrail is ever lost.

## Must be true when done

- With a `rearm` event already on the record for a trigger under plan 1, plan
  2's cap for that SAME trigger reads unspent and its narrowed re-fire runs -
  the read-back in `references/triage-gate.md` matches the plan key its own
  recording append writes.
- `references/triage-gate.md`'s terminal "proceed anyway, or stop and fix by
  hand" reads unambiguously as the USER's hand, outside Cadence, at a decision
  point strictly LATER than the FAIL-branch fix dispatch.
- `node cadence-core/bin/prose-agreement.test.mjs` fails if `execute.md`'s FAIL
  branch loses the dispatch instruction, and fails separately if its
  `<guardrails>` loses the no-`Edit`/`Write`-outside-`.planning/` line.
- Widening a plan's `files:` to cover a path a finding named makes
  `planning.mjs lease-check --phase <N> --plan <k>` answer `ok:true` for the fix
  commit's staged set, where before the amendment it answered `undeclared-files`
  naming that path.
- On a scratch fixture phase, the run record holds a SECOND `dispatch` for
  `cad-executor` under the original worker key `<k>` with a matching close, and
  the fix commit falls inside that bracket's window.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`.

## Context

CONTEXT.md's locked decisions bind this plan: D-04 (the one-round cap is keyed
PER PLAN, by adding a plan term to the read-back's filter so it matches what the
recording append already writes), D-05 (authorship is proven from
`.planning/trace.jsonl`, never from `.planning/reads.jsonl`, which structurally
cannot show a write), D-06 (the prose rule is pinned in
`cadence-core/bin/prose-agreement.test.mjs`, not `self-verify.mjs`), D-14 (the
"fix by hand" clause), D-16 (a fixture phase is a scratch tree built in-test
with `mkdtempSync`, never a checked-in phase directory), D-17 (byte ceilings).

`cadence-core/references/triage-gate.md` is at exactly its
`cadence-core/bin/weight-budgets.json` ceiling, so each commit that grows it
re-pins that entry in the same commit. Deferred and out of scope: recording
`Write`/`Edit`/`MultiEdit` in `reads.jsonl`, and any change to what the gates
detect or to the triage presentation.

This plan runs after PLAN-1 (they share `weight-budgets.json`, so
`plan-overlap` routes them sequentially) and task 4 asserts prose PLAN-1
writes.

## Tasks

### Task 1: Key the blocking re-arm read-back on the plan

- **Files:** cadence-core/references/triage-gate.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** The fenced read-back under "The blocking re-arm is capped at ONE
  round" counts prior `rearm` outcomes with a filter on the event name, the
  `trigger` field and the run's `corr`. The recording append directly below it
  carries `--plan <k>`, and the filter has no plan term, so a `rearm` written
  for plan 1 makes plan 2's cap read SPENT for the same trigger and plan 2's fix
  can never be reviewed - which is this phase's own goal clause failing. Add a
  plan term to that filter so the read-back matches the same key the append
  writes, carrying the key as a further `process.argv` argument beside the
  trigger the block already passes, so the block stays the one line a
  coordinator copies and runs. Handle the fires that carry NO `--plan`
  (`/cad-debug`, `/cad-verify`, `/cad-task` - the discriminator grammar in
  `references/review-triggers.md` names them) by making an omitted key match
  events that carry none: `planning.mjs trace append` writes the `plan` field
  only when `--plan` was passed, so those events have no `plan` at all and a
  strict comparison against a present key would silently stop counting them.
  Update the prose around the block in the same edit, which today says "that one
  number is the whole answer" on the strength of `corr` alone. The constant
  `corrFilter` in `cadence-core/bin/prose-agreement.test.mjs` quotes the old
  filter byte-for-byte and asserts it appears exactly once, so update that
  constant in this SAME commit and keep its comment's stated reason - every word
  in the filter is load-bearing - true of the new bytes. Do not touch the
  DEFERRED arm's separate cap, which reads the highest round on disk for the
  fire and is deliberately a second rule beside this one. Re-pin
  `cadence-core/references/triage-gate.md` in `weight-budgets.json` in this same
  commit.
- **Verify:** `node cadence-core/bin/prose-agreement.test.mjs` passes with its
  updated `corrFilter` matching the file exactly once,
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, and reading the fenced read-back shows a plan term in the
  filter beside the existing event, trigger and `corr` terms.

### Task 2: Prove the per-plan cap on a fixture record

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add a test that RUNS the read-back the prose carries rather than
  matching its bytes: take the fenced block from
  `cadence-core/references/triage-gate.md`, substitute its placeholders (the
  plugin root, the phase number, the trigger, the plan key) and execute it in a
  scratch tree built with `mkdtempSync`, with the record written by the real
  `planning.mjs trace` seam - a `phase_start` anchor so the events share a
  `corr`, then one `rearm` outcome for a trigger under plan 1. Assert the block
  prints a non-zero count when asked about plan 1 and `0` when asked about plan
  2 for that same trigger, so plan 2's narrowed re-fire runs. This file's own
  premise is the reason it is the home: the copied line is what a coordinator
  runs, and the existing byte-level assertion beside it cannot see a filter that
  is exactly right and answers the wrong question. Keep the existing `corrFilter`
  assertion - this is a second arm beside it, never a replacement.
- **Verify:** `node cadence-core/bin/prose-agreement.test.mjs` passes and its
  output names the new test; reverting task 1's plan term in a scratch copy of
  `triage-gate.md` and re-running makes the new test fail with the plan-2 count
  reading non-zero, and restoring the file makes it pass again.

### Task 3: Say whose hand "fix by hand" means

- **Files:** cadence-core/references/triage-gate.md, cadence-core/bin/weight-budgets.json
- **Action:** The terminal ask in the capped-re-arm section offers "proceed
  anyway, or stop and fix by hand". Add one clarifying clause: "by hand" is the
  USER's hand, outside Cadence, and this point is reached only after round two's
  narrowed re-fire still reports a blocker/high - strictly LATER than the
  FAIL-branch fix dispatch, which it neither replaces nor licenses the
  coordinator to perform. One clause and no more: do not restate the dispatch
  rule here, do not change what the ask offers, and do not touch the
  never-fire-again instruction beside it. The clause exists because the sentence
  reads ambiguously enough to invite exactly the reading this phase forbids.
  Re-pin `cadence-core/references/triage-gate.md` in `weight-budgets.json` in
  this same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, `node cadence-core/bin/prose-agreement.test.mjs` passes, and
  reading the numbered item that carries the terminal ask shows the clause
  naming the user's hand and the later decision point, with the ask's two
  options unchanged.

### Task 4: Make the FAIL branch and its guardrail fail-visible

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add an assertion in the shape this file already uses for
  `execute.md` - the tests named "ENFORCEMENT, execute.md" and "ENFORCEMENT,
  task.md" are the pattern - that goes RED if `cadence-core/workflows/execute.md`
  loses either half of what PLAN-1 wrote. Assert the two halves SEPARATELY, on
  two slices of the file, so a guardrail deleted while the FAIL arm survives
  still fails: the `execute_sequential` step's FAIL arm must still name a
  continuation `cad-executor`, the worker key it is dispatched under and the
  persisted findings path; and the `<guardrails>` block must still carry the
  line forbidding an `Edit` or `Write` against a path outside `.planning/`.
  Assert the load-bearing facts, not prose a rewrap would move, and say in each
  failure message what the loss costs: the coordinator becomes the fix author
  again, and by then the one-round re-arm cap is already spent, so every one of
  those edits ships unreviewed by construction. Pin it here and not in
  `cadence-core/bin/self-verify.mjs`, whose problem sites are surface, config,
  agent and route lints with no channel for a workflow-semantics claim.
- **Verify:** `node cadence-core/bin/prose-agreement.test.mjs` passes; deleting
  the `<guardrails>` bullet from `cadence-core/workflows/execute.md` and
  re-running fails naming that bullet, and deleting the FAIL arm's
  `cad-executor` sentence instead fails naming the dispatch - restore the file
  after each check and confirm the suite is green again.

### Task 5: Prove the widened lease clears the fix commit

- **Files:** cadence-core/bin/planning-lease-check.test.mjs
- **Action:** Add a test built from this file's own exported helpers -
  `leaseRepo`, `stage` and `leaseCheck` - that reproduces the sequence
  `workflows/execute.md`'s FAIL arm now instructs. Start from a `PLAN-2.md`
  declaring one path; stage that path plus the path a finding named outside the
  lease, as the fix commit's staged set; assert the seam refuses with reason
  `undeclared-files` naming the outside path and exit 1. Then rewrite that plan
  file's `files:` list to cover it - the coordinator's amendment, the ONLY
  unblock the FAIL arm permits - and assert the same call now answers `ok:true`
  with the declared count raised. Assert the refusal FIRST and in the same test,
  so what the test proves is that the amendment is what changed the answer
  rather than that a clean lease passes, which a sibling test already covers.
  Add no exemption flag and no bypass to the seam: the whole point is that the
  gate still runs against the fix commit.
- **Verify:** `node cadence-core/bin/planning-lease-check.test.mjs` passes and
  its output names the new test; `node cadence-core/bin/test.mjs` is green.

### Task 6: Prove the fix lands inside a second executor bracket

- **Files:** cadence-core/bin/trace.test.mjs
- **Action:** Add a test on a fixture phase built in-test - the file's own
  `fireRepo` helper already returns a scratch `mkdtempSync` git repo carrying
  `.planning/phases/<phase>/` and two commits, so no checked-in phase directory
  is added. Drive the record through the REAL seams, as this file's own comment
  requires and never by hand-writing JSON lines: open the plan's first bracket
  under worker key `<k>` and close it, then open a SECOND `dispatch` for role
  `cad-executor` under that SAME key `<k>` (either producer is faithful - the
  `--bracket-read`/`--bracket-plan` flags riding `route.mjs resolve`, or
  `planning.mjs trace append --family lifecycle --event dispatch`), make the fix
  commit in that repo, then write the matching
  `trace close --plan <k> --role cad-executor`. Assert from
  `.planning/trace.jsonl` that the key `<k>` carries two `dispatch` events and
  two closes, that the second close names role `cad-executor`, and that the fix
  commit's committer time falls between the second dispatch's timestamp and its
  close's timestamp. Compare those three at whole-second granularity - git
  records a commit time in whole seconds while the trace timestamp carries
  milliseconds, so a millisecond comparison flakes whenever the dispatch and the
  commit share a second. Record in the test's comment what the assertion does
  and does not prove, per CONTEXT D-05: it shows a worker authored the commit
  inside its own bracket, not that nothing else wrote, because
  `.planning/reads.jsonl` records only the five read-shaped tools and
  structurally cannot show a write.
- **Verify:** `node cadence-core/bin/trace.test.mjs` passes and its output names
  the new test; `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`.

## Notes

- This plan shares exactly one declared path with PLAN-1,
  `cadence-core/bin/weight-budgets.json`, which CONTEXT's `Plan shape` directive
  anticipated. `plan-overlap` routes the two sequentially, and that ordering is
  wanted: task 4 asserts prose PLAN-1 writes.
- Task 2 and task 4 both extend `cadence-core/bin/prose-agreement.test.mjs`,
  which is in the slow `prose` test group; both are read-only over the tree
  apart from task 2's own scratch directory.
