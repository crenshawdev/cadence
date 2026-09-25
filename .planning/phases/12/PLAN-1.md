---
phase: 12
plan: 1
requirements: [T1]
files:
  - crates/cadence/src/execution/mod.rs
  - crates/cadence/src/execution/admission.rs
  - crates/cadence/src/execution/allocation.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/src/execution/dispatch.rs
  - crates/cadence/src/execution/plan.rs
  - crates/cadence/src/execution/tests.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/plan/associations.rs
  - crates/cadence/src/plan/persistence.rs
  - crates/cadence/src/plan/map_view.rs
  - crates/cadence/src/plan/validation.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/tests/phase12_execution.rs
  - crates/cadence/tests/support/phase12_history.py
  - crates/cadence/tests/fixtures/phase12_pre29_blank.json
  - crates/cadence/tests/phase7_lease.rs
---

# Phase 12: Execution and tasks - Plan 1

## Goal

Admit native execution only against the complete approved contract, with an
immutable admission basis and one typed owner for every delivered check.
Gaps extend that basis explicitly; neither publication nor legacy execution
can bypass admission.

## Must be true when done

- T1. When a native plan lacks the required execution contract at
  admission, the caller is refused execution with the missing contract
  identified.

## Context

Read acceptance.md first; all phase-12 decisions and carried decisions bind, especially D-108, D-110, D-119, D-120 and D-122.
The inspected baseline is cadence/binary-owns-process at 32cbe197; `require_execution_ready` currently refuses every native publication.
`associations::validate`, `map_view::read`, `validate_publication`, `parse_plan` and the writer/intent path supply existing authority and validation seams.
This is the first of three sequential plans; their shared file leases are intentional under the owner's sequential-split instruction.
No self-hosting, truth status, hook deletion, SUMMARY work, pre-commit clearance or other parked slice is authorized.

## Evidence map

This map attaches to the owner's T1, approved 2026-09-10 in CONTEXT.md.
This implementation document is not itself a native publication. Native
fixtures obtain their occurrence, full truth ids/versions, plan identities,
content revisions, map events and item revisions from the actual approved
operations. No identifier or version is inferred from these headings.
New paths and check-function names below are creation specifications; all
other named Rust symbols were inspected at the baseline.

### Common boundary and oracle for all three plans

Create the shared fixture helpers in `crates/cadence/tests/phase12_execution.rs`
using the stdio `Client` pattern in phase28_evidence/phase29_limits and the
reopen pattern in phase27_plan. Every attributed check launches the actual
`CARGO_BIN_EXE_cadence serve --project-root <temporary-project>`, initializes
MCP and uses `cadence_query` / `cadence_apply`. Author native approved truths
through `context-submit`, allocate through `plan-read`, and publish the exact
approved content and attached typed map through `plan-submit`. Establish
execution and continuation authorization through the public operations added
here and in Plan 2, consuming the existing phase-7 records. Never seed
authority with `Store::Transact`, a service double or hand-edited state.
Plan 1's initial authorization adapter must be real so C1 can dispatch.
Isolate Cadence's global configuration and signing environment inside each
fixture. Ordinary cases use the existing empty `CADENCE_GLOBAL_CONFIG`
fixture convention; C7's real configuration write targets only a private
temporary global-config file selected for its server, never the owner's file.

Every project is a real Git repository. Every test/helper Git invocation,
including reads, init, config, archive and commits, passes
`-c commit.gpgsign=false -c user.name=Cadence-Phase12 -c user.email=phase12@example.invalid`
and null stdin unless it intentionally supplies input. Use only disposable
fixture signing material and explicit `commit -S` for designated completion
commits, overriding the disabled default for that command. Never use the
owner's key or global Git configuration. Reuse the isolation pattern of
`tests/support/signing.rs`, with the explicit per-call Git overrides above.

Expected allocation, task order, command strings, check specifications,
checkpoint answers, literal outputs and outcome properties are handwritten.
Retain the exact approved caller payloads and returned identities; compare
these with reopened records, not production renderers or projections used as
their own expected values. After each refusal, exit/reap the server and read
the installed PLAN, snapshot and JSONL files. Assert absence of a pending
journal before opening `Filesystem` / `Store` and `Operation::ReadVerified`.
Compare exact bytes of the admitted-set records, immutable task/progress
events, checkpoint records and saved receipts with their pre-call bytes,
and compare installed PLAN/map/publication bytes. Preserve the original
serialized record slices, not just counts or reconstructed pretty JSON.
A separately appended existing execution-refusal decision may change the
outer log/generation; it may not alter any of those protected records or
their projections. A refusal must not save a success/event/run receipt.
Read-only reopen and receipt replay must themselves leave bytes unchanged.

Public decoding, root binding, native approvals, admission, resident, writer,
journal, filesystem, store and Git stay real. Nothing beyond the clock and
the caller's inputs may be faked. The historical capture below is an actual
old binary's output, not manufactured authority. Handwritten expectations
are independent of both old and current implementations.

There is exactly one check per truth across the three files. Artifact tasks
use a substantive test or inspection of the increment they introduce, never
an unchanged regression that passes without it. The explicitly named new
unit tests in Tasks are implementation tests, not evidence-map checks; do
not add them to this map or the old acceptance inventories. Each named test command
must select exactly one test and report `1 passed; 0 failed`; zero tests is
failure. Executor check tasks write the check first and retain honest red and
green evidence. The planner runs neither builds nor tests. Full-suite work
belongs once at each implementation plan's close, never in a task's Verify.

### T1

- **P12-T1-C — check.** File `crates/cadence/tests/phase12_execution.rs`,
  function `phase12_incomplete_execution_contract_is_refused`.
  Setup: use the real approved native fixture above with two ordered tasks,
  two plans where needed, and a canonical check shared by two approved truth
  associations. Submit an explicit allocation for every task, including an
  empty assignment. The positive control's named test does not yet exist:
  admission must succeed without test files or red/green receipts.
  Call: submit the typed native admission contract through the public
  execution operation feeding `execute-next`; repeat each invalid case through
  that same operation, with all unrelated prerequisites valid. Read the real
  dispatch and reopen after each result.
  Expected property: a valid exact native contract is admitted and retained
  once; each invalid contract returns `status: refused`, a stable rule, and
  the particular contract field, plan, task or item that prevents admission.
  No invalid case changes the protected bytes described above.
  Keep ALL the following cases and controls inside this one function:
  (1) a mapless/provisional publication made through the current real public
  authoring path; (2) the authentic historical blank-command check map from
  P12-A-HISTORY, whose command is empty and expected result is nonblank;
  (3) missing allocation, omitted task, unknown task,
  unknown item, artifact-as-check, stale item revision, dropped check and two
  owners for the same canonical revision, including shared aliases across
  plans; (4) wrong occurrence/publication/content/map references in the
  admission request, and installed PLAN-byte drift; (5) a mixed native and
  unretained legacy PLAN set, refused rather than downgraded. Structural
  schema omissions must locate the actual field, not fall through to a
  generic parse error. For structural impossibilities already rejected by
  publication, do not forge a native snapshot to claim an admission case;
  inspect P12-A-CONTRACT's complete validation instead.
  Exercise the authoritative whole-current-phase union, not merely the next
  numeric plan: the historical offender still refuses when an otherwise
  valid plan is selected. Use public competing publication/replacement calls
  to make a previously observed admission basis stale, then assert refusal
  on admission; a cached successful preview cannot authorize the write.
  Finally, admit a valid set, replay its request, and explicitly extend it
  with a newly approved gap identity using the returned set version. Expect
  the original basis/receipts unchanged, one new extension event and no
  duplicate canonical owner. Refuse stale extension, implicit extension,
  reassignment of an existing owner and in-place replacement of an admitted
  plan. Completed-outcome preservation is inspected here and exercised with
  actual completion in C5/C6, not a second T1 check.
  Boundary: real public operation, approvals, store, filesystem and Git;
  fakes only clock/caller inputs. Command:
  `cargo test -p cadence --test phase12_execution phase12_incomplete_execution_contract_is_refused -- --exact`.
  Item/association reason: only causing invalid native admission beside a
  valid native admission defeats both a permissive bypass and the present
  blanket refusal.
- **P12-A-HISTORY — artifact; association T1.** New
  `tests/support/phase12_history.py` and
  `tests/fixtures/phase12_pre29_blank.json` under `crates/cadence` contain a
  reproducible capture procedure and exact old publication bytes, requests,
  responses, revision and source provenance. Use the pre-phase-29 commit
  `b353f09d` resolved to its full object id; its inspected
  `associations::validate` predates the content gates. Run that real binary
  against a disposable real repository, author approved native truths and
  publish the attached blank-check map through stdio. Capture the confirmed
  filesystem/store only after shutdown. Retain the approved valid control
  separately; the old map is never relabeled as current certification.
  Root-bound bytes must be restored at their recorded disposable root with
  exclusive ownership, never rewritten/rehashed to relocate them. Use a
  unique phase-12 fixture root and sibling lock, fail on foreign contents,
  and clean only owned fixture contents. Store provenance sufficient to
  reproduce the capture; do not commit an old executable or build tree.
  Reason: current phase 29 correctly prevents creating this historical input;
  weakening it or editing snapshot JSON would fake the admission boundary.
- **P12-A-CONTRACT — artifact; association T1.** New
  `execution/admission.rs` and `execution/allocation.rs`, integrated with
  `plan/associations.rs`, `plan/persistence.rs`, `plan/map_view.rs` and
  `plan/validation.rs`. Inspect a complete validator over one coherent
  snapshot plus checked installed bytes: approved nonempty versioned native
  truths and retained slots; exact current publication/approval/receipt;
  content revision, map event, item definitions and associations; attached
  mode; the complete phase-28/29 current union; parsed execution schema,
  positive identities, ordered unique tasks, nonempty named verification,
  suite and declared lease; and one exact typed task/check allocation.
  Reuse the phase-28/29 pure rules without constructing a fake `Submission`.
  `map_view`'s aggregate input digest is useful for coherence, not a stable
  replacement for publication, map and item identities. No readiness flag,
  prose parsing, test-existence gate, preset/style gate or publication-schema
  allocation is introduced. Reason: every field in D-108, including saved
  contributions, must constrain what the binary admits.
- **P12-A-BASIS — artifact; association T1.** The admission modules,
  `execution/boundary.rs`, `execution_service.rs`, `store/writer.rs` and
  `store/transaction.rs` retain immutable, explicitly versioned native
  admission/set-extension records. Inspect root/occurrence and exact authority
  bindings, typed allocation, request digest, expected set version,
  idempotent confirmed receipt, and original basis preservation on replay.
  New encodings are explicit; existing `BoundaryV1`, schema-1 execution
  records, canonical preimages and historical intent recovery retain their
  interpretation. A fresh native operation never uses the historical path
  to evade a new refusal. Inspect admission validation at the committing
  snapshot and intent validation, with installed-byte reobservation before
  confirmation. Reason: a service-only decision is not immutable admission.
- **P12-A-EXTENSION — artifact; association T1.** Admission/set-extension
  handling plus `plan/validation.rs` recognize every admitted identity,
  including a plan not yet dispatched. Explicit new approved gap identities
  append a versioned set extension; publication occurrence and execution-set
  version remain distinct. Preserve completed outcomes, old receipts, old
  dispatch and risk basis fingerprints. A same-plan replacement is not a
  repair. Shared evidence reuses only the exact canonical item/map/truth
  authority; a legally changed specification needs fresh evidence, never a
  reassigned old receipt. Refuse an extension that cannot satisfy the current
  union and allocation instead of inventing a migration. Reason: D-84/D-120
  require an append-only repair path without reopening completed work.
- **P12-A-ORDER — artifact; association T1.** `execution/plan.rs` and its
  dispatch caller remove pairwise lease-overlap computation and concurrency
  narration. Preserve numeric single-plan selection, one active dispatch,
  positive identities and lease enforcement through `lease::covers`.
  Update obsolete overlap-graph expectations in the existing execution and
  phase7_lease tests; retain path/rename/zero-exemption tests.
  Reason: D-119 changes scheduling machinery, not source authority.

No link belongs to T1: it names a refusal, not a value handed between two
things. O1 is not associated with T1; its one pending item appears in Plans
2 and 3 only.

## Tasks

### Task 1: Capture an authentic pre-phase-29 publication

- **Files:** `crates/cadence/tests/support/phase12_history.py` (new),
  `crates/cadence/tests/fixtures/phase12_pre29_blank.json` (new).
- **Action:** Deliver P12-A-HISTORY. Build the pinned old executable only in
  an isolated source export and temporary target directory, without changing
  this checkout or running its suite. The helper must drive the actual old
  stdio operations and capture their confirmed bytes, not encode a snapshot
  by hand. Include both the offending old item and a valid native control
  publication in the capture recipe. Provide a read-only inspection mode
  that verifies provenance, captured approval equality, expected blank
  fields, file hashes and exact bound root. This is artifact inspection,
  not T1's execution check. Never touch the phase-27 absent-map fixture or
  its lock. Do not require an old compiler/build during every test run.
- **Verify:** `python3 crates/cadence/tests/support/phase12_history.py --inspect`
  exits 0 only for the complete captured artifact with the specified
  historical blanks and matching provenance/hashes.

### Task 2: Factor complete authority validation and typed allocation

- **Files:** `crates/cadence/src/execution/mod.rs`,
  `crates/cadence/src/execution/admission.rs` (new),
  `crates/cadence/src/execution/allocation.rs` (new),
  `crates/cadence/src/plan/associations.rs`,
  `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/plan/map_view.rs`,
  `crates/cadence/src/execution/tests.rs`.
- **Action:** Deliver P12-A-CONTRACT. Separate `associations::validate`'s
  pure current-union validation from proposed-publication assembly; keep
  authoring semantics unchanged. Reuse `validate_publication` and the map
  event/definition cross-checks rather than trusting a readback digest alone.
  Define the new typed admission allocation independently of `plan::evidence::Map`:
  every ordered task has an explicit assignment, every canonical current
  check revision has one owner across the set, and empty assignments are
  legal. Locate malformed or stale bindings before information is discarded
  by decoding. Keep the existing blanket native execution refusal until
  Task 4 installs the full committing path. Inspect the complete contract
  item above, including authority combinations that public publication
  already makes impossible to fabricate. Add the new unit test
  `native_admission_validates_authority_and_allocation` over the production
  validator's exposed input/result: a complete handwritten native contract
  accepts; independently missing/stale authority, mismatched installed-byte
  identity, an invalid saved-union contribution and each malformed allocation
  refuse at the named field/item/task. Include shared aliases with one owner
  and an explicit empty task assignment as positive controls. These are
  constructed unit inputs, not a claim of public native approval; C1 alone
  exercises that boundary. The unit must fail if the new validator/allocation
  checks are absent; a successful publication-only call is insufficient.
- **Verify:** `cargo test -p cadence --lib execution::tests::native_admission_validates_authority_and_allocation -- --exact`
  selects one passing new unit test of complete authority and typed allocation,
  including located refusals and the handwritten valid/empty/shared controls.

### Task 3: Retain immutable admission and explicit set extensions

- **Files:** `crates/cadence/src/execution/admission.rs`,
  `crates/cadence/src/execution/allocation.rs`,
  `crates/cadence/src/execution/boundary.rs`,
  `crates/cadence/src/plan/validation.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/src/execution/tests.rs`.
- **Action:** Deliver P12-A-BASIS and P12-A-EXTENSION's storage portion.
  Add explicit native records and confirmed operations to the existing
  writer/journal protocol. Revalidate the complete contract against the
  committing view, expected set version and installed-byte observations;
  preserve located refusal detail through writer/intent error conversion.
  Keep request replay before fresh-policy interpretation and prevent receipt
  identity reuse with changed payloads. An extension adds a newly approved
  plan identity and retains original bases/outcomes; it cannot rekey old
  records or silently transfer a check's owner. Extend `validation`'s
  admitted-identity protection beyond active/completed dispatches to the
  whole retained set. Preserve original historical codecs and recovery
  semantics rather than adding default fields to canonical old preimages.
  Add `native_admission_commits_versioned_extensions` as one new unit test
  using the actual new writer operations and a real temporary store. Start
  from explicit unit authority inputs, commit admission, reopen, extend with
  a new plan and replay both requests. Expect one original receipt per request,
  an unchanged original basis and exactly one versioned extension. Refuse
  stale set versions, changed replay payloads, admitted-plan replacement and
  a contract invalidated between preparation and the committing snapshot;
  compare protected bytes after reopen. Exercise the new intent validation
  on the same operation, not merely serialization of an old BoundaryV1.
- **Verify:** `cargo test -p cadence --lib execution::tests::native_admission_commits_versioned_extensions -- --exact`
  selects one passing new unit test of confirmed admission/extension, replay,
  committing-view validation and original-record preservation. It must fail
  if the new storage behavior is absent; historical round-trip tests cannot
  substitute for it.

### Task 4: Admit through the real public operation or return a located refusal

- **Files:** `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/execution/admission.rs`,
  `crates/cadence/src/execution/allocation.rs`,
  `crates/cadence/src/execution/boundary.rs`,
  `crates/cadence/src/execution/dispatch.rs`,
  `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/tests/phase12_execution.rs` (new).
- **Action:** Deliver P12-T1-C and complete P12-A-CONTRACT/P12-A-BASIS/
  P12-A-EXTENSION's public path. Write the sole C1 with its valid native
  positive control and invalid cases before replacing blanket refusal.
  Extend the actual query/apply schemas and resident path with strict typed
  native admission and explicit extension inputs; advertise the chosen wire
  contract from its types. Thread located diagnostics without guessing
  identifiers from debug strings. Replace every fresh native
  `require_execution_ready` call site, including reobservation and writer
  dispatch branches, with the complete validator; do not simply delete the
  guard or change a publication's provisional readiness value.
  Bind `execute-next` to the retained admitted set. Provide the narrow
  public authorization-answer path needed to use the existing continuation
  gate for fixture setup, with actual owner input and confirmed evidence;
  never direct-store seeding. Preserve lifecycle, branch, route selection,
  risk-pending and one-active-dispatch rules. The old executor patch must
  always refuse use against a newly admitted native dispatch; until its new
  close protocol exists, native task close is unavailable. Schema-1 receipts
  must never certify the native plan.
  Restore/reopen the historical capture unchanged in C1 and call the same
  real admission path. Replays of the old publication remain historical
  acknowledgments, not execution approval.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_incomplete_execution_contract_is_refused -- --exact`
  reports one pass with the valid control admitted, every invalid case
  located, and protected bytes unchanged after reopen.

### Task 5: Remove overlap scheduling while retaining numeric dispatch

- **Files:** `crates/cadence/src/execution/plan.rs`,
  `crates/cadence/src/execution/dispatch.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/execution/tests.rs`,
  `crates/cadence/tests/phase7_lease.rs`.
- **Action:** Deliver P12-A-ORDER. Replace `PlanGraph::build`'s pairwise
  source-overlap dependency construction with the numeric, one-plan-at-a-time
  selection actually required by D-119. Remove obsolete graph APIs and
  narration if their callers no longer need them; update their existing
  regression assertions to numeric scheduling. Preserve `parse_plan` lease
  validation and all post-commit coverage logic. Do not retain overlap
  computation merely to keep old tests green and do not broaden this into
  parallel worktrees or a scheduler redesign.
  Replace `textual_prefixes_and_exact_files_never_create_recursive_overlap`
  in phase7_lease with `numeric_selection_serializes_disjoint_and_overlapping_plans`:
  for input plans ordered `[5, 3, 1, 2, 4]`, both disjoint and overlapping
  leases yield only `[1]` eligible initially, only `[2]` after plan 1, and
  only `[3]` after plans 1 and 2; all completed yields no selection. The old
  disjoint ready set `[1, 2, 3, 4, 5]` must fail the changed test. Keep path
  coverage assertions separate and intact.
- **Verify:** `cargo test -p cadence --test phase7_lease numeric_selection_serializes_disjoint_and_overlapping_plans -- --exact`
  selects one passing changed scheduling test with the exact eligible sets
  above. Inspect `PlanGraph::build` and its replacement/callers to confirm
  pairwise lease comparisons and overlap prerequisites are gone, while
  `lease::covers` still enforces source scope. C1 is not this task's Verify.

## Notes

Run Plan 2 after this plan, then Plan 3; do not execute shared-file tasks in
parallel. The source leases are exact and have zero report/lockfile exemptions.
No planner command may initialize `/code/cadence/.planning`. The historical
fixture root is owned disposable test data, never the live project or
`/tmp/cadence-phase27-absent-map-df43af15` (including its `.lock`).

The intermediate native path deliberately cannot close via legacy patches.
Plan 2 supplies task closure and Plan 3 supplies suite completion and host
dispatch integration. This is an explicitly scoped three-plan delivery,
not a claim that Plan 1 alone implements cad-execute.
