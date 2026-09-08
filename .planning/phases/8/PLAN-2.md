---
phase: 8
plan: 2
requirements:
  - AC1
  - AC2
  - AC3
  - AC7
files:
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/config/write.rs
  - crates/cadence/src/store/filesystem.rs
  - crates/cadence/src/import/tests.rs
  - crates/cadence/tests/phase8_config.rs
  - crates/cadence/src/store/mod.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/phase8_global.rs
  - crates/cadence/src/config_service.rs
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check"
  tasks:
    - id: P8-2-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence"
    - id: P8-2-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_global"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
    - id: P8-2-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence"
---

# Phase 8: Global lifecycle preserves accepted settings - Plan 2

## Goal

A first global save succeeds and other projects reuse its active settings without losing accepted changes. This plan alone proves missing-parent initialization, shared-destination serialization and durable disclosure of original retired stakes values.

## Must be true when done

- AC3/D-52: A missing planning root and global parent support the first global save without a copied template or unchosen repo defaults.
- AC3/D-52: A new project reuses a valid active global file byte-for-byte, including when the legacy global file still coexists; foreign partial repo outputs continue to refuse.
- AC2: Two independent project stores cannot silently overwrite each other's accepted global updates, including interrupted installation and recovery.
- AC7/D-48: Original stakes values, including arbitrary JSON, remain visible with their original layer/path after import, unrelated snapshot work, interview writes and reopen.
- AC1/D-49: Aliases still collapse toward repo, requested write scope still controls permission, and original legacy bytes remain unchanged.

## Context

D-48, D-49, D-50 and D-52 bind this plan. Reuse first_touch, prepare_import, ImportManifest, SourceEvidence, ConfigWriter and the store's acquire/intent protocol. The owner explicitly asked for a deliberate global-race decision; this plan closes it within phase 8. No stakes expansion or migration state is introduced.

## Tasks

### Task 1: Complete the global config lifecycle (P8-2-T1)

- **Files:** `crates/cadence/src/import/mod.rs` (SessionFactory::first_touch / prepare_import / ImportManifest), `crates/cadence/src/config/write.rs` (active_paths / register / ConfigWriter), `crates/cadence/src/store/filesystem.rs` (Filesystem::new / with_participant), `crates/cadence/src/import/tests.rs` (first_touch_distinguishes_optional_absence_unreadability_malformed_config_and_foreign_outputs), `crates/cadence/tests/phase8_config.rs` (public config fixtures from Plan 1)
- **Action:** Finish D-52 using native first touch. Create a legitimately missing global parent with durable directory synchronization and safe identity checks, and register its active destination with the actual resident store before it is needed. An already-open session that first saw a missing global parent must be able to save its first global batch; registering only the ConfigWriter's short-lived observation adapter is insufficient. Do not create a global config populated with defaults or copy any template. Parent creation is infrastructure, not an answered interview; a repo-only operation must not acquire global pins.

  Distinguish an existing valid active global input from unowned partial repo outputs in both first_touch's output scan and the import transaction builder. Reuse it without a replacement participant or a claim that this project created it. When active config.v4.json and legacy config.json coexist globally, consume current active global settings as controlling input; preserve the legacy original as non-effective source evidence and never reproject it over newer choices. Keep original-input guards separate from active shared-input observations so later valid global edits are reload inputs, not changed legacy-source errors. At import admission, revalidate the captured active shared input under production ownership; original-source guards alone cannot protect a reused active-global policy decision. Handle missing, malformed, unreadable and aliased addresses deliberately without loosening repo partial-output refusal. Preserve exact active-global and legacy bytes, source scope and existing import replay identity. Update only the lifecycle assumptions in the leased import fixtures.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Fixtures save all thirteen first-run answers with both parents initially missing, continue through the same resident, reopen, then initialize a second project without changing active-global bytes. Repeat with both active and conflicting legacy global values; current active roles win while legacy evidence remains exact. Missing-parent repo-only use writes no global config/defaults. Malformed/unreadable active global, foreign repo state/config outputs and unsafe identity changes refuse. Alias and legacy-preservation regressions remain green.

### Task 2: Serialize the shared global destination (P8-2-T2)

- **Files:** `crates/cadence/src/store/mod.rs` (Storage::acquire ownership contract), `crates/cadence/src/store/filesystem.rs` (Filesystem::acquire / registered participants / identity checks), `crates/cadence/src/store/writer.rs` (Writer::open / execute / persist), `crates/cadence/src/store/transaction.rs` (validate_all / commit / recover), `crates/cadence/src/config/write.rs` (register / ConfigWriter batch preparation), `crates/cadence/src/import/mod.rs` (first_touch / registered active inputs), `crates/cadence/tests/phase8_global.rs` (new multiprocess integration target)
- **Action:** Close the cross-project race: root-scoped flock alone is insufficient. Extend cooperating ownership to the stable resolved parent-directory inode of each registered shared config destination, including a destination that is repo-config in an alias-collapsed session but global-config in another project. Acquire the complete ownership set in a deterministic total order, deduplicate equal inodes, retain root ownership and revalidate every bound path after acquisition; do not lock the replaceable config-file inode or create a removable lockfile that splits ownership after rename. Use the existing filesystem adapter and libc dependency. Holding an idle resident open must not retain these locks.

  The shared ownership must cover final expected-input validation, durable intent installation, every semantic replacement, confirmation and intent removal; Writer::open and every recovery path acquire it before recovery observation or replacement as well. Inputs prepared before ownership must be rechecked under it. If another accepted writer changed a stale batch's base bytes, refuse the stale batch and require a fresh read; do not silently merge guessed intent or overwrite unrelated keys. Freshly prepared disjoint updates after retry preserve both acknowledged choices.

  Preserve recover-forward semantics and foreign-participant refusals. After a crash, another project may have accepted a newer shared value: the old store's recovery must compare its persisted participant observations under common ownership and refuse incompatible bytes before changing any participant, never overwrite the newer accepted value. Reopen must clearly distinguish that conflict from successful recovery. No cross-project operation may recover a different project's private store or trust paths named by an unvalidated intent. Task 1's concurrent first touches and imports must use the same ownership domain for any global creation. Extend the injectable filesystem stage boundary if necessary to deterministically pause immediately after the final check and before global rename; the fixture must drive production ownership, not simulate a lock around the test driver.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_global`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` — The new target starts two real processes with different already-open planning roots sharing one global destination. Pause B after validation immediately before replacement, start A, and assert that production ownership prevents the losing interleaving; the stale writer refuses and a reread/retry retains both accepted keys. Repeat simultaneous first global creation, alias-collapsed versus distinct-root addressing, reversed lock order, and a resident idle after success. Kill owners before and after global replacement and during recovery. A replacement either completes the exact pending transaction once or refuses a foreign accepted value with all pre-recovery participant bytes unchanged. B's acknowledged value can never be erased by A's stale recovery, and no process deadlocks or claims confirmation before release/confirmation completes.

### Task 3: Retain the original retired-level evidence (P8-2-T3)

- **Files:** `crates/cadence/src/import/mod.rs` (SourceEvidence / ImportManifest / Session::request / commit_derivation), `crates/cadence/src/import/tests.rs` (derivation_snapshot_preserves_full_data_and_restart_manifest / aliased_legacy_sources_keep_one_import_destination_and_global_request_scope), `crates/cadence/src/config_service.rs` (config facts from Plan 1), `crates/cadence/tests/phase8_config.rs` (retirement disclosure fixtures)
- **Action:** Complete REMOVE as disclosure only. Derive each original stakes value from current raw layer evidence and preserved import source bytes, retaining exact JSON type/value plus original source layer and path. Identify layers from preserved import source identity rather than today's global address; a collapsed single source is shown once with repo provenance and its global alias explained, without inventing a second original. A string, unknown string, object, number, null or array is displayed as its actual JSON value, never coercion such as [object Object]. State plainly that the level is retired and that ordinary role questions use current settings; never expand the old value into choices or promise equivalent spending.

  Preserve source_evidence through every exposed Session snapshot replacement, including RewriteSnapshot and Transact(snapshot), while keeping existing import ownership, cursor, archive and unrelated namespaces intact. Use the existing conditional writer protocol so reading evidence then replacing a stale view cannot erase intervening work. Keep commit_derivation's preservation check and all dedicated evidence/execution/rail mutations intact. Read any already-existing wrapped snapshot evidence without destructively normalizing historical records. If an older snapshot has already lost evidence, report unavailable evidence honestly; do not invent its former value from current settings or read changed legacy bytes as the preserved original. The service can return the same static retirement fact on ordinary reads, but it creates no workflow cycle, accepted/dismissed record or migration state. Original source files are never edited.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Distinct global/repo originals, an unrecognized object-valued stakes and an aliased source all disclose exact values and source identities after real snapshot-changing operations before the first interview. Exercise RewriteSnapshot, a transaction with snapshot data, derivation/evidence changes and dispatch/patch work, then a config batch and process replacement. Compare original file bytes and retained evidence bytes before/after; there is no expansion or durable migration state. A concurrent stale snapshot rewrite refuses, and missing historical evidence is explicitly unavailable rather than reconstructed.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-52 / AC3 | P8-2-T1, P8-2-T2 |
| D-49 / AC1 | P8-2-T1, P8-2-T2, P8-2-T3 |
| D-50 / AC2; owner-requested race closure | P8-2-T2 |
| D-48 / AC7 | P8-2-T3; ordinary interview connection in Plan 3 |

## Notes

Run after Plan 1 and before Plan 3. Actual overlapping leases include import/mod.rs, config/write.rs, config_service.rs and phase8_config.rs; these are sequential plans. Phase 7's root ownership is a dependency, not a mechanism to rebuild.

The deliberate race decision is CLOSE HERE. D-52 makes multiple projects share the file and D-46 claims saved choices affect dispatch, so silently losing an accepted choice would undermine the shipped outcome. The owner explicitly authorized choosing whether to close this otherwise-unassigned work. This is common ownership for cooperating Cadence writers, not a promise of atomic compare-and-swap against arbitrary external editors. Existing byte/identity observations still reject detected external changes. A stale interrupted transaction conflicting with a newer accepted global edit refuses recovery; it never rolls back or overwrites that edit. Such an unacknowledged transaction may require operator recovery, which is reported as a conflict rather than accepted success.

Use existing dependencies. Keep all new multiprocess and recovery fixtures within phase8_global.rs, with mutable paths in temporary directories; no checked-in fixture directories, lockfile changes or separate test helper edits are needed. Directory creation is outside the semantic config batch but cannot be reported as a saved answer. Do not weaken byte-exact refusal assertions into a universal rollback promise after durable intent installation.
