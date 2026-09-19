---
phase: 13
plan: 1
requirements: [T1]
files:
  - crates/cadence/src/verification/mod.rs
  - crates/cadence/src/verification/model.rs
  - crates/cadence/src/verification/instructions.rs
  - crates/cadence/src/lib.rs
  - crates/cadence/src/main.rs
  - crates/cadence/src/verification/inputs.rs
  - crates/cadence/src/verification/dispatch.rs
  - crates/cadence/src/verification/persistence.rs
  - crates/cadence/src/verification_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/phase13_verification.rs
  - crates/cadence/tests/support/phase13.rs
  - crates/cadence/src/verification/runner.rs
  - crates/cadence/src/execution/runner.rs
  - crates/cadence/tests/phase13_support.rs
  - skills/cad-verifier-contract/SKILL.md
  - skills/cad-verify/SKILL.md
  - agents/cad-verifier.md
  - agents/cad-verifier-low.md
  - agents/cad-verifier-medium.md
  - agents/cad-verifier-xhigh.md
  - agents/cad-verifier-max.md
  - crates/cadence/tests/mcp.rs
  - crates/cadence/src/execution/instructions.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/src/execution_service.rs
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-execute/SKILL.md
  - crates/cadence/tests/phase12_execution.rs
  - .planning/phases/13/close/retire-rules-gate.py
  - .planning/phases/13/close/rules-gate.md
  - .planning/phases/13/reports/hook-retirement.md
  - crates/cadence/tests/phase13_close.rs
execution:
  schema: 1
  suite: "cargo test --workspace"
  tasks:
    - id: P13-1-T1
      verify:
        - "cargo run -p cadence -- verifier-instructions"
    - id: P13-1-T2
      verify:
        - "cargo test -p cadence --test phase13_verification phase13_dispatch_carries_current_verification_inputs -- --exact"
    - id: P13-1-T3
      verify:
        - "cargo test -p cadence --test phase13_support phase13_runner_retains_independent_receipts -- --exact"
    - id: P13-1-T4
      verify:
        - "cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact"
    - id: P13-1-T5
      verify:
        - "cargo test -p cadence --test mcp execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch -- --exact"
    - id: P13-1-T6
      verify:
        - "cargo test -p cadence --test phase13_close phase13_rules_gate_retirement_rehearsal -- --exact"
---

# Phase 13: Verification and audit - Plan 1

## Goal

A verifier receives one retained, binary-composed phase attempt with the exact current authority and
commands it must inspect. Independent runs and compiled role instructions make that dispatch usable;
the bounded execution pilot fixes and hook-retirement rehearsal prepare its close.

## Must be true when done

- T1. When a verifier dispatch is issued, the verifier gets a binary-composed prompt containing the phase's current truths, evidence map, execution receipts and exact check commands.

## Context

D-124, D-125 and D-129 bind attempt material, independent execution and compiled instructions; D-134 binds the close rehearsal.
Use `plan::map_view::read`, `execution::admission::validate` and retained native task/plan history, not SUMMARY or provisional labels.
D-80 to D-122 remain credited inputs; approved context and original admissions stay immutable.
The draft's citations were checked against HEAD `42cf984c0da3fd5ccf4a556e6f90c78e2a9e6725`; installed behavior remains phase 18.

## Mandatory close work

**P13-CLOSE-HOOK — mandatory close work, not acceptance evidence.**
The executor creates `.planning/phases/13/close/retire-rules-gate.py`,
`.planning/phases/13/close/rules-gate.md` and the disposable rehearsal section
of `.planning/phases/13/reports/hook-retirement.md` in task 6. The script has
a close-only lifetime outside the shipped product. No owner-HOME default or
general settings-deletion service is permitted.
The orchestrator performs the final installed-state inspection and scoped
removal and completes the installed-result section during PLAN-4's close.
Both actual absences and preserved unrelated bytes must be recorded.
The verifier inspects those actual records; it does not author the reports.
These obligations have no T1/T7 map association and create no observation item.

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

### T1

- **P13-T1-C — check.** File `crates/cadence/tests/phase13_verification.rs`,
  function `phase13_dispatch_carries_current_verification_inputs`.
  Item reason: Replacing current native inputs with stale state, SUMMARY prose or configured commands would break the actual verifier dispatch promised by T1.
  Association reason (T1, current approved truth version): Replacing current native inputs with stale state, SUMMARY prose or configured commands would break the actual verifier dispatch promised by T1.
  Setup: complete native execution with two plan contributions, check/artifact/link
  items and a shared artifact, no observation; save public identities, red/green
  receipts and owner statements. Include misleading SUMMARY prose and a
  conflicting configured test command. Call
  `cadence_query {operation:"verify-next",phase:N}`, then read and replay the
  retained attempt after restart. Parse the actual outgoing operational JSON.
  Expected: the handwritten truth/item set and associations, full contributing
  content revision vector, exact map digest, recorded receipt pairs and owner
  statements match the acknowledged records. Commands equal the saved check
  commands, not the configured alternative. The design's Verifier block and
  strict patch contract occur in the prompt, with no findings-file assignment.
  Replay preserves attempt and prompt identity. Missing or inconsistent native
  authority refuses dispatch. All boundaries and allowed fakes are exactly the
  common setup above; the real outgoing handoff is inspected, with no role stub.
  Command:
  `cargo test -p cadence --test phase13_verification phase13_dispatch_carries_current_verification_inputs -- --exact`.
- **P13-T1-A1 — artifact.** New `crates/cadence/src/verification/instructions.rs`
  and `crates/cadence/src/verification/model.rs`, wired through
  `crates/cadence/src/main.rs` and actual dispatch. Substance: the verbatim
  Verifier block, strict item-patch vocabulary, inspection and independent-run
  obligations, and compiled role/front-door text. Item reason: the dispatched role
  and the project-free `cadence verifier-instructions [--frontdoor]` must use
  one authoritative instruction source, not editable runtime prose.
  Association reason (T1, current approved truth version): T1 requires the actual verifier dispatch to carry this compiled role contract and strict patch vocabulary.

- **P13-T1-A2 — artifact.** New `verification/inputs.rs`,
  `verification/dispatch.rs`, `verification/persistence.rs`,
  `verification/runner.rs` and `verification_service.rs` under
  `crates/cadence/src/`, with explicit writer/transaction integration.
  Substance: retained attempts, coherent current-input binding, immutable
  independent launch/result/material receipts and located readback/refusals.
  Item reason: the role must be able to inspect and rerun the exact dispatched
  inputs without reopening executed tasks.
  Association reason (T1, current approved truth version): T1's current-input prompt depends on this retained attempt, coherent binding and the independent-run facility the dispatched role uses.

- **P13-T1-A3 — artifact.** Two generated skills:
  `skills/cad-verifier-contract/SKILL.md` and `skills/cad-verify/SKILL.md`.
  The five verifier agents listed in task 4 are directly edited metadata
  adapters referring to the compiled contract, not generated outputs. The
  refreshed compiled/generated executor instructions in task 5 are also included.
  Substance: correct direct tool permissions, no verifier document writes,
  and usable exact native operation examples. Item reason: dispatch must be
  reachable through its front door with the authority it actually has.
  These Markdown files are artifacts, never the acceptance check's subject.
  Association reason (T1, current approved truth version): T1's dispatch is reached with these compiled/generated front doors and directly edited role permissions.

- **P13-T1-L — link.** `spec.caller: "cadence_query verify-next"`;
  `spec.callee: "verifier dispatch recipient"`;
  `spec.value: "binary-composed prompt"`. The entire literal
  `binary-composed prompt` occurs within T1's approved outcome slot; no
  paraphrase or concatenation across approved slots is permitted.
  Trace the retained current phase inputs into the actual outgoing prompt in
  P13-T1-C. No second test or model-quality claim is added.
  Item reason: substituting or omitting the composed prompt at this handoff
  would prevent the verifier from receiving T1's current verification inputs.
  Association reason (T1, current approved truth version): T1 explicitly
  promises this binary-composed prompt to the verifier.

## Tasks

### Task 1: Compile the verifier's instruction authority

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/instructions.rs` , `crates/cadence/src/lib.rs` ,
  `crates/cadence/src/main.rs` .
- **Action:** Deliver P13-T1-A1. Create the verification module and strict schema vocabulary for the
  planned public operations in CONTEXT: verify-next, verification-run, verification-submit,
  verification-read, truth-waive, verification-complete and verification-audit, with human-result
  input separately owner-attributed. Define the complete patch shape now, but do not advertise
  unimplemented operations as successful. A patch identifies root/occurrence/attempt and its full
  dispatched basis and has one verdict per canonical item, accepted/rejected/not_seen plus observed
  evidence and appropriate run references; no phase verdict, truth-status assignment, document path
  or file-writing arm. Membership and judgment are separate concerns. Carry the design's Verifier
  block verbatim and explain actual artifact inspection, link tracing, the observation cap, vacuous
  checks, real red/green inspection and independent reruns; never command the suite or infer
  evidence from SUMMARY. Extend main.rs's project-free run_command pattern with
  verifier-instructions and --frontdoor, sharing these compiled bytes with later dispatch. No
  runtime override. Preserve source-permission limits: a prepared owner payload is not owner
  approval.
- **Verify:** `cargo run -p cadence -- verifier-instructions` prints the complete compiled contract,
  verbatim Verifier block and strict patch schema without opening a project; its item protocol
  contains no aggregate verdict or file-writing arm.

### Task 2: Retain and deliver the exact verifier attempt

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/inputs.rs` , `crates/cadence/src/verification/dispatch.rs` ,
  `crates/cadence/src/verification/persistence.rs` , `crates/cadence/src/verification_service.rs` ,
  `crates/cadence/src/server.rs` , `crates/cadence/src/recall/mod.rs` ,
  `crates/cadence/src/store/writer.rs` , `crates/cadence/src/store/transaction.rs` ,
  `crates/cadence/tests/phase13_verification.rs` , `crates/cadence/tests/support/phase13.rs` .
- **Action:** Deliver P13-T1-C, P13-T1-L and the dispatch portion of P13-T1-A2. Write the ONE
  owner-approved test red first; subject
  `test(13): phase13_dispatch_carries_current_verification_inputs red P13-1-T2` . Add native public
  dispatch/read/replay through server routing and the resident request queue into the single writer.
  Use map_view::read's complete coherent digest, including its projection/history inputs, with
  canonical aliases and explicit association reasons; never substitute the item definition hash,
  which excludes associations. Bind full root/project, occurrence, context/truth versions, every
  contributing publication/content/map revision, original admission allocation and retained
  execution history, HEAD/tree, explicit index and material identity. Require clean committed source
  and full applicable execution authority; examine failed and Unknown history too. Do not infer
  readiness from the persisted provisional label, README, SUMMARY, or admission alone. Persist
  attempt identity and the operational prompt before returning; exact replay retains the historical
  prompt without making it current, changed payload reuse refuses. Domain refusal identifies the
  missing or inconsistent authority; no partially composed dispatch. Observe the inputs again at the
  committing snapshot and before confirmation. Add versioned verification namespace ownership to
  writer and transaction validation so generic writes cannot manufacture attempts, keeping old
  intent replay unchanged. Render operational inputs separately from delimited authored material via
  the shared compiled contract. Finish green with subject
  `feat(13): retain native verifier dispatch green P13-1-T2` . By this task the real
  stdio-to-writer-to-dispatch path must work; later tasks deepen that path rather than leave
  disconnected scaffolding.
- **Verify:** `cargo test -p cadence --test phase13_verification phase13_dispatch_carries_current_verification_inputs -- --exact`
  runs exactly the T1 function; current inputs and actual outgoing prompt match the handwritten
  oracle, inconsistent authority refuses, and restart replay preserves identity.

### Task 3: Run saved checks in the verification attempt

- **Files:** `crates/cadence/src/verification/mod.rs` , `crates/cadence/src/verification/model.rs` ,
  `crates/cadence/src/verification/inputs.rs` , `crates/cadence/src/verification/persistence.rs` ,
  `crates/cadence/src/verification/runner.rs` , `crates/cadence/src/verification_service.rs` ,
  `crates/cadence/src/execution/runner.rs` , `crates/cadence/src/server.rs` ,
  `crates/cadence/src/recall/mod.rs` , `crates/cadence/src/store/writer.rs` ,
  `crates/cadence/src/store/transaction.rs` , `crates/cadence/tests/phase13_support.rs` ,
  `crates/cadence/tests/support/phase13.rs` .
- **Action:** Deliver the independent-run portion of P13-T1-A2, D-125. Add a verification-scoped
  runner taking the retained attempt and canonical item id/revision, deriving the command solely
  from that attempt's saved check spec. Persist immutable launch before spawning and observed result
  afterward, with run identity, material, bounded stdout/stderr, digests, exit disposition and
  observation classification. Share execution/runner.rs's child capture and material observation
  where useful, not its active-task lifecycle or task Verify stage. The task remains closed. Exact
  replay returns its existing receipt without relaunch; interruption leaves unanswered launch
  Unknown. Reobserve committed source, index and scoped material before and after the real process.
  Reject supplied alternative command, suite/CI substitution, foreign item or stale basis; do not
  invent a broader shell grammar contrary to D-100. Retain ambiguous, zero-test and vacuous output
  for inspection; such output never mechanically becomes accepted evidence. Establish named artifact
  regression `phase13_runner_retains_independent_receipts` in the new support integration target
  using the same real stdio fixture, child side effects and restart to demonstrate saved-command
  execution once, immutable launch/result and Unknown handling. No injected fake runner result; this
  is not a second T1 check.
- **Verify:** `cargo test -p cadence --test phase13_support phase13_runner_retains_independent_receipts -- --exact`
  one real-binary artifact regression passes: only the saved item command runs, replay causes no
  second side effect, source mismatch refuses, and an interrupted launch remains Unknown without
  reopening its execution task.

### Task 4: Render the verifier role and front door

- **Files:** `crates/cadence/src/verification/instructions.rs` ,
  `skills/cad-verifier-contract/SKILL.md` , `skills/cad-verify/SKILL.md` , `agents/cad-verifier.md`
  , `agents/cad-verifier-low.md` , `agents/cad-verifier-medium.md` , `agents/cad-verifier-xhigh.md`
  , `agents/cad-verifier-max.md` , `crates/cadence/tests/mcp.rs` .
- **Action:** Deliver the verifier portion of P13-T1-A3. Generate the two skills from the two
  verifier-instructions modes and directly edit all five agent rung files as thin metadata pointing
  to the compiled contract, as current native planner/executor roles do. Permit direct
  cadence_query/cadence_apply for the dispatched operations and inspection tools; remove verifier
  Write/Edit/MultiEdit authority. Rung metadata must not duplicate policy or manufacture owner
  approval. cad-verify obtains the retained verify-next dispatch, sends independent verification-run
  calls and one complete item patch, then reads the binary report; it never constructs criteria from
  SUMMARY or assigns a findings-file path, performs sweep/deep alternative acceptance, or updates
  UAT/ROADMAP itself. Extend the existing mcp rendered-skill/direct-permissions regression to
  compare exact generated contract and front-door bytes and all rung permissions. Frozen
  verify/deep/sweep prose has no native dispatch path.
- **Verify:** `cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact`
  the existing single artifact regression compares the generated bytes to the project-free binary
  outputs and confirms all verifier rungs have the correct direct tool permissions without a
  document-writing contract.

### Task 5: Make the rendered execution front door and refusals sufficient to use

- **Files:** `crates/cadence/src/execution/instructions.rs` ,
  `crates/cadence/src/execution/boundary.rs` , `crates/cadence/src/execution_service.rs`
  (derivation_refusal, checked_execution), `crates/cadence/src/server.rs` ,
  `skills/cad-executor-contract/SKILL.md` , `skills/cad-execute/SKILL.md` ,
  `crates/cadence/tests/mcp.rs` , `crates/cadence/tests/phase12_execution.rs` .
- **Action:** Deliver the execution portion of P13-T1-A3, exactly draft G findings 2, 3, 4, 5 and 8.
  Explain plan-read/evidence-read identities, complete allocation, exact execution-admit input with
  request_id/expected_set_version/contract and execution-extend before execute-next, with a minimal
  complete typed example. Wire phases are positive JSON integers; do not teach passing the unchanged
  slash-command string. Explain the retained checkpoint id versus gate/authorization/task id and
  both Stop branches: linked resume names the same checkpoint, unlinked Stop needs later owner
  approval with omitted/null checkpoint. Show a conventional completion subject with the actual task
  token, such as `feat: deliver task-A` ; Git signing/verify-commit uses repository configuration
  and the server's environment, not an imaginary Cadence keyring. Show the exact existing Inspection
  shape `{check:{id,item_revision},test_digest,evidence:[red_run,green_run],no_subject_stub}` ,
  owner approval `{approved,owner,at,submission}` and optional supersedes, without weakening D-111.
  Preserve DerivationError::StateConflict's source, field, declared and derived through
  derivation_refusal, stable_reason and the durable public boundary. For malformed arguments retain
  the actual safe bounded field/value detail, not a generic lifecycle failure; keep stable
  codes/replay and distinguish transport-invalid diagnostics from acknowledged domain refusal. No
  refusal repairs state. Regenerate both executor skills. Extend the ONE existing mcp function
  execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch to settle this entire
  task. In that function, inspect both actual executor-instructions outputs and their generated
  skill bytes, assert the handwritten admission/allocation, phase, Stop, signing, subject-token and
  Inspection guidance, then drive the real stdio malformed-phase and located lifecycle-conflict
  cases through replay/restart. Share non-test helpers if useful, but do not invoke a second test
  function or add a new acceptance check. Task 4's metadata regression remains separate; this task's
  single function covers both rendered usability and public refusal behavior. Findings 6/7 and
  continuation implementation already delivered in phase 12 are outside this task.
- **Verify:** `cargo test -p cadence --test mcp execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch -- --exact`
  the ONE existing function verifies both compiled/generated execution guidance against handwritten
  requirements and real public refusals retaining supplied field/value or
  source/field/declared/derived across replay/restart without changing effective state.

### Task 6: Rehearse the explicitly rooted hook close procedure

- **Files:** `.planning/phases/13/close/retire-rules-gate.py` ,
  `.planning/phases/13/close/rules-gate.md` , `.planning/phases/13/reports/hook-retirement.md` ,
  `crates/cadence/tests/phase13_close.rs` , `crates/cadence/tests/support/phase13.rs` .
- **Action:** Deliver mandatory close work P13-CLOSE-HOOK, D-134; this is not an acceptance-map
  item. The executor owns the reviewed procedure and disposable rehearsal record. The orchestrator
  owns the final installed-state inspection, removal and completion of the installed section of the
  report. The verifier inspects actual records and must not author the close report or accept
  prospective success prose. Create the small standard-library procedure at
  `.planning/phases/13/close/retire-rules-gate.py` , beside the phase close materials. Its lifetime
  is close-only: it is unshipped support, never installed as a product command or retained as a
  runtime gate. Update the rehearsal and documented removal invocation to consume this exact path.
  The procedure must require an explicit settings root and an inspected preimage binding for both
  the hook and settings; no HOME default, owner-settings discovery, MCP deletion service or new
  hook. Limit targets to that root's rules-gate.mjs and exact matching registrations. Preserve raw
  recovery originals, unrelated values and ordering, sibling commands, matchers, all other event
  groups, guard files and reviewer-stop bridge. Match inspected command identity rather than
  substrings; similar-but-different commands remain. Refuse ambiguity or stale input before changes;
  interruption/partial removal is unfinished with recoverable originals, never reported complete.
  Make rerun/absent handling explicit and verify both targeted absences together. Document the later
  installed-state inspection and scoped close operation; do not perform it in this task. Establish
  artifact regression `phase13_rules_gate_retirement_rehearsal` : real serve/stdio native planner,
  executor and verify-next dispatch establishes the compiled prerequisite in the disposable project;
  the exact procedure runs against an explicitly supplied disposable settings copy containing
  multiple matching registrations, near matches and unrelated guards. Exercise absent, ambiguous,
  stale-preimage and real partial-failure cases and recovery, without touching owner settings.
  Record actual commands, identities, outcomes and remaining installed-removal obligation in the
  rehearsal report; do not prewrite a successful close claim.
- **Verify:** `cargo test -p cadence --test phase13_close phase13_rules_gate_retirement_rehearsal -- --exact`
  one disposable artifact rehearsal confirms exact removal and preserved unrelated ordering/bytes,
  refused ambiguous/stale inputs, recoverable partial failure and real compiled dispatch; the report
  explicitly leaves actual installed retirement pending.

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

P13-CLOSE-HOOK's actual installed removal is mandatory close work after
PLAN-4's installation/readiness preparation, never an owner-settings test.
The final close sequence and orchestrator report completion are in PLAN-4.
This plan delivers no observation, live-host acceptance, self-hosting import,
phase-14 trace-hook removal, phase-30 edit loop or mutation/style obligation.
