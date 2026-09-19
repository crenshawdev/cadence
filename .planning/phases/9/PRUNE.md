# Phase 9: what the 2026-09-09 test prune left owed

Source: the Codex review `.codex-analysis/phase-9-test-prune.md` (gitignored),
over 247 phase-9 tests: 178 kept, 40 deleted, 29 marked rewrite. The 40 were
deleted under the classical style in `docs/architecture/acceptance.md`. This
file records what was NOT done, so it is not lost with the report.

## 1. Twenty-nine tests to rewrite - intent sound, shape wrong

Deferred under the owner's slow-add rule (2026-09-09). Each row: file,
function, the rule it breaks, the one-line rewrite.

| file | function | rule | rewrite |
|---|---|---|---|
| src/execution_service.rs | `gap158_ac151_off_handoff_skips_before_material` | Fake only the outside world | Supply failing file and Git boundaries, run real handoff and admission, and assert the pending-false response and unchanged saved records. |
| src/review/attempts.rs | `gap153_delivery_contribution_records_exact_membership` | Use an independent expected value | Use a hand-written delivery key and expected record, while keeping contribution logic real. |
| src/review/contract.rs | `scalars_lexical_pair_is_not_lone` | Test the exposed behavior | Pass a complete finding containing the surrogate pair to validate_findings and expect the literal decoded character. |
| src/review/contract.rs | `scalars_lexical_escaped_backslash_is_not_surrogate` | Test the exposed behavior | Validate a complete envelope and expect the literal backslash-u text. |
| src/review/contract.rs | `scalars_lexical_malformed_syntax_stays_malformed` | Test the exposed behavior | Call classify_return with this malformed envelope and expect malformed-return. |
| src/review/contract.rs | `scalars_lexical_low_surrogate_has_field` | Test the exposed behavior | Validate a complete finding with the lone low surrogate and expect the literal file diagnostic. |
| src/review/contract.rs | `scalars_lexical_second_finding_and_escaped_key` | Test the exposed behavior | Use a valid first finding and a complete second finding with the escaped claim key, then assert validate_findings returns the literal index-1 diagnostic. |
| src/review/contract.rs | `scalars_lexical_unrelated_path_has_no_finding_location` | Test the exposed behavior | Call classify_return on this input and assert the literal failure without an invented finding location. |
| src/review/manifest.rs | `source_quoted_git_path_decodes_octal_bytes` | Test the exposed behavior | Give record_mappings a patch with the quoted octal path and assert the literal saved path. |
| src/review/manifest.rs | `source_context_line_has_both_source_sides` | Test the exposed behavior | Call record_mappings with this patch and assert both literal saved source references. |
| src/review/manifest.rs | `source_truncated_hunk_refuses` | Test the exposed behavior | Call record_mappings with the truncated patch and expect the literal error. |
| src/review/manifest.rs | `source_binary_header_preserves_spaces_in_path` | Test the exposed behavior | Build a manifest from this binary deletion patch and assert the saved old path and absent new path. |
| src/review/material.rs | `gap156_nested_enumeration_retains_only_sorted_files` | Avoid internal-state assertions | Retain the sorted file assertion and remove the directory-bookkeeping count. |
| src/review/material.rs | `gap156_nested_errors_and_symlinks_never_yield_partial_success` | Use an independent expected value | Compare each result with a hand-written Error value or literal message, and keep the symlink refusal. |
| src/review/returns.rs | `gap152_acknowledgment_requires_confirmed_failure` | Fake only the outside world | Submit a launch failure through the real persistence operation with successful and failed Storage writes, then assert acknowledgment and saved terminal state. |
| src/review/returns.rs | `gap152_identical_failure_replays_without_mutation` | Avoid internal-count assertions | Keep project_launch_failure's replay flag and unchanged-record assertion, and remove the acknowledgment call and count. |
| src/review_ingress.rs | `gap157_exact_cap_accepts_literal_and_escaped_padding` | Test the exposed behavior | Use the literal 4194304-byte cap, keep frame and decoded-byte checks, and remove private buffer and capacity assertions. |
| src/review_ingress.rs | `gap157_excess_refuses_before_complete_frame` | Test the exposed behavior | Use the literal cap plus one, retain the error and external stream stop checks, and remove decoder and frame-capacity assertions. |
| src/review_ingress.rs | `gap157_split_outer_string_escapes_preserve_raw_document` | Test the exposed behavior | Put the literal escape cases in complete frames with fixed byte limits and assert acceptance or refusal through BoundedInput. |
| src/review_ingress.rs | `gap157_reordered_escaped_keys_identify_actual_raw_path` | Test the exposed behavior | Feed the reordered frame to BoundedInput with literal raw limits of 14 and 15 and assert refusal and acceptance. |
| src/review_ingress.rs | `gap157_duplicate_identity_operation_raw_and_malformed_envelopes_refuse` | Test the exposed behavior | Send each complete malformed frame through BoundedInput and assert the literal duplicate-key or syntax failure. |
| src/review_ingress.rs | `gap157_metadata_excess_stops_before_frame_end` | Test the exposed behavior | Use a literal metadata limit and keep the error and external stream position checks. |
| src/review_ingress.rs | `gap157_overall_frame_limit_bounds_unrelated_input` | Test the exposed behavior | Keep the literal envelope-too-large result and the bounded read observation, and remove the private frame-length assertion. |
| src/review_ingress.rs | `gap157_cancelled_poll_keeps_partial_budget` | Test the exposed behavior | Keep the explicit Pending barrier, resumed return-too-large error, and external bytes-consumed bound, and remove decoder-counter assertions. |
| src/review_service.rs | `gap158_ac152_supplied_admission_persists_exact_gate_and_route` | Fake only the outside world | Fake source files, Git, clock, and configuration reads only; retain the real admission write and literal saved gate and route checks. |
| src/review_service.rs | `gap155_minimalism_ignores_pinned_and_failed_ordinary_routes` | Fake only the outside world | Use real routing with pinned and invalid configuration supplied at ConfigIo, then assert the specialist voice has no ordinary override. |
| tests/phase7_guard.rs | `shipped_manifest_loads_both_native_arms_and_preserves_unrelated_hooks` | Write the expected value by hand | Replace git show with a hand-written frozen fixture and keep the literal SubagentStop command and timeout checks. |
| tests/phase9_observations.rs | `observation_late_usage_ac82` | Avoid internal-count assertions | Remove terminal_count and assert the literal late usage, original identity, and saved terminal state. |
| tests/phase9_returns.rs | `accept_missing_return_closes_failed` | Avoid internal-count assertions | Keep failed terminal state and absent original/findings, and replace terminal_count with the literal saved failure record. |

(29 rows extracted from the report's per-file tables.)

## 2. Eight behaviours that lost their only (weak) test

The deleted test never proved these; a real one is owed if the promise matters.

- An identical concurrent usage observation leaves one saved observation with the winning usage (`observation_conditional_winner_ac83`) - assert literal winning records, not a count.
- An identical concurrent return keeps the winning original and closure (`accept_identical_winner_ac50`) - add a real identical-winner case asserting saved identity and content.
- An unsuccessful admission commit cannot produce a success acknowledgment (`gap151_commit_failure_exposes_no_response`) - use a real Storage write failure.
- Owed review is selected before another execution action (`gap151_public_execute_next_prefers_owed_review`) - constructed pending records and real selection.
- The execution handoff carries its captured gate and route into admission (`gap158_ac158_handoff_supplies_captured_resolution_to_admit`) - real admission, assert saved values. This is the gap-158 promise itself.
- The ordinary public admission branch selects a refreshed resolution (`gap158_ac153`, `gap158_ac157`) - real admission against controlled configuration inputs.
- The public execute wrapper forwards its request (`gap158_ac155`) - only if a meaningful exposed failure case exists.
- The execution-handoff command preserves its dispatch identity (`gap158_ac156`) - through a real operation if needed.

## 3. The same test registered into several binaries - DONE next

`#[path]` imports compile the same test source into several test targets: the
six `review/contract.rs` tests into phase9_contract, phase9_returns and
phase9_selection; the five `review/manifest.rs` tests into phase9_admission,
phase9_context, phase9_manifest and phase9_material; `review/material.rs` into
three. One test, run four times, on every suite run. Owner approved the fix
2026-09-09: keep one registration per source.

## 4. Four pre-phase-9 violations, left alone for now

Named in the retired rules doc (`998f2187:docs/rationale/acceptance-criteria.md`),
all from phases 6-7, all still present; owner deferred them 2026-09-09:
`src/execution/tests.rs::phase_six_core_acceptance_inventory_runs_registered_evidence`
(inventory), `src/execution_service_tests.rs::resident_selects_overlap_graph_durably_and_ignores_report_bodies`
(full workflow), `tests/phase7_guard.rs::bounded_scanner_recognizes_top_level_separators_paths_and_seven_options`
(through a spawned guard), `src/derivation_service_tests.rs::query_guards_reobserve_changes_denials_and_fresh_hit_without_write`
(event counts; rewrite).
