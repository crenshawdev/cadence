# Phase 5: The evidence record and what comes next - Context

Gathered: 2026-09-06
Feeds: /cad-plan 5

## Scope boundary

In: Durable records for checkpoint type, current task and exact Need (E24),
checker verdicts and revision outcomes (E37-E38), operator answers at gates
(E65), one reasoned override contract covering the four existing spellings,
and evidence references on contracted results. Next-action selection reads
those records and the existing observations it needs. The pause replacement
preserves guarded WIP commits, a committed resume record, clean completion
and the matching-phase resume offer (E30). This is the phase 4 handoff at
`.planning/phases/4/CONTEXT.md:17` and `.planning/ROADMAP.md:527`.

Out: Phase 6 owns the public tool boundary and its end-to-end execute slice
(`.planning/ROADMAP.md:582`). Consume phase 4's bounded lifecycle answer;
do not reopen or extend it. No new lifecycle statuses for pauses or gate
outcomes, no widening of the lifecycle memo's input claim, and no override
of derivation/state conflicts. Phase 4 D-01, D-03, D-04 and D-05 remain
authoritative (`.planning/phases/4/CONTEXT.md:48`,
`.planning/phases/4/CONTEXT.md:117`, `.planning/phases/4/CONTEXT.md:128`,
`.planning/phases/4/CONTEXT.md:153`). Frozen `cadence-core/` remains unchanged.

The E-number vocabulary comes from the 70-row audit at
`.codex-analysis/phase-4-evidence-set.md:159`; its findings are carried forward,
not reopened. The planner's source tables are B1-B5 in
`.codex-analysis/phase-5-context-analysis.md:94`: normal routing inputs already
have disk sources; E24, E37-E38 and E65 require new records for continuation.

Deferred: None within this phase; the public boundary remains phase 6's work.

Plan shape: multiple plans, same phase; record types land before the selector that reads them, mirroring phase 4's three-plan ordering (`.planning/phases/4/CONTEXT.md:36`); this is a recommendation for `/cad-plan 5`, not a PLAN.

## Durable decisions

- D-01 (An authored next-action oracle): AC5 supersedes the wording at
  `.planning/ROADMAP.md:576` on evidence. The phrase "for every state the
  golden harness covers" has no current referent; treating it as an empty
  set would allow vacuous parity to pass. Commit `7d64c4c9`,
  `refactor(2): drop the goldens, keep the fixtures`, deleted
  `crates/cadence/tests/golden.rs`,
  `crates/cadence/tests/golden/normalization.json`,
  `crates/cadence/tests/golden/operations.json`,
  `crates/cadence/tests/golden/record.mjs` and the whole
  `crates/cadence/tests/golden/recordings/` tree. The exact accounting is
  160 deleted files (156 recordings plus four harness files) and the removal
  of the golden-drift job from `.github/workflows/test.yml`: 161 comparison/CI
  paths. The commit also changed Cargo.toml and Cargo.lock, for 163 changed
  paths overall. The 17 surviving fixture bundles are inputs with no
  expected-answer side.

  The substitute oracle is the nine frozen first-match rules at
  `cadence-core/workflows/progress.md:188`, enumerated in B1. Author states
  that exercise every rule as the winner and every adjacent-rule precedence
  pair, with expected answers derived from that prose. Reusing the surviving
  fixture bundles alone, or reviving internal CLI recordings as the meaning
  of this criterion, was rejected. The roadmap wording was superseded on
  evidence, not overlooked; the required routing behavior is preserved.
  Evidence: `.planning/phases/2/SUMMARY.md:61`;
  `.codex-analysis/phase-5-context-analysis.md:193` and
  `.codex-analysis/phase-5-context-analysis.md:202`;
  `cadence-core/workflows/progress.md:194` through
  `cadence-core/workflows/progress.md:202`. If wrong: a green parity claim
  can contain no next-action comparisons, or a later planner can restore an
  obsolete internal-operation contract instead of testing this selector.
- D-02 (One override contract, preserved authority): Rerun, checker bypass,
  paused Next and recorded review overrides share one durable record
  contract carrying a reason and the work it authorizes. Preserve each
  spelling's meaning rather than reducing all four to an unscoped permission
  bit. A review settlement retains its trigger, plan scope when applicable,
  both range endpoints, finding-record relationship and authorization
  identity. One answer covering two ranges remains two range receipts with
  the shared identity; that identity does not widen either receipt. Bypass
  records an exception to a result, never changes a failed result into a
  pass. Keeping four unrelated authorization contracts was rejected because
  restart would still require spelling-specific rules; discarding their
  scope in consolidation would change what already-recorded answers permit.
  Evidence: `.planning/ROADMAP.md:550`; E35, E41-E42;
  `cadence-core/workflows/execute.md:25`;
  `cadence-core/workflows/plan.md:29`;
  `cadence-core/references/triage-gate.md:105` and
  `cadence-core/references/triage-gate.md:120`;
  `crates/cadence/src/store/model.rs:59`. If wrong: consolidation loses a
  recorded reason or grants permission over work or a range the operator
  never authorized.
- D-03 (Override lifetime is the work occurrence): An override survives
  restart while its named work occurrence remains pending. Once that
  occurrence is fulfilled or superseded, its history remains but its
  permission does not; later work needs a fresh answer. Preserve the
  historical settlement of an already-settled review range. The owner
  rejected both phase-long permission and mandatory renewal merely because
  the process restarted. Work identity therefore distinguishes repeated
  occurrences instead of treating a phase number as perpetual permission.
  Evidence: `cadence-core/workflows/execute.md:25`;
  `cadence-core/workflows/plan.md:29`;
  `cadence-core/references/triage-gate.md:111`;
  `.codex-analysis/phase-5-context-analysis.md:236`. If wrong: a later run
  silently inherits an old exception, or a restart needlessly asks again for
  permission already given to the still-pending occurrence.
- D-04 (Pause keeps its git guarantee): A dirty-tree pause stages exactly
  the in-flight work and makes a guarded WIP commit, writes and commits the
  resume record, and finishes with a clean tree. The resume record may be
  committed separately or folded into the WIP commit. A clean-tree pause
  skips the WIP commit but still commits its resume record. Preserve the
  included git guard's branch, base and commit-side obligations, and offer
  resume through progress. The owner rejected a durable local note that
  leaves work uncommitted. Store durability alone cannot replace preservation
  of the work and resume record in git. This retains the frozen guarantee;
  it does not invent an all-or-nothing transaction across git commits.
  Evidence: E30; `skills/cad-pause/SKILL.md:21`,
  `skills/cad-pause/SKILL.md:26`, `skills/cad-pause/SKILL.md:48`;
  `cadence-core/references/git-guard.md:8` and
  `cadence-core/references/git-guard.md:22`;
  `crates/cadence/src/store/writer.rs:291`;
  `.planning/ROADMAP.md:561`. If wrong: pause reports success while the work
  or resume record can still disappear when uncommitted state is discarded,
  or it creates a preservation commit without the required guard decision.
- D-05 (The pause sentence is an action): Preserve the operator's exact
  one-line sentence and offer it back as its own resume action even when it
  is not a recognized command. A matching current phase gives it the first
  routing position; a different-phase pause is context only. Selecting the
  sentence does not authorize its invocation without acceptance of the
  offer. The owner rejected requiring a recognized action at pause time or
  making selection of a different concrete action a prerequisite to the
  resume offer. Retain the sentence's phase and original provenance through
  compatibility intake; do not erase it when retiring the old lifecycle
  assertion. Evidence: `skills/cad-pause/SKILL.md:38`;
  `cadence-core/workflows/progress.md:194`,
  `cadence-core/workflows/progress.md:206` and
  `cadence-core/workflows/progress.md:233`;
  `.planning/phases/4/CONTEXT.md:175`. If wrong: an ordinary instruction
  cannot be resumed as written, or a stale pause takes priority over work in
  the actual current phase.

## Decisions

- D-06 (Changed checked material invalidates permission): A changed plan
  needs a fresh check or an explicit recorded override before continuation
  relies on a checker verdict. The old verdict remains history but stops
  authorizing continuation over changed checked material. Preserve what the
  checker examined so that historical and currently applicable results can
  be distinguished. The owner rejected retaining the last verdict as
  authority until someone happens to rerun the checker, or asking whether to
  reuse it without a fresh check or recorded override. This does not refund
  the one permitted revision when inputs change or a process restarts.
  Evidence: `cadence-core/workflows/plan.md:407`;
  `cadence-core/references/plan-revision.md:30`,
  `cadence-core/references/plan-revision.md:34` and
  `cadence-core/references/plan-revision.md:65`;
  `.planning/ROADMAP.md:556`;
  `.codex-analysis/phase-5-context-analysis.md:250`. If wrong: an old pass
  approves material the checker never examined, or repeated edits reopen an
  otherwise exhausted revision loop.
- D-07 (Recover the actual checkpoint): Record the checkpoint type, current
  task number and name, and exact Need as a pending fact scoped to the work
  occurrence, phase and plan/report it interrupts. Completed-task rows do
  not identify the uncommitted task or the requested answer. After restart,
  recovery uses the record without conversation and retains its unresolved
  or resolved disposition. A suite-red checkpoint retains the failing-output
  reference and does not acquire an operator gate it did not previously
  require. Evidence: E24; `skills/cad-executor-contract/SKILL.md:213` and
  `skills/cad-executor-contract/SKILL.md:270`;
  `cadence-core/workflows/execute.md:442` and
  `cadence-core/workflows/execute.md:455`; `.planning/ROADMAP.md:570`.
  If wrong: a restart repeats or skips the pending task, loses the exact
  question, or unnecessarily asks for permission on a suite-red continuation.
- D-08 (Record what the checker decided): Preserve the actual verdict and
  findings, including severity, location and fix, and distinguish pass/fail,
  blockers, warnings and an unusable return. Retain which check occurred,
  its checked material, the initial versus revision result, the blocker list
  under reconsideration and whether the single permitted revision is spent.
  A closed trace bracket establishes that the check ran, not its verdict.
  Warnings alone do not become blockers or spend the revision; freshness
  after changes is the separate D-06 rule. Evidence: E37-E38;
  `cadence-core/workflows/plan.md:412`,
  `cadence-core/workflows/plan.md:417` and
  `cadence-core/workflows/plan.md:427`;
  `cadence-core/references/plan-revision.md:34` and
  `cadence-core/references/plan-revision.md:65`. If wrong: a bracket becomes
  a false pass, a warning stops work, or conversation loss refunds a revision.
- D-09 (An answer belongs to its question): Record the pending question,
  exact Need/options, work scope, the operator's actual response and its
  disposition. An unanswered gate remains unanswered; lack of a recorded
  answer cannot imply consent. Persist an answer before continuation relies
  on it. A selected suggestion is not itself authorization to invoke work;
  retain the acceptance or stop decision. Evidence: E65;
  `cadence-core/workflows/execute.md:448`;
  `cadence-core/references/plan-revision.md:65`;
  `cadence-core/workflows/progress.md:233` and
  `cadence-core/workflows/progress.md:257`; `.planning/ROADMAP.md:539`.
  If wrong: restart repeats an answered gate, applies an answer to a different
  question or advances past a question nobody answered.
- D-10 (Acceptance needs evidence): An accepted contracted result carries
  at least one relevant evidence reference: a commit SHA, file and line, or
  criterion ID. Refuse one carrying none. A result tag or arbitrary evidence
  string alone does not establish support. The existing Missing/Null/Text
  evidence field is storage capacity, not satisfaction of this contract.
  Evidence: `.planning/ROADMAP.md:556`;
  `crates/cadence/src/store/model.rs:13` and
  `crates/cadence/src/store/model.rs:69`. If wrong: a syntactically accepted
  pass is authoritative without identifying anything a later reader can
  inspect to substantiate it.
- D-11 (Consume the bounded lifecycle): Selection uses phase 4's lifecycle
  answer plus separate continuation and routing observations. Pauses and gate
  outcomes remain outside the four lifecycle statuses and the lifecycle
  memo's claimed inputs. Neither an override nor a hold suppresses a
  derivation/state conflict. Intake retains the pause's exact Next while
  retiring its old lifecycle assertion. Evidence: phase 4 D-01, D-03, D-04
  and D-05 at `.planning/phases/4/CONTEXT.md:48`,
  `.planning/phases/4/CONTEXT.md:117`,
  `.planning/phases/4/CONTEXT.md:128`,
  `.planning/phases/4/CONTEXT.md:153` and
  `.planning/phases/4/CONTEXT.md:175`. If wrong: a lifecycle cache falsely
  certifies gate settlement, or an override conceals contradictory evidence.
- D-12 (Use acknowledged store durability): The existing binary-owned store
  owns these new facts. Continuation relies on a record only after its
  durable write is acknowledged; a worker return, scratch file or best-effort
  trace is insufficient. Snapshot data and decision history already provide
  places to hold pending state and outcomes; their generic fields do not
  supply the new domain contracts by themselves. Preserve the lifecycle memo
  and unrelated imported provenance when recording new facts. Evidence: E31;
  `.planning/phases/3/CONTEXT.md:74`;
  `crates/cadence/src/store/model.rs:69` and
  `crates/cadence/src/store/model.rs:89`;
  `crates/cadence/src/store/writer.rs:86`;
  `crates/cadence/src/store/filesystem.rs:207` and
  `crates/cadence/src/store/filesystem.rs:225`;
  `.planning/phases/4/CONTEXT.md:193`. If wrong: acknowledged routing facts
  disappear after restart or a snapshot update destroys existing resume data.
- D-13 (Preserve the nine first-match answers): The normal suggestion uses
  the frozen order: matching paused cursor; lowest planned phase; lowest
  executed phase named in outstanding; lowest executed phase; current
  unplanned; nonempty or unreadable deferred queue; phase-dir drift; closed
  cycle; null current. Keep each exact answer and its parameters from B1.
  Planned/executed rows scan all phases in numeric order. Acquire effective
  workflow.skip_discuss for the unplanned alternative. Queue triage remains
  a distinct answer, never an instruction to land, and an unreadable queue
  is not empty. These observations supplement lifecycle; they do not enlarge
  its memo. E24/E37-E38 concern the selected work's continuation, and E65
  records the answer authorizing the suggestion. Evidence: E17-E20, E24,
  E37-E38, E55-E56, E65;
  `cadence-core/workflows/progress.md:188`,
  `cadence-core/workflows/progress.md:204` and
  `cadence-core/workflows/progress.md:225`;
  `.codex-analysis/phase-5-context-analysis.md:102`. If wrong: selection
  misses unfinished work elsewhere, verifies undispatched gap plans, or
  opens a new cycle before queue triage or an interrupted close is resolved.

- D-14 (The gate reviews authored material, never the binary's own receipts):
  The commit-side risk gate reads the material a person or a model authored. It
  does not read the store's own records of what happened. `items.jsonl`,
  `decisions.jsonl` and `state.json` (`crates/cadence/src/store/model.rs:9-11`)
  are receipts the binary writes, they live inside the working tree
  (`crates/cadence/src/store/filesystem.rs:48`), and they are transaction
  participants on every write
  (`crates/cadence/src/store/writer.rs:328-333`), so reviewing them means
  recording the review dirties the tree that was just reviewed and the gate
  never terminates. They fall outside the read by this rule rather than by
  three more filename entries, so a later store participant is covered without
  a second ruling. The owner rejected a storage destination outside the git
  participant set, which would change the store protocol and widen the file
  lease to solve what precedent already answers, and rejected disabling the
  gate. Accepted cost, stated: a destructive command quoted inside an operator
  answer or pause note reaches `decisions.jsonl` ungated
  (`cadence-core/bin/lib/risk-diff.mjs:150`). That is the cost already accepted
  for reviewer text, and the gate exists for destructive CHANGES rather than
  destructive QUOTES. Evidence: the identical loop is documented and already
  solved once for four filename shapes under `.planning/phases/` at
  `cadence-core/references/risk-surface.md:37-42`, whose stated reason is a
  docs commit landing a finding that quoted a destructive command and
  "re-tripped the very gate that produced the finding". Ruled by John,
  2026-09-07, on the PLAN-4 task 3 checkpoint. If wrong: a destructive change
  smuggled into a store record commits without review.

## Acceptance criteria

- [ ] AC1: Kill the process while it is stopped at a checkpoint. A fresh
      process reads the checkpoint type, the current task's number and name,
      and the exact Need from disk, with no conversation (D-07, D-12; E24).
- [ ] AC2: After restart, a recorded checker result reads back with its
      pass/fail disposition, distinguishes blocker from warning from an
      unusable return, and states whether the one permitted revision is
      spent (D-06, D-08; E37-E38).
- [ ] AC3: After restart, an operator's answer at a gate reads back with
      its question and its disposition. A gate nobody answered still reads
      as unanswered (D-09, D-12; E65).
- [ ] AC4: One override record contract represents rerun, checker bypass,
      paused Next and review overrides. Each carries a reason and survives
      restart; review range receipts and authorization identity are
      preserved. The override stops authorizing once its named occurrence is
      fulfilled or superseded, while its history remains (D-02, D-03).
- [ ] AC5: Next-action selection returns the frozen table's answer for an
      authored state set exercising each of the nine rules' winning
      conditions and all eight adjacent-rule precedence pairs. For each
      pair, with earlier rules inapplicable and both adjacent conditions
      matching, the earlier rule wins. Expected answers come from
      `cadence-core/workflows/progress.md:194` through
      `cadence-core/workflows/progress.md:202`, not the selector under test
      (D-01, D-13).
- [ ] AC6: Pausing a dirty tree makes a WIP commit subject to the git
      guards, commits the resume record, and leaves the tree clean. On a
      matching phase, resume offers the operator's exact sentence as its
      own action, including a sentence that is not a recognized command
      (D-04, D-05; E30).
- [ ] AC7: An accepted contracted result carries at least one evidence
      reference: a commit SHA, `file:line`, or criterion ID. Submitting a
      result carrying none is refused (D-10).

## Flagged assumptions

None - all assumptions confirmed.
