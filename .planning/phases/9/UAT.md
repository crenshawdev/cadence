---
status: testing
phase: 9
fields_version: 1
started: 2026-09-08
updated: 2026-09-08
---

## Items

### 1. Read-only advisory prompt
expected: With retained target m1 and advisory mode, advisory_contract must return "Review retained target m1. Return raw JSON findings. Do not write files or append lifecycle records.".
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/invoking.rs:5; assertion: crates/cadence/tests/phase9_invoking.rs:9. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_invoking: test advisory_retained_read_only_contract ... ok; test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 2. Unchanged raw forwarding
expected: With raw bytes {"findings":[]}, forward_return must return submitted_bytes = "{\"findings\":[]}".
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/forward.rs:6; assertion: crates/cadence/tests/phase9_forward.rs:5. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_forward: test forward_exact_return ... ok; test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 3. Pending advisory waits
expected: With advisory fire f1 with delivery pending, delivery_permission must return "wait-for-delivery".
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:74; assertion: crates/cadence/tests/phase9_policy.rs:110. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_advisory_pending_ac3 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 4. Accepted advisory blocker continues
expected: With advisory fire f1, durable delivery accepted, severity blocker and combination adjudicated, delivery_permission must return "continue".
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:74; assertion: crates/cadence/tests/phase9_policy.rs:120. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_advisory_blocker_ac4 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 5. Quoted Unicode claim preserved
expected: With bound attempt a1 and raw return Q, accept_return must return originals[0].claim = "quote: \"\n雪".
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/returns.rs:180; assertion: crates/cadence/tests/phase9_returns.rs:144. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_returns: test accept_exact_q_ac5 ... ok; test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 6. Manual plan preserves policy
expected: With ordinary review input with effective gate deferred, routing local and home h1, manual_plan_request must return {"caller":"manual-plan", "gate":"deferred", "routing":"local", "home":"h1"}.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:41; assertion: crates/cadence/tests/phase9_policy.rs:17. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_manual_plan_ac6 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 7. Automatic plan preserves policy
expected: With ordinary review input with effective gate deferred, routing local and home h1, automatic_plan_request must return {"caller":"automatic-plan", "gate":"deferred", "routing":"local", "home":"h1"}.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:44; assertion: crates/cadence/tests/phase9_policy.rs:27. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_automatic_plan_ac7 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 8. Task preserves policy
expected: With ordinary review input with effective gate deferred, routing local and home h1, task_review_request must return {"caller":"task", "gate":"deferred", "routing":"local", "home":"h1"}.
criterion: AC8
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:47; assertion: crates/cadence/tests/phase9_policy.rs:37. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_task_ac8 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 9. Execute preserves policy
expected: With ordinary review input with effective gate deferred, routing local and home h1, execute_review_request must return {"caller":"execute", "gate":"deferred", "routing":"local", "home":"h1"}.
criterion: AC9
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:50; assertion: crates/cadence/tests/phase9_policy.rs:47. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_execute_ac9 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 10. Debug preserves policy
expected: With ordinary review input with effective gate deferred, routing local and home h1, debug_review_request must return {"caller":"debug", "gate":"deferred", "routing":"local", "home":"h1"}.
criterion: AC10
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:53; assertion: crates/cadence/tests/phase9_policy.rs:57. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_debug_ac10 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 11. Verify preserves policy
expected: With ordinary review input with effective gate deferred, routing local and home h1, verify_review_request must return {"caller":"verify", "gate":"deferred", "routing":"local", "home":"h1"}.
criterion: AC11
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:56; assertion: crates/cadence/tests/phase9_policy.rs:67. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_verify_ac11 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 12. Off gate stays off
expected: With gate off and delivery accepted without settlement, ordinary_gate_action must return "off".
criterion: AC12
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:83; assertion: crates/cadence/tests/phase9_policy.rs:130. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_off_ac12 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 13. Advisory delivery continues
expected: With gate advisory and delivery accepted without settlement, ordinary_gate_action must return "continue".
criterion: AC13
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:83; assertion: crates/cadence/tests/phase9_policy.rs:142. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_advisory_ac13 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 14. Deferred delivery requires enqueue
expected: With gate deferred and delivery accepted without settlement, ordinary_gate_action must return "enqueue-before-continuation".
criterion: AC14
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:83; assertion: crates/cadence/tests/phase9_policy.rs:154. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_deferred_ac14 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 15. Blocking delivery awaits settlement
expected: With gate blocking and delivery accepted without settlement, ordinary_gate_action must return "wait-for-settlement".
criterion: AC15
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:83; assertion: crates/cadence/tests/phase9_policy.rs:166. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_blocking_ac15 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 16. Adjudicated delivery awaits settlement
expected: With gate adjudicated and delivery accepted without settlement, ordinary_gate_action must return "wait-for-settlement".
criterion: AC16
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:83; assertion: crates/cadence/tests/phase9_policy.rs:178. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_adjudicated_ac16 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 17. Plan advisory default preserved
expected: With trigger plan, phase-8 resolved gate advisory and no plan-floor elevation, ordinary_request must return gate = "advisory".
criterion: AC17
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:33; assertion: crates/cadence/tests/phase9_policy.rs:77. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_plan_advisory_ac17 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 18. Risk blocking default preserved
expected: With trigger risk_surface, phase-8 resolved gate blocking and no plan-floor elevation, ordinary_request must return gate = "blocking".
criterion: AC18
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:33; assertion: crates/cadence/tests/phase9_policy.rs:86. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_risk_blocking_ac18 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 19. Diff off default preserved
expected: With trigger diff, phase-8 resolved gate off and no plan-floor elevation, ordinary_request must return gate = "off".
criterion: AC19
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:33; assertion: crates/cadence/tests/phase9_policy.rs:95. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test request_diff_off_ac19 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 20. Risk match dispatches
expected: With supplied detector observation match with blocking risk gate, risk_review_action must return "dispatch".
criterion: AC20
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:126; assertion: crates/cadence/tests/phase9_policy.rs:190. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_match_ac20 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 21. Risk nonmatch skips review
expected: With supplied detector observation nonmatch with blocking risk gate, risk_review_action must return "no-review".
criterion: AC21
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:126; assertion: crates/cadence/tests/phase9_policy.rs:201. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_nonmatch_ac21 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 22. Inconclusive risk waits
expected: With supplied detector observation inconclusive with blocking risk gate, risk_review_action must return "wait-for-evidence".
criterion: AC22
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:126; assertion: crates/cadence/tests/phase9_policy.rs:212. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_inconclusive_ac22 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 23. Unanswered risk asks surfaces
expected: With supplied detector observation unanswered with blocking risk gate, risk_review_action must return "ask-surfaces".
criterion: AC23
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:126; assertion: crates/cadence/tests/phase9_policy.rs:223. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_unanswered_ac23 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 24. FIRST advances after failure
expected: With FIRST choices ["A", "B", "C"] and terminal failure for A, select_next must return {"request":"B"}.
criterion: AC24
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:49; assertion: crates/cadence/tests/phase9_selection.rs:20. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_failed_a_ac24 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 25. FIRST stops at usable B
expected: With FIRST choices ["A", "B", "C"], failed A and usable B with finding F, select_next must return {"request":null, "not_selected":["C"]}.
criterion: AC25
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:49; assertion: crates/cadence/tests/phase9_selection.rs:29. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_usable_b_ac25 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 26. FIRST accepts empty A
expected: With FIRST choices ["A", "B", "C"] and usable empty A, select_next must return {"request":null, "not_selected":["B", "C"]}.
criterion: AC26
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:49; assertion: crates/cadence/tests/phase9_selection.rs:41. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_empty_a_ac26 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 27. Missing return fails
expected: With missing bytes, classify_return must return {"state":"failed", "reason":"missing-return"}.
criterion: AC27
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:64; assertion: crates/cadence/tests/phase9_contract.rs:19. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_missing_return_ac27 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 28. Malformed return fails
expected: With bytes {"findings":, classify_return must return {"state":"failed", "reason":"malformed-return"}.
criterion: AC28
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:64; assertion: crates/cadence/tests/phase9_contract.rs:27. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_malformed_return_ac28 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 29. Exhausted FIRST selects fallback
expected: With FIRST choices ["A", "B"], both failed, and fallback local, select_next must return {"request":"local"}.
criterion: AC29
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:49; assertion: crates/cadence/tests/phase9_selection.rs:53. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_exhausted_ac29 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 30. Empty fallback completes usefully
expected: With exhausted FIRST choices and usable empty local fallback, select_next must return {"state":"usable-complete", "request":null}.
criterion: AC30
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:49; assertion: crates/cadence/tests/phase9_selection.rs:65. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_local_empty_ac30 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 31. Failed fallback completes with failure
expected: With exhausted FIRST choices and failed local fallback, select_next must return {"state":"complete-with-failure", "request":null}.
criterion: AC31
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:49; assertion: crates/cadence/tests/phase9_selection.rs:77. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_local_failed_ac31 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 32. Failed attempt retains usage
expected: With failed attempt a1 with {"input":7, "output":3} usage, attempt_usage must return {"input":7, "output":3}.
criterion: AC32
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:87; assertion: crates/cadence/tests/phase9_selection.rs:131. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_usage_spent_ac32 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 33. Absent usage stays unknown
expected: With failed attempt a1 with absent usage, attempt_usage must return {"input":null, "output":null}.
criterion: AC33
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:87; assertion: crates/cadence/tests/phase9_selection.rs:141. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test first_usage_unobserved_ac33 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 34. Committed range retained
expected: With resolved base b1, head h1 and retained bytes old\n, retain_range must return {"kind":"committed-range", "base":"b1", "head":"h1", "bytes":"old\n"}.
criterion: AC34
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:360; assertion: crates/cadence/tests/phase9_material.rs:141. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test retain_range_ac34 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 35. Authored staged tree retained
expected: With base b1, authored index t1 and bytes old\n, retain_staged must return {"kind":"staged-tree", "base":"b1", "index":"t1", "head":null, "bytes":"old\n"}.
criterion: AC35
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:377; assertion: crates/cadence/tests/phase9_material.rs:164. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test retain_staged_ac35 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 36. Named file retained without HEAD
expected: With named file a.rs with bytes old\n, retain_file must return {"kind":"named-file", "path":"a.rs", "head":null, "bytes":"old\n"}.
criterion: AC36
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:318; assertion: crates/cadence/tests/phase9_material.rs:187. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test retain_file_ac36 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 37. Retained bytes survive source changes
expected: With retained entry e1 containing old\n, mutable source containing new\n and moved refs, read_material must return "old\n".
criterion: AC37
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:118; assertion: crates/cadence/tests/phase9_material.rs:287. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test read_original_ac37 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 38. Changed material mismatches
expected: With saved bytes old\n and proposed bytes new\n, material_matches must return false.
criterion: AC38
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:132; assertion: crates/cadence/tests/phase9_material.rs:297. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test read_matches_ac38 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 39. Wrong artifact refused
expected: With fire f1/m1/round1 and return whose artifact is m2, bind_return must return {"code":"artifact-mismatch", "fire":"f1", "field":"artifact"}.
criterion: AC39
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/binding.rs:33; assertion: crates/cadence/tests/phase9_binding.rs:58. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_binding: test binding_artifact_ac39 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 40. Wrong round refused
expected: With fire f1/m1/round1 and return whose round is 2, bind_return must return {"code":"round-mismatch", "fire":"f1", "field":"round"}.
criterion: AC40
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/binding.rs:33; assertion: crates/cadence/tests/phase9_binding.rs:70. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_binding: test binding_round_ac40 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 41. Old bytes content digest
expected: With named-file bytes old\n, artifact_content_id must return "01d09d19c2139a46aebfb577780d123d7396e97201bc7ead210a2ebff8239dee".
criterion: AC41
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:19; assertion: crates/cadence/tests/phase9_material.rs:205. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test retain_content_old_ac41 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 42. New bytes content digest
expected: With named-file bytes new\n, artifact_content_id must return "7aa7a5359173d05b63cfd682e3c38487f3cb4f7f1d60659fe59fab1505977d4c".
criterion: AC42
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:19; assertion: crates/cadence/tests/phase9_material.rs:213. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test retain_content_new_ac42 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 43. Pending admission recovers interrupted
expected: With durable attempt a1 in state pending-admission without accepted originals, recover_attempt must return {"attempt":"a1", "delivery":"interrupted", "original":null}.
criterion: AC43
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/recovery.rs:29; assertion: crates/cadence/tests/phase9_recovery.rs:117. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_pending_admission_ac43 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 44. Unsubmitted return recovers interrupted
expected: With durable attempt a1 in state host-return-before-submission without accepted originals, recover_attempt must return {"attempt":"a1", "delivery":"interrupted", "original":null}.
criterion: AC44
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/recovery.rs:29; assertion: crates/cadence/tests/phase9_recovery.rs:132. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_host_return_ac44 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 45. Result sync failure withholds acknowledgment
expected: With pending a1, F and a result-store sync failure, accept_return must return {"code":"delivery-write-failed", "attempt":"a1", "acknowledged":false}.
criterion: AC45
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/returns.rs:180; assertion: crates/cadence/tests/phase9_returns.rs:163. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_returns: test accept_sync_failure_ac45 ... ok; test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 46. Identical return replays acknowledgment
expected: With accepted a1/o1, identical F and lost prior acknowledgment, accept_return must return {"attempt":"a1", "original":"o1", "terminal":"accepted", "replayed":true}.
criterion: AC46
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/returns.rs:180; assertion: crates/cadence/tests/phase9_returns.rs:179. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_returns: test accept_replay_ac46 ... ok; test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 47. Conflicting return preserves original
expected: With accepted a1/o1 and conflicting claim Changed, accept_return must return {"code":"conflicting-return", "attempt":"a1", "original":"o1"}.
criterion: AC47
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/returns.rs:180; assertion: crates/cadence/tests/phase9_returns.rs:193. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_returns: test accept_conflict_ac47 ... ok; test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 48. Admission revision conflict emits no dispatch
expected: With replay key k1 inside a caller transaction with failed revision comparison, admit_pending must return {"code":"revision-conflict", "replay_key":"k1", "dispatch":null}.
criterion: AC48
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/admission.rs:209; assertion: crates/cadence/tests/phase9_admission.rs:137. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_admission: test admission_revision_conflict_ac48 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 49. Admission replay preserves identities
expected: With committed admission k1/f1/a1 with acknowledgment lost, admit_pending must return {"fire":"f1", "attempt":"a1", "replayed":true}.
criterion: AC49
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/admission.rs:209; assertion: crates/cadence/tests/phase9_admission.rs:160. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_admission: test admission_replay_ac49 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 50. Concurrent identical returns close once
expected: With two identical submissions for pending a1, with a barrier at conditional commit, accept_return must return durable_terminal_count = 1.
criterion: AC50
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/returns.rs:180; assertion: crates/cadence/tests/phase9_returns.rs:209. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_returns: test accept_identical_winner_ac50 ... ok; test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 51. Concurrent conflicting return refused
expected: With F and conflicting claim Changed for a1, with F committed first at a boundary barrier, accept_return must return {"code":"conflicting-return", "attempt":"a1", "original":"o1"}.
criterion: AC51
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/returns.rs:180; assertion: crates/cadence/tests/phase9_returns.rs:224. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_returns: test accept_conflicting_winner_ac51 ... ok; test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 52. Original recovered without rendering
expected: With durable accepted o1 and missing disposable rendering, recover_original must return {"file":"a.rs", "line":1, "severity":"high", "claim":"C", "failure_scenario":"S"}.
criterion: AC52
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/recovery.rs:74; assertion: crates/cadence/tests/phase9_recovery.rs:147. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_original_without_rendering_ac52 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 53. Plan completion recovers raw identity
expected: With saved f1/round1/o1 containing F, with disposable rendering absent, plan_completion_input must return {"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}.
criterion: AC53
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:122; assertion: crates/cadence/tests/phase9_consumers.rs:76. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_plan_ac53 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 54. Execute completion recovers raw identity
expected: With saved f1/round1/o1 containing F, with disposable rendering absent, execute_completion_input must return {"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}.
criterion: AC54
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:125; assertion: crates/cadence/tests/phase9_consumers.rs:91. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_execute_ac54 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 55. Report recovers raw identity
expected: With saved f1/round1/o1 containing F, with disposable rendering absent, report_review_input must return {"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}.
criterion: AC55
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:128; assertion: crates/cadence/tests/phase9_consumers.rs:106. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_report_ac55 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 56. Deferred input recovers raw identity
expected: With saved f1/round1/o1 containing F, with disposable rendering absent, deferred_enqueue_input must return {"kind":"raw", "fire":"f1", "round":1, "original":"o1", "finding_ids":["o1:0"]}.
criterion: AC56
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:131; assertion: crates/cadence/tests/phase9_consumers.rs:121. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_deferred_ac56 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 57. Execute fix accepts provisional selection
expected: With supplied provisional revision 2 selecting o1:0, refuting o1:1, and no fix commit, execute_fix_input must return {"kind":"provisional-selected", "revision":2, "finding_ids":["o1:0"], "fix":null}.
criterion: AC57
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/views.rs:18; assertion: crates/cadence/tests/phase9_views.rs:14. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_views: test view_execute_ac57 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 58. Task fix accepts provisional selection
expected: With supplied provisional revision 2 selecting o1:0, refuting o1:1, and no fix commit, planned_task_fix_input must return {"kind":"provisional-selected", "revision":2, "finding_ids":["o1:0"], "fix":null}.
criterion: AC58
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/views.rs:22; assertion: crates/cadence/tests/phase9_views.rs:24. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_views: test view_planned_task_ac58 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 59. Raw view tag preserved
expected: With supplied typed view raw at revision 2, consumer_view must return kind = "raw".
criterion: AC59
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/views.rs:5; assertion: crates/cadence/tests/phase9_views.rs:34. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_views: test view_raw_ac59 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 60. Provisional view tag preserved
expected: With supplied typed view provisional-selected at revision 2, consumer_view must return kind = "provisional-selected".
criterion: AC60
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/views.rs:5; assertion: crates/cadence/tests/phase9_views.rs:42. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_views: test view_provisional_selected_ac60 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 61. Settled view tag preserved
expected: With supplied typed view settled at revision 2, consumer_view must return kind = "settled".
criterion: AC61
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/views.rs:5; assertion: crates/cadence/tests/phase9_views.rs:50. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_views: test view_settled_ac61 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 62. Landing separates risk inventories
expected: With risk_surface rounds f1/1 unruled and f2/2 adjudicated, plus plan review f3, landing_inventory must return {"unruled":["f1/1"], "adjudicated":["f2/2"]}.
criterion: AC62
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/inventory.rs:23; assertion: crates/cadence/tests/phase9_inventory.rs:14. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_inventory: test inventory_landing_ac62 ... ok; test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 63. Milestone preserves risk filenames
expected: With risk_surface REVIEW/ADJUDICATION rounds 1 and 2, plus plan review, milestone_review_inputs must return ["REVIEW-risk_surface-1.md", "ADJUDICATION-risk_surface-1.md", "REVIEW-risk_surface-2.md", "ADJUDICATION-risk_surface-2.md"].
criterion: AC63
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/inventory.rs:42; assertion: crates/cadence/tests/phase9_inventory.rs:22. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_inventory: test inventory_milestone_ac63 ... ok; test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 64. Pending completion has no findings
expected: With saved delivery state pending, completion_review_state must return {"state":"pending", "findings":null}.
criterion: AC64
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:148; assertion: crates/cadence/tests/phase9_consumers.rs:136. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_pending_ac64 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 65. Failed completion has no findings
expected: With saved delivery state failed, completion_review_state must return {"state":"failed", "findings":null}.
criterion: AC65
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:148; assertion: crates/cadence/tests/phase9_consumers.rs:146. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_failed_ac65 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 66. Accepted empty completion stays empty
expected: With saved delivery state accepted-empty, completion_review_state must return {"state":"accepted", "findings":[]}.
criterion: AC66
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:148; assertion: crates/cadence/tests/phase9_consumers.rs:156. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_accepted_empty_ac66 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 67. Advisory presence creates no obligation
expected: With an advisory REVIEW record with no deferred obligation, deferred_members must return [].
criterion: AC67
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/inventory.rs:51; assertion: crates/cadence/tests/phase9_inventory.rs:35. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_inventory: test inventory_advisory_ac67 ... ok; test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 68. Admission preserves saved policy
expected: With saved admission H, current gate off, routing remote and phase cursor 99, read_admission must return {"fire":"f1", "replay_key":"k1", "scope":{"project":"p1", "root":"r1", "cycle":"c1"}, "home":{"kind":"task", "id":"h1", "occurrence":"occ1"}, "caller":"task", "trigger":"risk_surface", "specialist":null, "discriminator":"d1", "plan":null, "anchor":null, "round":1, "artifact":"m1", "gate":"deferred", "selection":{"mode":"single", "choices":["A", "B"], "fallback":"local"}, "routing":{"answer":"local", "evidence":"route1"}, "roster":{"required":["A"], "completion":"all-required-terminal"}, "contract":{"schema":"review-1", "interpretation":"H1-H5", "validator":"H4-1"}, "settlement":"pending"}.
criterion: AC68
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/admission.rs:234; assertion: crates/cadence/tests/phase9_admission.rs:182. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_admission: test admission_saved_policy_ac68 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 69. Independent fire gets new occurrence
expected: With independent admission, saved sequence 1, and material already used by occ1, allocate_occurrence must return "occ2".
criterion: AC69
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/admission.rs:242; assertion: crates/cadence/tests/phase9_admission.rs:192. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_admission: test admission_independent_occurrence_ac69 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 70. Replay preserves occurrence
expected: With replay key k1 already bound to occ1, allocate_occurrence must return "occ1".
criterion: AC70
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/admission.rs:242; assertion: crates/cadence/tests/phase9_admission.rs:204. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_admission: test admission_replayed_occurrence_ac70 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 71. Deleted hunk maps to base
expected: With saved diff hunk line 4 mapped to deleted old.rs, entry e1, base line 2, source_reference must return {"entry":"e1", "path":"old.rs", "side":"base", "line":2}.
criterion: AC71
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/manifest.rs:9; assertion: crates/cadence/tests/phase9_manifest.rs:48. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_manifest: test source_deleted_reference_ac71 ... ok; test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 72. Renamed hunk maps to head
expected: With rename old.rs to new.rs, hunk line 5 mapped to head entry e2, line 3, source_reference must return {"entry":"e2", "path":"new.rs", "side":"head", "line":3}.
criterion: AC72
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/manifest.rs:9; assertion: crates/cadence/tests/phase9_manifest.rs:62. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_manifest: test source_renamed_reference_ac72 ... ok; test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 73. Deleted head stays absent
expected: With deleted old.rs with base entry e1 and no head entry, material_side must return {"path":"old.rs", "side":"head", "availability":"absent"}.
criterion: AC73
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/manifest.rs:32; assertion: crates/cadence/tests/phase9_manifest.rs:76. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_manifest: test source_absent_head_ac73 ... ok; test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 74. Supporting bytes remain recoverable
expected: With retained supporting e3 outside primary paths, bytes support\n, deleted sources and unreachable ordinary refs, read_material must return "support\n".
criterion: AC74
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:118; assertion: crates/cadence/tests/phase9_material.rs:308. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test read_supporting_ac74 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 75. Later evidence records acquisition
expected: With manifest m1, later counter-evidence bytes counter\n, next entry e4, time 100, no delivered attempt, append_material must return {"entry":"e4", "acquired_at":100, "provenance":"later-evidence", "attempt":null}.
criterion: AC75
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:162; assertion: crates/cadence/tests/phase9_context.rs:93. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_context: test context_later_evidence_ac75 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 76. Delivered support records view binding
expected: With supporting bytes support\n delivered to a1/v1, next entry e3, time 100, append_material must return {"entry":"e3", "acquired_at":100, "provenance":"original-view", "attempt":"a1", "view":"v1"}.
criterion: AC76
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:162; assertion: crates/cadence/tests/phase9_context.rs:110. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_context: test context_original_view_ac76 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 77. Missing source material refused
expected: With saved diff bytes without required source entry e1, validate_manifest must return {"code":"missing-source-material", "entry":"e1", "side":"base"}.
criterion: AC77
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/manifest.rs:80; assertion: crates/cadence/tests/phase9_manifest.rs:84. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_manifest: test source_missing_material_ac77 ... ok; test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 78. Requested and observed models stay distinct
expected: With saved a1 requested model-A, observed model unknown, launch launch1, return return1; a2 requests model-B, read_attempt must return {"requested_model":"model-A", "observed_model":null, "launch":"launch1", "host_return":"return1"}.
criterion: AC78
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/attempts.rs:7; assertion: crates/cadence/tests/phase9_binding.rs:82. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_binding: test binding_read_attempt_ac78 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 79. Cross-attempt host return refused
expected: With return1 submitted for a2 instead of bound a1, bind_host_return must return {"code":"host-return-conflict", "return":"return1", "bound_attempt":"a1", "submitted_attempt":"a2"}.
criterion: AC79
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/binding.rs:73; assertion: crates/cadence/tests/phase9_binding.rs:111. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_binding: test binding_host_return_ac79 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 80. Accepted host return cannot be reused
expected: With return1 reused after acceptance for a1, now submitted for a2, bind_host_return must return {"code":"host-return-conflict", "return":"return1", "bound_attempt":"a1", "submitted_attempt":"a2"}.
criterion: AC80
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/binding.rs:73; assertion: crates/cadence/tests/phase9_binding.rs:128. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_binding: test binding_accepted_host_return_ac80 ... ok; test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 81. Duplicate observation replays
expected: With accepted a1 and duplicate observation obs1, record_observation must return {"attempt":"a1", "observation":"obs1", "replayed":true}.
criterion: AC81
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/attempts.rs:77; assertion: crates/cadence/tests/phase9_observations.rs:114. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_observations: test observation_duplicate_ac81 ... ok; test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 82. Late usage preserves terminal outcome
expected: With late obs2 with model observed-A, input usage 7, on terminal a1/o1, record_observation must return {"attempt":"a1", "terminal_count":1, "original":"o1", "observed_model":"observed-A", "input_usage":7}.
criterion: AC82
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/attempts.rs:77; assertion: crates/cadence/tests/phase9_observations.rs:128. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_observations: test observation_late_usage_ac82 ... ok; test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 83. Concurrent usage observation counted once
expected: With two identical obs2 usage observations racing at conditional commit, record_observation must return durable_usage_observation_count = 1.
criterion: AC83
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/attempts.rs:77; assertion: crates/cadence/tests/phase9_observations.rs:142. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_observations: test observation_conditional_winner_ac83 ... ok; test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 84. Empty findings accepted
expected: With bytes {"findings":[]}, validate_findings must return {"findings":[]}.
criterion: AC84
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:35. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_empty_ac84 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 85. One hundred findings accepted
expected: With 100 copies of F in a findings envelope, validate_findings must return findings.length = 100.
criterion: AC85
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:43. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_hundred_ac85 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 86. File scalar limit accepted
expected: With F with file containing exactly 1024 copies of 雪, validate_findings must return accepted = true.
criterion: AC86
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:132. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_file_limit_ac86 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 87. Excess file scalars refused
expected: With F with file containing 1025 copies of 雪, validate_findings must return {"code":"field-too-long", "index":0, "field":"file", "limit":1024}.
criterion: AC87
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:148. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_file_excess_ac87 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 88. Empty file refused
expected: With F with file equal to empty string, validate_findings must return {"code":"blank-field", "index":0, "field":"file"}.
criterion: AC88
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:153. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_file_empty_ac88 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 89. Whitespace file refused
expected: With F with file equal to string  \t\n, validate_findings must return {"code":"blank-field", "index":0, "field":"file"}.
criterion: AC89
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:158. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_file_whitespace_ac89 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 90. Claim scalar limit accepted
expected: With F with claim containing exactly 2000 copies of 雪, validate_findings must return accepted = true.
criterion: AC90
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:133. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_claim_limit_ac90 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 91. Excess claim scalars refused
expected: With F with claim containing 2001 copies of 雪, validate_findings must return {"code":"field-too-long", "index":0, "field":"claim", "limit":2000}.
criterion: AC91
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:163. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_claim_excess_ac91 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 92. Empty claim refused
expected: With F with claim equal to empty string, validate_findings must return {"code":"blank-field", "index":0, "field":"claim"}.
criterion: AC92
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:168. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_claim_empty_ac92 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 93. Whitespace claim refused
expected: With F with claim equal to string  \t\n, validate_findings must return {"code":"blank-field", "index":0, "field":"claim"}.
criterion: AC93
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:173. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_claim_whitespace_ac93 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 94. Scenario scalar limit accepted
expected: With F with failure_scenario containing exactly 2000 copies of 雪, validate_findings must return accepted = true.
criterion: AC94
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:134. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_scenario_limit_ac94 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 95. Excess scenario scalars refused
expected: With F with failure_scenario containing 2001 copies of 雪, validate_findings must return {"code":"field-too-long", "index":0, "field":"failure_scenario", "limit":2000}.
criterion: AC95
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:178. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_scenario_excess_ac95 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 96. Empty scenario refused
expected: With F with failure_scenario equal to empty string, validate_findings must return {"code":"blank-field", "index":0, "field":"failure_scenario"}.
criterion: AC96
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:183. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_scenario_empty_ac96 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 97. Whitespace scenario refused
expected: With F with failure_scenario equal to string  \t\n, validate_findings must return {"code":"blank-field", "index":0, "field":"failure_scenario"}.
criterion: AC97
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:188. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_scenario_whitespace_ac97 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 98. First line accepted
expected: With F with line 1, validate_findings must return findings[0].line = 1.
criterion: AC98
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:213. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_line_one_ac98 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 99. Maximum line accepted exactly
expected: With F with line 9007199254740991, validate_findings must return findings[0].line = 9007199254740991.
criterion: AC99
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:221. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_line_max_ac99 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 100. Zero line refused
expected: With F with line 0, validate_findings must return {"code":"invalid-line", "index":0, "field":"line", "min":1, "max":9007199254740991}.
criterion: AC100
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:193. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_line_zero_ac100 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 101. Fractional line refused
expected: With F with line 1.5, validate_findings must return {"code":"invalid-line", "index":0, "field":"line", "min":1, "max":9007199254740991}.
criterion: AC101
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:198. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_line_fraction_ac101 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 102. Excess line refused
expected: With F with line 9007199254740992, validate_findings must return {"code":"invalid-line", "index":0, "field":"line", "min":1, "max":9007199254740991}.
criterion: AC102
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:203. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_line_excess_ac102 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 103. One hundred one findings refused
expected: With 101 copies of F, validate_findings must return {"code":"too-many-findings", "limit":100, "actual":101}.
criterion: AC103
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:66. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_excess_ac103 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 104. Unknown envelope field refused
expected: With an empty envelope with extra field extra, validate_findings must return {"code":"unknown-field", "field":"extra"}.
criterion: AC104
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:71. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_extra_ac104 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 105. Legacy fix field refused
expected: With F with extra field fix, validate_findings must return {"code":"unknown-field", "index":0, "field":"fix"}.
criterion: AC105
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:76. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_fix_ac105 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 106. Lone surrogate refused
expected: With JSON claim containing lone escaped surrogate \uD800, validate_findings must return {"code":"invalid-unicode-scalar", "index":0, "field":"claim"}.
criterion: AC106
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:208. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test scalars_lone_surrogate_ac106 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 107. Excess return bytes refused
expected: With 4,194,305 input bytes with a 4,194,304-byte cap, read_return must return {"code":"return-too-large", "limit":4194304}.
criterion: AC107
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/stream.rs:16; assertion: crates/cadence/tests/phase9_stream.rs:52. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_stream: test stream_excess_ac107 ... ok; test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 108. Original contract and IDs preserved
expected: With saved Q under o1/H4-1 with IDs o1:0 and o1:1, read_original must return identity = {"original":"o1", "contract":"H4-1", "finding_ids":["o1:0", "o1:1"]}.
criterion: AC108
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/originals.rs:39; assertion: crates/cadence/tests/phase9_recovery.rs:163. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_original_identity_ac108 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 109. Saved quoted Unicode claim preserved
expected: With saved raw Q, read_original must return findings[0].claim = "quote: \"\n雪".
criterion: AC109
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/originals.rs:39; assertion: crates/cadence/tests/phase9_recovery.rs:179. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_original_q_ac109 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 110. Saved raw bytes preserved
expected: With saved literal return bytes {"findings":[]} under o1, read_original must return raw_bytes = "{\"findings\":[]}".
criterion: AC110
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/originals.rs:39; assertion: crates/cadence/tests/phase9_recovery.rs:194. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_original_raw_ac110 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 111. Exact return byte cap accepted
expected: With a valid JSON findings envelope padded with JSON whitespace to 4,194,304 bytes and cap 4,194,304, read_return must return accepted_bytes = 4194304.
criterion: AC111
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/stream.rs:16; assertion: crates/cadence/tests/phase9_stream.rs:60. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_stream: test stream_exact_cap_ac111 ... ok; test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 112. Blocker severity accepted
expected: With F with severity blocker, validate_findings must return findings[0].severity = "blocker".
criterion: AC112
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:105. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_blocker_ac112 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 113. High severity accepted
expected: With F with severity high, validate_findings must return findings[0].severity = "high".
criterion: AC113
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:106. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_high_ac113 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 114. Medium severity accepted
expected: With F with severity medium, validate_findings must return findings[0].severity = "medium".
criterion: AC114
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:107. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_medium_ac114 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 115. Low severity accepted
expected: With F with severity low, validate_findings must return findings[0].severity = "low".
criterion: AC115
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:108. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_low_ac115 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 116. Unknown severity refused
expected: With F with severity critical, validate_findings must return {"code":"invalid-severity", "index":0, "field":"severity", "actual":"critical"}.
criterion: AC116
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:81. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_severity_ac116 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 117. Missing scenario refused
expected: With F without failure_scenario, validate_findings must return {"code":"missing-field", "index":0, "field":"failure_scenario"}.
criterion: AC117
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/contract.rs:80; assertion: crates/cadence/tests/phase9_contract.rs:86. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_contract: test envelope_scenario_ac117 ... ok; test result: ok. 37 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 118. Panel retains both required voices
expected: With panel admission with required voices A and B, dispatch_roster must return required_requests = ["A", "B"].
criterion: AC118
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:119; assertion: crates/cadence/tests/phase9_selection.rs:167. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_roster_panel_ac118 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 119. Adjudicated roster retains both voices
expected: With adjudicated admission with required voices A and B, dispatch_roster must return required_requests = ["A", "B"].
criterion: AC119
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:119; assertion: crates/cadence/tests/phase9_selection.rs:176. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_roster_adjudicated_ac119 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 120. Pending panel slot prevents completion
expected: With roster ["A", "B"], usable empty A and B state pending, delivery_completion must return "incomplete".
criterion: AC120
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:143; assertion: crates/cadence/tests/phase9_selection.rs:185. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_pending_ac120 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 121. Interrupted panel slot prevents completion
expected: With roster ["A", "B"], usable empty A and B state interrupted, delivery_completion must return "incomplete".
criterion: AC121
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:143; assertion: crates/cadence/tests/phase9_selection.rs:196. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_interrupted_ac121 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 122. Successful panel completes usefully
expected: With roster ["A", "B"], usable empty A and B state success, delivery_completion must return "usable-complete".
criterion: AC122
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:143; assertion: crates/cadence/tests/phase9_selection.rs:207. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_success_ac122 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 123. Panel failure remains failure
expected: With roster ["A", "B"], usable empty A and B state failed-no-fallback, delivery_completion must return "complete-with-failure".
criterion: AC123
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:143; assertion: crates/cadence/tests/phase9_selection.rs:218. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_failed_no_fallback_ac123 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 124. Successful slot fallback completes usefully
expected: With roster ["A", "B"], usable empty A and B state failed-fallback-success, delivery_completion must return "usable-complete".
criterion: AC124
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:143; assertion: crates/cadence/tests/phase9_selection.rs:229. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_failed_fallback_success_ac124 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 125. Failed slot fallback remains failure
expected: With roster ["A", "B"], usable empty A and B state failed-fallback-failed, delivery_completion must return "complete-with-failure".
criterion: AC125
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/selection.rs:143; assertion: crates/cadence/tests/phase9_selection.rs:240. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_selection: test panel_failed_fallback_failed_ac125 ... ok; test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 126. Recovered roster retains pending voice
expected: With saved empty A and pending B after a lost process, read_roster must return {"required":["A", "B"], "pending":["B"]}.
criterion: AC126
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/recovery.rs:85; assertion: crates/cadence/tests/phase9_recovery.rs:207. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_roster_pending_b_ac126 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 127. Per-voice original IDs preserved
expected: With A has o1:[], B has o2:[F], read_voice_originals must return {"A":"o1", "B":"o2"}.
criterion: AC127
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/originals.rs:68; assertion: crates/cadence/tests/phase9_recovery.rs:220. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_voice_original_ids_ac127 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 128. Delivery cannot settle adjudication
expected: With usable-complete adjudicated delivery without settlement, settlement_state must return "pending".
criterion: AC128
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/policy.rs:140; assertion: crates/cadence/tests/phase9_policy.rs:234. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_policy: test action_unsettled_ac128 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 129. Per-voice finding arrays preserved
expected: With committed A/o1 with F and B/o2 with empty findings, read_voice_originals must return findings = {"A":[{"file":"a.rs", "line":1, "severity":"high", "claim":"C", "failure_scenario":"S"}], "B":[]}.
criterion: AC129
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/originals.rs:68; assertion: crates/cadence/tests/phase9_recovery.rs:239. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_recovery: test recover_voice_findings_ac129 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 130. Minimalism file uses one base reviewer
expected: With retained file target m1 and ordinary routing panel, minimalism_request must return {"specialist":"minimalism", "target":"m1", "reviewers":["base"], "ordinary_routing":null}.
criterion: AC130
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/specialist.rs:16; assertion: crates/cadence/tests/phase9_specialist.rs:20. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_specialist: test minimalism_file_ac130 ... ok; test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 131. Minimalism directory uses one base reviewer
expected: With retained directory target m1 and ordinary routing panel, minimalism_request must return {"specialist":"minimalism", "target":"m1", "reviewers":["base"], "ordinary_routing":null}.
criterion: AC131
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/specialist.rs:16; assertion: crates/cadence/tests/phase9_specialist.rs:28. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_specialist: test minimalism_directory_ac131 ... ok; test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 132. Minimalism phase uses one base reviewer
expected: With retained phase-range target m1 and ordinary routing panel, minimalism_request must return {"specialist":"minimalism", "target":"m1", "reviewers":["base"], "ordinary_routing":null}.
criterion: AC132
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/specialist.rs:16; assertion: crates/cadence/tests/phase9_specialist.rs:36. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_specialist: test minimalism_phase_range_ac132 ... ok; test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 133. Directory membership remains frozen
expected: With retained listing ["a.rs"] with bytes old\n, live listing ["b.rs"], read_directory_target must return {"members":["a.rs"], "contents":{"a.rs":"old\n"}}.
criterion: AC133
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/material.rs:234; assertion: crates/cadence/tests/phase9_material.rs:317. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_material: test read_directory_ac133 ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 134. Decision text and context preserved
expected: With selected decision D-1 text Decision and inline context Context, decision_review_target must return {"decision":"D-1", "text":"Decision", "context":"Context"}.
criterion: AC134
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/targets.rs:12; assertion: crates/cadence/tests/phase9_context.rs:132. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_context: test context_decision_ac134 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 135. Diagnosis sources and text preserved
expected: With named entry e1, reported text Reported and cause text Cause, diagnosis_target must return {"entries":["e1"], "reported":"Reported", "cause":"Cause"}.
criterion: AC135
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/targets.rs:27; assertion: crates/cadence/tests/phase9_context.rs:145. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_context: test context_diagnosis_ac135 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 136. Specialist raw original recovered
expected: With saved specialist result raw, read_specialist_result must return {"kind":"raw", "original":"o1"}.
criterion: AC136
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:134; assertion: crates/cadence/tests/phase9_consumers.rs:166. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_specialist_raw_ac136 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 137. Specialist empty result recovered
expected: With saved specialist result empty, read_specialist_result must return {"kind":"raw", "findings":[]}.
criterion: AC137
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:134; assertion: crates/cadence/tests/phase9_consumers.rs:178. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_specialist_empty_ac137 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 138. Specialist failure stays failure
expected: With saved specialist result failed, read_specialist_result must return {"kind":"failed", "findings":null}.
criterion: AC138
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/consumers.rs:134; assertion: crates/cadence/tests/phase9_consumers.rs:190. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_consumers: test raw_specialist_failed_ac138 ... ok; test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 139. Phase deferred member committed
expected: With deferred fire f1 in phase home with H1-H4 references, enqueue_deferred must return {"member":"f1", "state":"unruled", "continuation":"allowed"}.
criterion: AC139
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:132. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_phase_ac139 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 140. Task deferred member committed
expected: With deferred fire f1 in task home with H1-H4 references, enqueue_deferred must return {"member":"f1", "state":"unruled", "continuation":"allowed"}.
criterion: AC140
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:147. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_task_ac140 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 141. Inline deferred member committed
expected: With deferred fire f1 in root-inline home with H1-H4 references, enqueue_deferred must return {"member":"f1", "state":"unruled", "continuation":"allowed"}.
criterion: AC141
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:162. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_root_inline_ac141 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 142. Debug deferred member committed
expected: With deferred fire f1 in root-debug home with H1-H4 references, enqueue_deferred must return {"member":"f1", "state":"unruled", "continuation":"allowed"}.
criterion: AC142
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:177. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_root_debug_ac142 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 143. Diagnosis deferred member committed
expected: With deferred fire f1 in root-diagnosis home with H1-H4 references, enqueue_deferred must return {"member":"f1", "state":"unruled", "continuation":"allowed"}.
criterion: AC143
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:192. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_root_diagnosis_ac143 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 144. Queue sync failure prevents continuation
expected: With deferred fire f1 with failed queue sync, enqueue_deferred must return {"code":"enqueue-write-failed", "fire":"f1", "continuation":"wait"}.
criterion: AC144
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:207. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_sync_failure_ac144 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 145. Deferred discovery covers all homes
expected: With saved phase f1, task f2, root f3 members, all disposable renderings absent, enumerate_deferred must return ["f1", "f2", "f3"].
criterion: AC145
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:212; assertion: crates/cadence/tests/phase9_deferred.rs:219. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_enumeration_ac145 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 146. Advisory enqueue writes no member
expected: With gate advisory and no deferred obligation, enqueue_deferred must return {"member":null}.
criterion: AC146
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:233. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_advisory_ac146 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 147. Off enqueue writes no member
expected: With gate off and no deferred obligation, enqueue_deferred must return {"member":null}.
criterion: AC147
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:117; assertion: crates/cadence/tests/phase9_deferred.rs:247. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_off_ac147 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 148. Modern pause uses ordinary fields
expected: With modern pause f1/a1, ordinary finding F, pause_delivery_request must return {"fire":"f1", "attempt":"a1", "fields":["file", "line", "severity", "claim", "failure_scenario"]}.
criterion: AC148
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/pause_service.rs:53; assertion: crates/cadence/src/phase9_pause_tests.rs:4. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --bin cadence phase9_pause_tests::modern_. Output for cadence: test server::pause_service::phase9_pause_tests::modern_pause_ordinary_delivery_fields ... ok; test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 212 filtered out. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 149. Old pause remains historical
expected: With saved old finding with fix:"S" and no dispatch, read_pause_origin must return {"provenance":"historical", "dispatch":null, "verified":false}.
criterion: AC149
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/history.rs:53; assertion: crates/cadence/tests/phase9_history.rs:19. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_history: test history_fix_without_dispatch_remains_historical ... ok; test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 150. Deferred references join all record families
expected: With saved f1 with H1 f1, H2 m1, H3 a1 and H4 o1 references, enumerate_deferred must return members[0].references = {"fire":"f1", "manifest":"m1", "attempt":"a1", "original":"o1"}.
criterion: AC150
status: pass
first_pass: pass
source: verifier
evidence: Production unit: crates/cadence/src/review/deferred.rs:212; assertion: crates/cadence/tests/phase9_deferred.rs:261. Command: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output for phase9_deferred: test deferred_references_ac150 ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. This verifies the literal unit input/output criterion; broader production-composition defects are recorded separately as unmapped goal gaps.

### 151. Execution admits configured review before continuation
expected: unwired - The native execution entry path only looks for already admitted reviews. With a fresh review namespace and an enabled ordinary review gate, it can expose the next executor dispatch or completion without creating a fire, retaining its artifact, or obtaining a review return. This is the missing thin automatic review boundary identified by C01, not a request to migrate the full phase-12 execution workflow.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: crates/cadence/src/execution/dispatch.rs:79 still initializes ReviewPolicy::Disabled. crates/cadence/src/server.rs:675 and :679 call review_handoff around execute-next, but crates/cadence/src/execution_service.rs:2246 only resolves the phase and calls pending_execution. crates/cadence/src/review_service.rs:983 filters existing admissions; :1005 returns pending:false when none exist. No admission is created on this path. skills/cad-execute/SKILL.md:12 exposes next/complete, while :31 only handles a grouped review response already returned. CONTEXT.md:21 identifies automatic trigger orchestration as phase-9 scope; PLAN-6.md Task 2 requires the thin invoking boundary. Named-target run: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output: test request_execute_ac9 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. This test only calls execute_review_request with supplied policy; it never exercises the execution admission boundary. The selected binary review_service::tests::home_request_ test passed 1/1 but only checks home_path.
reported: unwired - The native execution entry path only looks for already admitted reviews. With a fresh review namespace and an enabled ordinary review gate, it can expose the next executor dispatch or completion without creating a fire, retaining its artifact, or obtaining a review return. This is the missing thin automatic review boundary identified by C01, not a request to migrate the full phase-12 execution workflow.
severity: blocker
cause: unwired - The native execution entry path only looks for already admitted reviews. With a fresh review namespace and an enabled ordinary review gate, it can expose the next executor dispatch or completion without creating a fire, retaining its artifact, or obtaining a review return. This is the missing thin automatic review boundary identified by C01, not a request to migrate the full phase-12 execution workflow. | Confirmed independently against the code. crates/cadence/src/execution/dispatch.rs:79 still initializes ReviewPolicy::Disabled. crates/cadence/src/server.rs:675 and :679 call review_handoff around execute-next, but crates/cadence/src/execution_service.rs:2246 only resolves the phase and calls pending_execution. crates/cadence/src/review_service.rs:983 filters existing admissions; :1005 returns pending:false when none exist. No admission i
fix: routed to /cad-plan

### 152. Known launch failure closes the issued attempt
expected: behavior wrong - A definite failed Task launch or provider-availability failure with no host agent_id cannot be recorded as a terminal failed attempt. Return submission requires a launch string and rejects it unless a host launch was previously bound, even when host_failure is supplied. Such issued work remains pending and FIRST cannot advance or fall back. Missing observable origin must remain unknown, but a known launch failure needs a truthful terminal representation.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: crates/cadence/src/review_service.rs:49 requires launch:String. crates/cadence/src/review/returns.rs:194 rejects unobserved-host-launch before the host_failure classification at :234. crates/cadence/src/review/model.rs:293 has no failed-launch observation kind; crates/cadence/src/review/attempts.rs:139 only changes nonterminal observations to Interrupted or ObservedRunning. crates/cadence/src/review_service.rs:807 includes an issued Intended attempt in selection, so it cannot advance. skills/cad-review-delivery/SKILL.md:58 explicitly directs actual failed launch/availability events through this boundary. Named-target run: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output: test accept_missing_return_closes_failed ... ok; test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s. crates/cadence/tests/phase9_returns.rs:124 constructs submissions using a supplied launch1 binding; the passing missing-return and malformed-return cases do not cover failure before an agent_id exists.
reported: behavior wrong - A definite failed Task launch or provider-availability failure with no host agent_id cannot be recorded as a terminal failed attempt. Return submission requires a launch string and rejects it unless a host launch was previously bound, even when host_failure is supplied. Such issued work remains pending and FIRST cannot advance or fall back. Missing observable origin must remain unknown, but a known launch failure needs a truthful terminal representation.
severity: major
cause: behavior wrong - A definite failed Task launch or provider-availability failure with no host agent_id cannot be recorded as a terminal failed attempt. Return submission requires a launch string and rejects it unless a host launch was previously bound, even when host_failure is supplied. Such issued work remains pending and FIRST cannot advance or fall back. Missing observable origin must remain unknown, but a known launch failure needs a truthful terminal representation. | Confirmed independently against the code. crates/cadence/src/review_service.rs:49 requires launch:String. crates/cadence/src/review/returns.rs:194 rejects unobserved-host-launch before the host_failure classification at :234. crates/cadence/src/review/model.rs:293 has no failed-launch observation kind; crates/cadence/src/review/attempts.rs:139 only changes nonterminal observations to Interrupted or ObservedRunning. crates/cadence/src/revi
fix: routed to /cad-plan

### 153. Appended evidence cannot retrofit an earlier original view
expected: behavior wrong - The public material-append boundary accepts a caller-supplied MaterialView with the same view ID but different entries. A caller can add the deterministic new entry ID to that supplied list after the attempt has completed; the service then labels the new bytes original-view for the old attempt. This contradicts the immutable original view and later-evidence distinction.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: crates/cadence/src/review_service.rs:615 checks only matching fire, view ID and presence of a launch; it does not compare supplied entries with the saved attempt view or enforce a delivery-time/terminal-state constraint. crates/cadence/src/review/material.rs:184 checks membership only in that supplied list and :205 sets OriginalView. The original saved attempt view is not updated or independently observed. crates/cadence/src/review_service.rs:700 subsequently serves an appended entry on saved.attempt alone even if absent from the immutable view. Named-target run: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output: test context_cannot_retrofit_earlier_view ... ok; test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. crates/cadence/tests/phase9_context.rs:159 supplies an old view without the new entry; it does not exercise a forged replacement entry list at the service boundary. AC75/AC76's literal unit projections still pass.
reported: behavior wrong - The public material-append boundary accepts a caller-supplied MaterialView with the same view ID but different entries. A caller can add the deterministic new entry ID to that supplied list after the attempt has completed; the service then labels the new bytes original-view for the old attempt. This contradicts the immutable original view and later-evidence distinction.
severity: major
cause: behavior wrong - The public material-append boundary accepts a caller-supplied MaterialView with the same view ID but different entries. A caller can add the deterministic new entry ID to that supplied list after the attempt has completed; the service then labels the new bytes original-view for the old attempt. This contradicts the immutable original view and later-evidence distinction. | Confirmed independently against the code. crates/cadence/src/review_service.rs:615 checks only matching fire, view ID and presence of a launch; it does not compare supplied entries with the saved attempt view or enforce a delivery-time/terminal-state constraint. crates/cadence/src/review/material.rs:184 checks membership only in that supplied list and :205 sets OriginalView. The original saved attempt view is not updated or independently
fix: routed to /cad-plan

### 154. Ordinary risk admission consumes detector state
expected: unwired - The shared native admission path does not consume the match/nonmatch/inconclusive/unanswered detector decision. For every non-off risk gate it constructs review attempts, so unanswered surfaces and inconclusive or nonmatching evidence cannot produce their required ask/wait/no-review behavior. The policy unit exists but has no production caller.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: crates/cadence/src/review/policy.rs:126 implements risk_review_action. Command: rg -n 'risk_review_action\(' crates/cadence/src crates/cadence/tests/phase9_policy.rs. Output contains only its definition and four test calls (:195, :206, :217, :228), with no production invocation. crates/cadence/src/review_service.rs:110 AdmissionRequest has no detector observation; :232 reads only the ordinary trigger policy and :269 skips only Gate::Off before constructing attempts. The modern pause adapter at crates/cadence/src/pause_service.rs:63 validates the target and forwards to this same admission path without a risk decision. Its historical pause detector branch does not wire the new boundary. Named-target run: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output: test action_unanswered_ac23 ... ok; test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. action_match_ac20, action_nonmatch_ac21 and action_inconclusive_ac22 also passed in that target; all supply the detector enum directly and prove only the four literal decisions.
reported: unwired - The shared native admission path does not consume the match/nonmatch/inconclusive/unanswered detector decision. For every non-off risk gate it constructs review attempts, so unanswered surfaces and inconclusive or nonmatching evidence cannot produce their required ask/wait/no-review behavior. The policy unit exists but has no production caller.
severity: major
cause: unwired - The shared native admission path does not consume the match/nonmatch/inconclusive/unanswered detector decision. For every non-off risk gate it constructs review attempts, so unanswered surfaces and inconclusive or nonmatching evidence cannot produce their required ask/wait/no-review behavior. The policy unit exists but has no production caller. | Confirmed independently against the code. crates/cadence/src/review/policy.rs:126 implements risk_review_action. Command: rg -n 'risk_review_action\(' crates/cadence/src crates/cadence/tests/phase9_policy.rs. Output contains only its definition and four test calls (:195, :206, :217, :228), with no production invocation. crates/cadence/src/review_service.rs:110 AdmissionRequest has no detector observation; :232 reads only the ordinary trig
fix: routed to /cad-plan

### 155. Minimalism dispatch ignores ordinary routing
expected: behavior wrong - Minimalism requests one base reviewer, but the resident adapter still resolves ordinary cad-reviewer routing and copies its model and effort into that specialist attempt. With roles.cad-reviewer.model pinned, the emitted minimalism dispatch passes that pin instead of inheriting the session default. An ordinary routing failure can also prevent specialist admission.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: crates/cadence/src/review_service.rs:205 calls route_at before distinguishing specialists; :324 treats base as local, :326 copies route.choice.model and :361 copies route.choice.rung. The minimalism_request result is only checked for an error at :307 and its no-routing result is discarded. crates/cadence/src/review/invoking.rs:37 forwards the copied model to the dispatch. CONTEXT.md:188 (D-58) requires one base reviewer without ordinary gate/routing selection; cadence-core/workflows/minimalism-review.md:79 explicitly retains the session default regardless of roles.cad-reviewer.model. Named-target run: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output: test minimalism_file_ac130 ... ok; test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. The three tests call minimalism_request directly with already retained targets, so their null ordinary_routing result does not prove the adapter's requested voice.
reported: behavior wrong - Minimalism requests one base reviewer, but the resident adapter still resolves ordinary cad-reviewer routing and copies its model and effort into that specialist attempt. With roles.cad-reviewer.model pinned, the emitted minimalism dispatch passes that pin instead of inheriting the session default. An ordinary routing failure can also prevent specialist admission.
severity: major
cause: behavior wrong - Minimalism requests one base reviewer, but the resident adapter still resolves ordinary cad-reviewer routing and copies its model and effort into that specialist attempt. With roles.cad-reviewer.model pinned, the emitted minimalism dispatch passes that pin instead of inheriting the session default. An ordinary routing failure can also prevent specialist admission. | Confirmed independently against the code. crates/cadence/src/review_service.rs:205 calls route_at before distinguishing specialists; :324 treats base as local, :326 copies route.choice.model and :361 copies route.choice.rung. The minimalism_request result is only checked for an error at :307 and its no-routing result is discarded. crates/cadence/src/review/invoking.rs:37 forwards the copied model to the dispatch. CONTEXT.md:188 (D-58) req
fix: routed to /cad-plan

### 156. Directory targets retain files beneath subdirectories
expected: behavior wrong - Any directory target containing a subdirectory acquires that subdirectory as though it were a regular file, marks it unavailable and fails manifest admission. This prevents ordinary nested source directories from being used by the promised minimalism directory target; it also leaves the descendant file bytes unretained.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: crates/cadence/src/review/material_io.rs:63 returns all immediate read_dir names, including directories. crates/cadence/src/review/material.rs:290 reads every listed member as a file, while crates/cadence/src/review/material_io.rs:46 rejects non-regular files. The resulting unavailable entry fails crates/cadence/src/review/manifest.rs:97, called by crates/cadence/src/review/admission.rs:119. crates/cadence/src/review/material.rs:261 also forbids nested member paths. CONTEXT.md:199 retains the specialist directory contract; cadence-core/workflows/minimalism-review.md:27 defines a directory as the files under it. Named-target run: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output: test read_directory_acquisition_freezes_members ... ok; test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s. crates/cadence/tests/phase9_material.rs:379 exercises only flat a.rs/b.rs members with a supplied source adapter. AC131's retained-directory constructor and AC133's retained flat listing both pass but do not cover nested acquisition.
reported: behavior wrong - Any directory target containing a subdirectory acquires that subdirectory as though it were a regular file, marks it unavailable and fails manifest admission. This prevents ordinary nested source directories from being used by the promised minimalism directory target; it also leaves the descendant file bytes unretained.
severity: major
cause: behavior wrong - Any directory target containing a subdirectory acquires that subdirectory as though it were a regular file, marks it unavailable and fails manifest admission. This prevents ordinary nested source directories from being used by the promised minimalism directory target; it also leaves the descendant file bytes unretained. | Confirmed independently against the code. crates/cadence/src/review/material_io.rs:63 returns all immediate read_dir names, including directories. crates/cadence/src/review/material.rs:290 reads every listed member as a file, while crates/cadence/src/review/material_io.rs:46 rejects non-regular files. The resulting unavailable entry fails crates/cadence/src/review/manifest.rs:97, called by crates/cadence/src/review/admission.rs:119. crate
fix: routed to /cad-plan

### 157. Return bytes are bounded before request accumulation
expected: behavior wrong - The 4 MiB reader is applied only after the complete MCP request and its raw String have already been accumulated and parsed. It rejects an oversized return after allocating it, so H4's raw-accumulation bound is not enforced on the real input boundary.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: crates/cadence/src/main.rs:67 serves the default rmcp stdio transport. Cargo.lock:789 pins rmcp 3.2.0; its local source /home/john/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/rmcp-3.2.0/src/transport/async_rw.rs:137 uses read_until into an unbounded line_buf before JSON parsing. crates/cadence/src/server.rs:731 clones and deserializes the complete request; crates/cadence/src/review_service.rs:53 already holds raw:Option<String> before :579 passes s.as_bytes() to read_return. CONTEXT.md:487 requires a 4 MiB raw accumulation cap before parsing. Named-target run: TMPDIR=/tmp RUSTC_WRAPPER= CARGO_NET_OFFLINE=true cargo test -p cadence --no-fail-fast --test phase7_guard --test phase7_risk --test phase7_lease --test phase8_config --test phase8_routing --test phase8_interview --test phase8_global --test phase8_dispatch --test phase9_contract --test phase9_stream --test phase9_material --test phase9_manifest --test phase9_context --test phase9_policy --test phase9_selection --test phase9_specialist --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred --test phase9_model --test phase9_forward --test phase9_invoking --test phase9_history. Output: test stream_excess_ac107 ... ok; test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s. stream_exact_cap_ac111 also passed; these tests verify the bounded reader itself, not the unbounded transport and String allocation preceding its production call.
reported: behavior wrong - The 4 MiB reader is applied only after the complete MCP request and its raw String have already been accumulated and parsed. It rejects an oversized return after allocating it, so H4's raw-accumulation bound is not enforced on the real input boundary.
severity: major
cause: behavior wrong - The 4 MiB reader is applied only after the complete MCP request and its raw String have already been accumulated and parsed. It rejects an oversized return after allocating it, so H4's raw-accumulation bound is not enforced on the real input boundary. | Confirmed independently against the code. crates/cadence/src/main.rs:67 serves the default rmcp stdio transport. Cargo.lock:789 pins rmcp 3.2.0; its local source /home/john/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/rmcp-3.2.0/src/transport/async_rw.rs:137 uses read_until into an unbounded line_buf before JSON parsing. crates/cadence/src/server.rs:731 clones and deserializes the complete request; crates/cadence/src/review_servic
fix: routed to /cad-plan

## Summary

total: 157
passed: 150
failed: 7
pending: 0
skipped: 0
blocked: 0
reworked: 7
