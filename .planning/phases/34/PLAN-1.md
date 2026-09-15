---
phase: 34
plan: 1
requirements: ["T1"]
files: ["crates/cadence/src/execution/history.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/server.rs","crates/cadence/tests/phase34_blocked_path.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P34-1-T1","verify":["cargo test -p cadence --test phase34_blocked_path phase34_owner_retires_unfinished_task_and_next_plan_dispatches -- --exact"]}]}
---
# Phase 34: The blocked path - Plan 1

## Goal

Give the owner a native, replay-safe way to retire an unfinished task, retain the reason, end only that plan as blocked, and let execution select the next admitted plan.

## Must be true when done

- T1. When the owner retires an unfinished task with a reason, the executor sees the plan end blocked with that reason and the next admitted plan dispatched.

## Context

Task events currently replay before validation at crates/cadence/src/execution/history.rs:151 and enter one admission/version/attempt path at crates/cadence/src/execution/history.rs:161. The failed-suite branch creates a blocker and calls the private `end_dispatch` path at crates/cadence/src/execution/history.rs:612; that path retains task outcomes, clears the active dispatch and installs only the ordinary phase-complete terminal at crates/cadence/src/execution/history.rs:502. `execute-next` skips every plan that already has a retained outcome at crates/cadence/src/execution_service.rs:1065, while any phase terminal is returned forever at crates/cadence/src/execution_service.rs:485. Retirement therefore belongs in the former path and must never manufacture `JudgmentStop`.

The existing close proof requires the exact active dispatch at crates/cadence/src/execution/receipts.rs:334, and the existing task model already has `Blocked` and `NotRun` outcomes at crates/cadence/src/execution/model.rs:133. A checkpoint Stop is a different, resumable owner decision whose persistence rule is at crates/cadence/src/next_action/continuation.rs:153; retirement creates neither a checkpoint nor a continuation authorization.

This plan relies on D-109's retained commits-and-observed-run receipt, D-110's admission-owned check allocation, and D-111's exact owner attestation at .planning/phases/12/CONTEXT.md:153, .planning/phases/12/CONTEXT.md:184 and .planning/phases/12/CONTEXT.md:195. It keeps D-112's rule that “a suite that ran and failed keeps the plan incomplete” and uses a new owner path before the suite at .planning/phases/12/CONTEXT.md:207. It preserves D-113's rules that “a completed task is never scheduled again” and a lost reply replays the receipt at .planning/phases/12/CONTEXT.md:235. The check follows D-114's “explicitly initialized disposable project” boundary at .planning/phases/12/CONTEXT.md:249, and the compiled owner-only wording follows D-115 at .planning/phases/12/CONTEXT.md:259. The later plan is a distinct admitted identity under D-84 at .planning/phases/27/CONTEXT.md:106 and D-120's “new approved plan identity” rule at .planning/phases/12/CONTEXT.md:325.

Use the real stdio driver at crates/cadence/tests/support/phase13.rs:22 and its structured/text equality assertion at crates/cadence/tests/support/phase13.rs:65. The existing failed-suite gap test demonstrates the retained-outcome then next-plan boundary at crates/cadence/tests/phase12_execution.rs:1424. No existing assertion moves.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P34-T1-C",
      "spec": {
        "command": "cargo test -p cadence --test phase34_blocked_path phase34_owner_retires_unfinished_task_and_next_plan_dispatches -- --exact",
        "expected": {
          "kind": "property",
          "value": "Blank owner, at, or reason is refused; a completed task and a task outside the active dispatch are refused without changing history. A valid retirement returns status ok, the one retained task-event receipt with the exact handwritten owner, time, and reason, and a blocked plan outcome with exactly one blocker whose text equals that reason. The already closed task keeps its completed receipt, the retired task is blocked, active is cleared, and no JudgmentStop exists. Byte-identical replay returns the same receipt and no second event; changed bytes under the same request id are refused. The next execute-next returns outcome dispatch for admitted plan 2, not a terminal outcome."
        },
        "test": {
          "file": "crates/cadence/tests/phase34_blocked_path.rs",
          "function": "phase34_owner_retires_unfinished_task_and_next_plan_dispatches"
        },
        "setup": "Create fresh disposable signed Git projects inside the test, never use /code/cadence as fixture state. Reuse tests/support/phase13.rs Client to launch env!(CARGO_BIN_EXE_cadence) serve with each fixture project bound at startup and to assert structured/text equality. Through the real public tools, submit and owner-approve a native phase-34 context with T1 version 1, preview and owner-approve two plans, admit their exact publication revisions and task/check allocation, call execute-next, and start the named tasks. Use a two-task first plan so one task can be completed through actual red/green runs, exact owner attestation, named verification and close before the second task is retired; the second admitted plan supplies the next-dispatch control. Handwrite owner, timestamp, reason, ids, plan numbers, task statuses and expected refusal rules. Use separate fresh fixtures where isolation makes a refusal clearer. Do not seed execution JSON or call history/end_dispatch directly.",
        "call": "Inspect the real cadence_apply schema, then send execution-task-retire over MCP stdio for blank-field, closed-task, outside-active-dispatch, valid, identical-replay and changed-request-id-reuse cases. Query execution-history to compare retained receipts/events, and call execute-next after the valid retirement.",
        "boundary": "Actual owner caller -> MCP stdio -> public apply deserialization -> resident native task admission/replay/refusal and persistence -> public retirement/history answers -> real execute-next selection.",
        "fakes": []
      },
      "reason": "This check fails if retirement bypasses task-event authority, loses attribution or receipts, creates a phase stop, accepts an invalid target, duplicates a replay, or cannot hand off to the later plan.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This item directly proves the approved owner-retirement outcome and next-dispatch behavior."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P34-A-TASK-RETIRE",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/history.rs::Event",
          "crates/cadence/src/execution/history.rs::end_dispatch",
          "crates/cadence/src/execution_service.rs::native_apply",
          "crates/cadence/src/server.rs::ApplyArguments",
          "crates/cadence/src/execution/instructions.rs::PROTOCOL"
        ],
        "substance": "A strict owner-only execution-task-retire request is retained as one idempotent task event. It accepts only the current unfinished task in the exact active dispatch, retains owner/time/reason, and ends that dispatch through the ordinary blocked PlanOutcome transition with one reason blocker, preserved receipts, no JudgmentStop, and no completion event. Public schema and compiled protocol advertise that the executor never calls it."
      },
      "reason": "The owner needs a durable native exit for a task that must not finish, without confusing retirement with task success or a resumable Stop.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This item directly proves the approved owner-retirement outcome and next-dispatch behavior."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P34-L-RETIRE-REASON",
      "spec": {
        "caller": "execution-task-retire request.reason",
        "callee": "retained blocked PlanOutcome blocker.text",
        "value": "reason"
      },
      "reason": "The owner-supplied reason must cross the task-event boundary into the one blocker the next execution view retains.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This item directly proves the approved owner-retirement outcome and next-dispatch behavior."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Add owner task retirement and prove the blocked handoff

- **ID:** P34-1-T1
- **Files:** crates/cadence/src/execution/history.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase34_blocked_path.rs.
- **Action:** First add `phase34_owner_retires_unfinished_task_and_next_plan_dispatches` as the red public-boundary check. Add a strict `execution-task-retire` apply shape whose request fields are exactly `owner`, `at`, `reason`, `task`, `attempt`, `expected_version` and `request_id`, and record retirement as a task event through the same `runner::append`/`history::contribute` admission, replay and refusal path used by other task events. Validate nonblank owner, time and reason; the exact active dispatch identity and membership; the current attempt and version; and that the task is unfinished. A closed task and a task outside the active dispatch have located refusals. An identical request replay returns the original receipt without a second event, while reuse of its request id for changed retirement bytes is refused. After persisting the event, invoke the same `end_dispatch(..., PlanDisposition::Blocked, ...)` transition used by a failed suite with exactly one blocker whose text is the owner's reason; project the retired task as `TaskOutcome::Blocked`, retain every already-completed task receipt, leave other unfinished tasks `NotRun`, clear `active`, and return the receipt plus retained blocked plan outcome. Do not write a completion event, phase-level `JudgmentStop`, checkpoint or continuation authorization. Advertise the exact operation in the public apply schema/tool description beside the other execution task operations. Add it to the compiled protocol's plan-level request paragraph with explicit text that the owner invokes it and the executor never does. The check builds fresh signed fixture publications through `context-submit` and `plan-submit`, admits two plans through `execution-admit`, dispatches through `execute-next`, and starts tasks through `execution-task-start`; it closes one control task through the real receipt flow, proves the closed/outside/blank/reused-id refusals, retires the remaining active task, verifies retained events/outcomes and exact reason, and proves the following `execute-next` dispatches plan 2 rather than returning a terminal outcome.
- **Verify:** cargo test -p cadence --test phase34_blocked_path phase34_owner_retires_unfinished_task_and_next_plan_dispatches -- --exact.

## Notes

This is the first sequential dispatch. It creates only the T1 check function; Plan 2 extends the same test file after this operation exists. The operation is owner-only even though its consequence is visible to the next executor dispatch.
