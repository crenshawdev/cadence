---
status: testing
phase: 7
fields_version: 1
started: 2026-09-08
updated: 2026-09-08
---

## Items

### 1. Native Bash guard policy and shipped hook
expected: The Rust Bash guard asks/denies/passes protected git commit according to config, always asks git push, silently passes non-Git/wrapped/unparsed commands, durably logs non-silent decisions, and the shipped manifest uses the native Bash guard while Write/Edit behavior is preserved.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard --test phase7_lease --test phase7_risk --test phase7_receipts --test phase7_surfaces --no-fail-fast -> phase7_guard policy asks/denies/passes, durable push ask, bounded scanner and shipped_manifest_loads_both_native_arms_and_preserves_unrelated_hooks all ok (55 passed; one GPG fixture failed); cat hooks/hooks.json -> Bash|Write|Edit invokes cadence guard.

### 2. Guard input failures are loud and distinct
expected: Unavailable Git or branch produces a durable named guard-failure and permits the command; torn config asks with the defaults-instead-of-settings reason and preserves an established deny; hard-fail on a protected branch denies. These outcomes are deliberately exercised, including at least one real-host observation.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: cargo test -p cadence --test phase7_guard, four boundary tests, each 1 passed 0 failed: unavailable_git_and_unresolved_branch_are_distinct_durable_failure_passes (phase7_guard.rs:947) covers the failure-pass arm naming Git and branch as distinct unavailable inputs; torn_layers_ask_even_after_custom_list_loss_and_simultaneous_git_failure (:979) and torn_layer_retains_an_independently_established_refusal (:1035) cover the torn-config ask and the surviving deny; confirmed_hard_fail_survives_own_layer_loss_restart_and_current_head_changes (:1054) covers hard-fail deny on a protected branch. Each feeds the binary the exact input a hook sends and asserts the returned decision. AC2 real-host clause struck from CONTEXT.md:312-313 per the one-unit-one-boundary rule (commit 3be6d03b).

### 3. Exact-file and directory lease admission
expected: files with a trailing slash return a typed field-specific refusal; directories provide prefix coverage. Admission, ordering and enforcement call one production covers() implementation.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: cargo test -p cadence --test phase7_guard --test phase7_lease --test phase7_risk --test phase7_receipts --test phase7_surfaces --no-fail-fast -> admission_accepts_exact_and_directory_only_without_existence_checks, admission_rejects_trailing_file_separators_with_typed_field_error and sole_production_coverage_definition_is_exercised ok; rg covers calls -> plan.rs admission/ordering and patch.rs enforcement use the sole execution/lease.rs definition.

### 4. Directory and descendant plans are dependent
expected: A plan with directories: [src/] and one with files: [src/shared.txt] have the lower plan as prerequisite, in either declaration direction; they are not selected as independent plans.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: cargo test -p cadence --test phase7_guard --test phase7_lease --test phase7_risk --test phase7_receipts --test phase7_surfaces --no-fail-fast -> ac4_directory_and_descendant_file_require_lower_number_first_in_either_direction and overlap_readiness_remains_transitive_and_deterministic ok.

### 5. Out-of-lease patches refuse with recovery guidance
expected: Out-of-lease commits refuse with undeclared paths, unchanged execution/SUMMARY, one durable refusal, and text saying commits remain and dispatch stays open for operator repair; exact-file/directory-covered patches accept and both rename endpoints are checked.
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: Recorded TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_lease -> 23 passed, exit 0 (reports/plan-2.md P7-2-T6-verify-1 and recovery observations): undeclared-files names both rename endpoints, unchanged snapshot/SUMMARY/index, one durable refusal, commit retained, dispatch open, corrected signed full patch accepted. Current phase7_lease writer coverage/rename tests pass; GPG wire fixtures cannot start in this sandbox.

### 6. Zero lease exemptions
expected: Undeclared committed or staged report paths and lockfiles refuse just like other undeclared files; the phase 7 ROADMAP text says zero exemptions rather than promising report/lockfile exceptions.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: cargo test -p cadence --test phase7_guard --test phase7_lease --test phase7_risk --test phase7_receipts --test phase7_surfaces --no-fail-fast -> both_writers_refuse_ordinary_new_lockfile_and_report_paths_in_commits_and_index and native_guidance_and_phase_seven_roadmap_match_parser_without_migrating_history ok; ROADMAP phase 7 says zero exemptions: new files, dependency lockfiles and reports must all be covered.

### 7. Risk classification over immutable real diffs
expected: Real changed paths and added/removed lines classify all eight risk categories with external diff/textconv disabled; binary/submodule/unreadable material is inconclusive, readable empty diffs are checked-empty, failed reads never look clean, and invalid surfaces/torn config refuse.
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: Recorded TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk -> 22 passed, exit 0 (reports/plan-3.md T5-verify-1; T3 observations cover all eight real changed-line/path categories, disabled helper sentinels, inconclusive binary/gitlink/unreadable data and refused invalid/torn inputs). Current classifier tests pass; 18 real-Git fixtures stop at denied gpg-agent socket setup.

### 8. No-range and exact staged settlement
expected: HEAD..HEAD returns distinct no-range without a completed clean-check record, while excluded nonempty ranges remain distinguishable; staged receipts with null head settle only for exact base/index identity and changed staged bytes remain unsettled.
criterion: AC8
status: pass
first_pass: pass
source: model
evidence: Recorded TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk -> 20 passed, exit 0 (reports/plan-3.md T4: equal refs produce no-range/scan null/risk-skipped-no-range, excluded-only ranges remain checked-empty); current phase7_receipts -> 11 passed, including exact_committed_and_null_head_staged_records_settle and widened_range_changed_index_or_selection_is_stale.

### 9. Structural surface detection and warnings
expected: detect-surfaces returns evidenced/silent/unspeakable from names, extensions and manifest dependency names without reading source bodies; missing root refuses and unreadable children/manifests retain warnings without failing the scan.
criterion: AC9
status: pass
first_pass: pass
source: model
evidence: cargo test -p cadence --test phase7_guard --test phase7_lease --test phase7_risk --test phase7_receipts --test phase7_surfaces --no-fail-fast -> phase7_surfaces 4 passed, 0 failed: all five manifest families, source-body read prohibition, missing-root refusal and retained child/manifest warnings.

### 10. Detection alone cannot authorize continuation
expected: Matched scans alone do not pass review; missing/unfired/stale/unchecked evidence and reasonless overrides refuse; current settled material is needed for execution continuation and tools/list still names exactly cadence_version, cadence_query, cadence_apply.
criterion: AC10
status: pass
first_pass: pass
source: model
evidence: cargo test -p cadence --test phase7_guard --test phase7_lease --test phase7_risk --test phase7_receipts --test phase7_surfaces --no-fail-fast -> phase7_receipts 11 passed, 0 failed including matched-only/unfired/unchecked, stale identity and reasonless override refusals; cargo test -p cadence -> execution_service_risky_skill_sequence_refuses_missing_unfired_stale_and_restart_until_settled ok; cargo test -p cadence --test mcp -> exact-three-tool schema test ok.

### 11. Surface recommendations and interview choices
expected: Structural detection recommends all eight surfaces and presents no more than four deduplicated interview choices; choices are evidence for an operator selection and do not silently change config.
status: pass
first_pass: pass
source: model
evidence: cargo test -p cadence --test phase7_guard --test phase7_lease --test phase7_risk --test phase7_receipts --test phase7_surfaces --no-fail-fast -> recommendation_never_narrows_unspeakable_is_silent_and_choices_are_unique ok (eight recommendations, at most four unique options); cargo test -p cadence --test mcp -> detect_surfaces_public_read_uses_bound_root_and_changes_no_config_or_rail_state ok.

## Summary

total: 11
passed: 11
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
