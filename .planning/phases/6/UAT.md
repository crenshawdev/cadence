---
status: testing
phase: 6
fields_version: 1
started: 2026-09-08
updated: 2026-09-08
---

## Items

### 1. Three tools and typed malformed-input refusals
expected: tools/list names exactly cadence_version, cadence_query and cadence_apply with input/output schemas; missing, extra, wrong-type and malformed-union calls return successful refused envelopes with code/reason, mirrored text/structured content and matching durable refusal decisions.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp -> tool_schemas_list_exactly_three_tools_with_output_schemas, both host-schema checks and tool_schemas_malformed_objects_reach_cadence_and_protocol_errors_stay_distinct all ok; cargo test -p cadence -> execution_service_malformed_arguments_confirm_root_refusals_without_semantic_work ok. MCP total 10 pass/8 fixture failures from denied gpg-agent sockets.

### 2. Native phase selection and durable dispatch
expected: A positive integer phase on native plans selects the first outstanding overlap-ordered plan and persists one dispatch with opaque body and operational fields; decimal, exponent, nonpositive and legacy-only inputs return typed non-ok answers without dispatch.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence -> ac2_strict_plan_and_overlap_selection_are_executable_evidence, three_plan_overlap_graph_orders_shared_and_transitive_leases, resident_selects_overlap_graph_durably_and_ignores_report_bodies and execution_service_prompt_contains_generated_schema_and_opaque_utf8_body all ok; recorded cargo test -p cadence --test mcp execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch -> 1 passed, 0 failed (PLAN-2-live-record.md Task 6: seven invalid phase forms plus legacy plan, no dispatch).

### 3. Real host executes and submits executor patches
expected: A real host invokes /cad-execute through stdio MCP, dispatches a fixed executor that edits source, invokes task verify and suite commands, creates ordered signed conventional task commits, and submits the advertised patch unchanged without report-file or shell fallback.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Recorded command: claude -p '/cad-execute 6' with direct stdio MCP and temporary settings (PLAN-2-live-record.md, U1-U5): two real cad-executor calls, exact 8391/8394-byte prompts, source Edits, dispatched verify/suite calls, signed T1 b8775abd2d479debb695d69ff4efc10a61a24538 and T2 7b50c7abcdaf5ff4d6dedc3cda9a62ed77a31534, unchanged patch submissions -> next-plan then complete; no parent shell/report fallback. Explicit fixture receipt guidance was required; unassisted reliability remains unverified.

### 4. Accepted patches preserve state and advance plans
expected: A valid patch preserves unrelated/import/lifecycle/evidence state, validates Git commits, renders exactly accepted task IDs and full SHAs in SUMMARY, and selects the next overlap-safe plan or completes after the last plan.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence -> complete_patch_preserves_every_unrelated_json_value, signed_commits_apply_in_strict_order_and_paths_survive_replay and restart SUMMARY recovery tests ok; recorded claude -p '/cad-execute 6' (PLAN-2-live-record.md U2/U5) -> next-plan then complete, SUMMARY exactly T1/T2 and their full signed SHAs once each. Current continuation includes phase 7 risk settlement.

### 5. Invalid patches refuse without changing execution
expected: Missing tasks, foreign/stale dispatches, unknown keys, unsupported evidence, nonexistent/unsigned/reordered commits and another-plan patches return refused; execution and SUMMARY bytes stay unchanged and a refusal decision is persisted.
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence -> exact_task_set_and_order_are_enforced, foreign_and_stale_dispatch_identity_are_rejected, evidence_forms_are_typed_and_validated, every_top_level_patch_key_is_required_and_unknown_keys_refuse and missing_unsigned_reused_reordered_bad_and_mismatched_commits_refuse all ok; cargo test -p cadence --test execution_store refusal_changes_only_decisions_generation_and_integrity -> 1 passed, 0 failed (execution/SUMMARY unchanged, durable refusal only).

### 6. Restart retains dispatch and applies exactly once
expected: After killing the server after dispatch persistence, a fresh process returns the same dispatch identity, version, plan, tasks, base and body; one accepted patch advances once and replay duplicates neither transitions nor SUMMARY content.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence (output /tmp/cad-uat-cargo-6.log) -> execution_restart_dispatch_recovery_distinguishes_pre_admission, execution_restart_lost_apply_replays_one_immutable_transition and execution_restart_repairs_summary_before_final_state_confirmation all ok: real process kills recover durable dispatch and replay leaves decisions/SUMMARY byte-identical.

### 7. Real host guard denies owned writes and permits source
expected: A temporary PreToolUse hook invokes the Rust binary directly; real-host Write and Edit on state.json, decisions.jsonl and phase SUMMARY.md are denied, source writes succeed, and phase 6 adds no JavaScript or redirect script.
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: Recorded /code/cadence/target/debug/cadence guard hook under claude (PLAN-2-live-record.md U3/U6) -> 3 Write denials + 3 Edit denials on state.json, decisions.jsonl and SUMMARY.md, permissionDecision deny/exit 0, protected bytes unchanged, 1 source Write succeeds; git diff --name-status 5c92bfff^ 14528100 -- '*.js' '*.mjs' '*.cjs' hooks/ -> empty, exit 0.

### 8. Boundary log stops growing at terminal refusal
expected: Transition 257 persists log-bound; later calls replay identical terminal results without log growth. Tests explicitly disclaim host/model proof and the live record observes orchestration without grading model content.
criterion: AC8
status: pass
first_pass: pass
source: model
evidence: TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence -> execution_service_terminal_precedes_observation_dispatch_and_new_or_replayed_patch and phase_six_service_repair_inventory_runs_registered_evidence ok (256 transitions plus persisted terminal, unchanged bytes/restart replay); sed -n '1,12p' crates/cadence/tests/mcp.rs -> tests prove wire behavior, not host/model semantics; PLAN-2-live-record.md records real orchestration without model-content assertions.

### 9. Boundary architecture documentation
expected: docs/architecture/boundary.md describes the public tools, typed refusal behavior, stateless skill loop and both observed host schema constraints: object roots and no top-level input union.
status: pass
first_pass: pass
source: model
evidence: cat docs/architecture/boundary.md -> documents all three tools, typed refusals, stateless query/dispatch/apply loop, required object schema roots and forbidden top-level input unions.

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
