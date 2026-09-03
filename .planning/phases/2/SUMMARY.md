---
phase: 2
status: complete
completed: 2026-09-03
---

# Phase 2: A treeless task can finish honestly - Summary

`cadence-core/workflows/task.md` states one completion rule for a `written: false` record - the absent planning root reports done with the check's disposition stated, every other reason withholds it - and an inline `/cad-task` on a repository with no `.planning/` runs the risk check, answers the one-time surfaces question in the run, and creates nothing.

## What shipped

- The completion rule, stated once in the `risk_check` step of `cadence-core/workflows/task.md`: `ENOENT` from the trace seams or "no planning root" from `task-record` reports done and calls the record unrecorded; a symlinked trace, a failed stat, `EACCES`, `ENOSPC`, `oversized-event` or a failed rotation withholds it. The skip arm, the `record` step and the `done` step point at the rule instead of restating it, and no `[ -d .planning ]` check stands beside it.
- The `surfaces-unanswered` arm in the same step: a bare `risk-check run` refusal is neither a verdict nor a skip, so the run scans with `detect-surfaces`, asks the one-time question, and re-runs with `--surfaces`; on a treeless repo the answer rides the flag per run because persisting it would create `.planning/config.json`.
- The `done` block's `Risk check:` line - the verdict the seam returned or the `risk_check_skipped` event that stood in for it, then recorded or unrecorded with the reason in words.
- Two prose pins in `cadence-core/bin/prose-agreement.test.mjs`: the completion rule's two halves, sentence-wise, with the pointer sites checked for carrying no verdict of their own; and the `surfaces-unanswered` arm naming the scan, the ask and the re-run.
- A seam test in `cadence-core/bin/planning-task-record.test.mjs` over `taskRepo(TASK_COMMITS, {planning: false})`: `trace append`, `trace close`, `task-record` and `risk-check run` each answer `ok:true, written:false` with the absent-root reason, the bare `risk-check run` refuses `surfaces-unanswered` while the `--surfaces` re-run reaches a verdict, and no `.planning/` exists afterwards.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 4eada4c3 | Seam test: every seam a treeless task calls answers written:false with the absent-root reason and creates nothing |
| 1 | 2 | 691bca30 | task.md states one completion rule for a record that cannot land; the ONE-place pin rewritten sentence-wise |
| 1 | 3 | d57f64d2 | task.md answers the surfaces-unanswered refusal in the run and re-runs with --surfaces, pinned |
| 1 | 4 | 6e9ddbc4 | The done block names the risk check's verdict and calls an unlanded record unrecorded |

## Deviations

None - plans executed as written.

## Open items

- AC3 and AC4 are human-verify: a live inline `/cad-task` on a scratch repository with no `.planning/` and no global surfaces answer. The seam test covers the four seams; the prose path is pinned, not run.
- No lint command exists for this repo (`workflow.lint_command` is null, `detect-commands` reports `lint:null`); the detected typecheck `npx tsc -p tsconfig.ci.json` exited 0 at every task.

## Goal check

The four commits plausibly deliver the goal. The rule is stated once: `any other reason` greps to one line inside the `risk_check` step and `[ -d .planning ]` appears only where the step says not to use it (executor report, task 2). The `done` step defers to it by name (`cadence-core/workflows/task.md:316` onward, "Whether this block is reached at all was decided by the `risk_check` step's completion rule"). The pin goes red on each half deleted and on each half neutered (four falsifications, task 2), and the `surfaces-unanswered` pin went red on the paragraph deleted (task 3). The seam test asserts `reason === 'ENOENT'` on every trace call and `/no planning root/` on the record, then `existsSync(dir) === false`. The full suite ran green at 3772 of 3772 and `tsc` exited 0. What is not proven here: the inline path end to end on a real treeless repository, which is the human-verify pair above, and the `diff` review's one surviving low finding - the ONE-place pin reads the skip arm and the `record` step but not the `done` step - was declined at triage and sits in `.planning/DECLINED.md`.
