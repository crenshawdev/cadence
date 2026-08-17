PLAN CHECKPOINT: structural
Plan: .planning/phases/4/PLAN-3.md
Tasks: 3 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - The dated arithmetic, written down where a milestone close cannot reach it | 3bf1653 | `design-notes/dd-plan-task-ceiling.md` force-added past `.gitignore`'s `/design-notes/dd-*.md`; every figure re-derived at execution time |
| 2 - The decision lands on the two surfaces a check binds | a8d7946 | schema `purpose` + catalog row carry the same three figures (12,488 bytes / 15 executor checkpoints of 21 / landing on 8); `config-catalog.md` re-pinned 8,815 to 9,257; `config.mjs get workflow.max_plan_tasks` still 8 |
| 3 - The PLN-01 falsifier, watched failing at a named SHA | 9e5529e | `WATCHED FAILING AT 617a2a1` - watched in a detached worktree, exit 1 on the `notStrictEqual` for the missing `landed` extraction; deleting the catalog's checkpoint figure alone fails naming both extractions (restored); 29/29 pass here |
| 4 - AC6's watched-FAIL record reaches the SUMMARY | none | CHECKPOINT - see below; the section's text is prepared and proved |

Tree state at checkpoint: `node --test cadence-core/bin/*.test.mjs` exit 0 (2,150
pass, 0 fail), `node cadence-core/bin/self-verify.mjs` exit 0, `npx tsc -p
tsconfig.ci.json` exit 0 (`workflow.lint_command` is unset and `detect-commands`
reports `lint: null`, so typecheck is the whole static-analysis arm).

## CHECKPOINT: structural - task 4 needs a SUMMARY.md write this executor may not make

Task 4 assigns `.planning/phases/4/SUMMARY.md` to this plan. The executor
contract's `<never>` list forbids an executor writing SUMMARY.md ("the
orchestrator aggregates reports into the phase SUMMARY.md and owns all state
writes"), and the contract wins over the plan. Two further facts make it
unexecutable as written rather than merely forbidden: the file does not exist
yet, so there is nothing for the task's "APPEND to whatever `/cad-execute` has
already written" to append to; and the plan's own ordering note says this task
runs LAST in the phase, which is after this dispatch returns.

Nothing else in the plan depends on it. Tasks 1-3 are committed and green, and
AC5 is satisfied by them. AC6's record is the only thing outstanding, and its
content is below, already verified by the per-line extraction AC6 demands.

### What the orchestrator appends, verbatim

```
## AC6: watched failures

Each requirement's falsifier carries a `WATCHED FAILING AT <sha>` header naming
the commit it was watched failing at, quoted here from the header as it stands
rather than from the plan. The audit EXTRACTS the SHA from each line and from
the named file's headers and compares the two per requirement; it never counts
occurrences of the phrase, and two of the three share one file, so a per-file
count proves nothing.

- MSR-03 - falsifier in `cadence-core/bin/window-budget.test.mjs` ("the falsifier: a live window is budgeted the way prose surfaces are"), header `WATCHED FAILING AT 9b1fe53`. Re-watch: `git worktree add --detach <tmp> 9b1fe53`, copy that file into `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/window-budget.test.mjs` from `<tmp>`, then `git worktree remove <tmp>`.
- TRN-02 - falsifier in `cadence-core/bin/prose-agreement.test.mjs` ("TRN-02: the bulk-output rule, stated once, and the sites that obey it"), header `WATCHED FAILING AT 86cd45d`. Re-watch: `git worktree add --detach <tmp> 86cd45d`, copy that file into `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs` from `<tmp>`, then `git worktree remove <tmp>`.
- PLN-01 - falsifier in `cadence-core/bin/prose-agreement.test.mjs` ("PLN-01: the plan-task ceiling's decision, read off both bound surfaces"), header `WATCHED FAILING AT 617a2a1`. Re-watch: `git worktree add --detach <tmp> 617a2a1`, copy that file into `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs` from `<tmp>`, then `git worktree remove <tmp>`.
```

### The proof that block already passes AC6's own audit

Each line's SHA was extracted from the line, the `WATCHED FAILING AT` headers
were extracted from the file that same line names, and the two were compared per
requirement - never by counting occurrences:

```
MSR-03 cadence-core/bin/window-budget.test.mjs   line-sha=9b1fe53 file-headers=[9b1fe53] MATCH
TRN-02 cadence-core/bin/prose-agreement.test.mjs line-sha=86cd45d file-headers=[cdf8676,4b1d659,86cd45d,617a2a1] MATCH
PLN-01 cadence-core/bin/prose-agreement.test.mjs line-sha=617a2a1 file-headers=[cdf8676,4b1d659,86cd45d,617a2a1] MATCH
requirements=3 distinct-shas=3 AC6 OK
```

The per-file count is 1, 4 and 4, which is why the audit binds by extraction:
TRN-02 and PLN-01 share `prose-agreement.test.mjs`, so "the file carries the
phrase" is true there for four different SHAs and proves nothing about either.

Deviations:
[deviation] The plan and CONTEXT D-10 assert `design-notes/` is tracked. `.gitignore:23` ignores `/design-notes/dd-*.md` ("Candid design explorations stay local; the dated records beside them are tracked"), so the path the plan names sits in the UNTRACKED family. Task 1's Verify requires the file be tracked and `.gitignore` is outside this plan's lease, so the note is `git add -f`-ed and states in its own header why it is tracked past that line.
[deviation] The plan asserts 20 `checkpoint` events, 14 of them `cad-executor` (CONTEXT D-17). Re-counted at execution time the record holds 21 and 15 - phase 4's own plan-1 dispatch added one while this phase ran. The note and both shipped surfaces publish the re-counted pair with its date, and the note states that the numerator moves too, not only the dispatch/return denominators the plan anticipated (182/157 at execution against D-17's 177/153).
[deviation] The plan quotes `zeroResidentBytes` 38,492 (D-09). A live `weight.mjs resident` reports 40,577, which is the figure the note quotes. The four `dispatchBytes` figures the plan quotes reproduce exactly.
[deviation] The plan names `37796d0` as the unpatched tip for the falsifier header. Plans 1 and 2 landed first, so the commit immediately preceding this plan's first implementation commit is `617a2a1`; that is the SHA watched, quoted and re-watchable.
[deviation] The plan's task 1 quotes the executor mean return as 144,752 and the 75th percentile as 185,999 without naming the population. Re-derived at execution over every terminal lifecycle event carrying `tokens` (`return` plus `checkpoint`), the executor set is n=75, mean 147,740, p75 185,999, max 275,285 - the p75 reproduces exactly on that population and the mean does not, so the note publishes the re-derived pair with the population and command that produce both.
Open items:
- `.gitignore`'s `/design-notes/dd-*.md` line and the tracked note now disagree in spirit: the file is tracked by force rather than by rule. The one-line fix is a negation (`!/design-notes/dd-plan-task-ceiling.md`) or renaming the note into the dated tracked family the same comment describes; both need a file outside this plan's lease, and neither changes what task 1's Verify asserts.
