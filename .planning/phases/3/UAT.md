---
status: testing
phase: 3
fields_version: 1
started: 2026-09-06
updated: 2026-09-06
---

## Items

### 1. Cold start on a fresh tree
expected: With no prior state, starting the binary against a clean .planning/ boots without error, the first-touch import completes, and one recall query returns real data.
origin: smoke
status: skipped
source: model
reason: Not reachable from the binary. A cold start against a fresh .planning/ boots clean and completes the MCP handshake, but tools/list returns exactly one tool, cadence_version - no store, config, import or recall tool exists, so no request can touch first-touch import or a recall query. The tool surface is explicitly out of scope for this phase (CONTEXT: Out - the binary's own tool surface, phase 5). Evidence: printf initialize+tools/list | (cd fresh-tree && target/debug/cadence serve) -> tools:[cadence_version], and find on the tree afterwards shows only the empty .planning/ directory it was given.

### 2. Append then read returns append order, snapshot survives restart
expected: Appending an item and reading the store back returns it in append order; a rewritten snapshot is still there after the binary restarts.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: cargo test --workspace append_order_and_snapshot_survive_fresh_process -- --exact -> test result: ok. 1 passed; 0 failed (tests/store.rs)

### 3. A declined item never comes back from recall
expected: A recall query whose terms match a declined item's own text returns no hit for it.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: cargo test --workspace declined_identity_is_absent_from_all_recall_outputs_after_restart -- --exact -> ok. 1 passed; 0 failed (tests/store.rs). Also covered across a warm index and two process restarts by server::recall::tests::ac7_and_ac2_survive_real_import_warm_declines_and_two_process_restarts -> ok. 1 passed.

### 4. An outside edit is reported as a conflict, not repaired
expected: Editing the store outside the binary then issuing a mutating request produces a reported conflict, no write happens, and the file's bytes are unchanged.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: cargo test --workspace external_changes_are_refused_without_touching_any_store_target -- --exact -> ok. 1 passed; 0 failed (tests/store.rs). Name asserts all three clauses: refusal, and no store target touched.

### 5. A kill mid-write leaves whole old or whole new bytes
expected: Killing the binary mid-write leaves the target file holding either the complete old value or the complete new value, never a partial one.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: cargo test --workspace process_kill_replacements_leave_complete_old_or_new_bytes -- --exact -> ok. 1 passed; 0 failed (tests/store_crash.rs), which spawns a real child and kills it (crash_child driver).

### 6. Import of a v3.7.12 tree keeps the originals and names the dead keys
expected: Run against a pre-4.0 .planning/ taken from the v3.7.12 tag: a store appears with no hand edit, every original file is still present, and all eight dead config keys are named in a warning.
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: cargo test --workspace ac5_frozen_first_touch_creates_stores_names_retirements_and_preserves_every_original -> test import::tests::ac5_... ok. 1 passed; 0 failed. Runs against a tree extracted from the v3.7.12 tag.

### 7. Config is re-read before each mutating request, and fails closed
expected: Changing a config file between two mutating requests makes the second run under the new value; making a config file unreadable makes the mutating request fail rather than proceed on the cached value.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: Three config tests, each ok. 1 passed: config::tests::reload_reads_bytes_despite_unchanged_size_time_and_rename (re-reads bytes, not stat), config::tests::writer_rechecks_each_layer_and_recovers_from_admission_refusal (revalidate before commit), config::tests::failed_io_invalidates_generation_and_never_uses_cached_permission (fails closed, no cached permission).

### 8. One recall query spans a record and a markdown document
expected: A single recall query returns hits from both a structured record and an authored markdown document.
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: cargo test --workspace ac7_and_ac2_survive_real_import_warm_declines_and_two_process_restarts -> test server::recall::tests::ac7_and_ac2_... ok. 1 passed; 0 failed; finished in 6.96s.

### 9. The ack waits for both fsyncs
expected: A syscall trace of one acknowledged write shows fsync on the temp file and fsync on the containing directory, both before the reply; removing either fsync makes the check fail.
criterion: AC8
status: pass
first_pass: pass
source: model
evidence: cargo test --workspace ac8_syscall_order -- --exact -> ok. 1 passed (tests/store_crash.rs). strace 7.0 IS installed (/usr/bin/strace), so the CONTEXT-time (human-verify: needs strace) tag no longer holds - its own text says the gap is the binary, not the policy, and ptrace_scope is still 1. Read the test: it shells out to real strace (:492,:505), asserts fsync(tmp) completes after the write and before the rename (:457,:470) and fsync(dir) between rename and the pre-send point (:481), and panics BLOCKED AC8 rather than skipping when strace is absent (:490,:496,:499). Negative control is separate and passes: either_sync_failure_prevents_success injects a failure at Stage::TemporarySync and Stage::DirectorySync in turn (tests/store.rs:121-127) -> ok. 1 passed.

### 10. The store directory holds no lock primitive
expected: crates/cadence/src/store/ contains zero lock primitives - the scoped form of the no-lock decision that PLAN-3 stopped on.
status: pass
first_pass: pass
source: model
evidence: grep -rnE "\b(Mutex|RwLock|Semaphore|OnceLock|lock\(\)|read\(\)\.await|write\(\)\.await|parking_lot)" crates/cadence/src/store/ -> NO MATCHES. The scoped no-lock decision holds exactly where fb0146c3 scoped it.

### 11. cadence-core/ is untouched
expected: cadence-core/ is byte-identical to the v3.7.12 tag - the phase's stated scope boundary.
status: pass
first_pass: pass
source: model
evidence: git diff --name-only v3.7.12 HEAD -- cadence-core/ -> 0 files. git status --porcelain cadence-core/ -> 0 lines. Tag v3.7.12 resolves to c39bbd8c.

## Summary

total: 11
passed: 10
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 0
