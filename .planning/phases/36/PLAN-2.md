---
phase: 36
plan: 2
requirements: ["T2","T3"]
files: ["crates/cadence/src/execution/admission.rs","crates/cadence/src/execution/allocation.rs","crates/cadence/src/verification/inputs.rs","crates/cadence/tests/phase36_released_checks.rs","crates/cadence/tests/support/phase13.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P36-2-T1","verify":["cargo test -p cadence --test phase36_released_checks phase36_extension_reassigns_released_check -- --exact"]},{"id":"P36-2-T2","verify":["cargo test -p cadence --test phase36_released_checks phase36_blocked_then_completed_phase_gets_verification_attempt -- --exact"]}]}
---
# Phase 36: What a blocked plan leaves behind - Plan 2

## Goal

Keep released allocation rows as immutable history without counting them as active owners, and let verification accept the same blocked-then-later-completed phase history that execution already accepts.

## Must be true when done

- T2. When a later plan's task claims a released check, the owner sees the extension admitted.
- T3. When every blocked plan has a later-admitted completed plan, the owner gets a verification attempt for the phase.

## Context

D-158 and D-159 are at .planning/phases/36/CONTEXT.md:8-9. An extension must preserve every old allocation row byte-for-byte at crates/cadence/src/execution/admission.rs:88-105. With an unchanged released definition, current allocation validation then counts the preserved old row and the later row as two owners and returns rule allocation-owner at crates/cadence/src/execution/allocation.rs:51-52; in the two-row fixture its exact slot is contract.allocation[1].checks[0]. The fix keeps admission.rs:98-101's history invariant and changes only the active interpretation passed to allocation validation. Unknown current items, stale active revisions, duplicate task assignments, missing tasks and unowned current checks keep their existing refusals at crates/cadence/src/execution/allocation.rs:33-63.

Verification presently rejects any admitted plan without its own Completion at crates/cadence/src/verification/inputs.rs:112-115, then rejects every unclosed task and requires close proof at crates/cadence/src/verification/inputs.rs:116-125. That contradicts the sole execution completion rule: every complete plan counts, and a blocked plan counts only when a higher admission-set version contains a completed plan, at crates/cadence/src/execution/history.rs:539-551. Make observe call that exact rule. Revalidate receipts, owner inspection and source for each task that has Close-derived completed state, using the unchanged receipt gates at crates/cadence/src/execution/receipts.rs:334-376; ask no close proof of a retired or not-run task in a valid blocked plan. Active dispatch, event identity, coherent map, authority and source checks stay unchanged.

This preserves D-110's “exactly one responsible closing task” for current checks at .planning/phases/12/CONTEXT.md:184-194 and D-120's new approved identity, explicit versioned extension and immutable receipts at .planning/phases/12/CONTEXT.md:325-334. Phase 34 established that retirement is a task event and later dispatch remains possible in crates/cadence/tests/phase34_blocked_path.rs:377-428, and its blocked/later-complete fixture runs the real task, suite and risk path at crates/cadence/tests/phase34_blocked_path.rs:431-556. Reuse that sequence through tests/support/phase13.rs; do not edit phase 34 or admit its plan 3 here.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P36-T2-C",
      "spec": {
        "command": "cargo test -p cadence --test phase36_released_checks phase36_extension_reassigns_released_check -- --exact",
        "expected": {
          "kind": "property",
          "value": "A public execution-extend call returns status \"ok\" and set_version 2 when its contract preserves the first admission's allocation entry byte-for-byte and adds a later plan task claiming the released check id. The retained old assignment remains readable in the extension contract as history, the new assignment is the sole active owner, and no allocation-owner refusal is returned."
        },
        "test": {
          "file": "crates/cadence/tests/phase36_released_checks.rs",
          "function": "phase36_extension_reassigns_released_check"
        },
        "setup": "Create a fresh disposable signed project through the real stdio Client. Publicly approve and publish an initial plan whose task owns one check, admit that plan alone, authorize/dispatch/start it, and retire the unfinished task. Publish a later plan carrying the same check id and unchanged definition so publication itself is a valid shared alias. Build the full version-2 contract from public plan-read/evidence-read identities, preserving the old allocation entry exactly and adding the later task assignment.",
        "call": "Call cadence_apply execution-extend with expected_set_version 1 and the full contract, then read execution-history/admission-visible output and compare the extension receipt and both retained allocation rows to handwritten expectations.",
        "boundary": "Real binary over MCP stdio -> retained admission and retirement history -> execution extension validation and durable versioned admission record.",
        "fakes": []
      },
      "reason": "Without D-158's historical-owner treatment, allocation::validate reaches allocation-owner at contract.allocation[1].checks[0].",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The public-boundary result is the one approved by phase 36 T2."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P36-T3-C",
      "spec": {
        "command": "cargo test -p cadence --test phase36_released_checks phase36_blocked_then_completed_phase_gets_verification_attempt -- --exact",
        "expected": {
          "kind": "property",
          "value": "After plan 1 is retired blocked and plan 2 is admitted by a later set extension and completed through real red/green, owner attestation, task close, suite, risk settlement and plan completion, cadence_query verify-next returns status \"ok\" with a new verification attempt and complete inputs. The retained execution facts still show plan 1 blocked with no Close for its retired task and plan 2 complete; neither execution.plans nor execution.tasks is returned as a refusal slot."
        },
        "test": {
          "file": "crates/cadence/tests/phase36_released_checks.rs",
          "function": "phase36_blocked_then_completed_phase_gets_verification_attempt"
        },
        "setup": "Create a separate fresh disposable signed project using the phase-34 retire fixture flow through tests/support/phase13.rs Client. Publicly context-submit and plan-submit plan 1, execution-admit it alone, then authorize, dispatch, start and retire its check-owning task. Publicly publish plan 2, execution-extend it at set version 1 with the old allocation retained and the released check assigned to plan 2, then authorize and dispatch it. Commit a handwritten failing test, run the allocated check red, implement and commit green, run green and named verification, retain exact owner inspection, close the task, run the suite once, settle risk and execution-plan-complete. Keep the Git source clean.",
        "call": "Call cadence_query verify-next for phase 36 and assert the public attempt and its inputs, while separately reading execution-history to assert the blocked/complete outcomes and absence of a Close for the retired task.",
        "boundary": "Real binary over MCP stdio -> public publication/admission/execution records and committed source -> verification input observation -> serialized verification attempt.",
        "fakes": []
      },
      "reason": "The present verification loop rejects the blocked plan at execution.plans, or its unclosed retired task at execution.tasks, before an attempt can be issued.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The public-boundary result is the one approved by phase 36 T3."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P36-A-RELEASED-ALLOCATION",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/admission.rs::contribute",
          "crates/cadence/src/execution/admission.rs::validate",
          "crates/cadence/src/execution/allocation.rs::validate"
        ],
        "substance": "An extension still preserves every earlier allocation row exactly, but allocation validation recognizes a check row owned by an unclosed task in a retained Blocked plan as historical. It skips that row for current item/revision and owner counting while requiring one active owner for each current check."
      },
      "reason": "Dropping the old row rewrites admission history, while counting it as active prevents the later task from owning the released check.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This retained implementation is necessary for the owner-visible outcome in T2."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P36-A-VERIFICATION-INPUTS",
      "spec": {
        "locators": [
          "crates/cadence/src/verification/inputs.rs::observe",
          "crates/cadence/src/execution/history.rs::phase_complete",
          "crates/cadence/src/execution/history.rs::plan_task_views",
          "crates/cadence/src/execution/receipts.rs::validate_close"
        ],
        "substance": "Verification gates plan sufficiency with history::phase_complete. It revalidates close receipts only for task projections that actually contain a Close, so a blocked plan's retired or not-run tasks require no invented close proof while every closed task retains the existing receipt/source checks."
      },
      "reason": "Reintroducing all-plan completion or all-task close requirements prevents verification of the approved blocked-then-repaired history.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This retained implementation is necessary for the owner-visible outcome in T3."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Treat a released allocation row as history

- **ID:** P36-2-T1
- **Files:** crates/cadence/src/execution/admission.rs, crates/cadence/src/execution/allocation.rs, crates/cadence/tests/phase36_released_checks.rs, crates/cadence/tests/support/phase13.rs.
- **Action:** First add phase36_extension_reassigns_released_check as a red real-stdio check. Reuse Plan 1's released-check projection while admission rebuilds the current map union and supplies allocation validation with the exact historical check rows released by blocked unclosed tasks. Preserve the earlier allocation entry exactly so admission-reassignment still protects history. In allocation::validate, continue assigning every task row, but skip a released historical check row for current item/revision lookup and owner counting; require the later row to match current authority and remain the sole active owner. Assert the public execution-extend result and retained version-2 contract. Do not weaken allocation-owner for two live owners.
- **Verify:** cargo test -p cadence --test phase36_released_checks phase36_extension_reassigns_released_check -- --exact.

### Task 2: Admit verification from the authoritative phase-complete rule

- **ID:** P36-2-T2
- **Files:** crates/cadence/src/verification/inputs.rs, crates/cadence/tests/phase36_released_checks.rs, crates/cadence/tests/support/phase13.rs.
- **Action:** First add phase36_blocked_then_completed_phase_gets_verification_attempt as the red public-boundary check, using a separate fresh project and the phase-34 retire/repair sequence. In verification::inputs::observe, after the existing inactive-dispatch gate, require history::phase_complete once for the admitted plan set. Iterate admitted task views only to inspect tasks whose projection is completed; for each closed task keep unknown-run, Close proof, pair, owner and source revalidation unchanged. Do not demand or invent Close for a retired or not-run task. Complete the later-admitted plan through actual committed red/green material, owner attestation, named verification, suite, risk and execution-plan-complete, then assert verify-next returns its real attempt and retains the blocked/complete execution history.
- **Verify:** cargo test -p cadence --test phase36_released_checks phase36_blocked_then_completed_phase_gets_verification_attempt -- --exact.

## Notes

Run after Plan 1. Phase 34 plan 3 is deliberately untouched and remains the first external consumer after phase 36 lands. No new operation, record, store file, answer field or observation item is introduced. Existing allocation refusals and receipt checks remain controls; no existing test assertion is intentionally moved.
