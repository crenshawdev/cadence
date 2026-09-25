# Phase 13: Verification and audit - Context

Written 2026-09-11 under `docs/architecture/acceptance.md`, on branch
`cadence/binary-owns-process` at HEAD `66221486`. Phase 13 is fifth in the
delivery order 27, 28, 29, 12, 13; all four prerequisites are closed.
It owns verifier dispatch, per-item verdicts and derived acceptance status,
owner waivers, completion authority, the merged review command surface and
read-only verification audit. Research draft:
`.codex-analysis/phase-13-context-draft.md`, sections A to K, read against
this HEAD. Feeds: /cad-plan 13, carrying the design's Planner block;
phase 14's self-hosting decision at this phase's close; phase 18's acceptance gate.

## Scope boundary

In: a retained phase verification attempt composed from current approved
truths, the complete coherent map, execution authority and exact source
material; an independent verification runner; one atomic patch containing
one verdict per canonical evidence item; immutable claims, application
refusals and verdict history; derived met, concerns, unmet and waived
readback; current-input completion authority and its required projections.
Optional attributed human UAT records and a rendered UAT.md preserve human
results and first-pass history. The binary stores and renders verification;
the verifier has no findings-file assignment or document-writing patch arm.

In: `/cad-review` selection by decision, minimalism or plan kind and explicit
target, its three compatibility aliases and target-specific compiled text;
`/cad-audit` and the read-only `/cad-coverage` alias use the same verification
join. Audit labels requirement-to-truth linkage as phase-scoped and reports
missing edges instead of inventing semantic coverage. It never repairs state.

In: one task inside a phase-13 plan, "Make the rendered execution front door
and refusals sufficient to use", covers draft G's pilot findings 2, 3, 4, 5
and 8 together. It documents admission and allocation before execute-next,
positive integer wire phases, retained checkpoint ids and both Stop branches,
completion subject tokens, Git signing environment and exact Inspection
approval. It preserves located lifecycle conflicts and malformed-input
details through the public refusal. Existing rendered-skill and real-stdio
regressions cover it; it creates no additional acceptance check or truth.
Findings 6 and 7 are outside this bounded task.

In at close: D-121 removal of `~/.claude/hooks/rules-gate.mjs` and its
matching registrations after all three operational role dispatches are
binary-composed and installed. Rehearse the explicitly rooted procedure on
disposable settings, then inspect the actual installed bytes and registrations.
Keep recoverable originals; remove only matching commands, preserving sibling
commands, matchers, other event groups and unrelated settings and guards.
Ambiguous or stale inputs refuse; a partial removal is unfinished retirement.
Confirm both targeted absences. Rehearsal is a close artifact, not a truth
or proof of actual installed removal. See D-134 and the durable D-121 clause.

Credited to earlier phases, not re-truthed here: approved truths (11), exact
plan publication (27), typed maps and coherent readback (28), planning
refusals (29), admission, allocations, observed red/green receipts, owner
attestations, task history and execution dispatch (12). Review routing,
providers, original returns and settlement remain phases 9 and 10's subsystem;
phase 13 fires those contracts. The execution runner's task stage is not a
phase verification runner. Share process capture helpers without reopening tasks.

Parked: the eight items below remain with their assigned phases or later
slices. This phase leaves self-hosting readiness, not a live import of the
rewrite's history. Unit-test style and mutation remain the project's stream;
CI is landing information, never acceptance evidence or a verifier launch.
The verifier runs each saved check, never the suite. No coverage percentage,
tests-per-file target, call-site census or replacement tree-gate is introduced.

## Truths

The owner accepted draft I's seven truths and their one check each on
2026-09-11. Test file for every entry:
`crates/cadence/tests/phase13_verification.rs`; these functions are to be built.
Run each later with `cargo test -p cadence --test phase13_verification <function> -- --exact`.
This context authoring does not run those commands.

Common setup: spawn `env!("CARGO_BIN_EXE_cadence") serve --project-root
<fresh disposable project>`, initialize, and call `cadence_query` and
`cadence_apply` through newline-delimited JSON-RPC over stdio. Files, store
queue and journal, Git commits and child check processes are real. Configure
private global config and signing inputs explicitly. Only the clock and
caller's inputs are controlled. No mock store, fake process result, direct
reducer call, model reply or production renderer supplies an expected value.
Handwritten patches exercise caller authority, not the quality of judgment.
Take expected identities from acknowledged public records and check reopened
bytes; handwrite expected statuses, rows and messages. Shut down, reap and
reopen where durability is claimed. Never use the live rewrite or locked fixtures.

Completed-execution fixtures author and approve their context and maps through
public operations, admit, run tiny committed red then green checks, obtain
owner attestations, close tasks and settle suite and risk requirements.
Do not preseed admissions or close receipts. Every accepted check verdict
first obtains an independent public verification-run receipt. Commands stay
narrow; no fixture runs this repository's whole suite. Names of new operations
below are planned public surfaces, not a claim that they exist at this HEAD.

- T1. When a verifier dispatch is issued, the verifier gets a binary-composed prompt containing the phase's current truths, evidence map, execution receipts and exact check commands.
  ONE check: `phase13_dispatch_carries_current_verification_inputs` in the
  common test file. Setup: completed native fixture with two plan
  contributions, check/artifact/link items and a shared artifact, no
  observation. Save public identities and receipts; include misleading
  SUMMARY prose and a conflicting configured test command.
  Call: `cadence_query {operation:"verify-next",phase:N}`; read and replay
  the retained attempt after restart.
  Expected: parse actual outgoing operational JSON and compare the handwritten
  truth/item set, associations, revision vector, digest, recorded pairs and
  owner statements. It carries the saved check commands, design Verifier
  block and strict patch contract, with no findings-file assignment. Replay
  preserves attempt and prompt identity; inconsistent or missing native
  authority refuses dispatch. Compiled instructions and generated role and
  front-door metadata are attached artifacts; installed behavior belongs to 18.

- T2. When a verifier submits a patch that does not match its dispatched evidence, the caller is refused the patch with the mismatched item or input identified.
  ONE check: `phase13_mismatched_verdict_patch_is_refused` in the common
  test file. Setup: a real T1-style attempt and verification-run receipts;
  one complete handwritten valid patch and variants with unknown, missing
  or duplicate items, wrong item revision, stale map digest, wrong truth or
  content version, foreign occurrence/source, phase pass, truth status and
  write-file payload. Change source through a real commit and the phase union
  through approved additional publication for actual stale-input cases.
  Call: `cadence_apply {operation:"verification-submit",patch:...}` for
  each variant and the valid control; replay, conflict the request id and restart.
  Expected: located refusals name requested/current identities and change no
  effective acceptance, completion or UAT. The valid control persists. Exact
  replay returns one acknowledgment; changed payload reuse refuses. Domain
  refusals remain inspectable separately from effective verdicts; no findings
  file appears. No direct store edit or imaginary truth-revision operation is used.

- T3. When a completed verification is read, the owner sees each truth's status derived from all of its current evidence verdicts.
  ONE check: `phase13_report_derives_truth_status_from_every_item` in the
  common test file. Setup: truths with one check and supplementary artifacts
  and links; complete patches for all accepted, rejected artifact, rejected
  shared link and explicit not_seen cases. A separate generic fixture phase
  has a supplementary observation to exercise the cap, outside this phase's map.
  Call: verification-run, verification-submit and verification-read before
  and after restart; also read before completion and after a fresh attempt
  following real repair/revision, retaining the earlier rejected attempt.
  Expected: all accepted without observation yields met; all accepted with
  observation yields concerns; any rejected/not_seen, including observation,
  yields unmet. Before complete verification it is pending. Passing checks
  cannot hide rejected artifacts/links. Shared rows affect every explicit
  association. History preserves reasons and old map/content/source identity;
  current readback names verified-at identities. CI never enters reduction
  and no model-authored aggregate verdict exists.

- T4. When the owner waives a truth with a reason, name and date, the owner sees that truth reported as waived beside the met truths.
  ONE check: `phase13_owner_waiver_is_distinct_from_met` in the common
  test file. Setup: one met and one unmet truth with retained rejection and
  an exact owner waiver for that truth/version. Construct absent, false and
  mismatched approval, missing reason/name/date, stale-version and verifier variants.
  Call: truth-waive, verification-read, restart and replay, with real
  verification-run receipts for accepted checks in the fixture's verdicts.
  Expected: only exact owner approval makes a waiver effective; person,
  reason and date appear beside underlying unmet/rejected history. Waived
  never increases met count. Invalid submissions do not waive, replay stores
  one record and a later verifier patch cannot erase or manufacture it.
  Applicability and completion follow D-126 and D-131.

- T5. When completion is requested with unfinished acceptance work, the owner is refused phase completion with the unfinished work identified.
  ONE check: `phase13_incomplete_verification_cannot_complete_phase` in
  the common test file. Setup: actual plan publication seeds a new requirement
  row Pending; complete execution without verdicts, then current complete
  verdicts with one unmet item, then all accepted using real verification runs.
  Include historical human UAT failure, original first-pass value and
  attributed history, plus a human pass control. Use caller-owned historical
  documents and the public human-result operation for native human input.
  Call: verification-complete at each stage; interleave plan read/publication
  and execute-next; repeat, read and restart. Resolve the human result through
  its authorized path before the fully applicable positive completion control.
  Expected: publication, execution close, partial/stale verification and
  human-conflicting verifier submissions cannot complete acceptance. Refusals
  name remaining evidence/human work. Human bytes and first-pass history stay
  intact until the human update; all accepted evidence cannot overwrite fail.
  Only full completion updates authority and required projections once;
  context approval is unchanged and a query cannot repair completion itself.
  Phase 14 progress and phase 15 undo later extend this same episode through
  their actual operations; no counterfeit progress or undo operation is used here.

- T6. When the owner requests a review of a selected target, the reviewer gets that target with the corresponding decision, minimalism or plan instructions.
  ONE check: `phase13_review_surface_selects_target_and_intent` in the
  common test file. Setup: real decision document, source file/directory and
  two native plan slices; configure existing local delivery, no external
  provider. Supply explicit target kinds and the three alias names.
  Call: merged review-select and its existing review-admit/review-next
  handoff; read retained material for every kind and alias in this function,
  replay and try missing or ambiguous targets.
  Expected: exact requested material and handwritten intent in actual
  dispatch; aliases select the same canonical kind and target. Decision
  refutation, minimalism deletion ranking and plan goal/locked-decision
  instructions appear. Minimalism retains the base reviewer without an
  invented provider/gate; plan retains its configured trigger/gate. Invalid
  targets stop without broadening, and no edits occur. This checks delivery,
  not review or adjudication quality. Provider prompt-fragment parity is a
  supporting compiled-artifact inspection, not a fake provider exchange.

- T7. When the owner audits verification coverage, the owner gets the broken requirement-to-evidence traces with their current verdicts.
  ONE check: `phase13_audit_reports_broken_verification_traces` in the
  common test file. Setup: active requirement without phase, assignment to
  absent phase, known phase with unclaimed requirement, plan with unknown
  requirement, valid native chain with rejected/not_seen evidence and a met
  control. Author actual requirement/roadmap inputs; publish context, maps
  and verdicts over stdio with verification runs. Include superseded map and waiver.
  Call: read-only verification-audit, /cad-audit and the retained coverage
  alias/view through the same query; compare durable before/after snapshots.
  Expected: handwritten breaks name each existing edge and each missing
  edge, applicable verdict and waiver. Label the phase-scoped association;
  never claim a direct requirement-to-truth edge. The valid control traces;
  orphan and unknown requirements remain visible. Structural coverage cannot
  certify rejection, historical evidence cannot count as current met, and
  audit writes no status, map, UAT or store record.

## Parked

- P1. Installed live-host commands and model/review quality: phase 18 owns the live-host acceptance episodes; deterministic checks do not certify model obedience.
- P2. Progress/health/report, why/suggest, diagnostic log content, missing-return handling and read/subagent trace-hook removal: phase 14 owns these surfaces.
- P3. First rewrite phase executed through the binary with import/recovery/rollback: phase 14 is the intended start, with readiness and go/no-go decided at phase 13 close.
- P4. Selected plan-review edits, approved republication and stale-review edit refusal: phase 30 owns the edit loop.
- P5. Truth/version changes and general context/requirement correction: later phase 26 owns them; D-116 decision amendment remains its separately parked execution slice.
- P6. Mechanical SUMMARY, authored deviation/open-item recall, full cad-task and remaining execution lease/fix work: later execution/task slices own D-107/D-117/D-118/D-119 delivery.
- P7. Landing/undo surfaces, CI landing column, ship-gate consumption and forge/deferred effects: later phases 15 and 20/21 or their assigned slices consume this phase's seams.
- P8. Native requirement/roadmap writers, direct requirement-to-truth authoring, advanced UAT repair, constrained runner grammar and style presets: later phases 22/26 or later slices own them.

## Decisions settled with the owner 2026-09-11

The owner accepted every recommendation in draft J. D-123 to D-134 bind in
that order. Operation names may be finalized by the planner without changing
these authority boundaries; no recommendation remains an open owner question.

- D-123 (Submission granularity; draft J1): one atomic complete phase-attempt
  patch contains one verdict per canonical item, with explicit not_seen for
  inspected but unavailable evidence. The binary determines membership and
  completeness; partial patches never advance status. Retain bounded original
  claims, application outcomes and replay identity separately from item verdicts.
  If wrong: omissions silently become passes or partial writes certify a phase.
- D-124 (What verified-at pins; draft J2): pin the full contributing content
  revision vector, exact map digest and observed full HEAD/tree, plus explicit
  index and material identity, bound to project/root, occurrence and attempt.
  Begin with clean committed source and refuse ambiguous dirty verification.
  Revalidate current authority on the committing snapshot and reobserve files
  before confirmation; any later source change makes results historical until
  reverified. If wrong: the report certifies different code or map under one label.
- D-125 (Independent reruns and their runner; draft J3): each saved check is
  rerun through a verification-scoped binary runner selected by item id and
  revision. Retain immutable launch/result/material receipts; replay returns
  its receipt and an unanswered launch remains Unknown. Executor red/green
  history does not replace this run. Never launch the suite or CI; reject
  command substitution and inspect zero-test or vacuous success claims.
  If wrong: old runs or green text replace independent current verification.
- D-126 (Waiver authorship and lifetime; draft J4): an owner-only exact
  approved typed waiver records reason, name and date, truth/version and
  reviewed evidence basis in immutable history. The model may prepare the
  payload but never its approval. Changed acceptance basis needs explicit
  reaffirmation; supersession or revocation is another owner event. Preserve
  rejected evidence and show waivers beside met; several waivers cue "revisit
  the plan". If wrong: a model grants a pass or a waiver silently outlives its basis.
- D-127 (Human UAT ownership; draft J5): retain optional conversational UAT
  through attributed binary records and binary-rendered UAT.md, keeping
  imported human results separately. Preserve replies, first-pass and result
  history; a verifier never overwrites them. Blank reply is not consent, skip
  is not waiver, and SUMMARY never generates acceptance criteria or smoke
  truths. If wrong: verification erases a human failure or invents their approval.
- D-128 (Coverage command compatibility; draft J6): retain cad-coverage as
  a read-only alias to verification coverage/audit over the same records.
  Remove the generation arm and any separate evidence authority.
  If wrong: coverage manufactures tests or competes with the retained map.
- D-129 (Verifier instruction entrypoint; draft J7): provide
  `cadence verifier-instructions [--frontdoor]`, sharing compiled text with
  actual dispatch and generated native verifier/cad-verify artifacts. Carry
  the design's Verifier block verbatim, strict patch schema and role permissions;
  no runtime user override. Debug disk tuning is optional. Extend protection
  to exact binary-owned output paths without claiming control of arbitrary shell.
  If wrong: rendered instructions become a second authority or dispatch stays manual.
- D-130 (Self-hosting start; draft J8): phase 13 does not self-host; phase 14
  is the intended first phase, decided at 13 close. Leave installed compiled
  roles/front doors, the full native path, located refusals, actual check and
  verification results, and an honest audit/status report. Rehearse an isolated
  planning-tree copy, classify imported history and incompatibilities, retain
  backup/restore and interruption/recovery results, and enforce one writer.
  Choose native phase-14 context/plans, human UAT location and delivery-order
  selection explicitly. Confirm hook retirement and identify remaining limits;
  never invent old approvals/maps/reds. If wrong: adoption silently certifies history.
- D-131 (Full completion; draft J9): require all required execution complete,
  complete current evidence, every truth met or explicitly waived, and every
  required human result resolved. Concerns stays incomplete; completion with
  waivers is labelled separately and never raises the met count. Seed only new
  trace rows Pending; commit completion authority and required ROADMAP and
  requirement projections in one confirmed transaction, leaving human UAT
  untouched. Input changes invalidate applicability and lifecycle memo authority.
  If wrong: execution, stale evidence or a human-conflicting result checks a phase box.
- D-132 (Audit trace precision; draft J10): report explicit phase-scoped
  requirement traces with edge origins, limits, current verdicts/waivers,
  unavailable reads and next actions for breaks. Direct requirement-to-truth
  authoring stays parked with requirement/truth revision. Audit never hides
  untraceable active claims, infers semantic edges, repairs status or completes
  a phase. If wrong: a scope join is sold as demonstrated requirement coverage.
- D-133 (Merged review selection; draft J11): require explicit kind plus
  target; retain cad-decision-review, cad-minimalism-review and cad-plan-review
  as aliases. Use `/cad-review decision <document> <decision-id>`,
  `/cad-review minimalism <file|directory|phase>` and
  `/cad-review plan <phase|plan-path>`. Resolve exact material; missing or
  ambiguous selection requests a target and unresolvable targets stop. Add
  selection, shared compiled intent and presentation; preserve provider,
  trigger, roster, return, adjudication and settlement contracts. Decision
  intent reaches local and provider prompts; no fixes apply here.
  If wrong: ambiguous paths change the review question or findings become edits.
- D-134 (Packaging hook retirement; draft J12): use a small explicitly rooted
  reviewed close procedure, rehearsed on disposable settings before inspected
  real removal at close. Exercise absent, ambiguous, stale-preimage and partial
  failures; preserve recovery bytes, unrelated settings ordering and guard files.
  Include multiple matching and similar-but-different commands in the rehearsal;
  use real serve/stdio dispatch to establish the compiled prerequisite. No
  owner's HOME test default or general settings-deletion service. Confirm
  actual file and registration removal together. If wrong: rehearsal is called
  retirement or a neighboring guard is removed with the hook.

## Durable decisions that bind this phase

Only consumed clauses of D-80 to D-122 are carried here, quoted from the
phase contexts at `66221486`. Earlier delivery is credited, not reopened.
Phase-27 source: `.planning/phases/27/CONTEXT.md`.

- D-80: "A hand-written CONTEXT.md is not native approval."
- D-83: "A changed allocation needs a fresh preview and approval."
- D-84: "A plan already admitted to execution is never replaced in place; additional work gets a new gap identity, and reconciling execution history is phase 12."
- D-86: "Same id with a different payload is refused."
- D-87: "a native plan record and its request receipts are bound to an explicit phase occurrence within the project cycle, addressed visibly as (phase, plan number)."
- D-88: "a mechanical check prevents a new native publication from being treated as acceptance-ready or dispatched by `execute-next` until phases 28, 29 and 12 land." Its admission boundary is now delivered by D-108, not a provisional-readiness flag.

Phase-28 source: `.planning/phases/28/CONTEXT.md`.

- D-90: "every current truth must have exactly one check in the phase's map."
- D-91: "the typed map is part of phase 27's exact submission, preview and approval, and publishes with the plan in the same transaction; there is no separate attach operation and no map stored without its plan."
- D-92: "A spec change under a stable id is an item revision."
- D-93: "an item may be attached to more than one truth through explicit per-truth associations, each carrying its own reason; a shared observation is one item, never a second check."
- D-94: "Matching text is not matching identity."
- D-95: "The view carries a deterministic digest of its inputs so a verification attempt can be bound to exactly what it read. A read that observes an inconsistent snapshot says so; it never claims coherence across changed inputs. The verifier never reconstructs the expected set from Markdown."
- D-96: "Every item and association carries a reason."
- D-97: "A rejected verdict in a later phase must always be able to point at the evidence it judged."
- D-98: "a replay returns the original result and historical binding without reinstalling it as current, and the same request id with a different item payload is refused."

Phase-29 source: `.planning/phases/29/CONTEXT.md`.

- D-99: "A property is authored text retained for the verifier to inspect; the binary evaluates no predicate language and infers no strength from any nonblank string."
- D-100: "a command is validated as nonblank text and nothing more."
- D-101: "A matched value is permission to publish the link for later tracing, not proof of the handoff."
- D-102: "the domain validation runs against the snapshot the publication transaction commits, never a pre-approval lookup that can go stale (D-98)."
- D-103: "Distinctness is by item id: two checks with identical commands and specs under different ids are two checks, and repeated aliases of one shared definition are one."
- D-104: "D-90's "exactly one check" is met only once both bounds hold, and this context does not reopen D-90."
- D-105: "phase 12's admission must validate the complete required contract rather than infer it from "published"."
- D-106: "Test locator, setup, call, boundary and fakes keep the typed shape phase 28 requires and no nonblank or semantic rule is added to them; an honest "no setup" is not forced into filler."

Phase-12 source: `.planning/phases/12/CONTEXT.md`.

- D-108: "execution-readiness is a fresh validation of the complete current contract against the snapshot the admission write commits, producing either a located refusal or an immutable admission basis; publication alone, phase 29's release, and a readiness field never establish it, as D-105 already requires."
- D-109: "a receipt is both the commits and the observed run. It holds two
  distinct resolvable commit hashes in ancestry order, the check id and item
  revision, the test material and command as committed, the run stage and
  sequence, the exit disposition, an output digest and bounded retained
  stdout and stderr or a durable output reference." Inspect retained Unknown
  classifications too; whether the red failed for the right reason stays inspection.
- D-110: "Each canonical check item revision has exactly one responsible closing task across the admitted plans; a task may deliver no checks explicitly; shared truth associations are allowed; the close never chooses its own expected set."
- D-111: "the gate is an owner attestation, attributed and timed, bound to
  the exact check item revision and the exact test material inspected,
  persisted with the supplied inspection evidence. A task close is refused
  when a delivered check's attestation is absent, false or stale against the
  current material. The binary checks the record, not the truth of it; an
  executor's own `no_stub: true` is an executor assertion and never an owner
  attestation." Phase 13 still inspects the actual subject and fakes.
- D-112: "A launch claim is persisted before the process starts and the result after it is observed; a crash between them leaves the launch Unknown, which is neither success nor a completed run."
- D-113: "Raw acknowledged progress, deviations, checkpoints and failed or Unknown attempts are all retained; the current state is a separate projection."
- D-114: "imported prose is not D-80 native approval, and no native publication or red history may be invented for already completed rewrite work."
- D-116: "when the parked correction slice lands, a D-NN correction is an
  exact owner-approved record naming the phase and decision id, the expected
  current effective-context digest, the plan and attempt provenance and the
  supplied text and evidence. The original `ApprovedContext.submission` and
  its approval stay immutable; a typed correction record is appended and the
  effective decision plus annotation is rendered transactionally, never as
  a suffix the next render erases." That write stays parked; verify cannot perform it.
- D-117: "when the parked SUMMARY slice lands, task ids, order and status,
  completion SHAs, check red/green references, counts and ranges, suite
  disposition and attempt links derive from stored validated facts through
  the existing projection; deviations, open items and the goal assessment
  stay authored, recall-reachable and never evidence of acceptance." These
  fields remain the parked execution projection, not verifier-authored facts.
- D-120: "A shared check is reused only while its exact item, map and truth authority still applies; a changed spec needs fresh receipts."
- D-121: "the deletion therefore moves to phase 13's close, with its registration removed together after inspecting the installed state and preserving unrelated guards". This supersedes the design scaffolding's older phase-12 timing and binds the close deliverable above.
- D-122: "A delivered review result is not proof the selected fixes are complete."

The design's Verifier block is carried verbatim in every verifier dispatch:

**Verifier.** For each evidence item: open it, run it, or trace it. Return a
verdict per item - accepted, rejected or not seen - with what you observed.
A summary is not evidence. An item whose check could not have failed is
rejected, not accepted. You do not set a truth's status; the binary derives
it from your verdicts.

`docs/architecture/acceptance.md`, "Unit tests and CI - settled with the
owner": "The verifier never runs the suite; it runs each truth's one check."
Artifact inspection establishes substance; link inspection traces the named
handoff and consumption. A receiver stub can record what real A hands B
only where the truth requires it, without proving B's downstream persistence
or creating a second check. Observations are attributed episodes capped at
concerns when all evidence is accepted; any rejected or not_seen wins as unmet.
Patch application acceptance only means a valid applicable record was stored.
It never turns its rejected evidence into accepted evidence.

## Observations

None at this phase. Nothing this phase builds can be run live until the binary is installed; the owner's live-host observation for it is held by phase 18, the acceptance gate (see docs/architecture/acceptance.md).

## Flagged assumptions

- At this HEAD, context construction seeds Pending and admission compares
  the entire approved record (`crates/cadence/src/context/persistence.rs:8`,
  `crates/cadence/src/execution/admission.rs:181`). Derive an acceptance overlay;
  never mutate approved truth statuses and break exact publication equality.
- Item revision excludes associations (`crates/cadence/src/plan/map_history.rs:66`);
  an unchanged item hash cannot replace the map digest or publication vector.
- Lifecycle still derives Complete from SUMMARY and UAT
  (`crates/cadence/src/derivation/mod.rs:93`); extend native inputs and memo
  semantics (`crates/cadence/src/derivation/memo.rs:4`) with verdict, waiver,
  human-result and completion authority. Keep historical semantics classified.
- Routing evidence and review originals are distinct from acceptance records.
  Use a separate verification namespace; do not relabel routing Override as waiver.
  Caller names/times are provenance claims, not authentication or observed time.
- Plan seeds only missing Pending rows; execution records execution completion;
  verify alone advances acceptance completion. Supply the invalidation seam for
  later undo and progress: undo invalidates, progress cannot resurrect, fresh
  applicable verification restores. Future operations extend T5 when delivered.
- Projection protection and role permissions constrain known paths and tools;
  retain drift detection and bounded refusal input. Refusal history may append
  while effective acceptance stays unchanged; transport-invalid input has
  transport diagnostics, not a fictional accepted domain record.
- R1 refused: correct model understanding is not a deterministic oracle; check dispatch and records, leaving judgment quality explicit.
- R2 refused: green CI cannot pass a phase or replace evidence; CI is landing information.
- R3 refused: suite success cannot make every truth met while artifacts, links or unseen items remain unresolved.
- R4 refused: the complete installed Claude workflow belongs to phase 18's live-host acceptance, not this phase's close promise.
- R5 refused: discovering a function creates no every-caller coverage obligation or call-graph census.
- R6 refused: a struct containing a digest is internal; the promise is current/historical readback or a located refusal.
- R7 refused: review delivery cannot imply selected fixes or republication; phase 30 owns them.
- R8 refused: progress does not repair every planning document or advance acceptance; phase 14 derives and repairs the cursor, phase 15 owns undo.
- R9 refused: self-hosting cannot approve rewrite history retroactively; phase 14 is the intended start under D-130.
- R10 refused: compile-red is not automatically invalid; inspect missing production code versus setup/tool failure, never treating every nonzero exit as red.
- R11 refused: the binary cannot prevent arbitrary external file writes; typed patches, permissions, protected projections and drift checks have specific limits.
- R12 refused: verify cannot rewrite D-NN decisions or SUMMARY; D-116/D-117 remain parked and truth/version amendment belongs to phase 26.
