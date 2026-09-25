---
phase: 12
plan: 2
requirements: [T2, T3, T4]
files:
  - crates/cadence/src/execution/mod.rs
  - crates/cadence/src/execution/model.rs
  - crates/cadence/src/execution/tests.rs
  - crates/cadence/src/execution/history.rs
  - crates/cadence/src/execution/receipts.rs
  - crates/cadence/src/execution/runner.rs
  - crates/cadence/src/execution/boundary.rs
  - crates/cadence/src/execution/patch.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/src/execution_runner_service.rs
  - crates/cadence/src/evidence/checkpoint.rs
  - crates/cadence/src/evidence/gates.rs
  - crates/cadence/src/evidence/persistence.rs
  - crates/cadence/src/evidence_service.rs
  - crates/cadence/src/rail/risk.rs
  - crates/cadence/src/rail/receipts.rs
  - crates/cadence/src/rail_service.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/tests/phase12_execution.rs
---

# Phase 12: Execution and tasks - Plan 2

## Goal

Close a native task only against observed red/green evidence for its admitted
checks and exact owner no-subject-stub attestations. Retain task attempts,
progress and checkpoints durably, so stopping the server cannot discard
acknowledged work.

## Must be true when done

- T2. When a task closes without a red commit followed by a green commit
  for every check it delivers, the caller is refused completion with each
  unsatisfied check identified.
- T3. When a task closes without an affirmative no-subject-stub attestation
  for a delivered check, the caller is refused completion with that check
  identified.
- T4. When execution stops after acknowledged task progress, the owner sees
  that progress in the retained task and checkpoint history after restart.

## Context

Depends on PLAN-1.md; execute sequentially because the public, writer and execution seams share files.
D-109, D-110, D-111 and D-113 bind receipts, allocation, attestation and progress; D-112 supplies observed command provenance.
`TaskOutcome::Completed`, `CommandReceipt` and `validate_evidence` presently carry no check revision or red/green run provenance.
Reuse phase 7's `Checkpoint`, `Gate`, immutable evidence history, exact Git/lease observations and risk-pending retention.
D-122 preserves historical codecs and review handoff; SUMMARY, recall, cad-task, correction, pre-commit clearance and verdicts remain parked.

## Evidence map

T2, T3 and T4 are the owner's approved 2026-09-10 truths. The common real
fixture, Git discipline, public setup, handwritten oracle and reopened-byte
rules in Plan 1 apply to every check here. All three functions are new in
`crates/cadence/tests/phase12_execution.rs`; helpers have no separate test
attribution. Check calls use the new strict native task operations advertised
by the actual binary's query/apply schemas. These are extensions to the
public path, never in-process calls to the service under test.

### Retained result classification for C2 and C6

The binary retains the exit disposition, up to 64 KiB of stdout bytes and
64 KiB of stderr bytes, a digest of each retained byte sequence, capture-
completeness flags, and observed launch and result timestamps. The launch
timestamp belongs to the claim recorded before spawn; an unobserved result
has no invented result timestamp. Classification inspects only these retained
bytes, on either stream, using this finite named set of complete output lines:

- Cargo/libtest: a complete line beginning `test result:`.
- Python unittest: a complete `Ran N tests` summary line (also `Ran N test`
  for the singular case, with the usual optional ` in ...` timing suffix),
  where N is a decimal count, plus a complete `OK` or `FAILED (...)` line
  from the same run. Both Python summary and outcome are required.

For a terminated run the binary has exactly two classes: `results observed`
and Unknown. `results observed` requires the cargo line or the Python pair.
Everything else is Unknown, including a terminated custom command with
complete captures but no recognized vocabulary, or a partial Python pair
without a cargo result. There is no binary `no results` class. A pending
launch with no confirmed result remains Unknown; never invent its result
timestamp. Retain raw bytes, per-stream digests, disposition, timestamps and
committed material for every run regardless of class. No traceback,
arbitrary assertion text, compiler diagnostic, wrapper command or exit code
alone is inferred to be a result or evidence that no results were produced.

`results observed` with a failing disposition is a reported failure, not
automatically a behavioral red. For Python unittest it is red-eligible only
when the reported `failures` count is above zero and `errors` is zero; an
omitted count in a valid summary is zero. Any `errors` above zero is a failed
attempt, never red, including a `setUp()` error before the test body. A
summary that cannot attribute an assertion failure does not gain red
eligibility merely by being recognized. Cargo's `test result: FAILED`
cannot distinguish the cause, so with a failing disposition it is
red-eligible and the cause stays inspection under D-109. Recognized passing
results use the observed successful disposition for green eligibility.

A custom check whose output has no recognized vocabulary stays Unknown.
It becomes red-eligible or green-eligible only through a separate owner-
attributed classification record bound to the run, its output digest and
the check item revision, retained beside the bytes like D-111's attestation.
Use an output identity that binds both retained stdout/stderr digests; retain
each stream's bytes and digest as well. The record supplies the owner's
interpretation and attribution/time, not replacement output or a binary
classification. The wire keeps binary observation and owner interpretation
distinct, and Unknown is never rewritten to `results observed`. The required
observed failing/successful disposition, ordered commits, unchanged test
material and separate no-subject-stub attestation still apply. An executor's
assertion, stale digest/revision or owner record for another run is insufficient;
an owner classification cannot bypass a recognized unittest `errors` result.

For D-112, the operator's relaunch confirmation is a typed apply operation
naming the dead launch id and attesting over its retained bytes that no test
results were produced. Retain it as its own attributed/timed record beside
the launch. The binary refuses it when the launch is `results observed`
and accepts it for an Unknown dead launch, subject to the single confirmed
relaunch per admitted plan and matching identity. The truth of that absence
claim is the operator's attestation shown with the bytes, never a binary
finding; the launch remains Unknown. This record is distinct from a custom
check's red/green classification and from its no-subject-stub attestation.
C6 uses exactly these retained evidence and classification rules.

### T2

- **P12-T2-C — check.** File `crates/cadence/tests/phase12_execution.rs`,
  function `phase12_task_close_requires_red_then_green`.
  Setup: a real native approved plan has an explicitly allocated check on
  task A and another on task B; an additional case gives A two checks so a
  refusal must identify every unsatisfied check in its admitted set. Give
  each relevant check a valid owner attestation through the real operation
  to isolate this gate. Use a tiny committed Python subject and a real
  `unittest` test: for example `answer()` initially returns 6 while the
  handwritten assertion requires 7. The test file and named command are
  committed before the red run. Invoke that exact command through Cadence's
  runner at the red commit; expect a real assertion failure, exit 1 and the
  handwritten `6 != 7` failure. Commit only the subject correction, keep the
  test bytes unchanged, run the same command at the descendant green commit,
  and expect exit 0 and a passing real test. Use that signed green commit as
  the designated completion commit, with the red evidence commit beside it.
  Call: echo the retained allocation at task start, request observed runs,
  then submit task close through `cadence_apply`. Restart and read actual
  history/receipts through `cadence_query` and the reopened store.
  Expected property: close accepts this real pair once and retains both
  exact commits, test-material identity, command, ordered run references,
  stages, exit dispositions, output digests and bounded actual output.
  Assert the launch/result timestamps, the exact bounded stdout/stderr bytes
  and their separate digests, and the finite classification above: the real
  Python red has `Ran 1 test` and `FAILED (failures=1)` lines and failing
  disposition: failures is one and omitted errors is zero, so it is red-eligible;
  the green has `Ran 1 test` and `OK` and successful disposition. The
  handwritten `6 != 7` assertion is inspected output, not another recognized
  runner signal. A terminal custom or pre-unittest setup-failure output without
  recognized vocabulary is Unknown even with complete capture. No caller
  label changes that binary class. Add these controls inside this SAME C2:
  a real unittest whose `setUp()` raises before its test body produces
  `Ran 1 test` and `FAILED (errors=1)` with a failing disposition. It is
  `results observed` and a reported failure, but never red-eligible; close
  refuses that check even with otherwise valid commit/material/owner evidence.
  Trigger that setup exception from the red subject's state and fix only
  the subject for the descendant green run, keeping test/setup code unchanged
  so no material-mismatch refusal masks the red-eligibility rule. The test
  body writes a unique marker; assert it is absent for the setup-error run.
  Keep the missing-script pre-run failure too. For a custom check, commit an
  unchanged handwritten command/test that calls the tiny subject, prints
  `answer: expected 7, received 6` and exits nonzero at its red commit, then
  prints its own success text and exits zero at the descendant green commit
  after only the subject is fixed. Neither run emits the recognized vocabulary.
  Both remain Unknown with their exact observed bytes, digests, dispositions,
  timestamps and committed material. Task close refuses the red/green pair
  without owner classification; classifying only one run still refuses the
  other. Submit exact owner-attributed red-eligible and green-eligible records
  through the public typed apply path, each binding its run's output digest
  and check revision; the pair now permits close with the separate valid
  no-subject-stub attestation and all other gates satisfied. Refuse changed
  digest, stale revision, another run's record and executor-only classification.
  Reopen/replay and assert original Unknown observations and separate owner
  interpretations remain distinct on the wire and in stored bytes. Neither
  record manufactures a missing run or retroactively changes its observed exit.
  Each missing/invalid pair instead returns `status: refused`, the receipt
  rule and every unsatisfied admitted check id/revision; no task closes and
  protected bytes stay identical. Cases in this SAME function include no
  evidence; only red; only green/already green; same commit twice; reverse
  or unrelated ancestry; stale revision; changed test bytes; an unresolvable
  hash; commits without recorded runs; output/exit fields supplied by the
  executor without runner receipts; a run at a different commit; dirty
  source at run time; and a real setup/tool failure without a test result.
  Keep setup/tool failure as failed-attempt evidence, never behavioral red.
  Check missing A bindings cannot be hidden by borrowing B's pair or by a
  caller-supplied shortened list. Shared aliases resolve to their one owner.
  Exercise red evidence paths as well as the completion commit against the
  lease: a real out-of-lease evidence commit refuses, including both sides
  of a rename. No report/lockfile exemption is introduced.
  Positive empty-allocation task closure needs no fabricated check receipt;
  it still obeys signed completion, named verification and source/risk
  policy. Replaying an acknowledged close returns its original receipt;
  a new request id cannot close that task again. A malformed replay cannot
  overwrite accepted evidence. Read commits and source bytes from real Git
  after reopening, not from the caller's submitted hashes alone.
  Boundary: real public operations, runner child, Git, store and filesystem;
  fakes only clock/caller inputs. Command:
  `cargo test -p cadence --test phase12_execution phase12_task_close_requires_red_then_green -- --exact`.
  Item/association reason: the real behavioral red and green defeat a
  hashes-only or caller-exit-code gate; invalid closes cause T2's trigger.
- **P12-A-RECEIPTS — artifact; association T2.** New `execution/receipts.rs`
  and native records beside the existing `execution/model.rs`/`patch.rs`
  types bind admitted check revisions to exact committed test material,
  command and binary-observed runs. Inspect real ancestry/order, unchanged
  test material at both trees, immutable run provenance, result-stage
  classification, output retention bounds/digests and one signed designated
  completion commit with separately scoped evidence commits. A failed
  setup, compiler or launcher is retained but is not a behavioral red;
  nonzero exit alone cannot establish that a test ran. Use only the finite
  cargo/Python output-line classifier specified above with retained bytes,
  per-stream digests, capture completeness and launch/result timestamps.
  Distinguish reported failure from red eligibility: unittest needs failures
  above zero and errors zero; any reported errors remain a failed attempt.
  Cargo `test result: FAILED` with failing disposition is red-eligible with
  its cause left to inspection. Unknown custom runs require separate exact
  owner classification bound to the output digest and check revision for
  either red or green eligibility; retain that record beside the unchanged
  observation. There is no binary absence finding or `no results` class.
  Inspect that task close obtains its expected set from admission, never
  `Criterion` text or the submitted completion list. Reason: D-109 requires
  both reproducible trees and observed execution, without claiming semantic
  verification.
- **P12-A-RUNS — artifact; associations T2 and T4.** New
  `execution/runner.rs` and `execution_runner_service.rs` retain a launch
  claim before starting the child and an observed result afterward. Bind
  request, occurrence, admitted set, plan, task, attempt, selected named
  command, command role, committed tree and sequence. Acknowledged/replayed
  requests never start another child; no result after a crash means Unknown.
  The binary owns cwd, child lifecycle, stdout/stderr capture and receipt
  creation, including timestamps, bounded per-stream bytes/digests and the
  two-class observation above; caller-supplied output is not a runner result.
  Unknown custom output stays available for separate owner classification;
  that interpretation never changes the binary class or observed disposition.
  Refuse dirty
  source for evidence runs, capture material before launching and recheck
  it after observation so ambient HEAD changes cannot rewrite provenance.
  Runtime output markers live outside tracked source or in explicitly
  ignored fixture output locations; they do not authorize ignoring source
  dirt. Named task commands may repeat during repair. Suite eligibility and
  its single exceptional relaunch are completed in Plan 3, not enabled here.
  Reason for T2: commits need observed run provenance. Reason for T4: launch
  and result durability cannot depend on an executor process remaining alive.

### T3

- **P12-T3-C — check.** File `crates/cadence/tests/phase12_execution.rs`,
  function `phase12_task_close_requires_owner_no_stub_attestation`.
  Setup: use real approved native tasks and real valid red/green pairs as
  in C2, so receipt validity cannot mask attestation refusal. Each check's
  exact item revision, test material and run/evidence references are known
  from handwritten fixture content and observed commits.
  Call: close through the public native operation with attestation absent,
  then false, then affirmative but bound to an old revision, different test
  material or different inspected evidence. Also submit the executor's own
  boolean assertion without an owner record. Each refuses with the
  attestation rule and the delivered check identified; none changes the
  admitted set, progress or saved receipts after exit/reopen. A positive
  control submits the owner's affirmative statement, attribution, time and
  exact inspection evidence through the public owner-attestation path, then
  closes the same task. Reopen and compare the exact owner record and its
  bindings with that submitted material; expect one confirmed completion.
  Replayed owner submissions retain their original receipt and provenance.
  Include a two-check task with just one attestation to ensure the gate uses
  the admitted set, and an explicit no-check task needing no invented owner
  check statement. False/stale attestation records themselves remain honest
  retained inputs; the subsequent refused close cannot mutate them.
  Expected property: only affirmative exact owner records satisfy this
  record gate. The test does NOT assert detection of mocks or decide whether
  the owner told the truth. Boundary: real public owner and close operations,
  runner, Git, store and filesystem; fakes only clock/caller inputs. Command:
  `cargo test -p cadence --test phase12_execution phase12_task_close_requires_owner_no_stub_attestation -- --exact`.
  Item/association reason: this causes missing/false/stale owner attestation
  at close and observes the located refusal, the honest D-111 promise.
- **P12-A-ATTESTATION — artifact; association T3.** The native receipt/history
  types and public owner-attestation operation retain attributed, timed,
  exact check-revision/test-material/evidence inspection statements. Inspect
  explicit owner origin and approved payload binding; an executor assertion
  or a self-assigned role string is not equivalent owner evidence. Use the
  existing owner-approval/authorization pattern, with the host collecting
  actual owner input; this is no new identity-provider or mock-analysis
  system. Superseding statements append with provenance instead of editing
  old records. The public description and Plan 3's compiled role explain
  that the binary validates the record, not the semantic truth of it.
  Reason: the owner deliberately chose this weaker, inspectable gate.

### T4

- **P12-T4-C — check.** File `crates/cadence/tests/phase12_execution.rs`,
  function `phase12_acknowledged_progress_survives_restart`.
  Setup: real approved native plan with tasks A, B and C; close A with actual
  valid run/commit/owner evidence, start B, acknowledge partial B progress
  and a phase-7 checkpoint, retain a raw deviation and a failed attempt.
  Use the real public task/checkpoint operations and wait for their confirmed
  acknowledgments. Call: stop/kill the actual server after those replies,
  reap it, reopen filesystem/store, launch a fresh server and read its real
  task and checkpoint history. Expected property: A remains completed once;
  B retains the exact progress, attempt linkage, deviation, failed result
  and checkpoint/question/answer identities; C remains unstarted. Compare
  handwritten event order/content and original receipts, not a count or a
  report rendered from the same projection.
  In this same check, exercise a lost reply by sending a progress request,
  observing its confirmed on-disk record without consuming the reply, then
  killing/reopening and replaying its id. Expect the original receipt and
  no duplicate event. A new id cannot complete A again. Retain a launch with
  no result across death and expect Unknown, never success. Use a real child
  handshake/marker to coordinate death, not an injected runner or writer.
  Give a checkpoint an explicit Stop answer, restart and read that same Stop;
  restart itself adds no acceptance. A task commit with no acknowledged
  progress remains visible as uncertain and requires reconciliation rather
  than being silently completed or hidden. Refused stale-version, conflicting
  replay and duplicate-close calls leave protected bytes unchanged after
  reopen. Boundary: actual public operations, process stop/restart, child,
  Git, checkpoint store and filesystem; fakes only clock/caller inputs.
  Command:
  `cargo test -p cadence --test phase12_execution phase12_acknowledged_progress_survives_restart -- --exact`.
  Item/association reason: only killing the real server after acknowledged
  work and reading retained history tests T4's durability outcome.
- **P12-A-PROGRESS — artifact; association T4.** New
  `execution/history.rs`, task-progress/checkpoint integration in
  `execution_service.rs` and `evidence_service.rs`, and writer/intent records
  retain immutable task events within named, linked attempts.
  Inspect event identity, expected version, confirmed receipt, raw authored
  fields and the separate current-state projection. Reuse
  `evidence::persistence::history` and existing Checkpoint/Gate semantics;
  do not overwrite an answered Stop to manufacture a later approval.
  Continuation uses an explicitly authorized successor answer/checkpoint
  with the original retained. Readback returns raw history and uncertainty,
  not new truth status or the parked SUMMARY table. Reason: task progress
  must survive independently of a final whole-plan executor patch.
- **P12-A-MATERIAL — artifact; associations T2 and T4.** Native material
  adapters beside `validate_commits_blocking`, `attach_commit_paths`,
  `ExecutionBasis`, `risk_material` and `finalize_execution` preserve signed
  completion validation, ancestry, all-parent/rename path observations,
  staged reobservation and `lease::covers` with zero exemptions. Include the
  evidence commits in the applicable material without changing old receipt
  encodings. Keep exact phase-7 fire/consequence/risk-pending semantics and
  original admission-version bases across gap extensions. Acknowledged task
  facts remain retained when plan settlement is risk-pending. Reason for T2:
  extra evidence commits cannot evade source policy. Reason for T4: pending
  settlement cannot erase accepted progress. This consumes the existing rail;
  it does not re-truth it or add pre-commit permission.

### Observation and links

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
  stdio checks. Reuse the exact same non-association definition in Plan 3.
  **Pending; not yet seen.** One item, repeated with the same identity and
  specification in Plan 3, with three association reasons: T2 needs the
  owner to see the missing-red refusal and corrected closure; T5 needs the
  resumed executor to receive only remaining tasks; T7 needs the actual host
  to hand over the binary-composed dispatch. Deterministic checks do not
  establish host/model conduct. No observation date, observer or result is
  invented; phase 13 owns verdicts and the observation cap.

T2-T4 name no particular value crossing between two things, so they have no
link evidence. Receipts and checkpoints are artifacts, not invented links.

## Tasks

### Task 1: Introduce immutable native task and receipt records

- **Files:** `crates/cadence/src/execution/mod.rs`,
  `crates/cadence/src/execution/model.rs`,
  `crates/cadence/src/execution/history.rs` (new),
  `crates/cadence/src/execution/receipts.rs` (new),
  `crates/cadence/src/execution/boundary.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/src/execution/tests.rs`.
- **Action:** Deliver the record/storage portions of P12-A-RECEIPTS,
  P12-A-ATTESTATION and P12-A-PROGRESS. Add explicit native encodings alongside
  the old whole-plan `TaskOutcome` and `CommandReceipt`; never upgrade old
  receipts by filling defaults. Bind every event to the immutable admission,
  plan/task, named attempt and expected version, with a confirmed idempotent
  receipt. Separate raw events from current projection. Extend the existing
  writer's operation and intent validation, preserving one writer, journal
  confirmation and byte-exact recovery. Define positive completion as an
  atomic close event referencing validated evidence, never an editable
  `completed` field. Retain pending/failed/Unknown facts without granting
  completion. No native close may escape via the legacy executor patch.
  Include a separate owner-classification record shape binding a run's output
  digest and check revision; keep its attribution/time and red/green
  interpretation distinct from binary observations and no-subject-stub records.
  Add `native_task_records_replay_confirmed_events` as one new unit test
  through the production native writer operations and a real temporary store.
  Append a linked attempt, launch/result, owner statement, owner classification
  bound to the run's output digest/check revision, and partial progress
  from handwritten unit inputs; close/reopen and replay each request. Expect
  the same confirmed receipts, exact original event bytes, separate current
  projection and no invented completion. Changed-payload replay and stale
  task version must refuse without changing the original records. Exercise
  the new intent/recovery record shapes, not only their serde round trip.
- **Verify:** `cargo test -p cadence --lib execution::tests::native_task_records_replay_confirmed_events -- --exact`
  selects one passing new unit test of all new event families, durable replay
  and stale/conflicting input refusal; it fails without the new operations.

### Task 2: Observe named task commands with durable launch claims

- **Files:** `crates/cadence/src/execution/mod.rs`,
  `crates/cadence/src/execution/runner.rs` (new),
  `crates/cadence/src/execution/receipts.rs`,
  `crates/cadence/src/execution/history.rs`,
  `crates/cadence/src/execution_runner_service.rs` (new),
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/src/execution/tests.rs`.
- **Action:** Deliver P12-A-RUNS and P12-A-RECEIPTS's observed-run portion.
  Add public native task start, named-command launch and result/history
  operations. Task start echoes and validates the admitted allocation.
  Select commands from the admitted task; do not execute caller replacement
  text. Persist launch before spawn, then persist only the binary's observed
  result: exit disposition, launch/result timestamps, bounded stdout/stderr
  bytes and separate digests, and capture-completeness flags. Implement
  exactly the finite cargo `test result:` line and Python `Ran N tests`
  (including singular) plus `OK`/`FAILED (...)` pair specified above. For a
  terminated run, recognized vocabulary yields `results observed`; everything
  else is Unknown, including custom output with complete captures. There is
  no binary `no results` class. Preserve the finite summary's reported
  outcome and unittest failures/errors counts separately from red eligibility:
  a recognized failing summary is a reported failure, not by itself red.
  Parse no additional runner grammar. Retain the raw observation even when
  an owner later classifies an Unknown check run; never rewrite its class.
  Refuse dirty evidence source and
  reobserve commit/material after the run. Commands have null stdin by
  default; clippy consumes no stdin. Keep long-running children outside the
  resident's serial request wait so polling, Stop and replay can proceed;
  process ownership must last beyond one request without creating a second
  writer. Lost replies/replays cannot launch twice, and server death cannot
  turn a launch claim into success. Suite launches remain unavailable until
  Plan 3 installs their lifecycle. C2/C4 will exercise this actual runner;
  do not add a separate runner check for those truths.
  Put the production task-start/launch/result core in the leased execution
  library modules and have the binary service adapt that same core, so the
  new unit `native_runner_claims_before_spawn_and_replays_once` can exercise
  it without a duplicate runner. Use a real temporary store/repository and
  a real controlled child that observes its persisted claim before writing
  its unique marker. While the child waits on a handshake, a read/poll must
  complete; afterward verify committed material, task/command identity,
  timestamp order, exact output bytes/digests and the finite classifications.
  Include a terminal custom output classified Unknown and a recognized
  unittest `FAILED (errors=1)` reported failure without asserting red eligibility.
  Replay the launch and expect one marker, then refuse a caller replacement
  command and dirty material without another child. No schema-only assertion
  can satisfy this unit. C2/C4 remain the sole public acceptance checks.
- **Verify:** `cargo test -p cadence --lib execution::tests::native_runner_claims_before_spawn_and_replays_once -- --exact`
  selects one passing new unit test that observes claim-before-spawn, live
  polling, bound results and exactly one real child under replay.

### Task 3: Record exact owner inspection attestations

- **Files:** `crates/cadence/src/execution/receipts.rs`,
  `crates/cadence/src/execution/history.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/src/execution/tests.rs`.
- **Action:** Deliver P12-A-ATTESTATION's public path. Accept attributed,
  timed owner inspection input bound to the exact approved payload, check
  revision, material and evidence. Persist affirmative, negative and
  superseding statements honestly with receipts and history; only a matching
  affirmative owner record can satisfy a later close. Keep an executor
  assertion distinct and never promote it because it says `no_stub: true`.
  Reject stale/ambiguous provenance with located detail, preserve original
  records on replay, and advertise the gate's limited claim. This task
  stores inspection evidence; Task 5 installs the atomic close decision.
  Keep the owner-input validation/storage core in the leased execution
  library modules, shared by the public service and the new unit
  `native_owner_statements_bind_exact_inspection`. Through production native
  operations, persist negative then superseding affirmative exact-owner
  inputs in a real temporary store and reopen/replay their receipts. Compare
  handwritten attribution, time, approved payload, revision, material and
  evidence. Reject absent approval, executor-origin promotion, changed
  approval payload and stale material without mutating earlier statements.
  Assert only the exact affirmative owner input is eligible for later close.
- **Verify:** `cargo test -p cadence --lib execution::tests::native_owner_statements_bind_exact_inspection -- --exact`
  selects one passing new unit test of owner origin, exact inspection binding
  and confirmed statement replay, rather than unchanged tool-schema shape.

### Task 4: Bind all evidence commits to existing source and risk material

- **Files:** `crates/cadence/src/execution/receipts.rs`,
  `crates/cadence/src/execution/patch.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/rail/risk.rs`,
  `crates/cadence/src/rail/receipts.rs`,
  `crates/cadence/src/rail_service.rs`,
  `crates/cadence/src/execution/tests.rs`.
- **Action:** Deliver P12-A-MATERIAL. Reuse actual Git observations from
  `validate_commits_blocking` and staged/path readers, extending their native
  adapter to evidence commits beside one designated signed completion
  commit. Validate every applicable parent diff and both rename endpoints;
  refuse unrepresentable paths and changed staged observations. Keep
  `lease::covers` the sole coverage rule and preserve zero exemptions.
  Retain exact native material with its original set/dispatch basis so a
  later extension does not make old risk receipts appear stale solely by
  rekeying their identities. Consume `ExecutionBasis`, `risk_material` and
  `finalize_execution` through explicit native adaptation, preserving old
  encodings and phase-7 fire/consequence requirements. Keep acknowledged
  task progress distinct from pending plan settlement; Plan 3 additionally
  requires the plan's suite receipt before native completion. Do not change
  review settlement, add pre-commit clearance or render a new SUMMARY table.
  Factor the new native Git/material observation core into the leased
  `execution/receipts.rs` for reuse by the service adapters and the new unit
  `native_material_includes_scoped_evidence_commits`; do not copy Git logic
  into the test. In a real temporary Git repository with the required per-
  call identity/signing overrides, observe a red evidence commit beside a
  signed completion, then an evidence-only out-of-lease edit and a rename
  with an undeclared endpoint. The latter two must refuse even when the
  completion commit itself is in scope. Observe an actual changed index
  between material reads and require refusal. For valid material, confirm
  that the native risk adapter includes both evidence and completion commits
  and retains the original admission basis across a set extension. Use
  actual Git observations and reopened retained data, not synthetic path lists.
- **Verify:** `cargo test -p cadence --lib execution::tests::native_material_includes_scoped_evidence_commits -- --exact`
  selects one passing new unit test of real evidence-commit scope, both rename
  endpoints, staged reobservation and native risk-basis preservation.

### Task 5: Refuse task close without observed red and green evidence

- **Files:** `crates/cadence/src/execution/receipts.rs`,
  `crates/cadence/src/execution/history.rs`,
  `crates/cadence/src/execution/patch.rs`,
  `crates/cadence/src/execution/boundary.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/tests/phase12_execution.rs`.
- **Action:** Deliver P12-T2-C and complete P12-A-RECEIPTS's close gate.
  Write C2 before the atomic close path. Build actual tiny-subject red and
  green commits/runs and obtain
  owner inspection through the public operation. Do not use synthetic SHAs,
  fake subprocesses or direct state insertion. A close reads its expected
  check set from immutable admission, validates every pair against current
  material, validates source/commit policy and
  then appends one confirmed task completion. Return all unsatisfied check
  identities with located rule details; a refusal preserves protected bytes.
  Retain bounded stdout/stderr bytes, their digests, launch/result timestamps
  and committed material regardless of class. A failing `results observed`
  run is a reported failure: unittest is red-eligible only with failures
  above zero and errors zero, while any errors above zero remain a failed
  attempt; cargo `test result: FAILED` with failing disposition is red-eligible
  and its cause stays inspection. Add C2's actual `setUp()`-raises control,
  which reports `Ran 1 test` and `FAILED (errors=1)` and must refuse as red.
  Keep that control's test/setup bytes identical across its real red/green
  commits so the refusal isolates reported errors, not changed test material.
  Implement the public owner-classification apply operation and confirmed
  record for Unknown custom check runs, binding owner attribution/time, run,
  output digest and check item revision. Require an exact red/green
  interpretation matching the observed failing/successful disposition;
  neither missing/stale nor executor-only classification permits closure.
  Keep observations and owner interpretations separate on the wire and in
  storage, with immutable replay; never relabel Unknown as observed results
  or let this path override a recognized unittest errors result. Add C2's
  real custom failing/passing command control, refused without both owner
  records and accepted with them plus the other existing gates. This supplies
  explicit-command custom-check eligibility without inferring arbitrary output.
  Keep completed-task replay distinct from a fresh duplicate close and
  preserve phase-7 risk-pending retention. No full-plan native completion is
  available before Plan 3's suite gate. Task 6 adds the independent owner
  attestation refusal to this same atomic close path; do not claim the
  complete native close contract until both gates are installed.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_task_close_requires_red_then_green -- --exact`
  reports one pass for C2, with actual red/green runs, located unsatisfied
  checks and byte-identical retained records after each refusal.

### Task 6: Require exact affirmative owner attestation at task close

- **Files:** `crates/cadence/src/execution/receipts.rs`,
  `crates/cadence/src/execution/history.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/execution/boundary.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/tests/phase12_execution.rs`.
- **Action:** Deliver P12-T3-C and complete P12-A-ATTESTATION's close gate.
  Write C3 first, using valid actual red/green evidence so the new refusal
  is caused only by the owner record. Resolve every delivered check from
  admission and require an affirmative owner attestation bound to its exact
  revision, test material and inspected evidence in the committing snapshot.
  Refuse absent, false, stale or executor-only statements with the check
  identified. A matching owner record permits the same task's close once;
  preserve all original statements, receipts and progress on refusal/replay.
  Install this condition in the same atomic close operation as the receipt
  gate, including writer/intent revalidation. Do not add mock detection or
  claim semantic verification. The full native close contract now requires
  both independently exercised gates.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_task_close_requires_owner_no_stub_attestation -- --exact`
  reports one pass for C3, with the owner positive control and located
  missing/false/stale/executor-only refusals after reopen.

### Task 7: Retain progress and checkpoint answers across server death

- **Files:** `crates/cadence/src/execution/history.rs`,
  `crates/cadence/src/execution_service.rs`,
  `crates/cadence/src/execution_runner_service.rs`,
  `crates/cadence/src/evidence/checkpoint.rs`,
  `crates/cadence/src/evidence/gates.rs`,
  `crates/cadence/src/evidence/persistence.rs`,
  `crates/cadence/src/evidence_service.rs`,
  `crates/cadence/src/server.rs`, `crates/cadence/src/recall/mod.rs`,
  `crates/cadence/src/store/writer.rs`,
  `crates/cadence/src/store/transaction.rs`,
  `crates/cadence/tests/phase12_execution.rs`.
- **Action:** Deliver P12-T4-C and complete P12-A-PROGRESS/P12-A-RUNS's
  restart behavior. Write C4 first. Expose scoped task progress, checkpoint,
  owner answer and raw-history operations through the existing root-bound
  service/resident; never expose arbitrary snapshot mutation for fixtures.
  Integrate existing Checkpoint/Gate history with named attempts and task
  events, retaining completed work, raw deviations, failures and Unknown
  launches. Enforce expected versions and confirmed request replay. Detect
  real repository work without acknowledged task progress as uncertainty
  requiring reconciliation; do not infer completion from a conventional
  commit subject. Preserve Stop as Stop, with any later authorization an
  explicit linked record. Kill the real server after acknowledged progress
  and after a confirmed event whose reply is lost; reopen and compare
  original bytes/receipts. No rendered report substitutes for raw history.
- **Verify:** `cargo test -p cadence --test phase12_execution phase12_acknowledged_progress_survives_restart -- --exact`
  reports one pass with retained A/B/C state, original checkpoints and
  receipts, lost-reply idempotency, visible uncertainty and Unknown launches.

## Notes

Plan 3 consumes these retained facts for continuation and full-suite
completion. It does not recreate them from SUMMARY or executor prose.
O1 remains pending; neither these checks nor a successful fixture run counts
as the real-host observation. The observation must use an explicitly
initialized disposable project, never this rewrite's live planning tree.
