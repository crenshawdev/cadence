---
phase: 2
status: complete
completed: 2026-08-28
---

# Phase 2: One targeted run, one suite run - Summary

The executor contract now verifies a task with the task's own `Verify:` command
(falling back to the test file its `files:` map to, run by name) and runs the
project's full suite at exactly one site - after the last task's commit, before
the digest - with both sentences pinned by falsifiable prose tests.

## What shipped

- Targeted-run verification - `skills/cad-executor-contract/SKILL.md:58-66`
  (`<process>` step 2): the task's `Verify:` command is what verifies the task,
  the by-name test file is the fallback, and the suite is refused per task and
  as a first probe. The `workflow.test_command` parenthetical is gone.
- The single full-suite site - `skills/cad-executor-contract/SKILL.md:83-95`:
  after the last task's commit and report write, immediately before the digest,
  at most once per dispatch, resolving its command inline via
  `config.mjs get workflow.test_command` with the null arm stated and the
  hand-rolled `.planning/config.json` read forbidden (that key is honoured from
  the user-global layer alone).
- The targeted re-run loop - `skills/cad-executor-contract/SKILL.md:158-163`:
  folded into the existing three-bounded-attempts bullet, which is also the
  loop's whole budget; no second budget opened.
- Falsifiable pins - `cadence-core/bin/prose-agreement.test.mjs`: four EXP-05
  tests plus the D-05 pair pin against `skills/cad-verifier-contract/SKILL.md`,
  located by offsets, each half carrying an in-memory falsifier
  (`node --test cadence-core/bin/prose-agreement.test.mjs`: 57 pass, 0 fail).
- The reach row - `cadence-core/references/config-reach.md:133`: names the
  contract's one suite site rather than the contract at large.
- Re-pinned byte budgets - `cadence-core/bin/weight-budgets.json`: contract
  12,970 -> 13,965 B, `config-reach.md` 23,726 -> 23,808 B.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 1bd6fc7e | feat(2-1): the targeted run is what verifies a task |
| 1 | 2 | 08e9ece3 | feat(2-1): one full-suite run per dispatch, immediately before the digest |
| 1 | 3 | 6f89ae1b | test(2-1): pin both sentences, and pin them against the verifier contract |
| 1 | 4 | 8f72c420 | docs(2-1): the reach row names the contract's one site |

## Deviations

- [deviation] The plan's `## Must be true when done` said "Step 2 names no suite
  and no config key", while task 1's `Verify:` required a step-2 line carrying
  "full test suite per" completed with `task`. The two cannot both hold
  literally; the `Verify:` was followed as the stated authority. Step 2 names
  the suite only to forbid it per task and to point at its one site, and names
  no config key. (1bd6fc7e)
- [deviation] Task 2's `Verify:` asserted that a perl range over
  `<commit_protocol>` piped to `grep -niE "test|suite"` returns nothing. It
  never did on any tree: item 3 of that block lists the conventional-commit type
  `test`. Confirmed against the pre-edit tree under `git stash`. The criterion
  AC1 actually states - no test INVOCATION in the block - holds: the same range
  greps clean for `run |pytest|npm test|test\.mjs|suite|test_command`. The new
  prose was also reworded from "never inside `<commit_protocol>`" to "never
  inside the commit protocol below", because the literal tag inside `<process>`
  opened the perl range early and swept the new prose into the block's output.
  (08e9ece3)

## Open items

- None.

## Goal check

The four commits deliver the phase goal. Step 2 of the contract now names the
task's own `Verify:` as the verification with a by-name fallback and forbids the
suite per task (`skills/cad-executor-contract/SKILL.md:61`, "run by name. Never
the full test suite per task"), which is SC1's first half; the suite's single
site sits immediately before the digest at line 85 ("At most one full-suite run
per dispatch"), which is its second. SC2's sentence is at line 159-161, inside
the existing three-attempts bullet. SC3 holds arithmetically:
`grep -c test_command skills/cad-executor-contract/SKILL.md` prints `1` and that
line is `config.mjs" get workflow.test_command` (line 91), while
`workflows/task.md`, `workflows/coverage.md` and
`references/execute-parallel.md` still print `1`, `2` and `1`. SC5 holds:
`node cadence-core/bin/test.mjs` reported 3512 pass / 0 fail on the executor's
one suite run, and `node cadence-core/bin/self-verify.mjs` prints
`{"ok":true,...,"problems":[]}` on the committed tree. SC4 is not closable in
this tree and no task claimed it: it measures bare full-suite invocations per
executor dispatch on the NEXT foreign-project run, against the 2026-08-28
baseline of 6, 6, 13, 14, 5, 27, 21 taken from
`/code/smithers/.planning/reads.jsonl`. It reaches UAT from CONTEXT.md's AC6 as
the phase's one human-verify criterion, and until that run exists the phase's
effect on the tool-call floor is prescribed by the contract rather than
measured.
