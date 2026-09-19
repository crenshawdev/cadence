---
phase: 28
plan: 2
requirements: [T6, T7]
files:
  - crates/cadence/src/plan/mod.rs
  - crates/cadence/src/plan/model.rs
  - crates/cadence/src/plan/evidence.rs
  - crates/cadence/src/plan/associations.rs
  - crates/cadence/src/plan/map_history.rs
  - crates/cadence/src/plan/map_view.rs
  - crates/cadence/src/plan/persistence.rs
  - crates/cadence/src/plan/validation.rs
  - crates/cadence/src/plan_service.rs
  - crates/cadence/src/plan/instructions.rs
  - crates/cadence/src/server.rs
  - crates/cadence/tests/phase28_evidence.rs
  - crates/cadence/tests/fixtures/phase27_absent_map.json
  - skills/cad-plan/SKILL.md
---

# Phase 28: Evidence associations - Plan 2

## Goal

A plan's evidence map attaches to the phase's current truths; a map that
leaves a truth uncovered, an item naming no truth, or an item naming a stale
truth version is refused. Following PLAN-1, retained publication history and
authoritative phase readback make the exact item set available to later consumers.

## Must be true when done

- T6. When a plan is republished at a different content revision, the caller
  sees its previous evidence map marked as superseded.
- T7. When a caller reads a phase's saved evidence map, the caller gets the
  authoritative item set with its truth associations and publication
  revisions.

## Context

Run after PLAN-1; shared source/test files require sequential execution.
D-92/D-93/D-95/D-97/D-98 govern identity, phase union, readback, history and replay.
All other phase-28 decisions and carried phase-27 approvals/readiness rules continue to bind.
Keep existing `CompareTransact`, receipt replay, confirmed writes and read-only sessions.
Do not implement phase 29 gates, execution receipts, truth revision, verdicts, waivers or review dispatch.

## Evidence map

Bind these items to the exact owner-approved T6/T7 text in phase 28 CONTEXT.md,
specification approved 2026-09-10 at dispatch HEAD `7d5ccc4f`. Obtain actual
numeric truth versions from native authority at publication; these handwritten
plans do not manufacture native records. PLAN-1's evidence preamble and wire
grammar apply unchanged. These are the only two further acceptance checks.

Both use `crates/cadence/tests/phase28_evidence.rs`, the actual `cadence serve`
binary over initialized stdio MCP, real temporary projects and native truths
authored through `context-submit`. Preview uses `cadence_query` / `plan-read`,
publication and replacement use `cadence_apply` / `plan-submit` with phase 27's
exact approvals. No fake public operation, store, filesystem, queue, context
authority or projection: only clock and caller inputs may be faked. Each truth
has one test function, with cases and controls inside it. Handwrite the expected
input set; never use production map rendering, canonicalization, projection or
digest assembly to produce the oracle.

Before final assertions exit the server, release handles and reopen the files
and snapshot with the actual JSONL records. Check journal absence before
reopening a real `Filesystem` / `Store` and `Operation::ReadVerified`. C7's
actual-file intent presence sentinel explicitly uses PLAN-1's retained-intent
read-only exception instead: keep the sentinel present, inspect saved bytes
with `Snapshot::parse`, and never open a recovering writer or assert journal
absence for that case. Restart
the real binary to read current and retained records. Drift/missing controls
change actual files; read-only reads must not repair them. Refusal assertions
name the rule and the affected truth/item/association or publication precondition,
and compare reopened state before/after. Commands select one test and must
report `1 passed; 0 failed`. There are no link items: neither truth names a
value crossing between two components.

### T6

- **P28-T6-C — check.** File `crates/cadence/tests/phase28_evidence.rs`, function
  `phase28_republication_supersedes_previous_map`.
  Setup: publish complete map M1 with plan revision R1 through the public
  operation; retain the original request, exact approval and installed bytes.
  Approve replacement at the same plan identity with changed non-map body
  content, producing R2, and explicitly resubmit the map. Other cases change a
  spec under a stable item id, replace with explicit provisional mapless content,
  or replace one of two contributions sharing an item. The last case may not
  change its shared definition unless all conflicting current contributions
  are replaced together. Call: public `plan-submit` replacement, exit/restart,
  then public `plan-read` retained publication/map readback (and `evidence-read`
  once Task 3 delivers it). Expected property: R2 differs from R1; M1 remains
  readable with its original full payload, plan identity, R1 and receipt binding,
  explicitly marked `superseded`; only explicitly submitted/revalidated M2 may
  be current under R2. Mapless R2 has no current contribution and remains
  provisional with visible missing coverage. Identical old section bytes or
  truth versions never carry authority forward. Old item revisions remain
  retrievable after a changed spec; unaffected plans retain their contributions.
  Missing/stale/wrong-new-map replacement authorization and invalid replacement
  associations refuse without superseding the winner.
  Historical absent-field case in this SAME C6: restore PLAN-1 Task 1's captured
  `crates/cadence/tests/fixtures/phase27_absent_map.json` tree byte-for-byte into
  exactly the canonical absolute root recorded in its provenance,
  `/tmp/cadence-phase27-absent-map-df43af15`, independent of TMPDIR. Apply PLAN-1
  Task 1's exclusive sibling-file lock and ownership-marker protocol: refuse
  an active holder or existing unowned/symlink root, remove only an owned prior
  root on entry, recreate it, and hold the lock through all calls and cleanup.
  Before starting the case, require the canonical project/planning roots and
  manifest's active paths to equal the captured mapping: repo configuration is
  that root's `.planning/config.v4.json`, global is absent/null, and both binary
  launches use empty `CADENCE_GLOBAL_CONFIG`. Fail any mismatch without changing
  captured bytes; replay success alone cannot prove replacement writer admission.
  Keep both replays and the replacement on this same root. On exit or failure,
  including assertion unwind, stop/reap children and remove the owned root before
  releasing the lock; use the same next-entry cleanup for hard-kill leftovers.
  Do not relocate, normalize, rewrite or rehash the fixture. This is a real
  pre-extension publication/receipt,
  not a newly provisional request or a fabricated store record. Check the
  captured request and approval have no `content.evidence_map` or provisional
  field, and the saved publication/receipt retain their original absent shape.
  Start the extended real binary and replay the captured request verbatim:
  require `replayed: true`, the original results/identity/revision and payload
  digest, historical map absence and the original `installed` projection.
  Stop/reopen and compare all saved bytes with the capture. Then preview and
  explicitly approve a replacement at that identity naming its actual old
  bytes/revision, changing the body and submitting the first complete attached
  map for native T1 through `plan-submit`. Stop/restart and replay the original
  absent-field request again. Assert the original payload digest, receipt
  serialization, results and historical map absence remain unchanged; projection
  reports `newer-authorized` with the replacement's current revision. The new
  map alone is current, its approved PLAN bytes remain installed, and this replay
  leaves the entire post-replacement tree unchanged. Restore only captured
  historical files; never seed approved map authority directly through the store.
  Replay controls in the SAME test: after replacement and restart, resubmit the
  original R1 request verbatim. It returns the original historical result/map
  binding without reinstalling M1, changing R2, advancing map history or
  allocating another identity. Changing only an item spec or association reason
  under that request id is a typed `request-id-reuse` refusal. Include missing
  and drifted current projections; replay reports their state without repair.
  Two real callers with competing previews/approvals cannot both replace the
  same old revision: the loser names the changed target/precondition, preserves
  the winner and requires fresh preview/approval. No manufactured receipt or mocked
  conditional transaction is used. After all calls reopen actual map records,
  receipt results, PLAN bytes and store; assert history/current bindings by hand.
  Boundary real: public replacement/replay, snapshot, store and filesystem;
  only clock/caller inputs may be faked.
  Command: `cargo test -p cadence --test phase28_evidence phase28_republication_supersedes_previous_map -- --exact`.
  Expected: one passing test. Item reason: carrying an old map or replaying its
  installation would attach evidence to a publication it did not approve.
  Association reason for T6: the old contribution's superseded mark must survive
  the exact replacement trigger and restart.
- **P28-T6-A1 — artifact.** `plan/map_history.rs`, `plan/model.rs`,
  `plan/persistence.rs` at `contribute` / `validate_publication`,
  `plan/validation.rs` at `replacement`: immutable map/item revisions, current
  contribution references, retained supersession relation and exact new-map
  authorization. Reason: a digest list alone cannot preserve what a later
  rejected verdict judged. Association reason for T6: historical map content
  and the fact of its supersession must both remain readable.
- **P28-T6-A2 — artifact.** `plan/persistence.rs` at `replay` / `payload_digest`,
  `plan_service.rs` at `replay_answer` / `execute`, and the existing callers
  `store/writer.rs` at `Operation::CompareTransact` / `Writer::execute_store`
  and `store/transaction.rs` at `Intent::validate`: complete payload receipts,
  historical map bindings and validation on the committing snapshot. Reason:
  replay must not reconstruct or reinstall authority using current allocation.
  Association reason for T6: a retry must preserve the superseded contribution
  rather than silently make it current again.

### T7

- **P28-T7-C — check.** File `crates/cadence/tests/phase28_evidence.rs`, function
  `phase28_readback_returns_authoritative_map_with_input_digest`.
  Setup: author two native truths; publish two plans together with handwritten
  checks, a shared artifact, a shared pending observation and separate per-truth
  association reasons. Each truth has one check across the union. Use known
  opaque ids, literal/property specs, caller times, body bytes and request ids.
  Perform an authorized replacement to retain historical input as well as the
  current set. Stop the server, reopen the filesystem/store, restart and call
  public `cadence_query` / `evidence-read` for that phase.
  Expected property: the view's schema identifier, occurrence, full current
  truth id/version/text/kind records, every contributing plan identity/content
  revision, retained map revisions, items with id/kind/spec/reason/item revision,
  explicit associations with reasons and origin, shared aliases, coverage and
  provisional readiness equal the handwritten expected set. Compare full
  membership, not only counts or selected ids. History identifies the exact old
  and current publication events. Check the input digest against independently
  assembled handwritten expected canonical input bytes using the algorithm in
  Notes; do not hash the returned view to construct the expected digest.
  Assert identical digest on a restart with unchanged inputs, and expected
  digest changes for actual changed inputs. Modify only a PLAN projection,
  including malformed frontmatter/invalid UTF-8 in separate cases, then remove
  it: saved items remain authoritative and projection state becomes `drifted`
  then `missing`, with observed bytes represented by digest only. No Markdown
  item is adopted and no saved item disappears. Restore the approved bytes as
  caller input and get `installed`. Reads leave reopened files/store unchanged.
  Exercise an actually inconsistent read using a real companion process that
  changes a participating file while readback runs, with no fake read hook;
  responses must either describe one stable observed input set with its digest
  or explicitly identify changed/inconsistent inputs, never claim a coherent
  blend. Add an actual-file presence sentinel in a separate temporary copy of
  the normally published fixture, after stopping its server: write exactly
  `{"retained":"pending owner work"}` plus a newline to
  `.planning/.store-intent.json`, as in phase27_plan.rs. This proves presence
  handling only; it is NOT evidence of a retained transaction. Save all input
  bytes including the sentinel, start the real binary and call `evidence-read`.
  Require an inconsistent answer naming the outstanding intent, with no usable
  coherent-view `input_digest`. Stop the server and apply PLAN-1's read-only
  retained-intent exception: inspect PLAN/state/JSONL and sentinel bytes directly,
  parse with `Snapshot::parse`, assert the entire input tree is unchanged, and
  never open `Filesystem` / `Store` for recovery. Dispose of this isolated temp
  project only after those assertions; no intent recovery is part of teardown.
  An empty/mapless phase returns explicit absence/missing coverage, never an
  inferred map. Final comparisons follow the reopen protocol and its explicit
  read-only sentinel exception above.
  Boundary real: binary read operation, native authority, retained history and
  actual filesystem; only clock/caller inputs may be faked.
  Command: `cargo test -p cadence --test phase28_evidence phase28_readback_returns_authoritative_map_with_input_digest -- --exact`.
  Expected: one passing test. Item reason: reconstructing a map from Markdown
  lets the reader choose what later verification judges. Association reason for
  T7: the authoritative set and its input identity must agree after restart.
- **P28-T7-A1 — artifact.** New `plan/map_view.rs`, `plan/evidence.rs`,
  `plan/associations.rs`, `plan_service.rs`, `server.rs`: substantive read-only
  phase projection with a published schema identifier, deterministic input
  digest, retained revisions, explicit coherence and independent projection
  health. Reason: `plan-read`'s existing disk inventory alone can reject drift
  before returning saved authority. Association reason for T7: a verifier must
  read an exact binary-owned item set even when Markdown is absent or damaged.
- **P28-T7-A2 — artifact.** `plan/instructions.rs` at `ROLE` / `markdown`,
  `server.rs` tool descriptions and generated `skills/cad-plan/SKILL.md`:
  compiled typed-map authoring, exact preview/publication, shared associations,
  refusal correction and authoritative readback instructions. Inspect source
  for substance and the generated file's provenance; rendered Markdown is
  NOT a check subject. Reason: the current compiled role explicitly describes
  maps as opaque and cannot guide the new public workflow. Association reason
  for T7: callers must use the saved phase view rather than reconstruct items.
- **P28-O1 — observation attachment.** Attach the SAME item defined in
  PLAN-1 to T7, retaining its T1 association and both reasons. Source O1 in
  `.planning/phases/28/CONTEXT.md`; specification approved by the owner
  2026-09-10; **pending, not yet seen**. The episode is the owner using real
  `/cad-plan`, seeing typed uncovered-truth refusal, approved map publication
  and readback; map quality is not asserted. Item reason: deterministic stdio
  checks cannot establish real host conduct. T7 association reason: the owner
  must see authoritative readback in the host. Do not mint another id, infer a
  seen result, add a check or turn specification approval into observation.
  When seen this remains supplementary evidence capped at `concerns`.

## Tasks

### Task 1: Retain superseded publication maps

- **Files:** `crates/cadence/src/plan/map_history.rs`,
  `crates/cadence/src/plan/model.rs` (`Publication`, `Receipt`, `Occurrence`),
  `crates/cadence/src/plan/persistence.rs` (`contribute`, `validate_publication`),
  `crates/cadence/src/plan/validation.rs` (`replacement`),
  `crates/cadence/src/plan_service.rs` (`execute`),
  `crates/cadence/tests/phase28_evidence.rs`.
- **Action:** Deliver P28-T6-A1 and the replacement/restart portion of P28-T6-C.
  Write those C6 assertions and record red before implementation. Keep immutable
  map payloads and item definitions by retained revision, plus an explicit
  supersession relation/current reference; do not mutate old payloads or
  receipt results to label them retired. Expose the superseded mark in public
  `plan-read` history now, so this task is independently observable before
  Task 3's aggregate view. Bind each retained map event to the existing
  occurrence/request receipt, target identity and publication content revision.
  A changed non-map body produces a new publication even if the resubmitted
  map spec is unchanged. Require explicit resubmission/revalidation for the
  new revision. Mapless replacement is permitted only as explicitly provisional
  authoring, removes the previous contribution from current coverage and
  reports absence honestly. Replacement still requires phase 27's exact target,
  old document/revision and proposed content authorization; its proposed
  content now includes the map. Validate the resulting whole phase union before
  committing an attached replacement. Retain unchanged shared definitions in
  other contributions; refuse conflicts rather than revising them implicitly.
  Ensure a new item spec under a stable id retains its prior item revision.
  Existing `validate_publication` reconstructs the allowed history delta at
  commit/recovery. Do not add a truth revision or verdict lifecycle.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_republication_supersedes_previous_map -- --exact`
  selects one passing C6 for replacement, immutable history, mapless controls
  and superseded readback after restart. Task 2 adds replay assertions to this
  same function, not another check.

### Task 2: Preserve map bindings through request replay

- **Files:** `crates/cadence/src/plan/map_history.rs`,
  `crates/cadence/src/plan/persistence.rs` (`replay`, `payload_digest`,
  `contribute`, `validate_publication`),
  `crates/cadence/src/plan_service.rs` (`execute`, `replay_answer`, `path_error`),
  `crates/cadence/tests/phase28_evidence.rs`,
  `crates/cadence/tests/fixtures/phase27_absent_map.json` (read-only; captured in PLAN-1 Task 1).
- **Action:** Complete P28-T6-C and deliver P28-T6-A2. Add its specified replay
  and competing-request controls to the SAME test and observe failure before
  implementing any missing behavior. Bind full ids, kind/spec, item reasons,
  association reasons/versions and order to `payload_digest` and the existing
  occurrence-scoped receipt. Look up replay before stale inventory/replacement
  checks and map revalidation against newer inputs, preserving the originally
  acknowledged historical result. Same request id with different map payload
  is refused. Replays do not create map revisions, change supersession, restore
  files or relabel historical maps current; distinguish current projection
  health from historical acknowledgment. Recheck the receipt after `first_touch`
  if a write is still needed, preserving the existing conflict/replay branch.
  Only a new publication validates candidate associations/coverage against the
  verified snapshot it passes to `CompareTransact`; the writer revalidates the
  full delta on its same current snapshot and intent recovery repeats it.
  Keep precise conflict diagnostics if a competing approval wins. No retry
  allocator, second writer, reader-start guard, transaction rewrite or context
  revision hook. Old phase-27 receipts retain their original serialization,
  payload digests and historical map absence, including after an approved
  phase-28 replacement adds the first map. Exercise the captured absent-field
  case specified in C6 before and after that replacement; never rebuild its
  request with the now-provisional phase-27 helpers or rewrite its saved bytes.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_republication_supersedes_previous_map -- --exact`
  selects one passing complete C6: exact replay returns historical binding,
  map-only changes refuse request reuse, and reopened current/history/projection
  state remains the winning publication. Record the added assertions' red/green.

### Task 3: Expose the authoritative phase evidence view

- **Files:** `crates/cadence/src/plan/map_view.rs` (new),
  `crates/cadence/src/plan/mod.rs`, `crates/cadence/src/plan/evidence.rs`,
  `crates/cadence/src/plan/associations.rs`,
  `crates/cadence/src/plan_service.rs` (`Command`, `execute`),
  `crates/cadence/src/server.rs` (`QueryArguments`, `PublicServer::call_tool`),
  `crates/cadence/tests/phase28_evidence.rs`.
- **Action:** Deliver P28-T7-C and P28-T7-A1. Write C7 and record red.
  Add the read-only `evidence-read` query through the existing resident's plan
  service; no attach apply operation. Build the schema/digest contract in Notes
  from native context and saved map/publication records only. Include current
  and retained contribution bindings, canonical shared items and every explicit
  association reason/origin. Reuse the candidate-set semantics for coverage,
  reporting absent or stale contributions rather than treating history as
  current. Keep provisional readiness regardless of coverage. Read canonical
  PLAN bytes separately for installed/missing/drifted state, without parsing
  inventory/Markdown as authority or letting malformed frontmatter hide the
  saved map. Observe byte digests, not lossy UTF-8, for projection health.
  Read/validate the snapshot and relevant filesystem inputs before and after
  assembling the view; changed inputs or an outstanding intent must produce
  explicit inconsistency, not a coherence claim. The digest binds the exact
  observed inputs by the deterministic recipe below. Never acquire a writer,
  recover an intent, create storage or repair a projection for readback.
  Return explicit absence on an uninitialized or mapless phase. Do not accept
  verifier-supplied expected sets, verdicts, observation results or truth statuses.
- **Verify:** `cargo test -p cadence --test phase28_evidence phase28_readback_returns_authoritative_map_with_input_digest -- --exact`
  selects one passing C7 with complete handwritten expected membership, fields
  and independently computed expected input digest after restart and real drift.

### Task 4: Compile the typed-map planner instructions

- **Files:** `crates/cadence/src/plan/instructions.rs` (`ROLE`, `markdown`),
  `crates/cadence/src/server.rs` (query/apply tool descriptions),
  `skills/cad-plan/SKILL.md`.
- **Action:** Deliver P28-T7-A2; carry the shared P28-O1 for T1/T7 as pending.
  Replace the compiled opaque-map description with the actual typed schema,
  explicit native version lookup, one authored check per truth, supplementary
  observations, phase-wide contribution union, opaque ids and per-association
  reasons. Keep the acceptance design's Planner block verbatim. Explain full
  read-only preview, one exact combined approval, canonical map rendering,
  explicit replacement/resubmission, immutable history and historical replay.
  Name the implemented typed refusal rules and how the caller corrects them
  through the same public operation; no direct file/store fallback. Direct
  consumers to `evidence-read`, its input digest and separate projection health.
  Describe explicit provisional mapless authoring honestly and retain the
  mechanical execution-readiness boundary. A filled typed field does not claim
  phase 29's semantic gates; no execution, red/green-record API, verifier or
  review dispatch is added. Preserve O1's exact phase-28 episode and specification
  provenance as pending, without inferring host behavior from tests. Generate
  the declared skill from the existing project-free `cadence plan-instructions`
  entrypoint; no new loader, user override, command or independently authored
  Markdown authority. Inspect the rendered file as an artifact only.
- **Verify:** `cat crates/cadence/src/plan/instructions.rs crates/cadence/src/server.rs`
  opens P28-T7-A2 for substantive inspection: actual schema and query names,
  combined preview/approval, refusal correction, historical replay, provisional
  readiness and pending O1 must be present. Inspect the generated skill's
  provenance without writing a string-comparison acceptance test.

## Notes

- Four tasks follow PLAN-1's six. Publication, replacement, replay, readback
  and compiled instructions differ in trigger or lifecycle and are not compressed
  to fit one eight-task plan. Shared files require sequential execution; the
  dispatch explicitly overrides the contract/template's independence-only
  split restriction. There is no parallel slice or changed phase numbering.
- Proposed read contract: `cadence_query` with `operation: evidence-read` and
  canonical positive integer `phase`, routed to the existing plan resident.
  Successful view fields are `schema: acceptance-map-view-1`, `phase`,
  `occurrence`, `truths`, `contributions`, `items`, `associations`, `aliases`,
  `history`, `coverage`, `readiness: provisional-authoring`, `projections`,
  `coherence`, `input_digest`. These are explicit wire-design choices, not
  invented existing Rust symbols. `truths` contains actual id/version/text/kind;
  contributions identify plan, content revision, map revision and request
  receipt. Items expose id/kind/spec/reason/item revision. Associations retain
  truth id/version/reason and source plan/map/item reference. `aliases` maps
  each contributing plan's reference to its canonical occurrence-scoped item
  id/revision; it is provenance for shared items, not a new caller-id allocator
  or text-based deduplication. History retains full map definitions/bindings
  and exposes current/superseded status through the retained supersession
  relation. Coverage lists missing-item and missing-check truths and distinct
  associated check ids, without implementing a second-check refusal. Projection
  entries identify plan/current revision, observed byte digest or absence and
  installed/missing/drifted state. A mapless current plan appears with an absent
  map binding, not a contribution silently borrowed from history.
- Digest recipe: SHA-256, lowercase hexadecimal, over UTF-8 compact canonical
  JSON containing the view's `schema`, `phase`, `occurrence`, `truths`,
  `contributions`, `items`, `associations`, `aliases`, `history`, `coverage`,
  `readiness` and `projections`. Exclude the digest itself and transient
  transport/request identifiers for READ calls, clocks, absolute temp-root
  paths and explanatory prose. Publication request ids are retained authority
  and stay included. Sort object keys recursively by their UTF-8 spelling;
  sort top-level set arrays by their full stable identity (numeric plan first
  where applicable, then map/item/truth id/version and origin), preserving
  authored order inside each spec. Document tie-breaking explicitly in the
  compiled source. Changed projection bytes change the digest even when saved
  evidence does not. `coherence` is `consistent` only after stable before/after
  observations with no outstanding intent; otherwise return a typed changed-
  input/inconsistent answer naming the input, without a usable coherent-view
  digest. Do not claim filesystem-wide atomic reads or add reader ownership.
- C7's expected input is a handwritten object built from the known submission,
  native truth sentences/versions and approved publication identities/revisions,
  with handwritten expected rendered document bytes used to independently
  check those content revisions. Use an independent test-side canonical-byte
  construction and SHA-256 on that expected input, not the production digest
  assembler and not a clone of the response. Pin at least one complete expected
  canonical input byte string and its literal hash after fixture values are
  fixed, so sorting or a missing input is falsifiable. No absolute fixture path
  belongs in that object. The read-race case uses actual external file writes,
  accepts only a coherent old/new result or explicit inconsistency, and uses
  bounded attempts; it cannot depend on winning a particular scheduler race.
  C7's separate actual-file presence sentinel deterministically exercises the
  outstanding-intent response, not transaction retention or recovery. Its
  read-only exception overrides journal-absence/Store reopen: inspect saved
  bytes, require no usable coherent-view digest, and preserve every input byte.
- Immutability does not require changing a historical payload to add a flag.
  Retain payloads and receipt results byte-for-byte; a separate append-only
  supersession relation plus current reference makes their superseded status
  durable/readable. Event identity uses the occurrence/request receipt/plan
  binding, so R1 -> R2 -> identical R1 bytes never erases either earlier event.
  Repeated identical definitions share an item revision; changing the spec
  preserves the id and creates another item revision. New approved maps must
  explicitly resubmit all associations for their own contribution.
- The exact-snapshot validation is existing code to extend through its plan
  algebra, not an invitation to introduce a new transaction engine.
  `plan::persistence::validate_publication` compares the complete recomputed
  snapshot, including the new namespace; `Writer::execute_store` and
  `Intent::validate` already invoke it. Existing generation/integrity and old-file
  preconditions settle competing writes. No native truth version greater than
  1 can currently be authored; phase 26 owns that lifecycle. Do not simulate a
  future public revision in these checks.
- The existing plan/model/service, context, writer/transaction/filesystem,
  server, main instruction entrypoint, compiled/rendered cad-plan instructions
  and cited test helpers were read against `7d5ccc4f`. New map files are the
  explicitly leased additions from these plans. No library-specific API or
  dependency change is required; use the repository's established patterns.
  The routing-evidence namespace is unrelated and remains untouched.
- One check per truth remains seven checks total. Task 2 extends C6's cases;
  it is not another check or acceptance criterion. Record each newly delivered
  behavior failing before code and passing afterward. Task Verify stays narrow;
  the executor runs the full suite once at plan close, outside task Verify.
  Clippy, if required then, is `cargo clippy --workspace --all-targets -- -D warnings`
  with no stdin. Every fixture git call sets `-c commit.gpgsign=false` and its
  own user.name/user.email as in phase27_plan.rs after `1372ed11`. No dependency
  update is planned. The planner ran no builds/tests/clippy and made no commit.
  Host conduct and model map quality remain knowingly untested; O1 is pending.
