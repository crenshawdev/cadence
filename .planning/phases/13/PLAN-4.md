---
phase: 13
plan: 4
requirements: [T6, T7]
files:
  - crates/cadence/src/review/mod.rs
  - crates/cadence/src/review/selection.rs
  - crates/cadence/src/review/instructions.rs
  - crates/cadence/src/review/invoking.rs
  - crates/cadence/src/review/provider/payload.rs
  - crates/cadence/src/review_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/main.rs
  - skills/cad-review/SKILL.md
  - skills/cad-decision-review/SKILL.md
  - skills/cad-minimalism-review/SKILL.md
  - skills/cad-plan-review/SKILL.md
  - crates/cadence/tests/phase13_verification.rs
  - crates/cadence/tests/support/phase13.rs
  - crates/cadence/src/verification/mod.rs
  - crates/cadence/src/verification/model.rs
  - crates/cadence/src/verification/audit.rs
  - crates/cadence/src/verification/instructions.rs
  - crates/cadence/src/verification/render.rs
  - crates/cadence/src/verification_service.rs
  - skills/cad-audit/SKILL.md
  - skills/cad-coverage/SKILL.md
  - skills/cad-verifier-contract/SKILL.md
  - skills/cad-verify/SKILL.md
  - .planning/phases/13/close/readiness.md
  - .planning/phases/13/reports/adoption-readiness.md
  - .planning/phases/13/reports/hook-retirement.md
  - crates/cadence/tests/phase13_close.rs
execution:
  schema: 1
  suite: "cargo test --workspace"
  tasks:
    - id: P13-4-T1
      verify:
        - "cargo test -p cadence --test phase13_verification phase13_review_surface_selects_target_and_intent -- --exact"
    - id: P13-4-T2
      verify:
        - "cargo test -p cadence --test phase13_verification phase13_audit_reports_broken_verification_traces -- --exact"
    - id: P13-4-T3
      verify:
        - "cargo test -p cadence --test phase13_close phase13_adoption_copy_preserves_history_and_recovers -- --exact"
---

# Phase 13: Verification and audit - Plan 4

## Goal

The owner receives the explicitly selected review intent and a read-only audit of broken
requirement-to-evidence traces. Complete mandatory readiness and installed-close work with evidence
attributed to its actual producer, leaving the adoption decision for phase 14.

## Must be true when done

- T6. When the owner requests a review of a selected target, the reviewer gets that target with the corresponding decision, minimalism or plan instructions.
- T7. When the owner audits verification coverage, the owner gets the broken requirement-to-evidence traces with their current verdicts.

## Context

D-128/D-132 make coverage a read-only phase-scoped join; D-133 selects targets through the existing review subsystem.
D-130/D-134 require attributed readiness and inspected installed close, without self-hosting or phase-18 acceptance.
Execute sequentially after PLAN-3; overlapping service, test and generated-output paths are declared in both plans.
review/selection.rs already implements retained delivery selection; add target selection without replacing that contract.

## Mandatory close work

**P13-CLOSE-READINESS — mandatory close work, not acceptance evidence.**
Task 3's executor creates `.planning/phases/13/close/readiness.md` and the
actual isolated-copy/native-demonstration rehearsal sections of
`.planning/phases/13/reports/adoption-readiness.md`. It preserves distinct
rewrite, disposable-native and copied-history identities.
The orchestrator supplies the rewrite checks' observed commits and independent
rerun outputs, performs final installation/installed-state inspection and
completes the readiness report and
`.planning/phases/13/reports/hook-retirement.md` from P13-CLOSE-HOOK.
The hook procedure remains the close-only, unshipped
`.planning/phases/13/close/retire-rules-gate.py` from PLAN-1.
The verifier inspects actual artifacts/records without authoring these reports
or accepting prospective success prose. Final close is unfinished until the
orchestrator records the actual installed outcomes. These procedures/reports
are outside T1/T7's evidence maps and create no observation item.

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

### T6

- **P13-T6-C — check.** File `crates/cadence/tests/phase13_verification.rs`,
  function `phase13_review_surface_selects_target_and_intent`.
  Item reason: Broadening the selected target or losing its kind-specific intent in the real handoff would break the review delivery promised by T6.
  Association reason (T6, current approved truth version): Broadening the selected target or losing its kind-specific intent in the real handoff would break the review delivery promised by T6.
  Setup: real decision document, source file/directory and two native plan
  slices, with existing local delivery configured and no external provider.
  Supply explicit kind/target and all three alias names.
  Call merged review-select and its existing review-admit/review-next handoff;
  read retained material for every kind and alias, replay, and try missing or
  ambiguous selections. Expected: actual dispatch includes exact requested
  material and handwritten intent; aliases resolve the same canonical kind and
  target. Decision refutation, minimalism deletion ranking, and plan goal and
  locked-decision instructions appear. Minimalism retains the base reviewer
  without an invented provider/gate; plan retains its configured trigger/gate.
  Invalid targets stop without broadening; target bytes remain unchanged.
  This is delivery, not review/adjudication quality. Provider-fragment parity
  is artifact inspection, not fake provider exchange. All boundaries and
  allowed fakes are the common setup; no reviewer/model stub supplies an oracle.
  Command:
  `cargo test -p cadence --test phase13_verification phase13_review_surface_selects_target_and_intent -- --exact`.
- **P13-T6-A1 — artifact.** EDIT `crates/cadence/src/review/selection.rs`,
  preserving `select_next`, `dispatch_roster` and `delivery_completion`;
  CREATE `crates/cadence/src/review/instructions.rs`. Existing `review/invoking.rs` and
  `review/provider/payload.rs`, plus generated
  `skills/cad-review/SKILL.md` and the three alias skills.
  Substance: explicit-kind selection, common compiled target-specific intent
  used by local and provider prompts, and thin compiled native command surfaces.
  Item reason: selecting a review question must preserve the established trigger,
  roster, delivery, original-return and settlement contracts.
  Association reason (T6, current approved truth version): T6 requires exact target resolution and corresponding compiled intent to reach the existing reviewer handoff.

- **P13-T6-L — link.** `spec.caller: "cadence_query review-select through review-admit/review-next"`;
  `spec.callee: "reviewer dispatch recipient"`;
  `spec.value: "selected target"`. The entire literal `selected target`
  occurs within T6's approved trigger slot; do not replace it with a
  paraphrase or concatenate trigger, observer and outcome slots.
  P13-T6-C traces this target and its corresponding instructions through the
  existing actual review handoff. This adds no check and implies no edits.
  Item reason: broadening or replacing retained target material at the handoff
  would deliver a different review question.
  Association reason (T6, current approved truth version): T6 promises that
  the reviewer receives that selected target with its corresponding instructions.

### T7

- **P13-T7-C — check.** File `crates/cadence/tests/phase13_verification.rs`,
  function `phase13_audit_reports_broken_verification_traces`.
  Item reason: Hiding a broken edge, using a historical verdict as current or mutating records during audit would break T7's trace report.
  Association reason (T7, current approved truth version): Hiding a broken edge, using a historical verdict as current or mutating records during audit would break T7's trace report.
  Setup: actual requirement/roadmap documents with an active requirement
  lacking phase, one assigned to an absent phase, a known phase with an
  unclaimed requirement, a plan naming an unknown requirement, and valid
  native chains with rejected/not_seen evidence plus a met control. Publish
  context/maps/verdicts publicly with independent verification runs; include
  superseded map and waiver. Call read-only verification-audit, cad-audit and
  the retained cad-coverage alias/view through that same query. Compare
  durable before/after snapshots.
  Expected: handwritten broken traces identify existing and missing edges,
  origins, current applicable verdicts and waivers. Label the requirement to
  truth association as phase-scoped, never a direct semantic edge. The valid
  control traces; orphan and unknown requirements remain visible. Structural
  coverage cannot certify rejected evidence; superseded evidence cannot count
  as current met. No status, map, UAT or store write occurs. All boundaries
  and allowed fakes are the common setup, with literal expected trace rows.
  Command:
  `cargo test -p cadence --test phase13_verification phase13_audit_reports_broken_verification_traces -- --exact`.
- **P13-T7-A1 — artifact.** New `verification/audit.rs`, its compiled
  instruction/rendering integration, and generated `skills/cad-audit/SKILL.md`
  and `skills/cad-coverage/SKILL.md`. Substance: one read-only trace join,
  unavailable-read and broken-edge reporting, origins and next actions.
  Item reason: the compatibility alias cannot generate tests or competing evidence.
  Association reason (T7, current approved truth version): T7 requires one read-only join that exposes each broken requirement trace and its current verdict.


T7 names the outcome of an owner operation rather than a value crossing between
two things; no internal link is added. There is no observation item.

## Tasks

### Task 1: Deliver the explicitly selected review question

- **Files:** `crates/cadence/src/review/mod.rs` , `crates/cadence/src/review/selection.rs` (EDIT:
  select_next, dispatch_roster, delivery_completion), `crates/cadence/src/review/instructions.rs` ,
  `crates/cadence/src/review/invoking.rs` , `crates/cadence/src/review/provider/payload.rs` ,
  `crates/cadence/src/review_service.rs` , `crates/cadence/src/server.rs` ,
  `crates/cadence/src/main.rs` , `skills/cad-review/SKILL.md` ,
  `skills/cad-decision-review/SKILL.md` , `skills/cad-minimalism-review/SKILL.md` ,
  `skills/cad-plan-review/SKILL.md` , `crates/cadence/tests/phase13_verification.rs` ,
  `crates/cadence/tests/support/phase13.rs` .
- **Action:** Deliver P13-T6-C, P13-T6-A1 and P13-T6-L. Write the one approved check red,
  `test(13): phase13_review_surface_selects_target_and_intent red P13-4-T1` . EDIT the existing
  review/selection.rs while preserving select_next, dispatch_roster's roster freezing,
  delivery_completion and attempt_usage. Add the user target-selection logic without replacing
  retained delivery selection or its module registration. CREATE review/instructions.rs for shared
  compiled intent. Implement review-select with explicit canonical kind plus selected target;
  command surfaces are /cad-review decision <document> <decision-id>, /cad-review minimalism
  <file|directory|phase>, and /cad-review plan <phase|plan-path>. The three old skill names are
  selection aliases, not separate implementations. Require a target for missing/ambiguous input and
  stop unresolvable selection without defaulting to a larger phase/tree. Resolve decision id and
  exact source document bytes, named source or directory material, or the requested native
  phase/plan slices and locked goal/decisions. Retain that source material through existing
  review-admit, acquire_target and review-next machinery; do not trust a caller-supplied decision
  paragraph in place of resolving the selected document. Preserve original retention, replay,
  roster, providers, gates, returns/adjudication, deferred behavior, review_hook and review_ingress
  contracts. Minimalism uses specialist::minimalism_selection's base reviewer with no added
  provider/gate; plan uses policy::manual_plan_request and its configured gate. Share compiled
  target intent between invoking::local_dispatch and provider::payload::prepare: decision
  refutation, ranked deletion-oriented minimalism, plan goal-backward and locked-decision scrutiny.
  Inspect provider use of the same fragment as an artifact, without fake network/provider responses.
  Supply a project-free review-instructions renderer with alias selection in main.rs so the merged
  skill and alias artifacts are generated from the compiled source; do not add a new review backend.
  No selected edits or automatic republication. Finish green
  `feat(13): dispatch explicit review targets and intent green P13-4-T1` .
- **Verify:** `cargo test -p cadence --test phase13_verification phase13_review_surface_selects_target_and_intent -- --exact`
  the one T6 function sees exact target bytes and handwritten intent in actual existing delivery for
  all kinds/aliases, replay, missing/ambiguous refusal and unchanged target files; provider fragment
  parity is inspected in the compiled artifact.

### Task 2: Return broken phase-scoped verification traces

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/audit.rs` , `crates/cadence/src/verification/instructions.rs` ,
  `crates/cadence/src/verification/render.rs` , `crates/cadence/src/verification_service.rs` ,
  `crates/cadence/src/server.rs` , `crates/cadence/src/main.rs` , `skills/cad-audit/SKILL.md` ,
  `skills/cad-coverage/SKILL.md` , `crates/cadence/tests/phase13_verification.rs` ,
  `crates/cadence/tests/support/phase13.rs` , `skills/cad-verifier-contract/SKILL.md` ,
  `skills/cad-verify/SKILL.md` .
- **Action:** Deliver P13-T7-C and P13-T7-A1. Write the one approved check red,
  `test(13): phase13_audit_reports_broken_verification_traces red P13-4-T2` . Implement read-only
  verification-audit from observed active requirements, explicit roadmap/trace assignments, actual
  native plan requirements, phase truths, current typed map associations and applicable
  verdict/waiver records. Report requirement -> assigned phase -> claiming plan -> that phase's
  truth set -> explicit associated evidence -> current verdict, labelling the truth association
  phase-scoped instead of fabricating a direct semantic requirement/truth edge. Preserve
  source/path/row/publication/item origins, known and missing edges, unavailable reads, scope limits
  and next actions. Keep orphan active requirements, nonexistent phases, unknown plan requirements,
  unclaimed requirements, rejected/not_seen items and stale/superseded evidence visible; do not
  count structural coverage as met. Join existing native records read-only without first-touch
  import, memo writes, healing, generation, status change or source repair. cad-audit and
  cad-coverage select the same operation/view, with no generate arm or separate Markdown evidence
  authority. Generate their thin skills from compiled instruction text via a project-free
  audit-instructions renderer and a coverage-alias option; the renderer creates no project state.
  Native front doors must not invoke frozen coverage/audit generation workflows. Complete green
  `feat(13): report read-only verification trace breaks green P13-4-T2` . Regenerate
  `skills/cad-verifier-contract/SKILL.md` and `skills/cad-verify/SKILL.md` from the two
  verifier-instructions modes in this same task whenever its compiled schema or rendered authority
  changes. Both outputs are in this task's lease. Keep actual dispatch on that same compiled
  authority and include changed generated bytes in this task's green work before this plan's close
  suite; never defer them to a later plan or weaken byte-equality assertions.
- **Verify:** `cargo test -p cadence --test phase13_verification phase13_audit_reports_broken_verification_traces -- --exact`
  one T7 function returns the handwritten broken/current traces and valid control for the query and
  both aliases, preserving all durable before/after snapshots without hiding unknown or orphan
  claims.

### Task 3: Leave a concrete phase-14 adoption decision

- **Files:** `.planning/phases/13/close/readiness.md` ,
  `.planning/phases/13/reports/adoption-readiness.md` ,
  `.planning/phases/13/reports/hook-retirement.md` , `crates/cadence/tests/phase13_close.rs` ,
  `crates/cadence/tests/support/phase13.rs` .
- **Action:** Deliver mandatory close work P13-CLOSE-READINESS and complete the handoff for
  P13-CLOSE-HOOK, D-130/D-134. Neither is a truth-map item. The executor owns both reviewed
  procedures and their actual disposable rehearsal records; the orchestrator owns final
  installed-state inspection and completion of the installed and readiness reports. The verifier
  inspects actual artifacts and records and must not author these close reports or accept
  prospective success prose. Create the reviewed readiness procedure and record actual results,
  never prospective successes. Rehearse on an isolated copy of this planning tree only, classify all
  30 phases as native/imported/unavailable from their actual authority and list
  root-binding/import/format incompatibilities; no old approval, map or red history is invented and
  no live first-touch/import runs. Establish the named close regression
  `phase13_adoption_copy_preserves_history_and_recovers` : keep original copied bytes, explicit
  backup/restore identity and one active writer; drive real serve/stdio on disposable roots,
  interrupt/reopen and verify recovery/rollback results through public outputs and reopened bytes.
  Retain unsupported historical inputs as classified limits rather than silently converting them.
  Demonstrate the full native path using a separately authored native fixture, so copied rewrite
  history is not the native approval oracle. Record evidence under its actual producer and subject.
  For the rewrite's seven outer phase13_verification functions, the orchestrator supplies real
  implementation red/green commit SHAs with their P13 task subjects and an independent rerun of each
  exact saved check command against the final reviewed rewrite revision. Retain each command, test
  file/function and digest, checkout root, full HEAD/tree and index/material identity, binary
  identity, exit disposition, bounded stdout/stderr with digests, observed test selection/count,
  observer and time. Label these ordinary orchestrator-observed implementation and independent rerun
  records, not native verification-run receipts. The verifier inspects the seven checks and their
  actual artifact/link subjects and supplies its item judgments bound to those same outer check
  identities; the orchestrator records that verification/readiness result with the inputs and any
  unresolved limits. No native approved publication, allocation, phase-attempt or completion record
  for phase-13 rewrite work is required or manufactured.

  Separately record the disposable native demonstration's actual project root/root binding,
  cycle/phase occurrence, approved context and publication/map identities, allocated canonical item
  revisions, execution red/green run ids, independent verification-run ids and their
  attempt/material bindings, verdict/waiver/human/completion ids, and read-only audit/status output
  identities. Label those records as evidence about that disposable subject only; they cannot stand
  in for the seven outer rewrite functions. Retain the copied historical tree's source/copy
  identities, classifications and recovery results separately again. The executor produces those
  real-stdio fixture/rehearsal records and their locations; the orchestrator completes the report
  with its own outer-check reruns and installed-state inspection. D-130's current verification and
  honest audit/readiness work remains required; phase 13 does not self-host or retroactively approve
  rewrite history. Do not rerun the whole suite in this close task or certify model quality.
  Generated outputs must already match their compiled authorities in the task and plan that changed
  them; close does not repair deferred renderer drift. Record the explicit choice: phase 14 is the
  first intended native self-hosting phase; author its context and plans through existing native
  approval, retain prior history as classified historical inputs, store native human results through
  verification-human-result with its phase UAT projection, preserve preexisting human originals, and
  select delivery order explicitly rather than sorting phase numbers. This is a readiness decision,
  not authoring phase 14 now. The close record must identify installed current
  binary/role/front-door bytes and the final inspected hook-retirement outcome following the
  sequence below. Missing-return handling, read/subagent-trace removal, progress/health,
  installed-model acceptance and review edit application remain explicit limits. Record go/no-go
  honestly; no report says “ready” while installation, required evidence or actual hook retirement
  is unfinished.
- **Verify:** `cargo test -p cadence --test phase13_close phase13_adoption_copy_preserves_history_and_recovers -- --exact`
  the single artifact rehearsal preserves copied historical authority, identifies incompatibilities
  and demonstrates explicit backup/restore, one-writer and interruption/recovery on disposable
  roots; it does not claim live adoption, actual installed removal or phase-18 acceptance.

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

### Mandatory close sequence, after implementation and verification

These are the D-130/D-134 close operations, not test-fixture operations. The
executor owns the procedures and disposable rehearsal records. The
orchestrator owns Git, installation, final installed-state inspection and
completion of both close reports; the verifier inspects the actual records
without writing those reports. Record inspection is required before phase close. No automated check accesses the
owner's real Claude settings or hooks.

1. Inspect the actual installation and record its explicit selected roots and
   current binary identity. Install the built current binary and generated
   native skill/front-door files and directly edited agent metadata adapters through the owner's actual integration, and
   record exact installed paths and byte identities. Confirm planner, executor
   and verifier operational dispatches come from that binary using a fresh
   disposable native project; the phase-18 live-host/model acceptance remains
   separate. Do not infer installation from source strings or rendered files.
2. Immediately inspect the owner's actual rules-gate file and every matching
   registration at the now-explicit settings root. Prepare the narrowly scoped
   edit against those exact bytes using PLAN-1's close-only
   `.planning/phases/13/close/retire-rules-gate.py` procedure, with
   recoverable originals. Only after this inspection apply the file and
   registration removal together. Keep siblings, ordering, matchers, other
   event groups and all unrelated guards, including reviewer-stop and read/
   subagent-trace. Refuse ambiguity or stale preimage. A partial operation is
   unfinished retirement; recover or finish it before claiming close.
3. Inspect both actual targeted absences and unrelated preserved bytes, and
   record the installed outcome separately from the disposable rehearsal in
   reports/hook-retirement.md. No check may use the owner's real settings as
   its fixture. No hard-coded old plugin cache or HOME default is allowed.
4. Finalize reports/adoption-readiness.md with the actual installed and
   retirement identities, producer-attributed rewrite reruns, separate disposable-native verification/
   audit facts, explicit phase-14
   adoption choices and go/no-go. Leave phase 13 incomplete if required close
   work is unfinished. Do not initialize the live rewrite's native state,
   retroactively approve its history, or deliver any phase-14/18/30 promise.

The existing approved context remains byte-identical throughout. UAT writes
belong only to the attributed human-result path; completion writes only its
narrow required projections. The future progress/undo seam is applicability
invalidation, not a new progress or undo operation in this phase.

Renderer/lease rule: choose same-task regeneration, not deferred refresh.
Each task here that can change compiled verifier schema or instruction bytes
leases both generated verifier skills and regenerates affected bytes before
its green completion and this plan's required close suite. Byte equality is
preserved; no later close task repairs renderer drift outside this plan's lease.
