---
phase: 3
plan: 3
requirements:
  - WIR-01
files:
  - cadence-core/workflows/execute.md
  - cadence-core/references/seams.md
  - cadence-core/references/review-triggers.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  - .planning/phases/3/SUMMARY.md
---

# Phase 3: Bounds the review path never stated - Plan 3 (WIR-01, the wiring half)

## Goal

`execute.md`'s recovery arm stops naming a state nothing in the dispatch path
can produce: it names its real producers instead, `seams.md` and the arm agree
in the same words under a standing check, and the `claude-subagent` reviewer
stops standing as the one unbounded path beside a bounded one.

## Must be true when done

- `cadence-core/workflows/execute.md` carries no recovery arm labelled with a
  timeout, and the arm that replaced it names what actually produces the state
  it recovers from.
- That producer wording appears VERBATIM in both
  `cadence-core/workflows/execute.md` and `cadence-core/references/seams.md`, so
  the workflow and the seam reference say the same thing in the same words.
- The recovery behaviour itself is unchanged - read the report file on disk,
  confirm it against `git log`, report the state, ask the user - because the
  defect is the label, not the recovery.
- `cadence-core/references/seams.md`'s `claude-subagent` "is exempt" sentence
  and the parallel statement in `cadence-core/references/review-triggers.md`
  each name that reviewer's own bound, so the exempt-from-`over-cap` contrast no
  longer reads as unbounded.
- A check in `cadence-core/bin/prose-agreement.test.mjs` reddens when either
  document's wording is changed alone, and reddens against the tree as it stood
  before this plan.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Context

CONTEXT D-10 binds the replacement: the arm drops the word "timeout" and names
its actual producers - the spawn-agent turn cap, and a missing or unparseable
return. User interruption is NOT folded in; the roadmap states it is a different
condition with a different recovery. D-11 pins the "same words" agreement with a
new check in `prose-agreement.test.mjs`, whose charter is exactly this class and
which already pins other `execute.md` phrases and a prior `seams.md`
spawn-agent misstatement; that check is also WIR-01's watched-FAIL-first site,
since it reddens against today's text before a word is changed. D-12 puts the
default reviewer's bound where `seams.md` today says `claude-subagent` "is
exempt" and "does NOT use this seam", plus the parallel statement in
`review-triggers.md` - stating it anywhere else leaves the side-by-side contrast
the criterion targets intact.

Out of this plan: everything RVP-01 (PLAN-1) and everything RVP-02 (PLAN-2).
Out of the phase: the one-round re-arm cap `execute.md` restates inline
uncapped - the same file, a different claim, captured in phase 2.

## Tasks

### Task 1: the recovery arm names its producers, in both documents, in the same words

- **Files:** `cadence-core/workflows/execute.md` (the `**timeout or no report**`
  bullet in the "Handle the executor's return" list, the fourth arm after
  `complete`, `checkpoint` and `partial`), `cadence-core/references/seams.md`
  (the spawn-agent seam's "A turn bound, but no timeout and no cancel" bullet),
  `cadence-core/bin/weight-budgets.json`
- **Action:** Relabel the arm so it names what can actually put the coordinator
  in that state and drop the word that names what cannot. The two producers, both
  measured rather than assumed: the spawn-agent TURN CAP, which
  `.planning/spikes/maxturns-cap-behaviour/SPIKE.md:96-115` recorded live - a
  capped executor returns its last assistant TEXT, not its contracted digest,
  while its commits and its rewritten `reports/plan-<k>.md` stay on disk, which is
  this arm's exact state - and a return that is MISSING or UNPARSEABLE. Do not
  fold user interruption into the arm (D-10): the roadmap states it is a different
  condition with a different recovery, and an interrupted run has no live
  coordinator to reach this arm at all, so naming it here would re-create the
  defect this requirement exists to close - prose asserting a control the path
  does not hold. Leave the arm's BEHAVIOUR untouched: the executor rewrites its
  report after every task commit, so read that file, confirm it against `git log
  {pre-plan HEAD}..HEAD`, report the state, ask the user via the ask-user seam,
  never silently re-run a plan on top of partial commits. Then state the SAME
  producer wording in `seams.md`'s spawn-agent bullet, which already says the seam
  has "A turn bound, but no timeout and no cancel" and is where a reader learns
  the fact the workflow copies - the two must read identically because task 3
  compares them to each other. Keep the phrase short and quotable; it is about to
  become a machine-compared string, so avoid line-wrapping it in either file, and
  do not restate the spike's evidence in `execute.md` (the seam reference is
  where that argument belongs). `execute.md` sits at exactly its 26379-byte pin
  and `seams.md` at exactly its 19726-byte pin, both with zero headroom, so re-pin
  `weight-budgets.json` for each in this same commit.
- **Verify:** `rg -n "timeout or no report" cadence-core/workflows/execute.md`
  returns no match and exits non-zero. The replacement arm's producer wording
  appears verbatim in both files - `rg -n -F "<the phrase>"` returns a hit in
  each of `cadence-core/workflows/execute.md` and
  `cadence-core/references/seams.md`. `rg -n "plan-<k>.md"
  cadence-core/workflows/execute.md` still shows the arm reading the report file,
  so the recovery survived the relabel. `node cadence-core/bin/self-verify.mjs`
  exits 0 with `ok:true` and no `budget-overrun` problem.

### Task 2: the default reviewer states its own bound where it claims exemption

- **Files:** `cadence-core/references/seams.md` (the exemption sentence in the
  call-review-provider seam's degradation bullet - "`claude-subagent` never runs
  this script and is exempt" - and the bullet immediately below it reading "The
  default backend `claude-subagent` does NOT use this seam"),
  `cadence-core/references/review-triggers.md` (the `claude-subagent` bullet in
  the two-backends list at the top of the file),
  `cadence-core/bin/weight-budgets.json`
- **Action:** Give the exemption sentence its own bound in the same breath: the
  `claude-subagent` reviewer is exempt from `over-cap` because it never runs this
  script, AND it is bounded by the spawn-agent turn cap - `maxTurns: 200`, the
  one uniform value every rung file carries in its frontmatter. Say it exactly
  where the exemption is claimed, not in a paragraph of its own: stating it
  anywhere the "exempt" wording is not leaves the side-by-side contrast intact,
  which is what the criterion targets. Reflow that sentence so `is exempt` sits
  on ONE line - today "and is" ends one line and "exempt." begins the next, so
  `rg "is exempt"` finds nothing at all, and the acceptance criterion for this
  requirement greps for exactly that phrase. Then state the parallel fact in
  `review-triggers.md`'s `claude-subagent` bullet, which today describes the
  backend as "(default, zero-dep)" with no bound beside the cross-model bullet's
  seam reference. Write the figure as `maxTurns: 200` in both places, matching the
  spelling `seams.md`'s spawn-agent bullet already uses, because task 3 reads it
  back and compares it to the agents' frontmatter. Do not restate the turn cap's
  full argument in either place - `seams.md`'s spawn-agent bullet is the one
  statement of it and these two point at the same fact. `seams.md` and
  `review-triggers.md` (30592 bytes) both sit at exactly their pins, so re-pin
  `weight-budgets.json` for each in this same commit.
- **Verify:** `rg -n "is exempt" cadence-core/references/seams.md` returns the
  `claude-subagent` sentence and that same line or its sentence names
  `maxTurns: 200`. `rg -n "maxTurns: 200" cadence-core/references/review-triggers.md`
  returns the `claude-subagent` bullet. `node --test
  cadence-core/bin/prose-agreement.test.mjs` still exits 0, proving the existing
  turn-bound check (which reads only the `## Seam: spawn-agent` section and
  requires every `maxTurns` figure there to equal the agents' frontmatter value)
  was not disturbed by figures added outside that section. `node
  cadence-core/bin/self-verify.mjs` exits 0 with `ok:true` and no
  `budget-overrun` problem.

### Task 3: the agreement becomes a standing check, watched failing first

- **Files:** `cadence-core/bin/prose-agreement.test.mjs` (a new check beside the
  existing `execute.md` phrase checks in the `risk_surface fires on a completed
  range` test and the `the turn bound: every rung file and the spawn-agent seam
  name one maxTurns value` test)
- **Action:** Add one check that holds the three facts tasks 1 and 2 landed, in
  this file's own style - read the live documents, extract the fact, compare the
  copies. It must assert: that `cadence-core/workflows/execute.md` contains no
  recovery arm labelled with a timeout; that the producer wording EXTRACTED from
  `execute.md` and the producer wording EXTRACTED from
  `cadence-core/references/seams.md` are equal to each other, so changing either
  document alone reddens it; and that the `claude-subagent` bound stated in
  `seams.md` and in `cadence-core/references/review-triggers.md` equals the
  `maxTurns` value read from the `agents/*.md` frontmatter, the way the existing
  turn-bound test in this file already reads it, rather than a literal 200 typed
  into the test - a hardcoded figure would go stale silently the day the rung
  files move. Compare the two extractions to EACH OTHER; do not settle for
  asserting that some expected phrase appears in each file. That weaker shape is
  a defect this exact file has already shipped once - the coverage arm that
  required the word `site` in a `Read` sentence and never parsed the count
  against the row's anchors, so `zero consult sites` passed (CAPTURE.md, phase 3)
  - and it passes a tree where one document was reworded and the other was not,
  which is the only failure this check exists to catch. Carry the header comment
  in the shape `cadence-core/bin/milestone-prune.test.mjs`'s RCL-07 falsifier
  uses: `WATCHED FAILING AT <sha>` naming the tip of the unpatched tree
  (`c4522c3` is the tip as this plan is written; use the commit immediately
  preceding this plan's first implementation commit if it has moved), the
  observed unpatched output quoted verbatim - against that tree `execute.md`
  still reads `**timeout or no report**` and neither producer wording nor
  `claude-subagent` bound exists to extract - and the re-watch recipe (`git
  worktree add --detach <tmp> <sha>`, copy this file into that checkout's
  `cadence-core/bin/`, `node --test` it there, remove the worktree).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0 on
  this tree. Reverting the producer wording in `cadence-core/references/seams.md`
  alone makes it FAIL naming the two unequal extractions, and reverting it in
  `cadence-core/workflows/execute.md` alone makes it FAIL the same way (restore
  both afterwards). Following the header's own re-watch recipe against the SHA
  the header names, the same command exits NON-ZERO, and the header quotes that
  observed output.

### Task 4: AC7's watched-FAIL record reaches the SUMMARY

- **Files:** `.planning/phases/3/SUMMARY.md`
- **Action:** Append an `## AC7: watched failures` section to the phase SUMMARY
  carrying exactly three lines, one per requirement - `RVP-01`, `RVP-02`,
  `WIR-01` - each naming the test file holding that requirement's falsifier, the
  SHA its `WATCHED FAILING AT <sha>` header names, and the command that re-watches
  it. Quote the SHAs from the headers as they stand at execution time rather than
  from this plan: `c4522c3` is the tip as the plans are written, and each header
  is instructed to use the commit immediately preceding its own plan's first
  implementation commit, so the three may differ from each other and from this
  sentence. APPEND to whatever `/cad-execute` has already written to this file -
  the executor owns the SUMMARY's commit manifest and task record, this task owns
  one additional section, and neither rewrites the other. Run this task LAST in
  the phase, after PLAN-1 and PLAN-2 have executed, or two of the three headers
  do not exist yet to be quoted.
- **Verify:** `.planning/phases/3/SUMMARY.md` contains an `## AC7: watched
  failures` heading followed by three lines naming `RVP-01`, `RVP-02` and
  `WIR-01`. For each line, the SHA it quotes matches the `WATCHED FAILING AT`
  header in the test file that same line names - checked by extracting both and
  comparing, never by reading. `grep -c "WATCHED FAILING AT"` over the three test
  files returns 3.

## Notes

- Settled here under D-10's discretion: user interruption is left OUT of the arm
  entirely rather than named beside the two producers. An interrupted run
  interrupts the coordinator too, so nothing is left running to take this arm,
  and naming a condition whose recovery this workflow cannot perform would be the
  same class of defect WIR-01 exists to close.
- AC7 asks the SUMMARY to record, per requirement, the SHA at which its check was
  watched failing. The three falsifier headers - PLAN-1 task 6, PLAN-2 task 6 and
  this plan's task 3 - are the source those three lines are quoted from; each
  names its SHA, the observed unpatched output and the recipe to re-watch it.
  Task 4 is what actually writes them: until it was added, this bullet described
  a record no task produced, and AC7 would have been satisfied by prose alone.
  `.planning/phases/3/SUMMARY.md` is therefore leased by this plan, which is the
  one place a plan file and `/cad-execute` write the same path - the composition
  is append-only and stated in the task, but it is a seam worth watching if the
  executor's SUMMARY handling changes.
- This plan shares `cadence-core/references/seams.md` and
  `cadence-core/bin/weight-budgets.json` with PLAN-1, and
  `cadence-core/bin/weight-budgets.json` with PLAN-2. That is the CONTEXT `Plan
  shape` directive's explicit instruction, so `plan-overlap` will report an
  overlap and `/cad-execute` runs the three plans SEQUENTIALLY in number order.
  No plan reads another's output; the shared `seams.md` edits are disjoint
  passages (PLAN-1 extends the call-review-provider degradation vocabulary, this
  plan edits the spawn-agent turn-bound bullet and the exemption sentence).
</content>
