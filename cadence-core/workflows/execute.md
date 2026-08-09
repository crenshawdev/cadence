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
  An `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a
  derived closed milestone - `current` is legitimately null because no cycle
  is OPEN. Stop with "The milestone is closed - no active cycle.
  /cad-phase add opens the next one."
  That phase's entry also lists its plan files
  (`PLAN.md`, or `PLAN-1.md`, `PLAN-2.md`, ... executed in numeric order).
- Status `unplanned` / no plan files -> stop: "No plans for phase <N>.
  Run /cad-plan first."

Read the phase goal from ROADMAP.md (one line - the goal check and SUMMARY use
it) and the config in one message - independent, so only a call that consumes a
prior call's output is serialized.
Config through the seam - one call:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  workflow.subagent_timeout workflow.test_command planning.commit_docs \
  parallelization.enabled parallelization.max_concurrent_agents \
  parallelization.min_plans_for_parallel parallelization.use_worktrees \
  git.protected_branches git.on_protected git.base_branch
```

The `diff` and `phase_diff` gates are NOT read here: fire(trigger) takes every
gate from the routing bundle (`route.mjs resolve`), which is what makes the
stakes level reach a fire site rather than only the seam. A `config.mjs get` of
a gate returns the SCHEMA DEFAULT when no layer set it, so pre-fetching one
would fire at the default while the seam reported the level's.
</step>

<step name="git_guard">
Apply the protected-branch guard from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` in the cwd (planning) repo
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

**Clean starting index (before the first executor, once per run).** Run
`git diff --cached --quiet`. A non-zero exit means the index already holds work
at phase start, and none of it is any executor's. Name exactly what
(`git diff --cached --name-status`), show that list, and ask (ask-user seam), no
preselected default:
1. Stash it (`git stash push --staged`, git 2.35+) and continue
2. Commit it now as the user's own commit, message theirs, then continue
3. Abort

Never stash, unstage or commit the user's staged work without asking - the seam
asks, the user chooses. Run the same check in a cross-repo phase's code repo,
beside its protected-branch guard.

**What this does NOT prove.** The check reads the INDEX, so it establishes that
no work was staged at phase start - not that the worktree was clean. Two gaps
follow, and neither is closable by widening this check:

- An UNSTAGED edit the user already made to a file a plan declares rides into
  that task's commit, because staging a path stages its whole working-tree
  content. The lease gate cannot separate them either: the path is declared, so
  the write is legal, and provenance is not a property of a path.
- An unstaged or untracked file OUTSIDE the lease that some later `git add`
  sweeps in reads as an executor violating its lease, blocking the phase on work
  the executor never did.

So the guarantee is "no staged work at phase start", and the executor's commits
are only as attributable as the worktree was clean. When it matters that a
phase's commits contain nothing but the phase's own work, start it from a clean
worktree (`git status --porcelain` empty), not merely a clean index.

This check lives HERE rather than in the executor's lease gate because the
orchestrator is the only actor that can see a CLEAN starting index: it runs once,
before anything stages anything. `lease-check` reads the whole staged index and
has no provenance signal - it cannot tell a path the user staged before the run
from a path this executor staged and did not declare - so a gate placed there can
only refuse the user's work (halting the phase on files no plan touched) or
excuse an unknown path (which is no gate). Start the index clean and both
readings collapse into one: every later `undeclared-files` refusal is provably
the executor's own doing.

Record `git rev-parse --short HEAD` as PHASE_START for later diffs, then anchor
this phase's joined run record with the same sha:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event phase_start --sha <PHASE_START>
```

That sha is what the phase's correlation id is DERIVED from, so every routing,
provider, lifecycle and outcome event this phase writes joins on it. The whole
trace is BEST EFFORT: an append that comes back `written:false` (the record hit
its size cap, the planning root is unwritable) changes nothing about the execute
path and is never a reason to pause or stop.
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
  no files cannot be proven independent. Any `frontmatter_issues` entry ->
  sequential for the same reason: a plan whose frontmatter did not fully
  parse cannot be proven independent either. `ok:false` -> sequential (the
  check could not run; never parallelize unproven).
- `parallelization.use_worktrees` is true (parallel dispatch without
  isolation is not supported - fall back to sequential)
- the host's worktree fork point is the local HEAD, not the remote default
  branch. This is the user's `worktree.baseRef` setting, not Cadence's, so
  read it - never assume it, never write it:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/worktree-base.mjs" resolve
  ```

  `parallelSafe: false` -> do NOT just fall back and move on. Under
  `baseRef: "fresh"` (the default, so an unset key counts) a worktree
  branches from the remote default branch, so this phase's CONTEXT and its
  PLAN files - unpushed commits on the integration branch - are not in it and
  every executor would halt `blocked` on its own missing plan.

  OFFER THE FIX HERE, through the ask-user seam, and do not send the user to
  another command to get it: this is the only moment they are demonstrably
  affected, and the /cad-config step that would otherwise set it is gated on
  `parallelization.enabled` already being true - so a user who turned
  parallelization on by editing the config directly never reaches it and their
  runs degrade to sequential forever with one line of explanation per run.
  Quote the exact JSON (`"worktree": { "baseRef": "head" }`), name the file
  each option writes (the project's `.claude/settings.json`, recommended, or
  `~/.claude/settings.json`), and follow workflows/config.md's write rules:
  READ the target first, show the current `worktree` block or that there is
  none, merge the one key, preserve every other byte, never touch a
  managed-policy file. Declining is valid and means sequential for this run.

  On accept, re-run `worktree-base.mjs resolve`; `parallelSafe: true` now, so
  continue on the PARALLEL path. `ok:false` -> sequential (the check could not
  run; never parallelize unproven).
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

**The report file (both paths).** An executor writes its task table to
`<plandir>/reports/plan-<k>.md` - `<plandir>` is the plan file's own directory -
and returns a five-field digest. Derive that path from the plan file you
dispatched; the digest deliberately does not carry it. Open a report file at
two kinds of moment only: the `summary` step, once per plan, and a continuation
branch, where you read ONLY the task numbers and commit hashes for the `git log`
confirmation that branch already performs. Nowhere else, and never back into a
dispatch prompt - re-inlining the table returns the bytes the file exists to
move out, on the most expensive path there is. Before a worktree branch is
merged its report lives in the worktree, not here: `git worktree list
--porcelain` gives the worktree root for branch `cadence/phase-<N>-plan-<k>`.

**The lifecycle bracket (both paths).** Every worker this workflow hands work to
is bracketed in the joined run record, so a phase's trace attributes what
happened to the worker that caused it. Immediately before a plan goes to an
executor, and again once that executor comes back, append one event each:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan <k>
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event return --plan <k>
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event checkpoint --plan <k> --detail "<one line>"
```

The closing event is `return` for a `PLAN COMPLETE` or `PLAN PARTIAL`,
`checkpoint` for any checkpoint return, and `escalation` when a plan is moved to
another path or rung. All three close a bracket; a worker with none of them is
what `trace render` reports as unpaired. `--plan <k>` is the WORKER key - the
plan number here, the role name for a role-dispatched worker.

A worktree executor emits NO trace events of its own, and inner tool-level
detail is deliberately not captured. `.planning/trace.jsonl` is gitignored, so
nothing a worktree wrote could ride the merge back, and the executor's return is
a frozen five-field digest with no room for one. The orchestrator's brackets are
what make every worker attributable; what happened INSIDE a worker is its report
file's job.

Handle the executor's return:
- **complete** (`PLAN COMPLETE`) -> record the digest and the derived report
  path `<plandir>/reports/plan-<k>.md`. Do not open the file here; `summary`
  reads it.
- **checkpoint** -> handle_checkpoint, then dispatch a fresh continuation.
- **partial** (`PLAN PARTIAL`, a digest but no checkpoint) -> the report FILE
  is authoritative: open `<plandir>/reports/plan-<k>.md` for the task numbers
  and hashes, confirm them against `git log {pre-plan HEAD}..HEAD`, then ask
  the user (ask-user seam): dispatch a fresh continuation executor for the
  remaining tasks (prompt carrying the report PATH and "continue from task
  <k>", as in handle_checkpoint) or stop here - the incomplete tasks become
  SUMMARY open items. Never silently re-run completed tasks.
- **timeout or no report** -> the executor rewrites its report after every task
  commit, so a file exists even when nothing was returned: read it, confirm it
  against `git log {pre-plan HEAD}..HEAD` to see what actually landed, report
  the state, and ask the user (ask-user seam) whether to re-dispatch the
  remainder or stop. Never silently re-run a plan on top of partial commits.

After each plan completes, fire the `diff` review trigger
(references/review-triggers.md) with the refs
`{base_ref: {pre-plan HEAD}, head_ref: HEAD}` as the artifact - shape (a), the
reviewer runs the diff itself. Default is advisory: report findings, continue.

At `advisory`, fire it in the SAME message as the NEXT plan's dispatch rather
than waiting: the artifact is two immutable refs, so the reviewer reads nothing
that executor writes, and nothing downstream waits on the answer. Collect each
review as it lands and fold it into `summary`. The last plan has no next
dispatch, so it fires and waits. When
`review.triggers.diff.gate` resolves it to `adjudicated` instead, the fire
BLOCKS before the next dispatch - triage can change what ships, and answering
about plan 1 while plan 2 commits is answering about a tree that is gone. The
survivors are a numbered list the user triages, NONE is the default, and only
what the user names is acted on - RE-READ
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`
before presenting, since this workflow does not preload it. The
`risk_surface` arm is untouched by any of that: a matched risk surface still
halts, and triage is not an override for it.
</step>

<step name="handle_checkpoint">
A checkpoint return carries no completed-task table - only the digest, the
checkpoint type, the current task, and what the executor needs. The completed
tasks are in `<plandir>/reports/plan-<k>.md`, which the executor rewrote with a
`CHECKPOINT` status line before returning. Route by type:

- **structural** (architectural change needed, plan wrong at its core) ->
  present to the user via the ask-user seam: approve the proposed change /
  adjust it / stop the phase. This is a consult dead-end: before that ask, run
  offer_consult per references/consult.md with the deviation as the
  situation.
- **risk_surface** (staged diff matches a risk surface) -> fire the
  `risk_surface` review trigger with the flagged-diff FILE path the checkpoint
  returned - shape (c). It is a path and not refs because the diff is staged
  and uncommitted, and in worktree mode it is not in this tree at all.
  Blocking: on FAIL, findings are fixed or the user explicitly overrides -
  never silently proceed.
- **human-verify / decision / blocked** (the plan or a blocker forced a
  pause) -> relay to the user, collect the answer.

A `blocked` halt naming a MISSING PLAN file is the one arm that also has a named
orchestrator-side remedy, because its cause is known: the worktree forked from a
base that does not carry this phase's plans. Reconcile that worktree from the
main tree YOURSELF, in your own serialized turn - bring the branch up to the
main tree's commit, or copy `.planning/phases/<N>/` in - and then re-dispatch
that plan once. The executor contract is not touched by this and must not be:
`<worktree_mode>` forbids `git merge`, `rebase`, `fetch` and `stash` outright,
and reconciliation is the orchestrator's serialized decision precisely because N
executors each reconciling their own tree have no conflict policy at all.
Cadence still issues no `git worktree add` of its own - the host creates the
worktree and the fork point is the user's `worktree.baseRef` setting.

After that remedy has failed twice, the plan falls back to the SEQUENTIAL path in
the main tree, and an `escalation` lifecycle event records the worker that
changed paths. A fallback and not a bounded re-dispatch loop: every failure arm
in choose_path already resolves to sequential, and a loop here would put a second
re-arm on the execute path beside the review triggers' own, which
`references/triage-gate.md` caps at one round.

Then dispatch a FRESH cad-executor for the same plan, its prompt carrying the
report PATH `<plandir>/reports/plan-<k>.md`, the checkpoint outcome, and
"continue from task <k>". Fresh context each time - never resume, and never
re-inline the table.
</step>

<step name="execute_parallel">
(Opt-in path. All worktree ceremony lives here and nowhere else. choose_path
has already proven `worktree.baseRef` is `head`, so an executor halting
`blocked` on a missing PLAN here is a real defect to report, not the
fork-point default.)

1. In batches of `parallelization.max_concurrent_agents`: dispatch one
   cad-executor per plan, each in its own git worktree on branch
   `cadence/phase-<N>-plan-<k>` (spawn-agent seam, worktree isolation), the
   whole batch issued in ONE message. Resolve the route ONCE for
   (cad-executor, attempt 1) and reuse it for every executor in the batch -
   identical role and attempt, so re-resolving per dispatch is wasted (seams.md
   concurrent dispatch). Same prompt as sequential except the mode line:
   "Worktree executor on branch {branch} - worktree rules apply."
2. Wait for every executor in the batch (same timeout).
3. Merge each worktree branch back sequentially: record each branch's pre-merge
   HEAD first, then `git merge {branch}`, then record the HEAD it produced; on
   conflict, stop and ask the user - never force, never auto-resolve. The merge
   is also what carries that executor's own report commit into phase history.
   BOTH ends are recorded here because step 5 runs after every branch has
   merged, when the tree holds only the final HEAD: a plan's post-merge HEAD is
   not recoverable then, and pairing its pre-merge HEAD with the current HEAD
   would hand that plan's reviewer every later plan's work as well.
4. Remove each merged worktree and delete its branch.
5. After all batches: run `workflow.test_command` once if set; then fire the
   `diff` trigger for every plan CONCURRENTLY in one message (artifact: shape
   (a), the refs `{base_ref: that plan's pre-merge HEAD from step 3, head_ref:
   that plan's post-merge HEAD from step 3}`) - the ranges are static and
   independent, so
   the per-plan reviews need not serialize (seams.md concurrent dispatch). This
   step runs AFTER step 3 merged every branch, so a per-plan `diff` review never
   fires before the merge and its refs always resolve in THIS tree, which is the
   tree a dispatched subagent inherits. The
   `diff` gate reports and continues as today at `advisory`; at `adjudicated`
   each plan's survivors go through the triage gate, NONE the default: RE-READ
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` before
   presenting, since this workflow does not preload it, and act only on what
   the user names.
6. Fire the `phase_diff` trigger (references/review-triggers.md) with the refs
   `{base_ref: PHASE_START, head_ref: HEAD}` - shape (a). Off by default
   (opt-in) -
   it exists because the per-plan reviews above each see one plan's diff in
   isolation, so a bug in the INTERACTION of two merged plans is invisible
   to them until pre_ship at land time. Parallel path only: on the
   sequential path each diff review already sees a tree containing all
   prior plans' work. It is `adjudicated` wherever it is on at all (critical
   only), so its survivors go through the same triage gate, NONE the default:
   RE-READ `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`
   before presenting, since this workflow does not preload it, and act only on
   what the user names.

The lifecycle bracket above applies here too, per worker: one `dispatch` event
before a batch member gets its plan and one `return`, `checkpoint` or
`escalation` after it comes back, each carrying that plan's own `--plan <k>`.
The worktree executor writes none of them itself.

Checkpoints on this path route exactly as in handle_checkpoint; the
continuation executor is dispatched back into the same worktree.
</step>

<step name="goal_check">
Light, inline, no subagent. Read the phase goal and
`git log --oneline {PHASE_START}..HEAD`, then write one honest paragraph:
does the sum of these commits plausibly deliver the phase goal? Name
anything that looks missing. Every concrete claim in the paragraph carries
its evidence inline - a file:line or a command output, drawn from
`git log --oneline`, the returned digests, or a direct look (the report files
open at `summary`, not here) - never an unevidenced "X now works":
cad-verifier later treats SUMMARY claims as assertions to falsify, so an
evidenced claim closes that loop and an unevidenced one is just a guess
wearing a verdict. This is an assessment, not a gate - gaps become
SUMMARY open items, not a fix loop.
</step>

<step name="summary">
Write `.planning/phases/<N>/SUMMARY.md` from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/SUMMARY.md`, aggregating the
executor reports - read each plan's `<plandir>/reports/plan-<k>.md` once, at
this step: what shipped, commits per task with hashes, deviations, open items,
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

If `planning.commit_docs` is true, commit SUMMARY.md, STATE.md, every plan's
`<plandir>/reports/plan-<k>.md`, and `.planning/CAPTURE.md` if the summary step
appended open items to it - `docs(<N>): phase <N> summary` - staging exactly
those files. Never stage a `plan-<k>-risk-task-<n>.diff`: it is the transient
flagged diff and the continuation deletes it. With the key false the reports
stay uncommitted exactly like SUMMARY.md, because a report IS a planning doc and
that key is the user's standing answer for all of them - the worktree path
commits regardless not as a docs decision but because the commit is the only
transport across the merge. The cursor is never left uncommitted.
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
- [ ] `diff` trigger per plan - overlapped at `advisory`, blocking at
      `adjudicated`; `risk_surface` honored at commit time
- [ ] SUMMARY.md written: what shipped, commits, deviations, open items, goal check
- [ ] STATE.md is exactly the 4-line cursor, overwritten
</success_criteria>
