---
status: testing
phase: 5
fields_version: 1
started: 2026-09-07
updated: 2026-09-07
---

## Items

### 1. Reachability from a skill
expected: A command skill can reach the evidence records, next-action selection and pause through the binary's external interface.
origin: smoke
status: skipped
source: model
reason: Not reachable, by design and by scope. `tools/list` still declares exactly one tool, `cadence_version`, and the phase's own acceptance inventory asserts that it stays that way (`next_action_service_tests.rs:1521`). Every criterion below is therefore proven in-process. Phase 6 owns the typed boundary; until it lands, no skill can invoke any of this. Same skip, same reason, as phase 4 item 1.

### 2. A killed checkpoint reads back with no conversation
expected: Kill the process while stopped at a checkpoint. A fresh process reads the checkpoint type, the current task's number and name, and the byte-exact Need from disk.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: `evidence_service_tests::ac1_checkpoint_survives_real_kill_and_address_only_fresh_reader` - 1 passed, 0 failed. The kill is real, not simulated: the helper at `:880` spawns an actual child process via `ProcessCommand::new(std::env::current_exe())`, calls `child.kill()` at `:913`, and asserts `status.signal() == Some(libc::SIGKILL)` at `:918` before the fresh reader opens the store. A test that merely dropped a handle would not satisfy this criterion; this one kills.

### 3. Checker disposition and revision budget survive restart
expected: A recorded checker result reads back with its pass/fail disposition, distinguishes blocker from warning from an unusable return, and states whether the one permitted revision is spent.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: `evidence_service_tests::ac2_ac3_checker_and_gate_facts_survive_process_death` - 1 passed, 0 failed. Named by the phase's acceptance inventory as AC2's evidence.

### 4. Gate answers, and unanswered gates, survive restart
expected: An operator's answer at a gate reads back with its question and its disposition. A gate nobody answered still reads as unanswered.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: `evidence_service_tests::ac2_ac3_checker_and_gate_facts_survive_process_death` - 1 passed, 0 failed. Shares a test with AC2 because both are the same restart-readback property over different fact types; the unanswered case is the negative half.

### 5. One override contract, four forms, expiring with its occurrence
expected: Rerun, checker bypass, paused Next and review overrides share one record contract, each carries a reason, each survives restart, review range receipts and authorization identity are preserved, and permission stops once the named occurrence is fulfilled or superseded while history remains.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: 2 tests, both passing: `evidence_service_tests::four_overrides_share_submission_and_durable_readback` and `evidence_service_tests::occurrence_permission_survives_restart_and_ends_only_by_scoped_transition`. The second is the one that matters - it asserts the permission ENDS, which is the half a permissive implementation would drop.

### 6. The nine frozen answers, checked against the frozen source
expected: Next-action selection returns the frozen table's answer for each of the nine rules' winning conditions and all eight adjacent-rule precedence pairs, with expected answers taken from the frozen workflow rather than from the selector under test.
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: `next_action_service_tests::fresh_children_prove_all_winning_rules_and_adjacent_pairs` - 1 passed, 0 failed. Anti-circularity checked by hand rather than assumed: the expectation table at `next_action_service_tests.rs:627-636` hardcodes nine authored answers, and I compared all nine against `cadence-core/workflows/progress.md:194-202` row by row. They match in content and order - paused cursor to the operator's raw sentence, lowest planned to `/cad-execute {N}`, executed-with-outstanding to `/cad-execute {N}`, lowest executed to `/cad-verify {N}`, unplanned to `/cad-context {N}`, deferred non-zero to triage, `phase-dir` drift to `/cad-milestone`, `cycle` none to `/cad-phase add`, `current` null to `/cad-milestone`. The selector never supplies its own expectations.

### 7. Guarded pause, WIP, resume record, and restart
expected: Pausing a dirty tree makes a WIP commit subject to the git guards, commits the resume record, and leaves the tree clean; a matching phase resumes on the operator's exact sentence, including one that is not a recognized command.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: 5 tests, all passing: `pause_service_tests::pause_wip_preserves_exact_bytes_deletion_and_rename`, `pause_commits_exact_resume_record_for_dirty_and_clean_starts`, `pause_record_risk_identity_ignores_changed_binary_receipt_bytes`, `pause_survives_process_loss_at_each_real_commit_boundary`, and `next_action_service_tests::committed_pause_is_selected_exactly_and_requires_scoped_acceptance`. The third is D-14's regression test. The fourth kills a real child at each of three commit boundaries and proves retry creates no duplicate commits.

### 8. Acceptance needs evidence, and a bare result is refused
expected: An accepted contracted result carries a commit SHA, a `file:line` or a criterion ID. One carrying none is refused.
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: 2 tests, both passing: `evidence_service_tests::accepted_results_require_real_references_and_preserve_checker_outcomes` and `ac7_no_reference_refuses_before_native_state_or_history_write`. The second pins the refusal to BEFORE any state or history write, which is the failure mode where a refusal still leaves a trace behind.

### 9. The acceptance inventory proves presence, not passing
expected: Task 8's seven-row inventory is a real check, and its limits are stated rather than assumed.
status: pass
first_pass: pass
source: model
evidence: `next_action_service_tests::phase_five_acceptance_inventory_names_executable_obligations` - 1 passed. Read the source at `:1436-1520`: it asserts each named test EXISTS as `#[test]\nfn <name>()` source text, and that the MCP surface assertion remains executable. It does not run them. So the inventory guards against a criterion silently losing its evidence, and nothing more. This UAT executed all twelve named tests individually - 12 passed, 0 failed - which is the check the inventory cannot make.

### 10. The store still holds no lock primitive
expected: `crates/cadence/src/store/` contains zero lock primitives, even though this phase wrote heavily through the store.
status: pass
first_pass: pass
source: model
evidence: `grep -rn "Mutex|RwLock|OnceLock|LazyLock|flock|\.lock()" crates/cadence/src/store/` returns no matches. The single-consumer writer is still the mutual exclusion, as the standing design constraint requires.

### 11. cadence-core/ is untouched
expected: `cadence-core/` is byte-identical to the `v3.7.12` tag.
status: pass
first_pass: pass
source: model
evidence: `git diff --exit-code v3.7.12 -- cadence-core/` exits 0 with no output.

## Summary

total: 11
passed: 10
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 0
