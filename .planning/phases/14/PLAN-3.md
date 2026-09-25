---
phase: 14
plan: 3
requirements: ["T6"]
files: ["crates/cadence/src/execution_service.rs","crates/cadence/src/execution/boundary.rs","crates/cadence/src/execution/receipts.rs","crates/cadence/src/execution/patch.rs","crates/cadence/src/evidence/persistence.rs","crates/cadence/src/guard/audit.rs","crates/cadence/src/import/decisions.rs","crates/cadence/src/derivation/model.rs","crates/cadence/src/store/model.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/review/attempts.rs","crates/cadence/src/progress/render.rs","crates/cadence/src/progress_service.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase13_close.rs","crates/cadence/tests/refusal_shape.rs","crates/cadence/src/evidence_service_tests.rs","crates/cadence/tests/phase8_dispatch.rs","crates/cadence/tests/phase11_context.rs","crates/cadence/tests/phase7_guard.rs","crates/cadence/tests/store.rs","crates/cadence/src/rail/receipts.rs","crates/cadence/src/rail/risk.rs","crates/cadence/src/verification/verdicts.rs","crates/cadence/src/verification/waivers.rs","crates/cadence/src/verification/persistence.rs","crates/cadence/src/verification/completion.rs","crates/cadence/src/verification/runner.rs","crates/cadence/src/verification/human.rs","crates/cadence/src/execution/admission.rs","crates/cadence/src/execution/history.rs","crates/cadence/src/store/decisions.rs","crates/cadence/src/store/crash_tests.rs"]
directories: ["crates/cadence/src/rail","crates/cadence/src/verification","crates/cadence/src/execution","crates/cadence/src/store","crates/cadence/tests","crates/cadence/src/evidence"]
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P14-3-T1","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time"]},{"id":"P14-3-T2","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time"]},{"id":"P14-3-T3","verify":["cargo nextest run -p cadence --test phase12_execution phase12_routing_decision_gains_its_outcome_revision"]}]}
---
## Goal

Every decision record written from now on carries when it happened; every refusal carries its code and a typed located detail; close-path refusals are recorded; progress shows them (D-140, D-143).

## Must be true when done

- T6. When an operation is refused, the owner sees the refusal in the log with its code, its located detail and when it happened.

## Context

D-140 and D-143 at the phase 14 context. DecisionRecord in crates/cadence/src/store/model.rs carries version, id, revision, origin and decision and no time. BoundaryV1 in crates/cadence/src/execution/boundary.rs carries `lease_refusal: Option<Box<LeaseRefusal>>` as the one typed located field, and its envelope truncates a refusal reason at MAX_REASON_BYTES without a marker. In crates/cadence/src/execution_service.rs, stable_reason keeps the detail for six codes and a foreign-dispatch sentence and flattens every other code to a generic sentence, derivation_refusal maps DerivationError variants to codes, and native_error answers the close-path refusals without recording a decision. On execution-task-close an out-of-lease commit is retained as out_of_lease in SourceMaterial and never refused (D-170), while an out-of-lease staged path is refused rule lease, slot staged, id the path (crates/cadence/src/execution/receipts.rs); Close carries request_id, task, attempt, expected_version, completion, checks and verification, no evidence_commits field. The seconds source for the new field is WallClock in crates/cadence/src/review/material_io.rs behind the Clock trait in crates/cadence/src/review/io.rs; the native runners keep their own millisecond now() in crates/cadence/src/execution/runner.rs for run timing, which is not the field's source. The native task-close family is the return path for a dispatch since phase 33 (execution-task-start, execution-run, execution-task-close, execution-plan-complete); the schema-1 executor patch in crates/cadence/src/execution/patch.rs still records `undeclared-files` as the precedent for a recorded refusal. Progress grammar and common setup: phase 14 plan 1, context and notes parts.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T6-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time",
        "expected": {
          "kind": "literal",
          "value": "(a) execute-next answers code `state-conflict`; the reopened decisions hold one BoundaryV1 record with outcome `refused:state-conflict`, located equal to {source `ROADMAP.md`, line 5, entry 3, phase 4, field `complete`, declared `true`, derived `planned`} and at inside the test's clock window. (b) execution-task-close answers rule `lease`, slot `staged`, id `docs/outside.md`; one record `refused:lease` with located {rule `lease`, slot `staged`, id `docs/outside.md`} and at in the window. (c) execute-next answers code `missing-roadmap` with a reason containing `ROADMAP.md` and not `execution validation failed`; one record `refused:missing-roadmap` with located {rule `missing-roadmap`, slot `roadmap`, path `.planning/ROADMAP.md`} and at in the window. No envelope reason is the generic sentence. Progress on (a) contains `Record (phase 4): 0 routing decisions, 1 refusals, 0 gate fires` followed by `  refused state-conflict at source=ROADMAP.md line=5 entry=3 phase=4 field=complete declared=true derived=planned, <at>` with the record's integer; progress on (b) lists `  refused lease at rule=lease slot=staged id=docs/outside.md, <at>`. Repeating (a) after restart answers the same refusal and the log still holds exactly one record for it. Every record written after first touch carries at; imported rows carry none."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_refusal_records_carry_code_detail_and_time"
        },
        "setup": "Three projects. (a) plan 2's legacy tree with phase 4 ticked on disk after the first touch. (b) a ProcessFixture from crates/cadence/tests/support/phase31.rs with one typed plan published, admitted, authorized and dispatched, whose task has a valid red and green check run recorded, and whose worktree has docs/outside.md staged but not committed, outside the plan's lease. (c) a fresh project whose .planning holds config.json and no ROADMAP.md. The test reads its clock in seconds before the first call and after the last.",
        "call": "(a) execute-next 4; (b) execution-task-close with the valid check pair while docs/outside.md is staged; (c) execute-next 1; progress on (a) and (b); restart; repeat (a); reopened each store, read decisions.",
        "boundary": "real refusing operations over stdio, real journal reopened; the clock is read by the test, never replaced",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "A refusal recorded without code, located object or at, or with the generic sentence, cannot be placed in time or joined to a line.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "An operation is refused and the owner sees the refusal in the log with its code, its located detail and when it happened: T6's outcome word for word."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T6-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/store/model.rs DecisionRecord.at",
          "crates/cadence/src/execution/boundary.rs Located",
          "crates/cadence/src/execution_service.rs stable_reason"
        ],
        "substance": "at on every decision record written from now on; the typed located object beside the bounded envelope, a roadmap conflict carrying source, line, zero-based entry and the phase id itself; every code's own detail retained."
      },
      "reason": "Dropping at, located or the detail leaves the log counting refusals, not explaining them.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "These are the three fields T6 names on the record."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T6-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/execution_service.rs close-path refusal recording"
        ],
        "substance": "Every cadence_apply execution-* typed refusal also recorded as a boundary decision with outcome, located object and at, the lease refusal included."
      },
      "reason": "A refusal answered but never recorded is one the owner cannot see in the log.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "T6 says the owner sees the refusal in the log; an unrecorded refusal is not in the log."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T6-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/progress/render.rs Record block refusal lines"
        ],
        "substance": "The progress Record block listing the phase's refusals with code, located summary and at."
      },
      "reason": "Without the lines the record exists but the owner never sees it.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The Record block is where the owner sees the log."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Time and located detail on every recorded refusal

- **ID:** P14-3-T1
- **Files:** crates/cadence/src/store/model.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/execution/boundary.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/derivation/model.rs, crates/cadence/src/evidence/persistence.rs, crates/cadence/src/guard/audit.rs, crates/cadence/src/import/decisions.rs, crates/cadence/src/review/attempts.rs, crates/cadence/src/progress/render.rs, crates/cadence/src/progress_service.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/tests/support/phase14.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase13_close.rs, crates/cadence/tests/refusal_shape.rs, crates/cadence/src/evidence_service_tests.rs, crates/cadence/tests/phase8_dispatch.rs, crates/cadence/tests/phase11_context.rs, crates/cadence/tests/phase7_guard.rs, crates/cadence/tests/store.rs, crates/cadence/src/rail/receipts.rs, crates/cadence/src/rail/risk.rs, crates/cadence/src/verification/verdicts.rs, crates/cadence/src/verification/waivers.rs, crates/cadence/src/verification/persistence.rs, crates/cadence/src/verification/completion.rs, crates/cadence/src/verification/runner.rs, crates/cadence/src/verification/human.rs, crates/cadence/src/execution/admission.rs, crates/cadence/src/execution/history.rs, crates/cadence/src/store/decisions.rs, crates/cadence/src/store/crash_tests.rs
- **Action:** Deliver P14-T6-C, P14-T6-A1 and P14-T6-A3. Add `at: Option<u64>` (seconds, serde default, skipped when none) to DecisionRecord, stamped from the Clock at every non-test construction site the writer commits from now on; imported rows stay absent; every explicit DecisionRecord literal in the crate (the files in this task's list) gains the field, since a serde default never fills a struct literal; exclude it from any whole-record equality the writer validates. Add `located: Option<Located>` beside lease_refusal on BoundaryV1: {source, line, entry, phase, field, declared, derived} for a roadmap conflict (the phase id itself, never the ordinal alone), {rule, slot, path} for a missing or invalid input, {rule, slot, id} otherwise (a lease refusal's id is the staged path). Keep the MAX_REASON_BYTES bound and append `[cut]` when truncated. stable_reason returns each code's own detail; derivation_refusal carries each DerivationError's fields. Progress lists the current phase's refusals in the Record block. Update the regressions that pin the generic sentence.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time

### Task 2: Record native close-path refusals

- **ID:** P14-3-T2
- **Files:** crates/cadence/src/execution_service.rs, crates/cadence/src/execution/receipts.rs, crates/cadence/src/execution/boundary.rs, crates/cadence/src/store/writer.rs, crates/cadence/tests/phase14_receipts.rs
- **Action:** Deliver P14-T6-A2. Every cadence_apply execution-* refusal answered through native_error is also recorded as a BoundaryV1 decision with outcome `refused:<code>`, the diagnostic's rule, slot, id and reason in `located` and the envelope, plus `at`, the way the schema-1 patch path records `undeclared-files`. The out-of-lease staged path on execution-task-close is the named case: {rule lease, slot staged, id <path>}; an out-of-lease commit stays retained and unrefused (D-170). Recording never changes the answer; a replayed refusal does not duplicate (operation id = boundary identity).
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_refusal_records_carry_code_detail_and_time

### Task 3: Fill the routing decision's outcome edge

- **ID:** P14-3-T3
- **Files:** crates/cadence/src/store/writer.rs, crates/cadence/src/execution_service.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/src/execution/history.rs
- **Action:** P9, a task not a truth: when a dispatch's plan completes natively, the decision `routing:<dispatch id>` the writer records at issue gains a second revision whose receipt is the id of the native-plan completion decision (`native-plan:<phase>:<request digest>`, the Gate record plan_decision writes in crates/cadence/src/execution/history.rs); when a schema-1 patch lands, the receipt is the identity of the boundary record that answered it; observed effort stays Missing; the writer's routing validation accepts the later revision. Add the regression phase12_routing_decision_gains_its_outcome_revision to crates/cadence/tests/phase12_execution.rs (no existing phase 12 test covers routing; the record-shape tests live in crates/cadence/tests/phase8_dispatch.rs).
- **Verify:**
  - cargo nextest run -p cadence --test phase12_execution phase12_routing_decision_gains_its_outcome_revision

## Notes

Execution rules: phase 14 plan 1, notes part. `at` is seconds since epoch (D-143) from the review Clock trait; `located` rides the boundary record; a request echo is not added; P10 (legacy Decision::Boundary rows stay excluded from recall) stands. Regressions that pin the generic sentence are updated to the detail; no assertion on a code or on replay is weakened. Falsification findings 3 to 8 of .codex-analysis/phase14-falsification.md corrected this plan on 2026-09-18.
