---
phase: 27
plan: 1
requirements: [T1, T2, T3, T4]
files:
  - crates/cadence/src/lib.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/plan_service.rs
  - crates/cadence/src/plan/mod.rs
  - crates/cadence/src/plan/model.rs
  - crates/cadence/src/plan/inventory.rs
  - crates/cadence/src/plan/validation.rs
  - crates/cadence/src/plan/persistence.rs
  - crates/cadence/src/plan/render.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/filesystem.rs
  - crates/cadence/tests/phase27_plan.rs
---

# Phase 27: Plan persistence and allocation - Plan 1

## Goal

Plans are stored at safe, distinct identities; a mismatched identity or an
out-of-phase path is refused; number allocation is a transaction that a retry
cannot double-allocate; replacement needs owner authorization. This plan
establishes approved publication and ordered batches; PLAN-2 completes gap
publication, replacement, replay and the authoring role.

## Must be true when done

- T1. When the owner approves a valid plan submission, the owner sees its
  approved content at the returned phase and plan identity.
- T2. When a plan submission names an identity different from its
  publication target, the caller is refused persistence with the mismatch
  identified.
- T3. When a plan submission targets a path outside its bound phase, the
  caller is refused persistence at that path.
- T4. When the owner publishes multiple plans for one phase, the owner sees
  distinct plan identities in ascending plan-number order.

## Context

D-80 through D-89 and the carried decisions in CONTEXT.md bind both plans.
Follow phase 11's exact-submission barrier, resident mailbox and confirmed transaction.
Native publication uses the existing strict execution schema, but remains authoring-only.
The evidence-map body is opaque; typed associations, check admission and execution wait for 28, 29 and 12.
PLAN-2 follows sequentially because its files overlap this plan's files.

## Evidence map

Bind each item to its truth's exact approved text in phase 27 CONTEXT.md at
HEAD `b99f2fed`, approved 2026-09-10. The document supplies no numeric truth
version to invent. Rebind if its approved text changes. The seven test names
across these two plans are new acceptance-test names required by the design.
Production identifiers, operation tags and record field names for new code
remain the executor's choice; publish their concrete schema consistently in
the adapter, service, tests and compiled instructions. New paths are creation
leases, not claims of existing symbols.

All checks use `crates/cadence/tests/phase27_plan.rs`. Follow `Client`,
`approve`, `tree` and the reopen procedure in `tests/phase11_context.rs`, and
`Client`, `isolated_client` and `envelope` in `tests/mcp.rs`. Start the actual
`cadence serve --project-root <temporary-project>` binary, initialize stdio MCP,
and call the plan publication operation through `cadence_apply`; use the
compiled plan query operations through `cadence_query` for preview/readback.
Keep transport, public decoding, resident, service, policy, store, journal and
filesystem real. Nothing beyond the clock and approving caller's inputs may
be faked. Isolate global config as those clients do. Handwritten source files,
legacy reports and directory/symlink fixtures are real inputs, not replacement
implementations of storage. Establish native approved truths through the real
`context-submit` operation before plan publication; never substitute a
handwritten CONTEXT.md for native approval.

Each property has one named test function, with table cases and controls inside
it, not additional attributed tests. The expected structural values, bodies,
identity rules and refusal categories are handwritten. A renderer or allocator
under test cannot generate its own expected answer. Each command must select
exactly one test and report `1 passed; 0 failed`; zero selected tests is failure.

Before final assertions, close stdin, wait for the server to exit, drop handles
and reopen the actual PLAN paths, directory listing and store files. Validate
`state.json` with the actual `items.jsonl` and `decisions.jsonl` using
`Snapshot::parse`. Successful publication also reopens `Store` with the real
`Filesystem` and reads `Operation::ReadVerified`. Inspect journal absence
before reopening the writer so recovery cannot disguise an early acknowledgment.
For draft/refusal cases with absent storage or a retained intent, only reopen
read-only paths: opening a writer would itself create or recover state.

There are no link items. These truths describe public results and persisted
content, not a named value handed between two components. The complete real
publication path is already the subject of each check.

### T1

- **P27-T1-C — check.** File `crates/cadence/tests/phase27_plan.rs`, function
  `phase27_approved_plan_is_published_at_returned_identity`.
  Setup: real projects with native approved truths for the bound phase and a
  handwritten strict-schema plan, including requirements, file/directory lease,
  execution schema/suite/tasks and an authored body containing Markdown,
  non-ASCII text and an opaque `## Evidence map` section. Vary body bytes,
  including line endings and final newline. Preview through the public query;
  submit missing/declined approval and changed-copy approval controls, then
  approve the exact content and proposed identity with owner and reported time.
  Include a project with only handwritten CONTEXT and a project whose native
  truths belong to another phase: publication must refuse the missing bound
  approval and lead to context authoring. A retained-intent draft fixture must
  remain untouched. For the otherwise-dispatchable fixture, before launching
  its stdio server, use the owner gate/answer setup specified in PLAN-2 Notes:
  handwritten version-1 progress-gate records, first unanswered and then
  answered with `Proceed`/`approve`, committed through real `SessionFactory`
  and `Session::commit_evidence` with real policy, store and history. This is
  permitted caller input; never seed execution admission records. If this
  setup still cannot make the fixture otherwise dispatchable, report the
  actual blocking prerequisite in C1 rather than infer it from an early
  provisional-readiness refusal. Call: the public plan publication operation,
  followed by public plan readback and `execute-next` for the newly published phase.
  Expected property: no draft/decline or invalid approval writes anything;
  successful publication returns the approved phase/number and revision, whose
  canonical `PLAN-<k>.md` has the handwritten structural values and exact body
  bytes. `parse_plan` accepts the installed document at that identity. Reopened
  records retain the exact approval, typed structure, body, occurrence and
  content revision, with unrelated store data preserved and no pending intent.
  Readback explicitly identifies provisional authoring readiness. In an
  otherwise dispatchable real fixture, `execute-next` refuses this native
  publication by the authoring-readiness rule, names its identity and produces
  no dispatch; mere parser success or opaque map presence cannot admit it.
  An independently authored schema-compatible legacy input remains separately
  classified, rather than being marked native-approved. Boundary real: public
  operations, admission, store and filesystem; fakes only clock/caller inputs.
  Command: `cargo test -p cadence --test phase27_plan phase27_approved_plan_is_published_at_returned_identity -- --exact`.
  Expected: one passing test. Reason: acknowledging a draft, changing authored
  bytes or treating syntax as execution readiness breaks the approved publication.
- **P27-T1-A1 — artifact.** `crates/cadence/src/plan/model.rs`,
  `crates/cadence/src/plan/persistence.rs`, `crates/cadence/src/plan/render.rs`
  and their native records: approved typed structure plus byte-preserved body,
  stable occurrence/plan identity, content revision, approval and publication
  history. Metadata stays outside strict frontmatter. Reason: an in-memory
  execution plan cannot retain publication authority or revision identity.
- **P27-T1-A2 — artifact.** `store/writer.rs` at `Writer::execute_store`,
  `store/transaction.rs` at `IntentKind`, `Intent::validate`, `commit` and
  `recover`, plus `plan/persistence.rs`: a scoped plan-publication participant
  whose snapshot, approved allocation, result receipt and document bytes are
  semantically checked at commit and recovery. Reason: a separate file write
  can acknowledge content without its allocation or approval record.
- **P27-T1-A3 — artifact.** `plan_service.rs`, `plan/model.rs`, `server.rs`
  and `recall/mod.rs`: reachable, root-bound preview/draft/publication/readback
  contracts with native-truth membership and exact approval before `first_touch`
  or any writer request. Reason: even opening storage can mutate an unapproved draft.
- **P27-T1-A4 — artifact.** `execution_service.rs` at `query` and
  `store/writer.rs` at `Writer::boundary_v1`'s `BoundaryChange::Dispatch` arm
  and `Writer::admit_execution`, with dispatch intent validation in
  `store/transaction.rs`: admission consults native publication identity and
  refuses provisional publications independently of file fingerprints.
  Reason: the strict reader already accepts execution-shaped frontmatter.
- **P27-T1-O1 — observation, source O1.** The owner runs `/cad-plan` for a real phase in a real host, sees the
  planner reach the binary's plan publication operation, sees one
  deliberately mismatched identity come back as a typed refusal in the
  conversation, and sees the approved plan land at `PLAN-<k>.md` with
  nothing written before approval. The plan's quality is the model's and is
  not asserted.
  Provenance: specification approved by the owner 2026-09-10 in CONTEXT.md; not yet seen.
  O1 is pending, and is the same observation attached only to T1 here and T7
  in PLAN-2. The executor records a seen episode only when observer, time and
  result are supplied; never invent them or infer them from specification
  approval. Reason: deterministic stdio tests cannot establish real host conduct.
  Accepted observation caps T1 at `concerns`, never `met`.

### T2

- **P27-T2-C — check.** File `crates/cadence/tests/phase27_plan.rs`, function
  `phase27_identity_mismatch_is_refused`.
  Setup: native-approved phases, a known installed winner, and otherwise valid
  approved submissions whose independently supplied phase/plan identity differs
  from the proposed publication target. Cases include same number in a different
  phase and a different number in the same phase. Call the same public
  publication operation; do not invent a destination parameter merely for a
  test if the contract derives paths. Exercise the submitted expected identity
  versus the approved allocation instead. Expected: typed `status: refused`
  identifies the mismatch rule and both submitted and target identities; no
  file, allocation receipt or prior record changes after filesystem/store reopen.
  A matching fresh approval succeeds as the control. Boundary real: public
  decoder, validation, store and filesystem; fakes only clock/caller inputs.
  Command: `cargo test -p cadence --test phase27_plan phase27_identity_mismatch_is_refused -- --exact`.
  Expected: one passing test. Reason: silently rendering a different identity
  would turn approval into permission to retarget.
- **P27-T2-A1 — artifact.** `plan/validation.rs`, `plan/model.rs` and
  `plan_service.rs`: distinct submitted and target identity validation with
  structured refusals, preserving `execution::plan::parse_plan`'s strict schema
  and `identity-mismatch` behavior. Reason: normalizing away a disagreement
  hides the caller's wrong target.

### T3

- **P27-T3-C — check.** File `crates/cadence/tests/phase27_plan.rs`, function
  `phase27_out_of_phase_target_is_refused`.
  Setup: native approved truths and known sentinel bytes outside the bound
  phase. Supply parent traversal, absolute destination and another phase's path
  in raw publication arguments; if destination fields are forbidden, require
  their typed argument refusal to name the rejected path. Also place a real
  symlink at a canonical PLAN target and at its phase-directory ancestor,
  pointing outside the phase. Call the public publication operation with valid
  approval otherwise. Expected: typed refusal names the path-confinement rule
  and attempted/unsafe path; reopened sentinels, plans and native records are
  unchanged, and no outside or alternate PLAN is created. A safe canonical
  target through the same operation succeeds as control. Boundary real: raw
  public request, filesystem path resolution, ownership and store; only
  clock/caller inputs may be faked.
  Command: `cargo test -p cadence --test phase27_plan phase27_out_of_phase_target_is_refused -- --exact`.
  Expected: one passing test. Reason: string-only confinement misses filesystem aliases.
- **P27-T3-A1 — artifact.** `store/filesystem.rs` at `Filesystem::target`,
  `Filesystem::read`, `ensure_directory`, `prepare`, `install` and `confirm`,
  with `plan_service.rs`'s error mapping and `Intent::validate`: only canonical
  phase/number PLAN targets, safe bound directories and precise public refusals.
  Reason: admitting arbitrary external paths creates another document writer.

### T4

- **P27-T4-C — check.** File `crates/cadence/tests/phase27_plan.rs`, function
  `phase27_multiple_plans_have_distinct_numeric_order`.
  Setup: native approved truths, occupied identities through 8, and three
  handwritten plans with distinct bodies and overlapping source leases. Two
  callers preview the same next allocation without reserving it. Call the
  publication operation with approval for the ordered three-plan batch; then
  submit the competing, now-stale approved preview through that operation.
  Expected: confirmed batch returns `[9, 10, 11]` in approved order with each
  body at its own identity; public listing is numerical and agrees with the
  reopened directory's `PLAN-9.md`, `PLAN-10.md`, `PLAN-11.md` and store records.
  Directory iteration itself need not be ordered. The loser receives a precise
  conflict naming the changed target/precondition, changes nothing and cannot
  silently allocate 12. Fresh preview/approval may then publish 12. Include a
  final-entry target conflict proving the batch does not partly publish, and
  a high-water `u32::MAX` case that refuses exhaustion rather than wrapping.
  Boundary real: interleaved public requests, existing queue/ownership,
  conditional transaction, listing, store and filesystem; fakes only
  clock/caller inputs. Read the actual directory listing after server exit.
  Command: `cargo test -p cadence --test phase27_plan phase27_multiple_plans_have_distinct_numeric_order -- --exact`.
  Expected: one passing test. Reason: lexical order, independent per-file
  transactions or automatic reallocation violates the approved ordered result.
- **P27-T4-A1 — artifact.** `plan/inventory.rs`, `plan/persistence.rs`,
  `plan_service.rs` and the plan-publication branches in `store/writer.rs` and
  `store/transaction.rs`: occurrence-scoped monotonic allocation, read-only
  previews and an ordered batch committed with its high-water and assigned
  results. Reason: listing names and incrementing outside publication races
  approval and cannot establish a durable allocation.

## Tasks

### Task 1: Expose read-only plan authoring intake

- **Files:** `crates/cadence/src/lib.rs`, `crates/cadence/src/server.rs`
  (`QueryArguments`, `ApplyArguments`, `QueryOutput`, `ApplyOutput`, `PublicServer`),
  `crates/cadence/src/recall/mod.rs` (`Request`, `Resident::context`,
  `Resident::spawn_with_driver`), `crates/cadence/src/plan_service.rs` (new),
  `crates/cadence/src/plan/mod.rs` (new),
  `crates/cadence/src/plan/model.rs` (new),
  `crates/cadence/src/plan/inventory.rs` (new),
  `crates/cadence/src/plan/persistence.rs` (new).
- **Action:** Deliver P27-T1-A3 and the record/read-only portions of P27-T1-A1
  and P27-T4-A1. Add plan operations to the existing query/apply families and
  resident, before the execution fallback. Model an ordered publication with
  independently stated proposed identities, strict structural plan fields,
  preserved authored body, phase occurrence, durable caller request id and
  exact approval; do not prescribe a new operation spelling from this plan.
  Publish the actual strict schema from compiled types. Drafts and previews
  read existing files and verified snapshot bytes following
  `context::persistence::read_snapshot`; they never call `first_touch`, acquire
  ownership, recover an intent, create parents/config, persist a token or log a
  refusal. Intake/research may run without approved truths, but must identify
  that native publication needs context authoring. Keep legacy Markdown
  readable as raw input, including bare PLAN and decimal-phase addresses;
  native publication identities are canonical positive integers only.
  Inventory legacy disk/report/execution identities conservatively without
  marking them approved. Preview uses a high-water proposal, not a reservation.
  Define the explicit active-cycle occurrence and provisional publication
  record needed by Task 2, with the lifetime in Notes. Exact approval requires
  owner, caller-reported time, full content and proposed identities; no extra
  truth attestations or reviewer gate. Missing/declined approval is a draft.
  Reject attempted approved writes until Task 3's transaction is reachable;
  never return a persisted result from this read-only path.
- **Verify:** `cat crates/cadence/src/plan_service.rs crates/cadence/src/plan/model.rs crates/cadence/src/plan/inventory.rs crates/cadence/src/plan/persistence.rs crates/cadence/src/server.rs crates/cadence/src/recall/mod.rs`
  opens the artifacts for inspection: actual query/apply routing, raw legacy
  input, non-reserving preview, exact approval model and no writer call on
  draft/read paths must be present. This is artifact inspection, not another check.

### Task 2: Block provisional publications at execution admission

- **Files:** `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/execution_service.rs` (`query`, `observe_plans`, `reobserve`),
  `crates/cadence/src/store/writer.rs` (`Writer::boundary_v1`,
  `Writer::admit_execution`), `crates/cadence/src/store/transaction.rs`
  (`Intent::validate`, execution dispatch intent branches).
- **Action:** Deliver P27-T1-A4 before enabling publication. This is D-88's
  concrete admission check: consult the native plan-publication records for
  the bound occurrence and visible identities, and refuse any provisional
  native member of the candidate execution set before returning an active
  dispatch, constructing a new dispatch or admitting a changed set. Identify
  the plan and authoring-only rule in the public refusal. Repeat the membership
  check against the writer's current snapshot in both dispatch admission
  paths, and validate it for dispatch intents on recovery. Match ownership by
  stable identity even if the PLAN bytes/fingerprint drift; a changed digest
  cannot turn a native publication into legacy execution. Do not infer
  readiness from `execution.schema`, presence of `## Evidence map`, old
  SUMMARY/UAT or a plan-set digest. Preserve legacy execution's separate path
  and existing changed-set handling. No acceptance-map validator, new execution
  lifecycle, completion reopening or phase-12 reconciliation belongs here.
- **Verify:** `cat crates/cadence/src/plan/persistence.rs crates/cadence/src/execution_service.rs crates/cadence/src/store/writer.rs crates/cadence/src/store/transaction.rs`
  shows the identity-based refusal before dispatch/replay, in both serialized
  admission branches and dispatch recovery validation, while legacy behavior
  is retained. Inspect P27-T1-A4; Task 3's single T1 check exercises the public gate.

### Task 3: Publish exact approved content through the store

- **Files:** `crates/cadence/src/plan/mod.rs`,
  `crates/cadence/src/plan/model.rs`, `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/plan/render.rs` (new),
  `crates/cadence/src/plan_service.rs`,
  `crates/cadence/src/store/writer.rs` (`Operation::CompareTransact`,
  `Writer::execute_store`, `Writer::persist`, `Operation::ObserveContext`),
  `crates/cadence/src/store/transaction.rs` (`IntentKind::ContextPublication`,
  `ExternalChange`, `Intent::validate`, `commit`, `recover`),
  `crates/cadence/src/store/filesystem.rs` (`Filesystem::target`,
  `phase_context_target`, `Filesystem::read`, `ensure_directory`),
  `crates/cadence/tests/phase27_plan.rs` (new).
- **Action:** Deliver P27-T1-C, complete P27-T1-A1/A2/A3 and carry P27-T1-O1.
  Write the full C1 test first and record red, then establish the complete
  public-to-filesystem path by this third task. Recheck native approved truths
  for the bound phase using `context::persistence::saved`; merely having a
  CONTEXT file or positive phase number is insufficient. Reject invalid exact
  approval before `SessionFactory::first_touch` or any writer request. After
  approval, recheck membership and allocation against the verified current
  snapshot. Store typed structural fields and the byte-preserved authored body
  in a dedicated plan namespace within `Snapshot.data`, preserving unrelated
  data and provenance. Render only the approved canonical identity and the
  existing strict native frontmatter, including its mandatory execution block;
  parse the final document through `execution::plan::parse_plan` before
  acknowledgment. Approval, revision and map metadata stay in native records.
  Store an explicit provisional publication, stable identity, content revision,
  history and the request's exact payload digest/assigned result in the same
  transaction as its high-water advance and PLAN bytes. Persist no reservation.
  Add a scoped PLAN participant, modeled on context publication rather than a
  general writable path. Validate its target, exact approval, record delta,
  allocated identity and bytes in both writer and intent recovery. Use
  `CompareTransact` generation/integrity and expected-file observations under
  existing ownership; revalidate the inventory basis as well as target absence.
  Canonical target mapping and safe parent creation belong to the filesystem
  owner after approval. Retain temp sync, rename, directory sync, installed-byte
  confirmation, snapshot-last installation and intent removal before success.
  A pending or failed transaction is not acknowledged. Refuse occupied targets
  until PLAN-2's explicit native replacement path is implemented; legacy inputs
  remain read-only. Readback returns identity, revision, content and provisional
  readiness without acquiring a writer. No map associations or validity claims.
- **Verify:** `cargo test -p cadence --test phase27_plan phase27_approved_plan_is_published_at_returned_identity -- --exact`
  selects one passing test with C1's reopened content/records and real admission
  refusal. Record red and green commits; rendered prose is not the oracle.

### Task 4: Refuse mismatched publication identities

- **Files:** `crates/cadence/src/plan/mod.rs`,
  `crates/cadence/src/plan/validation.rs` (new),
  `crates/cadence/src/plan/model.rs`, `crates/cadence/src/plan_service.rs`,
  `crates/cadence/src/server.rs` (`PublicServer`, query/apply schemas),
  `crates/cadence/tests/phase27_plan.rs`.
- **Action:** Deliver P27-T2-C and P27-T2-A1. Write C2 and record red before
  completing precise mismatch refusal. Compare submitted identity, approved
  proposed identity and canonical publication identity before writing. Keep
  the native reader's canonical positive-u32 rules and strict unknown-field
  refusal; do not loosen `parse_plan` or import the frozen flat-list grammar
  into native schema admission. Refuse disagreement without rewriting it into
  a match, including wrong phase with the same plan number. Preserve enough
  raw input to produce a plan-specific structured refusal naming rule and both
  identities instead of falling into the executor-patch decoder. Reuse the
  validation during transaction semantic validation; approval cannot bless a
  different destination. Matching controls must still publish.
- **Verify:** `cargo test -p cadence --test phase27_plan phase27_identity_mismatch_is_refused -- --exact`
  selects one passing test naming both identities with the winner unchanged.

### Task 5: Refuse paths outside the bound phase

- **Files:** `crates/cadence/src/plan/validation.rs`,
  `crates/cadence/src/plan_service.rs`,
  `crates/cadence/src/server.rs` (`PublicServer::call_tool`),
  `crates/cadence/src/store/filesystem.rs` (`Filesystem::target`,
  `Filesystem::read`, `ensure_directory`),
  `crates/cadence/src/store/transaction.rs` (`Intent::validate`),
  `crates/cadence/tests/phase27_plan.rs`.
- **Action:** Deliver P27-T3-C and P27-T3-A1. Write C3 and record red before
  completing public path refusal. Derive PLAN targets solely from the bound
  phase/number; do not accept caller roots or general document destinations.
  Name a supplied forbidden destination in the typed argument refusal. Extend
  the context target's ownership and ancestor-identity checks to plan paths,
  including actual symlinks/nonregular targets and replaced directories. Check
  unsafe existing paths without creating anything on refused paths. Preserve
  the same confinement in participant observation, preparation and recovery;
  persisted intents cannot smuggle arbitrary paths. Translate confinement
  errors into public typed refusals naming the unsafe path and rule without
  swallowing genuine I/O failures as successful publication. Retain the
  existing ownership protocol; no second writer or reader-startup exclusion.
- **Verify:** `cargo test -p cadence --test phase27_plan phase27_out_of_phase_target_is_refused -- --exact`
  selects one passing test with untouched reopened outside sentinels and store.

### Task 6: Allocate an ordered batch atomically

- **Files:** `crates/cadence/src/plan/model.rs`,
  `crates/cadence/src/plan/inventory.rs`,
  `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/plan_service.rs`,
  `crates/cadence/src/store/writer.rs` (`Writer::execute_store`,
  `Operation::CompareTransact`), `crates/cadence/src/store/transaction.rs`
  (`IntentKind`, `Intent::validate`), `crates/cadence/tests/phase27_plan.rs`.
- **Action:** Deliver P27-T4-C and complete P27-T4-A1. Write C4 and record red.
  Allocate every member of the approved ordered submission in one publication
  transaction, using checked high-water arithmetic, not independent per-plan
  writes. The durable advance occurs only with its plans and assigned results.
  Validate uniqueness, same occurrence/phase, approved order and the entire
  participant set; reject mixed context/config/summary participants and missing
  or extra PLAN participants in a plan publication, including during recovery.
  Previews remain read-only and may propose the same numbers. Revalidate their
  observed inventory/high-water and file preconditions under the existing
  ownership/queue immediately before commit. A competing approval that loses
  receives the changed target or snapshot/allocation precondition as a precise
  typed conflict, without number reassignment; require fresh preview/approval.
  Preserve `CompareTransact` semantics rather than introducing another owner.
  Readback sorts visible identities numerically while retaining approved
  body-to-number pairing. Refuse numeric exhaustion before publishing any part
  of the batch. Overlapping task leases do not collapse distinct plans or
  authorize their execution. Confirm the entire transaction before returning
  success; do not promise instantaneous visibility to arbitrary readers.
- **Verify:** `cargo test -p cadence --test phase27_plan phase27_multiple_plans_have_distinct_numeric_order -- --exact`
  selects one passing test with the actual directory listing, ordered returned
  identities and preserved winning batch after the competing request is refused.

## Notes

- Execute six tasks here, then PLAN-2's four tasks, sequentially. Ten concerns
  exceed the eight-task ceiling. The dispatch expressly allows shared-file
  sequential plans and overrides the contract/template's independence-only
  split wording. There is no parallel slice and no change to phase numbering.
- D-87 lifetime choice: bind publication records and receipts to an explicit,
  durably retained phase occurrence in this project's active planning cycle.
  Establish it with the first approved publication and reuse it thereafter;
  preview may describe it but cannot reserve it. The current `Cycle` enum is
  only Live/Closed, and `ExecutionOccurrence` is keyed by phase string with a
  mutable set fingerprint; neither supplies a permanent occurrence identity.
  Keep this implementation scoped to the active cycle, retain its occurrence
  and consumed numbers across deletion/restart, and do not silently reset it
  when directories or roadmap prose change. Publication into archived/another
  cycle requires explicit resolution; cycle migration remains deferred.
- PLAN-2 supplies the compiled authoring-only `/cad-plan` front door. The
  publication/query operations here are provisional authoring APIs, not the
  completed acceptance-aware workflow. No task executes a submitted plan's
  commands, writes typed evidence, updates truth status, revises truths, reopens
  completed execution or ports review/selected-edit, requirement/cursor writers.
- These implementation plans follow the requested frozen planning template;
  they are orchestrator-owned planning deliverables, not examples of the new
  strict native publication schema. D-81 governs what the implemented binary
  will publish; it does not authorize rewriting existing planning documents.
- Verified at `b99f2fed`: context modules and service approval barrier/replay;
  `Snapshot.operations` as id-to-fingerprint only; context's one-participant
  writer/intent mapping; filesystem locking and confirmation; strict native
  `parse_plan`, `plan_number` and phase-keyed execution occurrence; public
  query/apply schemas and resident routing; real stdio/reopen test patterns.
  Frozen `plan.md` at `load_phase`, `spawn_planner`, `too_big` and `review`,
  `plan-gaps.md` steps 3-4, `planning/core.mjs` at `planNumber` and
  `readPlanReports`, the frozen PLAN template and phase 10/11 plans establish
  human-readable shape and legacy occupancy, not new write authority. These
  source anchors verify the relied-on research A/B/C claims against this tree.
- Write each check before its implementation and record actual red and green
  commits. Missing test targets and zero selected tests are not red evidence.
  Task Verify runs only the named test or artifact-inspection binary. The
  executor runs the full suite once at plan close, outside task Verify; the
  verifier runs only mapped checks and inspects artifacts/observations. If
  clippy is required at execution close, use
  `cargo clippy --workspace --all-targets -- -D warnings`; it reads no stdin.
  This planner ran no build, tests or clippy and made no commit.
- Live host behavior and model plan quality remain knowingly untested by these
  checks. O1 remains pending/not yet seen with its specification provenance
  and observation cap; record a seen episode only with supplied observer, time
  and result.
