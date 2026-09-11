---
phase: 3
plan: 1
requirements:
  - AC1
  - AC2
  - AC3
  - AC4
  - AC8
files:
  - crates/cadence/Cargo.toml
  - Cargo.lock
  - crates/cadence/src/lib.rs
  - crates/cadence/src/store/mod.rs
  - crates/cadence/src/store/model.rs
  - crates/cadence/src/store/items.rs
  - crates/cadence/src/store/decisions.rs
  - crates/cadence/src/store/filesystem.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/store.rs
  - crates/cadence/tests/store_crash.rs
  - docs/architecture/store.md
---

# Phase 3: The store and its queries - Plan 1

## Goal

The basic data functions live in the binary: one item store, one decisions log, and one state snapshot replace the operational record files. Their owner confirms persistence before answering, detects external edits, and prevents declined items from entering recall.

## Must be true when done

- AC1: Items read back in append order; a rewritten snapshot survives a process restart.
- AC2: A matching recall query over the store cannot return a declined item or its earlier captured/filed revision.
- AC3: An external edit followed by a mutating request reports a conflict and leaves the edited bytes unchanged.
- AC4: Killing the writer during replacement leaves each target at its complete old or complete new value. This is a Rust regression guard: frozen `v3.7.12` already provides process-kill atomicity through rename.
- AC8: A write's success acknowledgement follows successful `fsync` of its temporary file before rename and of its containing directory after rename; syscall ordering, not process termination, verifies this durability protocol.
- A caller receives completion for its own request only after disk confirmation; another caller's success cannot stand in for it.
- An interrupted operation spanning files resumes deterministically before another operation observes the store.

## Context

D-01 and D-05 bind this plan; D-02 requires an obligatory precommit policy seam for PLAN-2.
Follow the settled synchronous pure core, I/O trait boundary, and single writer task; no lock primitive or Tokio type enters domain logic.
Use the existing storage inventory as scope: only the three operational stores move here; phase derivation, dispatch, public tools, and skill changes belong to later phases.
All frozen citations below mean `git show v3.7.12:<path>`; no file under `cadence-core/` is a write lease.

## Tasks

### Task 1: Define the store's pure record contract

- **Files:** crates/cadence/Cargo.toml, Cargo.lock, crates/cadence/src/lib.rs, crates/cadence/src/store/mod.rs, crates/cadence/src/store/model.rs
- **Action:** Add a library target alongside the existing binary and define synchronous parsing, validation, state transitions, and rendering for versioned item records, decision records, and the snapshot. Choose `.planning/items.jsonl`, `.planning/decisions.jsonl`, and `.planning/state.json` as the permanent record paths. Give records stable identities, ordered revisions, origin information, and explicit distinctions between captured, filed, declined, completion, and uncertain filing; do not identify unrelated captures by equal prose. Define the I/O boundary and an obligatory policy-validation boundary using synchronous domain inputs/results. Callers must supply policy validation before a mutation can commit; absence is not permission. The snapshot must hold enough version/generation and integrity information to validate the three files after restart, including its own content. Keep runtime/channel types in the adapter. Declare Tokio's channel feature directly, add the content-digest dependency and test-only temporary-directory support, and update the lockfile; subsequent plans must use these dependencies without editing the manifests. This is a new Rust representation, not a translation of JavaScript signatures.
- **Verify:** `cargo test -p cadence --lib` exercises plain in-memory inputs without filesystem fixtures or a runtime: records and snapshots round-trip; malformed versions and inconsistent revisions are rejected; absence, explicit null, and unknown preserved source text remain distinguishable. Inspect the domain files to confirm their inputs do not require Tokio, filesystem access, environment access, a clock, or a lock.

### Task 2: Land the durable writer tracer

- **Files:** crates/cadence/src/store/mod.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/writer.rs, crates/cadence/tests/store.rs
- **Action:** Wire the pure model through a real filesystem adapter to one resource-owning writer task, with a request queue and a separate completion channel per request. Use a dedicated blocking execution context for filesystem work; callers await their own completion. Provide internal append, snapshot replacement, and ordered read operations, with injectable policy validation and I/O for testing. Implement semantic append by durable whole-file replacement: exclusively create a sibling temporary file, write all bytes, successfully `fsync` that file, rename it over the target on the same filesystem, successfully `fsync` the containing directory, and confirm the installed bytes before sending the request's success reply. Rename provides process-kill atomicity (AC4); both `fsync` calls before the completion-channel send provide the durability protocol (AC8). A failure at either synchronization stage must prevent a success acknowledgement; reading back cached bytes is not a substitute for either `fsync`. Distinguish initialization on absence from an unreadable existing file. Handle canceled callers without canceling an already admitted durable operation; a lost reply is not a successful acknowledgement. Build a subprocess test driver around this production service, not a second storage implementation or a public MCP tool. This makes the complete request-to-disk-to-reply spine runnable by this task.
- **Verify:** `cargo test -p cadence --test store` sends two appends and a snapshot rewrite through the real writer, exits its child process, opens the same temporary store in a fresh child, and observes the original append order and exact replacement snapshot (AC1). A controllable adapter holds disk confirmation: the caller must remain pending until released. Independently inject temporary-file and containing-directory `fsync` failures and verify neither permits a success reply; concurrently queued callers receive their own distinct outcomes. Task 8 verifies actual syscall ordering for AC8.

### Task 3: Enforce item lifecycle visibility

- **Files:** crates/cadence/src/store/mod.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/items.rs, crates/cadence/tests/store.rs
- **Action:** Implement identity-preserving item revisions and the single recall-eligible store projection. Exclude declined identities before matching, scoring, counting, truncating, or rendering; the exclusion covers earlier revisions too. Preserve captured text, kind, completion, filing pointers and uncertainty, and the reasoning on a decline. Keep an explicit non-recall lookup for declined records so exclusion does not delete their dedup/evidence value. A completed capture is not automatically a decline. Preserve uncertain filing independently of disposition: frozen `markUnconfirmed` changes a held confirmed row only when an incoming uncertain result requires it (`cadence-core/bin/issue-filing.mjs:448`, `:535`), and the shared row parser retains the uncertainty marker (`cadence-core/bin/lib/planning-files.mjs:1357`). Do not infer an immutable filed row from the file's name. Supply the filtered projection as the only item input accepted by the later recall adapter.
- **Verify:** `cargo test -p cadence --test store` captures an item containing a unique term, queries that term through the store's recall projection, declines the identity, and repeats the same query before and after restart: no hit, snippet, total, or older revision contains that item (AC2). Explicit declined lookup still returns the reason. Two separate captures with identical text remain separate; a filing uncertainty update preserves identity. The latter fixture models the guarded update at frozen `cadence-core/bin/issue-filing.mjs:535-540`, not an unconditional write by every filing request.

### Task 4: Persist decisions without reconstructing an activity feed

- **Files:** crates/cadence/src/store/mod.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/decisions.rs, crates/cadence/tests/store.rs
- **Action:** Add durable decision append/read through the same writer: routing choices with their deciding config provenance, gate outcomes, and refusals are the admitted record classes. Keep read activity, token/cache counters, worker start/stop brackets, and rotation bookkeeping outside the new decisions log. Accept decision inputs from later phases without implementing their routing or gate algorithms here. Preserve unknown/missing evidence rather than manufacturing a decision. Resolve GH-241 here at the record boundary: an observed effort string with only whitespace is missing, a nonblank unknown host spelling remains evidence, and requested effort is a separate concept. Apply the same normalization to historical observations during import without creating observation-only activity events. This intentionally strengthens the frozen truthiness checks at `cadence-core/bin/lib/trace.mjs:1752-1757`; their worker-observation branch also requires an agent identity at `:1778-1787`. Do not infer that all historical resolves had receipts: the frozen routing append is inside the non-null phase guard at `cadence-core/bin/route.mjs:1365-1385`.
- **Verify:** `cargo test -p cadence --lib` and `cargo test -p cadence --test store` prove ordered durable decision reads, rejection of activity-only inputs, preservation of config provenance, omission of blank observed effort, and retention of an unfamiliar nonblank host effort. Missing historical receipts remain missing; the frozen guarded producer at `cadence-core/bin/route.mjs:1365-1385` is not treated as evidence of universal logging. Store-integrity or policy failures report to the caller without attempting a refusal append into the store they could not safely mutate.

### Task 5: Refuse mutations against changed file identities

- **Files:** crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/writer.rs, crates/cadence/tests/store.rs
- **Action:** Compare the observed file identity and content generation with the last confirmed generation for every affected store file, including the containing path identity. Validate persistent integrity information on open, and revalidate at mutation admission and immediately before replacement. An in-place edit, replacement, deletion of a known file, symlink retarget, malformed record, or unreadable existing file must produce a reported conflict/read failure without adopting the external bytes as a new owned generation. Do not repair, overwrite, refresh away the conflict, write a refusal record, or start a journal after a failed preflight. Initialization is allowed only for genuinely absent, never-owned storage. If a request has already prepared temporary work when a second validation fails, keep semantic targets unchanged and discard only its own disposable preparation. Document the check/replace race limitation in Notes rather than claiming an OS compare-and-swap that does not exist.
- **Verify:** `cargo test -p cadence --test store` covers edits completed before the request, edits injected after preparation but before the final check, same-size edits with unchanged timestamps, rename replacement, symlink retarget, and an unreadable file. Each reports failure, acknowledges no mutation, and preserves the externally installed target bytes and the other store files (AC3). Reopening a manually corrupted generation also refuses. Do not substitute a timestamp-only test for content comparison.

### Task 6: Recover interrupted operations spanning files

- **Files:** crates/cadence/src/store/mod.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/writer.rs, crates/cadence/tests/store.rs, docs/architecture/store.md
- **Action:** Implement durable operation intent, preparation, and replay for changes involving more than one store target and for the config/import participants that PLAN-2 will supply. Use temporary sibling transaction artifacts carrying the intended complete values and expected generations; the steady-state semantic stores remain three plus the two config layers. Persist intent before the first target replacement, block reads of intermediate state, and send the success acknowledgement only after every participant and completion metadata are confirmed. Apply Task 2's successful temporary-file `fsync`, rename, then containing-directory `fsync` ordering to intent, participant, and completion-metadata replacements, including replay; synchronize directories after recovery-artifact removals required for completion. On restart, validate all participants before replay: a target already at the intended value needs no second semantic update, but its installed file and containing directory must be successfully `fsync`ed before recovery is acknowledged, since the interrupted write may have stopped after rename; an expected old target can advance; an unrelated external value is a conflict and must not be overwritten. No participant or metadata synchronization failure permits a success reply. Give imported operations deterministic replay identity so retry cannot duplicate records. Include external config directories in the participant protocol without pretending that rename across filesystems is atomic. Keep git operations and remote forges outside this local transaction. Record the format, runtime ownership, recovery ordering, and the callable seams consumed by the other two plans in the architecture document.
- **Verify:** `cargo test -p cadence --test store` interrupts an operation after each participant replacement, restarts the service, and gets one complete logical operation with no duplicate item or decision. A second restart is a no-op. A foreign edit to any pending participant causes conflict before replay changes any participant. A reader queued during the operation sees the pre-operation or post-recovery view, never a mixed view.

### Task 7: Guard against process-kill replacement regressions

- **Files:** crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/transaction.rs, crates/cadence/tests/store_crash.rs, docs/architecture/store.md
- **Action:** Add deterministic process barriers around production persistence stages and drive them from a parent test process. Kill the child during temporary-file writing, after temporary-file `fsync`, after rename but before containing-directory `fsync`, after containing-directory `fsync` but before the completion reply, and during transaction replay; use real process termination, not only returned I/O errors. Keep barriers test-only and outside the pure core. Cover both JSONL stores, the snapshot, and creation from absence. State the guarantee precisely: unacknowledged work may be old or new; acknowledged work must survive a normal process restart; multi-file recovery completes before queries resume. AC4 is a regression guard for the Rust replacement: frozen `atomicWrite` already writes then atomically renames at `cadence-core/bin/lib/planning-files.mjs:2787-2788`, and its comment at `:2747-2750` explicitly promises no torn file despite having no `fsync`. Process kill and machine crash are different failure models: a power loss can persist a rename without the file data, leaving a truncated file. Task 8 checks the new `fsync`-before-ack protocol by ordering.
- **Verify:** `cargo test -p cadence --test store_crash` compares whole target byte strings against recorded old/new candidates after every kill; any other byte string fails (AC4 regression guard). After recovery, acknowledged operations remain present and unacknowledged retries do not duplicate an operation. For initial creation, absence is the old state. This verifies process-kill safety already provided by the frozen helper; it neither simulates power failure nor proves AC8.

### Task 8: Verify synchronization precedes acknowledgement

- **Files:** crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/writer.rs, crates/cadence/tests/store_crash.rs, docs/architecture/store.md
- **Action:** Extend the existing subprocess driver with a Linux syscall-order fixture using the real writer and filesystem adapter. Trace the child and its threads with `strace -f -yy -o <trace>` into one output file, without status filtering; match descriptor paths and pair unfinished/resumed calls so successful completion, not entry alone, establishes ordering. Initialize the fixture before a request-specific start marker and admit exactly one measured write. Because a completion-channel send is an in-memory operation, place a test-only synchronous, unbuffered pipe `write` carrying the request ID immediately before the actual success send in the writer's common completion path. Keep the marker and send together so moving the acknowledgement earlier also moves the marker; require receipt of that request's actual success reply. A marker logged by the receiver would be too late and is not valid evidence. Add separate test-only omissions at the real adapter's temporary-file and directory `fsync` sites, retaining the same write/rename/reply path, to exercise negative controls without a second writer implementation. Keep the trace checker and hooks within these existing leases; this needs no public transport, crash simulator, or PLAN-2/PLAN-3 files. Document Linux `strace` and ptrace permission as verification prerequisites, with missing prerequisites reported as blocked verification, never a pass.
- **Verify:** `cargo test -p cadence --test store_crash ac8_syscall_order` traces one acknowledged write on Linux with `strace -f -yy`. Require successful temporary-file `fsync` completion before rename, successful rename before containing-directory `fsync`, and successful directory `fsync` completion before the writer's request-specific pre-send pipe marker; then require the matching success reply (AC8). Match the exact temporary file and containing directory within that request's trace interval; missing, failed, or reordered calls fail. Repeat with only the temporary-file `fsync` omitted, then only the directory `fsync` omitted: the same checker must reject each trace despite a success reply. Missing `strace`, denied tracing, or missing markers blocks verification and cannot count as passing AC8.

## Notes

- Requirements use acceptance criterion IDs because phase 3 has no seeded requirement IDs. AC1 maps to Tasks 1-2, AC2 to Task 3, AC3 to Task 5, AC4 to Tasks 2, 6-7 as a process-kill regression guard, and AC8 to Tasks 2, 6, 8 for synchronization before acknowledgement; Task 4 completes the decisions-log part of the phase goal.
- Execute this plan first. Its file leases are disjoint from PLAN-2 and PLAN-3. Codex execution is explicitly ordered by the dispatch; these are not three independent `/cad-execute` parallel slices. PLAN-2 provides the config/import factory, and PLAN-3 completes the resident handler composition without a new public tool surface.
- Planner choices: versioned JSONL revisions plus a JSON snapshot; semantic appends implemented by replacement; persisted integrity checks; temporary recovery artifacts; a dedicated writer execution context; process tests of the production internal service. Pure-core tests need no runtime. Public request names remain phase 5's work.
- Limits requiring visibility: ordinary filesystem revalidation cannot prevent an uncooperative writer from changing a target between the final check and replacement. D-01, if read as an absolute guarantee against that race or hostile rewriting of integrity metadata, is unsatisfiable under this file/ownership model. Multiple independent session processes targeting the same root have the same ownership gap; do not add a lock or silently claim cross-process serialization. AC3's completed-external-edit scenario is directly covered.
- The inventory's recommendation to use OS locks does not override CONTEXT's settled no-lock writer architecture. No analyzer, build, test suite, or commit is part of this planning run. Verify commands are executor instructions; `cargo`, `rustc`, and `git` were located while planning.
- Runtime reference checked with Context7: https://docs.rs/tokio/latest/tokio/sync/index.html describes an owning task with request and per-request reply channels; blocking filesystem work belongs outside asynchronous worker execution.
