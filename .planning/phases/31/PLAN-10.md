---
phase: 31
plan: 10
requirements: ["P31-7-REPAIR"]
files: ["crates/cadence/tests/support/phase31_hosts.rs","crates/cadence/tests/phase31_read_layer.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-10-T1","verify":["cargo clippy --workspace --all-targets -- -D warnings"]}]}
---
# Phase 31: The read layer - Plan 10

## Goal

Finish phase 31 plan 9's one remaining task through the D-120 gap path: clear the two phase-31 test-support Clippy warnings so the workspace is Clippy-clean with warnings denied.

## Must be true when done

- The phase-31 host support continuation loop is expressed as `while let` with no behavior change.
- The planner-round byte assertion calls `len()` on the report string directly.
- `cargo clippy --workspace --all-targets -- -D warnings` exits 0.

## Context

This is the D-120 gap plan linked to phase 31 plan 9, which the owner blocked by retiring P31-9-T1 as superseded by D-165 (`a58b9045`): dispatches admitted before retained prompts refuse readback as `prompt-not-retained` and are not re-rendered, so plan 9's first task had no work left. Plan 9's second task, P31-9-T2, never ran and returns here unchanged in substance, widened to the second warning Clippy now reports in the same test-support surface.

The two warnings are the continuation loop at `crates/cadence/tests/support/phase31_hosts.rs:375`, which Clippy asks to write as `while let`, and `round.report.as_bytes().len()` at `crates/cadence/tests/phase31_read_layer.rs:37`, which Clippy asks to write as `round.report.len()`. Both are lint-only: the loop keeps its continuation extraction, owned string, request order and termination; the assertion compares the same byte count.

This repair owns no phase truth and republishes no check; its evidence map is empty because the current phase union already covers every truth.

## Evidence map

```json
{
  "mode": "attached",
  "items": []
}
```

## Tasks

### Task 1: Remove the two phase-31 test-support Clippy warnings

- **ID:** P31-10-T1
- **Files:** crates/cadence/tests/support/phase31_hosts.rs, crates/cadence/tests/phase31_read_layer.rs.
- **Action:** Rewrite the continuation loop at `crates/cadence/tests/support/phase31_hosts.rs:375` from `loop { let Some(continuation) = ... else { break }; ... }` to the equivalent `while let Some(continuation) = ...` form, preserving the continuation extraction, owned string, request order and termination exactly. Replace `round.report.as_bytes().len()` at `crates/cadence/tests/phase31_read_layer.rs:37` with `round.report.len()`. Make no other change. Land the lint-only repair as one signed conventional commit naming P31-10-T1 after the verify command passes.
- **Verify:** cargo clippy --workspace --all-targets -- -D warnings

## Notes

Plan 9 stays blocked on the record with its retirement; this plan does not touch it. The suite is the plan's contract as the binary launches and classifies it today; `cargo test` output is what the runner reads, so the plan names it even though the workspace now runs nextest by hand.
