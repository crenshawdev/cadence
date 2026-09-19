---
status: testing
phase: 4
fields_version: 1
started: 2026-09-06
updated: 2026-09-06
---

## Items

### 1. Cold start on a fresh tree
expected: With no prior state, the binary boots against a clean .planning/, completes the MCP handshake, and one lifecycle query returns real derived state.
origin: smoke
status: skipped
source: model
reason: Not reachable from the binary, by design. A cold start against a fresh .planning/ boots clean and completes the MCP handshake (serverInfo cadence 3.7.12), but tools/list returns exactly one tool, cadence_version. The lifecycle query is internal (CadenceServer::lifecycle), so no external caller can invoke it and no derived state can be observed through the interface. CONTEXT scopes the tool surface out of this phase; phase 6 owns the typed boundary. find on the fresh tree afterwards shows only the empty .planning/ it was given.

### 2. The lifecycle truth table, including complete with no PLAN
expected: No artifacts derives unplanned; an admitted PLAN derives planned; a SUMMARY without a qualifying UAT derives executed; a SUMMARY plus a qualifying UAT derives complete BOTH with and without a PLAN. Negative controls: deleting the last skip reason prevents completion, and adding a PLAN prerequisite makes the no-PLAN complete case fail.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: 4 tests, all ok: derivation::tests::ac1_production_truth_table_and_plan_prerequisite_mutant (the truth table plus the PLAN-prerequisite mutant), ac1_removing_final_skip_reason_prevents_completion, ac1_empty_and_nonregular_plan_summary_use_existence, ac1_failures_cannot_derive_success. Both negative controls named in the criterion are their own tests.

### 3. current is the first non-complete phase
expected: current comes from the first non-complete phase in ascending ROADMAP order, ties keep textual order, and closed/null is distinguishable from live-with-all-complete. Negative controls: permuting unequal entries cannot change current, and checking a ROADMAP box cannot make a phase complete.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: 4 tests, all ok: derivation::tests::ac2_current_is_numeric_and_invariant_under_unequal_permutation, ac2_numeric_ties_share_evidence_and_preserve_names_and_order, ac2_closed_null_zero_differs_from_live_null_all_complete, ac2_checkbox_cannot_complete_and_invalid_lists_refuse. Both negative controls (permutation invariance, checkbox cannot complete) are asserted.

### 4. The memo key changes on every real input and on nothing else
expected: Mutating any one hashed input - root/version, ROADMAP bytes, admitted PLAN names, SUMMARY existence, UAT bytes, present/absent/error tags - changes the key. Reordering directory returns, touching mtimes, editing PLAN/SUMMARY bodies without changing existence, or editing excluded files leaves it unchanged. An encoder omitting SUMMARY existence or UAT reason bytes fails the table.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: 4 tests, all ok: derivation::tests::ac3_each_input_outcome_category_and_negative_encoders (the per-input table plus the SUMMARY-omitting and reason-omitting encoders), encoding_boundaries_fixed_v1_and_semantic_order, and server::derivation_service_tests::ac3_exclusions_real_files_metadata_order_snapshot_and_positive_controls plus ac3_exclusions_failed_captures_never_create_success_memos. Exclusions are tested against real files, not fixtures.

### 5. A disagreeing memo is a hard error, not a silent recompute
expected: A stored memo with the same key but a changed answer field returns derivation-conflict naming the differing field, writes nothing, and survives a fresh-process reopen with bytes unchanged. Same for malformed memo data. Control: a consistent artifact edit changes the key and succeeds; bypassing fresh comparison makes the corrupt case wrongly pass.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: 8 tests, all ok: derivation::tests::memo_comparison_all_fields_and_unconditional_hit_negative_control (every answer field mutated under one unchanged key, plus the bypass control), memo_comparison_envelope_malformed_namespace_and_current_payload; server::derivation_service_tests::ac4_fresh_process_equality_invalidation_and_cursor_history, ac4_integritied_corruption_and_malformed_memos_refuse_without_repair, ac4_child; memo_ack_installed_memo_does_not_acknowledge_before_confirmation, memo_ack_either_fsync_failure_refuses_and_installed_generation_can_recover; and checked_snapshot_verified_read_and_conditional_replacement in tests/store.rs.

### 6. One lifecycle vocabulary, legacy spellings normalized at intake
expected: unplanned, ready to plan and context gathered all normalize to canonical unplanned with no cursor conflict; paused is held; an unknown status is refused by name; exact Next and original fields survive intake and restart. Negative control: reinstating the frozen AGREE table fails the canonical-unplanned case.
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: 10 tests, all ok. Unit: derivation::tests::ac5_normalize_aliases_and_exact_provenance_on_both_paths, ac5_normalize_blank_name_and_next_are_line_bounded_native_constraints, ac5_normalize_malformed_and_inconsistent_inputs_stay_unavailable, ac5_agreement_canonical_alias_closed_all_complete_and_hold_table, ac5_agreement_frozen_agree_mutant_fails_shared_table (the criterion negative control), ac5_agreement_query_requires_exact_cursor_and_retirement_recheck, ac5_adopt_atomic_namespace_preservation_fresh_null_and_rearmed_cursor, ac5_adopt_malformed_retirement_cannot_suppress_comparison_or_discard_data. Integration: ac5_adoption_and_hold_survive_fresh_process_and_retired_assertion_allows_advance, ac5_failed_normalization_or_comparison_never_adopts_or_writes. NOTE: phase 3 has an unrelated criterion also numbered AC5 (import::tests::ac5_frozen_first_touch...); it is not evidence for this item.

### 7. Declaration conflicts refuse, cold and warm
expected: Every conflict row - checked/incomplete, unchecked/complete, incompatible intake cursor, closed nonzero total - returns state-conflict naming source and compared values, with no successful answer and no write, on both a cold memo and a warm one. Correcting the assertion then succeeds. Negative control: returning the frozen success-with-drift envelope fails.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: 4 tests, all ok: derivation::tests::ac6_conflicts_both_checkbox_directions_and_success_with_drift_mutant (includes the criterion negative control), ac6_conflicts_query_wrappers_and_ordered_tie_diagnostics; integration ac6_cold_and_warm_conflicts_preserve_every_byte_and_corrections_succeed - read the source: 11 ConflictRow variants (CheckedIncomplete, UncheckedComplete, WrongPhase, WrongStatus, ClosedTotal, ClosedHeldTotal, ClosedPlanned, ClosedExecuted, AllCompleteUnplanned, AllCompletePlanned, AllCompleteExecuted) crossed with warm in [false,true] = 22 rows, each asserting store bytes unchanged, source bytes unchanged, snapshot data equal, no .store-intent.json, the success-with-drift control rejected, and the corrected candidate equal to a fresh derivation (tests/derivation_consistency.rs:408); plus ac6_retired_cursor_control_allows_consistent_advance_without_writes.

### 8. Inputs changing mid-query refuses publication
expected: A UAT or SUMMARY change injected between capture and final recheck returns inputs-changed, publishes no candidate memo and preserves the prior one. A read/list/probe denial returns a path-specific input error rather than a false unplanned/executed success. Negative controls: disabling reobservation, or converting a denial into an absence, each make the corresponding check fail.
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: 6 integration tests, all ok: ac7_changes_refuse_candidate_and_preserve_prior_memo, ac7_read_list_probe_denials_refuse_at_prepare_and_recheck, ac7_ordinary_absence_keeps_truth_table_and_same_capture, ac7_other_named_changes_refuse_but_excluded_names_do_not, and BOTH mutants as their own tests: ac7_omitted_recheck_mutant_fails_same_publication_guard and ac7_denial_as_absence_mutant_fails_same_publication_guard. Plus server::derivation_service_tests::query_guards_reobserve_changes_denials_and_fresh_hit_without_write. NOTE: phase 3 has an unrelated criterion also numbered AC7; its recall tests are not evidence for this item.

### 9. The store still holds no lock primitive
expected: crates/cadence/src/store/ contains zero lock primitives even though this phase edited store/writer.rs.
status: pass
first_pass: pass
source: model
evidence: rg -n "Mutex|RwLock|OnceLock|LazyLock|flock|F_SETLK|\.lock\(" crates/cadence/src/store -> no matches, exit 1. PLAN-3 edited crates/cadence/src/store/writer.rs (adding ReadVerified and CompareRewriteSnapshot) and the store still holds zero lock primitives.

### 10. cadence-core/ is untouched
expected: cadence-core/ is byte-identical to the v3.7.12 tag - the phase's stated scope boundary.
status: pass
first_pass: pass
source: model
evidence: git diff --exit-code v3.7.12 -- cadence-core/ -> exit 0, no output. Tag v3.7.12 resolves to c39bbd8c.

## Summary

total: 10
passed: 9
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 0
