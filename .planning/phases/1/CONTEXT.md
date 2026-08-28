# Phase 1: The fix pass is a dispatch - Context

Gathered: 2026-08-28
Feeds: /cad-plan 1

## Scope boundary

In: every blocking-gate FAIL site that has a plan key names a continuation
`cad-executor` as the owner of the fix, dispatched under that plan's worker key
and bracketed like any executor; the coordinator issues no `Edit` or `Write`
outside `.planning/` in those workflows; the lease is widened before a fix that
needs it; and the one-round re-arm cap is keyed per plan so a second plan's fix
can still be reviewed.
Out: the staged-fix sites that have no plan key (`workflows/debug.md`,
`workflows/verify.md`) keep the coordinator as the fix author - that is the
design there, not an oversight. `/cad-task`'s inline path keeps its own
prohibition on spawning a subagent. No change to what the gates detect, to the
adjudication format, or to the triage presentation.
Deferred: recording `Write`/`Edit`/`MultiEdit` in `reads.jsonl` - considered as
the direct proof for the "no coordinator writes" half and rejected for this
phase: it is new surface in an otherwise prose phase, and `reads.jsonl` is at
7.00 of 8.00 MiB on this repo (GH-145) and goes permanently write-dead at the
cap. The trace-bracket proof (D-05) stands in.
Plan shape: multiple plans, same phase. Not a task-count judgment - all six
target files sit at exactly zero byte headroom (D-17), so every plan must
declare `cadence-core/bin/weight-budgets.json` and two prose plans would
therefore collide on that path and route sequential regardless. The natural line
is the FAIL-branch dispatch and guardrail across `execute.md`,
`execute-parallel.md` and `task.md` (AC1, AC2, AC6) against the lease amendment
and the re-arm key with their tests (AC3, AC4); `/cad-plan` draws it.

## Durable decisions

- D-01 (The lease): a fix whose findings name a path outside the plan's `files:`
  lease is unblocked by WIDENING the lease - the coordinator amends
  `PLAN-<k>.md`'s `files:` before dispatching - never by exempting the fix
  dispatch from `lease-check` and never by routing the refusal back to the user.
  `PLAN-<k>.md` is inside `.planning/`, so the guardrail's own path wording
  permits this write with no exception clause. Rejected: a `lease-check` exempt
  flag, which deletes the one gate that catches an unlicensed path; and a
  `blocked` round trip to the ask-user seam, which consults exactly the seam the
  coordinator's own edit was avoiding. Evidence: `.planning/ARCHIVE.md:975`
  records this precise remedy already used and recorded ("the lease was made true
  ... rather than bypassed"); the counter-cases are recorded as defects at
  `.planning/ARCHIVE.md:750` and `:767`;
  `cadence-core/bin/planning/lease-check.mjs:490-501`'s own hint states the same
  remedy.
- D-02 (Which sites the rule binds): the rule binds wherever a PLAN KEY exists -
  `cadence-core/workflows/execute.md`'s `risk_surface` and `diff`-at-`adjudicated`
  arms, `cadence-core/references/execute-parallel.md`'s per-plan risk sequence,
  and `cadence-core/workflows/task.md`'s `--plan` path. It does NOT extend to the
  shape-(b) staged-fix sites, where the coordinator applying the fix is the design
  and there is neither a plan nor a key to dispatch under. Stating it as "wherever
  a plan key exists" makes the carve-out fall out of the key's absence rather than
  out of a second enumerated list. Evidence:
  `cadence-core/references/review-triggers.md:295` splits the artifact column on
  exactly this line ("(c) the range-diff FILE path, or (b) the staged-diff scope
  for a single in-tree fix"); `cadence-core/workflows/debug.md:108-116` and
  `cadence-core/workflows/verify.md:266-275` both fire on `git diff --cached` with
  no plan.
- D-03 (The report file): the fix dispatch does NOT rotate the plan's report - it
  appends its fix row to the existing `<plandir>/reports/plan-<k>.md`. The
  executor contract's rotation rule is unconditional today, so a fix dispatch
  obeying it renames the completed plan's report aside and `summary` then reads a
  one-row fix report as the plan's whole record. Rejected: letting it rotate and
  widening `summary` to fold `plan-<k>.*.md` siblings, which changes what every
  phase's SUMMARY reads. Evidence:
  `skills/cad-executor-contract/SKILL.md:209-214`,
  `cadence-core/bin/lib/report-rotation.mjs:1-45`,
  `cadence-core/workflows/execute.md:442-448`; and a live run already departed
  from the contract at exactly this point
  (`v3.7.5/phases/3/SUMMARY.md`, "The continuation dispatch deliberately did not
  rotate the prior run's report").
- D-04 (The re-arm cap): the one-round cap is keyed PER PLAN, by adding an
  `o.plan === <k>` term to the read-back's filter so it matches what the
  recording append already writes. Without this the fix becomes a dispatch and
  still cannot be reviewed from plan 2 onward, which is the phase's own goal
  clause failing. Evidence: `cadence-core/references/triage-gate.md:144` filters
  on `o.event`, `o.trigger` and `o.corr` with no `o.plan` term, while `:173`'s
  append carries `--plan <k>`; confirmed biting in production at
  `/code/smithers/.planning/trace.jsonl`, whose phase-1 plan-2 `override` states
  the cause in the user's own words. Filed separately in `.planning/CAPTURE.md`
  and pulled into this phase deliberately.
- D-05 (Proving authorship): the coordinator's non-authorship is proven from
  `.planning/trace.jsonl` - a second `dispatch` under the plan key, and the fix
  commit's sha inside that bracket's window - and never from
  `.planning/reads.jsonl`, which structurally cannot show a write. Accepted
  weakness: a coordinator edit inside that same window would not be caught, so
  the assertion tests that a worker authored the commit rather than that nothing
  else wrote. Evidence: `hooks/hooks.json:16-27` matches
  `Read|Grep|Glob|Bash|NotebookRead` and
  `cadence-core/bin/lib/read-trace.mjs:55`'s `RECORDED_TOOLS` is the same five;
  `/code/smithers/.planning/reads.jsonl` holds 1,569 rows of exactly two tools,
  `Bash` 1,329 and `Read` 240.
- D-06 (Where the rule is pinned): the prose rule is pinned in
  `cadence-core/bin/prose-agreement.test.mjs`, not `cadence-core/bin/self-verify.mjs`.
  Evidence: `prose-agreement.test.mjs:1-17` states the standing split and `:1296`,
  `:1309`, `:1365` are the same assertion shape ("ENFORCEMENT, execute.md: ...");
  `self-verify.mjs`'s problem sites are all surface, config, agent and route lints
  with no channel for a workflow-semantics claim.

## Decisions

- D-07 (The dispatch shape): `handle_checkpoint`'s existing continuation is
  reused whole - same worker key `<k>`, same
  `route.mjs resolve --plan <k> --bracket-plan <k>` on dispatch, same
  fresh-context/never-resume rule, same one-line
  `trace close --plan <k> --role cad-executor` on return. Evidence:
  `cadence-core/workflows/execute.md:410-415`, `:304-313` (which already names "a
  `risk_surface` fix pass" as one of the three second-dispatch cases), `:240-274`;
  `cadence-core/references/seam-spawn-agent.md:128-138`, `:311-314`.
- D-08 (The findings payload): the fix prompt carries the PATH of the file
  `review-triggers.md` step 5 already persists, not distilled prose. The file is
  on disk before the FAIL branch is reached, at discriminator `plan-<k>` for a
  per-plan fire. Evidence:
  `cadence-core/references/review-triggers.md:260-266`, `:268-274`;
  `cadence-core/references/triage-gate.md:11-16`.
- D-09 (The fix digest): the fix dispatch returns `PLAN COMPLETE` with
  `Tasks: 1 of 1`, reusing the existing complete arm. Rejected: a fix-pass digest
  variant, which costs a contract edit and a fourth return arm in `execute.md`.
  Evidence: `skills/cad-executor-contract/SKILL.md:242-253` fixes the return at
  five fields and forbids a sixth; `cadence-core/workflows/execute.md:284-302`
  branches on complete/partial/checkpoint with no fourth arm.
- D-10 (Parallel path): a fix dispatch on the parallel path runs in the MAIN
  tree, never a worktree, because the worktree is removed and its branch deleted
  before the risk sequence fires. `<worktree_mode>` is therefore not entered for a
  fix on either path. Evidence:
  `cadence-core/references/execute-parallel.md:27` precedes `:32-56`.
- D-11 (`/cad-task` inline): the inline path is carved out explicitly and states
  that it has no plan key and no dispatch, so its `risk_surface` FAIL stays with
  the user. Without the carve-out the file carries two contradictory instructions
  and which one is obeyed is unpredictable per run. Evidence:
  `cadence-core/workflows/task.md:250` ("Never spawn a subagent on the inline
  path"), `:87-97`, `:119-188`, `:162-182`.
- D-12 (`/cad-task` lease): the `--plan` path's fix dispatch has no lease conflict
  at all - the executor's lease gate is skipped whenever `<plandir>` is not
  `.planning/phases/<N>/`. Evidence:
  `skills/cad-executor-contract/SKILL.md:98-100`;
  `cadence-core/workflows/task.md:102-117`.
- D-13 (The guardrail's wording): the rule is stated by PATH - no `Edit`/`Write`
  outside `.planning/` - not by role or artifact, and that wording already
  permits the `plan` gate's fix (artifact is `PLAN*.md`), the `summary` and
  `state` writes, and D-01's lease amendment, with no exception clause. Evidence:
  `cadence-core/references/review-triggers.md:293`;
  `cadence-core/workflows/plan.md:466-472`;
  `cadence-core/workflows/execute.md:537-558`, whose guardrail block is scoped to
  `execute.md` alone.
- D-14 ("Fix by hand"): `cadence-core/references/triage-gate.md:119-121`'s
  "proceed anyway, or stop and fix by hand" is a strictly LATER decision point -
  reached only after round two's narrowed re-fire still reports a blocker/high -
  and does not conflict with the fix dispatch. "By hand" means the user's hand,
  outside Cadence. It gets one clarifying clause because it reads ambiguously
  enough to invite the reading this phase forbids. Evidence:
  `cadence-core/references/triage-gate.md:109-131`.
- D-15 (Starting state): every blocking-gate FAIL site in the tree is passive
  today - not one carries the word "dispatch" on its FAIL arm. The complete set is
  `cadence-core/workflows/execute.md:333-335` and `:368-377`;
  `cadence-core/references/execute-parallel.md:32-56`;
  `cadence-core/workflows/task.md:184-187`;
  `cadence-core/references/triage-gate.md:37-43` and `:109-131`;
  `cadence-core/references/git-guard.md:121-128`;
  `cadence-core/workflows/plan.md:463-464`;
  `cadence-core/workflows/debug.md:108-116`;
  `cadence-core/workflows/verify.md:259-278`. Evidence:
  `cadence-core/references/review-triggers.md:295`, `:276-285`.
- D-16 (What a fixture phase is): "reproduced against a fixture phase" means a
  scratch tree built in-test with `mkdtempSync`, not a checked-in phase directory.
  Evidence: `cadence-core/bin/fixtures/` holds ten files and no phase directory;
  `cadence-core/bin/planning-replay-check.test.mjs:38` and ten sibling
  `planning-*.test.mjs` files use the `mkdtempSync` pattern.
- D-17 (Byte headroom): every surface this phase edits sits at EXACTLY zero
  headroom - `workflows/execute.md` 31693/31693, `workflows/task.md` 13160/13160,
  `references/triage-gate.md` 21328/21328, `references/git-guard.md` 6868/6868,
  `references/review-triggers.md` 20196/20196, `workflows/plan.md` 29658/29658 -
  so every plan MUST declare `cadence-core/bin/weight-budgets.json` in its
  `files:` or `/cad-plan`'s `check_census` refuses `census-at-risk` before any
  executor runs. Measured 2026-08-28 by diffing `cadence-core/bin/weight.mjs`
  output against `cadence-core/bin/weight-budgets.json`. Evidence:
  `cadence-core/bin/lib/census-registry.mjs:151-171`;
  `cadence-core/bin/planning/lease-check.mjs:293-339`.
- D-18 (No seam census break): `execute.md` and `task.md` carry no row in
  `seam-calls.test.mjs`'s `CENSUS`, so the FAIL branch's new `route.mjs resolve`
  and `trace close` command blocks move no hand-maintained count. Evidence:
  `cadence-core/bin/seam-calls.test.mjs:84-121` holds exactly two rows,
  `workflows/context.md` at 6 and `workflows/plan.md` at 14;
  `cadence-core/bin/lib/census-registry.mjs:259-276`.

## Acceptance criteria

- [ ] AC1: `cadence-core/workflows/execute.md`'s blocking-gate FAIL branch names
      the owner - a continuation `cad-executor` dispatched via the spawn-agent
      seam under worker key `<k>`, its prompt carrying the plan file, the
      persisted findings path, and the instruction to fix the blocker/high
      findings and return the digest - and its `<guardrails>` states that this
      workflow's coordinator issues no `Edit` or `Write` against a path outside
      `.planning/`.
- [ ] AC2: The same FAIL arm appears at every site where a plan key exists
      (`execute.md`'s `risk_surface` and `diff`-at-`adjudicated` arms,
      `references/execute-parallel.md`'s per-plan risk sequence,
      `workflows/task.md`'s `--plan` path), and `task.md`'s inline path states
      instead that it has no plan key and no dispatch, so its `risk_surface` FAIL
      stays with the user.
- [ ] AC3: When a fix's findings name a path outside the plan's declared `files:`
      lease, the workflow amends `PLAN-<k>.md`'s `files:` to cover that path
      before dispatching, and
      `node cadence-core/bin/planning.mjs lease-check --phase <N> --plan <k>`
      answers `ok:true` for the fix commit's staged set.
- [ ] AC4: `cadence-core/references/triage-gate.md`'s re-arm read-back filters on
      the plan key: with a plan-1 `rearm` event already on the record for a
      trigger, plan 2's cap for that same trigger reads unspent and its narrowed
      re-fire runs.
- [ ] AC5: On an in-test fixture phase whose plan touches a risk surface, the FAIL
      branch writes a second `dispatch` event for `cad-executor` under the
      original worker key `<k>` and a matching
      `trace close --plan <k> --role cad-executor`, and the fix commit's sha falls
      inside that bracket's window in `.planning/trace.jsonl`.
- [ ] AC6: `node cadence-core/bin/prose-agreement.test.mjs` fails if
      `execute.md`'s FAIL branch loses the dispatch instruction or the
      `<guardrails>` line AC1 requires.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with no
      `budget-overrun` after the edits to the six zero-headroom files in D-17.

## Flagged assumptions

None - all assumptions confirmed. The analyzer returned an empty
`needs_research[]`: every question this phase raises was answered from files in
this repository or from the `/code/smithers` run record.
