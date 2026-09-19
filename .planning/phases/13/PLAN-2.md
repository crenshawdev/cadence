---
phase: 13
plan: 2
requirements: [T2, T3]
files:
  - crates/cadence/src/verification/mod.rs
  - crates/cadence/src/verification/model.rs
  - crates/cadence/src/verification/instructions.rs
  - crates/cadence/src/verification/inputs.rs
  - crates/cadence/src/verification/persistence.rs
  - crates/cadence/src/verification/verdicts.rs
  - crates/cadence/src/verification/runner.rs
  - crates/cadence/src/verification_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/phase13_verification.rs
  - crates/cadence/tests/support/phase13.rs
  - skills/cad-verifier-contract/SKILL.md
  - skills/cad-verify/SKILL.md
  - crates/cadence/src/verification/status.rs
  - crates/cadence/src/verification/render.rs
execution:
  schema: 1
  suite: "cargo test --workspace"
  tasks:
    - id: P13-2-T1
      verify:
        - "cargo test -p cadence --test phase13_verification phase13_mismatched_verdict_patch_is_refused -- --exact"
    - id: P13-2-T2
      verify:
        - "cargo test -p cadence --test phase13_verification phase13_report_derives_truth_status_from_every_item -- --exact"
---

# Phase 13: Verification and audit - Plan 2

## Goal

A verifier can persist only one complete patch matching its retained attempt, and the owner can
distinguish each truth's current derived result from immutable historical judgments.

## Must be true when done

- T2. When a verifier submits a patch that does not match its dispatched evidence, the caller is refused the patch with the mismatched item or input identified.
- T3. When a completed verification is read, the owner sees each truth's status derived from all of its current evidence verdicts.

## Context

D-123/D-124 bind atomic patch membership, immutable claims and current material; D-125 requires PLAN-1's independent receipts.
Use a separate verification namespace, never routing evidence or mutable ApprovedContext truth statuses.
`map_history::definition` omits associations, so item revision cannot replace map digest and contributing content revisions.
PLAN-1 must be complete first; waivers, human ownership and acceptance completion are extended in PLAN-3.

## Evidence map

All checks in this plan use the common setup approved in CONTEXT: spawn
`env!("CARGO_BIN_EXE_cadence") serve --project-root <fresh disposable project>`,
initialize, then call `cadence_query` and `cadence_apply` through
newline-delimited JSON-RPC on stdio. Files, the store queue and journal, Git
commits and child check processes stay real. Only the clock and the caller's
inputs may be controlled. No mock store, fake process result, direct reducer
call, model reply or production renderer supplies an expected value.
Handwritten patches test caller authority, not judgment quality. Take identity
values from acknowledged public records, compare reopened bytes, and handwrite
expected sets, statuses, messages and rows. Shut down, reap and reopen wherever
durability is asserted.

Completed-execution fixtures author native context with exact approval, publish
plans with attached typed maps through preview and approval, admit allocations,
authorize and execute tiny committed red then green checks, obtain exact owner
Inspection approvals, close tasks, and settle required suite and risk work.
Never preseed approvals, admissions, execution or verdict records. Every accepted
check verdict requires its own independent public verification-run receipt.
Fixture commands never run this repository's suite. Follow the real fixture
pattern in `crates/cadence/tests/phase12_execution.rs`; new shared support is
`crates/cadence/tests/support/phase13.rs`. All fixture Git calls, including reads,
supply `-c commit.gpgsign=false -c user.name=Cadence-Phase13
-c user.email=phase13@example.invalid`; explicit signing for required completion
commits uses the fixture's own key and `-S`. Supply private global config and
signing inputs to Git and the server, and null stdin to child commands.

Never use the live rewrite as a fixture, either protected phase-27 path or lock,
or the phase-12 pre-29 fixture, its bound root or lock. No check reads or writes
the owner's real Claude settings or hook directory. This phase's map has no
observation. Supplemental artifact regressions below are execution validation,
not additional truth checks or evidence-map check items.

### T2

- **P13-T2-C — check.** File `crates/cadence/tests/phase13_verification.rs`,
  function `phase13_mismatched_verdict_patch_is_refused`.
  Item reason: Accepting a mismatched or incomplete patch would break T2's located refusal and preserve the wrong evidence as effective acceptance.
  Association reason (T2, current approved truth version): Accepting a mismatched or incomplete patch would break T2's located refusal and preserve the wrong evidence as effective acceptance.
  Setup: a real T1-style attempt and independent verification-run receipts;
  one complete handwritten valid patch plus variants with unknown, missing or
  duplicate canonical items, wrong item revision, stale map digest, wrong
  truth/content version, foreign occurrence/source, and forbidden phase-pass,
  truth-status and write-file payloads. Make actual source staleness through a
  real commit and actual union staleness through an approved additional native
  publication; no invented truth-revision operation or direct store edit.
  Call `cadence_apply {operation:"verification-submit",patch:...}` for every
  variant and the valid control, exact replay and conflicting request-id reuse;
  restart and reopen. Expected: each refusal names its rule and mismatched
  item/input, including requested/current identities where applicable.
  Effective acceptance, completion and UAT bytes remain identical on refusal;
  separately retained refusal/claim history may append. The valid complete
  patch persists atomically, exact replay returns one acknowledgment, and
  changed-payload reuse refuses. No findings file appears. Boundary and allowed
  fakes are exactly the common setup; assertions inspect real public answers
  and reopened storage, never a reducer or model oracle.
  Command:
  `cargo test -p cadence --test phase13_verification phase13_mismatched_verdict_patch_is_refused -- --exact`.
- **P13-T2-A1 — artifact.** `crates/cadence/src/verification/model.rs`,
  `verification/persistence.rs`, new `verification/verdicts.rs`, and explicit
  integration in `store/writer.rs` and `store/transaction.rs`.
  Substance: versioned complete patches, bounded original claims, immutable
  application outcomes, item verdict history and exact replay identity.
  Item reason: a refusal must be inspectable without becoming effective evidence,
  and an accepted patch must not lose the particular material it judged.
  Association reason (T2, current approved truth version): T2's refusal and replay depend on retaining mismatched claims separately from applicable verdicts.

- **P13-T2-A2 — artifact.** `verification/inputs.rs`,
  `verification/runner.rs` and `verification_service.rs`.
  Substance: commit-time full-basis comparison and located refusals, including
  current independent-run identity and real material reobservation.
  Item reason: a well-shaped patch is insufficient when its dispatched input or
  current source has changed.
  Association reason (T2, current approved truth version): T2 must locate a mismatch against current authority and independent-run material, not only validate patch shape.

### T3

- **P13-T3-C — check.** File `crates/cadence/tests/phase13_verification.rs`,
  function `phase13_report_derives_truth_status_from_every_item`.
  Item reason: Ignoring any associated item or its applicability would change the owner-visible derived truth status promised by T3.
  Association reason (T3, current approved truth version): Ignoring any associated item or its applicability would change the owner-visible derived truth status promised by T3.
  Setup: native truths with one check each plus artifacts and links. Submit
  complete patches for all accepted, rejected artifact, rejected shared link,
  and explicit not_seen cases. Use a separate generic fixture phase with a
  supplementary observation solely to exercise the generic cap; it is not
  an observation in phase 13's map. Call verification-run,
  verification-submit and verification-read before and after restart; read
  before completed verification and after real repair/revision followed by a
  fresh attempt, retaining the rejected original attempt.
  Expected: all accepted with no observation is `met`; all accepted with an
  observation is `concerns`; any `rejected` or `not_seen`, including an
  observation verdict, is `unmet`; no complete applicable verification is
  `pending`. A passing check cannot cover a rejected artifact or link.
  Every explicit association of a shared item receives that item's result.
  History preserves observed reasons and old map/content/source identity;
  current readback names the full verified-at basis. Neither CI nor a
  model-authored aggregate verdict enters reduction. Expected strings and
  rows are handwritten. All boundaries and allowed fakes are the common setup.
  Command:
  `cargo test -p cadence --test phase13_verification phase13_report_derives_truth_status_from_every_item -- --exact`.
- **P13-T3-A1 — artifact.** New
  `crates/cadence/src/verification/status.rs`,
  `verification/render.rs` and readback integration in
  `verification_service.rs`.
  Substance: current/historical per-item and per-truth reports, applicability,
  association reasons and complete verified-at identities. Item reason: the owner
  must see the status derived from all items without a verifier phase verdict
  or a modified approved context record.
  Association reason (T3, current approved truth version): T3's owner-visible result is the reduction and rendering of every currently associated item with its history.


Neither T2 nor T3 names a value handed from one component to another; no link
item is added for an internal struct, validator call or rendering step.

## Tasks

### Task 1: Refuse a verdict patch that differs from its dispatched evidence

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/instructions.rs` , `crates/cadence/src/verification/inputs.rs` ,
  `crates/cadence/src/verification/persistence.rs` , `crates/cadence/src/verification/verdicts.rs` ,
  `crates/cadence/src/verification/runner.rs` , `crates/cadence/src/verification_service.rs` ,
  `crates/cadence/src/server.rs` , `crates/cadence/src/recall/mod.rs` ,
  `crates/cadence/src/store/writer.rs` , `crates/cadence/src/store/transaction.rs` ,
  `crates/cadence/tests/phase13_verification.rs` , `crates/cadence/tests/support/phase13.rs` ,
  `skills/cad-verifier-contract/SKILL.md` , `skills/cad-verify/SKILL.md` .
- **Action:** Deliver P13-T2-C, P13-T2-A1 and P13-T2-A2. Write the owner-approved single test red
  first with `test(13): phase13_mismatched_verdict_patch_is_refused red P13-2-T1` ; retain all
  variants in that function. Implement verification-submit as a strict, complete atomic
  phase-attempt patch. Determine the expected canonical item set from the retained coherent union,
  not from patch rows or Markdown; repeated aliases remain one item. Explicit not_seen is a verdict,
  not an omitted row. Bind each row to item revision and observed evidence, each check acceptance to
  its current independent verification run, and the whole patch to the full contributing publication
  vector, exact map digest, approved truth versions, occurrence/root/attempt and source
  HEAD/tree/index/material. Verify execution evidence and owner statements remain inspectable;
  executor runs cannot stand in for independent runs. Reject forbidden aggregate/document-writing
  fields and every mismatch with a bounded rule and located item/input plus requested/current basis.
  Retain bounded original claims and application outcomes separately from effective item verdicts;
  distinguish transport-invalid payloads from domain-refused claims. Writer CompareTransact
  validation must recompute against the committing snapshot and reobserve source/files before
  confirmation, preventing source or publication races after admission. Protect the verification
  namespace in every applicable intent arm, preserve historical intent semantics, and make recovery
  revalidate exact participant identities. Exact replay returns the original acknowledgment/history
  without reapplying current verdicts; changed payload under that id refuses. One valid complete
  patch is persisted once; partial application, findings files, direct UAT writes and manufactured
  truth revisions are impossible through this operation. Complete green with
  `feat(13): admit only matching atomic verdict patches green P13-2-T1` . Regenerate
  `skills/cad-verifier-contract/SKILL.md` and `skills/cad-verify/SKILL.md` from the two
  verifier-instructions modes in this same task whenever its compiled schema or rendered authority
  changes. Both outputs are in this task's lease. Keep actual dispatch on that same compiled
  authority and include changed generated bytes in this task's green work before this plan's close
  suite; never defer them to a later plan or weaken byte-equality assertions.
- **Verify:** `cargo test -p cadence --test phase13_verification phase13_mismatched_verdict_patch_is_refused -- --exact`
  exactly one function passes all handwritten invalid variants and the valid/replay controls, with
  rule/item/input locations and reopened effective acceptance/completion/UAT unchanged for refusals.

### Task 2: Derive current truth status from the complete item record

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/inputs.rs` , `crates/cadence/src/verification/persistence.rs` ,
  `crates/cadence/src/verification/status.rs` , `crates/cadence/src/verification/render.rs` ,
  `crates/cadence/src/verification_service.rs` , `crates/cadence/src/server.rs` ,
  `crates/cadence/tests/phase13_verification.rs` , `crates/cadence/tests/support/phase13.rs` .
- **Action:** Deliver P13-T3-C and P13-T3-A1. Write the single owner-approved function red with
  `test(13): phase13_report_derives_truth_status_from_every_item red P13-2-T2` . Implement
  verification-read over current complete applicable item verdicts, retaining full old attempts,
  observations, reasons, supersession and identities for history. Status derives from all canonical
  items associated with the exact truth/version: complete all-accepted/no-observation met; complete
  all-accepted/observation concerns; any rejected or not_seen unmet, before considering the
  observation cap; incomplete or no current applicable completion pending. Explicit not_seen is
  complete but negative, not a missing patch. Shared item verdicts affect every named association
  and no unnamed one. Distinguish patch application acceptance from evidence acceptance. Show the
  full verified-at vector/digest/HEAD/tree/index/material and why an old attempt is historical; any
  actual source or map revision invalidates current applicability until a fresh applicable attempt.
  Readback does not mutate approvals, infer status from context Status::Pending seeds, or turn
  execution completion into phase acceptance. Keep the native report as binary-rendered response,
  avoiding a second handwritten report authority; PLAN-3 will integrate native lifecycle completion
  and optional UAT projection. Retain legacy classification explicitly, not as native evidence. No
  CI/suite aggregation. Finish
  `feat(13): derive truth status from all current verdicts green P13-2-T2` .
- **Verify:** `cargo test -p cadence --test phase13_verification phase13_report_derives_truth_status_from_every_item -- --exact`
  exactly one function produces handwritten pending/met/concerns/unmet rows, shared-item effects and
  historical/current identities, including the generic observation cap and restart.

## Notes

Execute the plans sequentially: PLAN-1, PLAN-2, PLAN-3, PLAN-4. Shared paths are
intentional sequential leases, as authorized by the dispatch; do not run these
plans concurrently. New paths below are creation locations, not assertions
that modules or operations already exist. Test function names not yet in the
tree are explicit test creation specifications. Implement new Rust names from
the actual code rather than treating this plan as an invented API signature.

The executor records real red and green commits for every task delivering a
truth check, with the subjects stated in that task. Inspect why red failed:
missing production behavior may be a legitimate compile-red; missing tools or
broken fixture setup is not evidence. No fixture fabricates model behavior or
uses a production renderer as its expected-value generator. The orchestrator
owns commits; this planning pass neither commits nor runs builds or tests.

The task Verify commands are deliberately narrow. The frontmatter suite is the
executor's one plan-close regression run, never a verifier command or acceptance
item. At close run `cargo clippy --workspace --all-targets -- -D warnings` with
null stdin as the separate project quality check. CI and either quality command
cannot set acceptance status. Existing 3.x workflows are frozen reference
material; native generated front doors must not route to their findings-file,
SUMMARY-criteria, coverage-generation or document-writing authorities.

The immutable-context constraint is substantive: context/persistence.rs's
approved/validate_publication and execution/admission.rs's validate compare the
original approved record. This plan adds an overlay; it does not write those
truth seeds or invent context version updates. An unchanged item revision alone
never makes a verdict current, because associations and publication changes
belong to the full map/basis.

This plan intentionally does not complete a phase when all item results pass.
PLAN-3 supplies the owner-waiver, human-result and completion authority that
must also be satisfied. Refusal history may append; comparing the entire store
byte-for-byte on a retained domain refusal would be the wrong oracle.

Renderer/lease rule: choose same-task regeneration, not deferred refresh.
Each task here that can change compiled verifier schema or instruction bytes
leases both generated verifier skills and regenerates affected bytes before
its green completion and this plan's required close suite. Byte equality is
preserved; no later close task repairs renderer drift outside this plan's lease.
