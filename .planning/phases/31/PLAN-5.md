---
phase: 31
plan: 5
requirements: ["P31-1-REPAIR"]
files: ["crates/cadence/src/import/routing_admission_tests.rs","crates/cadence/src/import/tests.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/store/mod.rs","crates/cadence/src/store/model.rs","crates/cadence/src/store/root.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/verification/inputs.rs","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase28_evidence.rs","docs/architecture/store.md"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-5-T1","verify":["cargo test -p cadence --lib import::tests::root_identity_reopens_at_same_path_with_matching_bytes_and_legacy_binding -- --exact","cargo test -p cadence --test phase12_execution phase12_native_task_continues_after_same_path_root_identity_change -- --exact"]}]}
---
# Phase 31: The read layer - Plan 5

## Goal

Restore the root-binding fix through the admitted gap path so phase 31 can continue after plan 1's unrelated suite failure.

## Must be true when done

- A root whose filesystem identity changed at the same path is accepted when its retained bytes and authority digests match, while changed bytes or a different path remain refused.

## Context

This is the D-120 gap plan linked to phase 31 plan 1. Plan 1's suite launch `p31-1-suite-001` at `c06cb796` failed because the first hand-landed store fix was present during that suite, not because of plan 1's code. The corrected hand fix was `9d24bdaf`; `8ccb543f` reverted it so this new admitted plan can land the repair through the front door. Plan 1 remains recorded as failed and is repaired by this plan; no receipt is rekeyed and no rerun is inferred.

## Evidence map

```json
{
  "mode": "attached",
  "items": []
}
```

## Tasks

### Task 1: Land the root-binding fix

- **ID:** P31-5-T1
- **Files:** crates/cadence/src/import/routing_admission_tests.rs, crates/cadence/src/import/tests.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/mod.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/root.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/verification/inputs.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase28_evidence.rs, docs/architecture/store.md.
- **Action:** Re-apply exactly the change that `8ccb543f` reverted. Run `git revert --no-commit 8ccb543f` to obtain the executor tree, then commit that tree as one signed conventional commit whose subject names `P31-5-T1`, for example `fix(store): a root whose filesystem identity changed at the same path is the same root when its bytes match (P31-5-T1)`, using `9d24bdaf`'s commit body. Do not create separate red and green commits: this task owns no check, so the phase-12 red-then-green pairing does not apply. Close the task only when both verify commands pass at the completion commit.
- **Verify:** cargo test -p cadence --lib import::tests::root_identity_reopens_at_same_path_with_matching_bytes_and_legacy_binding -- --exact.
- **Verify:** cargo test -p cadence --test phase12_execution phase12_native_task_continues_after_same_path_root_identity_change -- --exact.

## Notes

This repair adds no truth, check, artifact, link or observation. Its attached evidence map is empty because plans 1 through 4 already carry the one check for every phase 31 truth. Run the declared suite once at plan close.
