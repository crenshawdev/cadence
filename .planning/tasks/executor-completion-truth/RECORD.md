# Task: executor-completion-truth

## What shipped

- The executor's report and digest can now express two states that really occur
- and neither could be said before.
- GH-231 (S1): PLAN COMPLETE was written after the last task's commit, and the
- project's full suite ran after that. That string is the parse key replay-check
- drops a plan from the outstanding set on, so a red final suite plus a crash left
- durable evidence claiming the plan completed and the next /cad-execute reported
- the phase replayable. A green suite completes the plan now; a red one gets one
- bounded repair round and then a named checkpoint type the orchestrator routes.
- GH-148: the digest gained a Commits: value for a dispatch whose work was already
- in HEAD, and trace close gained --replay so that bracket is subtractable from a
- cost read. Two measured replays had charged 30,588 and 24,570 tokens that a read
- over trace.jsonl counted as execution.
- One deviation: the report FILE block did not gain the new Commits: value. Its
- per-task table already carries a Note column, which is where both observed
- executors put the truth, and that file rides every dispatch.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | c625d9bac90a63b33bbd6fac45add047f02147b9 | fix(executor): a green suite completes the plan, not the last task's commit |
| 1 | a35478df5c73f25b406f60b1d84fa5e04d764e73 | feat(executor): the digest can say it committed nothing because the work was there |
| 1 | 8625a1a10724337063ba8de240baa12deae84e53 | docs: task plan and outcome for executor-completion-truth |

## Files

### Task 1: executor-completion-truth

- **Files:** .planning/tasks/executor-completion-truth/PLAN.md, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/planning/trace.mjs, cadence-core/bin/trace.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/workflows/execute.md, skills/cad-executor-contract/SKILL.md
