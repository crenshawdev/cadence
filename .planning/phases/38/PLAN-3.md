---
phase: 38
plan: 3
requirements: ["T6","T7"]
files: ["crates/cadence/src/server.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution_service_tests.rs","crates/cadence/src/execution/model.rs","crates/cadence/src/execution/receipts.rs","crates/cadence/src/execution/runner.rs","crates/cadence/src/execution/history.rs","crates/cadence/src/execution/tests.rs","crates/cadence/src/verification/runner.rs","crates/cadence/tests/mcp.rs","crates/cadence/tests/phase38_suite_gate.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P38-3-T1","verify":["cargo test -p cadence --test phase38_suite_gate phase38_execute_next_dispatches_named_plan_first -- --exact","cargo test -p cadence --test phase38_suite_gate phase38_large_suite_receipt_retains_every_failing_test_name -- --exact","cargo test -p cadence --lib server::execution_service_tests::execute_next_honors_named_plan -- --exact","cargo test -p cadence --lib execution::tests::capture_retains_result_lines_past_prefix -- --exact"]}]}
---
# Phase 38: The suite is a gate, not a guillotine - Plan 3

## Goal

Let the owner choose the next admitted plan explicitly and make oversized suite receipts retain every test-result line needed for repair.

## Must be true when done

- T6. When the owner names an admitted plan number to execute-next, the owner gets that plan dispatched ahead of an earlier admitted plan that has no outcome.
- T7. When a suite's output exceeds 65,536 bytes, the owner sees every failing test's name in the retained suite receipt.

## Context

D-167 and D-168 are approved at .planning/phases/38/CONTEXT.md:13-14. QueryArguments currently exposes ExecuteNext { phase } only at crates/cadence/src/server.rs:243-298, while execution_service::query hashes only operation/phase at crates/cadence/src/execution_service.rs:315-324 and selects the first admitted plan without an outcome at crates/cadence/src/execution_service.rs:1106-1116. Add plan: Option<NonZeroU32> through the public schema, handler and request digest. When present, require that exact plan to be admitted, have no outcome, and not conflict with another active dispatch; dispatch it even when an earlier admitted plan is unfinished. When absent, preserve current first-ready behavior. Retain an explicit owner-selected marker in the dispatch answer/history so the response records why ordering differed.

Capture currently contains only bytes, digest and complete at crates/cadence/src/execution/receipts.rs:34-40. runner::capture stops retaining after 65,536 bytes at crates/cadence/src/execution/runner.rs:280-292, history rejects a larger retained buffer at crates/cadence/src/execution/history.rs:662-669, and runner::classify recognizes cargo and unittest result summaries at crates/cadence/src/execution/runner.rs:333-363. Extend each stream Capture with result_lines: Vec<String>. Continue hashing and bounding the ordinary retained prefix exactly as today, but scan the full stream and separately retain every UTF-8 line in the recognized cargo/libtest and unittest vocabulary that names an individual result or summary, including failing test names. Validate those lines and classify from the prefix plus this channel; never serialize them as JSON integer arrays and never apply the 65,536-byte prefix cap to them.

Both checks use separate fresh disposable signed projects and the real binary over stdio. T6 publishes/admit two plans, names the later plan, completes it through the public task/suite/risk path, and proves omission still chooses the earlier unfinished plan. T7 runs an actual committed suite process whose filler crosses the cap before its three named failures. Expected plan identities, selection marker, names, ordering, cap and refusal/status values are handwritten; no internal selector, fake Capture or observation item is used.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P38-T6-C",
      "spec": {
        "command": "cargo test -p cadence --test phase38_suite_gate phase38_execute_next_dispatches_named_plan_first -- --exact",
        "expected": {
          "kind": "property",
          "value": "With two ordered admitted plans and no retained outcome for either, cadence_query execute-next with plan 2 returns status \"ok\", dispatch.plan == 2, and an explicit owner-selected order marker naming plan 2; execution-history retains plan 1 without an outcome, and a later execute-next without plan selects plan 1 by the original first-ready rule."
        },
        "test": {
          "file": "crates/cadence/tests/phase38_suite_gate.rs",
          "function": "phase38_execute_next_dispatches_named_plan_first"
        },
        "setup": "Create a fresh disposable signed Git project and start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase13.rs. Through public calls, context-submit the fixture truths, plan-submit the exact attached plan map, execution-admit its publication and map revisions, execution-authorize, execute-next, execution-task-start, create and commit the test subject, execution-run the admitted red and green check stages, execution-owner-attest, execution-task-close, and execution-suite. Expected payloads and result values are handwritten; do not seed the store or call an internal projection, renderer, runner, or history function. Publish and admit two ordered plans in the same fresh phase. Name plan 2 on the initial execute-next, exercise that dispatched plan through its task and passing suite, and retain it active until the selection assertions are made; then complete it through the public risk/completion path so the default selector can be observed.",
        "call": "Call cadence_query with {operation: \"execute-next\", phase: <fixture>, plan: 2}; compare the dispatched identity and owner-selection marker to handwritten values, finish plan 2, then call execute-next without plan and assert it dispatches still-unfinished plan 1.",
        "boundary": "Public QueryArguments schema and stdio request -> admitted-plan selector -> durable dispatch answer/history ordering.",
        "fakes": []
      },
      "reason": "If the optional plan is ignored, accepts a non-admitted/completed target, or fails to record owner selection, the exact first response and later default-order assertions fail.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The real stdio boundary assertion is the owner-visible outcome approved as phase 38 T6."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P38-T7-C",
      "spec": {
        "command": "cargo test -p cadence --test phase38_suite_gate phase38_large_suite_receipt_retains_every_failing_test_name -- --exact",
        "expected": {
          "kind": "property",
          "value": "A real suite process that emits more than 65,536 bytes before and around three distinct failing test result lines returns a recognized failed receipt whose stdout.bytes length is at most 65,536, complete is false, and whose ordered UTF-8 result_lines contains all three handwritten failing test names and the failing summary; execution-history returns the same lines unchanged."
        },
        "test": {
          "file": "crates/cadence/tests/phase38_suite_gate.rs",
          "function": "phase38_large_suite_receipt_retains_every_failing_test_name"
        },
        "setup": "Create a fresh disposable signed Git project and start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase13.rs. Through public calls, context-submit the fixture truths, plan-submit the exact attached plan map, execution-admit its publication and map revisions, execution-authorize, execute-next, execution-task-start, create and commit the test subject, execution-run the admitted red and green check stages, execution-owner-attest, execution-task-close, and execution-suite. Expected payloads and result values are handwritten; do not seed the store or call an internal projection, renderer, runner, or history function. Make the admitted suite command run a committed executable test script that writes deterministic filler beyond 65,536 bytes and then libtest-shaped result lines for three handwritten failing names plus a recognized failing summary. Do not inject a receipt or call classify directly.",
        "call": "Call cadence_apply execution-suite so the real runner consumes the oversized process streams, then inspect the returned receipt and cadence_query execution-history. Assert the prefix bound, incomplete marker, exact ordered result_lines and all three names in both public surfaces.",
        "boundary": "Real oversized child-process stdout/stderr -> streaming Capture retention and classification -> suite receipt and public execution-history serialization.",
        "fakes": []
      },
      "reason": "If the fixed prefix remains the only retained evidence or result extraction stops at the cap, at least one handwritten failing name or the recognized summary is absent.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The real stdio boundary assertion is the owner-visible outcome approved as phase 38 T7."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P38-A-ORDER-AND-RESULT-LINES",
      "spec": {
        "locators": [
          "crates/cadence/src/server.rs::QueryArguments::ExecuteNext",
          "crates/cadence/src/execution_service.rs::query",
          "crates/cadence/src/execution/receipts.rs::Capture",
          "crates/cadence/src/execution/runner.rs::capture",
          "crates/cadence/src/execution/runner.rs::classify"
        ],
        "substance": "ExecuteNext accepts plan: Option<NonZeroU32>; selection validates the named identity is admitted, unfinished, and has no outcome, while omission preserves first-ready order. The durable/public dispatch records whether the owner selected the plan. Capture retains its bounded bytes prefix plus result_lines: Vec<String>, extracted in stream order from all complete input using the recognized cargo/libtest and unittest result-name/summary vocabulary. Classification consumes retained result lines as well as the prefix, and history validates the bounded prefix/digest separately without applying the 65,536 limit to result_lines."
      },
      "reason": "Without explicit selection provenance or a separately retained result-line channel, the binary can silently reorder work or preserve a failed summary while discarding the names needed to repair it.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The optional typed query field, validated selector and owner-selection marker implement T6."
        },
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The unbounded-by-prefix result_lines channel and receipt/history consumers implement T7."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Add owner-selected dispatch order and lossless result-line receipts

- **ID:** P38-3-T1
- **Files:** crates/cadence/src/server.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution_service_tests.rs, crates/cadence/src/execution/model.rs, crates/cadence/src/execution/receipts.rs, crates/cadence/src/execution/runner.rs, crates/cadence/src/execution/history.rs, crates/cadence/src/execution/tests.rs, crates/cadence/src/verification/runner.rs, crates/cadence/tests/mcp.rs, crates/cadence/tests/phase38_suite_gate.rs.
- **Action:** First add both phase-38 checks plus focused query/capture units and commit their exact red results. Then thread optional plan through the strict query schema, handler, request identity and selector; record explicit owner selection while preserving the omitted default. Add UTF-8 result_lines to Capture, update every constructor, scan complete process output while bounding only ordinary bytes, validate/classify from both retained channels, and return unchanged lines in receipts/history. Commit the implementation and rerun all exact checks green.
- **Verify:**
  - cargo test -p cadence --test phase38_suite_gate phase38_execute_next_dispatches_named_plan_first -- --exact
  - cargo test -p cadence --test phase38_suite_gate phase38_large_suite_receipt_retains_every_failing_test_name -- --exact
  - cargo test -p cadence --lib server::execution_service_tests::execute_next_honors_named_plan -- --exact
  - cargo test -p cadence --lib execution::tests::capture_retains_result_lines_past_prefix -- --exact

## Notes

This is one executor task because the two additions share only the public dispatch/receipt boundary and each has one small, independently asserted state path; both fit one red/green implementation dispatch. D-169 requires hand execution under the executor block and native verification afterward. Plan 3 assumes Plan 1's ActiveDispatch prompt fields and implicit rendered-file lease are already installed, but it has no dependency on or lease over any phase-31, phase-34, phase-36 or phase-37 plan/test file.
