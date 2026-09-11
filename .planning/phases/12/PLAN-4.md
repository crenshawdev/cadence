---
phase: 12
plan: 4
requirements: [T5]
files:
  - crates/cadence/src/next_action/continuation.rs
  - crates/cadence/tests/phase12_execution.rs
---

# Phase 12: Execution and tasks - Plan 4

## Goal

An owner Stop that named no checkpoint is lifted by the owner's later resume
that names none, and the executor then gets only the plan's unfinished tasks.
Close only T5 as amended 2026-09-11.

## Must be true when done

- T5. When the owner continues a stopped plan, whether the Stop named a
  checkpoint or not, the executor gets only the plan's unfinished tasks.

## Context

The O1 pilot (reports/pilot.md, finding 1) found that a Stop authorized
through `execution-authorize` with no checkpoint can never be continued.
`next_action/continuation.rs` (the loop over answered Progress gates, the
`continued` guard) lifts a Stop only when `gate.checkpoint_id.is_some()` and
a later Progress approval names that same checkpoint. A Stop with
`checkpoint_id: None` therefore fails the first half forever; the owner's
later unlinked approval is accepted by `execution-authorize` and then
ignored, and the phase is stranded.

The owner's rule, 2026-09-11: "If a user ordered a stop, then you stop. You
do not resume until they tell you to resume." D-113 already binds the first
half (a user Stop is not acceptance to resume; a restart never lifts it).
This plan delivers the second half: the owner's resume counts. The fix is
one guard: a later Progress approval whose `checkpoint_id` equals the Stop's
`checkpoint_id` lifts it, so `None` matches `None`. A checkpoint-linked Stop
still needs an approval naming that checkpoint; an unlinked approval still
does not lift a linked Stop, and the existing assertion for that case in the
T5 check stays as written. Nothing at authorize time changes: a Stop is never
refused there.

Plans 1 to 3, their reports and verify.md are closed inputs. No other
finding from the pilot is in this plan.

## Evidence map

One check per truth: the case is added inside T5's existing check function,
not as a new test. Real binary, real restart, reopened bytes as the oracle,
as plan 1 fixed for the phase.

### T5

- **P12-T5-C - check (extended).** File
  `crates/cadence/tests/phase12_execution.rs`, function
  `phase12_continuation_dispatches_only_unfinished_tasks`. After the
  reconciliation block (B acknowledged, `[B, C]` dispatched as `reconciled`)
  and before the gap section, add: the owner stops the phase through
  `authorize(project, "stop-phase", None, "stop", ...)` and it is accepted;
  `execute-next` is refused with code `continuation-refusal` and the
  protected records are byte-identical; kill and restart the server and
  `execute-next` is still refused (a restart never lifts a Stop); the owner
  resumes through `authorize(project, "resume-phase", None, "approve", ...)`
  and it is accepted; kill and restart again; `execute-next` returns status
  `ok`, outcome `dispatch`, plan 1, executable task ids exactly handwritten
  `["B", "C"]` in both `dispatch.tasks` and the operational input, completed
  exactly `[A]` with its original completion and `close-A` receipt, and the
  operational `continuation` naming `execution-authorization:resume-phase`
  with a null checkpoint. The retained `stop-phase` gate is still answered
  Stop in the reopened evidence; the Stop record is preserved, not erased.
  The existing assertions earlier in the function that a linked Stop on
  `checkpoint-B` is not lifted by `unlinked-approval` remain and must still
  pass: they are the negative control proving the guard was narrowed, not
  removed.
  Command:
  `cargo test -p cadence --test phase12_execution phase12_continuation_dispatches_only_unfinished_tasks -- --exact`.
  Red first: the extension fails today at the `execute-next` after
  `resume-phase` (refused instead of a dispatch). Green after the guard
  change.
- **P12-T5-L - link.** Unchanged from plan 3: the value `the plan's
  unfinished tasks` crosses from the continuation and dispatch boundary to
  the executor. The extended check traces it for the unlinked case through
  the same `execute-next` call and the same handwritten `[B, C]` oracle.

## Tasks

### Task 1: Lift an unlinked Stop by the owner's unlinked resume

- **Files:** `crates/cadence/tests/phase12_execution.rs`,
  `crates/cadence/src/next_action/continuation.rs`.
- **Action:** Extend P12-T5-C as the evidence map states and commit it red
  (`test(12): ...`). Then in `next_action/continuation.rs` drop the
  `gate.checkpoint_id.is_some() &&` half of the `continued` guard so the
  later-approval match on `checkpoint_id` is the whole condition, and
  correct the comment above the loop: a Stop stays in force until a later
  Progress approval names the same checkpoint, or names none when the Stop
  named none; a restart never continues it. Commit green (`feat(12): ...`).
  Do not touch `execution_service.rs`, the authorize path, D-113, or any
  other test. Both commits signed, conventional, one task.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_continuation_dispatches_only_unfinished_tasks -- --exact`
  reports one pass, with the unlinked stop-then-resume dispatch containing
  exactly `[B, C]` and the earlier linked-Stop refusal still holding; and
  `cargo test -p cadence --test phase12_execution` reports no failure.

## Notes

The truth budget stays at seven: T5 was amended, not added to. The check is
extended inside its one function because the acceptance design holds one
check per truth. The alternative fix, refusing a checkpoint-less Stop at
authorize time, was rejected by the owner's rule: a Stop is always obeyed,
and only the owner's resume lifts it.

## PLANNING COMPLETE

`.planning/phases/12/PLAN-4.md` - 1 task.
