---
phase: 11
plan: 1
requirements: [T1, T2, T3, T4, T5, T6, T7]
files:
  - crates/cadence/src/lib.rs
  - crates/cadence/src/main.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/context_service.rs
  - crates/cadence/src/context/mod.rs
  - crates/cadence/src/context/model.rs
  - crates/cadence/src/context/validation.rs
  - crates/cadence/src/context/persistence.rs
  - crates/cadence/src/context/render.rs
  - crates/cadence/src/context/instructions.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/filesystem.rs
  - crates/cadence/tests/phase11_context.rs
  - skills/cad-context/SKILL.md
---

# Phase 11: First approved context - Plan

## Goal

A phase's truths are authored through the binary as typed slots, refused at
authoring for the faults the binary can decide, refused for the two it cannot
unless the owner attests, refused over seven and on identity collision, and
persisted to `.planning/phases/<N>/CONTEXT.md` together with the phase's decisions
only on the owner's approval, with nothing on disk before it.

## Must be true when done

- T1. When the owner approves a valid context submission, the owner sees its
  truths and decisions together in the phase's CONTEXT.md.
- T2. When a submitted truth violates the required sentence shape, the caller
  is refused authoring with the broken rule and slot identified.
- T3. When a submitted truth makes its outcome an implementation internal,
  the caller is refused authoring as unobservable.
- T4. When a submitted truth depends on a model-generated expected answer,
  the caller is refused authoring for a prose oracle.
- T5. When the owner submits eight truths for one phase, the owner is refused
  authoring with "split the phase".
- T6. When a context submission reuses an identity within its identity scope,
  the caller is refused authoring with the collision identified.
- T7. When context authoring ends without owner approval, the owner sees the
  prior persisted context unchanged.

## Context

D-79 binds the slots, mechanical refusals, two owner attestations and approval record.
The acceptance design binds version-1 truth records, compiled instructions and evidence.
Reuse the root-bound MCP adapter, resident mailbox and confirmed store transaction.
Keep CONTEXT authored Markdown; no startup exclusion for readers or cursor source change.
Phases 22-30, evidence-map persistence, truth revision and other role ports stay outside this plan.

## Evidence map

All truth references below are to phase 11's approved `CONTEXT.md`, version 1.
The seven named functions below are **new acceptance-test names**, assigned here
because a check must identify its test. New production symbol names and operation
tags are the executor's choice, consistently advertised in the compiled schema,
service and instructions; names mentioned as existing seams below were read in
this tree. New paths in Files are creation leases, not claims that code exists.

Every check lives in `crates/cadence/tests/phase11_context.rs`. Use a small stdio
client following `Client`, `isolated_client` and `envelope` in
`crates/cadence/tests/mcp.rs`, without modifying or including that entire test
target. Start the actual `cadence serve --project-root <temporary-project>`
binary, initialize MCP and submit through `cadence_apply`'s context authoring
operation. Its read-only intake is exposed through `cadence_query`. Test inputs
are handwritten owner/caller submissions; a temporary project is real filesystem
storage, not a filesystem fake. The public decoder, service, resident, policy,
writer, transaction and filesystem remain real. Nothing beyond the clock and
approving caller's inputs may be faked. No model, provider or host simulation
decides an expected answer. Use the existing global-config isolation from the
MCP client so tests never write a user's global config.

Property checks use a table of submissions inside their **one** named function,
varying the dimension promised by that truth. Do not turn rows into separate
checks or functions carrying additional test attributes. Handwrite expected
sentences and expected refusal categories/slots; never obtain expectations by
calling the validator or renderer under test. Every command below must report
`1 passed; 0 failed`; zero selected tests is not a pass.

For a check that asserts persistence or unchanged state: close and wait for the
server process, discard open handles, reopen paths, and read CONTEXT plus
`items.jsonl`, `decisions.jsonl`, and `state.json` before the final assertion.
Parse and validate a present snapshot against its actual JSONL bytes using the
real store record reader. T1 also reopens the real `Store` with `Filesystem` after
the server releases ownership. On absent-store or pending-intent refusal cases,
use read-only reopened files instead: opening `Store` would itself create or
recover state and spoil the observation. Compare tree membership as well as
bytes, including absence of a new phase directory, temporary files or intent.

### T1

- **C1 — check.** Function `phase11_approved_context_persists_truths_and_decisions`.
  Setup: real temporary projects with a declared phase and no native approved
  context for it; exercise both an existing empty phase directory and a missing
  phase directory. Use valid sets of one through seven truths, both kinds, all
  three verbs, distinct IDs, durable and phase-local decisions, authored scope
  and assumption prose, and explicit true attestations with an identified owner.
  Include Markdown and non-ASCII decision prose so a replacement by a fixed
  template cannot pass. Call: submit the complete set through the public context
  authoring apply operation with approval of that exact set. Expected property:
  after durable `ok` and filesystem/store reopen, CONTEXT contains exactly the
  approved truth sentences and decisions, together, in the approved order and
  readable sections; the stored truth records agree with those sentences and
  have the design's fields, version `1`, supplied kind and status `pending`.
  The same committed context holds the owner's two attestations per truth and
  approval identity/time, bound to that submission; unrelated snapshot data and
  JSONL records survive. No pending intent remains after acknowledgment. Expected
  values come from the submissions and handwritten sentences, not a rendered
  response echoed back. Boundary/fakes: the complete public operation, store and
  filesystem are real; only caller inputs and clock may be supplied.
  Command: `cargo test -p cadence --test phase11_context phase11_approved_context_persists_truths_and_decisions -- --exact`.
  Reason: acknowledging before publication, omitting either record family, or
  rendering different approved content breaks the owner's visible result.
- **A1 — artifact (T1).** `crates/cadence/src/context/model.rs` and
  `crates/cadence/src/context/persistence.rs`: substantive typed submission,
  truth and approval records in a dedicated JSON namespace of `Snapshot.data`.
  Persist `truth { id, phase, version, pattern, text, kind, status }` with
  version `1`, kind `literal | property`, and the design's status vocabulary
  `pending | met | concerns | unmet | waived`; authoring writes only `pending`
  and introduces no status-transition operation. Keep the submitted slots and attestations associated with the
  approval rather than losing them after rendering. The approval identifies who
  attested, when, and the exact approved truths and decisions. Reason: a Markdown
  file alone is not the binary-owned truth record promised by the design.
- **A2 — artifact (T1).** `crates/cadence/src/context/render.rs`,
  `crates/cadence/src/context_service.rs`, and the CONTEXT participant in
  `crates/cadence/src/store/{transaction,writer,filesystem}.rs`: one approved
  publication through the existing journal, including safe missing-directory
  handling, synchronized installation, confirmation and restart recovery.
  Reason: an independent Markdown write can diverge from the approved store.
- **A3 — artifact (T1, T7).** `crates/cadence/src/context/instructions.rs`:
  compiled context-role instruction text, including the actual query/apply
  contract, owner interview, attestation and approval procedure, typed-refusal
  handling, and no direct planning writes. `crates/cadence/src/main.rs` exposes
  its Markdown rendering, and `skills/cad-context/SKILL.md` is generated from
  that source. Inspect the compiled instruction source and its registration;
  the rendered `.md` is **not** a check subject. Reason: a live skill that still
  invokes the frozen writer bypasses both approval and binary authorship.
- **O1 — observation (T1, T7).** The owner runs `/cad-context` for a real phase in a real host, sees the
  interview reach the binary's authoring operation, sees one deliberately
  malformed truth come back as a typed refusal in the conversation, and sees
  the approved set land in that phase's CONTEXT.md with nothing written
  before approval. The interview's quality is the model's and is not asserted.
  Provenance: owner-supplied O1 in phase 11 CONTEXT and this dispatch. Preserve
  the actual observer/date/seen record when available; no invented execution
  date or automated substitute. This item remains an observation even when
  seen, capping T1 and T7 at `concerns`. Reason: deterministic binary checks do
  not establish that the real host loads and follows the context instructions.

### T2

- **C2 — check.** Function `phase11_sentence_fault_names_rule_and_slot`.
  Setup: otherwise valid context submissions; vary one sentence fault at a time:
  trigger containing `" or "`, observer naming two parties, verb outside
  `sees`/`gets`/`is refused`, and each absent, empty or whitespace-only required
  slot. Include invalid/missing kind at the typed boundary. Exercise the second
  observer with conjunction and list forms, not only a missing observer.
  Call: submit each through the same public authoring operation, with approval
  supplied as well as without approval so approval cannot bypass validation.
  Expected property: a successful MCP call carrying `status: refused`, the
  specific broken structural rule and exact slot (`trigger`, `observer`, `verb`,
  `outcome` or `kind`) as machine-readable refusal information, plus the affected
  truth identity or input position. No generic execution-patch refusal or MCP
  argument error substitutes for it. Reopened planning bytes remain unchanged.
  Boundary/fakes: raw public decoding, service and filesystem stay real; only
  caller inputs and clock may be supplied.
  Command: `cargo test -p cadence --test phase11_context phase11_sentence_fault_names_rule_and_slot -- --exact`.
  Reason: dropping a mechanical D-79 rule or erasing its slot makes a malformed
  submission pass or makes the refusal unusable for correction.
- **A4 — artifact (T2).** `crates/cadence/src/context/validation.rs` and the
  context input/output schema and decoding branch in `crates/cadence/src/server.rs`:
  typed slots, mechanical shape validation and a context refusal payload using
  the existing `ok`/`refused`/`unknown`/`not-applicable` wire vocabulary with
  structured rule/slot information. Reason: prose-only reasons or the generic
  untagged apply fallback lose which authoring input broke which rule.

### T3

- **C3 — check.** Function `phase11_unobservable_attestation_is_refused`.
  Setup: a syntactically valid truth whose outcome describes an implementation
  internal, with `fixed_oracle: true`; vary `observable` over absent and false,
  across otherwise valid submissions and truth positions. Call: public context
  authoring apply, including owner-approved submissions. Expected property:
  `status: refused`, the unobservable rule, the `observable` attestation slot and
  affected truth identified; reopen to find no publication. Include the same
  sentence with `observable: true` as a control within this one test: the binary
  does not pretend to classify internal names after the owner attests. That
  control is draft-only and cannot publish without approval. Boundary/fakes:
  public operation and filesystem real; only caller inputs and clock supplied.
  Command: `cargo test -p cadence --test phase11_context phase11_unobservable_attestation_is_refused -- --exact`.
  Reason: defaulting absence to true, or replacing the owner's decision with an
  internal-name heuristic, violates D-79's specific refusal contract.
- **A5 — artifact (T3).** `crates/cadence/src/context/model.rs` and
  `crates/cadence/src/context/validation.rs`: required per-truth `observable`
  attestation and its authoring refusal; A1 retains the attestation with owner
  and time on approval. Reason: the binary cannot infer observability reliably.

### T4

- **C4 — check.** Function `phase11_prose_oracle_attestation_is_refused`.
  Setup: a syntactically valid truth whose expected answer comes from model
  prose, with `observable: true`; vary `fixed_oracle` over absent and false,
  across otherwise valid submissions and truth positions. Call: public context
  authoring apply, including owner-approved submissions. Expected property:
  `status: refused`, the prose-oracle rule, `fixed_oracle` slot and affected truth
  identified; reopened planning bytes unchanged. Include the same text with
  `fixed_oracle: true` as a draft-only control within this test: no model call or
  keyword classifier overrides the attestation. Boundary/fakes: public operation
  and filesystem real; only caller inputs and clock supplied.
  Command: `cargo test -p cadence --test phase11_context phase11_prose_oracle_attestation_is_refused -- --exact`.
  Reason: an omitted attestation treated as assent would admit a moving oracle.
- **A6 — artifact (T4).** `crates/cadence/src/context/model.rs` and
  `crates/cadence/src/context/validation.rs`: required per-truth `fixed_oracle`
  attestation and its authoring refusal; A1 retains it with owner and time on
  approval. Reason: a text scanner cannot decide where an expected answer comes from.

### T5

- **C5 — check.** Function `phase11_eighth_truth_requires_phase_split`.
  Setup: eight individually valid, uniquely identified truths, valid decisions,
  true attestations and owner approval, in a real declared phase. Call: the same
  public authoring apply operation. Expected literal: `status: refused` and
  `"split the phase"` in the refusal, with the seven-truth rule and truth-set
  slot identified; no truth is silently truncated. Read the prior file and store
  back after reopening and find them unchanged. A seven-truth draft in the same
  function is the boundary control. Boundary/fakes: public operation and
  filesystem real; only caller inputs and clock supplied.
  Command: `cargo test -p cadence --test phase11_context phase11_eighth_truth_requires_phase_split -- --exact`.
  Reason: replacing the hard refusal with a report or truncation approves a
  different promise from the owner's submission.
- **A7 — artifact (T5).** The whole-set authoring limit in
  `crates/cadence/src/context/validation.rs`, before any writer acquisition.
  Reason: checking after publication breaks the authoring boundary.

### T6

- **C6 — check.** Function `phase11_identity_collision_is_refused`.
  Setup: otherwise valid sets with a repeated full truth ID, repeated full
  decision ID, and a duplicate decision split between durable and phase-local
  sections. Include a repeated full ID across truth/decision entries. Also
  approve a valid first set through the public operation, restart, and attempt
  a new submission reusing its recorded identity in that phase. Give that new
  submission distinct approval/content identity so it is not an exact retry of
  the first operation's durable receipt. Call: the same
  public authoring apply operation for every collision, with and without approval.
  Expected property: `status: refused`, identity-collision rule, the offending
  identity slot, full collided ID and phase scope identified; reopened CONTEXT
  and store preserve the prior winner byte-for-byte. Use a second declared phase
  as the control: its reuse of those phase-local spellings is permitted, and
  distinct full IDs with the same numeric suffix are not collisions. Boundary/
  fakes: approval, public refusal, store and filesystem real; only caller inputs
  and clock supplied.
  Command: `cargo test -p cadence --test phase11_context phase11_identity_collision_is_refused -- --exact`.
  Reason: silent map replacement, separate decision-section counters or
  project-global identity checks lose a decision or reject legitimate phase IDs.
- **A8 — artifact (T6).** Identity validation in
  `crates/cadence/src/context/validation.rs` and
  `crates/cadence/src/context/persistence.rs`, using A1's phase-bound records
  and the writer's conditional snapshot precondition. Reason: request-local
  deduplication alone misses already committed identities after a restart.

### T7

- **C7 — check.** Function `phase11_unapproved_context_changes_nothing`.
  Setup: real projects with prior authored CONTEXT and valid native store bytes,
  plus variants without a phase directory, without native store files, and with
  a retained pending intent. Snapshot bytes and tree membership before authoring.
  Call: public context intake query; public authoring apply with valid corrected
  drafts but no approval, explicit declined approval, and an incomplete approval
  identity; then end the session without sending approval. Include ending after
  intake alone. Expected property: draft validation may return its read-only
  result, and incomplete approval is refused, but nothing in the captured tree
  changes at any intermediate boundary or after process exit and read-only
  filesystem reopen. Prior CONTEXT and store bytes, including pending intent,
  are identical; absent files/directories remain absent. A valid draft must reach
  the supported operation rather than pass this test by returning unknown-tool
  or invalid-operation. Boundary/fakes: real server, public operation, service
  and filesystem; only caller inputs and clock supplied.
  Command: `cargo test -p cadence --test phase11_context phase11_unapproved_context_changes_nothing -- --exact`.
  Reason: calling `first_touch`, logging refusals, recovering an intent or making
  directories during an interview changes disk without the owner's approval.
- **A9 — artifact (T7).** `crates/cadence/src/context_service.rs` and its
  `PublicServer`/`Resident` registration in `crates/cadence/src/server.rs` and
  `crates/cadence/src/recall/mod.rs`: a read-only authoring path with an explicit
  approval barrier before `SessionFactory::first_touch` and any writer request.
  Reason: an approval boolean checked only around the final Markdown write is
  too late to prevent startup/import/recovery writes.
- **Artifact attachment:** A3 also serves T7; inspect its compiled approval and
  no-direct-write instructions once, not as another check.
- **Observation attachment:** O1 above also serves T7; retain it as the same
  observation, not a duplicate test or a claim about interview quality.

There are no separate link items. These truths promise publication or refusal
at the public boundary; none promises a distinct collaborator handoff whose
receiver must be substituted. C1 reads the actual persisted values, rather than
replacing publication with a link spy.

## Tasks

### Task 1: Keep context authoring read-only until approval

- **Files:** `crates/cadence/src/lib.rs`, `crates/cadence/src/server.rs`
  (`PublicServer`, `QueryArguments`, `ApplyArguments`, `query_schema`,
  `apply_schema`), `crates/cadence/src/recall/mod.rs` (`Resident`),
  `crates/cadence/src/context_service.rs` (new),
  `crates/cadence/src/context/mod.rs` (new),
  `crates/cadence/src/context/model.rs` (new),
  `crates/cadence/tests/phase11_context.rs` (new).
- **Action:** Deliver C7 and A9. Write C7 first and record its actual public
  failure before implementing. Introduce a typed context submission through
  `cadence_apply` and a read-only intake through `cadence_query`, both bound by
  `PublicServer` to its project. The intake supplies the phase's authored input
  and the submission contract; do not persist a draft/session token. Keep drafts
  in the caller's inputs. Model the D-79 slots, owner attestations, identified
  approval of the complete submitted truths/decisions, and authored context
  sections. Missing approval and a decline end without writing; incomplete
  approval never authorizes a writer. Route context calls explicitly before the
  execution fallback, preserving raw slot errors for subsequent validation.
  Add the resident request/reply path following `Resident::review` and its
  mailbox arm, with no eager `first_touch`. Read existing files without creating
  `.planning`, phase directories, config, store files or intent; do not recover
  pending work, acquire write ownership, log a refusal or update STATE on this
  path. Valid draft submissions return a meaningful non-persisted result. This
  task establishes the public authoring path; Task 2 adds its approved
  publication. Do not add a second store owner or a refuse-to-start guard.
- **Verify:** `cargo test -p cadence --test phase11_context phase11_unapproved_context_changes_nothing -- --exact`
  reports one passing test; C7's reopened bytes and absent paths are unchanged.

### Task 2: Publish the first approved context through one transaction

- **Files:** `crates/cadence/src/context/mod.rs`,
  `crates/cadence/src/context/model.rs`,
  `crates/cadence/src/context/persistence.rs` (new),
  `crates/cadence/src/context/render.rs` (new),
  `crates/cadence/src/context_service.rs`,
  `crates/cadence/src/store/transaction.rs` (`ExternalChange`, `Intent::validate`,
  `commit`, `recover`), `crates/cadence/src/store/writer.rs`
  (`Operation::CompareTransact`, `Writer::execute_store`, `Writer::persist`),
  `crates/cadence/src/store/filesystem.rs` (`Filesystem`, `phase_summary_target`,
  `ensure_directory`), `crates/cadence/tests/phase11_context.rs`.
- **Action:** Deliver C1, A1 and A2. Write C1 first and record red before adding
  approved publication. This is the end-to-end store spine by the second task.
  After approval of the exact submission, render each sentence in the design's
  fixed `When <trigger>, <observer> <verb> <outcome>.` order. Preserve kind and
  the sentence pattern in the truth record; do not accept a separately supplied
  final sentence as authoritative. Store only initial truth version `1` and
  `pending` status. Persist the typed slots, decisions and both per-truth
  attestations with the attesting owner's identity/time in the approval record,
  bound to the exact approved set. Use `Snapshot.data` as the domain extension,
  following the contribution/precondition pattern in review persistence without
  using its review namespace or the existing routing `native_evidence` namespace.
  Preserve unrelated data and import/source provenance.
  Render human-readable CONTEXT with its title, phase, scope boundary,
  `## Durable decisions`, `## Decisions`, `## Truths`, and flagged assumptions;
  retain approved authored prose and evidence citations. The exact decision
  headings preserve `recall::documents::snippets` behavior without changing recall.
  Add only the specific CONTEXT document participant, modeled on the existing
  summary target; never expose an arbitrary destination or general document
  writer. Admit it in writer and intent validation, including restart, and bind
  its bytes to the same approved snapshot. Handle missing phase parents only
  after approval, through filesystem ownership, with the existing safe directory
  identity/sync discipline. Keep expected-file checks, temporary-file sync,
  rename, directory sync, installed-byte confirmation, final snapshot and intent
  removal in the existing transaction protocol. Return `ok` only after its
  confirmed completion. A failed or pending write is not success. Preserve
  existing recovery semantics; do not promise simultaneous multi-file visibility
  to arbitrary readers. Do not introduce truth revision or replace an already
  native-approved context with a new set in this phase.
- **Verify:** `cargo test -p cadence --test phase11_context phase11_approved_context_persists_truths_and_decisions -- --exact`
  reports one passing test with approved sentences, decisions, initial records
  and approval evidence read from the reopened filesystem and store.

### Task 3: Refuse mechanical sentence faults at the public authoring boundary

- **Files:** `crates/cadence/src/context/mod.rs`,
  `crates/cadence/src/context/model.rs`,
  `crates/cadence/src/context/validation.rs` (new),
  `crates/cadence/src/context_service.rs`, `crates/cadence/src/server.rs`
  (`PublicServer`, `query_schema`, `apply_schema`),
  `crates/cadence/tests/phase11_context.rs`.
- **Action:** Deliver C2 and A4. Write C2 and record red before implementation.
  Apply D-79's mechanical rules to every submitted truth before authoring can
  reach `first_touch`, including submissions that already carry approval.
  Require nonblank slots, the three verb values and the two kind values; refuse
  the literal alternative delimiter `" or "` in the trigger and multiple
  observers. Make observer multiplicity a documented mechanical rule for
  explicit conjunction/list forms, including `" and "`, `" & "`, comma and
  semicolon separators; do not call a model to resolve prose. Keep a single
  observer slot and one outcome slot in the schema and renderer. Do not add an
  outcome-language classifier or a new set of semantic refusals beyond D-79.
  Preserve each slot failure even where enum deserialization would ordinarily
  collapse it into invalid arguments. Return a context-specific typed refusal
  carrying the envelope's usual status/code/reason and structured broken rule,
  slot and affected entry; keep it a successful MCP call, consistent with
  `Envelope`'s contract. Extend context output schema/serialization rather than
  changing every existing operation's refusal constructors. Reuse this same
  validation for drafts and approved submissions; never persist refusals.
- **Verify:** `cargo test -p cadence --test phase11_context phase11_sentence_fault_names_rule_and_slot -- --exact`
  reports one passing test; every malformed row names its own rule and slot.

### Task 4: Require the owner's observability attestation

- **Files:** `crates/cadence/src/context/model.rs`,
  `crates/cadence/src/context/validation.rs`,
  `crates/cadence/tests/phase11_context.rs`.
- **Action:** Deliver C3 and A5. Write C3 and record red before implementing the
  `observable` refusal. Every truth requires the owner's attestation; absent
  and false both refuse as unobservable, naming the attestation slot and truth.
  Check it during authoring before any write. Keep the true attestation in
  A1's approved record with who/when. D-79 expressly chooses owner attestation
  because code cannot decide internal names reliably: no struct/function-name
  blacklist, source scan, model consultation or second semantic approval gate.
- **Verify:** `cargo test -p cadence --test phase11_context phase11_unobservable_attestation_is_refused -- --exact`
  reports one passing test with the absent/false refusal and attested control.

### Task 5: Require the owner's fixed-oracle attestation

- **Files:** `crates/cadence/src/context/model.rs`,
  `crates/cadence/src/context/validation.rs`,
  `crates/cadence/tests/phase11_context.rs`.
- **Action:** Deliver C4 and A6. Write C4 and record red before implementing the
  `fixed_oracle` refusal. Every truth requires this distinct attestation;
  absent and false both refuse for a prose oracle, naming the slot and truth.
  Check during authoring before any write and preserve true attestations in
  A1's approval record. Do not infer it from `observable`, default it from
  approval of the set, inspect keywords or call a model for the expected value.
- **Verify:** `cargo test -p cadence --test phase11_context phase11_prose_oracle_attestation_is_refused -- --exact`
  reports one passing test with the absent/false refusal and attested control.

### Task 6: Refuse the eighth truth before writing

- **Files:** `crates/cadence/src/context/validation.rs`,
  `crates/cadence/tests/phase11_context.rs`.
- **Action:** Deliver C5 and A7. Write C5 and record red before implementing the
  whole-set limit. At most seven truths are permitted; one is valid. Refuse an
  over-seven submission at authoring with `split the phase`, the broken rule
  and truth-set slot, before writer acquisition regardless of approval. Do not
  truncate, split automatically, downgrade to a report, or reuse the frozen
  post-write `criteria-size` command. This is the design's one hard count rule.
- **Verify:** `cargo test -p cadence --test phase11_context phase11_eighth_truth_requires_phase_split -- --exact`
  reports one passing test; eight produces the literal refusal and no write.

### Task 7: Refuse a reused context identity within its phase

- **Files:** `crates/cadence/src/context/validation.rs`,
  `crates/cadence/src/context/persistence.rs`,
  `crates/cadence/src/context_service.rs`,
  `crates/cadence/tests/phase11_context.rs`.
- **Action:** Deliver C6 and A8. Write C6 and record red before implementing
  collision validation. Compare full submitted IDs, scoped to the phase;
  durable and phase-local decision sections do not create separate scopes.
  Reject a full ID reused by any truth/decision entry in the submission or
  already occupied by its native approved phase records. Identify the collided
  ID, phase, offending identity slot and rule in the typed authoring refusal.
  Do not renumber, overwrite a map entry or reinterpret an identity collision
  as a text revision. Read existing approval records without opening a writer
  for refused/draft requests; repeat the relevant precondition against the
  writer's confirmed view on approval and use `CompareTransact`'s generation/
  integrity check so publication cannot overwrite a winning record. Preserve
  the store's existing exact-operation recovery receipt behavior rather than
  creating a second approval on replay. Allow the same spellings in another
  phase and distinguish `T1` from `D-01`. No new global ID allocator, audit of
  shipped Markdown, or phase-26 revision machinery belongs here.
- **Verify:** `cargo test -p cadence --test phase11_context phase11_identity_collision_is_refused -- --exact`
  reports one passing test, with the winner unchanged after reopening and
  permitted IDs accepted outside that phase scope.

### Task 8: Make the binary own the context-role instructions

- **Files:** `crates/cadence/src/context/mod.rs`,
  `crates/cadence/src/context/instructions.rs` (new),
  `crates/cadence/src/main.rs` (`Cli`, `Command`, `run_command`),
  `skills/cad-context/SKILL.md`.
- **Action:** Deliver A3 and carry O1 for T1/T7. Compile the complete context
  role instructions into the binary following the source-owned approach of
  `render_dispatch_prompt`, keeping context instruction rendering separate from
  CONTEXT document rendering. Add a binary rendering entrypoint that emits the
  host's skill Markdown without opening a project/store, and generate the
  declared skill file from it. The rendered entrypoint must use the real public
  intake/authoring contract from Tasks 1-7 instead of loading the frozen
  `cadence-core/workflows/context.md` as its executable instructions. Preserve
  the relevant conversational shape: read phase scope and priors, discuss
  unresolved decisions, distinguish durable/local decisions, collect typed
  truths, present the exact full set, collect both attestations for every truth,
  and request owner approval of that set. Explain each typed refusal for owner
  correction and resubmit through the binary; never edit CONTEXT or other
  planning files directly. Missing/declined approval ends without a write;
  approved publication waits for confirmed acknowledgment. Include the D-79
  limits and explicit attestation limitation, and do not claim interview quality
  is tested. All role-specific instruction text is compiled; there is no user
  override. A debug-only disk-loading option is permitted by the design but
  not required, and must never become a release override. Do not port analyzer
  dispatch, requirement correction, cursor mutation, plan gating, evidence-map
  operations, other role renderers or frozen post-write gates into this task.
  O1 remains the owner's live-host observation with its provenance and concerns
  cap; no test of the rendered skill Markdown substitutes for it.
- **Verify:** Inspect A3's compiled source and the `main.rs` registration for the
  substantive interview, per-truth attestations, exact-set approval, typed
  refusal handling and binary-only publication described above. Run only
  `cargo test -p cadence --test phase11_context phase11_unapproved_context_changes_nothing -- --exact`
  to settle the unchanged public authoring boundary after this integration;
  it must report one passing test. This reuses C7, not a new instruction-text
  check. Record artifact inspection separately from O1's live observation.

## Notes

- Execution is sequential. One plan has eight tasks; publication is one
  concern across its service, record, renderer and transactional filesystem
  participants. It intentionally has a larger file lease because splitting
  those participants into independent tasks would not settle C1. The first
  two tasks establish the real public-to-filesystem path; later tasks deepen
  authoring refusals and integrate the compiled role entrypoint.
- Write each named check before its implementation and record red then green
  by commit in the executor's report/patch. A missing test target or a command
  selecting zero tests is not red evidence: the test must exist and reach the
  public operation. Run task commands while working; the executor runs the
  full suite once at plan close under the acceptance design. The verifier runs
  only the seven checks and inspects the listed artifacts/observation. This
  planner ran no build, tests or clippy. If clippy is required at execution
  close, its command is `cargo clippy --workspace --all-targets -- -D warnings`;
  it takes no stdin, and lint success does not stand in for a truth's evidence.
- Identity interpretation is phase-local full IDs across the submitted truth
  and decision entries, including one decision scope across both decision
  headings. This follows the phase ownership in the design and the frozen
  CONTEXT template's continuing D-NN sequence; it imposes no project-global
  uniqueness on carried decisions. First publication uses native records;
  existing shipped Markdown is not retroactively audited or assigned versions.
  Revision of an already native-approved context remains phase 26.
- The observer separator rule in Task 3 is a mechanical syntax choice, not a
  claim of natural-language understanding. D-79's two semantic attestations
  stay exactly `observable` and `fixed_oracle`; there is no third attestation.
- Verified starting seams: `PublicServer::call_tool` and its query/apply schemas;
  `Resident::review` and its mailbox; `SessionFactory::first_touch` versus the
  read-only pattern in `observe_config`; `Snapshot.data` and review persistence's
  `contribute`/`commit`; `Writer::execute_store`'s config-only external allowlist;
  `Intent::validate`'s store/config/summary allowlist; `Filesystem::target`,
  `phase_summary_target`, `ensure_directory`, `prepare`, `install`, `confirm`;
  `transaction::commit`/`recover`; and `recall::documents::snippets`' exact
  durable/local headings. These verify the relied-on section B research claims
  against HEAD `66027a67`; research line numbers are not task anchors.
- Read-only shape references: `cadence-core/workflows/context.md` at
  `resolve_phase`, `confirm_decisions`, `write_context`; the frozen
  `cadence-core/templates/CONTEXT.md`; phase 10 and 11 CONTEXT. Their old AC
  grammar, optional planning gate, post-write count, STATE mutation and docs
  commit sequence are not phase-11 requirements. The acceptance design and
  current phase-11 CONTEXT supersede them.
- `PhaseObservation` contains plans, summary and UAT, not CONTEXT. None of these
  seven truths needs a derived "context gathered" state; do not change cursor
  derivation. Planning without approved truths is phase 27's question. The
  existing `native_evidence` facts concern routing and are not an acceptance
  map; this plan does not implement the later evidence/verdict layers.
- The live model conversation, host loading and quality of attestation are
  knowingly untested. O1 remains visible on T1 and T7 and caps their derived
  status at `concerns` even when accepted; no generated prose is an oracle.
- No dependency change is planned. The exact-target Cargo syntax was checked
  against the current Cargo Book through Context7:
  <https://doc.rust-lang.org/cargo/commands/cargo-test.html>.
