<purpose>
Execute every plan in a phase with Cadence's guarantees: one cad-executor
per plan, one atomic conventional commit per task, deviations recorded, a
slim per-phase SUMMARY.md at the end. Sequential is the default; parallel
worktree execution is a short opt-in branch, and worktree ceremony exists
only inside it.

Keeps the executor discipline (atomic commits, deviation rules, checkpoints)
without the orchestration apparatus - no waves, no worktree manifests, no
end-of-phase gate pipeline.
</purpose>

<process>

<step name="locate">
Resolve the phase:
- `$ARGUMENTS` gives a phase number, else run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status` and
  take `current` (on `ok:false`, relay its `reason` and `hint` and stop).
  That phase's entry also lists its plan files
  (`PLAN.md`, or `PLAN-1.md`, `PLAN-2.md`, ... executed in numeric order).
- Status `unplanned` / no plan files -> stop: "No plans for phase <N>.
  Run /cad-plan first."

Read the phase goal from ROADMAP.md (one line - the goal check and SUMMARY
use it). Read config through the seam - one call:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  workflow.subagent_timeout workflow.test_command planning.commit_docs \
  parallelization.enabled parallelization.max_concurrent_agents \
  parallelization.min_plans_for_parallel parallelization.use_worktrees \
  git.protected_branches git.on_protected git.base_branch \
  review.triggers.diff.gate review.triggers.phase_diff.gate
```
</step>

<step name="git_guard">
Apply the protected-branch guard from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git.md` in the cwd (planning) repo
BEFORE dispatching the first executor - this covers both the executors' commits
and the docs commit. Executors commit; the guard question belongs here, once,
never inside a subagent.

Cross-repo check: Cadence expects `.planning/` in the code repo root. If a
plan's `files:` are absolute paths whose git root
(`git -C <dir> rev-parse --show-toplevel`) differs from the cwd repo, the phase
edits a SEPARATE code repo. Run the same protected-branch guard in that repo
too before its first executor - its commits would otherwise be unguarded - and
tell the user this is a partially-supported setup: PHASE_START, the diff
review, and the goal check below run in the planning repo and will NOT reflect
commits made in the code repo, so treat them as advisory and check the code
repo by hand. Prefer keeping `.planning/` in the code repo.

Record `git rev-parse --short HEAD` as PHASE_START for later diffs.
</step>

<step name="choose_path">
Sequential (default) unless ALL of these hold:
- `parallelization.enabled` is true
- plan count >= `parallelization.min_plans_for_parallel`
- no plan builds on another's output (your judgment, from the plans' goals
  and ordering)
- the declared file lists do not overlap - this half is arithmetic, not
  judgment; run the seam and require empty `overlaps`:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-overlap --phase <N>
  ```

  Any `overlaps` entry -> sequential, and report which plans collide on
  which files. Any `undeclared` entry -> sequential too: a plan declaring
  no files cannot be proven independent. `ok:false` -> sequential (the
  check could not run; never parallelize unproven).
- `parallelization.use_worktrees` is true (parallel dispatch without
  isolation is not supported - fall back to sequential)
</step>

<step name="execute_sequential">
For each plan in order: dispatch ONE cad-executor via the spawn-agent seam
(references/seams.md), in the normal working tree, no worktrees, and wait
for it to finish before starting the next. Timeout:
`workflow.subagent_timeout`.

Record the pre-plan HEAD, then dispatch with a prompt ordered stable-first, so
successive executors in the phase share a cached prefix: phase-level context
(identical across the phase's plans) before the plan-specific tail.
- Phase number, name, and the one-line goal.
- Shared files to read first (identical for every plan in the phase): project
  `CLAUDE.md` (if present), `.planning/PROJECT.md` (if present),
  `.planning/phases/<N>/CONTEXT.md` (if present).
- Then the plan-specific tail: the plan file to read, commit scope
  `{phase}-{plan}` (e.g. `feat(3-2): ...`), and the mode line "Sequential
  executor on the normal working tree."

Do NOT restate the executor's standing rules (atomic commit per task,
deviation recording, checkpoints, never writing STATE/ROADMAP/SUMMARY, the
report format) - `cad-executor.md` already carries them as its stable, cached
definition. Repeating them in the volatile dispatch tail pays for cached
content twice.

Handle the executor's return:
- **complete** (`PLAN COMPLETE`) -> collect its report (tasks, hashes,
  deviations, open items).
- **checkpoint** -> handle_checkpoint, then dispatch a fresh continuation.
- **partial** (`PLAN PARTIAL`, a report but no checkpoint) -> the report's
  completed-task table is authoritative; confirm its hashes against
  `git log {pre-plan HEAD}..HEAD`, then ask the user (ask-user seam):
  dispatch a fresh continuation executor for the remaining tasks (prompt
  extended with the completed-task table and "continue from task <k>", as
  in handle_checkpoint) or stop here - the incomplete tasks become SUMMARY
  open items. Never silently re-run completed tasks.
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
  adjust it / stop the phase. This is a consult dead-end: before that ask, run
  offer_consult per references/consult.md with the deviation as the
  situation.
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
6. Fire the `phase_diff` trigger (references/review-triggers.md) with
   `git diff {PHASE_START}..HEAD` as the payload. Off by default (opt-in) -
   it exists because the per-plan reviews above each see one plan's diff in
   isolation, so a bug in the INTERACTION of two merged plans is invisible
   to them until pre_ship at land time. Parallel path only: on the
   sequential path each diff review already sees a tree containing all
   prior plans' work.

Checkpoints on this path route exactly as in handle_checkpoint; the
continuation executor is dispatched back into the same worktree.
</step>

<step name="goal_check">
Light, inline, no subagent. Read the phase goal and
`git log --oneline {PHASE_START}..HEAD`, then write one honest paragraph:
does the sum of these commits plausibly deliver the phase goal? Name
anything that looks missing. Every concrete claim in the paragraph carries
its evidence inline - a file:line or a command output, drawn from the
executor reports or a direct look - never an unevidenced "X now works":
cad-verifier later treats SUMMARY claims as assertions to falsify, so an
evidenced claim closes that loop and an unevidenced one is just a guess
wearing a verdict. This is an assessment, not a gate - gaps become
SUMMARY open items, not a fix loop.
</step>

<step name="summary">
Write `.planning/phases/<N>/SUMMARY.md` from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/SUMMARY.md`, aggregating the executor
reports: what shipped, commits per task with hashes, deviations, open items,
and the goal-check paragraph. Do not commit yet - the cursor lands in the
same docs commit (state step).

For each open item, also append it to `.planning/CAPTURE.md` as
`- [ ] (phase <N>) <text>` under `## Todos` (create the file with headings
`## Todos`, `## Seeds`, `## Notes` if absent, same format as /cad-capture).
SUMMARY is the phase's record; CAPTURE is the live phase-linked queue - a
deferred item routed here resurfaces on its phase instead of surviving only
because the next executor re-notices it. Do not duplicate an item already
present. This file joins the docs commit in the state step.
</step>

<step name="state">
Update the cursor through the seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase <N> --status executed --next "/cad-verify <N>"
```

If `planning.commit_docs` is true, commit SUMMARY.md, STATE.md, and
`.planning/CAPTURE.md` if the summary step appended open items to it -
`docs(<N>): phase <N> summary` - staging exactly those files. The cursor
is never left uncommitted.
</step>

<step name="done">
Report tersely: plans executed, commits (count and range), deviations count,
open items, goal-check verdict. One suggestion max: `/cad-verify <N>` - safe
to `/clear` first: SUMMARY.md and the STATE cursor are committed and
verification runs in a fresh subagent.
</step>

</process>

<guardrails>
- The protected-branch guard runs up front, before the first dispatch (in the
  planning repo, and in a separate code repo when a phase edits one) - never
  inside an executor.
- The sequential path never touches worktrees.
- Executors never write STATE.md, ROADMAP.md, or SUMMARY.md. This workflow
  is the only STATE writer, and only as the 4-line overwrite.
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
