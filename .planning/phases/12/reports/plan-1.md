PLAN COMPLETE
Plan: .planning/phases/12/PLAN-1.md
Tasks: 5 of 5; all named verifies and final checks passed

| Task | Commit hash(es) | %G? | Verify command | Literal result |
|---|---|---|---|---|
| 1 - Authentic historical capture | 4d6f9c11b5155ef89c6eaf3bf6aa5e37957462bf | G | `python3 crates/cadence/tests/support/phase12_history.py --inspect` | Exit 0; output below |
| 2 - Authority and allocation | 65bc236901815a9814c3b32b080ac9aba7f44141 | G | `cargo test -p cadence --lib execution::tests::native_admission_validates_authority_and_allocation -- --exact` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 170 filtered out; finished in 0.07s` |
| 3 - Immutable admission/extensions | b5368e4ecd0eafea38c3db2673f4dbf805ebed15 | G | `cargo test -p cadence --lib execution::tests::native_admission_commits_versioned_extensions -- --exact` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 171 filtered out; finished in 0.37s` |
| 4 - C1 public admission | Red: 87b6b18abddc0ce7ef05b94db0837d42239dd959; green: a44a4a498539453b260049efc20b9048c7748c14 | G / G | `cargo test -p cadence --test phase12_execution phase12_incomplete_execution_contract_is_refused -- --exact` | Red exit 101: `error[E0425]: cannot find type NativeApply in module cadence::execution::boundary`; green exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.13s` |
| 5 - Numeric scheduling | 2014a1166fdf4d9b3d766eb2243e051bccafc458 | G | `cargo test -p cadence --test phase7_lease numeric_selection_serializes_disjoint_and_overlapping_plans -- --exact` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 22 filtered out; finished in 0.00s` |

Task 1 inspector output:
```text
history: complete; commit=b353f09dba50db20992bd39ae52b0b331168d2f0; binary_sha256=3177488871b814ef2dac1a396be702ddc7ae12645ad50902a66c36da73b3f21a; root=/tmp/cadence-phase12-pre29-5b7de640; files=37; approved_publications=2; blank_command=1; valid_control=1
```

Historical provenance: source commit `b353f09dba50db20992bd39ae52b0b331168d2f0`, built by `cargo build --locked -p cadence --bin cadence --target-dir /tmp/cadence-phase12-old-target-…` from an isolated Git archive export. The full archive digest, binary digest, compiler version, exact build command/output, stdio requests/responses and file bytes/hashes are retained in the fixture. Build succeeded on its first invocation: `Finished dev profile [unoptimized + debuginfo] target(s) in 25.56s`. No linker retry. No tests ran against the old source. Source and target temporary directories were removed after capture.

Root binding: `/tmp/cadence-phase12-pre29-5b7de640`; sibling lock `/tmp/cadence-phase12-pre29-5b7de640.lock`. Capture holds nonblocking exclusive `flock` throughout fixture use, fails if the root already exists, records `.phase12-owner`, and removes only its owned contents after capture. The lock inode remains. Restoration must hold that same exclusive lock throughout restore, server lifetime, assertions/reopen and cleanup, restore only at that exact root, and refuse foreign contents. The phase-27 reserved root and lock were not accessed.

Both publications came from one exact approved old-binary batch, with separate items/truths for the blank-command offender and valid control. Neither is relabeled as current execution certification. No native initialization of this checkout occurred.

Task 2: the named unit passed on its first run and again after finishing the shared map-readback factoring. Both selected exactly one test. Constructed unit authority is explicitly separate from C1's public approval boundary. Shared retained-publication validation is used by publication validation and readback; admission reuses it plus the checked map event and factored current-union rules. The blanket native execution refusal remains in place.

Task 3: the named unit passed first, then passed again after adding the exact admitted-but-undispatched replacement refusal and an installed-byte change during intent preparation. The latter returned `admission-inputs-changed` with the state and decision bytes unchanged and no pending journal. Both runs selected exactly one test. The test commits admission and an approved gap publication through actual writer operations, reopens, extends, and replays both admission requests without rewriting the original record or receipts. Historical intent variants retain their encodings.

C1 red: the complete acceptance test was committed alone before adding the production public operation type. Its sole compiler error is the missing production `cadence::execution::boundary::NativeApply` at test line 449, used to deserialize the caller's valid payload against the actual advertised public surface. This uses the dispatch's explicit missing-production-code compile-red exception. No setup failure or behavioral red is claimed; no tests ran in this red invocation.

C1 green: the unchanged red-commit test passed after production implementation. Two further narrow passes followed production fixes: removal of an unused schema-field compiler warning with more precise request-field diagnostics, then preservation of original execution fingerprints across explicit extensions. Final targeted run had no compiler warnings. No behavioral failure or setup repair occurred after the missing-type red. The test uses the real stdio binary, native approvals, publications, public initial authorization, dispatch, exclusive historical restore, and read-only reopened store/byte comparisons.

Task 5: first targeted run passed. Inspection found no prerequisite API, pairwise lease comparisons or concurrency narration in `execution/plan.rs`, `execution/dispatch.rs` or `execution_service.rs`. `lease::covers` remains in plan parsing and post-commit patch scope enforcement. Only obsolete scheduling assertions changed in phase7_lease; D-31/D-32 path, rename and zero-exemption assertions remain intact. The public `PlanGraph` type name remains for caller compatibility, backed only by numeric plan identities.

Full suite: `cargo test --workspace --no-fail-fast` ran exactly once after Task 5 commit, exit 0. Totals from Cargo's final per-target summaries: **884 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out**, across 44 targets including documentation tests. Two nested child-process summaries inside the binary unit target are already included in that target's 239 passed and are not counted again. Compilation finished in 16.85s. No linker failure or relaunch occurred. Literal final per-target summaries are retained below.

Clippy: `cargo clippy --workspace --all-targets -- -D warnings` ran exactly once after Task 5 commit, exit 0, no warnings. Literal final output:
```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 8.56s
```

Deviations: none.
Open items: none for PLAN-1. PLAN-2 and PLAN-3 remain sequential follow-up plans. This run does not claim native self-hosting or satisfaction of O1.

Final repository state: HEAD `2014a1166fdf4d9b3d766eb2243e051bccafc458`; all six task commits have `%G?` = `G` and author `John Crenshaw <john@jcrenshaw.dev>`. The only uncommitted file is this report. The C1 test is byte-for-byte unchanged from its red commit. No phase 27, 28 or 29 test or fixture was edited.

Literal C1 red diagnostic:
```text
error[E0425]: cannot find type `NativeApply` in module `cadence::execution::boundary`
   --> crates/cadence/tests/phase12_execution.rs:449:41
```

Full-suite per-target results:
```text
Running unittests src/lib.rs (target/debug/deps/cadence-0aa21c38c128a06c)
test result: ok. 172 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.38s
Running unittests src/main.rs (target/debug/deps/cadence-c4eeda0e49e192be)
test result: ok. 239 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 125.33s
Running tests/derivation_consistency.rs (target/debug/deps/derivation_consistency-857353beb1c16a43)
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s
Running tests/derivation_inputs.rs (target/debug/deps/derivation_inputs-0f66325e3944212f)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/evidence_store.rs (target/debug/deps/evidence_store-61041ec053565716)
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
Running tests/execution_boundary_compat.rs (target/debug/deps/execution_boundary_compat-335bfec01b480ad4)
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.77s
Running tests/execution_store.rs (target/debug/deps/execution_store-441b6561ac0f663a)
test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 279.93s
Running tests/mcp.rs (target/debug/deps/mcp-49f277340ef8791b)
test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.01s
Running tests/next_action.rs (target/debug/deps/next_action-50af5c4b3ca75ee4)
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase11_context.rs (target/debug/deps/phase11_context-501c8dde92942e1a)
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.04s
Running tests/phase12_execution.rs (target/debug/deps/phase12_execution-d7631594fa5e958d)
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.11s
Running tests/phase27_plan.rs (target/debug/deps/phase27_plan-70d62d65fa0b3e64)
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.06s
Running tests/phase28_evidence.rs (target/debug/deps/phase28_evidence-a0cefb19da3c86e6)
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.69s
Running tests/phase29_limits.rs (target/debug/deps/phase29_limits-b999fff72434e66d)
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 17.14s
Running tests/phase7_guard.rs (target/debug/deps/phase7_guard-9b43e29b264f1158)
test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.59s
Running tests/phase7_lease.rs (target/debug/deps/phase7_lease-b453ccc88a021412)
test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.61s
Running tests/phase7_receipts.rs (target/debug/deps/phase7_receipts-4bff49413eb54ebb)
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s
Running tests/phase7_risk.rs (target/debug/deps/phase7_risk-19d9fe152f5ccab4)
test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.26s
Running tests/phase7_surfaces.rs (target/debug/deps/phase7_surfaces-74905b3828e121bf)
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase8_config.rs (target/debug/deps/phase8_config-d44eb17731d4ba7d)
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
Running tests/phase8_dispatch.rs (target/debug/deps/phase8_dispatch-20d813b36ac05c34)
test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
Running tests/phase8_global.rs (target/debug/deps/phase8_global-480bf625003054ff)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase8_interview.rs (target/debug/deps/phase8_interview-4c47298724172ecd)
test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase8_routing.rs (target/debug/deps/phase8_routing-62a049141eb9e136)
test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.19s
Running tests/phase9_admission.rs (target/debug/deps/phase9_admission-4cb8c46f904baa02)
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_binding.rs (target/debug/deps/phase9_binding-ee1f69abaa0651e9)
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_consumers.rs (target/debug/deps/phase9_consumers-5f426e63ab58ecb2)
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_context.rs (target/debug/deps/phase9_context-04fad838f189adeb)
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_contract.rs (target/debug/deps/phase9_contract-0be8e81ca55ceef4)
test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_deferred.rs (target/debug/deps/phase9_deferred-2afa4a7f234128be)
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
Running tests/phase9_history.rs (target/debug/deps/phase9_history-a735681087467be4)
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_inventory.rs (target/debug/deps/phase9_inventory-24ba103d06e54ffa)
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_invoking.rs (target/debug/deps/phase9_invoking-0014bac9ac92a61b)
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_material.rs (target/debug/deps/phase9_material-833919ac9c21c660)
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_model.rs (target/debug/deps/phase9_model-fd832191e8bb1885)
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_observations.rs (target/debug/deps/phase9_observations-002fa31131377d49)
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_policy.rs (target/debug/deps/phase9_policy-a11924a070c7275e)
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_recovery.rs (target/debug/deps/phase9_recovery-6fb57e7065186d43)
test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_returns.rs (target/debug/deps/phase9_returns-e64232ecbcb1b1b4)
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
Running tests/phase9_selection.rs (target/debug/deps/phase9_selection-cc02a3213ec3901e)
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_specialist.rs (target/debug/deps/phase9_specialist-86e042762a18cca8)
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
Running tests/phase9_stream.rs (target/debug/deps/phase9_stream-704711f186165fad)
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
Running tests/store.rs (target/debug/deps/store-ea10e706ea673aec)
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
Doc-tests cadence
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```
