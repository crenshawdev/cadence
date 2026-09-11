PLAN COMPLETE

# Phase 8 PLAN-2 run record

Outcome: complete. Completed tasks: P8-2-T1 through P8-2-T3.

Executed on 2026-09-08 under the owner's direct instructions, outside native
dispatch. No dispatch identity, trace event or live-host observation is invented.
Branch: `cadence/binary-owns-process`; initial HEAD
`560b9fd6b56ebbed9f9a3bed333027b378847b79`; initial tree clean.
Final implementation commit: `f0730f734126ef69b9cdb936dad03c17e42123e6`.
All three task commits have valid GPG signatures and name
John Crenshaw <john@jcrenshaw.dev> as both author and committer, using key
`693AB15F91734B0C`. No push. Each task's Verify rewrite is in its own commit.
The owner explicitly authorized this report and its separate signed commit.

| Task | Status | Commit | Verification |
| --- | --- | --- | --- |
| P8-2-T1 | completed | `74a0d7a834df578cc383240f641132e970134474` (signature G) | phase8_config: 6 passed; cadence binary: 169 passed after fixture compile repair |
| P8-2-T2 | completed | `d7348b8c955d80e9059ac0ff0d2f67ff8e48f958` (signature G) | phase8_global: 12 passed; phase8_config: 6 passed; phase7_guard: 69 passed after ownership-check repair |
| P8-2-T3 | completed | `f0730f734126ef69b9cdb936dad03c17e42123e6` (signature G) | phase8_config: 34 passed; cadence binary: 188 passed after provenance-scope and fixture repairs; final clippy passed without warnings |

## Required full suite

Not run. The owner's command limit overrides the historical workspace suite
and executor-contract suite requirement. PLAN-2's suite metadata now names only
`TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests`, run once after all
task tests and before the T3 commit. Neither `cargo test --workspace` nor
`cargo clippy --all-targets` was run. All named test commands ran one at a time,
in task order. A failed command was the only command rerun for its repair.

## Plan and implementation observations

- P8-2-T1 creates and syncs missing directory infrastructure and registers the
  global destination with the resident store. First touch treats a valid active
  global file as shared controlling input, preserves conflicting legacy bytes as
  evidence, and excludes the reused file from this project's created outputs.
  Captured shared observations are revalidated separately from original-source
  guards. Foreign repo outputs still refuse. Infrastructure creation saves no
  default config or interview answer.
- P8-2-T2 acquires root and registered config parent-directory inode ownership
  in a deterministic device/inode order, deduplicates shared identities and
  revalidates bound directory paths. Ownership spans final validation, intent
  installation, replacements, confirmation, removal and recovery, then releases
  before the resident becomes idle. The production ExternalChange guard refuses
  stale bytes/identity, including incompatible recovery bytes. Stale external
  input is rejected before intent installation without poisoning the resident;
  freshly supplied two-key bytes are accepted. New tests use directory
  descriptors and supplied filesystem observations, not two live writers.
- P8-2-T3 carries original source layer and alias identity with evidence, reads
  historical wrapped evidence, and exposes exact JSON stakes values through
  config facts with a static retirement explanation. Missing, damaged or
  unidentifiable historical evidence is explicitly unavailable. Generic snapshot
  payload replacements preserve existing namespaces and use the conditional
  writer protocol. Every intent kind validates immutable import/source evidence
  during commit and recovery; deliberate cursor updates retain their existing
  contract, and commit_derivation's stronger preservation checks remain intact.
  No original source file is edited and no migration state is introduced.
- AC1 was removed from Phase 8. Its stale PLAN-2 requirement and mapping were
  removed; D-49 remains a dependency. No other plan was changed or executed.
- The executor contract was applied with the owner's explicit overrides for
  Verify repairs, lease extensions, reporting, command limits and final output.
  No task was skipped. No extra agent or workflow was invoked.

## Verification receipts

Digests below are SHA-256 over the captured UTF-8 command output, including
failed attempts. Counts refer to each named target, not unique tests across
commands. Existing tests included by those targets also ran. The private intent
validator tests compile production store source within phase8_config, without
adding a public test API or a process sequence.

| Task / attempt | Exact command | Exit | Result | Output SHA-256 |
| --- | --- | --- | --- | --- |
| T1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config` | 0 | 6 passed | `91a76f558304d41d7a77f5cdd9caf31e2de93e077847b54f9bfe9ba3fd9f0027` |
| T1 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | 101 | compile failure; 0 tests run | `90bdda72fb6cdf92288ea09f61fe6866954b2562ef092359b9b9631d550239fb` |
| T1 retry | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | 0 | 169 passed | `076e4e5f37096278c075c870dbbd62e7580f8928d3e2f49d05eb4312b6b732a8` |
| T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_global` | 0 | 12 passed | `0f44fff49f296744c3e2bf3fdc3f38f2d9bba15e966c5998c91b72f931b192fb` |
| T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config` | 0 | 6 passed | `332084cc0b59c8293f85f1ec74affa42a280a78588072bba302c9ec5040ac6d4` |
| T2 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` | 101 | 68 passed, 1 failed | `263d565ff7dbe1c7b26ecbf0944405644c63c04766a4b80981b184af8d3e90aa` |
| T2 retry | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` | 0 | 69 passed | `963046f8665f96488313875b859d074ef5a3b7290b119f20a84a0be3e1aebf29` |
| T3 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config` | 0 | 34 passed | `5d6b6dce26f03742dcd56f33c79fd288f59b2f7e25388554d027f4cbcc5c9505` |
| T3 | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | 101 | 184 passed, 3 failed | `bcc0e269912a49d9c5416ab432d64cf51670851c7a9a7c78ef447cb2f9d2745e` |
| T3 retry | `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` | 0 | 188 passed | `24452595f1a700e641a319f7285f4fa558c56a1c99d40baf4130f31cb04e5581` |
| Final lint | `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests` | 0 | passed; no warnings; no tests executed | `ad97d5deb6489b343f55f2823ae8458305016b914dbc2494088699f99e62d3b9` |

The T1 compile failure was a fixture byte-array serialization type mismatch;
changing the fixture to a byte slice repaired it. T2's first guard run found an
overbroadened destination-file check on unrelated writes; retaining directory
binding validation while leaving destination checks on actual writes preserved
valid policy symlink retargets. T3's first binary run found overbroad immutable
cursor checks and an old exclusion fixture that changed preserved source
evidence through the writer. Immutable validation was narrowed to import/source
evidence; the exclusion fixture now supplies excluded snapshot bytes directly
at its filesystem boundary. No existing assertion was weakened or ignored.
The final T3 binary run also includes a new assertion that a preserved original
with lost layer identity reports unavailable evidence.

## Verify rewrites

Each complete old/new line is recorded verbatim below. The cargo targets are
retained. T2's prose now also lists phase7_guard, which was already required by
its execution.tasks verification metadata.

### P8-2-T1

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Fixtures save all thirteen first-run answers with both parents initially missing, continue through the same resident, reopen, then initialize a second project without changing active-global bytes. Repeat with both active and conflicting legacy global values; current active roles win while legacy evidence remains exact. Missing-parent repo-only use writes no global config/defaults. Malformed/unreadable active global, foreign repo state/config outputs and unsafe identity changes refuse. Alias and legacy-preservation regressions remain green.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Separate function assertions with filesystem inputs controlled at the adapter boundary: ConfigWriter::batch returns all thirteen literal first-run changed leaves with missing parents; Session::config returns the same thirteen literal values from independently persisted reopened input; SessionFactory::first_touch returns a session reusing existing active-global bytes unchanged. prepare_import selects current active roles over conflicting legacy roles and preserves exact legacy evidence, excludes reused global from created outputs, and refuses malformed/unreadable shared input. register returns a resident-capable adapter for missing parents without writing config/defaults and refuses unsafe ancestors; first_touch retains foreign repo-output refusal. No resident workflow chain.

Why: The old line required a resident save/reopen/second-project workflow and bundled repetition. It now names independent write, read, initialization, import and filesystem-adapter assertions.

### P8-2-T2

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_global`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config` — The new target starts two real processes with different already-open planning roots sharing one global destination. Pause B after validation immediately before replacement, start A, and assert that production ownership prevents the losing interleaving; the stale writer refuses and a reread/retry retains both accepted keys. Repeat simultaneous first global creation, alias-collapsed versus distinct-root addressing, reversed lock order, and a resident idle after success. Kill owners before and after global replacement and during recovery. A replacement either completes the exact pending transaction once or refuses a foreign accepted value with all pre-recovery participant bytes unchanged. B's acknowledged value can never be erased by A's stale recovery, and no process deadlocks or claims confirmation before release/confirmation completes.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_global`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` — ExternalChange::validate returns Error::Conflict(String) with its sole payload exactly "pending participant changed: global-config" for a stale Observed generation token (bytes, identity, directory_identity); with a fresh reread token it returns Ok with literal bytes containing both accepted keys. Separate assertions cover absent first creation, installed recovery bytes, foreign recovery bytes and changed parent identity. Filesystem::acquire is tested directly for root/shared-parent ownership, alias deduplication, stable ordering, identity refusal and release using local directory descriptors; no two live writers or process choreography. Writer::request refuses stale input before intent installation and accepts a directly supplied fresh two-key transaction with filesystem observations stubbed.

Why: The old line required two processes, scheduled losing interleavings, kills and recovery choreography. It now tests the writer's production observation guard, direct ownership acquisition and individual write outcomes. The typed refusal is Error::Conflict(String), whose single field is exactly "pending participant changed: global-config".

### P8-2-T3

Old:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — Distinct global/repo originals, an unrecognized object-valued stakes and an aliased source all disclose exact values and source identities after real snapshot-changing operations before the first interview. Exercise RewriteSnapshot, a transaction with snapshot data, derivation/evidence changes and dispatch/patch work, then a config batch and process replacement. Compare original file bytes and retained evidence bytes before/after; there is no expansion or durable migration state. A concurrent stale snapshot rewrite refuses, and missing historical evidence is explicitly unavailable rather than reconstructed.

New:

- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_config`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence` — For each IntentKind variant, its provenance validator returns Ok(()) for an independently supplied snapshot retaining import/source_evidence/archive/cursor and Error::Invalid("snapshot replacement changed provenance: source_evidence") when source evidence is removed. Additional single-function assertions cover wrapped evidence, snapshot replacement preserving unrelated namespaces, typed stale-generation refusal, exact JSON stakes values with original global/repo paths and alias identity, and evidence status "unavailable" for lost historical evidence. Filesystem observations are supplied at the boundary; no dispatch/patch workflow or process replacement. Original bytes are literal fixture inputs, never reread from changed legacy files.

Why: The old line required snapshot work, derivation, evidence, dispatch/patch, config writes and process replacement as one sequence. It now checks the new provenance validator for all eleven intent variants, plus independent replacement and disclosure functions.

## Lease, frozen reference and remaining tree

P8-2-T3's Files line was extended before editing these paths:

- `crates/cadence/src/store/transaction.rs`: enforce and directly test
  per-intent preservation at commit and recovery validation. This path was
  already in PLAN-2's top-level files list but absent from T3's lease.
- `crates/cadence/src/derivation_service_tests.rs`: change the existing
  snapshot-exclusion fixture setup to filesystem-supplied bytes, because
  changing preserved original evidence through the production writer now
  correctly refuses. Added to the top-level files list as well.

T1 and T2 needed no additional source paths. T2's phase8_global description was
changed from a multiprocess target to a function-level ownership/writer target.
The PLAN-2 edits and this report are explicitly authorized by the owner.
All task files were staged by explicit path; no blanket staging was used.
The frozen cadence-core reference was not modified.

At report preparation, unrelated edits were present in
`.planning/phases/9/CONTEXT.md`, `.planning/phases/9/MANUAL.md`,
`.planning/phases/10/CONTEXT.md` and `.planning/phases/10/MANUAL.md`.
They appeared during this run and are outside these commits. The report commit
changes only `.planning/phases/8/reports/plan-2.md`.

PLAN COMPLETE
Plan: `.planning/phases/8/PLAN-2.md`
Tasks: 3 of 3 completed in separate signed commits.
Deviations: malformed workflow Verify lines replaced with function assertions;
T3 source lease extended for two paths; prohibited suite replaced by the
owner's single permitted clippy invocation; AC1 references removed.
Open items: none within PLAN-2. No later plan was started.
