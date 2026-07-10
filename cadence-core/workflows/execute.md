<purpose>
Execute every plan in a phase with Cadence's guarantees: one cad-executor
per plan, one atomic conventional commit per task, deviations recorded, a
slim per-phase SUMMARY.md at the end. Sequential is the default; parallel
worktree execution is a short opt-in branch, and worktree ceremony exists
only inside it.

Replaces GSD's execute-phase: keeps the executor discipline (atomic commits,
deviation rules, checkpoints), drops the orchestration apparatus (waves,
worktree manifests, end-of-phase gate pipeline).
</purpose>

<process>

<step name="locate">
Resolve the phase:
- `$ARGUMENTS` gives a phase number, else read the current phase from the
  `.planning/STATE.md` cursor.
- Plans live in `.planning/phases/<N>/`: a single `PLAN.md`, or `PLAN-1.md`,
  `PLAN-2.md`, ... executed in numeric order.
- No plan files -> stop: "No plans for phase <N>. Run /cad-plan first."

Read the phase goal from ROADMAP.md (one line - the goal check and SUMMARY
use it).
</step>

<step name="git_guard">
Apply the protected-branch guard from
`$HOME/.claude/cadence-core/references/git.md` BEFORE dispatching the first
executor. Executors commit; the guard question belongs here, once, never
inside a subagent.

Record `git rev-parse --short HEAD` as PHASE_START for later diffs.
</step>

<step name="choose_path">
Sequential (default) unless ALL of these hold:
- `parallelization.enabled` is true
- plan count >= `parallelization.min_plans_for_parallel`
- the plans are independent: no plan builds on another's output and their
  declared file lists do not overlap
- `parallelization.use_worktrees` is true (parallel dispatch without
  isolation is not supported - fall back to sequential)
</step>

<step name="execute_sequential">
For each plan in order: dispatch ONE cad-executor via the spawn-agent seam
(references/seams.md), in the normal working tree, no worktrees, and wait
for it to finish before starting the next. Timeout:
`workflow.subagent_timeout`.

Record the pre-plan HEAD, then dispatch with a prompt containing:
- Phase number, name, and the one-line goal.
- Files to read at start: the plan file, `.planning/phases/<N>/CONTEXT.md`
  (if present), `.planning/PROJECT.md` (if present), project `CLAUDE.md`
  (if present).
- Commit scope: `{phase}-{plan}` (e.g. `feat(3-2): ...`).
- Mode line: "Sequential executor on the normal working tree."
- The standing rules: one atomic commit per task; record every deviation;
  stop with a checkpoint on structural deviations and risk-surface matches;
  never write STATE.md, ROADMAP.md, or SUMMARY.md; return the structured
  report.

Handle the executor's return:
- **complete** -> collect its report (tasks, hashes, deviations, open items).
- **checkpoint** -> handle_checkpoint, then dispatch a fresh continuation.
- **timeout or no report** -> inspect `git log {pre-plan HEAD}..HEAD` to see
  what actually landed, report the state, and ask the user (ask-user seam)
  whether to re-dispatch the remainder or stop. Never silently re-run a plan
  on top of partial commits.

After each plan completes, fire the `diff` review trigger
(references/review-triggers.md) with `git diff {pre-plan HEAD}..HEAD` as the
payload. Default is advisory: report findings, continue.
</step>

<step name="handle_checkpoint">
A checkpoint return carries: completed tasks with commit hashes, the current
task, and what the executor needs. Route by type:

- **structural** (architectural change needed, plan wrong at its core) ->
  present to the user via the ask-user seam: approve the proposed change /
  adjust it / stop the phase.
- **risk_surface** (staged diff matches a risk surface) -> fire the
  `risk_surface` review trigger with the flagged diff. Blocking: on FAIL,
  findings are fixed or the user explicitly overrides - never silently
  proceed.
- **human-verify / decision / blocked** (the plan or a blocker forced a
  pause) -> relay to the user, collect the answer.

Then dispatch a FRESH cad-executor for the same plan, its prompt extended
with the completed-task table (hashes included), the checkpoint outcome, and
"continue from task <k>". Fresh context each time - never resume.
</step>

<step name="execute_parallel">
(Opt-in path. All worktree ceremony lives here and nowhere else.)

1. In batches of `parallelization.max_concurrent_agents`: dispatch one
   cad-executor per plan, each in its own git worktree on branch
   `cadence/phase-<N>-plan-<k>` (spawn-agent seam, worktree isolation), one
   dispatch per message, in the background. Same prompt as sequential except
   the mode line: "Worktree executor on branch {branch} - worktree rules
   apply."
2. Wait for every executor in the batch (same timeout).
3. Merge each worktree branch back sequentially: `git merge {branch}`; on
   conflict, stop and ask the user - never force, never auto-resolve.
4. Remove each merged worktree and delete its branch.
5. After all batches: run `workflow.test_command` once if set; then fire the
   `diff` trigger once per plan (payload: that plan's commits as a diff).

Checkpoints on this path route exactly as in handle_checkpoint; the
continuation executor is dispatched back into the same worktree.
</step>

<step name="goal_check">
Light, inline, no subagent. Read the phase goal and
`git log --oneline {PHASE_START}..HEAD`, then write one honest paragraph:
does the sum of these commits plausibly deliver the phase goal? Name
anything that looks missing. This is an assessment, not a gate - gaps become
SUMMARY open items, not a fix loop.
</step>

<step name="summary">
Write `.planning/phases/<N>/SUMMARY.md` from
`$HOME/.claude/cadence-core/templates/SUMMARY.md`, aggregating the executor
reports: what shipped, commits per task with hashes, deviations, open items,
and the goal-check paragraph.

If `planning.commit_docs` is true, commit it: `docs(<N>): phase <N> summary`.
</step>

<step name="state">
Overwrite `.planning/STATE.md` with the 4-line cursor (full overwrite, never
append):

```
Phase: <N> - <name>
Status: executed
Next: /cad-verify <N>
Updated: YYYY-MM-DD
```
</step>

<step name="done">
Report tersely: plans executed, commits (count and range), deviations count,
open items, goal-check verdict. One suggestion max: `/cad-verify <N>`.
</step>

</process>

<guardrails>
- The protected-branch guard runs once, before the first dispatch - never
  inside an executor.
- The sequential path never touches worktrees.
- Executors never write STATE.md, ROADMAP.md, or SUMMARY.md. This workflow
  is the only STATE writer, and only as the 4-line overwrite.
- Never push (references/git.md rail 3).
- Second opinions only via review triggers; the goal check stays inline
  prose, never an agent.
- Deviations live in SUMMARY.md - git and SUMMARY are the record, STATE is
  not a log.
- Read only the config keys named here; unknown keys are ignored.
</guardrails>

<success_criteria>
- [ ] Guard applied before the first executor dispatch
- [ ] One cad-executor per plan; sequential unless every parallel condition held
- [ ] Each task is one conventional commit of specific files
- [ ] `diff` trigger fired per plan; `risk_surface` honored at commit time
- [ ] SUMMARY.md written: what shipped, commits, deviations, open items, goal check
- [ ] STATE.md is exactly the 4-line cursor, overwritten
</success_criteria>
