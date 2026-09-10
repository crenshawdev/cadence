---
phase: 28
plan: 1
requirements: [T1, T2, T3, T4, T5]
files:
  - crates/cadence/src/plan/mod.rs
  - crates/cadence/src/plan/model.rs
  - crates/cadence/src/plan/evidence.rs
  - crates/cadence/src/plan/associations.rs
  - crates/cadence/src/plan/map_history.rs
  - crates/cadence/src/plan/persistence.rs
  - crates/cadence/src/plan/validation.rs
  - crates/cadence/src/plan/render.rs
  - crates/cadence/src/plan_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/tests/phase27_plan.rs
  - crates/cadence/tests/phase28_evidence.rs
---

# Phase 28: Evidence associations - Plan 1

## Goal

A plan's evidence map attaches to the phase's current truths; a map that
leaves a truth uncovered, an item naming no truth, or an item naming a stale
truth version is refused. This plan delivers typed publication and the four
association refusals; PLAN-2 completes history, replay and authoritative readback.

## Must be true when done

- T1. When a valid evidence map is accepted for a plan publication, the owner
  sees the submitted items attached to the phase's current truths in that
  plan.
- T2. When a submitted evidence map leaves a current phase truth uncovered,
  the caller is refused the map with that truth identified.
- T3. When a submitted evidence map gives a current phase truth no check, the
  caller is refused the map with that truth identified.
- T4. When a submitted evidence item names no truth in the bound phase, the
  caller is refused the map with that item identified.
- T5. When a submitted evidence item names a truth version different from
  the current approved version, the caller is refused the map with the stale
  association identified.

## Context

D-90 through D-98 and all carried decisions in CONTEXT.md bind both plans.
Extend phase 27's exact approval, `contribute` and `validate_publication`; reuse its writer and recovery path.
Read native truths through `context::persistence::saved`; Markdown is never approval or association authority.
Phase 29 owns the second-check and check/link-content refusals; phase 12 owns execution activation.
PLAN-2 follows sequentially because it changes the same publication and test files.

## Evidence map

These items serve the owner-approved phase 28 CONTEXT.md, specification approved
2026-09-10 at dispatch HEAD `7d5ccc4f`. This handwritten implementation plan does
not establish that this repository already has a native approved context or a
native map. At native publication, obtain each numeric association version from
that occurrence's actual approved truth record; phase 11 currently creates 1.
Never derive it from this heading, an item id, the approval date or O1's source.
The test fixtures deliberately author native version-1 truths through phase 11.

All checks below live in the new `crates/cadence/tests/phase28_evidence.rs`.
Use the real `Client`, `approve`, `native_context`, `snapshot`, `tree` and
`reopened` patterns read in `crates/cadence/tests/phase27_plan.rs`, adapting
caller inputs rather than importing that file's attributed tests. Start
`cadence serve --project-root <temporary-project>` with isolated global config,
initialize stdio MCP, author the bound phase's truths using real
`cadence_apply` / `context-submit`, and obtain allocation through
`cadence_query` / `plan-read`. Publish only through `cadence_apply` /
`plan-submit`, including its exact owner approval. Read public results through
the actual query operation, not an in-process replacement service.

Transport, public decoding, resident, service, native context, policy, queue,
conditional transaction, journal, store and filesystem stay real. Nothing
beyond the clock and caller inputs may be faked. File edits used as drift or
legacy inputs are actual filesystem operations. Every property is one named
test function; table cases and controls stay inside it. Never add another
attributed test for a truth, an internal helper or an artifact. Handwrite the
submitted content, expected associations, specs, reasons and refusal outcomes;
do not ask the renderer or validator under test for its expected answer.

Before final assertions, close stdin, wait for the server to exit, release its
handles and reopen PLAN files and `state.json`, `items.jsonl`, `decisions.jsonl`.
Parse the actual bytes with `Snapshot::parse`. After successful writes check
that `.store-intent.json` is absent BEFORE opening a new real `Filesystem` /
`Store` and reading `Operation::ReadVerified`. For refusals compare the reopened
files and snapshot with their pre-call bytes; do not open a writer to recover
a deliberately retained intent. A fresh server must also read saved results.
Each command must select exactly one test and report `1 passed; 0 failed`;
zero selected tests or a missing test target is not evidence.

No link items are added to this phase's map: T1-T7 describe attachment,
refusal, supersession and readback, with no named value crossing between two
components. C1's submitted link is fixture DATA demonstrating the four-kind
grammar, attached to a fixture truth that explicitly names that handoff. It
is not another link or acceptance test in this implementation plan.

### T1

- **P28-T1-C — check.** File `crates/cadence/tests/phase28_evidence.rs`, function
  `phase28_accepted_map_is_attached_to_published_plan`.
  Setup: native truths with handwritten ids, including an opaque id that does
  not resemble T1, and a fixture truth saying that a sender hands a recipient
  a named value. Submit a complete four-kind map with full specs, item reasons,
  per-truth reasons and version 1, including a shared artifact/observation.
  Give each fixture truth exactly one check. Vary ids, ordering, Unicode and
  surrounding body line endings/final newline. Include first publication and
  explicitly approved replacement of a phase-27-style provisional publication
  whose old Evidence map is only prose. Do not import that prose as authority.
  Call: `plan-read` allocation, its new complete-submission preview, then
  `plan-submit` with approval of exactly the previewed submission; `plan-read`
  and restart/readback afterward. Draft, decline, changed map after approval,
  duplicate section and typed/prose disagreement are controls in this test.
  Expected property: preview shows the actual replacement section and final
  document without writing; invalid/declined proposals leave reopened state
  unchanged. Acknowledgment installs one canonical Evidence map section whose
  items, associations and reasons match handwritten values; bytes outside that
  section remain unchanged. The reopened store retains those typed values
  bound to the returned occurrence, plan identity and digest of the actual
  installed document, and retains the exact combined approval. Shared ids
  remain opaque and an observation is pending specification, never a result.
  No typed metadata leaks into strict frontmatter and no digest embeds itself
  in the bytes being hashed. Existing mapless history stays mapless.
  Readiness remains `provisional-authoring`; no execution/status claim is made.
  Boundary real: complete public publication, store and filesystem; only
  clock/caller inputs may be faked, with the reopen protocol above.
  Command: `cargo test -p cadence --test phase28_evidence phase28_accepted_map_is_attached_to_published_plan -- --exact`.
  Expected command result: one passing test. Item reason: separating the map
  write from the approved document would attach evidence to unapproved content.
  Association reason for T1: lost typed values or changed projection breaks the
  owner's visible attachment.
- **P28-T1-A1 — artifact.** `crates/cadence/src/plan/evidence.rs`,
  `plan/model.rs`, `plan/mod.rs`: substantive typed four-kind input, explicit
  associations, item/per-association reasons and the derived public schema.
  Reason: opaque body bytes cannot identify evidence for later consumers.
  Association reason for T1: this is the submitted set the owner must see saved.
- **P28-T1-A2 — artifact.** `plan/persistence.rs` at `contribute`,
  `validate_publication`, `payload_digest` and `validate_old_document`, plus
  new `plan/map_history.rs`: a dedicated acceptance-map namespace, publication
  bindings and exact combined snapshot contribution. Inspect its real callers
  in `store/writer.rs` at `Writer::execute_store` and `store/transaction.rs`
  at `Intent::validate`; their existing algebra must validate this same map
  delta at commit and recovery. Reason: a side write escapes exact approval.
  Association reason for T1: attachment must survive durable publication.
- **P28-T1-A3 — artifact.** `plan/render.rs`, `plan_service.rs`, `server.rs`
  at `QueryArguments` and `PublicServer::call_tool`: binary-owned map rendering,
  read-only complete-submission preview and exact approved publication.
  Reason: two owners of the section can disagree about the accepted map.
  Association reason for T1: preview and the installed plan must show the same set.
- **P28-O1 — observation, source O1; shared with T7 in PLAN-2.** The owner runs
  `/cad-plan` for a real phase in a real host, sees the planner submit its
  evidence map with the plan, sees one deliberately uncovered truth come back
  as a typed refusal in the conversation, and sees the approved plan land with
  its map attached and readable back. The map's quality is the model's and is
  not asserted. Specification provenance: `.planning/phases/28/CONTEXT.md`,
  Observations / O1, approved by the owner 2026-09-10. **Pending; not yet seen.**
  Item reason: deterministic stdio checks cannot establish real host conduct.
  Association reason for T1: the owner must see the host submit and publish the
  attached map. Association reason for T7: the owner must see authoritative
  readback in the host. This is one item with two explicit associations, not
  two observations and never a replacement check. No observer/time/result is
  fabricated; recording a later episode/verdict is phase 13. Even when seen,
  O1 caps its associated truths at `concerns`, never `met`.

### T2

- **P28-T2-C — check.** File `crates/cadence/tests/phase28_evidence.rs`, function
  `phase28_uncovered_current_truth_is_refused`.
  Setup: two native approved truths and otherwise valid maps. Cases submit
  only T1's association, an empty attached map, and a replacement batch that
  removes the sole contribution for T2. An initial two-plan batch separately
  contributing T1 and T2 is the covered control; later gap publication may
  rely on those saved current contributions. For the replacement case approve
  a new publication and explicit new map; old maps cannot supply coverage.
  Call: the same public `plan-submit`, also exercising complete preview.
  Expected property: `status: refused`, a rule specifically identifying
  uncovered-truth coverage, the bound phase and full missing truth id (T2 in
  the single-missing case), with reopened plans, receipts and snapshot unchanged.
  The covered batch succeeds atomically and the gap control succeeds without
  copying all prior items into its own contribution. No per-file coverage
  requirement, historical contribution or last-write-wins merge is used.
  Boundary real: public operation, native truths, replacement, store and
  filesystem; only clock/caller inputs may be faked; reopen as above.
  Command: `cargo test -p cadence --test phase28_evidence phase28_uncovered_current_truth_is_refused -- --exact`.
  Expected: one passing test. Item reason: checking an individual plan or counting
  the replaced map misidentifies phase coverage. Association reason for T2:
  this causes its missing-association trigger and checks the named refusal.
- **P28-T2-A1 — artifact.** New `plan/associations.rs`, `plan/persistence.rs`
  at `contribute`: the resulting current phase union after the whole batch's
  replacements, with deterministic uncovered-truth diagnostics. Reason: the
  old contribution must leave the candidate set before coverage is decided.
  Association reason for T2: this set is the authority for uncovered truths.

### T3

- **P28-T3-C — check.** File `crates/cadence/tests/phase28_evidence.rs`, function
  `phase28_current_truth_without_check_is_refused`.
  Setup: native T1/T2 with every truth associated, but T2 served by an artifact,
  observation, link, or artifact plus pending observation, with no check.
  Other fixture truths have their checks. Include a two-plan case where T2's
  check is in a saved current contribution, and a replacement removing that
  check while preserving T2's artifact. Fixture link truth names its value.
  Call: public `plan-submit`. Expected: typed no-check refusal identifies T2
  and its phase, distinct from uncovered-truth, with no durable change after
  reopening. Explicitly supplying T2's single check succeeds; a saved current
  check also satisfies the lower bound. Observations never count as checks.
  Boundary real: public operation, native truths, store and filesystem; only
  clock/caller inputs may be faked; reopen as above.
  Command: `cargo test -p cadence --test phase28_evidence phase28_current_truth_without_check_is_refused -- --exact`.
  Expected: one passing test. Item reason: counting observations as checks hides
  the absence of reproducible evidence. Association reason for T3: the cases
  isolate check absence while retaining item coverage.
- **P28-T3-A1 — artifact.** `plan/associations.rs`, `plan_service.rs`: a separate
  phase-wide required-check diagnostic using item kind and current associations.
  Reason: item coverage alone does not implement D-90's lower bound.
  Association reason for T3: this produces the truth-specific no-check refusal.

### T4

- **P28-T4-C — check.** File `crates/cadence/tests/phase28_evidence.rs`, function
  `phase28_item_without_bound_truth_is_refused`.
  Setup: an otherwise covered native phase plus a submitted item with no
  association, an unknown full truth id, an id existing only in another native
  phase, or both a valid and an invalid association. Include opaque ids with
  similar suffixes, shared ids across plans with equal definitions as controls,
  and conflicting definitions of one shared id in the candidate set.
  Call: public `plan-submit`. Expected: typed orphan/membership refusal names
  the offending full item id, bound phase and association location/requested
  truth where supplied; one good association cannot hide another bad edge.
  Empty associations identify the item itself. Conflicting shared definitions
  produce a distinct identity-conflict refusal naming the id and contributions;
  identical shared definitions preserve both explicit association reasons.
  The corrected map publishes; every refusal leaves reopened state unchanged.
  Boundary real: public operation, native records, store and filesystem; only
  clock/caller inputs may be faked; reopen as above.
  Command: `cargo test -p cadence --test phase28_evidence phase28_item_without_bound_truth_is_refused -- --exact`.
  Expected: one passing test. Item reason: suffix parsing or accepting one valid
  edge can silently attach an item outside its approved phase. Association
  reason for T4: this exercises absent and unresolved truth membership directly.
- **P28-T4-A1 — artifact.** `plan/evidence.rs`, `plan/associations.rs`,
  `plan_service.rs`: opaque item identity, explicit full-id membership checks,
  shared-definition reconciliation and located typed refusals. Reason: a shared
  id must not overwrite another definition. Association reason for T4: every
  supplied edge needs an actual bound-phase truth.

### T5

- **P28-T5-C — check.** File `crates/cadence/tests/phase28_evidence.rs`, function
  `phase28_noncurrent_truth_version_is_refused`.
  Setup: approve native T1/T2 through `context-submit` (actual version 1), then
  submit a complete map with one requested version 2, 0, or another unequal
  representable numeric version. Include a shared item whose first association
  is current and second is unequal. A missing version is a separate malformed
  association control, never silently defaulted to 1. Matching text/id spelling
  cannot rescue the wrong numeric version. Call: public `plan-submit`.
  Expected: typed version refusal identifies item, full truth id, association
  location, requested numeric version and current 1 in the bound phase;
  missing version identifies the missing slot. All reopened state is unchanged.
  The explicit version-1 control publishes. Missing native context is distinctly
  refused with current authority absent and `context-submit` guidance, not
  reported as a version mismatch. No test synthesizes a native truth revision.
  Boundary real: public operation, phase-11 approval, store and filesystem;
  only clock/caller inputs may be faked; reopen as above.
  Command: `cargo test -p cadence --test phase28_evidence phase28_noncurrent_truth_version_is_refused -- --exact`.
  Expected: one passing test. Item reason: historical existence or equal text
  cannot authorize attachment to a noncurrent truth version. Association reason
  for T5: the submitted unequal edge must be named without silent rebinding.
- **P28-T5-A1 — artifact.** `plan/associations.rs`, `plan/persistence.rs`
  at `contribute` / `validate_publication`, `plan_service.rs`: comparisons to
  actual current native truth versions on the committing snapshot, reused
  during recovery. Reason: pre-approval lookup alone may validate stale inputs.
  Association reason for T5: equality must be decided against native authority.

## Tasks

### Task 1: Define the typed map submission contract

- **Files:** `crates/cadence/src/plan/evidence.rs` (new),
  `crates/cadence/src/plan/mod.rs`, `crates/cadence/src/plan/model.rs`
  (`Content`, `Submission`, `ReplacementApproval`, `contract`),
  `crates/cadence/src/plan_service.rs` (`execute`),
  `crates/cadence/tests/phase27_plan.rs` (`request`, `replacement_request`).
- **Action:** Deliver P28-T1-A1. Define the wire grammar chosen in Notes,
  preserving all four specs, reasons and explicit per-truth associations.
  Extend the existing approved content, not an attach operation; replacement's
  copy of `Content` and the outer exact submission consequently include the
  entire map. Preserve deserialization and byte-equivalent reserialization of
  old mapless publications/approvals/receipts with absent optional fields;
  never default an old map into an approved attachment. New mapless requests
  must explicitly choose provisional authoring. Update phase 27's request
  fixtures to choose that mode while keeping their opaque-body expectations;
  do not rewrite old maps or expand those tests into phase-28 acceptance checks.
  Keep map metadata out of native execution frontmatter. Derived schema must
  advertise the typed map through the existing `contract` entrypoint. Do not
  acknowledge an attached request until Task 2 can persist its complete set.
  This task establishes grammar only, not validity or a saved-map claim.
- **Verify:** `cat crates/cadence/src/plan/evidence.rs crates/cadence/src/plan/model.rs crates/cadence/src/plan/mod.rs crates/cadence/src/plan_service.rs crates/cadence/tests/phase27_plan.rs`
  opens P28-T1-A1 for inspection: every chosen kind/association field exists,
  is in the actual derived contract, old absent fields stay absent on replay,
  explicit provisional fixtures retain their original test subjects, and no
  attached request can be falsely acknowledged. Artifact inspection, not a check.

### Task 2: Publish the previewed map with its plan

- **Files:** `crates/cadence/src/plan/mod.rs`,
  `crates/cadence/src/plan/model.rs` (`Publication`, `Receipt`),
  `crates/cadence/src/plan/map_history.rs` (new),
  `crates/cadence/src/plan/persistence.rs` (`contribute`, `validate_publication`,
  `validate_old_document`, `payload_digest`),
  `crates/cadence/src/plan/validation.rs` (`replacement`),
  `crates/cadence/src/plan/render.rs` (`document`),
  `crates/cadence/src/plan_service.rs` (`Command`, `execute`, `path_error`),
  `crates/cadence/src/server.rs` (`QueryArguments`, `PublicServer::call_tool`),
  `crates/cadence/tests/phase28_evidence.rs` (new).
- **Action:** Deliver P28-T1-C and P28-T1-A2/A3; carry P28-O1 as pending.
  Write C1 first, observe its behavioral failure, then establish the complete
  publication path by this second task. Extend `plan-read` with complete-draft
  preview as specified in Notes, passing it through the existing resident plan
  command. Render one dedicated section, preserve outside bytes, and return the
  complete final submission/documents for approval. Reject ambiguous sections
  and typed/prose disagreement before approval; show the old and proposed
  section on replacement. Never parse shipped prose into approved items.
  Validate exact approval before `first_touch` or any writer request, then
  include the acceptance-map namespace in the same `contribute` result as the
  publication, receipt and canonical document. Store immutable map payloads
  bound to occurrence, request receipt, plan identity and resulting content
  digest, without a self-referential digest in the plan section. No independent
  allocator or second transaction. `validate_publication` must reconstruct the
  entire expected snapshot including maps, and its existing writer and intent
  callers must continue enforcing that equality during commit and recovery.
  Reuse `CompareTransact` generation/integrity, observed old PLAN bytes, safe
  target handling, confirmed participant installation and snapshot-last
  completion. Do not change generic writer/filesystem semantics. Preserve old
  receipt serialization and `require_execution_ready`'s mechanical refusal.
  This is one vertical publication concern; its larger file lease is the real
  public-to-store path, not a collection of unrelated scaffolding tasks.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_accepted_map_is_attached_to_published_plan -- --exact`
  selects one passing C1 with handwritten installed map values and reopened
  approval/publication/map records; record its actual red and green commits.

### Task 3: Refuse an uncovered truth in the resulting phase set

- **Files:** `crates/cadence/src/plan/associations.rs` (new),
  `crates/cadence/src/plan/mod.rs`,
  `crates/cadence/src/plan/persistence.rs` (`contribute`, `validate_publication`),
  `crates/cadence/src/plan_service.rs` (`execute`, `path_error`),
  `crates/cadence/tests/phase28_evidence.rs`.
- **Action:** Deliver P28-T2-C and P28-T2-A1. Write C2 and observe red.
  Construct the candidate phase map from current saved contributions, removing
  every batch target's old contribution before adding all proposed attached
  maps. Resolve explicit shared ids as a union, with their contribution origins
  preserved. Initial split maps publish together; later gap maps may rely on
  current saved contributions. Retired, noncurrent-plan and unequal-version
  associations never cover a truth. Refuse an attached publication if any
  current native truth has no association; identify phase and full truth id in
  the typed answer. An explicit provisional mapless publication is not an
  accepted map and contributes nothing; expose resulting missing coverage,
  never pretend that provisional authoring has passed it. Run the same
  candidate calculation in preview and `contribute` against the actual writer
  snapshot; conditional conflicts require fresh preview/approval, never
  automatic retargeting. Preserve unrelated namespaces and plans.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_uncovered_current_truth_is_refused -- --exact`
  selects one passing C2 naming the missing truth and preserving reopened
  state, with successful complete-batch and saved-contribution controls.

### Task 4: Require a check beside supplementary evidence

- **Files:** `crates/cadence/src/plan/associations.rs`,
  `crates/cadence/src/plan_service.rs`,
  `crates/cadence/tests/phase28_evidence.rs`.
- **Action:** Deliver P28-T3-C and P28-T3-A1. Write C3 and observe red.
  After item coverage, require at least one current associated check per truth
  over the same resulting phase set. Distinguish no-check from no-item and name
  the truth. Count shared check identity once across contributions; an
  observation, artifact or link never substitutes. D-90's intended authored map
  has exactly one check; this task implements its lower bound only. The explicit
  scope boundary assigns the second-check refusal to phase 29, so do not add
  that refusal or command/output/link-necessity judgments here. Preserve the
  observation specification as supplementary, without deriving truth status.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_current_truth_without_check_is_refused -- --exact`
  selects one passing C3, with distinct truth-specific no-check refusal and
  success when the phase's current set supplies that truth's check.

### Task 5: Resolve every explicit item association

- **Files:** `crates/cadence/src/plan/evidence.rs`,
  `crates/cadence/src/plan/associations.rs`,
  `crates/cadence/src/plan_service.rs` (`path_error`),
  `crates/cadence/tests/phase28_evidence.rs`.
- **Action:** Deliver P28-T4-C and P28-T4-A1. Write C4 and observe red.
  Resolve every supplied full truth id against `context::persistence::saved`
  for the bound phase; reject an empty association list and every unresolved
  edge, even when another edge is good. Preserve caller ids verbatim; never
  parse embedded phase/truth numbers. Reject duplicate item definitions within
  one contribution and conflicting definitions of one shared id in the current
  union. Across contributions identical definitions denote one item with
  explicit association provenance and per-association reasons, not last write
  wins. A stable id with a changed spec is a new item revision, possible only
  where the resulting current set has no conflicting definition. Preserve all
  prior definitions. Return plan-specific typed diagnostics with `phase`,
  `entry`, `id` and an exact association `slot`; do not collapse these errors
  into generic `publication`. Item membership errors precede aggregate
  coverage errors so the offending input remains visible.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_item_without_bound_truth_is_refused -- --exact`
  selects one passing C4 identifying the full offending item/edge, refusing
  shared-id conflicts and retaining corrected shared associations after reopen.

### Task 6: Compare associations with current native versions

- **Files:** `crates/cadence/src/plan/associations.rs`,
  `crates/cadence/src/plan/persistence.rs` (`contribute`, `validate_publication`),
  `crates/cadence/src/plan_service.rs` (`execute`, `path_error`),
  `crates/cadence/tests/phase28_evidence.rs`.
- **Action:** Deliver P28-T5-C and P28-T5-A1. Write C5 and observe red.
  Compare each explicit numeric requested version for equality with the actual
  approved native truth record. No inferred default, historical-existence
  match, text match or numeric parsing of labels. Preserve D-94's separate
  missing-context, unknown-truth and unequal-version diagnostics; requested
  and current values must be available in the typed refusal, using the standard
  located envelope and explicit reason where that envelope has no extra field.
  Reuse the same validation from the contribution the conditional transaction
  commits and from its recovery validation, rather than relying on preview.
  Every association of a shared item is checked. Keep current truth authoring
  at version 1; no context revision API or synthetic approved version is added.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_noncurrent_truth_version_is_refused -- --exact`
  selects one passing C5 with requested/current values and unchanged reopened
  state, and successful explicit-current-version control.

## Notes

- Six tasks here precede PLAN-2's four. Ten separate concerns exceed the
  eight-task ceiling. The dispatch explicitly permits sequential shared-file
  splits, overriding the contract/template's independence-only wording.
  Neither plan may run in parallel with the other. No plan-shape directive was
  specified. These files use the requested planner template, not native
  execution frontmatter, and are not themselves a native publication.
- New wire names below are deliberate schema choices authorized by D-96,
  not claims about existing Rust identifiers. Rust type/helper names remain
  the executor's choice. New source paths and the seven required test function
  names are creation leases/specifications. Do not invent other existing symbols.
- Grammar: add optional `content.evidence_map`. Its explicit modes are
  `{mode: attached, items: [...]}` and `{mode: provisional}`. New mapless
  authoring must use the latter; absent data in previously persisted phase-27
  records remains absent and readable/replayable. Attached items have `id`,
  `kind`, `spec`, `reason`, `associations`; each association has `truth_id`,
  `truth_version`, `reason`. Truth phase/occurrence is inherited exclusively
  from the publication. Ids are nonblank full opaque strings, unique within a
  contribution and canonical within the occurrence. Numeric versions have no
  default. Every item and association needs its own nonblank reason.
- Kind-specific `spec`: check has `command`, `expected` with `kind` (`literal`
  or `property`) and `value`, `test` with `file` and `function`, `setup`, `call`,
  `boundary`, `fakes`; artifact has `locators` and `substance`; link has
  `caller`, `callee`, `value`; observation has `episode` and
  `specification` with `source`, `document`, `approved_by`, `approved_at`,
  plus `status: pending`. Check expected value describes command output and
  the handwritten property asserted inside the test. Artifact locators may
  group paths/symbols/records. Observation approval is provenance, not a seen
  episode; no result/verdict fields. Typed shape can mechanically reject a
  missing/wrongly typed field; credit that accurately without implementing
  phase 29's semantic command/output, second-check or unnecessary-link gates.
- Complete preview: extend existing `plan-read` with optional `submission`,
  mutually exclusive with allocation `count`, and require matching phase scope.
  It renders and validates the candidate without approval, writer acquisition,
  recovery or persistent tokens. Return final `submission`, ordered proposed
  documents/revisions and old/replacement sections where applicable. With no
  map section, insert the rendered section before Tasks (or at body end if no
  Tasks heading); with one section require equality to the canonical typed
  rendering. Refuse a disagreeing section rather than interpreting its prose.
  A caller replacing opaque phase-27 prose submits the surrounding body with
  that section removed; preview shows the observed old section beside the new
  one. Recognize actual level-two headings outside fenced code, not examples
  in code blocks. Preserve every byte outside the replaced/inserted section.
  Return the normalized full submission for exact approval, including the
  replacement's matching proposed content. Publication accepts only the exact
  final form; rendering cannot silently change already approved content.
- Storage: put typed maps in dedicated `Snapshot.data.acceptance_maps`, with
  its own schema discriminator, using phase 27's retained active-cycle
  occurrence as lifetime. Do not reuse routing `evidence` / `native_evidence`,
  store `ItemRecord`, execution fingerprints or truth status. Map revisions
  identify publication EVENTS through the existing occurrence/request receipt
  and plan identity, not only content hashes: publishing identical bytes later
  can have the same content digest and still be a different retained event.
  Item revisions are deterministic digests of canonical id/kind/spec/item-reason
  definitions; changed spec under the same opaque id retains the old definition.
  Explicit associations retain their own reasons and contribution origins.
  Full history/supersession/read view is completed by PLAN-2.
- Exact map validity is checked inside `contribute` for the snapshot supplied
  to `CompareTransact`; `validate_publication` already reconstructs that delta
  in `Writer::execute_store` and `Intent::validate`. Those inspected existing
  callers need no separate writer or participant type for JSON map data.
  Refusals remain ordinary structured MCP answers; genuine storage/transport
  errors are not fabricated as successful refusals. Preserve write, confirm,
  return and read-only cross-session access.
- Verified against the tree, not the draft's older HEAD: `Content.body`,
  `render::document`, `Publication`/`Receipt`/`Occurrence`, `contribute` and
  `validate_publication`, the complete plan service, native `Truth`/`saved`,
  writer/intent plan branches, `Snapshot::parse`/`digest`, filesystem target
  confinement and confirmation, public schema/stdio routes, phase-27 test
  helpers and `tests/mcp.rs`'s actual binary client. Research sections A/B/C
  inform the evidence shape only where these sources support them. Existing
  files leased above were read; new files are explicitly marked as creation.
- Each check is written before its implementation; record actual behavioral
  red and green commits. Run only task Verify while working; the executor runs
  the full suite once at plan close, outside task Verify. The verifier runs
  the mapped checks and inspects artifacts, not a suite or a coverage table.
  Any test invoking git supplies `-c commit.gpgsign=false`, its own
  `-c user.name=...` and `-c user.email=...` on EVERY call, following phase 27's
  corrected `git` helper. Cargo is available. Clippy, if required at execution
  close, is `cargo clippy --workspace --all-targets -- -D warnings`, no stdin.
  No new dependency is needed. This planner ran no build/tests/clippy and
  made no commit. O1 remains pending; model map quality is knowingly untested.
