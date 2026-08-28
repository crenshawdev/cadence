---
phase: 2
plan: 1
requirements:
  - EXP-05
files:
  - skills/cad-executor-contract/SKILL.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/references/config-reach.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: One targeted run, one suite run - Plan

## Goal

An executor verifies each task with the test the task names and runs the
project's full suite at one stated site per dispatch, so the per-task tool-call
floor drops from three test invocations to two and a debugging loop reruns a
file, not a suite.

## Must be true when done

- Reading `<process>` step 2 of `skills/cad-executor-contract/SKILL.md` tells
  you what verifies a task: the task's own `Verify:` command, and where the task
  names none, the test file the task's files map to, run by name. Step 2 names
  no suite and no config key.
- The contract says once, in `<deviation_rules>`, that a failing targeted run is
  re-run targeted until green with the suite untouched inside that loop, and it
  hands the loop's budget to the three bounded fix attempts per task that are
  already stated there rather than opening a second budget.
- The contract names exactly one full-suite site: after the last task's commit
  and immediately before the digest, once per dispatch, never as a first probe
  and never between tasks - and it says what to run both when
  `workflow.test_command` is set and when it is null.
- `grep -c test_command skills/cad-executor-contract/SKILL.md` prints `1`, that
  line carries `config.mjs" get workflow.test_command`, and the same grep over
  `cadence-core/workflows/task.md`, `cadence-core/workflows/coverage.md` and
  `cadence-core/references/execute-parallel.md` still prints `1`, `2` and `1`.
- `grep -n` for any test or suite invocation inside the contract's
  `<commit_protocol>` block returns nothing.
- Deleting either the targeted-run sentence or the suite-site sentence from the
  contract turns `node --test cadence-core/bin/prose-agreement.test.mjs` red,
  and the same file pins the executor's wording against the verifier contract's
  shipped wording so the pair cannot drift apart.
- `cadence-core/references/config-reach.md`'s `workflow.test_command` row names
  the executor contract's one site rather than the contract at large.
- `node cadence-core/bin/test.mjs` reports fail 0 and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with
  `cadence-core/bin/weight-budgets.json` re-pinned for every surface this plan
  grew.

## Context

Locked: D-01 (the suite runs once per dispatch, immediately before the digest,
not per task in the commit compound); D-03 (the site names
`config.mjs get workflow.test_command` inline, the spelling
`cadence-core/references/execute-parallel.md:29` already ships); D-04 (the
targeted run is the task's own `Verify:`; the planner contract and
`templates/PLAN.md` are NOT touched); D-05 (the fallback borrows the verifier
contract's shipped wording at `skills/cad-verifier-contract/SKILL.md:126-131`,
and the pair is pinned in `prose-agreement.test.mjs`); D-06 (the loop sentence
sits with the existing three-attempts bound in `<deviation_rules>`); D-07 (no
new numbered item may be inserted ahead of `<process>` item 1 - `lean-build.md`
is a registered deferred read at region anchor `1`).

Out of scope, and no task may touch them: `cadence-core/workflows/task.md`,
`cadence-core/workflows/coverage.md`,
`cadence-core/references/execute-parallel.md`,
`skills/cad-verifier-contract/SKILL.md` (read-only, it is the wording source),
`skills/cad-planner-contract/SKILL.md`, `cadence-core/templates/PLAN.md` and
`cadence-core/workflows/execute.md`.

Standing constraint for every task below: `cadence-core/bin/self-verify.mjs`
enforces `weight-budgets.json` as a per-surface byte CEILING
(`self-verify.mjs:797-819`), the contract sits at 12,811 B against a 12,970 pin
and `config-reach.md` sits exactly AT its 23,726 pin, so a task that grows
either surface re-measures with `node cadence-core/bin/weight.mjs` and re-pins
that surface's row in the SAME commit.

## Tasks

### Task 1: The targeted run is what verifies a task

- **Files:** skills/cad-executor-contract/SKILL.md (`<process>` step 2, and the
  `Boundaries:` bullet in `<deviation_rules>` that begins "A blocker gets three
  bounded fix attempts per task"), cadence-core/bin/weight-budgets.json
- **Action:** Rewrite `<process>` step 2 so the thing run is the task's own
  `Verify:` command, and where a task names none, the test file the task's files
  map to, run BY NAME. Keep step 2's existing prediction-first discipline whole -
  state the expected output before running, compare after, record a surprise as
  `[deviation] expected X, observed Y` - and keep it a numbered item at position
  2, because `cadence-core/bin/lib/deferred-reads.mjs` registers
  `references/lean-build.md` at region anchor `1` and any item inserted above it
  breaks self-verify's `deferred-reads` check (D-07). Delete the parenthetical
  "(`workflow.test_command` from config if set and relevant, otherwise directly
  observe the changed behavior)": the key moves to task 2's single site, and
  "if set and relevant" is the phrasing this phase exists to remove. Borrow the
  verifier contract's SHIPPED vocabulary rather than inventing a synonym (D-05):
  `skills/cad-verifier-contract/SKILL.md:126-131` says "Never run the full test
  suite per truth" and "prove one passes by running it by name", so step 2 must
  carry the phrase "full test suite per" completed with `task`, and the phrase
  "by name". Then, in `<deviation_rules>`, extend the existing three-attempts
  bullet with ONE sentence: a failing targeted run is re-run targeted until
  green, the suite is not touched inside that loop, and those same three
  attempts bound it. Do not state a second budget and do not add a new bullet or
  a new block - the bound already exists and D-06 defers to it. Say nothing new
  about what a red suite means; `<deviation_rules>` already owns blockers.
  Re-measure and re-pin the contract's `weight-budgets.json` row in this commit.
- **Verify:** `grep -c test_command skills/cad-executor-contract/SKILL.md`
  prints `0` (the key has left step 2 and task 2 has not yet added its site);
  `grep -n "by name" skills/cad-executor-contract/SKILL.md` returns a line
  inside `<process>` step 2; `grep -n "full test suite per"` returns a step-2
  line ending in `task`; `grep -n "three bounded fix attempts"` returns the
  `<deviation_rules>` bullet and the sentence beside it names the targeted
  re-run and says the suite is not touched; and
  `node cadence-core/bin/self-verify.mjs` prints `ok:true`.

### Task 2: One full-suite run per dispatch, immediately before the digest

- **Files:** skills/cad-executor-contract/SKILL.md (the trailing "After the last
  task: return the digest." line that closes `<process>`, and
  `<commit_protocol>`), cadence-core/bin/weight-budgets.json
- **Action:** Replace `<process>`'s closing "After the last task: return the
  digest." with the one full-suite site. It must state: the run happens after
  the last task's commit and its report write, immediately before the digest;
  it happens ONCE per dispatch; it is never a first probe and never runs between
  tasks. It resolves the command inline, in the spelling
  `cadence-core/references/execute-parallel.md:29` already ships -
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get
  workflow.test_command` - and this must be the contract's ONLY mention of that
  key (D-02 scopes "nowhere else" to this document; the three other honouring
  surfaces keep theirs). A hand-rolled read of `.planning/config.json` is
  forbidden and worth saying why in the prose: that file is the STRIPPED repo
  layer and this key is honoured from the user-global layer only
  (`cadence-core/bin/lib/global-only-keys.mjs`). State the NULL arm too - when
  the key is unset, run the suite the project's own manifest names - because the
  measured baseline ran with it unset and prose that binds only when it is set
  changes nothing. Carry the verifier contract's shipped phrase "At most one
  full-suite run per" (`skills/cad-verifier-contract/SKILL.md:128`) completed
  with `dispatch`. Add this as prose closing `<process>`, not as a new numbered
  item ahead of item 1 (D-07). Leave `<commit_protocol>` free of any test or
  suite invocation - it carries none today and D-01 rejected putting one there.
  Re-measure and re-pin the contract's `weight-budgets.json` row in this commit.
- **Verify:** `grep -c test_command skills/cad-executor-contract/SKILL.md`
  prints `1` and that line carries `config.mjs" get workflow.test_command`; the
  same grep prints `1`, `2` and `1` for `cadence-core/workflows/task.md`,
  `cadence-core/workflows/coverage.md` and
  `cadence-core/references/execute-parallel.md`;
  `perl -ne 'print if /<commit_protocol>/../<\/commit_protocol>/'
  skills/cad-executor-contract/SKILL.md | grep -niE "test|suite"` returns
  nothing; `grep -n "At most one full-suite run per"` returns a line ending in
  `dispatch`; and `node cadence-core/bin/self-verify.mjs` prints `ok:true`.

### Task 3: Pin both sentences, and pin them against the verifier contract

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add assertions that go red when either new sentence is deleted
  from the contract, following the shape this file already uses at
  `assertNoneArm` and `assertConfirmBeforeCreate`: a helper taking the document
  TEXT as a parameter, one test calling it on the live document via the existing
  `doc()` reader, and a second test handing it a scratch IN-MEMORY copy with the
  sentence cut and asserting `assert.throws` - a check that can only read the
  live tree has never been shown able to fail, which is the species of green
  this file exists to refuse. Cover both halves. The targeted-run half asserts
  step 2 takes its subject from the task's `Verify:` and runs by name, and that
  no suite or `test_command` mention has come back into it. The suite-site half
  asserts the site is single, sits after the last task and before the digest,
  carries the `config.mjs" get workflow.test_command` invocation, and that
  `<commit_protocol>` holds no test invocation. Pin the PAIR as D-05 requires:
  read `skills/cad-verifier-contract/SKILL.md` too and assert both documents
  still carry the shared phrases "full test suite per" and "At most one
  full-suite run per", with the verifier completing them `truth` and
  `verification` and the executor `task` and `dispatch` - so a reword on either
  side reddens rather than drifting. Locate regions by OFFSETS in the document's
  own text, never by line numbers, for the reason the neighbouring falsifiers
  record: an inserted paragraph moves every line and would redden a check about
  order that nothing about the order changed. The file needs no test-group
  registration - it is already the `prose-agreement` stem in
  `cadence-core/bin/test.mjs:72`.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0.
  Then delete the suite-site sentence from
  `skills/cad-executor-contract/SKILL.md`, re-run that command and it exits
  non-zero naming the suite-site check; restore with
  `git checkout -- skills/cad-executor-contract/SKILL.md`. Repeat for the
  targeted-run sentence, restoring the same way, and commit only the restored
  tree. Finally `node cadence-core/bin/test.mjs` reports fail 0.

### Task 4: The reach row names the contract's one site

- **Files:** cadence-core/references/config-reach.md (the
  `| workflow.test_command |` row), cadence-core/bin/weight-budgets.json
- **Action:** The row's third cell currently ends "and the executor contract",
  which was true when the contract mentioned the key vaguely in step 2 and is
  now imprecise. Change that clause alone so it names the one site the contract
  now has - the once-per-dispatch suite run immediately before the digest -
  matching the sentence task 2 wrote. Change nothing else in the row: the first
  cell stays `workflow.test_command` and the second stays "user-global config
  layer only", because `cadence-core/bin/lib/config-reach.mjs` `reachIssues`
  checks the reach cell against the schema key's `purpose` and a reworded reach
  raises `unstated-reach`. Touch no other row. This cell is free text nothing
  asserts (`config-reach.mjs:127` parses `honouredBy` and never checks it), so a
  green run cannot catch a wrong site name here - read task 2's committed
  sentence and copy what it says rather than paraphrasing from memory. The file
  sits exactly at its 23,726 B pin, so re-measure and re-pin its
  `weight-budgets.json` row in this commit.
- **Verify:** `grep -n "workflow.test_command"
  cadence-core/references/config-reach.md` returns one row whose third cell
  names the once-per-dispatch site before the digest and still names
  `workflows/task.md`, `workflows/coverage.md` and
  `references/execute-parallel.md`; `git diff --stat` for this commit shows one
  changed line in `config-reach.md`; `node cadence-core/bin/self-verify.mjs`
  prints `ok:true` with no `unstated-reach` problem; and
  `node cadence-core/bin/test.mjs` reports fail 0.

## Notes

AC6 is the phase's one human-verify criterion and no task can close it: it
measures bare full-suite invocations per executor dispatch on the NEXT
foreign-project run, which does not exist in this tree. It reaches UAT from
CONTEXT.md rather than from a task. The counting rule to apply when that run
happens is D-09: a `.planning/reads.jsonl` record with `tool:"Bash"`, grouped by
`agent_id`, whose `target` is a runner program and which carries NO `files`
array (`cadence-core/bin/lib/read-trace.mjs:241-249`); the 2026-08-28 baseline
taken that way over `/code/smithers/.planning/reads.jsonl` was 6, 6, 13, 14, 5,
27, 21 bare runs per executor `agent_id`, and the target is at or below one per
dispatch.

Recalled prior art, weighed and NOT acted on: the CAPTURE.md item that every
executor dispatch re-asks `detect-commands` (measured 2026-08-28 across six
smithers executors) sits in `<process>` step 3, one item below the step this
plan rewrites. CONTEXT's scope boundary leaves it in CAPTURE.md, so no task
touches step 3.

Plan shape follows the CONTEXT directive: one plan. The four tasks share
`skills/cad-executor-contract/SKILL.md` and `weight-budgets.json`, so no split
was available under the independence test in any case.
