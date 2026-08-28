# Roadmap: v3.7.6 - the coordinator stays the coordinator

## Overview

**`v3.7.6`, opened 2026-08-28.** Two phases, two ids, one source: the run
record of the first foreign project Cadence executed end to end
(`/code/smithers`, 2.5 phases, 27 dispatches, 2026-08-27 to 2026-08-28), read
for operational waste on the executor path with tokens deliberately out of
scope.

**What the record showed.** The executor's own contract is lean. The waste sits
around it, and two items account for nearly all of it. First, the coordinator
does the risk-fix pass itself: when the blocking `risk_surface` gate fails,
`workflows/execute.md` says "the findings are fixed" with no owner, and in every
smithers phase the main session picked up the editor - fifteen edits across
eight files in one 21:25-21:27 window, then again at 22:09, 12:02, 12:20, 12:50
and 13:14. In the phase-2 execute window the coordinator made 156 tool calls and
read 52 source and test files, more than any single executor. Every one of those
edits is unreviewed by construction, since the one-round re-arm cap is already
spent, and every one of those reads sits in the main context for the rest of the
run. Second, the executor runs the full test suite per task and then again
inside the commit compound: 6 to 29 bare `pytest -q` invocations per dispatch
against a suite that takes 0.6 s, so the cost is turns, not seconds. Run 6 (7
tasks, `xhigh`) ran it up to 29 times in 27 minutes.

**Why these two and not the other four.** Four smaller items from the same read
- `detect-commands` asked per dispatch, an executor hunting for a plan file it
was handed, a duplicate `risk-check run` and a runtime `--help` in the
coordinator, and STATE/ROADMAP/REQUIREMENTS re-read past the `status` envelope -
are filed in `.planning/CAPTURE.md` and are tidy-ups. These two are the cost,
and both change who does what rather than how much is read.

**The standard.** Would a user on their own project feel it. Both do: the fix
pass ships unreviewed code into their tree under their name, and the per-task
suite runs are the turns their executor bill is made of.

## Open Questions

- **OQ-1 - what the continuation prompt carries.** The fix dispatch is a second
  dispatch under the same worker key (`execute.md:335-340` already names it).
  Whether it carries the adjudication file path, the surviving findings
  distilled, or both is phase 1 planning's call; the rail is that the
  coordinator distills nothing it would otherwise not read.
- **OQ-2 - where the full-suite run lives.** Once per task inside the commit
  compound, or once per dispatch before the digest. The contract's step 2 owns
  the targeted run either way; phase 2 planning picks the suite site against the
  smithers record.

## Phases

- [x] **Phase 1: The fix pass is a dispatch** - on a blocking gate FAIL the coordinator dispatches a continuation executor under the same plan key and never edits source itself
- [ ] **Phase 2: One targeted run, one suite run** - the executor contract verifies a task with its own test and runs the full suite once, not per turn

## Phase Details

### Phase 1: The fix pass is a dispatch
**Goal:** A blocking review gate that FAILs on a plan's committed range is cleared by a `cad-executor` continuation dispatched under that plan's worker key, carrying the findings, so the coordinator writes no source and the fix is a worker's reviewed-shape commit rather than the orchestrator's unreviewed one.
**Depends on:** nothing
**Requirements:** EXP-04
**Success Criteria:**
1. `workflows/execute.md`'s FAIL branch names the owner: a continuation `cad-executor` dispatched via the spawn-agent seam under worker key `<k>`, prompt carrying the plan file, the findings (path or distilled, per OQ-1) and "fix the blocker/high findings, then return the digest". The coordinator's own Edit/Write of any path outside `.planning/` in this workflow is named as forbidden in `<guardrails>`.
2. The continuation is bracketed like any executor - `route.mjs resolve --plan <k> --bracket-plan <k>` on dispatch, `trace close --plan <k> --role cad-executor` on return - so the run record shows the fix as an executor dispatch, not as coordinator turns.
3. The same rule holds for the `diff` trigger at `adjudicated` and for `/cad-task`'s `risk_check` step, which share the FAIL shape; each names the dispatch rather than restating the rule.
4. Reproduced against a fixture phase whose plan touches a risk surface: the FAIL branch produces a `dispatch` event for `cad-executor` under the original plan key and zero coordinator writes outside `.planning/`, verified from `trace.jsonl` and `reads.jsonl`.
5. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 2: One targeted run, one suite run
**Goal:** An executor verifies each task with the test the task names and runs the project's full suite at one stated site per task, so the per-task tool-call floor drops from three test invocations to two and a debugging loop reruns a file, not a suite.
**Depends on:** nothing
**Requirements:** EXP-05
**Success Criteria:**
1. `skills/cad-executor-contract/SKILL.md` step 2 names the targeted run - the task's own `Verify:` command, or the test file the task's files map to - as the verification, and names the full suite's single site (per OQ-2) immediately before the digest, run once per dispatch and never as a first probe.
2. The contract says in one sentence that a failing targeted run is re-run targeted until green, and the suite is not touched inside that loop.
3. `workflow.test_command`, when set, is the suite command at that one site and nowhere else; the contract's existing "if set and relevant" is replaced by the site.
4. Measured on the next foreign-project phase: bare full-suite invocations per executor dispatch at or below one per task plus one, read from `reads.jsonl` the way the 2026-08-28 baseline (6 to 29 per dispatch) was.
5. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.
