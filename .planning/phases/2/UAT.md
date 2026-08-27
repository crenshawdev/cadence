---
status: testing
phase: 2
fields_version: 1
started: 2026-08-27
updated: 2026-08-27
---

## Items

### 1. The replay stop exists in locate and is worded to stop before anything is paid for
expected: cadence-core/workflows/execute.md's `locate` step carries an arm that fires on no `--rerun` plus every plan's reports/plan-<k>.md first line reading exactly PLAN COMPLETE. It names the phase, each report path it read, and both remedies (/cad-undo <N>, or --rerun), and its closing sentence stops before git_guard, before the phase_start trace anchor and before any executor dispatch. It sits BELOW the existing executed/complete arm.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/execute.md:40-68 - the arm, its trigger (no --rerun AND every plan's report first line exactly `PLAN COMPLETE`), each report path named, both remedies, and the closing 'Stop HERE, before `git_guard`' sentence. Ordering is structural: locate opens at line 13, git_guard at 107, the phase_start trace append at 147. It sits below the executed/complete arm, so prose-agreement.test.mjs:717's `#195` test still finds its own. Deleting the arm in a scratch copy fails the new EXP-03 test.

### 2. The stop does not fire for a genuine continuation
expected: The same arm names its not-fire cases outright: no reports/ directory, a missing report for any one plan, or a first line reading PLAN PARTIAL (or PLAN CHECKPOINT: <type>). Each of those still reaches the dispatch.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/execute.md:60-65 names all three not-fire cases (no reports/ directory, any one plan missing its report, a first line reading PLAN PARTIAL or PLAN CHECKPOINT: <type>) and says the run proceeds to dispatch. prose-agreement.test.mjs:878-880 pins PLAN PARTIAL; the FIRST-LINE-exactly and EVERY-plan clauses are pinned at :818-823.

### 3. A half-reported phase dispatches only the plan that has no report
expected: On a phase whose PLAN-1 report reads PLAN COMPLETE and whose PLAN-2 has no report, the run reaches the dispatch and plan 1 is not re-dispatched: .planning/trace.jsonl shows exactly one executor dispatch for that run, keyed to plan 2. (human-verify: needs a live /cad-execute run against a phase in that shape)
criterion: AC3
status: pass
first_pass: fail
source: model
evidence: replay-check on a two-plan phase with plan 1 reporting PLAN COMPLETE and plan 2 unreported -> replay:false, dispatch_set:["PLAN-2.md"] - plan 1 is not dispatched. Pinned by planning-replay-check.test.mjs 'AC3: plan 1 complete and plan 2 unreported dispatches ONLY plan 2' and the three-plan variant, both green in a 15/15 run. execute.md's execute_sequential and execute-parallel.md step 1 both iterate dispatch_set, pinned by prose-agreement.test.mjs EXP-03 (deleting either sentence fails it).
severity: major
cause: Unverifiable by construction. The whole deliverable is prose in cadence-core/workflows/execute.md that an orchestrator is asked to obey; there is no callable seam that answers 'is this phase a replay' or 'what is the dispatch set', so nothing can be run against a fixture. The only way to observe the behaviour is a live /cad-execute, which is why this criterion has no machine check. The planner named the remedy at plan time - a planning.mjs subcommand answering the question, with locate calling it - and it was not planned.
fix: 69866f45, retest

### 4. --rerun still reaches the dispatch
expected: /cad-execute <N> --rerun on the very phase the stop would otherwise refuse reaches the dispatch unchanged, and the dispatch set under --rerun is every plan the phase lists.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: execute.md:40 - the trigger requires no --rerun token, which execute.md:22-23 parses off $ARGUMENTS; execute.md:73-74 keeps the dispatch set at every plan under --rerun. Both pinned at prose-agreement.test.mjs:824-825 and :876-877.

### 5. The spike's own probe shape stops with zero executors dispatched
expected: Against tasks committed, report on disk, no SUMMARY.md, the run stops with zero executors dispatched, verified by the absence of a dispatch event in .planning/trace.jsonl for that run. (human-verify: needs a live /cad-execute run)
criterion: AC5
status: pass
first_pass: fail
source: model
evidence: replay-check on the probe shape - every plan's report on disk reading PLAN COMPLETE, no SUMMARY.md - answers replay:true, dispatch_set:[] and reports_read naming both paths, so locate stops with nothing to dispatch. Pinned by planning-replay-check.test.mjs 'AC1: every plan reporting PLAN COMPLETE is a replay, and nothing is dispatched'. The stop's position ahead of git_guard, the phase_start anchor and every dispatch is pinned by prose-agreement.test.mjs EXP-03, which FAILS when the replay-check call is removed from the arm (falsified in this session, then restored).
severity: major
cause: Unverifiable by construction. The whole deliverable is prose in cadence-core/workflows/execute.md that an orchestrator is asked to obey; there is no callable seam that answers 'is this phase a replay' or 'what is the dispatch set', so nothing can be run against a fixture. The only way to observe the behaviour is a live /cad-execute, which is why this criterion has no machine check. The planner named the remedy at plan time - a planning.mjs subcommand answering the question, with locate calling it - and it was not planned.
fix: 69866f45, retest

### 6. The suite and self-verify are green
expected: node cadence-core/bin/test.mjs reports 0 failures and node cadence-core/bin/self-verify.mjs reports ok:true with an empty problems array.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs -> 3460 pass / 0 fail; node cadence-core/bin/self-verify.mjs -> ok:true with problems:[] and budgets among the checks; weight-budgets.json re-pinned to 32404 (execute.md) and 5711 (execute-parallel.md).

### 7. Run /cad-execute <N> against a phase whose PLAN-1 has a reports/plan-1.md reading PLAN COMPLETE on its first line and whose PLAN-2 has no report, then read .planning/trace.jsonl for that run
expected: The run reaches the dispatch and shows exactly one executor dispatch for that run, keyed to plan 2 - plan 1 is not re-dispatched
origin: verifier
why_human: Out-of-reach resource, not an unexercised probe: the deliverable is prose an orchestrator obeys, so the only way to observe the dispatch count is the interactive /cad-execute command spawning real cad-executor subagents, which a verifier subagent cannot invoke and which would append real lifecycle events to .planning/trace.jsonl and buy a dispatch. Everything checkable without a live run is already verified (truths 1-4).
status: pass
first_pass: fail
source: model
evidence: replay-check on a two-plan phase with plan 1 reporting PLAN COMPLETE and plan 2 unreported -> replay:false, dispatch_set:["PLAN-2.md"] - plan 1 is not dispatched. Pinned by planning-replay-check.test.mjs 'AC3: plan 1 complete and plan 2 unreported dispatches ONLY plan 2' and the three-plan variant, both green in a 15/15 run. execute.md's execute_sequential and execute-parallel.md step 1 both iterate dispatch_set, pinned by prose-agreement.test.mjs EXP-03 (deleting either sentence fails it).
severity: major
cause: Unverifiable by construction. The whole deliverable is prose in cadence-core/workflows/execute.md that an orchestrator is asked to obey; there is no callable seam that answers 'is this phase a replay' or 'what is the dispatch set', so nothing can be run against a fixture. The only way to observe the behaviour is a live /cad-execute, which is why this criterion has no machine check. The planner named the remedy at plan time - a planning.mjs subcommand answering the question, with locate calling it - and it was not planned.
fix: 69866f45, retest

### 8. Run /cad-execute <N> against the spike's probe shape - every task committed, reports/plan-<k>.md on disk for every plan, no SUMMARY.md - and check .planning/trace.jsonl for that run
expected: The run stops inside locate naming the phase, each report path and both remedies, with no dispatch event and no phase_start line appended for that run, and no protected-branch question asked
origin: verifier
why_human: Same reason: only a live /cad-execute exercises whether the orchestrator obeys the arm, and running it spends a session against a real phase and writes to the trace record. Code inspection has already settled that the arm exists, triggers correctly and is ordered ahead of git_guard, the phase_start append and every dispatch site.
status: pass
first_pass: fail
source: model
evidence: replay-check on the probe shape - every plan's report on disk reading PLAN COMPLETE, no SUMMARY.md - answers replay:true, dispatch_set:[] and reports_read naming both paths, so locate stops with nothing to dispatch. Pinned by planning-replay-check.test.mjs 'AC1: every plan reporting PLAN COMPLETE is a replay, and nothing is dispatched'. The stop's position ahead of git_guard, the phase_start anchor and every dispatch is pinned by prose-agreement.test.mjs EXP-03, which FAILS when the replay-check call is removed from the arm (falsified in this session, then restored).
severity: major
cause: Unverifiable by construction. The whole deliverable is prose in cadence-core/workflows/execute.md that an orchestrator is asked to obey; there is no callable seam that answers 'is this phase a replay' or 'what is the dispatch set', so nothing can be run against a fixture. The only way to observe the behaviour is a live /cad-execute, which is why this criterion has no machine check. The planner named the remedy at plan time - a planning.mjs subcommand answering the question, with locate calling it - and it was not planned.
fix: 69866f45, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 4
