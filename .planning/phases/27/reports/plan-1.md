PLAN COMPLETE
Plan: .planning/phases/27/PLAN-1.md
Tasks: 6 of 6. All four checks have signed red/green commits. Plan-close schema regression repaired and the failing target passed on its one authorized rerun.

| Task | Commit(s) | %G? | Verify command and literal result |
|---|---|---|---|
| 1 — Read-only intake | 86468207 | G | Plan's `cat crates/cadence/src/plan_service.rs crates/cadence/src/plan/model.rs crates/cadence/src/plan/inventory.rs crates/cadence/src/plan/persistence.rs crates/cadence/src/server.rs crates/cadence/src/recall/mod.rs` exited 0; inspected routing before execution fallback, compiled strict schema, legacy raw inputs, exact approval, non-reserving preview and absence of writer calls. `cargo check`: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.75s``; after adding conflicting-frontmatter inventory refusal and formatting, `cargo check`: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.28s``. Both exited 0. |
| 2 — Provisional admission guard | 9a235c6f | G | Plan's `cat crates/cadence/src/plan/persistence.rs crates/cadence/src/execution_service.rs crates/cadence/src/store/writer.rs crates/cadence/src/store/transaction.rs` exited 0; inspected identity refusal before dispatch/replay, reobservation, both writer admission paths and both dispatch intent validators. `cargo check`: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.43s``, exit 0. |
| 3 / C1 | 966290b7 (red test-only), 6f1bc79b (green) | G, G | `cargo test -p cadence --test phase27_plan phase27_approved_plan_is_published_at_returned_identity -- --exact`: red exit 101; `running 1 test`; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s`. Green exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.05s`. |
| 4 / C2 | 2fe09deb (red test-only), 39756604 (green) | G, G | `cargo test -p cadence --test phase27_plan phase27_identity_mismatch_is_refused -- --exact`: red exit 101, `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.09s`. Green exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.14s`. |
| 5 / C3 | 578957ff (red test-only), 53d6f804 (green) | G, G | `cargo test -p cadence --test phase27_plan phase27_out_of_phase_target_is_refused -- --exact`: red exit 101; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.04s`. Green exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2 filtered out; finished in 0.13s`. |
| 6 / C4 | 4063d460 (red test-only), 80204b12 (green) | G, G | `cargo test -p cadence --test phase27_plan phase27_multiple_plans_have_distinct_numeric_order -- --exact`: red exit 101; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 3 filtered out; finished in 0.04s`. Green exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3 filtered out; finished in 0.25s`. |

Checks: C1 red at 966290b7. Failure at `crates/cadence/tests/phase27_plan.rs:294:9`: `assertion \`left == right\` failed: approved plan must publish: {"status":"refused","code":"invalid-plan","reason":"approved plan publication is not yet enabled","rule":"publication-unavailable","slot":"submission","phase":null,"entry":null,"id":null}`. Green at 6f1bc79b. C2 red 2fe09deb / green 39756604; C3 red 578957ff / green 53d6f804; C4 red 4063d460 / green 80204b12. Every named command selected exactly one test on red and green runs.

C1 intermediate implementation verification: expected one pass; observed one failure at line 316, `assertion failed: execution["reason"].as_str().unwrap().contains("phase 27 plan 1")`. Publication already succeeded; existing execution `stable_reason` replaced the new guard's identity detail. Fixed the new refusal's formatting within the lease and reran only C1, green above. The real SessionFactory/commit_evidence owner inputs succeeded, and the independent schema-compatible legacy fixture obtained an actual dispatch. No prerequisite was inferred solely from the early provisional guard.
Full-suite totals: `cargo test --workspace --no-fail-fast` exited 101: **866 passed / 1 failed** across top-level targets. Cargo also printed two successful child-test invocations (`1 passed` each, already represented within the main binary's 239 tests); summing every printed result line gives 868 passed / 1 failed. The sole failed target was `--test mcp`, 17 passed / 1 failed. The phase 27 target passed all 4 checks. Output was filtered only to omit individual passing test-name lines, with shell pipefail preserving cargo's exit status. The full suite was not rerun.
C2 red failure at `crates/cadence/tests/phase27_plan.rs:471:9`: `assertion \`left == right\` failed: mismatch must be a typed plan refusal`; `left: String("publication")`, `right: "identity-mismatch"`. The refusal's reason already named `frontmatter names phase 28 plan 2, expected phase 27 plan 2`; the missing production behavior was the plan-specific typed identity rule.
Clippy: `cargo clippy --workspace --all-targets -- -D warnings` invoked once, after task 6 commit 80204b12. Exit 0; literal result: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 9.10s``.
C3 red failure at `crates/cadence/tests/phase27_plan.rs:547:9`: `assertion \`left == right\` failed: forbidden destination must name confinement`; `left: String("submission")`, `right: "path-confinement"`. The old strict decoder refused the field without retaining the attempted path in its reason.
Deviations: one plan-close repair. [deviation] Expected a clean full-suite run; observed `tool_schemas_list_exactly_three_tools_with_output_schemas` failing at `crates/cadence/tests/mcp.rs:209:9`: `assertion failed: !schema_accepts(query, query, &json!({"operation":"execute-next","phase":phase}))`. The new string `phase` field for plan read widened the advertised shared execution phase schema. Repair commit 705096f1 (G) changes the new query's field to `phase_address` and its phase 27 test-client input accordingly; no truth, check name, expected result, or earlier-phase test changed. Both edited files are leased. `cargo test -p cadence --test mcp` reran the failing target once and passed 18 tests with 0 failures. No scope or locked-decision changes.
C4 red failure at `crates/cadence/tests/phase27_plan.rs:680:5`: `assertion \`left == right\` failed: ordered approved batch must publish: {"status":"refused","code":"invalid-plan","reason":"Invalid(\"ordered batch publication is not yet enabled\")","rule":"publication","slot":"submission","phase":null,"entry":null,"id":null}`; `left: Null`, `right: true`.
Open items: O1 remains pending/not yet seen; no observer, time or live-host result supplied. Active-cycle lifetime only; cycle migration is deferred as planned.

Initial HEAD: 04082a5c; branch: cadence/binary-owns-process.
Task 1 lease-check: `{"ok":true,"phase":27,"plan":1,"plan_file":".planning/phases/27/PLAN-1.md","staged":8,"declared":21}`.
No preexisting plan-1 report needed rotation. Preexisting plan-check.md untouched.

| Close repair | Commit | %G? | Verify |
|---|---|---|---|
| Preserve numeric execution query schema | 705096f1 | G | `cargo test -p cadence --test mcp` exited 0: `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.74s`. |

Final verification: the initial full suite had 866 passed / 1 failed; the only failing target passed with 18 passed / 0 failed after repair. No second full-suite or clippy invocation was made. Clippy was clean at 80204b12 before the repair, as required by the single-invocation limit. Every commit in 04082a5c..705096f1 has `%G? = G` and author `John Crenshaw <john@jcrenshaw.dev>`. The report is uncommitted; plan-check.md remains untouched.

Final query shape: `cadence_query` with `{"operation":"plan-read","phase_address":"27","count":1}` gives a read-only preview; omit count for listing/readback. The compiled strict `plan-submit` schema is returned as `contract`; approval includes the exact full submission. Native publication namespace is `plan_publications` / `plan-1`, bound to an explicitly retained active-cycle phase occurrence. PLAN-2 work, native execution activation, typed evidence, and cycle migration remain deferred as planned. O1 is the sole pending observation and has not been claimed seen.

Workspace result lines (one full invocation; child-only filtered runs excluded from this table):

| Target | Literal cargo result |
|---|---|
| src/lib.rs | test result: ok. 170 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s |
| src/main.rs | test result: ok. 239 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 130.67s |
| tests/derivation_consistency.rs | test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s |
| tests/derivation_inputs.rs | test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/evidence_store.rs | test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s |
| tests/execution_boundary_compat.rs | test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.81s |
| tests/execution_store.rs | test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 285.48s |
| tests/mcp.rs | test result: FAILED. 17 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.67s |
| tests/next_action.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase11_context.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.18s |
| tests/phase27_plan.rs | test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.06s |
| tests/phase7_guard.rs | test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.61s |
| tests/phase7_lease.rs | test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.92s |
| tests/phase7_receipts.rs | test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s |
| tests/phase7_risk.rs | test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.38s |
| tests/phase7_surfaces.rs | test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase8_config.rs | test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s |
| tests/phase8_dispatch.rs | test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s |
| tests/phase8_global.rs | test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase8_interview.rs | test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase8_routing.rs | test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.37s |
| tests/phase9_admission.rs | test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_binding.rs | test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_consumers.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_context.rs | test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_contract.rs | test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_deferred.rs | test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s |
| tests/phase9_history.rs | test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_inventory.rs | test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_invoking.rs | test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_material.rs | test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_model.rs | test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_observations.rs | test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_policy.rs | test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_recovery.rs | test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_returns.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s |
| tests/phase9_selection.rs | test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_specialist.rs | test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_stream.rs | test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s |
| tests/store.rs | test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s |
| Doc-tests cadence | test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
