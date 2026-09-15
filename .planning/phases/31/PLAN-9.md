---
phase: 31
plan: 9
requirements: ["P31-7-REPAIR"]
files: ["crates/cadence/src/execution/render.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution_service_tests.rs","crates/cadence/tests/phase8_dispatch.rs","crates/cadence/tests/support/phase31_hosts.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-9-T1","verify":["cargo test -p cadence --lib server::execution_service_tests::phase8_gap_active_dispatch_returns_original_choice_under_new_config -- --exact","cargo test -p cadence --lib server::execution_service_tests::fresh_dispatch_contains_read_contract_and_rerenders_to_admitted_prompt_bytes -- --exact"]},{"id":"P31-9-T2","verify":["cargo clippy --workspace --all-targets -- -D warnings"]}]}
---
# Phase 31: The read layer - Plan 9

## Goal

Repair phase 31 plan 7's blocked suite through the D-120 gap path by preserving admitted execution-dispatch prompt bytes across renderer upgrades, keeping the compiled read contract in every newly admitted dispatch, and clearing the remaining phase-31 host-support Clippy warning.

## Must be true when done

- Every outstanding dispatch re-renders byte-for-byte with the named format under which it was admitted, including the historical lease-guidance distinction, and is refused with `prompt-mismatch` only when no supported format matches its retained `prompt_bytes`.
- Every newly admitted dispatch contains `crate::read::instructions::CONTRACT` and re-renders to its own retained `prompt_bytes`.
- The phase-31 host support continuation loop is expressed as `while let` with no behavior change, and the workspace is Clippy-clean with warnings denied.

## Context

This is the D-120 gap plan linked to phase 31 plan 7, the blocked plan this gap plan repairs. P31-7-T1 completed at commit `4e5d3f8c`, but suite run `p31-7-suite-4e5d3f8c` finished 245 passed / 1 failed and left blocker `suite-failed:p31-7-suite-4e5d3f8c`. The failing red is `server::execution_service_tests::phase8_gap_active_dispatch_returns_original_choice_under_new_config` at `crates/cadence/src/execution_service_tests.rs:2597`; its child reaches the `expected confirmed active dispatch` panic at `crates/cadence/src/execution_service_tests.rs:2611`.

Commit `4e5d3f8c` inserted `crate::read::instructions::CONTRACT` into the dispatch Instructions block rendered at `crates/cadence/src/execution/render.rs:178` and `crates/cadence/src/execution/render.rs:182`. Admitted dispatches retain `prompt_bytes`; the historical fixture retains 8772 at `crates/cadence/src/execution_service_tests.rs:2122`, and its independently encoded admitted prompt begins at `crates/cadence/src/execution_service_tests.rs:2128`. The test requires byte equality with that prompt at `crates/cadence/src/execution_service_tests.rs:2621`.

Outstanding dispatch readback re-renders in `dispatch_response` at `crates/cadence/src/execution_service.rs:1791`. When the current byte count differs, it retries `render_prompt_version(&dispatch, false)` at `crates/cadence/src/execution_service.rs:1798`, but that helper calls the same current `render_dispatch_prompt` at `crates/cadence/src/execution_service.rs:1817`; omitting lease guidance cannot remove the newly inserted read contract, so neither candidate can reproduce a pre-`4e5d3f8c` prompt and the read is refused at `crates/cadence/src/execution_service.rs:1800`.

The fallback dates to `3af58d1a`: it preserved dispatches admitted before lease guidance by trying the then-current renderer first with guidance and then without it. That lease-guidance on/off history must remain representable when the content format becomes named. The only direct renderer oracle call outside the service is `crates/cadence/tests/phase8_dispatch.rs:1129`, whose two historical renderings and independent byte receipts must remain intact. The remaining Clippy failure is the continuation loop at `crates/cadence/tests/support/phase31_hosts.rs:117`.

This repair owns no phase truth. The existing failing unit test is the red, its unchanged pass is the green, and the fresh-dispatch regression is task-local protection; this plan republishes no check and adds no evidence item.

## Evidence map

```json
{
  "mode": "attached",
  "items": []
}
```

## Tasks

### Task 1: Version dispatch prompt rendering without stranding outstanding work

- **ID:** P31-9-T1
- **Files:** crates/cadence/src/execution/render.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution_service_tests.rs, crates/cadence/tests/phase8_dispatch.rs.
- **Action:** Retain the exact pre-`4e5d3f8c` Instructions layout, without `crate::read::instructions::CONTRACT`, as a named historical renderer in `execution/render.rs`. Replace the renderer's anonymous format choice with an explicit format selector—an enum or equivalent, not a second boolean—whose current read-contract format and historical formats are named. Preserve the lease-guidance on/off distinction for every admitted format era to which it applied: the current admission path renders the read-contract format with lease guidance, while the historical candidates retain both the pre-read-contract lease-guidance rendering and the older pre-lease-guidance rendering. In `dispatch_response`, render the current admission format first, then each named historical candidate in newest-to-oldest order, accept the first candidate whose byte count equals the retained `prompt_bytes`, and return `prompt-mismatch` only if none match. Update the direct renderer oracle call at `crates/cadence/tests/phase8_dispatch.rs:1129` to select the corresponding named historical formats without changing its independently encoded receipts. Keep `GAP_ACTIVE`, every fixture, every retained `prompt_bytes`, and `GAP_ADMITTED_PROMPT` byte-for-byte unchanged. Add `fresh_dispatch_contains_read_contract_and_rerenders_to_admitted_prompt_bytes` in `execution_service_tests.rs` to admit a fresh dispatch, assert its prompt contains `crate::read::instructions::CONTRACT`, assert the retained byte count equals the prompt length, and assert outstanding readback reproduces the admitted bytes. Use the existing failing test unchanged as the red and its pass as the green. Land the repair as one signed conventional commit naming P31-9-T1 only after both verify commands pass.
- **Verify:** cargo test -p cadence --lib server::execution_service_tests::phase8_gap_active_dispatch_returns_original_choice_under_new_config -- --exact
- **Verify:** cargo test -p cadence --lib server::execution_service_tests::fresh_dispatch_contains_read_contract_and_rerenders_to_admitted_prompt_bytes -- --exact

### Task 2: Remove the phase-31 host-support Clippy warning

- **ID:** P31-9-T2
- **Files:** crates/cadence/tests/support/phase31_hosts.rs.
- **Action:** Rewrite the continuation loop at `crates/cadence/tests/support/phase31_hosts.rs:117` from `loop { let Some(continuation) = ... else { break }; ... }` to the equivalent `while let Some(continuation) = ...` form. Preserve the continuation extraction, owned string, request order, and termination behavior exactly. Make no other host-support behavior change. Land the lint-only repair as one signed conventional commit naming P31-9-T2 after its verify command passes.
- **Verify:** cargo clippy --workspace --all-targets -- -D warnings

## Notes

Plan 7's completion commit `4e5d3f8c` stays as it is; do not revert it. This plan adds no truth, check, artifact, link, or observation, and its attached evidence map is empty because the current phase union already covers every truth.

After this plan lands, rebuild the release binary and restart the resident before plan 8 dispatches, because the resident renders the dispatch. Run `cargo test --workspace --no-fail-fast` once at plan close.
