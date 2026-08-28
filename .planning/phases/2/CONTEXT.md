# Phase 2: One targeted run, one suite run - Context

Gathered: 2026-08-28
Feeds: /cad-plan 2

## Scope boundary

In: `skills/cad-executor-contract/SKILL.md` - step 2's verification rule and the
single full-suite site; the one sentence bounding the targeted fix loop; the
contract's single `workflow.test_command` mention. Plus the
`workflow.test_command` honoured-by cell in `cadence-core/references/config-reach.md`,
new assertions in `cadence-core/bin/prose-agreement.test.mjs`, and the
`weight-budgets.json` re-pin for every edited surface.

Out: `workflows/task.md`, `workflows/coverage.md` and
`references/execute-parallel.md` - each honours `workflow.test_command` for
reasons outside this phase's goal and keeps its run (D-02). Also out:
`workflows/execute.md`'s dispatch prompt, which D-03 deliberately leaves
untouched; and the `detect-commands`-per-dispatch item, which stays in
`.planning/CAPTURE.md`.

Deferred: None.

Plan shape: one plan.

## Durable decisions

- D-01 (Suite site, OQ-2): the full suite runs ONCE PER DISPATCH, immediately
  before the digest - not per task inside the commit compound. Evidence:
  `skills/cad-executor-contract/SKILL.md:86-110` (the whole commit protocol)
  carries no test invocation today, so "again inside the commit compound" in the
  roadmap read is executor improvisation rather than contract text being
  followed; `/code/smithers/.planning/phases/1/reports/plan-1.md:6-15` shows the
  role already closing a dispatch with one "Final state: full suite `uv run
  pytest` 71 passed" line. Mirrors the shipped verifier rule at
  `skills/cad-verifier-contract/SKILL.md:126-131`. Both OQ-2 arms fit criterion
  4's ceiling, so this was decided on shape, not budget. Rejected: per-task in
  the commit compound - new prose against the grain of observed behaviour, and
  it authorises N runs per dispatch.

- D-02 (Key reach): "and nowhere else" is scoped to the EXECUTOR CONTRACT's own
  text - the contract names `workflow.test_command` at exactly one site,
  checkable by `grep -c`. `workflows/task.md:92` (inline path),
  `workflows/coverage.md:34,63` and `references/execute-parallel.md:29` (the
  post-batch run) keep theirs, and the reach row at
  `cadence-core/references/config-reach.md:133` is not otherwise changed.
  Evidence: none of those three has an executor or a targeted `Verify:` to fall
  back to, so a tree-wide reading strips `/cad-coverage` and `/cad-task`'s
  inline path of their only test runner and deletes the parallel path's only
  post-merge suite gate.

- D-03 (Command path): the site names `config.mjs get workflow.test_command`
  inline, matching what `references/execute-parallel.md:29` already ships.
  Evidence: `grep -n "config.mjs" skills/cad-executor-contract/SKILL.md` returns
  nothing today, so the contract's current "`workflow.test_command` from config
  if set" tells the executor to read a file it is never shown how to read - and
  a hand-rolled `cat .planning/config.json` reads the STRIPPED repo layer, not
  the honoured user-global one (`cadence-core/bin/lib/global-only-keys.mjs`,
  `config.schema.json:39`). Rejected: resolving it once in
  `workflows/execute.md` and handing it down in the dispatch prompt's stable
  half - cheaper per dispatch, but widens this phase into execute.md's prompt,
  which is deliberately stable-first and enumerates no config
  (`workflows/execute.md:200-224`).

- D-05 (Fallback wording): the "test file the task's files map to" fallback
  borrows the verifier contract's SHIPPED wording
  (`skills/cad-verifier-contract/SKILL.md:126-131`, mirrored at
  `METHOD.md:239-241`) rather than being invented, and the pair is pinned
  together in `cadence-core/bin/prose-agreement.test.mjs`. Evidence: a grep for
  "full suite"/"whole suite" over `cadence-core/`, `skills/` and `METHOD.md`
  returns no other shipped prose on this. If wrong: two contracts state a
  near-identical rule in different words with no pair holding them together,
  which is how `Verify:`-as-authority drifted for three releases.

## Decisions

- D-04 (Targeted run): the targeted run comes from the task's own `Verify:`
  command - no change to `skills/cad-planner-contract/SKILL.md` or
  `cadence-core/templates/PLAN.md`. Evidence: measured over the 9 PLAN files in
  `/code/smithers/.planning/phases/` (55 `- **Verify:**` blocks), 52 name a
  file-scoped run, 2 a bare suite run, 1 a non-pytest tool; authoring rules at
  `skills/cad-planner-contract/SKILL.md:119-132` and
  `cadence-core/templates/PLAN.md:39-42`; `Verify:` is already pinned as the
  task authority by `cadence-core/bin/prose-agreement.test.mjs:221-247`.

- D-06 (Loop bound): the re-run-targeted-until-green sentence sits WITH the
  existing "A blocker gets three bounded fix attempts per task" bound in
  `<deviation_rules>`, deferring to it rather than stating a second budget.
  Evidence: `skills/cad-executor-contract/SKILL.md:58-65` (step 2 in full)
  carries no loop rule today, and `cadence-core/workflows/debug.md` never
  invokes a suite, so no other surface owns the loop.

- D-07 (Edit shape): new prose may be appended inside `<process>` and may
  renumber `<commit_protocol>` freely, but must NOT insert a numbered item ahead
  of `<process>` item 1 - `references/lean-build.md` is registered as a deferred
  read at region anchor `1` (`cadence-core/bin/lib/deferred-reads.mjs:222-226`,
  `regionLabels` at `:296-323, :327-395`), enforced through self-verify's
  `deferred-reads` check.

- D-08 (Budgets): the edit re-pins `cadence-core/bin/weight-budgets.json`. The
  contract is 12,811 B against a 12,970 pin at `:97` - 159 B of headroom.
  `cadence-core/references/config-reach.md` is AT its budget (23,726 B, `:28`),
  so any growth there re-pins too. A budget is a ceiling, not an equality
  (`cadence-core/bin/self-verify.mjs:784-819`), so a shrink needs no re-pin.

- D-09 (Counting rule for AC6): a "bare full-suite invocation" is a
  `reads.jsonl` record with `tool:"Bash"`, grouped by `agent_id`, whose `target`
  is a runner program and which carries NO `files` array. Evidence:
  `cadence-core/bin/lib/read-trace.mjs:241-249` (`rec.target = programOf(...)`;
  `rec.files` added only when non-empty), `:100-104`, `:154-200`. Reproduced
  against `/code/smithers/.planning/reads.jsonl` over 1,571 records - per
  executor `agent_id` the bare/targeted counts were 6/5, 6/6, 13/7, 14/11, 5/1,
  27/3, 21/3, which is the roadmap's "6 to 29 per dispatch". Two distortions the
  rule must state: the recorded program is `uv`, `python3`, `timeout` or `node`
  rather than `pytest`, so the program set is project-specific; and a directory
  argument such as `pytest tests/` records no `files` and counts bare though it
  is not the full suite.

- D-10 (Test registration): a new prose-agreement assertion needs no
  registration - an unnamed stem lands in the `other` group, which the default
  run and CI both execute (`cadence-core/bin/test.mjs:20-22`). No existing test
  pins the sentences this phase rewrites.

- D-11 (Reach cell): `cadence-core/references/config-reach.md`'s honoured-by
  cell is free text self-verify never asserts - `reachIssues` emits only
  `missing-reach-row`, `unknown-reach-key` and `unstated-reach`
  (`cadence-core/bin/lib/config-reach.mjs:148-175`), and `honouredBy` is parsed
  at `:127` and never checked. A changed site list is a HAND edit that a green
  run cannot catch.

## Acceptance criteria

- [ ] AC1: `skills/cad-executor-contract/SKILL.md` step 2 names the task's
      `Verify:` command (falling back to the test file the task's files map to)
      as the verification, and names the full suite's single site as
      "immediately before the digest, once per dispatch". A grep for any test
      invocation inside `<commit_protocol>` returns nothing.
- [ ] AC2: The contract carries one sentence saying a failing targeted run is
      re-run targeted until green and the suite is not touched inside that loop,
      and that sentence defers to the existing "three bounded fix attempts per
      task" bound rather than stating a second budget.
- [ ] AC3: `grep -n "test_command" skills/cad-executor-contract/SKILL.md`
      returns exactly one line, and that line names
      `config.mjs get workflow.test_command`. The same grep over
      `cadence-core/workflows/task.md`, `cadence-core/workflows/coverage.md` and
      `cadence-core/references/execute-parallel.md` returns the same line counts
      it returns today.
- [ ] AC4: `cadence-core/bin/prose-agreement.test.mjs` gains assertions that go
      red when either the suite-site sentence or the targeted-run sentence is
      deleted from the contract, demonstrated by deleting each and showing the
      suite fail.
- [ ] AC5: `cadence-core/references/config-reach.md`'s `workflow.test_command`
      honoured-by cell names the executor contract's single site, matching what
      the contract now says.
- [ ] AC6: Measured on the next foreign-project executor dispatch, bare
      full-suite invocations per dispatch, counted by the D-09 rule from
      `reads.jsonl`, are at or below 1. (human-verify: needs a foreign-project
      run)
- [ ] AC7: `node cadence-core/bin/test.mjs` reports fail 0,
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`, and
      `weight-budgets.json` is re-pinned for every edited surface.

## Flagged assumptions

- The criterion-4 reduction has to come from prose that binds when
  `workflow.test_command` is NULL - the smithers baseline ran with it unset
  (`/code/smithers/.planning/config.json:14-15`) and the executors ran
  `uv run pytest` because the plans and the contract said so, not because config
  named it. Confident; if wrong, the phase ships a config-key relocation and the
  next foreign project measures the same 5-27 bare runs.
- `references/execute-parallel.md:24-30` is a second live suite site on the
  parallel path. D-02 keeps it, but a literal later reading of AC3's "nowhere
  else" could still delete it. Confident; if wrong, the parallel path silently
  loses its only post-merge suite gate.
