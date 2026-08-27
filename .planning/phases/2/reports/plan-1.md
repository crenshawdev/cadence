PLAN COMPLETE
Plan: .planning/phases/2/PLAN.md
Tasks: 3 of 3
| Task | Commit | Note |
|---|---|---|
| 1: Stop the run in `locate` when every plan already reports complete | 154a54fd | New `locate` arm placed below the `executed`/`complete` one; `execute_sequential`'s report-read sentence now names three moments; `EXP-03` prose test added, including the trigger-clause assertion that it pins the FIRST LINE reading EXACTLY `PLAN COMPLETE` (the plan review's medium open item). `weight-budgets.json` re-pinned 29001 -> 31146. Falsification: deleting the trigger clause FAILED `EXP-03` naming the missing `-> stop:`; restored, green. |
| 2: Dispatch only the plans that have no completed report | 92b21bee | `**The dispatch set.**` block added to `locate`; `execute_sequential` iterates it; `execute-parallel.md` step 1 dispatches per plan in the set. Sibling `EXP-03` test pins both dispatch sites, the `--rerun` arm, both path names, and the `summary` carve-out. Budgets re-pinned: `execute.md` 32404, `execute-parallel.md` 5711. Falsification: both reverts FAILED naming their own sentence; both restored, 296 pass / 0 fail. |
| 3: Record why the guard reads a file and not the derivation | 8c2720b5 | Two `## locate` sections added to `docs/rationale/execute.md` (four total), the unmerged-worktree fail-open named at line 57 inside the second. `docs/` is unmeasured, so no budget moved. |
Deviations: none
Open items:
- Task 1 Action asked the arm to say "never a `plan-*.md` glob" while the same task's test asserts the arm carries no `plan-*.md` literal; the two cannot both hold, so the arm forbids globbing the `reports/` directory without spelling the glob. Prohibition and assertion both stand; nothing about the criterion turned out wrong.
- AC3 and AC5 are human-verify and unobserved here: both need a live `/cad-execute` run to read `.planning/trace.jsonl` for the dispatch count. The prose halves each are pinned by tests; the workflow's obedience is not.
