PLAN COMPLETE
Plan: .planning/phases/27/PLAN-2.md
Tasks: 4 of 4. All three checks have signed test-only red commits and implementation green commits. Plan-close clippy and full suite are clean.
Initial HEAD: 705096f1; branch cadence/binary-owns-process.

| Task | Commit(s) | %G? | Verify command and literal result |
|---|---|---|---|
| 1 / C5 | e042cb36 (red); 4a813585 (green) | G, G | `cargo test -p cadence --test phase27_plan phase27_gap_plan_uses_previously_unused_identity -- --exact`: red exit 101; `running 1 test`; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.80s`. Green exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.85s`. |
| 2 / C7 | 3b6605af (red); bfeeedfa (green) | G, G | `cargo test -p cadence --test phase27_plan phase27_unauthorized_replacement_is_refused -- --exact`: red exit 101; `running 1 test`; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 5 filtered out; finished in 0.06s`. Both green runs exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5 filtered out; finished in 1.01s`. Second run followed production refusal-order fixes to preserve PLAN-1's confinement/exhaustion behavior. |
| 3 / C6 | 9a546b6f (red); bbef525d (green) | G, G | `cargo test -p cadence --test phase27_plan phase27_acknowledged_allocation_replays_original_identity -- --exact`: red exit 101; `running 1 test`; `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 6 filtered out; finished in 0.07s`. Green exit 0: `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out; finished in 0.78s`. |
| 4 / artifact | 8d30609b | G | `cat crates/cadence/src/plan/instructions.rs crates/cadence/src/plan/mod.rs crates/cadence/src/main.rs crates/cadence/src/server.rs`: exit 0. Inspected substantive compiled Planner block, public schema and read/preview/publish/replacement/replay procedures, provisional readiness and project-free renderer. `cargo check`: exit 0, ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.67s``. `cargo run --quiet -p cadence -- plan-instructions`: exit 0; rendered 17,413 characters of role and compiled schema, installed verbatim using the file editor into `skills/cad-plan/SKILL.md`. No new acceptance test. |

C5 red failure at `crates/cadence/tests/phase27_plan.rs:59:9`: `{"jsonrpc":"2.0","id":2,"error":{"code":-32603,"message":"Conflict(\"ambiguous plan aliases for phase 27 plan 1\")"}}`. Complete check reached and passed real legacy admission before ambiguity refusal failed. Green at 4a813585.

Deviations: [deviation] C5 red prediction expected an ambiguity-rule assertion failure; actual failure was the public client rejecting a JSON-RPC internal error during the same ambiguity case. Correcting the production error mapping within the lease; no expected result or check changed.
Inherited PLAN-1 deviation: plan-read uses `phase_address`, preserving the shared numeric execution `phase` schema. Preserved, not redone.
Full suite: `cargo test --workspace --no-fail-fast` invoked ONCE after task 4 commit 8d30609b; exit 0. **870 passed / 0 failed** across 41 top-level targets. Cargo also printed two successful child invocations (`1 passed` each, already represented within the main binary's 239 tests); summing every printed result gives 872 passed / 0 failed. No full-suite rerun, targeted repair or second clippy invocation was needed. All seven phase-27 checks passed together. No Node test invocation or repository-local temporary directory failure occurred.
Clippy: `cargo clippy --workspace --all-targets -- -D warnings` invoked ONCE, after task 4 commit 8d30609b; exit 0. Literal result: ``Finished `dev` profile [unoptimized + debuginfo] target(s) in 7.55s``. No stdin supplied.
Task 4 inspection: `Command::PlanInstructions` routes directly to `plan::instructions::markdown()` and stdout, before any serve/project/store branch. The compiled source includes the acceptance design's Planner block verbatim. Host tools are read/question/query/apply only; frozen writer, gates, reviewer dispatch and cursor writes removed. O1 stays pending, explicitly shared by T1/T7 with concerns cap. The role describes `persisted` on replay as historical acknowledgment and requires separate current projection status. The schema comes from the same `model::contract()` used by plan read. Rendering is the required artifact production, not an additional verification suite.
C6 red at 9a546b6f, failure `crates/cadence/tests/phase27_plan.rs:684:9`: `assertion \`left == right\` failed: acknowledged request must replay: {"status":"refused","code":"invalid-plan","reason":"Conflict(\"inventory precondition changed; preview and approve again\")","rule":"allocation-conflict","slot":"submission","phase":null,"entry":null,"id":null}`; left `Null`, right `true`. Green at bbef525d.
C7 red at 3b6605af, failure `crates/cadence/tests/phase27_plan.rs:710:9`: `assertion \`left == right\` failed: absent: {"status":"refused","code":"invalid-plan","reason":"unknown field \`replacement\`, expected \`target\` or \`content\`","rule":"submission","slot":"submission","phase":null,"entry":null,"id":null}`; left `submission`, right `replacement-authorization`. Green at bfeeedfa.
Open items: O1 pending/not yet seen; specification approved 2026-09-10, no observer/time/result supplied. Active-cycle lifetime only; migration deferred.
No preexisting plan-2 report required rotation. Existing plan-1.md and plan-check.md left untouched and uncommitted.


Workspace result lines (one full invocation; child-only filtered runs excluded):

| Target | Literal cargo result |
|---|---|
| src/lib.rs | test result: ok. 170 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s |
| src/main.rs | test result: ok. 239 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 135.36s |
| tests/derivation_consistency.rs | test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s |
| tests/derivation_inputs.rs | test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/evidence_store.rs | test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s |
| tests/execution_boundary_compat.rs | test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.80s |
| tests/execution_store.rs | test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 281.12s |
| tests/mcp.rs | test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 41.63s |
| tests/next_action.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase11_context.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.25s |
| tests/phase27_plan.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.25s |
| tests/phase7_guard.rs | test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.65s |
| tests/phase7_lease.rs | test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 10.20s |
| tests/phase7_receipts.rs | test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s |
| tests/phase7_risk.rs | test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.60s |
| tests/phase7_surfaces.rs | test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase8_config.rs | test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s |
| tests/phase8_dispatch.rs | test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s |
| tests/phase8_global.rs | test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase8_interview.rs | test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase8_routing.rs | test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.46s |
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
| tests/phase9_observations.rs | test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s |
| tests/phase9_policy.rs | test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_recovery.rs | test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_returns.rs | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s |
| tests/phase9_selection.rs | test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_specialist.rs | test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |
| tests/phase9_stream.rs | test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s |
| tests/store.rs | test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s |
| Doc-tests cadence | test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s |

Final commit verification: all seven commits in `705096f1..8d30609b` report `%G? = G` and author `John Crenshaw <john@jcrenshaw.dev>`. All lease checks returned `ok:true`. No deleted files or changes outside the lease. No AI attribution, session trailers, pushes or changes to earlier checks. Existing report files remain untouched; this report is uncommitted.

Commit list, in execution order:

- e042cb36 — C5 red, P27-2-T1
- 4a813585 — gap identities green, P27-2-T1
- 3b6605af — C7 red, P27-2-T2
- bfeeedfa — replacement authority green, P27-2-T2
- 9a546b6f — C6 red, P27-2-T3
- bbef525d — durable replay green, P27-2-T3
- 8d30609b — compiled planner front door, P27-2-T4

## Follow-up

Orchestrator ruling 2026-09-10 authorized one fixture-only portability correction after the verifier's read-only GPG-home failures. Commit `1372ed11` — `test(27): fixture commits never depend on host git config P27-2-T3`; `%G? = G`, author `John Crenshaw <john@jcrenshaw.dev>`. The shared Git helper now supplies `-c commit.gpgsign=false -c user.name=John Crenshaw -c user.email=john@jcrenshaw.dev` on every Git invocation in this file (init, add and commit). Removed the fixture commit's explicit `-S` and signing-key option. No production code, check setup semantics, public calls or expected results changed. Lease check returned `ok:true`; the repository follow-up commit remains signed.

Each exact command ran with a fresh empty GPG home and selected exactly one passing test, exit 0:

| Command | Literal result |
|---|---|
| `GNUPGHOME=$(mktemp -d) cargo test -p cadence --test phase27_plan phase27_approved_plan_is_published_at_returned_identity -- --exact` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out; finished in 1.02s` |
| `GNUPGHOME=$(mktemp -d) cargo test -p cadence --test phase27_plan phase27_gap_plan_uses_previously_unused_identity -- --exact` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out; finished in 0.90s` |
| `GNUPGHOME=$(mktemp -d) cargo test -p cadence --test phase27_plan phase27_unauthorized_replacement_is_refused -- --exact` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out; finished in 0.99s` |

No clippy or full-suite invocation was made during this follow-up. Report remains uncommitted; plan-1.md and plan-check.md remain untouched.
