# Phase 12: Execution and tasks - Context

Written 2026-09-10 under `docs/architecture/acceptance.md`. Phase 12 runs
now, fourth in the delivery order 27, 28, 29, 12, 13 the owner accepted
2026-09-10 (`.planning/ROADMAP.md`, "Delivery order is not phase number").
Phase 28 supplies typed evidence items attached to approved truths and
published with the plan; phase 29 completes the planning refusals so the map
a task binds to is one the planner was allowed to publish (Layer 2 of the
design is complete at `54baaab9`). This phase owns the executor's side of
the design: a task binds to the checks it delivers, closes only with a red
commit then a green commit per check, and gets its dispatch from the binary.
Research draft: `.codex-analysis/phase-12-context-draft-v2.md` (gitignored),
read against HEAD `b353f09d`; it supersedes the 2026-09-10 morning draft at
`01b0f26e`, all 24 of whose candidates it re-dispositioned. Feeds: /cad-plan
12 (planner dispatch carries the design's Planner block).

## Scope boundary

In: admission of a native plan to execution against a complete required
contract; a typed task-to-check allocation; a task close refused without a
red commit followed by a green commit for every check it delivers; a task
close refused without an owner attestation that a delivered check does not
stub its own subject; durable per-task progress and checkpoint history that
survives a stop and a restart; continuation that hands the executor only the
plan's unfinished tasks; a binary-owned command runner whose history shows
task-named commands while working and one full-suite run after the last
task; and the executor dispatch composed by the binary from state, carrying
the admitted checks, the current task state and the compiled execution
instructions including the classical test-style default. Nothing here sets a
truth's status.

Credited to earlier phases, not re-truthed here: routing checkpoints and
their persistence (phase 7); the risk rail, exact material gates and
risk-pending retention (phase 7); source leases with zero exemptions and
post-commit lease refusal (phase 7, D-32); the review handoff (phase 9);
plan publication and the D-88 admission refusal (phase 27); the typed map,
its readback view and input digest (phase 28); the four planning refusals
(phase 29). This phase consumes and revalidates them; it claims none of them.

Parked to a later execution or task slice, as explicit promises the roadmap
still owes (draft P1 to P10): the SUMMARY's mechanical table derived from
retained receipts; authored deviations and open items reachable through
recall; the execution-time D-NN correction write; the four cad-task truths
(treeless done result, recorded task commits and files, planned task
outcome, refused done on a failed receipt write); pre-commit lease clearance
for an unprovable lease (with D-31's pre-commit delivery parked alongside);
review-fix continuation under a retained publication identity; the
classical guidance as its own truth (it is inspected here as a T7 artifact).

Out: verifier dispatch, per-item verdicts, met/concerns/unmet derivation,
the observation cap, waivers and audit (13); truth text or version changes
and requirement correction (26); plan-review edit persistence and
stale-review refusal (30); issue filing and deferred completion (20, 21);
progress, landing and undo surfaces (14, 15); any host adapter beyond Claude
Code (GH-140, an owner decision outside 4.0). Nothing in this phase deletes
the rules-gate hook; see D-121.

## Truths

At most seven. Each is one trigger, one observer, one outcome. The planner
writes exactly one check per truth. Approved by the owner 2026-09-10.

- T1. When a native plan lacks the required execution contract at
  admission, the caller is refused execution with the missing contract
  identified.
- T2. When a task closes without a red commit followed by a green commit
  for every check it delivers, the caller is refused completion with each
  unsatisfied check identified.
- T3. When a task closes without an affirmative no-subject-stub attestation
  for a delivered check, the caller is refused completion with that check
  identified.
- T4. When execution stops after acknowledged task progress, the owner sees
  that progress in the retained task and checkpoint history after restart.
- T5. When an acknowledged checkpoint is continued, the executor gets only
  the plan's unfinished tasks.
- T6. When a plan completes through Cadence's command runner, the owner sees
  a run history containing task-named commands during work and one
  full-suite run after its last task.
- T7. When an executor dispatch is issued, the executor gets a
  binary-composed prompt containing its admitted checks, current task state
  and execution instructions.

All seven are properties over any submission of the stated kind. Expected
values are the handwritten allocation and receipts, the plan identities and
revisions phase 27 returned, the item ids and revisions phase 28 stored, the
truth records phase 11 stored, and real commits in a real fixture
repository, read back from the reopened filesystem and store after the
server exits; a renderer's own output is not the oracle. A refusal leaves
the admitted set, the retained progress and the saved receipts
byte-identical. T1's check carries its invalid cases inside one function,
including a historical blank-check map and a mapless publication, with a
valid approved native fixture as its positive control. T2's positive control
is a tiny real subject that fails behaviorally at the red commit and passes
at the green commit. T6's claim covers only Cadence's runner: an executor's
separate shell and a wrapper's internal subcommands are outside it.

## Parked

- Whether a check stubs its own subject, decided mechanically. The binary
  can compare ids and strings; it cannot read a test and know that a fake
  writer contradicts a claim of durable storage. T3 is the honest weaker
  form (D-111). A typed subject-and-fake vocabulary or a language-specific
  analyzer would be its own decision with its own truth.
- Self-hosting: running this phase's real `/cad-execute` against
  `/code/cadence/.planning`. This repository has no native store (no
  `state.json`, `items.jsonl` or `decisions.jsonl`), so the first call would
  first-touch import a 30-phase tree that has never been imported. That is
  a deliberate later decision with its own recovery and rollback scope
  (D-114), never a side effect of a fixture.

## Decisions settled with the owner 2026-09-10

Each is the owner's ruling on an open question from the research draft. The
draft's evidence for every option is at the section named. The owner took
the draft's recommendation on every item; D-112 and D-121 carry the
orchestrator's amendments the owner accepted with it.

- D-107 (How much phase 12 promises under seven truths; draft O1): the seven
  truths above are an explicitly scoped execution spine, and the ten parked
  promises are assigned to later execution and task slices as their own
  truths under their own scope. They are not folded in as controls of
  unrelated truths, and the roadmap goal "cad-execute in full and cad-task"
  is not claimed delivered by this phase. If wrong: seven umbrella sentences
  hide twenty-four outcomes, or a parked promise is silently dropped.
- D-108 (What makes a native plan execution-ready under D-88; draft O2):
  execution-readiness is a fresh validation of the complete current
  contract against the snapshot the admission write commits, producing
  either a located refusal or an immutable admission basis; publication
  alone, phase 29's release, and a readiness field never establish it, as
  D-105 already requires. The contract is: native context exists for the
  bound phase occurrence with nonempty approved versioned truths and
  retained slots; every admitted plan identity is a current exact approved
  publication whose content revision, receipt, map event and item
  definitions cross-check, with an attached map and not a historical
  absence or explicit provisional mode; the whole current phase union
  passes phase 28's and phase 29's rules, reusing their pure validators
  rather than faking a publication; the installed PLAN bytes agree with the
  retained content revision; the execution structure is valid (positive
  identities, unique ordered tasks, nonempty named verify commands, a suite
  command, a declared source lease); and a typed delivery allocation
  accounts for every current check exactly once (D-110). Red or green
  receipts and the existence of the named test are not admission
  requirements; red-first development means the test may not exist yet.
  Legacy plans stay separately classified; mixed legacy and native
  ambiguity is refused, never resolved by an escape path. The phase 6 and 7
  lifecycle, one active dispatch, continuation authorization, branch and
  exact risk material gates stay as they are. If wrong: a plan that never
  met the contract runs, or an old blank-check map is grandfathered into
  execution.
- D-109 (What a red/green receipt is; draft O3): a receipt is both the
  commits and the observed run. It holds two distinct resolvable commit
  hashes in ancestry order, the check id and item revision, the test
  material and command as committed, the run stage and sequence, the exit
  disposition, an output digest and bounded retained stdout and stderr or a
  durable output reference. A hash alone does not prove the test existed in
  that commit or that the run failed for the intended reason, and output
  alone has no reproducible tree. Each task keeps one designated signed
  completion commit; its red test commits are recorded beside it as
  evidence commits, which revises the frozen "one commit per task" count,
  and their source scope is validated too. A tool or setup failure is
  retained as a failed attempt, never counted as a behavioral red. The
  test must be present unchanged at red and green; changed test material
  needs a fresh pair. A run is bound to the committed tree it used; a dirty
  tree is refused or separately identified, and the ambient HEAD after a
  dirty run is not provenance. No red is ever manufactured after the fact,
  and an already-green check is never silently waived. Whether the red
  failed for the right reason remains inspection. If wrong: a hash without
  a run, or a run without a tree, is sold as red then green.
- D-110 (How a task names the checks it delivers; draft O4): a typed
  task-to-check allocation is submitted at admission covering every task
  and every current check, echoed and checked at task start. Prose is never
  the authority and the map has no task id to derive from. Each canonical
  check item revision has exactly one responsible closing task across the
  admitted plans; a task may deliver no checks explicitly; shared truth
  associations are allowed; the close never chooses its own expected set.
  Unknown ids, artifact ids, dropped checks, conflicting owners and stale
  bindings refuse admission. Moving the allocation into the plan schema
  later is a separate versioned decision. If wrong: a task closes against a
  set it picked, or a check has no closer.
- D-111 (Which no-subject-stub gate; draft O5): the gate is an owner
  attestation, attributed and timed, bound to the exact check item revision
  and the exact test material inspected, persisted with the supplied
  inspection evidence. A task close is refused when a delivered check's
  attestation is absent, false or stale against the current material. The
  binary checks the record, not the truth of it; an executor's own
  `no_stub: true` is an executor assertion and never an owner attestation.
  This is explicitly weaker than the design's sentence "a check that stubs
  its own subject is refused", and the compiled instructions say so; the
  semantic inspection of what actually ran stays the verifier's under
  phase 13. If wrong: a free-text field is sold as a mock detector, or the
  phase 12 close promise is quietly parked.
- D-112 (Who owns runs, and what once per plan means; draft O6, amended):
  the binary owns the runner for T6. Task commands are selected from the
  retained verify commands and may repeat while a task is being repaired;
  the suite command is available only after the last task is acknowledged
  and before the plan reports complete; lint and typecheck are named
  commands, never unnamed probes. A launch claim is persisted before the
  process starts and the result after it is observed; a crash between them
  leaves the launch Unknown, which is neither success nor a completed run.
  The owner's amendment: a suite launch that produced no test results at
  all (the process died before reporting, as phase 29's linker crash did on
  2026-09-10) may be relaunched once on explicit operator confirmation, and
  the history records both the dead launch and the confirmed relaunch. A
  suite that ran and failed keeps the plan incomplete; repairing it belongs
  to an explicitly linked gap plan under D-84, not a rerun in the same
  plan. Replayed requests return their receipt, not another process. The
  runner cannot see an executor's external shell or a wrapper that runs the
  suite inside a named command; the instructions and O1 say so. CI is not
  the plan-close run. If wrong: a linker crash blocks a phase forever, or
  "once" quietly becomes "until green".
- D-113 (What durable progress and permitted continuation are; draft O7):
  progress is immutable per-task events within named attempts, each with a
  confirmed idempotent receipt, linked attempt ids and explicit checkpoint
  answers. A user Stop is not acceptance to resume. After a stop only
  unfinished tasks continue; a completed task is never scheduled again, a
  new request id cannot complete a completed task twice, and a lost reply
  after a committed event replays the original receipt. A commit found
  without acknowledged progress is a visible uncertain state that needs
  reconciliation, never a blind redispatch. Raw acknowledged progress,
  deviations, checkpoints and failed or Unknown attempts are all retained;
  the current state is a separate projection. Phase 7's routing checkpoint
  records are the base; the work is integrating them with task completion
  and fresh dispatch selection. If wrong: completed work replays, or
  partial progress dies with the process.
- D-114 (Whether phase 12 self-hosts against this repository; draft O8): no.
  This phase's checks run against real native fixtures, and O1 runs
  against an explicitly initialized disposable project. `/code/cadence`'s
  own `.planning` is not a native store, its first-touch import at this
  scale is untested, imported prose is not D-80 native approval, and no
  native publication or red history may be invented for already completed
  rewrite work. Self-hosting is a later deliberate decision with its own
  import compatibility, rollback, recovery and one-writer coordination
  scope. If wrong: a fixture write first-touches the live tree, or the
  rewrite's history is retroactively certified.
- D-115 (What the classical default is and where it lives; draft O9): the
  default is the design's own text - test a unit through what it exposes;
  fake only files, clock, other programs and network; skip trivial code;
  write the expected value by hand - compiled into the executor's Rust role
  source and rendered from there into both the state-composed dispatch and
  the native executor and task skill artifacts. No typed preset catalog
  ships now and no free-text rule override is accepted; a catalog is a
  future decision. Style never changes task eligibility and creates no
  coverage or test-count gate. Named command selection uses the existing
  effective config seams with explicit precedence; an unknown language
  warns and requires an explicit command, never a guessed runner. If
  wrong: a Markdown file becomes a second authority, or style becomes a
  gate the design says it is not.
- D-116 (Who approves and stores a D-NN amendment; draft O10): when the
  parked correction slice lands, a D-NN correction is an exact
  owner-approved record naming the phase and decision id, the expected
  current effective-context digest, the plan and attempt provenance and
  the supplied text and evidence. The original `ApprovedContext.submission`
  and its approval stay immutable; a typed correction record is appended
  and the effective decision plus annotation is rendered transactionally,
  never as a suffix the next render erases. Replay applies it once; a
  stale, missing or ambiguous id refuses. Ordinary deviations request no
  correction; truth text, version and status changes remain phase 26. This
  is stronger than the frozen coordinator ruling and is labelled so. If
  wrong: an approved payload is edited behind its approval.
- D-117 (Which SUMMARY fields are mechanical; draft O11): when the parked
  SUMMARY slice lands, task ids, order and status, completion SHAs, check
  red/green references, counts and ranges, suite disposition and attempt
  links derive from stored validated facts through the existing
  projection; deviations, open items and the goal assessment stay authored,
  recall-reachable and never evidence of acceptance. Observed event time
  and caller-reported time are distinguished. Plan completion is not phase
  truth status and never overwrites UAT. `planning.commit_docs` governs the
  docs commit; publication alone is not a commit. Debt harvest is a later
  integration, not a CAPTURE duplicate. If wrong: the coordinator assembles
  a table the store already knows.
- D-118 (cad-task's lifetime and treeless contract; draft O12): when the
  parked task slice lands, a task has explicit identity, inline or planned,
  under the task executor contract with the phase lease disabled and the
  protected-branch and risk disposition policy kept. Without a planning
  tree the run is ephemeral, facts stay in memory, and the done result
  says the record is unrecorded and states the risk disposition; an absent
  root is classified by the task boundary, never inferred from an
  unrelated ENOENT, and a write failure under an existing root refuses
  done. No phase 0, no global ledger, no implicit filing or config
  persistence; matched risk uses per-run temporary material. Blocking risk
  stays blocked even when unrecorded. If wrong: a treeless task invents a
  home, or swallows a write failure as success.
- D-119 (Source rails; draft O13): D-32's zero exemptions stand and the
  stale phase 12 roadmap wording about report and lockfile exceptions is
  corrected to match. When the parked clearance slice lands, pre-commit
  clearance is a sanctioned round trip binding staged byte identity, plan,
  content, dispatch and lease; it does not commit, repair git or claim to
  intercept arbitrary shell. Both rename sides are covered; an invalid or
  unrepresentable path observation refuses, never normalizes. Patch-time
  revalidation stays. The pairwise overlap computation is removed with the
  concurrency narration; numeric single-plan dispatch stays. Parking
  clearance parks D-31's pre-commit delivery explicitly; post-commit
  refusal is not called equivalent. If wrong: an exemption returns by
  wording, or a lossy path passes the lease.
- D-120 (Gaps, reruns and scope-changing repairs; draft O14): a gap enters
  an admitted execution set only as a new approved plan identity plus an
  explicit versioned extension of the admitted set that preserves every
  completed outcome; an admitted plan is never mutated in place, as D-84
  settles, so the old same-plan new-revision repair no longer exists. The
  publication occurrence stays distinct from the execution set version;
  past receipts are never rekeyed. A shared check is reused only while its
  exact item, map and truth authority still applies; a changed spec needs
  fresh receipts. A rerun is explicitly authorized and visible, never
  inferred from a gap. If wrong: a repair rewrites history, or a rerun
  hides in a gap.
- D-121 (Rules-gate hook deletion; draft O15, amended): deleting
  `~/.claude/hooks/rules-gate.mjs` is a phase-close artifact only when the
  binary composes all three role dispatches the hook guards. The planner's
  is compiled (phase 28), the executor's is T7 here, the verifier's is
  phase 13. The owner's amendment: the deletion therefore moves to phase
  13's close, with its registration removed together after inspecting the
  installed state and preserving unrelated guards; this phase changes the
  roadmap sentence to say so and deletes nothing. If wrong: a protection is
  removed while one dispatch is still hand-assembled.
- D-122 (Compatibility and review side effects; draft O16): this phase
  consumes phase 7's risk rail, exact material, fire and consequence gates
  and risk-pending retention, phase 7's leases and phase 9's review
  handoff as they are, and keeps historical execution encodings and
  receipts readable and replayable without certifying them under the new
  gates. A native or provisional record is never routed through the legacy
  execution path as a fallback; a plan that fails admission is refused, not
  downgraded. Nothing from the frozen execute workflow that another phase
  or decision owns is revived: no parallel worktrees, no trace census, no
  automatic filing, no retired criteria rules; verifier verdicts are 13,
  plan-review edits are 30, filing is 20 and 21. A delivered review result
  is not proof the selected fixes are complete. A host adapter or a
  settlement redesign needs its own scope. If wrong: an old receipt passes
  a gate it never faced, or a failed admission runs under phase 6's rules.

## Durable decisions that bind this phase

Carried verbatim from ROADMAP.md at `54baaab9` except where marked.

- (`.planning/ROADMAP.md`, "### Phase 12") **Owns the executor's side of
  the acceptance design.** For every check a task delivers, the executor
  writes the test first, records the commit where it failed, implements,
  and records the commit where it passed; the binary refuses a task close
  with either missing, or with a check that stubs its own subject. The
  executor runs only what the task names while working and the full suite
  once per plan, at the close. When the project has set no test style it is
  given the classical default as guidance - test a unit through what it
  exposes, fake only files, clock, other programs and network, skip trivial
  code, write the expected value by hand - and nothing about style is ever
  refused or counted. The hook-deletion sentence in the same entry is
  amended by D-121 to phase 13's close.
- (`.planning/ROADMAP.md`, "### Phase 12") **Depends on phases 27, 28 and
  29.** This phase owns the task-to-check bindings and the red/green
  receipts; it does not create check identities of its own. Hook retirement
  follows the state-composed executor dispatch, not partial task-history
  delivery.
- (`docs/architecture/acceptance.md`, the Executor block) **Executor.** For
  each check your task delivers: write the test first, run it, record the
  commit where it failed; then implement, run it, record the commit where
  it passed. Run only what the task names while working. Run the full suite
  once, when the plan's last task is done, before you report. Unit tests
  beyond the checks are yours: test a unit through what it exposes, fake
  only files, clock, other programs and network, skip trivial code, write
  the expected value by hand.
- (`docs/architecture/acceptance.md`, "Verify: a decision, not a count") the
  verifier "Inspects every evidence item for real"; a red/green pair never
  marks a truth met, and the verifier judges every map item including
  artifacts, links and observations. This is the line between what this
  phase records and what phase 13 decides.
- (`.planning/phases/29/CONTEXT.md`) D-99 to D-106 bind as written; in
  particular D-105: "phase 12's admission must validate the complete
  required contract rather than infer it from 'published'".
- (`.planning/phases/28/CONTEXT.md`) D-90 to D-98 bind as written;
  (`.planning/phases/27/CONTEXT.md`) D-82, D-83, D-84, D-86 and D-88 bind
  as written, D-88 being replaced in behavior by D-108's validator and not
  in intent; (`.planning/phases/11/CONTEXT.md`) D-79 binds: the owner
  attests what the binary cannot decide, and D-111 is the same kind of
  honesty about a stub.
- (`.planning/phases/7/CONTEXT.md`) D-31 and D-32 bind as written; D-119
  parks D-31's pre-commit delivery explicitly and corrects nothing else.
- (`.planning/ROADMAP.md:155-158`) **Write, confirm, return.** A write is
  acknowledged only after it is done and confirmed. This RAISES the bar over
  `v3.7.12`, where `planning-files.mjs:2747` deliberately has no fsync and
  the promise is only "never torn". Cost is irrelevant at cadence's write
  rates.
- (`.planning/ROADMAP.md:29-41`) **The model thinking and working** - PLAN,
  CONTEXT, SUMMARY, REVIEW, UAT. Authored prose, read back by humans and
  models. Markdown is correct here and stays. The governing principle for the
  boundary, settled 2026-09-06: **user-facing is what a person reads or acts
  on, not what produces it.**
- (`.planning/ROADMAP.md:64-68`) **Cross-session concurrency**, stated
  plainly rather than half-supported. John's habit is one writer plus
  read-only sessions, so exclusivity is owed on WRITES only and is satisfied
  by construction (phase 3). Do not propose a refuse-to-start guard; it would
  block the readers he actually uses.
- (`.planning/ROADMAP.md:176-183`) **Test what is testable, acknowledge the
  rest, rely on live usage.** Anything with a model in the loop is
  acknowledged as untested rather than scaffolded around. **Write down what
  is knowingly untested.**
## Observations

Evidence a person must see; these cap a truth at `concerns`, never `met`.

- O1. The owner runs `/cad-execute` for a real phase in a real host against
  an explicitly initialized disposable project, sees the executor receive a
  dispatch the binary composed from state naming its admitted checks, sees
  a task close come back refused in the conversation because a check has
  no red commit, sees the same task close after the executor commits the
  failing test and then the passing implementation, stops the session
  after that task, and on resume sees the executor handed only the
  remaining tasks. Whether the executor obeys the red-first and
  named-command instructions without being told twice is the model's and
  is not asserted.

## Flagged assumptions

- At HEAD `require_execution_ready` refuses any phase holding a retained
  native publication regardless of file bytes
  (`crates/cadence/src/plan/persistence.rs:38-50`), called at
  `execution_service.rs:177` and `:1435`; D-108 replaces that blanket
  refusal with a validator, which is real work on the admission path, not
  a flag flip.
- The current `CommandReceipt` has no check id, stage or commit, completed
  tasks carry one commit and generic evidence refs, and `Criterion { id }`
  validates only a string (`crates/cadence/src/execution/model.rs:96-148`,
  `execution/patch.rs:504-518`); T2's receipts are a new typed record keyed
  by project, occurrence, phase, item id and item revision, kept outside
  `Item::Check.spec` and outside the immutable `acceptance_maps` history,
  joined through `map_history::Revision.item_revisions`.
- The map has no task id (`crates/cadence/src/plan/evidence.rs:12-45`), so
  D-110's allocation is submitted, never derived.
- Routing checkpoint records already persist (`execution/patch.rs:100,183`,
  `evidence/checkpoint.rs:27`, `next_action/continuation.rs:95`); T4 and T5
  integrate them with task completion and dispatch selection rather than
  adding a second checkpoint store.
- The compiled planner instructions show the rendering pattern T7 follows
  (`crates/cadence/src/plan/instructions.rs:1-27`); the executor role text
  and the classical default are not yet in Rust.
- `.planning/ROADMAP.md` phase 12 entry still says the hook is deleted "at
  close" and still mentions report and lockfile lease exceptions; D-121 and
  D-119 amend those sentences in this phase's context commit.
