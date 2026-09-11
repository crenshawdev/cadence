PLAN COMPLETE
Plan: .planning/phases/10/PLAN-2.md
Tasks: 3 of 3
Branch: cadence/binary-owns-process
Base: c395fbadb958f9e3e437db157a7332a8b05f3879

| Task | Commit hash(es) | %G? | Verify command | Literal result |
|---|---|---|---|---|
| 1 — Preserve accounting on HTTP refusal | red `82caf87a9d32b45aacd1388d2549bd12a1d6dbe3`; green `9176e7b03e62efc8a2b54e545349aac9bf462642` | G / G | `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_error_status_retains_usage -- --exact` | Red: `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 237 filtered out; finished in 0.24s`; exit 101. Green: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 237 filtered out; finished in 1.28s`; exit 0. |
| 2 — Route failed attempts to saved FIRST selection | ef25cebdbbed994699c49b719dec5275fd0801cb | G | `cat crates/cadence/src/review/provider/delivery.rs crates/cadence/src/review_service.rs` | Source displayed; exit 0. Inspected pre-launch failure via accept_launch_failure, launched failure via accept_return, saved select_next order, closure prerequisite, terminal callback replay, local dispatch WAIT/unchanged-return guidance, and failed fallback acceptance. |
| 3 — Close timed-out operations | red `21f3502f0533f4b4dce15c52e21be6b4cd98757d`; green `ad24e0859985cdb356e8cf1602c8f19253603db6` | G / G | `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_fallback_closes_once -- --exact` | Red: `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 238 filtered out; finished in 2.13s`; exit 101. Green: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 238 filtered out; finished in 8.61s`; exit 0. |

## Red-then-green evidence

P10-T2-C red: `82caf87a9d32b45aacd1388d2549bd12a1d6dbe3` (G), failure at phase10_provider_tests.rs:217:13:
```text
assertion `left == right` failed: HTTP 503 input accounting for openai
  left: Null
 right: Number(23)
```

Green: `9176e7b03e62efc8a2b54e545349aac9bf462642` (G), exactly one test passed. The real OpenAI/Gemini/DeepSeek adapters recover usage (23,9) on HTTP 503 with one failed closure and no accepted original; missing usage remains null. Response model, bounded raw accounting and sanitized error survive filesystem reopening.

P10-T5-C red: `21f3502f0533f4b4dce15c52e21be6b4cd98757d` (G), failure at phase10_provider_tests.rs:562:47:
```text
outer-expiry/canceled-poll: expired operation did not durably close after canceled poll within acknowledgment budget
```
The check compiled and selected exactly one test. Its expiry/canceled-poll row failed, as required. The test-only clock input also emitted a dead_code warning until connected by production code.

Green: `ad24e0859985cdb356e8cf1602c8f19253603db6` (G), exactly one test passed. Controlled clock, wire and credential inputs drive two saved FIRST providers sequentially; the filesystem store, worker, admission, selection, dispatch, observation and return operations all run real. Every issued attempt closes once; actual local successful bytes/findings/voice survive, and launch failure, missing return and malformed return finish complete-with-failure. No-key/over-cap attempts have no request or invented participation/accounting. Canceled polling does not abandon expiry acknowledgment; the HTTP body is dropped, late success conflicts, terminal callbacks do not spend again, and reopening preserves the records.

The first successful T5 development run after the source-view repair was `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 238 filtered out; finished in 8.35s`. The final 8.61s run includes additional explicit terminal-callback, late-return conflict and exact raw-byte assertions.

## Deviations

- [deviation] First post-implementation T5 verification expected one pass, but observed `review operation refused: Refused { code: "invalid-review-operation", reason: "entry outside retained attempt view" }` (`0 passed; 1 failed; 238 filtered out; finished in 0.61s`). Expiry closure passed far enough to issue local fallback; its cloned provider view contained entries private to the failed provider attempt. Repaired local dispatch construction within the lease to recover PLAN-1's saved source_view before issuing the local attempt. No truth, decision or lease was changed.

## O1 and open items

O1 remains **not seen** for phase 10. The updated public-operation pilot in docs/architecture/provider-port.md preserves the owner's phase-6 observation (347 tests passed but the real host did not load). Phase-10 observer, time, project/run and successful/failed/local attempt references remain blank. Only the owner can supply this episode; even an accepted observation caps T1/T5 at concerns. No live provider request was made. No other open items.
All five commits passed the lease check and post-commit signature verification printed G. No unexpected deletions. Author: John Crenshaw <john@jcrenshaw.dev>; signing key: 693AB15F91734B0C. Reports remain uncommitted.

## Full-plan verification

Clippy: passed, exit 0. Command: `cargo clippy --workspace --all-targets -- -D warnings`. Literal result: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 3.83s``. Run once after task 3's green commit; no warnings.

Full suite: passed, exit 0. Command: `cargo test --workspace --no-fail-fast`. Run **once** after task 3's green commit. Workspace target totals: **856 passed / 0 failed**, 0 ignored, across 38 test binaries and the doc-test target. No repair or rerun was needed.

| Cargo target | Passed | Failed | Literal result |
|---|---|---|---|
| unittests src/lib.rs | 170 | 0 | `test result: ok. 170 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s` |
| unittests src/main.rs | 239 | 0 | `test result: ok. 239 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 126.15s` |
| tests/derivation_consistency.rs | 6 | 0 | `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s` |
| tests/derivation_inputs.rs | 12 | 0 | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/evidence_store.rs | 4 | 0 | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| tests/execution_boundary_compat.rs | 11 | 0 | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.78s` |
| tests/execution_store.rs | 18 | 0 | `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 279.38s` |
| tests/mcp.rs | 18 | 0 | `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.08s` |
| tests/next_action.rs | 7 | 0 | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase7_guard.rs | 23 | 0 | `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.59s` |
| tests/phase7_lease.rs | 23 | 0 | `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.82s` |
| tests/phase7_receipts.rs | 11 | 0 | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s` |
| tests/phase7_risk.rs | 22 | 0 | `test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.35s` |
| tests/phase7_surfaces.rs | 4 | 0 | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase8_config.rs | 6 | 0 | `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s` |
| tests/phase8_dispatch.rs | 24 | 0 | `test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s` |
| tests/phase8_global.rs | 12 | 0 | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase8_interview.rs | 40 | 0 | `test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase8_routing.rs | 44 | 0 | `test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.02s` |
| tests/phase9_admission.rs | 8 | 0 | `test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_binding.rs | 4 | 0 | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_consumers.rs | 7 | 0 | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_context.rs | 5 | 0 | `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_contract.rs | 31 | 0 | `test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_deferred.rs | 12 | 0 | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s` |
| tests/phase9_history.rs | 1 | 0 | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_inventory.rs | 3 | 0 | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_invoking.rs | 1 | 0 | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_material.rs | 14 | 0 | `test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_model.rs | 2 | 0 | `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_observations.rs | 3 | 0 | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_policy.rs | 11 | 0 | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_recovery.rs | 10 | 0 | `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_returns.rs | 7 | 0 | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| tests/phase9_selection.rs | 21 | 0 | `test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_specialist.rs | 3 | 0 | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| tests/phase9_stream.rs | 2 | 0 | `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s` |
| tests/store.rs | 17 | 0 | `test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s` |
| Doc-tests cadence | 0 | 0 | `test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |

The main binary also launched two internal child-process test invocations, reported separately from workspace target totals:

```text
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 238 filtered out; finished in 0.02s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 238 filtered out; finished in 0.56s
```

Counting every printed summary, including these children, gives **858 passed / 0 failed**. No full-suite run occurred during the tasks. Clippy and the suite both passed on the committed source at `ad24e0859985cdb356e8cf1602c8f19253603db6`.
