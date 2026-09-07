---
phase: 6
plan: 3
requirements:
  - AC1
  - AC4
  - AC5
  - AC6
  - AC8
files:
  - crates/cadence/src/lib.rs
  - crates/cadence/src/main.rs
  - crates/cadence/src/envelope.rs
  - crates/cadence/src/execution/mod.rs
  - crates/cadence/src/execution/model.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/src/execution/tests.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/execution_service_tests.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/store/model.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/execution_store.rs
  - crates/cadence/tests/execution_boundary_compat.rs
---

# Phase 6: Boundary prerequisite repairs - Plan 3

PLAN-3 is a PREREQUISITE OF PLAN-2. Execute the completed PLAN-1, then
PLAN-3, then the unchanged PLAN-2. The plan number does not establish the
execution order. This document authorizes no execution during its authorship.

## Goal

Repair precisely the three interfaces that stopped PLAN-2: generate the patch
schema from the deserialized type, durably refuse requests without a validated
phase, and persist a digest of the public envelope actually returned, including
terminal replay. Supply the compatibility and recovery proof those store
changes require. PLAN-2 retains raw MCP dispatch, root startup binding, its
three-tool listing, markdown contracts, protocol tests and live UAT.

## Must be true when done

- **M1 - Shared schema (AC1 prerequisite):** `patch_schema()` generates the
  schema from `ExecutorPatch` and its reachable field types. New prompts and
  PLAN-2's future tool listing consume that producer. The handwritten
  `PATCH_SCHEMA_JSON` and any independent patch DTO/schema are absent.
  Structural generation does not replace semantic patch or Git validation.
- **M2 - Refusal identity (AC1/AC5 prerequisite):** A malformed execution call
  at a known normalized root can return a confirmed `Envelope::Refused`
  without a phase. No zero, guessed lifecycle phase, foreign dispatch or phase
  directory is manufactured to admit its decision. Refusal preserves execution,
  lifecycle, import, evidence and pause values and existing SUMMARY bytes.
- **M3 - Finite refusal history (AC8):** Unscoped malformed calls share one
  persistent root refusal budget. Existing phase execution budgets remain
  separate. Each budget admits 256 unique transitions and one terminal refusal;
  repetition and restart do not reset it. After terminal admission, every later
  call in that scope with a safely readable store returns its persisted answer
  without further log growth, generation changes or operation-receipt growth.
- **M4 - One answer to hash (AC1/AC4/AC5):** Every confirmed new-format query,
  apply or refusal answer has a boundary decision whose SHA-256 hashes the
  canonical JSON of that same public envelope. This covers dispatch, next-plan,
  completion, judgment stop and every non-`ok` arm the service emits. The writer's
  confirmed terminal answer takes precedence over any candidate or old receipt.
  An inability to confirm the decision is a server failure, never a successful
  recorded refusal. Version diagnostics remain side-effect free.
- **M5 - Immutable replay (AC6/AC8):** New-format lost replies replay the
  original confirmed envelope and digest, not an answer recomputed from a later
  execution state, provided current input revalidation permits replay. Changed
  or unreadable controlling inputs still produce a confirmed non-success or an
  explicit server failure, never stale success. Dispatch reconstruction uses
  checked plan bytes and the same generated schema; prompt/body bytes are not
  persisted. Refusals and terminal
  replays cannot advance an execution version or render a SUMMARY.
- **M6 - Explicit compatibility:** Old store, decision, operation-receipt and
  intent encodings remain readable and recoverable without rewriting history
  or relabeling old hashes as public-envelope hashes. New-format records are
  distinguishable. Unknown formats fail closed. The legacy execution-resume
  conflict in Flag A must be resolved explicitly before this plan is declared
  complete; a fresh-fixture pass cannot discharge it.
- **M7 - Recovery (AC4/AC6):** Both supported intent formats retain the existing
  validate-before-replace protocol, participant identity checks, policy reload,
  file/directory sync and confirmation. SUMMARY precedes final semantic state.
  A pre-admission kill leaves no admitted operation; an admitted intent survives
  failure and completes once through normal recovery. Foreign bytes block all
  recovery writes. No migration or error path resets a budget or fabricates an
  acknowledged answer.
- **M8 - Preserved boundary:** Phase 4 D-01 through D-07, phase 5 D-01 through
  D-14 and phase 6 D-15 through D-26 remain binding, subject to the explicitly
  unresolved Flag A rather than an implicit override. The current one-tool MCP
  surface, guard, frozen reference, protected planning documents and PLAN-2's
  lease remain unchanged. Tests assert deterministic shape and durability;
  model behavior remains knowingly untested here.

## Context

Short Rust source citations below are relative to `crates/cadence/src/`.

Inspection baseline: `2aa77d6422bce52c97943976e50814cfe363b6f9`, including all
seven PLAN-1 implementation commits. The checkpoint report is
`.planning/phases/6/reports/plan-2.md:12`, and its verified summary is commit
`2aa77d64`. The earlier falsification explicitly inspected `c8a266d8`
(`.planning/phases/6/FALSIFICATION.md:4`); its missing-module findings cannot be
reused as evidence against this tree. PLAN-1's implemented paths and 299-test
run are recorded at `.planning/phases/6/reports/plan-1.md:6` and `:18`.

The defects are present: patch deserialization at
`crates/cadence/src/execution/patch.rs:52` targets the non-JsonSchema type at
`crates/cadence/src/execution/model.rs:226`, while the prompt schema is a
constant at `crates/cadence/src/execution_service.rs:1102`. Phase-zero query and
apply return before a session at `:105` and `:699`. Boundary identity requires
phase at `execution/model.rs:249`; writer, record and intent validation reject
zero at `store/writer.rs:770`, `store/model.rs:229` and
`store/transaction.rs:119`. Ordinary response hashing uses internal `Response`
at `execution_service.rs:1452`; terminal hashing uses an identity string at
`store/writer.rs:804` and `:822`; observation ignores the confirmed view at
`execution_service.rs:1501`.

Architecture sections 3a and 3d require the shared envelope, one role schema,
scoped patches and compact state (`docs/rationale/architecture-v4.md:113`,
`:162`, `:174`, `:190`). Section 4's small grouped surface remains PLAN-2's
work (`:355`). Phase 6 D-25 supersedes that section's older load-preamble
premise (`.planning/phases/6/CONTEXT.md:228`). The live storage names and four
lifecycle statuses follow the phase decisions, not the older design examples.

## Contract choices

**Scope and budget.** Use a tagged boundary scope, `RootRefusal` or
`Execution { phase }`. Root identity comes from the already normalized
planning root owned by the session, never from raw arguments. The root bucket
is one fixed versioned identity for that store's lifetime; no timestamp,
process ID, malformed operation string, supplied phase spelling or dispatch ID
creates another bucket. Only execution query/apply refusals can use it. A
validated positive query phase or a dispatch/receipt located in the bound
store supplies execution scope. An unresolved apply identity is a root refusal.
Retain the current single occurrence per phase lifetime; do not introduce
reruns, cycle resets or a new occurrence allocator. Count the same semantic
transitions the writer admits, with both tools sharing each scope's limit.

**Canonical envelope v1.** Move the existing `Envelope<T>` into the library's
exports and make the binary import that one type. Keep its four tags and
flattened success payload. Put execution payloads and canonicalization in the
new pure `execution/boundary.rs`; no runtime or transport belongs there.
Canonical bytes are UTF-8, compact JSON without a trailing newline, object
keys recursively sorted in Rust string order, arrays in original order, and
`serde_json` string escaping with no extra ASCII or slash escaping and no
Unicode normalization. Only integral numbers occur in execution envelopes. Hash exactly these bytes with SHA-256.
The envelope excludes its own digest, request ID, JSON-RPC framing, MCP content
wrapper and current store generation, avoiding self-reference and replay drift.
Persist the envelope codec version alongside the digest. Structured content
and parsed mirrored text must equal this envelope when PLAN-2 wraps it.

**Confirmation and replay.** Keep one public conversion before persistence.
Store compact versioned receipts sufficient to reconstruct non-dispatch
answers, including stable binary-owned code/reason, IDs and outcome fields.
Bound non-dispatch canonical envelopes to 16 KiB and each reason to 1024 UTF-8
bytes, truncating only binary-owned reasons deterministically before hashing.
Never truncate task/dispatch/blocker IDs or stored judgment to meet the bound.
If a candidate compact answer exceeds 16 KiB, record a bounded
`response-too-large` refusal before accepting its execution mutation.
Dispatch decisions keep only references, codec version, prompt byte count and
digest. They reconstruct
from the admitted dispatch plus rechecked plan bytes; never store the prompt
or body in a decision, snapshot or replay receipt. Return a confirmed answer
only after finding the selected persisted decision and checking its digest
against the envelope to be returned. Expose a typed confirmation selector over
the writer's returned `View`, without changing the generic `View` or every
store client's return type. Terminal selection happens before candidate or
receipt matching. New-format replay obtains the original receipt before any
attempt to compute a fresh next-plan response.

**Wire-format compatibility.** Keep outer store `VERSION = 1`, the existing
`Decision::Boundary` representation, and old intent variants exactly as encoded.
Add a distinct versioned boundary variant and distinct intent variants for new
scope/receipt semantics. Do not add serializing defaults to an old digest
preimage. Old hashes remain explicitly legacy internal-response/terminal-ID
hashes. No eager migration, log rewriting, synthetic completion, counter reset
or automatic deletion is part of this repair. Old pending intents recover in
their own format before new work. New-format records may coexist with old
nonexecution history; the legacy execution-continuation issue is Flag A.
Compatibility is new-reader/old-data support, not automatic downgrade: an old
binary does not recognize the new record variants. Do not hand it a new-format
store or claim it can recover a new-format pending intent.

## Tasks

### Task 1: Generate the patch schema from its real domain types

- **Files:** `crates/cadence/src/execution/model.rs`, `crates/cadence/src/execution/tests.rs`, `crates/cadence/src/execution_service.rs`
- **Action:** Derive `schemars::JsonSchema` on `ExecutorPatch` and every reachable field type, including task variants, receipts, evidence, deviations, blockers, patch kind and disposition. Replace `patch_schema()` with generation from that type and delete `PATCH_SCHEMA_JSON`. Preserve Serde tags, required fields and unknown-field rejection. Generate the deserialization contract; do not introduce a parallel patch DTO or patch schema. Keep the existing semantic validator authoritative for schema-version support, nonempty evidence, verification success, exact task scope/order, stale versions and Git facts. Do not accidentally promise that every structurally deserializable patch is admissible: the current receipt enum also represents failed verification. Both new prompt rendering and the future listing must call this producer. Check the locked schemars 1 APIs; current documentation confirms derive requires reachable field types and follows Serde tags. No dependency addition is required.
- **Verify:** **V1.** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::` must run named schema cases, not merely pass existing patch tests. Independently authored JSON covers all task and evidence variants, required-key removal, extra keys and incorrect tags/types at every nesting level; inspect generated schema constraints and actual deserialization together. Resolve generated references before checking field inventories. Reuse semantic negative cases for failed verification, empty evidence and unsupported version. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service` checks that a newly rendered prompt contains this generated schema and the real opaque body, with correct UTF-8 byte count. A source search must find no production `PATCH_SCHEMA_JSON` or handwritten replacement schema. This verifies the producer; tools/list remains PLAN-2 evidence.

### Task 2: Define the shared envelope and canonical receipt contract

- **Files:** `crates/cadence/src/lib.rs`, `crates/cadence/src/main.rs`, `crates/cadence/src/envelope.rs`, `crates/cadence/src/execution/mod.rs`, `crates/cadence/src/execution/model.rs`, `crates/cadence/src/execution/boundary.rs`, `crates/cadence/src/execution_service.rs`, `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/src/server.rs`
- **Action:** Export the existing envelope from the library, remove the binary's separate module ownership, and import the shared type in server/service. `main.rs` changes only module wiring; add no CLI flag or routing. Add the tagged scope, versioned canonical envelope/receipt types, and a separate failure return for unconfirmed store/resident operations. Move only execution response representation/conversion into the pure boundary module, preserving successful payload facts and the four envelope arms. Derive output schemas from these types as needed by PLAN-2. Define one terminal envelope constructor used by service and writer; its stable code is `log-bound` and it contains no per-attempt data. Implement the canonical byte/digest and size rules above. Define the conversion and failure types here; activate the new service return and resident signatures in Task 4 after Task 3 supports their durable format. Never write a canonical digest under the legacy record variant during an intermediate task. Public mapping must happen before hashing, including stable code/reason selection; subsequent adapters only wrap the resulting envelope. Persist compact replay data for nondispatch answers, references for dispatch, and no duplicate prompt storage.
- **Verify:** **V2.** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib execution::boundary` runs named cases for every envelope arm and execution success variant, terminal construction, Unicode/escaping, nested object-key permutations, array order, integral numbers and both size limits. Fixed independently authored JSON and expected canonical bytes/digests are the oracle, not another serialization of the production response type. Reordered object keys hash equally; changed array order/status/code/ID hashes differently. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service` retains version envelope shape and tests conversion before receipt creation. A check that only hashes internal `Response` must fail the expected public-envelope fixture.

### Task 3: Persist scoped decisions and return the writer's actual answer

- **Files:** `crates/cadence/src/execution/boundary.rs`, `crates/cadence/src/store/model.rs`, `crates/cadence/src/store/writer.rs`, `crates/cadence/src/store/transaction.rs`, `crates/cadence/src/recall/mod.rs`, `crates/cadence/tests/execution_store.rs`, `crates/cadence/tests/execution_boundary_compat.rs`
- **Action:** Add the new boundary record/intent encodings without changing legacy serialized variants or global store version. Validate scope, codec, required digest/receipt fields, stable outcome, terminal flag, matching generation and record identity. New-format boundary records are immutable revision 1: reject duplicate identities, second terminals and ordinary transitions after a terminal on admission and validation, so revision records cannot evade the budget. Root refusals have no execution phase, dispatch requirement, phase-summary or config participant. Give execution dispatch/patch and observation intents explicit new-format variants; each requires its exact selected decision at the intended generation, and patch intents retain derived SUMMARY validation. Extend owner admission/counting/replay to the root and phase scopes, with one 256-plus-one budget each and no per-request operation-map entries after terminal admission. Preserve replay identity separately from expected generation/integrity. The same identity with changed content conflicts. Persist terminal digest from the canonical terminal envelope, not its identity string. Provide the typed confirmed-decision selector over returned `View` so callers cannot mistake an old dispatch/patch receipt for this operation's answer. Keep identity hashing distinct from the response digest: a stable terminal transition ID need not equal the hash of the terminal envelope. Update recall's exhaustive decision match solely to retain boundary-record exclusion from prompt recall. Keep existing participant destinations and the generic writer API.
- **Verify:** **V3.** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store` drives the real writer with root refusal, phase refusal, dispatch, complete/blocked apply and observations. Compare independent on-disk record JSON with canonical answer digests. For each scope, count exactly 256 unique admissions, then one terminal; repeat query and apply after reopen with changed request digests, preconditions and existing dispatch/receipt identities. Require identical terminal envelope/ID/digest, log bytes, generation and operations map on all subsequent calls. Duplicate ordinary requests do not consume a slot; root saturation does not consume phase slots and phase saturation does not consume the root bucket. Refusals preserve all snapshot data values and SUMMARY bytes while ordinary metadata advances. Record fixtures reject duplicate identities, revisions, second terminals and post-terminal ordinary records. Negative intent fixtures reject scope/generation/receipt mismatches, phase zero in execution scope, unknown codec, arbitrary targets, root SUMMARY/config participants and corrupted digests before any installation. `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat` includes legacy encoding round trips and mixed-history validation.

### Task 4: Make every service exit confirm or fail explicitly

- **Files:** `crates/cadence/src/execution_service.rs`, `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`
- **Action:** Add one internal resident refusal request accepting the bound root, a closed query/apply tool tag, raw optional arguments for digesting, and typed validation failure data. It cannot select a caller-supplied output or phase. It acquires the existing session and verified store view directly, without lifecycle selection, plan parsing, Git or recursive resident calls. After safe scope resolution, inspect the persisted terminal before lifecycle, plan or Git observations; unavailable config or unsafe storage still fails instead of bypassing policy. Missing/extra/wrong-type/unknown-tag inputs use the same writer decision path as other execution answers. Use a versioned request-digest domain that distinguishes absent arguments from `{}`, includes tool/operation identity, and excludes process IDs and store generation; do not persist raw argument bodies. Supply an internal apply entry point that locates the patch's dispatch or replay receipt in the bound store; a foreign/unresolvable identity uses root refusal rather than asking PLAN-2 to invent a phase. Keep query argument parsing and raw MCP dispatch in PLAN-2. Audit every query/apply return: phase zero, checked-derivation failures, observation failures, graph errors, admission checks, patch replays, store errors and queue closure. When the store is safely writable, semantic errors confirm their public non-`ok` envelope without altering the memo or execution. Unavailable controlling config, unsafe store, recovery failure, failed refusal write and closed resident return a distinct failure. Select the writer's terminal outcome before testing stored dispatch/receipt membership, and compare the final envelope to its persisted digest before returning it. Map nondeterministic I/O details to stable bounded reasons before persistence.
- **Verify:** **V4.** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_service` invokes production `CadenceServer` methods through the resident with absent/empty arguments, missing phase, zero, decimal/exponent-shaped JSON numbers, extra fields, wrong tags, malformed patches and foreign dispatch IDs. These refusal-entry fixtures supply typed validation failures with the raw malformed data and prove durable recording, not the future adapter's parser. Independently test typed query phase-zero rejection and production dispatch/receipt lookup; raw argument classification remains PLAN-2. A store reader finds the matching root or phase decision and computes SHA-256 independently from the actual returned canonical envelope. No dispatch, execution version or SUMMARY changes on refusal. Inject lifecycle conflict before session acquisition in the old path, refusal-log failure and resident closure: writable semantic failures have confirmed decisions; unsafe/unconfirmed paths have a failure result, never a claimed logged refusal. Fill budgets through the writer, then exercise terminal replacement via service observation, new dispatch, active-dispatch replay, new patch and already-applied patch branches, including altered inputs after saturation. Retain the existing real-Git acceptance and continuation tests. This is an internal prerequisite test, not a claim of raw MCP coverage.

### Task 5: Prove compatibility and crash recovery at the changed boundary

- **Files:** `crates/cadence/src/execution_service.rs`, `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/src/store/model.rs`, `crates/cadence/src/store/writer.rs`, `crates/cadence/src/store/transaction.rs`, `crates/cadence/tests/execution_store.rs`, `crates/cadence/tests/execution_boundary_compat.rs`
- **Action:** Resolve Flag A before claiming this task complete. Embed bounded legacy fixtures in the leased compatibility test module, with provenance to baseline `2aa77d64`, covering phase-3/5 store history, phase-6 dispatch, accepted and blocked patch, ordinary refusal, saturated terminal and each pending intent kind. Fixtures must encode the actual old format independently of the new serializer. Verify old snapshot/intent integrity using the original encoding before interpreting compatibility; never default a missing new field into an old hash preimage. Recover old intents with their original participant bytes before attempting new-format work. Preserve import manifest, provenance, lifecycle memo, evidence permissions, pause and unrelated JSON. New-format refusal and terminal transactions use only normal store participants; retain SUMMARY-before-state for patch transactions. Use existing filesystem probes and child harnesses for kills before intent installation, after durable intent, after decisions replacement/before final state, after SUMMARY/before state, after final state/before intent removal and after full confirmation/before reply. Repeat process death during recovery. Validate all targets before replacing any, resync already-installed bytes, retain a conflicted intent, and never acknowledge a failed sync/confirmation. No upgrade runs by direct file rewrite or startup cleanup of history.
- **Verify:** **V5.** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_boundary_compat`, `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test execution_store`, and `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence execution_restart` must run the named compatibility and kill cases. Each parent observes the named barrier, kills that process, and starts an unrelated reader with only root plus original request/patch inputs, not expected answers. Independent disk/Git checks prove one admission, identical confirmed envelope/digest after lost reply, preserved namespaces/SUMMARY, and no duplicate transitions. Old pending intents must finish once with old bytes; unknown/tampered formats and changed file or directory identities refuse before recovery writes. Inject temporary sync, rename/directory sync and confirmation failures for intent and changed participants. Inject recovery-resync failures for already-installed decisions, state and SUMMARY; the intent itself is validated and removed, not resynced as a semantic participant. Include intent-removal directory-sync failure. Assert no success acknowledgement in each applicable case. A kill before any intent rename leaves only old semantic files and possibly disposable preparations; a kill after intent rename but before its confirmation may leave a recoverable intent, so do not call that rollback. Full state installation without intent cleanup is still unacknowledged and must recover or reopen as the one completed operation. A same-process reopen establishes read compatibility only. Hardware power loss remains untested; sync-order evidence and process-kill recovery are separate claims. Flag A remains unresolved unless its explicit decision and corresponding cross-format tests are recorded; readable old JSON alone is insufficient.

### Task 6: Close only the prerequisite and hand back to PLAN-2

- **Files:** `crates/cadence/src/execution/tests.rs`, `crates/cadence/src/execution_service_tests.rs`, `crates/cadence/tests/execution_store.rs`, `crates/cadence/tests/execution_boundary_compat.rs`
- **Action:** Add an executable repair inventory mapping M1-M7 to named schema, refusal, digest, terminal and recovery cases. Follow PLAN-1's registration-and-execution pattern; preserve its existing inventory. Report which compatibility guarantees passed and the disposition of Flag A. Hand PLAN-2 the shared schema function, internal root refusal/apply entry points, confirmed envelope type, canonical digest rule and distinct failure channel. Do not register public tools, change the execution skill or executor contract, author UAT, or broaden the guard. All changes must fit this frontmatter lease; a newly necessary source or fixture file requires an explicit planning correction before implementation, not an undeclared edit.
- **Verify:** **V6.** From `/code/cadence`, run `TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace`, `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`, `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`, and `TMPDIR=/tmp npx tsc -p tsconfig.ci.json`. Require the full phase-3 store/crash, phase-4 derivation, phase-5 evidence/next-action/pause and PLAN-1 execution/guard regressions, including their executable inventories. Check named new tests are registered and actually executed; zero matching tests cannot pass a criterion. The unchanged MCP suite still asserts one public tool. `git diff --exit-code v3.7.12 -- cadence-core/` must be empty. Compare the implementation diff against its recorded starting HEAD: only leased files may change; phase 1-5 artifacts, phase-6 CONTEXT/PLAN-1/PLAN-2, skills, agents, hooks, release wiring and planning state remain exact. Report actual counts/exits and unproved obligations. A green suite cannot complete this plan with Flag A unresolved or claim PLAN-2 AC1/AC3/AC7 and live UAT complete.

## Flagged assumptions

**Flag A - Legacy execution replay is a real compatibility conflict, not a
Serde default.** An old terminal contains only the hash of an identity string
(`crates/cadence/src/store/writer.rs:803`), and ordinary old decisions do not
contain the response needed to reverse their internal-response hash
(`crates/cadence/src/store/model.rs:77`). The old active dispatch stores a
prompt byte count but no prompt-renderer/schema version
(`crates/cadence/src/execution/model.rs:56`); replay rebuilds the prompt using
the current schema and refuses a length mismatch
(`crates/cadence/src/execution_service.rs:1062`). A generated replacement
schema cannot be assumed to reproduce that old prompt. Operation fingerprints
also include the old decision (`crates/cadence/src/store/writer.rs:423`, `:495`),
so substituting a new digest on replay conflicts under the same operation ID
(`:619`).

There is no honest automatic conversion that simultaneously claims the old
digest hashes a new envelope, preserves append-only history, preserves an old
outstanding dispatch exactly, and appends nothing after an old terminal. Those
constraints meet D-19/D-21/D-22 (`.planning/phases/6/CONTEXT.md:121`, `:161`,
`:184`) and AC6/AC8 (`:284`, `:294`). A blanket old-binary-to-new-binary replay
promise is therefore UNVERIFIABLE and potentially conflicts with these
decisions. This plan preserves old read/recovery support and does not adopt an
exception to those decisions.

Before implementing legacy continuation, obtain an explicit compatibility
ruling: either an acknowledged format cutover with narrowly specified audit
and dispatch migration semantics, or a declared unsupported cross-format
execution-resume boundary that fails as a server/store failure while preserving
old data. Neither is silently authorized by this plan. The latter would narrow
the blanket reading of D-19/D-22 and must be stated as such; the former needs
concrete limits on one-time history growth and prompt identity changes. Do not
retain a production handwritten patch schema, invent a new occurrence, erase
receipts, manufacture a phase or call legacy hashes canonical to evade this
checkpoint. New-format tasks and old-format recovery work can proceed, but
PLAN-3 cannot be marked complete and PLAN-2 cannot resume until this flag has a
recorded resolution and tests within an honestly declared lease.

**Flag B - Root scope extends the occurrence vocabulary only for refusals.**
D-22 names execution occurrences but does not allocate identity for missing
phase (`.planning/phases/6/CONTEXT.md:184`). The fixed root bucket above fills
that prerequisite without assigning execution authority or resetting existing
phase budgets. If a reset or multiple root episodes is requested, that is a
new decision, not part of this repair.

**Flag C - A known root does not guarantee a writable log.** Session requests
reload controlling config (`crates/cadence/src/import/mod.rs:402`); store
revalidation rejects externally changed participants
(`crates/cadence/src/store/writer.rs:745`). The existing unsafe-store test
expects no refusal append (`crates/cadence/tests/store.rs:356`). Use PLAN-2's
explicit server-failure rule (`.planning/phases/6/PLAN-2.md:88`), not a bypass
of phase-3 policy or phase-5 D-12 (`.planning/phases/5/CONTEXT.md:217`). Initial
session import/recovery is separate from the subsequent refusal-only mutation;
on an established store the refusal itself changes no data namespace.

## Decision preservation and lease notes

Phase 4 D-01/D-02 retain the four statuses and inherited existence-based
completion; D-03 retains the exact memo input set; D-04/D-07 retain hard
conflicts and reobservation; D-05/D-06 retain cursor retirement, pause provenance
and acknowledged namespaced writes. Phase 5 D-01/D-13 retain the nine-rule
oracle; D-02/D-03/D-06 retain scoped override lifetime and freshness;
D-04/D-05 retain pause Git and exact Next obligations; D-07/D-08/D-09 retain
checkpoint/checker/question facts; D-10/D-11/D-12 retain evidence, lifecycle
separation and durability; D-14 retains the existing receipt exclusion from the
commit risk read. No format change grants permission or reactivates history.

Phase 6 D-15/D-16 await PLAN-2's registration/raw dispatch; D-17 remains a
positive integer for execution; D-18 plan parsing/overlap/body ownership is
unchanged; D-19 through D-22 bind these repairs and Flag A; D-23 guard and
D-24 skill loop stay assigned as before; D-25 and D-26 retain no preamble and
the deterministic/live split. The user-assigned prerequisite order supersedes
only the old two-plan scheduling description at
`.planning/phases/6/CONTEXT.md:50`; that file is not edited.

`execution/boundary.rs` and `tests/execution_boundary_compat.rs` are new leased
files, not existing symbols. Test fixtures stay embedded in these leased test
modules; no undeclared fixture directory or dependency update is implied.
The library and binary currently have separate owners (`lib.rs:3`,
`main.rs:2`), so both wiring files are leased. `recall/mod.rs` owns the resident
and an exhaustive decision match. `Session::request` already passes specialized
operations through (`import/mod.rs:407`), and `Filesystem` already exposes
needed fault probes (`store/filesystem.rs:9`, `:63`): neither file needs an
edit for the chosen unchanged View/participant APIs. Derivation, patch algebra,
Git validation, renderer, generic store clients and their tests are read-only
regression dependencies, not refactoring opportunities.

All test artifacts and signing fixtures live outside the repository with
`TMPDIR=/tmp`; clear `RUSTC_WRAPPER` on every Cargo call. Frozen `cadence-core/`
is readable only. No repository instruction file is required beyond those
present. The supplied HEAD baseline is 299 workspace tests passed, zero failed,
clippy exit 0 and TypeScript exit 0; those results are supplied evidence, not
newly executed planning evidence. Current schema-generation documentation was
read through Context7 at `https://github.com/gresau/schemars` (derive,
`schema_for!`, Serde attributes). Live host execution, model compliance, model
output quality, compaction causality and hardware power-loss behavior are
knowingly untested by this prerequisite.
