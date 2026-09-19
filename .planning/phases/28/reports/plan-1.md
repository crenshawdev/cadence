PLAN COMPLETE
Plan: .planning/phases/28/PLAN-1.md
Tasks: 6 of 6

| Task | Commit(s) | %G? | Verify command and literal result |
|---|---|---|---|
| 1 — Typed map contract | 79df4459 | G | Plan's `cat` inspection: exit 0; all four specs, associations, omission-preserving optional field, derived contract, provisional fixtures and attached-publication refusal inspected. `cargo check`: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.68s``; exit 0. |
| 2 — Publication | a15ede44 (red), 8f595c27 (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_accepted_map_is_attached_to_published_plan -- --exact`: red `0 passed; 1 failed`; green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.22s`; exit 0. |
| 3 — Coverage | 0172fa9c (red), aec468fc (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_uncovered_current_truth_is_refused -- --exact`: red `0 passed; 1 failed`; green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.68s`; exit 0. One intermediate failed green attempt is recorded below. |
| 4 — Required check | 0693bde2 (red), 668c24f7 (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_current_truth_without_check_is_refused -- --exact`: red `0 passed; 1 failed`; green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 1.31s`; exit 0. |
| 5 — Membership | b74528ad (red), 6e9e57c6 (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_item_without_bound_truth_is_refused -- --exact`: red `0 passed; 1 failed`; green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3 filtered out; finished in 2.43s`; exit 0. |
| 6 — Current version | bb15a7d4 (red), 3f7481bc (green) | G, G | `cargo test -p cadence --test phase28_evidence phase28_noncurrent_truth_version_is_refused -- --exact`: red `0 passed; 1 failed`; green `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.52s`; exit 0. |

Task 1 inspection command: `cat crates/cadence/src/plan/evidence.rs crates/cadence/src/plan/model.rs crates/cadence/src/plan/mod.rs crates/cadence/src/plan_service.rs crates/cadence/tests/phase27_plan.rs`; exit 0. Task 1 full commit: `79df44590fa6de7a0dfb4b2420b9e5e74b5669aa`, signature `G`.

Fixture capture: before any schema/helper edit, `cargo build -p cadence --bin cadence` at unmodified HEAD db419eceba48d827b1d266007d912cf7abbcd252 finished successfully. `git diff df43af15 HEAD -- crates Cargo.toml Cargo.lock` was empty. Source revision: df43af15. Binary SHA-256: eb420b8489f21f83b0e6dbc03aa96920097dee17be4b24aac26345b9a826f9d1.

Fixed canonical project root: `/tmp/cadence-phase27-absent-map-df43af15`; planning root: its `.planning` directory. Exclusive nonblocking OS flock held on the regular, current-user-owned 0600 sibling `.lock` through cleanup; owned root was 0700 with the exact marker. Child cleanup was registered before setup; both stdio servers exited successfully. Owned root removed, lock file retained. `CADENCE_GLOBAL_CONFIG` was empty for both server launches. Actual `import.active.repo` was `/tmp/cadence-phase27-absent-map-df43af15/.planning/config.v4.json`; `import.active.global` was null. Captured all ten tree entries as relative paths and exact byte arrays, exact request/approval, acknowledgment, receipt, publication, PLAN bytes and complete MCP transcript. No map or provisional field was present. `persisted: true`; journal absent before inspection. Payload digest: 9c9f0e60d754572aa19daf827a27c4a45bd34ac158150abdc0fb4abd2ea40f3a. Fixture state bytes were not rewritten or rehashed.

Checks:
- C1 red: a15ede449e2c153b14e0ed4216d199da89515101, G. `cargo test -p cadence --test phase28_evidence phase28_accepted_map_is_attached_to_published_plan -- --exact`: `running 1 test`; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s`. Failure at phase28_evidence.rs:245: `assertion `left == right` failed: complete preview: {"status":"refused","code":"invalid-plan","reason":"plan-read needs a phase address and optional plan count","rule":"arguments","slot":"submission","phase":null,"entry":null,"id":null}`. Green commit and result are recorded below.
- C1 green: 8f595c2793c9b4f2137422dc6ff7982c74d50432, G. Same exact command selected one test and passed. Task 2 extends the existing publication participant; full history/supersession/view remains PLAN-2's work.
- C2 red: 0172fa9ce4ba44733c5901e6e315d2c7bc9b243e, G. `cargo test -p cadence --test phase28_evidence phase28_uncovered_current_truth_is_refused -- --exact`: `running 1 test`; failure at phase28_evidence.rs:194: `left: String("ok")`, `right: "refused"`; the uncovered proposal was returned as an okay complete preview. `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.04s`. Green commit and result are recorded below.
- C2 green: aec468fcbd06d7c4ddd22d81741154ce2015aa04, G. Same exact command selected one test and passed, including split-batch, saved-current gap, replacement-removal and provisional-removal controls.
- C3 red: 0693bde26404eb08554ce62d08314b8b8949f592, G. `cargo test -p cadence --test phase28_evidence phase28_current_truth_without_check_is_refused -- --exact`: `running 1 test`; failure at phase28_evidence.rs:194: `left: String("ok")`, `right: "refused"`; supplementary-only T2 was accepted at complete preview. `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.05s`. Green commit and result are recorded below.
- C3 green: 668c24f75e08baa26ab865ee030f314d88aea35a, G. Same exact command selected one test and passed, including all supplementary kinds and saved-check/replacement controls.
- C4 red: b74528ad2b5f82b7c2fd9ef85a774a50ce635b4c, G. `cargo test -p cadence --test phase28_evidence phase28_item_without_bound_truth_is_refused -- --exact`: `running 1 test`; failure at phase28_evidence.rs:194: `left: String("ok")`, `right: "refused"`; an item with no associations was accepted at complete preview. `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 3 filtered out; finished in 0.09s`. Green commit and result are recorded below.
- C4 green: 6e9e57c635879254e0671d03f578488137a6e1b1, G. Same exact command selected one test and passed, including located edge refusals, identity conflicts, shared association reasons, and retained old item definitions.
- C5 red: bb15a7d418e1996f293206a1ead195384c18187f, G. `cargo test -p cadence --test phase28_evidence phase28_noncurrent_truth_version_is_refused -- --exact`: `running 1 test`; failure at phase28_evidence.rs:194: `left: String("ok")`, `right: "refused"`; version 2 against native version 1 was accepted at complete preview. `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.07s`. Green commit and result are recorded below.
- C5 green: 3f7481bca583a2633c2c3d5094b2702106417740, G. Same exact command selected one test and passed. Current versions come only from actual native truths; missing numeric slots and absent native authority have distinct located refusals. The final test-file edit replaces a cloned single-element argument with a borrowed slice; expected values and behavior are unchanged.
Full suite: exactly one `cargo test --workspace --no-fail-fast` invocation, after task 6's commit and clean clippy; exit 0. Totals across Cargo's 42 top-level test/doc-test targets: **875 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out**. Two nested one-test subprocess summaries inside the binary target (`238 filtered out`) are already included in that target's 239 passed; they are not double-counted. No full-suite repair or rerun was required.
Clippy: exactly one invocation, after task 6's commit: `cargo clippy --workspace --all-targets -- -D warnings`; exit 0; ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 8.57s``. No warnings or errors.
Deviations:
- [deviation] Task 3's first green attempt expected `1 passed; 0 failed`, observed `Invalid(\"key must be a string at line 1 column 2\")` as an MCP error; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.04s`. The service parsed Error's Debug-formatted display rather than its raw diagnostic payload. Fixed the decoder within the lease; no truth, expected result, decision or scope changed. This is a verification-result deviation, not a structural deviation.
Open items: O1 remains pending; real host conduct and model map quality are not claimed by these checks. PLAN-2 history/read-view work has not started.


Literal full-suite target results:

- `Running unittests src/lib.rs`: `test result: ok. 170 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s`
- `Running unittests src/main.rs`: `test result: ok. 239 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 133.90s`
- `Running tests/derivation_consistency.rs`: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s`
- `Running tests/derivation_inputs.rs`: `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/evidence_store.rs`: `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s`
- `Running tests/execution_boundary_compat.rs`: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.80s`
- `Running tests/execution_store.rs`: `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 283.53s`
- `Running tests/mcp.rs`: `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.48s`
- `Running tests/next_action.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase11_context.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.17s`
- `Running tests/phase27_plan.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.17s`
- `Running tests/phase28_evidence.rs`: `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.81s`
- `Running tests/phase7_guard.rs`: `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.61s`
- `Running tests/phase7_lease.rs`: `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 10.00s`
- `Running tests/phase7_receipts.rs`: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s`
- `Running tests/phase7_risk.rs`: `test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.46s`
- `Running tests/phase7_surfaces.rs`: `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase8_config.rs`: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s`
- `Running tests/phase8_dispatch.rs`: `test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s`
- `Running tests/phase8_global.rs`: `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase8_interview.rs`: `test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase8_routing.rs`: `test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.19s`
- `Running tests/phase9_admission.rs`: `test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_binding.rs`: `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_consumers.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_context.rs`: `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_contract.rs`: `test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_deferred.rs`: `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s`
- `Running tests/phase9_history.rs`: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_inventory.rs`: `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_invoking.rs`: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_material.rs`: `test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_model.rs`: `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_observations.rs`: `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_policy.rs`: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_recovery.rs`: `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_returns.rs`: `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s`
- `Running tests/phase9_selection.rs`: `test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_specialist.rs`: `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`
- `Running tests/phase9_stream.rs`: `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s`
- `Running tests/store.rs`: `test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s`
- `Doc-tests cadence`: `test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s`

Final repository inspection: eleven task/check commits; every signature is `G`, every author is `John Crenshaw <john@jcrenshaw.dev>`, no commit deletes files, and every changed source/fixture path is in the plan lease. The report is uncommitted; the pre-existing `plan-check.md` remains untouched and uncommitted. No PLAN-2 work or attributed check was added. No second clippy invocation was run.
