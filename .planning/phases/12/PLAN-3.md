---
phase: 12
plan: 3
requirements: [T5, T6, T7]
files:
  - crates/cadence/src/execution/mod.rs
  - crates/cadence/src/execution/admission.rs
  - crates/cadence/src/execution/history.rs
  - crates/cadence/src/execution/runner.rs
  - crates/cadence/src/execution/instructions.rs
  - crates/cadence/src/execution/dispatch.rs
  - crates/cadence/src/execution/render.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/execution_runner_service.rs
  - crates/cadence/src/next_action/continuation.rs
  - crates/cadence/src/next_action_service.rs
  - crates/cadence/src/rail/receipts.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/main.rs
  - crates/cadence/tests/phase12_execution.rs
  - crates/cadence/tests/mcp.rs
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-execute/SKILL.md
  - agents/cad-executor.md
  - agents/cad-executor-low.md
  - agents/cad-executor-medium.md
  - agents/cad-executor-xhigh.md
  - agents/cad-executor-max.md
---

# Phase 12: Execution and tasks - Plan 3

## Goal

Resume only unfinished native tasks, retain the binary runner's task and
suite history, and deliver a state-composed executor dispatch with its
admitted checks and compiled execution instructions.

## Must be true when done

- T5. When an acknowledged checkpoint is continued, the executor gets only
  the plan's unfinished tasks.
- T6. When a plan completes through Cadence's command runner, the owner sees
  a run history containing task-named commands during work and one
  full-suite run after its last task.
- T7. When an executor dispatch is issued, the executor gets a
  binary-composed prompt containing its admitted checks, current task state
  and execution instructions.

## Context

Depends on PLAN-1.md and PLAN-2.md, sequentially; their admitted bases, task events, observed runs and owner records are the authority.
D-112, D-113 and D-115 bind continuation, runner lifecycle and compiled instructions; D-120 governs suite-failure repair through new gap identities.
`checked_continuation` currently follows active-dispatch replay; `render_dispatch_prompt` carries old whole-plan instructions and opaque body.
Follow `plan/instructions.rs` and `main.rs`'s project-free rendering pattern; retain historical rendering and phase-7/9 settlement behavior.
O1 is pending. No hook deletion, verifier dispatch/status, SUMMARY table, recall, cad-task, D-NN correction, pre-commit clearance or review-fix continuation.

## Evidence map

The owner approved these truths on 2026-09-10. Plan 1's common real-binary
fixture, native approvals, exact Git flags, handwritten expectations and
reopened-byte rules apply unchanged. Each check below is one function in
`crates/cadence/tests/phase12_execution.rs`. Restart means a new actual
`cadence serve` process against the same disposable project, not rebuilding
an in-memory service. All expectations come from the authored native records,
actual fixture commits and handwritten expected task lists/command output.

### T5

- **P12-T5-C — check.** File `crates/cadence/tests/phase12_execution.rs`,
  function `phase12_continuation_dispatches_only_unfinished_tasks`.
  Setup: publish/admit a real native A/B/C plan; close A using real red/green
  runs, signed completion and exact owner attestation. Start B and acknowledge
  a checkpoint with explicit Stop. Exit/reopen; query `execute-next` and
  expect the retained Stop to prevent executor dispatch. Submit the explicit
  owner continuation answer through the actual phase-7-backed public path,
  preserving the Stop and linking the successor authorization. Kill/restart
  again. Call `execute-next` and inspect the actual dispatch response.
  Expected property: the executable task list is exactly handwritten `[B, C]`
  in plan order; A is absent from every executable task/allocation section.
  A may appear only as clearly historical completed state. The admitted
  checks for B/C and the checkpoint/attempt links equal the retained native
  records; no completed task is scheduled again. Compare this with reopened
  store history, not `build_dispatch` output used as an oracle.
  Include, within this function, repeated query/receipt replay, an attempted
  new-id duplicate close of A, and a commit found for B without acknowledged
  progress: dispatch waits for explicit reconciliation instead of blindly
  rerunning B. After reconciled acknowledgment, only truly unfinished work
  is dispatched. A declined continuation remains stopped. A legally approved
  new gap plus explicit set extension preserves A's completion and original
  receipt bytes; it does not reset the original task list or transfer its
  check ownership. Reuse C2's real fixture helpers, not synthetic completion
  state. All refused calls leave the protected records byte-identical after
  reopen. Boundary: actual public continuation and dispatch, real process
  restart, Git, store and filesystem; fakes only clock/caller inputs.
  Command:
  `cargo test -p cadence --test phase12_execution phase12_continuation_dispatches_only_unfinished_tasks -- --exact`.
  Item/association reason: the trigger is authorized continuation of an
  acknowledged checkpoint; the observed outcome is the executor's actual
  received task list, not a selector's internal result.
- **P12-T5-L — link.** Caller: the binary's retained-task continuation and
  dispatch boundary. Callee: the executor receiving that dispatch. Value:
  `the plan's unfinished tasks`. This exact phrase is named by T5. Trace the
  admitted ordered tasks through retained completed outcomes to the `[B, C]`
  task list in C5's real dispatch. Use C5's same call and handwritten oracle,
  not another test or a faked binary. The passive test recipient observes the
  actual outgoing boundary; O1 supplies the pending real-host observation.
  Item/association reason: filtering internally without handing the filtered
  value to the executor does not establish T5.
- **P12-A-CONTINUATION — artifact; association T5.** Native continuation in
  `execution_service.rs`, `execution/history.rs`, `execution/dispatch.rs`,
  `next_action/continuation.rs` and `next_action_service.rs` reads confirmed
  task/checkpoint history, explicit answers and reconciliation. Inspect that
  active-dispatch replay cannot precede/evade a subsequent Stop. A resumed
  attempt has a linked identity and binds current state without changing its
  immutable admission. Keep raw completed events and old receipts intact;
  neither report first-line parsing nor a new request id resets progress.
  Preserve the existing suggestion/permission distinction and review handoff.
  Reason: continuation must consume durable authority, not stale prompt bytes.

### T6

- **P12-T6-C — check.** File `crates/cadence/tests/phase12_execution.rs`,
  function `phase12_runner_retains_task_commands_and_one_suite`.
  Setup: real native A/B plan with its canonical check allocated to A and
  an explicit empty assignment for B. A uses C2's tiny real subject and valid
  red/green evidence; B's marker command needs no fabricated check history.
  This keeps the approved union and allocation valid. Publish
  named task commands and one suite command that run real controlled
  programs, leave distinct append-only markers and emit handwritten test
  results. Use real Git commits and owner records for tasks that deliver
  checks. The controlled programs are caller-authored fixture subjects,
  not substituted runner implementations.
  Call the actual binary runner during work, replay launch requests, close
  tasks, request the suite, then request native plan completion. Restart
  and read real run history and marker files. Expected successful property:
  selected commands exactly equal the admitted named commands; task/attempt
  labels and order match the handwritten sequence; repeated task repair runs
  remain distinct; the single successful suite launch occurs strictly after
  the last task-close acknowledgment and before the plan's completion.
  Each run retains exit disposition, bounded stdout and stderr bytes (64 KiB
  each), separate digests, capture-completeness flags, launch/result timestamps
  and committed material regardless of class. Handwrite the output and assert
  the same finite classifier as C2: for a terminated run, a complete cargo/libtest
  line beginning `test result:`, or the Python unittest `Ran N tests` summary
  (singular `test` also allowed, optional timing suffix) plus `OK` or
  `FAILED (...)`, yields `results observed`. Everything else is Unknown,
  including a terminated custom command with complete captures but no
  recognized vocabulary. These are the binary's only two classes; it has no
  `no results` class. Retain missing-result launches as Unknown without
  inventing a result timestamp. Infer nothing from arbitrary output.
  Fixture marker commands that demonstrate suite results emit those exact
  named lines. Include successful and failing recognized results, terminal
  arbitrary output with no result lines, a partial Python pair and a missing
  observed result. `results observed` with a failing disposition is a reported failure,
  not automatically red: unittest needs failures above zero and errors zero,
  while errors above zero are a failed attempt, never red. Cargo's
  `test result: FAILED` with failing disposition is red-eligible with the
  cause left to inspection. Unknown custom check runs need the separate
  owner classification bound to output digest and check revision specified
  in C2 for red/green eligibility. No owner interpretation is presented as
  a binary observation or used to relabel Unknown.
  The marker proves one process for a replayed request. Calling the suite
  early, supplying an unnamed command, trying a second suite after a real
  result, or claiming a caller/CI run refuses without changing protected
  records or launching a process.
  Other cases stay in this SAME function. In a separate admitted plan,
  coordinate a real result-free suite launch with a child handshake, kill
  the server before a result is recorded and reopen. Its persisted launch
  is Unknown and the plan is incomplete. Replay returns the original launch
  receipt without a new marker. Submit the operator's typed `cadence_apply`
  confirmation naming the dead launch id and attesting over the retained
  bytes that no test results were produced. The binary accepts it for an
  Unknown dead launch, retains it as its own attributed/timed record beside
  that launch and permits exactly ONE confirmed relaunch per admitted plan.
  Retain both launch records and the confirmation; replay of the confirmation
  cannot consume another exception. The absence claim is the operator's
  attestation shown with the bytes, never a binary finding.
  Unconfirmed retry, second relaunch or confirmation for another launch
  refuses. When a controlled suite emits recognized results, including a
  failing cargo result or a unittest `FAILED (errors=1)` result, the binary
  refuses the confirmation outright because its class is `results observed`.
  A new request id cannot rerun that suite. Keep these cases inside C6.
  Also run a real custom command reporting its own failure text without the
  finite vocabulary and assert Unknown even with terminal disposition and
  complete captures: the bytes are not a binary finding of no test results,
  and neither completion nor relaunch follows automatically. In another
  Unknown dead-launch case, a command stops after custom startup text before
  tests run; the typed operator attestation permits the one relaunch.
  Both Unknown cases retain their original class, raw bytes and disposition;
  accepting the attestation does not verify the truth of its absence claim.
  Exercise a real process that fails before reporting separately from a real
  recognized test failure; both remain visible in history.
  Repair the recognized failed suite only in a newly approved, explicitly linked gap
  plan with a versioned admitted-set extension. Its run has its own plan
  identity; the original failure/receipts and completed tasks remain exact,
  and the original plan is not silently made successful or rerun. Settle
  existing risk requirements through their real public path for the main
  success control. Completion requires BOTH the suite receipt and phase-7
  settlement; passing one does not erase a pending other.
  Boundary: real stdio runner operation, actual controlled child processes,
  markers, Git, writer, store and filesystem; fakes only clock/caller inputs.
  Scope is only Cadence's runner. External shell commands and wrapper
  subcommands are not observed or claimed controlled. Command:
  `cargo test -p cadence --test phase12_execution phase12_runner_retains_task_commands_and_one_suite -- --exact`.
  Item/association reason: only actual launches and retained history reveal
  whether command names, order and once-per-plan behavior are enforced.
- **P12-A-SUITE — artifact; association T6.** `execution/runner.rs`,
  `execution_runner_service.rs`, `execution/history.rs`, native completion
  and writer/intent integration persist suite eligibility, launch, result
  and one explicitly confirmed result-free relaunch. Inspect atomic launch
  claims and competing/replayed requests, observed output/test-result state,
  crash recovery and no automatic retry. Retain exit disposition, 64 KiB per
  output stream with individual digests/completeness flags, and launch/result
  timestamps and committed material regardless of class; use only the cargo
  `test result:` or Python `Ran N test(s)` plus `OK`/`FAILED (...)` vocabulary
  defined in C2/C6. Terminated runs are `results observed` with recognized
  vocabulary and Unknown otherwise, even for complete custom output. There
  is no binary `no results` class. Unknown alone is neither success nor
  plan completion. The relaunch confirmation is its own typed apply record
  naming the dead launch id and operator attestation over the retained bytes
  that no test results were produced. Refuse it for `results observed`;
  accept it for an Unknown dead launch subject to exactly one confirmed
  relaunch per admitted plan. Show the attestation with the bytes as owner
  interpretation, preserving Unknown and never claiming binary proof of absence. A
  failed suite leaves the plan incomplete and points to the D-84/D-120 new
  gap path. The read-only history preserves all runs and original receipts.
  Reason: process lifetime and plan lifetime must agree without treating
  one-suite as an unlimited retry budget.

### T7

- **P12-T7-C — check.** File `crates/cadence/tests/phase12_execution.rs`,
  function `phase12_dispatch_contains_admitted_checks_state_and_instructions`.
  Setup: publish/admit native A/B tasks with handwritten check command,
  expected result, test file/function/setup/call/boundary/fakes and typed
  task ownership. Configure a conflicting global command through the real
  config operation while the approved plan has its explicit named command.
  Include a harmless caller-authored plan-body sentence asking to ignore
  red-first/style instructions; it cannot replace compiled operational
  instructions. Complete A with real evidence, stop and explicitly resume
  B through the real public operations.
  Call `execute-next` on the fresh server and inspect the REAL returned
  dispatch/prompt. Expected property: the executor receives the exact
  admitted native check ids/revisions/specifications and allocation, current
  B task/attempt/checkpoint state and clearly separated historical A state,
  named commands/suite and source lease from retained authority. It also
  receives the design's complete Executor block and the classical default:
  `test a unit through what it exposes`,
  `fake only files, clock, other programs and network`,
  `skip trivial code`, and `write the expected value by hand`.
  Handwrite these expected phrases and fixture values; never import the
  compiled role constant or renderer to compute expected text. Assert the
  prompt states the weaker owner-attestation gate, real red/green observed
  runs, retained task progress, named-command/one-suite policy, no-results
  exception and runner's external-shell/wrapper limit. The explicit admitted
  command wins over configuration; a later config change cannot silently
  replace it. Unknown language with an explicit command remains usable with
  the stated warning; missing explicit command refuses rather than inventing
  a runner. No style string changes task eligibility or introduces counts.
  Replay the same dispatch and compare returned bytes with its retained
  response identity; after acknowledged progress a fresh linked dispatch
  reflects the new state instead of replaying an obsolete whole-plan prompt.
  Reopen the filesystem/store and match the response to the original
  approved records and confirmed event history. No skill Markdown or direct
  `render_dispatch_prompt` call is the subject of this check. Boundary:
  actual public dispatch, native config/approval, Git, store and filesystem;
  fakes only clock/caller inputs. Command:
  `cargo test -p cadence --test phase12_execution phase12_dispatch_contains_admitted_checks_state_and_instructions -- --exact`.
  Item/association reason: the trigger is dispatch issuance and the observed
  outcome is what leaves the binary for the executor, not a renderer sample.
- **P12-T7-L — link.** Caller: the binary's admitted check store and dispatch
  composer. Callee: the executor receiving the issued prompt. Value:
  `its admitted checks`, exactly as T7 names it. Trace native retained
  item/revision/specification and task allocation into C7's real outgoing
  dispatch with the same handwritten inputs and readback. This is inspection
  of C7's handoff, not a second check or a claim that a host/model obeyed it.
  Item/association reason: an internally correct map that is omitted or
  replaced in the dispatch does not satisfy T7. No additional links are
  invented for configuration, hashes or instruction rendering.
- **P12-A-ROLE — artifact; association T7.** New
  `crates/cadence/src/execution/instructions.rs` parallels
  `plan/instructions.rs`: the Executor block and classical default live in
  compiled Rust, alongside the bounded native task/runner protocol and the
  explicitly weaker owner-attestation explanation. `main.rs` exposes a
  project-free renderer for the executor contract and execute frontdoor;
  the resulting `skills/cad-executor-contract/SKILL.md` and
  `skills/cad-execute/SKILL.md` are generated artifacts, never a second policy
  authority or check subject. Inspect substantive compiled content and the
  generation path. These are exactly the two outputs required by amended
  D-115: `skills/cad-executor-contract/SKILL.md` and
  `skills/cad-execute/SKILL.md`. The parked cad-task skill consumes that source
  when its slice lands; this phase adds no task-skill artifact, task or lease.
  No typed preset catalog, free-text rule override,
  coverage/count gate or runtime Markdown loading is added. Reason: the
  default and operational instruction must reach both dispatch and host
  artifacts from one compiled source.
- **P12-A-PROMPT — artifact; association T7.** Native composition in
  `execution/dispatch.rs`, `execution/render.rs`, `execution_service.rs` and
  the role module renders authoritative checks, allocation, current task
  state, exact named commands, lease and compiled role source. Persist the
  native render/protocol version and response identity so reconstruction
  is explicit; retain old dispatch rendering/codec behavior for historical
  replay without re-certifying it. Opaque plan prose is delimited authored
  context, never instructions overriding the binary. Keep route/agent/model
  selection from the existing compiled configuration path. Explicit approved
  task/suite commands take precedence; existing effective workflow command
  configuration can supply proposals only before exact approval/admission,
  never replace retained commands at run time. Unknown-language diagnostics
  require an explicit command instead of guessing. Reason: prompt composition
  must carry the same admitted work the runner and close gate will accept.
- **P12-A-HOST — artifact; associations T5 and T7.** The generated
  `skills/cad-executor-contract/SKILL.md` and `skills/cad-execute/SKILL.md`,
  and the five directly edited `agents/cad-executor*.md` metadata adapters,
  can actually use the native task-start/run/progress/close protocol. The
  entrypoint emits only those two skill outputs, not the agent manifests.
  Update manifest tool lists/permissions directly; every instruction sentence
  in a manifest is sourced by reference to the compiled executor contract,
  never copied policy or claimed generated text. Give executor agents the specific
  Cadence query/apply tools needed for those operations, keeping role/model
  routing unchanged. The coordinator collects actual owner answers and
  attestations, including separate custom-check classifications and dead-launch
  absence attestations, then passes the exact returned prompt to the selected agent;
  it does not reconstruct the task list or approve evidence for the owner.
  A refusal/Unknown is displayed and retained, not converted into completion.
  Preserve the existing review handoff without claiming delivered findings
  mean repairs completed. Inspect the skills' generation path and the
  manifests' direct metadata changes, contract references and permissions;
  runtime/model conduct remains O1. Reason for T5: the host must use the
  resumed task list it received. Reason for T7: the host must pass the
  binary's prompt unchanged and have the tools that prompt requires.

### Observation

- **P12-O1 — observation; associations T2, T5 and T7; source O1.**
  The owner runs `/cad-execute` for a real phase in a real host against
  an explicitly initialized disposable project, sees the executor receive a
  dispatch the binary composed from state naming its admitted checks, sees
  a task close come back refused in the conversation because a check has
  no red commit, sees the same task close after the executor commits the
  failing test and then the passing implementation, stops the session
  after that task, and on resume sees the executor handed only the
  remaining tasks. Whether the executor obeys the red-first and
  named-command instructions without being told twice is the model's and
  is not asserted.
  Specification approved by the owner 2026-09-10 in phase-12 CONTEXT.md.
  Item reason: actual host/model conduct cannot be established by deterministic
  stdio checks. Reuse the exact same non-association definition from Plan 2.
  **Pending; not yet seen.** This is the same item as Plan 2, not another
  observation or a check. Association reasons: T2's refusal and corrected
  close must be seen in the conversation; T5's resumed executor must receive
  only remaining work; T7's real host must pass the binary-composed dispatch.
  Nothing here claims the executor obeys the guidance. No result, observer
  or observation time is invented. Phase 13 owns its verdict and cap.

## Tasks

### Task 1: Continue only unfinished tasks from acknowledged history

- **Files:** `crates/cadence/src/execution/history.rs`,
  `crates/cadence/src/execution/dispatch.rs`,
  `crates/cadence/src/execution/render.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/next_action/continuation.rs`,
  `crates/cadence/src/next_action_service.rs`,
  `crates/cadence/src/execution/boundary.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/tests/phase12_execution.rs`.
- **Action:** Deliver P12-T5-C, P12-T5-L and P12-A-CONTINUATION. Write C5
  first. Move native continuation authorization ahead of any active-dispatch
  replay that could evade a Stop; keep historical response replay distinct
  from authorization to execute it now. Build a linked resumed attempt from
  confirmed events and include only unfinished tasks in its executable
  task/allocation sections. Preserve completed work as history without
  scheduling it. Require explicit owner reconciliation of commit-without-
  progress uncertainty. Integrate existing checkpoint answers and scoped
  authorization, never treating restart or old report prose as approval.
  Prevent the old `RepairSuite`/rerun-plan suggestion from authorizing a
  same-plan native suite rerun; new gap admission follows D-120. Do not add
  review-fix continuation. Trace the actual outgoing C5 value for its link.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_continuation_dispatches_only_unfinished_tasks -- --exact`
  reports one pass with actual restarted dispatches containing only the
  handwritten unfinished task lists and immutable completed history.

### Task 2: Compile the executor role and command policy

- **Files:** `crates/cadence/src/execution/mod.rs`,
  `crates/cadence/src/execution/instructions.rs` (new),
  `crates/cadence/src/execution/admission.rs`,
  `crates/cadence/src/main.rs`,
  `skills/cad-executor-contract/SKILL.md`, `skills/cad-execute/SKILL.md`.
- **Action:** Deliver P12-A-ROLE and the command-policy portion of
  P12-A-PROMPT. Copy the design's Executor block verbatim into compiled Rust
  and retain its classical default without a style eligibility gate. Add
  the precise native admission/task/run/close instructions, owner-attestation
  limit and named-command/one-suite rule, including the single confirmed
  result-free relaunch and external-shell/wrapper boundary. Explain D-109's
  reported-failure versus red-eligibility rule, the separate owner classification
  for Unknown custom check runs, and D-112's operator-attested absence claim;
  neither owner record changes the binary observation class. Use the existing
  effective config result for command proposal provenance; require exact
  approved commands at admission/run, with explicit precedence and an
  unknown-language warning requiring an explicit command. Do not add a
  language guessing mechanism, arbitrary instruction override or new preset
  catalog. Following the existing `PlanInstructions` pattern, create the
  project-free `executor-instructions` binary entrypoint: its default output
  is the executor contract; a selector renders the execute frontdoor from
  the same source. This new entrypoint is a creation specification, not an
  existing symbol. Generate both Markdown artifacts with file-writing tools
  from the binary's output; no second handwritten authority. The two rendered
  paths are exactly `skills/cad-executor-contract/SKILL.md` and
  `skills/cad-execute/SKILL.md`, as amended D-115 requires. Agent manifests
  are directly edited metadata adapters in Task 5, not renderer outputs.
  No task-skill artifact or lease is added. No hook files or registrations
  are changed.
- **Verify:** `cargo run -p cadence --bin cadence -- executor-instructions`
  exits 0 without opening a project and emits the substantive compiled
  contract containing the verbatim Executor block, classical default and
  D-111/D-112 limits. Inspect P12-A-ROLE; rendered Markdown is not C7.

### Task 3: Compose and retain the actual executor dispatch

- **Files:** `crates/cadence/src/execution/instructions.rs`,
  `crates/cadence/src/execution/dispatch.rs`,
  `crates/cadence/src/execution/render.rs`,
  `crates/cadence/src/execution/boundary.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/tests/phase12_execution.rs`.
- **Action:** Deliver P12-T7-C, P12-T7-L and complete P12-A-PROMPT. Write C7
  first using handwritten fixture values and instruction text. Extend the
  binary's native dispatch path with admitted check specifications and
  task allocation, current confirmed state, retained commands/lease and
  compiled instructions. Delimit authored plan prose; do not load policy
  from a skill file or caller override. Retain native prompt/protocol version
  and identity for exact replay and bind fresh composition to the same
  snapshot/attempt as the dispatch write. Leave historical prompt length/
  codec reconstruction on its historical path, never as native fallback.
  Keep completed state out of executable tasks while displaying useful
  history. Preserve existing route choice and model selection. Trace the
  admitted-check handoff in the same C7 dispatch; no renderer-only test or
  Markdown assertion substitutes for it.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_dispatch_contains_admitted_checks_state_and_instructions -- --exact`
  reports one pass comparing actual dispatches with approved records,
  handwritten instructions and reopened state, including exact replay.

### Task 4: Gate suite completion and retain its one confirmed relaunch

- **Files:** `crates/cadence/src/execution/runner.rs`,
  `crates/cadence/src/execution/history.rs`,
  `crates/cadence/src/execution_runner_service.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/rail/receipts.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/tests/phase12_execution.rs`.
- **Action:** Deliver P12-T6-C and complete P12-A-SUITE. Write the one C6
  before implementing suite eligibility, launch or completion gating. Use
  actual marker commands, real task closures, process death and public
  operator confirmation. Make the retained suite command available only
  after every task is acknowledged, persist its launch claim atomically,
  and require its observed passing result before native plan completion/report.
  Retain repeatable named task commands during work, including explicitly
  named lint/typecheck; never infer a suite from CI or caller output. Native
  completion requires both its suite receipt and existing exact risk
  settlement, whichever arrives first, without changing old phase-7 receipts.
  Retain exit disposition, launch/result timestamps, bounded stdout/stderr
  bytes (64 KiB each), their separate digests, capture-completeness flags and
  committed material for every run regardless of class.
  Use exactly C2/C6's finite recognized lines: cargo `test result:`, or
  Python `Ran N tests` (singular allowed) plus `OK`/`FAILED (...)`. A terminated
  run is `results observed` only with recognized vocabulary; everything else
  is Unknown, even complete custom output. There is no binary `no results`
  class and no inferred arbitrary-output grammar. Keep reported failure
  distinct from red eligibility using Plan 2's receipt gate: unittest needs
  failures above zero and errors zero; errors above zero are never red;
  cargo `test result: FAILED` with failing disposition is red-eligible with
  its cause left to inspection. Unknown custom checks use the separate
  exact owner classification record for red/green eligibility, never an
  inferred result or a rewritten binary class. Retain Unknown launches on
  restart, with no invented result time.
  Implement the operator's confirmation as a typed apply operation naming
  the dead launch id and the attributed/timed operator attestation over its
  retained bytes that no test results were produced, saved as its own record
  beside the launch. Refuse the confirmation when the launch is
  `results observed`; accept it for an Unknown dead launch subject to its
  exact identity and the one-confirmed-relaunch budget per admitted plan.
  Consume that budget atomically and preserve both launch histories. The
  truth of the absence claim is the operator's attestation shown with the
  bytes, never a binary finding; do not rewrite the original Unknown.
  Include C6's terminated custom-output Unknown control and its accepted
  Unknown confirmation beside refused recognized-result confirmations. Requests
  replay their confirmed launch/result receipt rather than spawning; a
  competing caller cannot consume the exception twice. Keep all results
  readable after reopen. A suite with a recognized failing test result leaves the
  plan incomplete; a new request id cannot rerun it. Exercise the real
  approved gap extension for a
  failed suite and show its new identity alongside unchanged original
  failures, task completions and receipts. No external-shell interception,
  wrapper parsing, unlimited retries or CI-based plan closure is delivered.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_runner_retains_task_commands_and_one_suite -- --exact`
  reports one pass with exact marker counts, task/suite ordering, Unknown
  retention, one confirmed exception and unchanged original gap history.

### Task 5: Connect the Claude frontdoor to the native task protocol

- **Files:** `crates/cadence/src/execution/instructions.rs`,
  `crates/cadence/src/server.rs`,
  `skills/cad-executor-contract/SKILL.md`, `skills/cad-execute/SKILL.md`,
  `agents/cad-executor.md`, `agents/cad-executor-low.md`,
  `agents/cad-executor-medium.md`, `agents/cad-executor-xhigh.md`,
  `agents/cad-executor-max.md`, `crates/cadence/tests/mcp.rs`.
- **Action:** Deliver P12-A-HOST and finish P12-A-ROLE's two generated skills.
  Update compiled frontdoor instructions and regenerate exactly
  `skills/cad-executor-contract/SKILL.md` and `skills/cad-execute/SKILL.md`
  after the public protocol is complete. Edit the five agent manifests'
  metadata/tool lists and permissions directly; they are adapters, not
  entrypoint outputs. Keep every manifest instruction sourced by reference
  to the compiled executor contract rather than copying or generating policy
  into a manifest. Pass the actual returned
  prompt unchanged to the configured route/agent/model, allow agents the
  exact Cadence query/apply tools required for task events and runner use,
  and keep owner attestations/Stop/continuation answers as actual coordinator
  round trips. Collect Unknown custom-check classifications and dead-launch
  absence attestations through their distinct typed apply operations; show
  the retained bytes and owner interpretation separately from binary class.
  Replace the obsolete whole-plan-patch-only and suite-before-
  final-task wording. Preserve existing review handoff, but never interpret
  a delivered review as completed fixes. Update the existing mcp skill/tool
  compatibility test's obsolete permissions/step-count expectations;
  remove Markdown-policy-content assertions as acceptance subjects because
  C7 now observes the real dispatch. Keep metadata/tool permission regression
  assertions. Carry P12-O1 as pending with all three associations; do not
  run cad-execute against this repository or claim the host observation from
  stdio tests. Delete no hook or registration and deliver no parked slice.
- **Verify:** `cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact`
  reports one pass for the two generated skills' metadata and the five
  directly edited agent adapters' contract references and tool permissions;
  inspect P12-A-HOST's distinct generation and metadata paths. O1 remains
  pending and C7 remains the sole dispatch-content check.

## Notes

The ordinary successful plan has one suite launch/result. The only exception
is the owner's one confirmed relaunch of a launch with no test results;
history keeps both and never describes Unknown as a completed run. Commands
run through a separate shell or inside wrappers remain outside T6's claim.

Keep phase-12 promises scoped to these seven truths. The amended ROADMAP at
the baseline already assigns hook retirement to phase 13; no roadmap or hook
edit is needed. Per-item verdicts, status derivation, observations' cap,
verifier dispatch, review-fix continuation and all other parked work remain
with their owning phases. No change to original approved context is allowed.
