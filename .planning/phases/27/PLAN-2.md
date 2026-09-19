---
phase: 27
plan: 2
requirements: [T5, T6, T7]
files:
  - crates/cadence/src/main.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/plan_service.rs
  - crates/cadence/src/plan/mod.rs
  - crates/cadence/src/plan/model.rs
  - crates/cadence/src/plan/inventory.rs
  - crates/cadence/src/plan/validation.rs
  - crates/cadence/src/plan/persistence.rs
  - crates/cadence/src/plan/instructions.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/phase27_plan.rs
  - skills/cad-plan/SKILL.md
---

# Phase 27: Plan persistence and allocation - Plan 2

## Goal

Plans are stored at safe, distinct identities; a mismatched identity or an
out-of-phase path is refused; number allocation is a transaction that a retry
cannot double-allocate; replacement needs owner authorization. Following
PLAN-1, this plan completes unused gap identities, historical allocation replay,
replacement authority and the compiled authoring-only planner front door.

## Must be true when done

- T5. When gap planning publishes an additional plan, the owner sees that
  plan at a previously unused identity beside the phase's existing plans.
- T6. When a caller retries an acknowledged plan-allocation request, the
  caller gets the originally allocated plan identity.
- T7. When a plan replacement lacks owner authorization, the caller is
  refused replacement of the existing plan.

## Context

Execute after PLAN-1; its shared publication, model, store and test files prohibit parallel execution.
D-84 through D-87 complete the allocation/approval mechanism established there.
D-80 through D-83, D-88/D-89 and every carried decision still bind these paths.
Native plans remain provisional; legacy content is read-only, and execution history stays intact.
Typed maps, execution continuation, verdicts and selected review edits remain with their later phases.

## Evidence map

Bind items to phase 27 CONTEXT.md's exact approved T5/T6/T7 text at `b99f2fed`,
approved 2026-09-10; no numeric truth version is supplied to invent. These are
the phase's only three additional checks. Each lives in the shared
`crates/cadence/tests/phase27_plan.rs`; the seven new test names across both
plans are required evidence specifications, not assertions of existing code.
New production names and operation tags are chosen by the executor and then
advertised consistently through the compiled public schema and role text.

Every check starts the actual `cadence serve --project-root <temporary-project>`
binary over stdio MCP and submits through its public plan publication operation
in `cadence_apply`; preview, listing and readback use its `cadence_query`
operations. Establish native approved truths for the bound phase through real
`context-submit`. Use the real temporary project, resident, decoder, policy,
store, transaction, ownership and filesystem. Nothing beyond clock and
approving caller inputs may be faked. Isolate global configuration and follow
the real `Client`/reopen patterns read in `tests/phase11_context.rs` and
`tests/mcp.rs`, not an in-process mock of the service.

Table cases remain inside each truth's one test function. Handwrite content,
expected identities, refusal rules and old/new revision relations. Final
assertions follow server exit, dropped handles and reopening PLAN paths,
directory listings and `state.json`/`items.jsonl`/`decisions.jsonl`; parse the
actual snapshot with those JSONL bytes. Check absence of pending intent before
reopening the real `Store`/`Filesystem` for successful publications. Refused
or retained-intent cases use read-only reopened files so recovery cannot change
the result being asserted. T5 explicitly reads the directory listing. No
renderer, allocator or constructed receipt is the oracle. Commands must each
select exactly one test with `1 passed; 0 failed`.

No link items are added: these truths name visible stored/replayed outcomes,
not a value handed between named components. Their checks keep that boundary real.

### T5

- **P27-T5-C — check.** File `crates/cadence/tests/phase27_plan.rs`, function
  `phase27_gap_plan_uses_previously_unused_identity`.
  Setup: native approved truths and real legacy input `PLAN.md` reserving 1,
  `PLAN-3.md`, a `reports/plan-8.md` whose PLAN is missing, and handwritten
  SUMMARY/UAT/report bytes. Publish a native plan at 9, then delete its file as
  an external input change, leaving its durable consumed identity. Call gap
  preview and the public publication operation with a new approved gap body.
  Expected: gap identity is 10, not a hole, deleted 9 or bare 1; the reopened
  directory contains `PLAN-10.md` beside the unchanged legacy plans and reports,
  and the store retains the same occurrence, prior history and high-water 10.
  Restart, remove an already inventoried legacy report, and publish another
  approved gap: the next number is 11. A separate fixture with a legacy plan
  actually admitted through public `execute-next`, then its file removed, must
  reserve its execution identity too; do not synthesize an admitted record.
  Before launching that fixture's stdio server, commit the handwritten owner
  progress-gate/answer records through the real seam specified in Notes.
  Require `execute-next` itself to return a dispatch and persist its admission;
  if it cannot, report the actual blocking prerequisite in C5, not a generic
  refusal as evidence of an admitted identity.
  Cases with `PLAN.md` plus `PLAN-1.md`, a leading-zero alias, or conflicting
  frontmatter refuse explicit-resolution ambiguity without rewriting legacy
  inputs. Include independent phase scopes and decimal-phase read-only input:
  neither aliases the native bound occurrence. Boundary real: public gap
  publication, inventory, native execution admission for its setup, directory
  listing, store and filesystem; only clock/caller inputs may be faked.
  Command: `cargo test -p cadence --test phase27_plan phase27_gap_plan_uses_previously_unused_identity -- --exact`.
  Expected: one passing test. Reason: counting existing filenames alone recycles
  deleted or completed work and makes a gap inherit an old identity.
- **P27-T5-A1 — artifact.** `plan/inventory.rs`, `plan/persistence.rs`,
  `plan_service.rs` and their occurrence occupancy/high-water records:
  conservative legacy disk/report/execution occupancy, retained consumed
  numbers and gap publication through the existing approved transaction.
  Reason: a preview-only inventory loses occupancy when a file disappears.
- **P27-T5-A2 — artifact.** `plan/model.rs` and `plan/persistence.rs`:
  explicit active-cycle phase occurrence ownership for native plans and
  request receipts, separate from `ExecutionOccurrence.plan_set_fingerprint`,
  with retained prior publications and legacy provenance. Reason: mutable set
  hashes and directory presence cannot define identity lifetime.

### T6

- **P27-T6-C — check.** File `crates/cadence/tests/phase27_plan.rs`, function
  `phase27_acknowledged_allocation_replays_original_identity`.
  Setup: native approved truths; save a caller request id and exact approved
  ordered payload, then observe its public acknowledgment and assigned
  identities/revisions. Call the same public operation with that exact request
  again after acknowledgment. Publish a different request, exit the server,
  restart and retry the first id/payload again. Expected: all replays return
  the original ordered identities and original publication revisions, without
  allocating another number or creating a second file. They succeed despite
  the original preview's now-stale allocation basis. Same id with different
  approved payload is a typed refusal naming the request-id reuse rule and
  bound identity, preserving the first result.
  In rows using Task 2's real authorized replacement, replace the first plan,
  restart and retry its original allocation: return its historical revision,
  retain the newer content and report current projection state separately.
  In missing/drifted projection rows, externally remove/change the file before
  restarting and retrying: report that state, never claim the original bytes
  are installed, restore them or allocate a replacement identity. Compare
  reopened directory membership, bodies, history, receipts and high-water
  before/after every replay. Boundary real: stdio publication/replay across
  server restart, current readback, durable result receipt, store and filesystem;
  only clock/caller inputs may be faked.
  Command: `cargo test -p cadence --test phase27_plan phase27_acknowledged_allocation_replays_original_identity -- --exact`.
  Expected: one passing test. Reason: recomputing allocation or replaying old
  bytes loses the request's historical result or resurrects replaced content.
- **P27-T6-A1 — artifact.** `plan/model.rs`, `plan/persistence.rs`,
  `plan_service.rs` and plan intent validation in `store/transaction.rs`:
  durable occurrence-scoped request result containing exact approved payload
  digest and ordered original identities/revisions, read before allocation or
  stale-preview validation. Current projection state is distinct from the
  historical result. Reason: `Snapshot.operations` contains only a transaction
  fingerprint and cannot reconstruct returned allocation identities.

### T7

- **P27-T7-C — check.** File `crates/cadence/tests/phase27_plan.rs`, function
  `phase27_unauthorized_replacement_is_refused`.
  Setup: publish a native unexecuted plan through the real approved operation,
  retaining its exact bytes/revision and occurrence. Submit changed content to
  that occupied identity with absent, declined, original-only, wrong-target,
  stale-old-revision/bytes and mismatched-new-content authorization. Also label
  requests as gaps/general replanning where supported: those labels confer no
  replacement authority. Call the same public publication operation.
  Expected: a typed refusal names the replacement-authorization rule and
  existing phase/plan identity, and reopened existing content, revision,
  history and allocation state remain unchanged. The positive control approves
  the exact target, observed old bytes/revision and new content: it replaces an
  eligible native unexecuted plan at the same identity, changes revision and
  retains both publications/approvals. A second approval based on the old
  revision loses with a precise stale-target refusal. In another real fixture,
  use Notes' handwritten owner progress-gate/answer setup through the real
  `SessionFactory` / `Session::commit_evidence` before launching stdio, then
  admit a schema-compatible legacy plan through public `execute-next` and then
  request replacement with otherwise exact authorization: execution admission
  forbids replacement in place. Require `execute-next` to return a dispatch and
  persist its own admission; if it cannot, report the actual blocking
  prerequisite in C7 rather than substitute another refusal or a seeded
  admission record. An occupied legacy alias is refused even when
  the requested canonical filename is absent. Preserve legacy bytes; no
  conversion is authorized. Boundary real: public operation, actual prior
  publication/admission, conditional replacement, store and filesystem; only
  clock/caller inputs may be faked. Never manufacture the admission record.
  Command: `cargo test -p cadence --test phase27_plan phase27_unauthorized_replacement_is_refused -- --exact`.
  Expected: one passing test. Reason: original approval, labels or stale bytes
  cannot authorize a different publication under an existing identity.
- **P27-T7-A1 — artifact.** `plan/model.rs`, `plan/validation.rs`,
  `plan/persistence.rs`, `plan_service.rs`, and plan publication validation in
  `store/writer.rs`/`store/transaction.rs`: exact replacement authorization,
  observed-old-content preconditions, irreversible consumed-identity history
  and refusal after any execution admission. Reason: checking only whether a
  filename exists misses aliases and changing an admitted record breaks history.
- **P27-T7-A2 — artifact.** `plan/instructions.rs`, its registration in
  `plan/mod.rs` and `main.rs`, plus generated `skills/cad-plan/SKILL.md`: the
  compiled planner role and actual authoring-only intake/preview/publish/readback
  contract, exact initial and replacement approvals, replay handling and typed
  refusal correction. Inspect the compiled source for substance; the rendered
  Markdown is not a check subject. Reason: a frozen direct PLAN writer bypasses
  the binary's approval and replacement rules.
- **P27-T7-O1 — observation, source O1.** The owner runs `/cad-plan` for a real phase in a real host, sees the
  planner reach the binary's plan publication operation, sees one
  deliberately mismatched identity come back as a typed refusal in the
  conversation, and sees the approved plan land at `PLAN-<k>.md` with
  nothing written before approval. The plan's quality is the model's and is
  not asserted.
  Provenance: specification approved by the owner 2026-09-10 in CONTEXT.md; not yet seen.
  O1 is pending, and is the same observation attached only to T7 here and T1
  in PLAN-1. The executor records a seen episode only when observer, time and
  result are supplied; never invent them or infer them from specification
  approval. Reason: compiled instruction text cannot establish host conduct.
  Accepted O1 caps T7 at `concerns`, never `met`.

## Tasks

### Task 1: Publish gap work without recycling identities

- **Files:** `crates/cadence/src/plan/model.rs`,
  `crates/cadence/src/plan/inventory.rs`,
  `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/plan_service.rs`,
  `crates/cadence/src/store/writer.rs` (`Writer::execute_store`),
  `crates/cadence/src/store/transaction.rs` (`Intent::validate`),
  `crates/cadence/tests/phase27_plan.rs`.
- **Action:** Deliver P27-T5-C and P27-T5-A1/A2. Write C5 and record red before
  enabling the gap publication path. Gap work uses the same exact approval and
  publication transaction, with a newly allocated identity, never replacement.
  Complete conservative occupancy from existing PLAN basenames, their identity
  declarations, legacy report identities and every known native execution
  admission/outcome/receipt; a bare PLAN reserves 1 even without strict native
  execution frontmatter. Retain discovered consumed identities/provenance with
  the successful publication so deletion cannot lower high-water. Do not mark
  legacy content approved, rename it, rewrite it or dispatch it from planning.
  Detect duplicate/ambiguous aliases and conflicting declared identities,
  including an absent canonical filename whose number is already occupied.
  Refuse with identity/path and explicit-resolution guidance rather than
  normalize a conflict away or silently treat unreadable history as empty.
  Use the same explicit active-cycle occurrence for all allocations and
  receipts; a changed set digest is not a new occurrence. Preserve existing
  plans, reports, SUMMARY/UAT and execution records byte-for-byte/as records.
  Revalidate the legacy inventory under the existing writer's ownership and
  conditional transaction; previews neither reserve numbers nor acquire a
  writer. Do not change the admitted execution set or reopen completion: D-88's
  gate remains in force and phase 12 owns that reconciliation. Carry the
  frozen gap failure at `cadence-core/workflows/plan-gaps.md`, step 3, as the
  reason for new identity, not authority to call its JavaScript allocator.
- **Verify:** `cargo test -p cadence --test phase27_plan phase27_gap_plan_uses_previously_unused_identity -- --exact`
  selects one passing test: reopened listing contains the new unused gap
  identity, deleted/report/execution numbers remain consumed and priors survive.

### Task 2: Require exact authorization for native replacement

- **Files:** `crates/cadence/src/plan/model.rs`,
  `crates/cadence/src/plan/validation.rs`,
  `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/plan_service.rs`,
  `crates/cadence/src/store/writer.rs` (`Writer::execute_store`),
  `crates/cadence/src/store/transaction.rs` (`ExternalChange::validate`,
  `Intent::validate`), `crates/cadence/tests/phase27_plan.rs`.
- **Action:** Deliver P27-T7-C and P27-T7-A1. Write C7 and record red before
  replacing PLAN-1's occupied-target refusal with the authorized native branch.
  Only an unexecuted native plan is eligible. Require fresh identified owner
  approval naming its target, observed old revision/bytes and exact proposed
  new content; validate that approval before `first_touch` or writer requests.
  Missing/declined or original-only authorization for an occupied target is a
  typed replacement refusal, not permission to write a draft over it. Recheck
  actual old bytes and record revision under writer ownership and the
  conditional transaction; stale authorization loses precisely and does not
  overwrite the winner. Retain every publication/approval and original request
  result, advance content revision while preserving stable identity and
  monotonic allocation history. Validate this allowed record delta and exact
  bytes at commit and recovery, including expected-old-file preconditions.
  Inspect native execution active dispatches, outcomes and receipts for prior
  admission; once admitted, in-place replacement is forbidden even if no
  current active dispatch remains. Never infer permission from gap mode,
  checker results, selected-review prose or a general planning instruction.
  Refuse occupied legacy aliases even when the proposed filename is absent;
  legacy inputs remain read-only. Additional work for an admitted plan must
  receive a new approved gap identity. Do not reconcile execution history or
  implement phase 30's edit selection workflow.
- **Verify:** `cargo test -p cadence --test phase27_plan phase27_unauthorized_replacement_is_refused -- --exact`
  selects one passing test with typed authorization/stale/admitted refusals,
  unchanged winners and the authorized native replacement control retaining history.

### Task 3: Replay the durable allocation result before choosing numbers

- **Files:** `crates/cadence/src/plan/model.rs`,
  `crates/cadence/src/plan/persistence.rs`,
  `crates/cadence/src/plan_service.rs`,
  `crates/cadence/src/store/writer.rs` (`Writer::execute_store`,
  `Operation::CompareTransact`), `crates/cadence/src/store/transaction.rs`
  (`Intent::validate`), `crates/cadence/tests/phase27_plan.rs`.
- **Action:** Deliver P27-T6-C and P27-T6-A1. Write C6 and record red before
  completing replay. Resolve the saved caller request id within its durable
  phase occurrence before selecting numbers, checking stale preview allocation
  or treating a current occupied target as a replacement request. Bind that id
  to the exact approved payload digest and ordered assigned identities plus
  original revisions. Same id/different payload is a typed refusal. Reuse the
  result receipt committed with the initial publication, not a freshly built
  transaction fingerprint against unrelated newer snapshot state. Recheck
  receipt existence under the serialized owner if publication is still needed;
  retain `CompareTransact`'s replay-before-stale semantics and existing journal
  recovery. A recovered publication must expose the same saved allocation.
  Replay returns the historical result and separately observes current
  projection state. Confirm present matching files; explicitly report missing,
  drifted or newer authorized content without claiming the original revision
  is installed. Never restore old content, advance high-water, reserve another
  number or rewrite historical receipts on replay. Read-only result/readback
  does not acquire a writer just to observe installed files. Preserve context
  replay and generic operation fingerprints; the plan result record supplements
  `Snapshot.operations`, rather than changing what its existing entries mean.
- **Verify:** `cargo test -p cadence --test phase27_plan phase27_acknowledged_allocation_replays_original_identity -- --exact`
  selects one passing test returning original identities/revisions across
  acknowledgment, intervening writes, replacement and restart with no second file.

### Task 4: Compile the authoring-only planner front door

- **Files:** `crates/cadence/src/plan/mod.rs`,
  `crates/cadence/src/plan/instructions.rs` (new),
  `crates/cadence/src/main.rs` (`Command`, `run_command`, context instruction entrypoint),
  `crates/cadence/src/server.rs` (query/apply tool descriptions and schemas),
  `skills/cad-plan/SKILL.md`.
- **Action:** Deliver P27-T7-A2 and carry P27-T7-O1/P27-T1-O1 as the same owner
  observation. Compile the substantive planner role using
  `context::instructions::markdown` and `Command::ContextInstructions` as the
  pattern. Add a renderer entrypoint that opens no project/store, and generate
  the declared host skill from that compiled source. Include the acceptance
  design's Planner block verbatim. Explain this phase's authoring-only boundary,
  native-truth prerequisite, canonical numbered native schema and opaque map
  body. Direct the host to read the phase scope/prior plans and inspect code,
  derive tasks from the owner's locked truths, prepare one check per truth and
  the other evidence kinds, and keep the draft in conversation. Schema-valid
  execution fields describe authored commands; the binary does not run them
  or certify acceptance readiness during planning. No truth invention or
  repeated truth attestations. For gap mode, read unresolved UAT and prior
  plans/reports, request a new preview and preserve their history.
  Use the actual implemented query/apply schema, show the complete proposed
  content and ordered identities, obtain exact identified approval and reported
  time, then submit and wait for confirmed acknowledgment. Replacement needs
  the exact target/old revision/new content approval; collisions require a new
  preview and approval, while uncertain acknowledgments retry the same request
  id and exact approved payload. Explain typed refusals and current projection
  drift separately from historical replay. Never fall back to direct PLAN,
  store or STATE writes, the frozen workflow, post-write gates or automatic
  retargeting. Remove those authoring write permissions/dependencies from the
  generated front door. Do not port reviewer/checker dispatch, paid review,
  selected edits, docs commit or requirement/cursor writers; those remain with
  their owning phases and are not prerequisites here. Keep all role-specific
  instructions compiled, with no user override; no disk loader is needed.
  Preserve O1's pending status, specification provenance and concerns cap;
  record a seen episode only when observer, time and result are supplied.
  Neither generated Markdown nor model-generated plan quality becomes an acceptance check.
- **Verify:** `cat crates/cadence/src/plan/instructions.rs crates/cadence/src/plan/mod.rs crates/cadence/src/main.rs crates/cadence/src/server.rs`
  opens P27-T7-A2 for inspection: substantive compiled role, actual public
  contract, project-free rendering entrypoint, exact approval/replacement
  procedure, replay guidance and explicit provisional readiness must exist.
  Inspect the rendered skill's provenance as an artifact, not as a tested
  string or a substitute for O1. No additional acceptance check is created.

## Notes

- Four tasks follow PLAN-1's six. Ten distinct concerns require two plans
  under the eight-task ceiling. They share source/store/test files and run
  sequentially; the explicit dispatch overrides the frozen contract/template's
  independence-only split restriction. No plan-shape directive is being changed.
- Lifetime remains the explicit active-cycle phase occurrence chosen in
  PLAN-1, not a mutable plan-set digest. Cycle migration is deferred and cannot
  silently reset a counter or adopt archived/decimal inputs as native approval.
  Retain all known consumed identities once observed in an approved publication.
  No source proves that legacy files deleted before any surviving record can
  be reconstructed; do not claim exhaustive erased history. Ambiguous surviving
  evidence requires explicit resolution rather than an optimistic allocation.
- The compiled `/cad-plan` surface is deliberately authoring-only. Its new
  query/apply operations are the publication authority; the frozen writer flow
  is not invoked. Native evidence items/versions and their association/refusal
  rules remain phases 28/29, execution activation/history reconciliation is
  phase 12, verdicts are 13, and review handoff/selected edits are 30.
- D-82's revision identity is available to phase 28, whose rendered map must
  later publish through this same mechanism. This phase preserves map bytes
  but does not type, attach, validate or claim them as execution-ready evidence.
- Task 2 precedes Task 3 so T6's one check can exercise historical replay after
  a real authorized replacement. For C1's otherwise-dispatchable fixture and
  C5/C7's admitted-legacy controls, use real project/config/owner inputs and
  actual Git setup as needed. Before launching the fixture's stdio server,
  create a real `SessionFactory` with `cadence::config::planning_policy` and
  isolated global config, then call `SessionFactory::first_touch` on its real
  `.planning` root. Reuse the handwritten authority inputs in `mcp.rs` at
  `Fixture::seed_authority`, but commit them through `Session::commit_evidence`
  rather than its `AllowFixture` policy/direct-store transaction. The inputs
  are two version-1 `cadence::evidence::Record` values for the same progress
  gate: scope `project`/`planning_root` is the real fixture, `cycle` is `live`,
  `occurrence` is `phase-<N>-execution`, `phase` is the bound phase string,
  `plan` is `native-execution`, and `report` is `phases/<N>/SUMMARY.md`.
  The gate has `id: fixture-progress`, `purpose: progress`, null `checkpoint_id`,
  `question: Continue?`, `need: Execution authority`, and empty `options`.
  Commit its `state: {status: unanswered}` first, then the same gate with
  `status: answered` and answer values `question_id: fixture-progress`,
  `actual_response: Proceed`, null `selected_option`/`adjustment`,
  `disposition: approve`, and `authorization_id: fixture-authorization`.
  Obtain the current view through `Session::request(Operation::ReadVerified)`
  before each `Session::commit_evidence`, using distinct handwritten operation
  ids `fixture-authority-0` and `fixture-authority-1`. Let that real seam commit
  history and projection with the real policy/store/conditional transaction;
  expected values remain handwritten. Release setup session/factory handles
  before launching stdio. These records are permitted owner inputs, not
  execution occurrences, dispatches or receipts. `execute-next` must perform
  its own real admission in C5/C7; C1 must reach its named provisional gate
  with the other prerequisites established. If a prerequisite still blocks a
  check, identify it in that check rather than claim admission or add a new
  public authorization API. No new production dependency is planned.
- Existing files were read before leasing them: `main.rs`, `server.rs`,
  `store/writer.rs`, `store/transaction.rs` and `skills/cad-plan/SKILL.md`.
  New plan domain/service/test files are created by PLAN-1, and the new
  instruction module follows the read phase-11 instruction source. Research
  citations relied upon were checked against the tree: `Snapshot.operations`,
  exact context replay, `CompareTransact`, native execution occurrence and
  report identity semantics. The research draft's older HEAD is not assumed.
- Each check is written before its implementation and its red/green commits
  recorded. Run task Verify commands during work; the executor runs the full
  suite once at plan close, outside task Verify. The verifier runs only the
  seven mapped checks and inspects the other evidence. If required at execution
  close, clippy is `cargo clippy --workspace --all-targets -- -D warnings` and
  takes no stdin. This planner ran no build, tests or clippy and made no commit.
- O1 remains pending/not yet seen with the specification provenance above;
  the executor records a seen episode only when observer, time and result are
  supplied. Live host conduct and model-authored plan quality are knowingly outside the
  automated checks; passing them never upgrades observation to reproducible evidence.
