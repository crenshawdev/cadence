---
phase: 13
plan: 3
requirements: [T4, T5]
files:
  - crates/cadence/src/verification/mod.rs
  - crates/cadence/src/verification/model.rs
  - crates/cadence/src/verification/waivers.rs
  - crates/cadence/src/verification/persistence.rs
  - crates/cadence/src/verification/status.rs
  - crates/cadence/src/verification/render.rs
  - crates/cadence/src/verification_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/phase13_verification.rs
  - crates/cadence/tests/support/phase13.rs
  - skills/cad-verifier-contract/SKILL.md
  - skills/cad-verify/SKILL.md
  - crates/cadence/src/verification/human.rs
  - crates/cadence/src/verification/projections.rs
  - crates/cadence/src/store/filesystem.rs
  - crates/cadence/src/guard/mod.rs
  - crates/cadence/tests/phase13_support.rs
  - crates/cadence/src/plan_service.rs
  - crates/cadence/src/plan/persistence.rs
  - crates/cadence/src/verification/inputs.rs
  - crates/cadence/src/verification/completion.rs
  - crates/cadence/src/derivation/mod.rs
  - crates/cadence/src/derivation/model.rs
  - crates/cadence/src/derivation/capture.rs
  - crates/cadence/src/derivation/query.rs
  - crates/cadence/src/derivation/consistency.rs
  - crates/cadence/src/derivation/memo.rs
  - crates/cadence/src/derivation_service.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/next_action_service.rs
execution:
  schema: 1
  suite: "cargo test --workspace"
  tasks:
    - id: P13-3-T1
      verify:
        - "cargo test -p cadence --test phase13_verification phase13_owner_waiver_is_distinct_from_met -- --exact"
    - id: P13-3-T2
      verify:
        - "cargo test -p cadence --test phase13_support phase13_human_results_preserve_first_pass -- --exact"
    - id: P13-3-T3
      verify:
        - "cargo test -p cadence --test phase13_support phase13_publication_seeds_only_missing_trace_rows -- --exact"
    - id: P13-3-T4
      verify:
        - "cargo test -p cadence --test phase13_support phase13_completion_projection_transaction_recovers -- --exact"
    - id: P13-3-T5
      verify:
        - "cargo test -p cadence --test phase13_verification phase13_incomplete_verification_cannot_complete_phase -- --exact"
---

# Phase 13: Verification and audit - Plan 3

## Goal

The owner sees waivers separately and cannot complete native acceptance while execution, current
evidence or required human results remain unfinished. Completion authority and its projections agree
with lifecycle readback without changing approved context.

## Must be true when done

- T4. When the owner waives a truth with a reason, name and date, the owner sees that truth reported as waived beside the met truths.
- T5. When completion is requested with unfinished acceptance work, the owner is refused phase completion with the unfinished work identified.

## Context

D-126/D-127 distinguish owner waiver approval and human UAT from verifier claims; D-131 alone advances native acceptance completion.
Native lifecycle overlays immutable approved context and extends memo identity; historical SUMMARY/UAT semantics stay classified.
Execute after PLAN-2; the separate completion transaction and lifecycle tasks remain intact.
PLAN-4 follows for review, audit and mandatory close; shared service/test/output leases require sequential execution.

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

### T4
- **P13-T4-C — check.** File `crates/cadence/tests/phase13_verification.rs`,
  function `phase13_owner_waiver_is_distinct_from_met`.
  Item reason: Treating a prepared or stale waiver as owner approval, or counting waived as met, would break T4's distinct attributed result.
  Association reason (T4, current approved truth version): Treating a prepared or stale waiver as owner approval, or counting waived as met, would break T4's distinct attributed result.
  Setup: one met and one unmet native truth, retained rejection, independent
  verification runs for accepted checks and an exact owner waiver bound to the
  truth/version and reviewed evidence. Construct absent, false or mismatched
  approval, missing reason/name/date, stale-version and verifier-authored
  variants. Call truth-waive, verification-read, restart and replay.
  Expected: only exact owner approval makes the waiver effective. Person, reason
  and date appear beside underlying unmet/rejected history; waived does not
  increase the met count. Invalid requests do not waive; replay stores one
  record; later verifier patches cannot erase or manufacture waivers.
  Applicability follows the reviewed basis, with explicit owner reaffirmation
  after changes and owner-only supersession/revocation as D-126 requires.
  Boundaries and allowed fakes are the common real-stdio setup.
  Command:
  `cargo test -p cadence --test phase13_verification phase13_owner_waiver_is_distinct_from_met -- --exact`.
- **P13-T4-A1 — artifact.** New `verification/waivers.rs` under
  `crates/cadence/src/`, with model/persistence/status/render integration.
  Substance: immutable exact-approved attributed waiver events and applicability,
  preserving rejected verdicts and displaying waived separately from met.
  Item reason: an owner exception must not be a model-authored pass or routing Override.
  Association reason (T4, current approved truth version): T4 requires an owner-attributed waiver that remains distinct from met and preserves underlying rejection.

### T5

- **P13-T5-C — check.** File `crates/cadence/tests/phase13_verification.rs`,
  function `phase13_incomplete_verification_cannot_complete_phase`.
  Item reason: Allowing publication, execution, stale evidence or unresolved human work to complete acceptance would break T5's refusal.
  Association reason (T5, current approved truth version): Allowing publication, execution, stale evidence or unresolved human work to complete acceptance would break T5's refusal.
  Setup: actual publication seeds a missing requirement trace row Pending.
  Complete execution without verdicts; obtain complete current verdicts with
  one unmet item; then obtain all accepted using real independent runs.
  Include caller-owned historical human UAT failure, original first-pass value
  and attributed history, plus a human-pass control. Native human input uses
  the public human-result operation, never direct reducer calls or verifier
  write payloads. Call verification-complete at each stage, interleaving plan
  read/publication and execute-next; repeat, read and restart. Resolve the human
  result through its authorized path before the fully applicable positive case.
  Expected: publication, execution close, partial/stale verification and
  human-conflicting verifier submissions cannot complete acceptance. Refusals
  identify unfinished evidence/human work. Human bytes and original first-pass
  history remain unchanged until the human update; all accepted evidence
  cannot overwrite fail. Only full completion updates authority and required
  ROADMAP/requirement projections once. Approved context is unchanged; a query
  cannot repair completion. Phase-14 progress and phase-15 undo later extend
  this same episode through their actual operations, neither fabricated here.
  Boundaries and allowed fakes are the common setup; current/historical
  expectations are handwritten and reopened after restart.
  Command:
  `cargo test -p cadence --test phase13_verification phase13_incomplete_verification_cannot_complete_phase -- --exact`.
- **P13-T5-A1 — artifact.** New `verification/human.rs` and
  `verification/projections.rs`, with explicitly owned UAT rendering and
  writer/filesystem/guard integration. Substance: optional attributed native
  human-result records, separate retained imported human originals, immutable
  replies, first-pass and result history. Item reason: verification cannot erase a
  human failure or reinterpret a blank response as approval.
  Association reason (T5, current approved truth version): T5 cannot determine unfinished human work without preserving its attributed results and original history.

- **P13-T5-A2 — artifact.** New `verification/completion.rs`, native basis in
  `derivation/`, lifecycle services and versioned writer/transaction integration.
  Substance: applicable completion authority and exact ROADMAP/REQUIREMENTS
  projection changes in one confirmed transaction, native memo invalidation
  and publication's missing-row-only Pending seed. Item reason: an executed plan,
  copied UAT pass or stale cached lifecycle must not complete native acceptance.
  Association reason (T5, current approved truth version): T5 requires applicable completion authority and its projections to agree with native lifecycle reads.


T4 and T5 name outcomes of owner operations, not a named value handed between
two things; no internal link is added. There is no observation item.

## Tasks

### Task 1: Record owner waivers beside derived results

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/waivers.rs` , `crates/cadence/src/verification/persistence.rs` ,
  `crates/cadence/src/verification/status.rs` , `crates/cadence/src/verification/render.rs` ,
  `crates/cadence/src/verification_service.rs` , `crates/cadence/src/server.rs` ,
  `crates/cadence/src/store/writer.rs` , `crates/cadence/src/store/transaction.rs` ,
  `crates/cadence/tests/phase13_verification.rs` , `crates/cadence/tests/support/phase13.rs` ,
  `skills/cad-verifier-contract/SKILL.md` , `skills/cad-verify/SKILL.md` .
- **Action:** Deliver P13-T4-C and P13-T4-A1. Write the one approved check red,
  `test(13): phase13_owner_waiver_is_distinct_from_met red P13-3-T1` . Implement truth-waive as an
  owner-only exact-approved typed event carrying reason, name/date, truth/version, root/occurrence
  and the reviewed evidence basis. Name/time are attributed claims, not authentication or observed
  time; never accept a verifier's role claim as owner approval. Reject absent/false/mismatched
  approval and stale basis without changing effective waiver. Keep immutable history and exact-id
  replay. Make reaffirmation after a changed basis explicit; supersession and revocation are
  separate owner-approved events, not field edits. Render applicable waived truths beside met truths
  with underlying derived status, rejection, person/reason/date and basis visible. Waivers do not
  increase met count, delete rejected rows or let a verifier create/revoke them; multiple waivers
  cue “revisit the plan.” Protect this event namespace and applicability at the committing snapshot
  using the same verified input boundaries as verdicts. Complete green
  `feat(13): retain owner-approved truth waivers green P13-3-T1` . Regenerate
  `skills/cad-verifier-contract/SKILL.md` and `skills/cad-verify/SKILL.md` from the two
  verifier-instructions modes in this same task whenever its compiled schema or rendered authority
  changes. Both outputs are in this task's lease. Keep actual dispatch on that same compiled
  authority and include changed generated bytes in this task's green work before this plan's close
  suite; never defer them to a later plan or weaken byte-equality assertions.
- **Verify:** `cargo test -p cadence --test phase13_verification phase13_owner_waiver_is_distinct_from_met -- --exact`
  the single T4 function proves exact approval and restart/replay, separate waived/met counts,
  retained rejection and no effective waiver from invalid or verifier inputs.

### Task 2: Preserve human UAT through attributed records

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/human.rs` , `crates/cadence/src/verification/projections.rs` ,
  `crates/cadence/src/verification/persistence.rs` , `crates/cadence/src/verification/render.rs` ,
  `crates/cadence/src/verification_service.rs` , `crates/cadence/src/server.rs` ,
  `crates/cadence/src/store/writer.rs` , `crates/cadence/src/store/transaction.rs` ,
  `crates/cadence/src/store/filesystem.rs` , `crates/cadence/src/guard/mod.rs` (protected_target),
  `crates/cadence/tests/phase13_support.rs` , `crates/cadence/tests/support/phase13.rs` ,
  `skills/cad-verifier-contract/SKILL.md` , `skills/cad-verify/SKILL.md` .
- **Action:** Deliver P13-T5-A1, D-127. Add the planned public operation verification-human-result
  for attributed human input, with exact phase/root/result provenance, immutable original reply,
  first-pass and subsequent result history. Optional UAT is only required where an actual required
  human item exists; do not manufacture cases from SUMMARY. Preserve caller-owned historical UAT
  originals separately from native records; a human update is the only operation that may resolve a
  human result. Blank replies do not pass, skip is not waiver, and verifier submits cannot change
  human records. Render native UAT.md from those records while preserving the original imported
  human material and its attribution/history; do not silently adopt arbitrary historical prose as
  native approval. Bind UAT installation to the explicitly owned phase path and observed preimage,
  use exact versioned participants and recovery validation, and extend guard::protected_target for
  known native-owned output rather than claim arbitrary-shell protection. A report query performs no
  migration or repair. Establish the support regression `phase13_human_results_preserve_first_pass`
  using real stdio and reopened bytes: human fail, blank reply, explicit later human pass, retained
  original first-pass/replies/history and failed verifier overwrite. This validates the human-record
  artifact, not a second completion check. Regenerate `skills/cad-verifier-contract/SKILL.md` and
  `skills/cad-verify/SKILL.md` from the two verifier-instructions modes in this same task whenever
  its compiled schema or rendered authority changes. Both outputs are in this task's lease. Keep
  actual dispatch on that same compiled authority and include changed generated bytes in this task's
  green work before this plan's close suite; never defer them to a later plan or weaken
  byte-equality assertions.
- **Verify:** `cargo test -p cadence --test phase13_support phase13_human_results_preserve_first_pass -- --exact`
  the named real-binary artifact regression preserves human ownership and first-pass/history through
  authorized updates, blank input, invalid overwrite and restart.

### Task 3: Seed only absent requirement trace rows at publication

- **Files:** `crates/cadence/src/verification/mod.rs` ,
  `crates/cadence/src/verification/projections.rs` , `crates/cadence/src/plan_service.rs` ,
  `crates/cadence/src/plan/persistence.rs` (require_execution_ready, validate_publication),
  `crates/cadence/src/store/writer.rs` , `crates/cadence/src/store/transaction.rs` ,
  `crates/cadence/src/store/filesystem.rs` , `crates/cadence/tests/phase13_support.rs` ,
  `crates/cadence/tests/support/phase13.rs` .
- **Action:** Deliver P13-T5-A2's publication-seeding portion. At actual new native plan
  publication, append only missing requirement trace rows as Pending, in the same confirmed
  publication transaction. Preserve existing rows, status, ordering and unrelated document bytes;
  publication cannot raise any acceptance status. Retain exact preview/approval identity and
  immutable original publication contributions: add explicit versioned participant semantics for the
  new transition instead of changing the reconstruction expected for old approved records or old
  intents. Observe and revalidate the requirement preimage at commit and confirmation; no
  side-effecting read, fabricated requirement-to-truth edge, active-requirement authoring or general
  roadmap writer. Establish the named artifact regression
  `phase13_publication_seeds_only_missing_trace_rows` through native public preview/approval/submit
  and reopened files, demonstrating a new Pending row, preservation of an existing resolved row,
  exact replay and stale-preimage refusal. This is publication validation for P13-T5-A2; it does not
  add a second T5 acceptance check.
- **Verify:** `cargo test -p cadence --test phase13_support phase13_publication_seeds_only_missing_trace_rows -- --exact`
  the named real-binary artifact regression adds only a missing Pending row, preserves existing
  bytes/statuses and refuses changed projection input without changing exact publication approval or
  historical replay.

### Task 4: Confirm acceptance and its required projections together

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/inputs.rs` , `crates/cadence/src/verification/status.rs` ,
  `crates/cadence/src/verification/completion.rs` , `crates/cadence/src/verification/projections.rs`
  , `crates/cadence/src/verification/persistence.rs` , `crates/cadence/src/verification_service.rs`
  , `crates/cadence/src/server.rs` , `crates/cadence/src/store/writer.rs` ,
  `crates/cadence/src/store/transaction.rs` , `crates/cadence/src/store/filesystem.rs` ,
  `crates/cadence/src/guard/mod.rs` (protected_target), `crates/cadence/tests/phase13_support.rs` ,
  `crates/cadence/tests/support/phase13.rs` , `skills/cad-verifier-contract/SKILL.md` ,
  `skills/cad-verify/SKILL.md` .
- **Action:** Deliver the completion-transaction portion of P13-T5-A2. Add verification-complete
  requiring actual required execution completion, a complete current applicable item patch, every
  truth met or explicitly effectively waived, and every required human result resolved. Concerns
  remains incomplete; label completion with waivers separately without raising met count. Refuse
  with exact unfinished item, input or human result; never use vacuous
  execution::history::phase_complete on an empty native set. Record immutable completion authority
  with the full verdict/waiver/human/execution basis and exact replay. Commit its narrowly required
  ROADMAP phase box and REQUIREMENTS trace-status projections in the same confirmed transaction,
  leaving UAT and ApprovedContext unchanged. This is not a general roadmap/requirement writer.
  Refuse unmatched/ambiguous projection inputs rather than guess rewrites. Extend exact filesystem
  participants, writer namespace ownership, precommit/preconfirmation validation and recovery.
  Account for expected binary-owned projection changes separately from source mutation: preserve
  full observed HEAD/tree and explicit index/material identity, never drop arbitrary dirty paths or
  substitute a scoped hash for the full basis. Installing the transaction's own confirmed required
  projection does not make that transaction stale. Establish artifact regression
  `phase13_completion_projection_transaction_recovers` through real serve/stdio: deliberately stale
  a caller-controlled projection preimage and interrupt/reopen a real operation, checking no
  acknowledged split authority/projection state, unchanged human originals and exact replay. This
  tests transaction ownership/recovery; task 5 delivers the single full T5 owner episode with all
  lifecycle callers. Regenerate `skills/cad-verifier-contract/SKILL.md` and
  `skills/cad-verify/SKILL.md` from the two verifier-instructions modes in this same task whenever
  its compiled schema or rendered authority changes. Both outputs are in this task's lease. Keep
  actual dispatch on that same compiled authority and include changed generated bytes in this task's
  green work before this plan's close suite; never defer them to a later plan or weaken
  byte-equality assertions.
- **Verify:** `cargo test -p cadence --test phase13_support phase13_completion_projection_transaction_recovers -- --exact`
  the named real-binary artifact regression refuses stale participant inputs, preserves human bytes
  and reopens a wholly confirmed or unconfirmed completion transaction, never an acknowledged split
  authority/projection result.

### Task 5: Derive native lifecycle from applicable acceptance completion

- **Files:** `crates/cadence/src/verification/inputs.rs` ,
  `crates/cadence/src/verification/status.rs` , `crates/cadence/src/verification/completion.rs` ,
  `crates/cadence/src/verification_service.rs` , `crates/cadence/src/derivation/mod.rs` (derive),
  `crates/cadence/src/derivation/model.rs` , `crates/cadence/src/derivation/capture.rs` ,
  `crates/cadence/src/derivation/query.rs` , `crates/cadence/src/derivation/consistency.rs` ,
  `crates/cadence/src/derivation/memo.rs` (input_key, check_memo),
  `crates/cadence/src/derivation_service.rs` , `crates/cadence/src/execution_service.rs`
  (derivation_refusal, checked_execution), `crates/cadence/src/next_action_service.rs` ,
  `crates/cadence/tests/phase13_verification.rs` , `crates/cadence/tests/support/phase13.rs` ,
  `skills/cad-verifier-contract/SKILL.md` , `skills/cad-verify/SKILL.md` .
- **Action:** Deliver P13-T5-C and P13-T5-A2's lifecycle-applicability portion. Write the entire
  owner-approved T5 function red first,
  `test(13): phase13_incomplete_verification_cannot_complete_phase red P13-3-T5` ; tasks 3/4's
  support regressions are not substitutes. For native phases replace SUMMARY/UAT-derived completion
  with the acceptance overlay, before lifecycle consistency checks. Update derivation::derive,
  prepare_query/recheck and memo encoding/semantic validity with current native
  content/map/source/verdict/waiver/human/completion inputs. Audit the separate checked_execution
  memo path in execution_service and the independent recapture in next_action_service; changing
  checked_query alone would leave stale authority or permanent mismatch. Input changes invalidate
  completion applicability and memo reuse; preserve history and expose the exact source of
  disagreement. A query never writes completion or repairs its projections. Keep old historical
  SUMMARY/UAT classification explicitly separate so immutable approved Pending seeds still satisfy
  context/persistence::validate_publication and execution/admission::validate. Run the full public
  T5 episode: new Pending publication, execution only, missing/partial/stale verdicts, unmet item,
  human-conflicting all-accepted evidence, authorized human resolution, fully applicable completion,
  interleaved reads/publication/execute-next and repeated restart. Check exact context/UAT
  preservation, located unfinished-work refusals and once-only authority/projection update. Supply
  the applicability seam later progress/undo can consume, without implementing phase-14 progress,
  phase-15 undo or phase-26 correction. Complete green
  `feat(13): derive native lifecycle from current acceptance green P13-3-T5` . Regenerate
  `skills/cad-verifier-contract/SKILL.md` and `skills/cad-verify/SKILL.md` from the two
  verifier-instructions modes in this same task whenever its compiled schema or rendered authority
  changes. Both outputs are in this task's lease. Keep actual dispatch on that same compiled
  authority and include changed generated bytes in this task's green work before this plan's close
  suite; never defer them to a later plan or weaken byte-equality assertions.
- **Verify:** `cargo test -p cadence --test phase13_verification phase13_incomplete_verification_cannot_complete_phase -- --exact`
  one T5 function refuses every unfinished/stale/human-conflicting stage with located work,
  preserves human/approved bytes, and only the applicable resolved control updates completion plus
  required projections once across interleaved reads, execution and restart.

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

PLAN-4 owns the separate review/audit surfaces and mandatory close sequence.
This plan delivers only T4/T5. Its five tasks remain separate because publication,
completion transaction and lifecycle readback have different validation boundaries.

The existing approved context remains byte-identical. UAT writes belong only to
the attributed human-result path; completion writes only its required projections.
Future progress/undo consumes applicability invalidation, not a new operation here.

Renderer/lease rule: choose same-task regeneration, not deferred refresh.
Each task here that can change compiled verifier schema or instruction bytes
leases both generated verifier skills and regenerates affected bytes before
its green completion and this plan's required close suite. Byte equality is
preserved; no later close task repairs renderer drift outside this plan's lease.
