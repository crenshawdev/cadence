---
phase: 34
plan: 2
requirements: ["T2"]
files: ["crates/cadence/src/execution/history.rs","crates/cadence/src/derivation/mod.rs","crates/cadence/src/server.rs","crates/cadence/tests/phase34_blocked_path.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P34-2-T1","verify":["cargo test -p cadence --test phase34_blocked_path phase34_blocked_then_completed_phase_is_derived_executed -- --exact"]}]}
---
# Phase 34: The blocked path - Plan 2

## Goal

Make the derived executed lifecycle honor the retained plan-outcome rule: a blocked plan is satisfied by a later-admitted completed plan, while completion receipts remain mandatory for plans whose own outcome is complete.

## Must be true when done

- T2. When a blocked plan is followed by a later-admitted plan that completed, the owner sees the phase derived as executed.

## Context

`history::phase_complete` already encodes D-120: every admitted plan needs an outcome, and a blocked plan is satisfied by a later-admitted complete plan at crates/cadence/src/execution/history.rs:487. The derivation first uses that answer at crates/cadence/src/derivation/mod.rs:104, but then contradicts it by demanding a completion event and closed tasks from every admitted plan at crates/cadence/src/derivation/mod.rs:109. A failed or retired blocked plan cannot acquire a later completion event, so the second loop must apply only to retained `Complete` outcomes. Publication equality, admission presence, inactive dispatch, applicable completion overlay, truth counts and every other derivation condition stay unchanged.

The public stdio query enum already exposes `execution-history` at crates/cadence/src/server.rs:257 and its handler at crates/cadence/src/server.rs:672. It currently returns native execution history but not the lifecycle value that `acceptance_overlay` feeds into `LifecycleStatus::Executed` at crates/cadence/src/derivation/mod.rs:179. Extend only that existing successful answer with top-level `phase_status`, projected from the same derived lifecycle. This is a read field, not a new operation, record, terminal or second lifecycle rule; it gives the owner a non-faked boundary observable for T2.

This plan keeps D-112's failed-plan gap rule at .planning/phases/12/CONTEXT.md:207, D-113's immutable receipts and no completed-task replay at .planning/phases/12/CONTEXT.md:235, and D-120's requirement that the repair be a later approved plan identity whose extension preserves prior outcomes and receipts at .planning/phases/12/CONTEXT.md:325. The check uses D-114's disposable real-native fixture rule at .planning/phases/12/CONTEXT.md:249. No verification-input rule, completion rule or phase-31-owned file changes.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P34-T2-C",
      "spec": {
        "command": "cargo test -p cadence --test phase34_blocked_path phase34_blocked_then_completed_phase_is_derived_executed -- --exact",
        "expected": {
          "kind": "literal",
          "value": "For the phase-34 fixture, execution-history.phase_status is \"planned\" after plan 1 is retired and before plan 2 completes, then is exactly \"executed\" after the later-admitted plan completes. The retained outcomes still show plan 1 blocked and plan 2 complete; plan 1 has no Completion event and its retired task is not reported completed."
        },
        "test": {
          "file": "crates/cadence/tests/phase34_blocked_path.rs",
          "function": "phase34_blocked_then_completed_phase_is_derived_executed"
        },
        "setup": "Create a fresh disposable signed Git project and launch the real cadence binary over stdio with tests/support/phase13.rs Client. Publish an approved phase-34 context carrying T2 version 1 and two approved plans through context-submit and plan-submit, then execution-admit their exact revisions and allocation. Dispatch and start plan 1, retire its unfinished task with Plan 1's public owner operation, and read the intermediate history. Dispatch plan 2, start its task, produce actual committed red and green material, run the allocated check at both commits through execution-run, add the exact owner attestation, run its named verification at the signed completion commit, close it, run the admitted suite once, settle the real risk gate, and call execution-plan-complete. Expected lifecycle strings, outcomes, task states and event absence are handwritten; no production renderer or derivation result generates them.",
        "call": "Call cadence_query with {\"operation\":\"execution-history\",\"phase\":34} before and after the later plan completes, and read only its public top-level phase_status for the lifecycle assertion while also checking the retained public execution facts.",
        "boundary": "Actual owner caller -> MCP stdio -> persisted public publication/admission/execution events -> acceptance_overlay and lifecycle derivation -> existing execution-history serialized answer.",
        "fakes": []
      },
      "reason": "This check fails under the old all-plans completion loop even though history::phase_complete accepts the retained blocked outcome and later completed repair.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This item directly proves the approved blocked-then-completed executed lifecycle."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P34-A-EXECUTED-DERIVATION",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/history.rs::phase_complete",
          "crates/cadence/src/derivation/mod.rs::acceptance_overlay",
          "crates/cadence/src/server.rs::PublicServer"
        ],
        "substance": "The acceptance overlay takes plan-outcome sufficiency from history::phase_complete and applies completion-event/task-closure checks only to retained Complete outcomes. The existing execution-history answer projects the selected phase lifecycle as phase_status so the owner can observe executed without a second state machine."
      },
      "reason": "The phase lifecycle must agree with the authoritative D-120 retained-outcome rule and expose that one derived answer publicly.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This item directly proves the approved blocked-then-completed executed lifecycle."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P34-L-PHASE-EXECUTED",
      "spec": {
        "caller": "history::phase_complete retained-outcome answer",
        "callee": "execution-history.phase_status lifecycle projection",
        "value": "executed"
      },
      "reason": "The public owner-visible lifecycle must carry the same executed decision made from the authoritative plan outcomes.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This item directly proves the approved blocked-then-completed executed lifecycle."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Align executed derivation with retained plan outcomes

- **ID:** P34-2-T1
- **Files:** crates/cadence/src/execution/history.rs, crates/cadence/src/derivation/mod.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase34_blocked_path.rs.
- **Action:** First add `phase34_blocked_then_completed_phase_is_derived_executed` as the red public-boundary check. Expose the retained plan outcomes to the derivation through a narrow history read seam. Keep `history::phase_complete` as the sole answer to whether the admitted plan outcomes satisfy execution. In the existing closure loop, require `plan_project.completed` and every task's completed/no-unknown-runs state only when that plan's retained disposition is `Complete`; do not impose either condition on a retained `Blocked` plan. Change nothing else in `acceptance_overlay`. In the existing `execution-history` query handler, attach the selected phase's derived status as top-level `phase_status`. The check builds a fresh disposable project through public `context-submit`, `plan-submit`, `execution-admit`, `execute-next` and `execution-task-start`; it retires plan 1 through Plan 1's public owner operation, observes handwritten `phase_status == "planned"` before repair completion, dispatches and fully closes plan 2 through real red/green, owner-attestation, task-close, suite, risk and plan-complete operations, then reads `cadence_query` operation `execution-history` and asserts handwritten `phase_status == "executed"` while the first outcome remains blocked and the later outcome is complete. It never calls derivation or history internals.
- **Verify:** cargo test -p cadence --test phase34_blocked_path phase34_blocked_then_completed_phase_is_derived_executed -- --exact.

## Notes

This is the second sequential dispatch and depends on Plan 1's owner operation. `execution-history.phase_status` is the T2 observable; no separate status operation or store record is introduced.
