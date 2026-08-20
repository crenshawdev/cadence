---
status: testing
phase: 1
fields_version: 1
started: 2026-08-19
updated: 2026-08-20
---

## Items

### 1. Suffix picker passes three fixture states and is mutation-sensitive
expected: report-rotation.test.mjs passes with no report present, one present, and several already rotated; mutating the picker to return the base name unchanged fails at least one case.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: 7/7 tests pass in cadence-core/bin/report-rotation.test.mjs naming all three fixture states; base-name mutation on a scratch copy reddens 5 of 7.

### 2. Two rotations leave three readable reports, earliest byte-identical
expected: In a fixture plan directory, rotating twice leaves three readable reports and the earliest is byte-identical to its pre-rotation content.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: 'the rotate-twice round trip leaves three readable reports, the earliest byte-identical' passes against a real mkdtemp directory, asserting the earliest report's Buffer against its pre-rotation bytes.

### 3. Prose-agreement pins the locate refusal and unconditional status call
expected: A prose-agreement test asserts execute.md's locate step refuses derived status executed and complete, and that its status call is not under the else branch; the test fails when either is reverted.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: prose-agreement.test.mjs:707 passes; on a scratch copy it FAILS when the refusal bullet is deleted, when `complete` is removed, and when the status call is put back under an `$ARGUMENTS`/else branch, and passes again restored.

### 4. Live /cad-execute refuses an already-executed phase
expected: /cad-execute <N> against a phase whose derived status is executed refuses, names /cad-undo <N> then /cad-execute <N>, and the phase trace records no executor dispatch for that invocation. (human-verify: needs a live /cad-execute run)
criterion: AC4
status: pass
first_pass: pass
reported: record it

### 5. self-verify clean with weight budgets re-pinned
expected: node cadence-core/bin/self-verify.mjs --root . returns ok:true with an empty problems array, and weight-budgets.json rows 65 and 91 were re-pinned in the same commit as the prose edits.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: self-verify --root . returns ok:true with problems:[]; weight-budgets.json rows changed inside 4f644d7, 0106ba8, 48361c6 and b93522b beside their prose files; weight.mjs measures every touched surface at or under its budget.

### 6. /cad-report lists both reports on a SUMMARY-less rotated phase
expected: On a SUMMARY-less phase carrying a rotated report, /cad-report <N>'s glob .planning/phases/<N>/reports/plan-*.md lists both the rotated and the current report.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: The AC6 test globs phases/1/reports/plan-*.md over a SUMMARY-less fixture and resolves exactly ['plan-1.1.md','plan-1.md']; a per-run-subdirectory mutation makes it resolve one file and fail.

### 7. Rotated report survives the commit transports
expected: The worktree executor commit pathspec covers plan-<k>.md and plan-<k>.<n>.md, and the phase docs commit stages the reports/ directory with the risk .diff excluded by pathspec, so a rotated report is neither left untracked nor deleted from history.
status: pass
first_pass: fail
source: model
evidence: Fixed in c985c73: worktree-executor.md's commit bullet now says `git add <plandir>/reports/plan-<k>.md [<plandir>/reports/plan-<k>.<n>.md]` then the existing pathspec commit, with the reason the add stays bounded to those paths. Probed end to end in a throwaway repo reproducing a rotation plus a risk_surface checkpoint's leftovers: OLD instruction (`git commit -- <paths>` alone) prints "error: pathspec 'reports/plan-1.1.md' did not match any file(s) known to git" and commits nothing (the earlier verifier run measured this same case at exit 1; the exit=0 printed in my probe was `head`'s status through the pipe, not git's). NEW instruction: commits successfully, `git ls-tree -r HEAD` lists BOTH reports/plan-1.1.md and reports/plan-1.md, `git show HEAD:reports/plan-1.1.md` still returns the run-1 bytes, and both guardrails hold - the deliberately STAGED src.txt is still staged and uncommitted, and the flagged reports/plan-1-risk.diff is still untracked. weight-budgets.json row re-pinned 3441 -> 3941 in the same commit; self-verify ok:true problems:[]. risk_surface gate fired blocking on the staged fix (openai/gpt-5.6-terra, tier balanced): 0 findings.
reported: behavior wrong - the worktree half of the transport cannot execute. `git commit -- <paths>` refuses a path git does not track, and a rotated report is always a brand-new untracked path, so the widened pathspec aborts the whole commit instead of carrying the rotated file.
severity: major
cause: cadence-core/references/worktree-executor.md:22-28 tells the worktree executor to commit the report with `git commit -- <paths>` and never stages first; the file contains no `git add` for the report at all. `git commit -- <pathspec>` only commits paths git already tracks, so any UNTRACKED report path aborts the whole commit. A rotated plan-<k>.<n>.md is always brand new, so naming it - which the same bullet requires - is what breaks the commit. The defect is wider than rotation: a phase's FIRST run on a report path not yet in history hits the same abort. The bullet cannot simply switch to `git add <plandir>/reports/` either, because the flagged plan-<k>-risk.diff lives in that directory and a broad add before a bare commit is exactly what the bullet's second half forbids - so the add has to be bounded to the named report paths.
fix: c985c73, retest

### 8. The prose-agreement test stays green when the refusal is narrowed to `executed` alone
expected: behavior wrong (weak assertion) - the test's own comment claims it catches 'a later edit [that] can narrow [the refusal] to `executed` alone', but it only greps the arm for the literal `complete`, which the arm's explanatory sentence supplies independently of the trigger.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 1b34563: prose-agreement.test.mjs now splits the refusal arm at `-> stop:` and asserts the derived statuses against the TRIGGER clause, with an assertion that the split actually happened. Falsifiability proven live against the real execute.md: narrowing the trigger to 'DERIVED status `executed`, and no `--rerun`' while leaving the rationale sentence '`complete` is refused beside `executed` because ...' in place (grep confirms that sentence still present, count 1) now FAILS - 31 pass 1 fail, 'that refusal does not TRIGGER on derived status `complete`'. That is the exact mutation that passed before the fix. execute.md restored byte-identical (`git diff --quiet` clean) and the suite returns 32 pass 0 fail; full suite 2387 pass 0 fail 1 skipped.
reported: behavior wrong (weak assertion) - the test's own comment claims it catches 'a later edit [that] can narrow [the refusal] to `executed` alone', but it only greps the arm for the literal `complete`, which the arm's explanatory sentence supplies independently of the trigger.
severity: minor
cause: cadence-core/bin/prose-agreement.test.mjs:743-746 asserts the derived statuses against `refusal`, the WHOLE locate arm, which includes the rationale sentence '`complete` is refused beside `executed` because it re-runs identically'. That sentence supplies the literal `complete` independently of the trigger clause, so narrowing the trigger to `executed` alone leaves the assertion green. The assertion needs to run against the trigger clause only - the arm text before `-> stop:` - which is the half that decides what the step actually refuses.
fix: 1b34563, retest

### 9. Run /cad-execute <N> against a phase whose DERIVED status is `executed` and observe the refusal, then run `node cadence-core/bin/planning.mjs trace render --phase <N>`
expected: It stops in the locate step with the refusal naming /cad-undo <N> then /cad-execute <N> and --rerun; the trace shows no phase_start anchor and no executor dispatch for that invocation.
origin: verifier
why_human: Out of reach for this agent: the refusal is prose executed by the /cad-execute slash command in the user's own session, and a subagent cannot invoke a slash command or produce the trace append that would prove one did not happen. Static placement (locate at execute.md:8, ahead of git_guard at :58 and its phase_start append at :109) is already verified; only the firing is unobserved.
status: pass
first_pass: pass
source: model
evidence: Live /cad-execute 1 in this session. Precondition: `planning.mjs status` -> phases[0].status "executed" (DERIVED; cursor.status also "executed", agrees:true). The locate step ran its status call unconditionally on the $ARGUMENTS=1 branch, then stopped on bullet 4 with the refusal naming /cad-undo 1 then /cad-execute 1, and --rerun as the override. No dispatch followed. Falsifiable proof it never reached git_guard: `wc -l .planning/trace.jsonl` = 1384 immediately before the invocation and 1384 after; `tail -1` is still the cad-verifier `return` event from the deep pass, so no phase_start anchor and no lifecycle dispatch were appended for this invocation; `git rev-parse HEAD` = 87e33c1b440e88afba5388efa428ca3c5c05a0ad before and after.

### 10. Do a deliberate second run of one plan (/cad-execute <N> --rerun) and inspect <plandir>/reports/ plus git log for that plan afterwards
expected: The first run's report is readable at plan-<k>.<n>.md with its original bytes, the second run's record is at plan-<k>.md, and both are in history after the docs commit (and, on the worktree path, after the executor's own report commit - which is the gap above).
origin: verifier
why_human: Irreversible against the real repo: the only artifact that performs the rename is a live cad-executor dispatch, which writes files and makes real commits on this branch. Nothing in the tree imports report-rotation.mjs at runtime, so no read-only probe can observe the rule being obeyed.
status: pass
first_pass: pass
source: model
evidence: Live /cad-execute 1 --rerun, sequential path (1 plan < min_plans_for_parallel 2), PHASE_START ef17e85. Executor rotated reports/plan-1.md -> plan-1.1.md before its first report write via rotationTarget, and wrote its own record to plan-1.md (6848 bytes). Byte-identity proven three ways, all sha256 9292e88484773cfea397b6c8b41fc19bef91c7337a938c35024a3f12c2f5ee88: the pre-run snapshot taken before dispatch, the rotated plan-1.1.md on disk, and `git show HEAD:.planning/phases/1/reports/plan-1.md` from before the run. Both records are in history after the docs commit a0848ae: `git ls-tree --name-only HEAD .planning/phases/1/reports/` lists plan-1.1.md and plan-1.md, and `git show HEAD:.planning/phases/1/reports/plan-1.1.md` still hashes to 9292e884. Staged as the reports/ DIRECTORY with ':(exclude)*.diff'; `git diff --cached --name-status` showed exactly A plan-1.1.md and M plan-1.md. The worktree half of the transport was NOT exercised - this run was sequential, so item 7's gap stands unretested by this probe. 7 of 7 tasks already satisfied, no re-made work, no empty commits.
reported: yes override and commit

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
