---
phase: 31
plan: 6
requirements: ["P31-2-REPAIR"]
files: ["crates/cadence/tests/phase12_execution.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-6-T1","verify":["cargo test -p cadence --test phase12_execution phase12_incomplete_execution_contract_is_refused -- --exact"]}]}
---
# Phase 31: The read layer - Plan 6

## Goal

Repair plan 2's phase-12 execution-admission fixture so a mapless publication reaches semantic binding validation.

## Must be true when done

- The compact plan-read form of a provisional publication becomes a shape-valid contract binding and is refused by `admission-binding`, without weakening the protected refusal shape or its assertion.

## Context

This is the D-120 gap plan linked to phase 31 plan 2. Plan 2's suite launch `p31-2-suite-001` at `9a2a39ed` failed on `crates/cadence/tests/phase12_execution.rs::phase12_incomplete_execution_contract_is_refused`.

The cause is fixture-only. Plan 2's T2 migration changed `contract()` at `crates/cadence/tests/phase12_execution.rs:377` to consume compact publications. Compact plan-read emits `map_revision: null` for a provisional publication at `crates/cadence/src/plan_service.rs:80`; the helper's `get(...).unwrap_or(...)` preserves that present null. The provisional control at `crates/cadence/tests/phase12_execution.rs:1619` therefore stops in `decode` at `crates/cadence/src/execution/admission.rs:145` with `admission-shape`, before `validate` can enforce `admission-binding` at `crates/cadence/src/execution/admission.rs:207`. The pre-existing `"stale"` sentinel at `crates/cadence/tests/phase12_execution.rs:1555` is already a shape-valid string and is not the cause.

Plan 2 remains recorded as failed and is repaired by this plan; completed outcomes are preserved, no receipt is rekeyed, and no rerun is inferred.

## Evidence map

```json
{
  "mode": "attached",
  "items": []
}
```

## Tasks

### Task 1: Normalize mapless compact readback in the admission fixture

- **ID:** P31-6-T1
- **Files:** crates/cadence/tests/phase12_execution.rs.
- **Action:** In `contract()`, change the compact-publication `map_revision` extraction so both an absent value and JSON null become the existing shape-valid empty-string binding, while every non-null revision is copied unchanged. Leave `admission_refusal`, the `admission-binding` assertion, and the refusal slot/id shape unchanged. Keep this edit confined to the helper near line 377, away from plan 5's work near lines 1622-1634. Do not create red and green commits: this task owns no check, so the phase-12 red-then-green pairing does not apply. Close the task only after its verify command passes at the completion commit, using one signed conventional commit whose subject names `P31-6-T1`.
- **Verify:** cargo test -p cadence --test phase12_execution phase12_incomplete_execution_contract_is_refused -- --exact

## Notes

This repair adds no truth, check, artifact, link or observation. Its attached evidence map is empty because plans 1 through 4 already carry the one check for every phase 31 truth. Run the declared suite once at plan close. The lease overlaps plan 5 only at the file level; plan 6 edits `contract()` near line 377 and must not touch plan 5's lines near 1622-1634.
