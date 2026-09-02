---
phase: 3
plan: 3
requirements:
  - TRC-13
files:
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/workflows/execute.md
  - docs/rationale/execute.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
---

# Phase 3: The record states the effort that actually ran - Plan 3

## Goal

Cadence's own prose stops saying the hook's close carries nothing, the claim
ledger's anchors still point at the lines they claim, and the requirement that
started this phase names the source the phase actually used.

## Must be true when done

- No line in `cadence-core/` says the `SubagentStop` hook's close carries none
  of the return's figures or calls it figureless; the seam reference states, for
  BOTH of the hook's writes, that they carry the effort read off the worker's own
  transcript and the rung the worker was dispatched under.
- `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`, with the
  `seam-spawn-agent.md` and `execute.md` rows re-pinned to the files' new sizes.
- Every `.planning/DOCS-CLAIMS.md` row anchored in a file this phase changed
  still names the lines its claim describes, and no new row was added.
- `REQUIREMENTS.md`'s `TRC-13` names the worker's own transcript as the source of
  the observed effort and no longer names the `SubagentStop` payload, and the
  `## Traceability` table carries a `TRC-13 | Phase 3` row.
- `node cadence-core/bin/test.mjs` and `npx tsc -p tsconfig.ci.json` pass.

## Context

CONTEXT.md's decisions bind every task here. The load-bearing ones: every line
calling the hook's close "figureless" or saying it "carries none of the RETURN's
figures" moves, and the three budget rows re-pin (D-12); DOCS-CLAIMS anchors that
shift re-pin and NO new row is added (D-13); `worker_cache` keeps its name and
its documented meaning widens to "what the hook read off the worker's own
transcript" (D-05); `TRC-13`'s text is corrected to name the transcript, and its
Traceability row comes from `seed-reqs` and never by hand (D-16).

PLAN-1 and PLAN-2 must be complete first: this plan describes behaviour they
ship, and PLAN-2 re-pinned the third budget row (`report.md`) in the same
`weight-budgets.json` this plan touches. Out of scope: `lib/trace.mjs:1886`'s
comment, which PLAN-2 task 1 owns because it sits in the code that task edits;
any new DOCS-CLAIMS row; and any change to what `/cad-report` prints, which is
PLAN-2 task 3.

## Tasks

### Task 1: The seam reference states what both hook writes now carry

- **Files:** cadence-core/references/seam-spawn-agent.md (the bracket block's
  account of the hook's two writes), cadence-core/bin/weight-budgets.json
- **Action:** The bracket block at `:162-181` describes the hook's two writes and
  what each carries. Both descriptions gain the two values PLAN-1 puts on them:
  the effort the worker actually RAN at, read off that worker's own transcript
  (the file this block already names as `agent_transcript_path`, and never the
  hook payload, which carries the CONFIGURED level and cannot see the host's
  silent downgrade), and the rung the worker was DISPATCHED under, taken from the
  payload's `agent_type` through the one rung map. Say plainly that the pair is
  the point: the record can now state what a rung was routed at beside what it
  ran at, and a reader can see them disagree. The `worker_cache` fact KEEPS its
  name; widen only its documented meaning, from "the two cache figures" to what
  the hook read off the worker's own transcript, because a rename would orphan
  the 114 facts on this record and every fact on every other project's record
  (D-05). Both keys are OMITTED when the transcript reported no effort, on the
  same absent-is-not-zero rule this block already states for `--agent-id` at
  `:155-161`. Do NOT add a `--effort` flag or any other close flag to this
  block's flag list, and do not describe one: the hook is the only writer, the
  orchestrator's close line copies the four fields the host prints, and a flag
  the orchestrator copied by hand makes one typo a false mismatch on the record
  (D-14). Leave `:198-200`'s "figureless return" alone - that is about a close
  that carried no `--tokens`, a different claim. Re-pin the
  `cadence-core/references/seam-spawn-agent.md` row in `weight-budgets.json`
  (25,299 B today) to the file's new byte count in the same commit; the budget
  check is a ceiling and a grown surface reports `budget-overrun`
  (`self-verify.mjs:791-818`).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `wc -c cadence-core/references/seam-spawn-agent.md` equals that file's value in
  `cadence-core/bin/weight-budgets.json`; and
  `grep -n "worker_cache" cadence-core/references/seam-spawn-agent.md` shows the
  fact still named `worker_cache` in a sentence that now also names the effort
  and the dispatched rung.

### Task 2: `execute.md` and its rationale stop calling the hook's close figureless

- **Files:** cadence-core/workflows/execute.md (the close-detail paragraph and
  the "THREE writers" bullet), docs/rationale/execute.md (the
  `execute_sequential - why a worktree executor emits nothing` section),
  cadence-core/bin/weight-budgets.json
- **Action:** Two lines in `execute.md` state the claim this phase falsifies.
  `:281-284` says "that hook carries none of the RETURN's figures, so a skipped
  close still costs the record this worker's tokens, turns and wall clock" - the
  second half stays true and the first does not: the hook's close carries the two
  cache figures already and now carries the observed effort and the dispatched
  rung, so restate it as what the hook cannot see (the return's tokens, turns and
  wall clock) rather than as carrying nothing. `:600-606` calls the hook's write
  "a figureless close"; restate it the same way. Keep both edits tight - every
  added byte is paid for at the budget row, and `execute.md` is this repo's
  largest workflow. Leave `:288`'s "OMIT `--tokens` on a figureless return"
  untouched: that is about the ORCHESTRATOR's close on a return the host gave no
  figure for, a different claim with a different subject. Then check
  `docs/rationale/execute.md:108-118`, which describes the same hook write; make
  the same correction there only if it states the hook's close carries no
  figures, and leave it unchanged if it does not - it is not budgeted, so a
  needless edit there buys nothing. Re-pin the
  `cadence-core/workflows/execute.md` row in `weight-budgets.json` (35,680 B
  today) to the file's new byte count in the same commit.
- **Verify:** `grep -rn "figureless" cadence-core/workflows/execute.md` returns
  only the `--tokens` line about the orchestrator's own return;
  `grep -rn "carries none of the RETURN" cadence-core docs` returns nothing;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`; and
  `wc -c cadence-core/workflows/execute.md` equals that file's value in
  `cadence-core/bin/weight-budgets.json`.

### Task 3: Re-pin the claim-ledger anchors this phase moved

- **Files:** .planning/DOCS-CLAIMS.md (the `REPORT-*`, `CONTEXT-*` and
  `EXECUTE-*` rows)
- **Action:** Apply D-13's rule - an anchor that shifted re-pins, and NO new row
  is added, the same posture phase 2's D-14 took. Check every row whose file this
  phase changed and re-pin only the anchors that no longer name the lines their
  claim describes; leave each row's run-1 and run-2 verdict cells exactly as they
  were recorded, the way the `REPORT-12` row's note says it left run 1's. The set
  CONTEXT flagged is `REPORT-05`, `REPORT-10` and `REPORT-12` through `REPORT-15`
  on `workflows/report.md`, and `CONTEXT-09` through `CONTEXT-13` on
  `lib/trace.mjs:58-73` - the trace.mjs edits all land below line 176, so those
  five are expected to hold and are checked rather than assumed. CONTEXT's list
  does not cover `workflows/execute.md`: `EXECUTE-41` anchors at `277-284`, the
  exact window task 2 rewrites, and every `EXECUTE-*` row anchored at or past
  `:277` (`EXECUTE-42` through `EXECUTE-47`, `EXECUTE-02`, `EXECUTE-03`,
  `EXECUTE-26` through `EXECUTE-30`) shifts by whatever task 2 added. Re-pin
  those the same way. If a claim's TEXT became untrue rather than merely moving -
  a row asserting the hook's close carries no figures - correct the claim text
  and record the correction in its resolution cell naming this phase, which is
  what the `REPORT-12` row did; do not delete the row and do not add one.
- **Verify:** For every row this task touched, `sed -n '<lines>p' <file>` on the
  row's own file and anchor prints text the row's claim describes; and
  `grep -c '^| ' .planning/DOCS-CLAIMS.md` returns the same count as before the
  task, proving no row was added or removed.

### Task 4: `TRC-13` and the roadmap name the worker transcript, not the payload

- **Files:** .planning/REQUIREMENTS.md (the `TRC-13` bullet under `## Active`),
  .planning/ROADMAP.md (the Phase 3 detail block at `:170-176`)
- **Action:** The `TRC-13` bullet at `:21` says `subagent-trace.mjs` "reads
  `effort` off the `SubagentStop` payload it already parses and puts it on the
  `return` event". Both halves are wrong and this phase measured why: the payload
  carries the CONFIGURED level and cannot see the host's silent downgrade, so the
  source is the worker's own transcript (D-01); and putting it on `return` alone
  records it on zero live dispatches, because 114 `worker_cache` facts stand
  against 2 hook-written returns on this record, so it rides every write the hook
  makes (D-02). Rewrite the bullet to name the worker's own transcript as the
  source and both hook writes as the carriers, keep the `unrecorded`-never-a-match
  clause, and resolve the "Gated on OQ-2" clause to what the spike record found -
  the id is live, not withdrawn. Keep the `GH-226` citation and the `Phase 3`
  tail. Do NOT hand-write anything in `## Traceability`: that row is
  `planning.mjs seed-reqs`' output and the plan workflow runs it (D-16,
  `workflows/plan.md:489-497`). If the row is absent when this task runs, report
  it rather than adding it.

  D-01 names THREE things its measurement contradicts - `GH-226`,
  `REQUIREMENTS.md:21` and `ROADMAP.md:170-176` - and says all three are
  corrected rather than followed. `.planning/ROADMAP.md`'s Phase 3 detail block
  at `:170-176` is the second of them and it is corrected HERE, in the same
  commit as the requirement bullet, because the two say the same wrong thing:
  it states that `subagent-trace.mjs` "reads `effort` off the payload it already
  has and puts it on the `return` event". Rewrite those lines to name the
  worker's own transcript as the source and both hook writes as the carriers,
  and leave the phase name, the goal line, the OQ-2 gating sentence and the
  success criteria exactly as they are - this corrects the mechanism the block
  describes, never the phase's scope. `GH-226` is the third and is a tracker
  row outside this repository: it is REPORTED at the end of this task, not
  edited, and closing or amending it is the human's.
- **Verify:** `grep -n 'TRC-13' .planning/REQUIREMENTS.md` shows the requirement
  bullet naming the worker transcript and containing neither the word `payload`
  nor "off the `SubagentStop` payload", and shows a `| TRC-13 | Phase 3 |` row
  under `## Traceability`; `sed -n '160,195p' .planning/ROADMAP.md` names the
  worker transcript and contains no sentence putting the effort on the `return`
  event alone; and `git show --stat HEAD` names both files in the one commit.

## Notes

- Sequential after PLAN-1 and PLAN-2. All three plans touch
  `cadence-core/bin/weight-budgets.json` (PLAN-2 re-pins `report.md`, this plan
  re-pins the other two rows), so the three must not be dispatched in parallel.
- Task 3 extends CONTEXT's at-risk claim list rather than following it literally.
  D-13's rule is "anchors that shift re-pin"; the enumeration in D-13's "At risk"
  clause predates the decision to edit `execute.md:281-284`, and `EXECUTE-41` is
  anchored on exactly that window. Applying the rule is the decision; the list
  was an estimate of where it would bite.
- `cadence-core/bin/lib/rung-agent.mjs:348` states "Subagent turns record no
  effort anywhere, so no observable downstream disagrees either - it is
  unfalsifiable outside the file." This phase makes it falsifiable. CONTEXT's
  D-12 does not name that line, so no task here corrects it; it is raised for the
  human in the planner's return marker instead.
