<purpose>
The skill's objective states the guarantees. What it does not: ALL worktree
ceremony exists inside the parallel opt-in branch and nowhere else.
</purpose>

<process>

<step name="locate">
Resolve the phase:
- ALWAYS run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status`
  (on `ok:false`, relay its `reason` and `hint` and stop). Unconditionally,
  never under an "else" that `$ARGUMENTS` short-circuits: a phase number on the
  command line must not skip the derivation, which is what the three bullets
  below read.
  An `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a
  derived closed milestone - `current` is legitimately null because no cycle
  is OPEN. Stop with "The milestone is closed - no active cycle.
  /cad-phase add opens the next one."
- `$ARGUMENTS` gives a phase number, which selects that `phases[]` entry;
  absent, take `current`. `--rerun` is the only other token it may carry -
  parse it off beside the number. That phase's entry also lists its plan files
  (`PLAN.md`, or `PLAN-1.md`, `PLAN-2.md`, ... executed in numeric order).
- Status `unplanned` / no plan files -> stop: "No plans for phase <N>.
  Run /cad-plan first."
- DERIVED status `executed` or `complete`, and no `--rerun` -> stop: "Phase <N>
  is already <status> - its plans are committed, and re-running would overwrite
  the executor reports of the run that committed them. Run /cad-undo <N> first,
  then /cad-execute <N>. To re-run over that record anyway: /cad-execute <N>
  --rerun." Read the status from the `phases[]` DERIVATION and never from
  `cursor.status` - `planning.mjs` states in as many words that the cursor is a
  hint the derivation beats. `complete` is refused beside `executed` because it
  re-runs identically and destroys the same evidence one status later. Stopping
  HERE is the point: this is before the `git_guard` step, so before the
  protected-branch guard, before the `phase_start` trace anchor, and before any
  executor dispatch.

Read the phase goal from ROADMAP.md (one line - the goal check and SUMMARY use
it) and the config in one message - independent, so only a call that consumes a
prior call's output is serialized.
Config through the seam - one call:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  planning.commit_docs \
  parallelization.enabled parallelization.max_concurrent_agents \
  parallelization.min_plans_for_parallel parallelization.use_worktrees \
  git.protected_branches git.on_protected git.base_branch
```

The `diff` and `phase_diff` gates are NOT read here: fire(trigger) takes every
gate from the routing bundle (`route.mjs resolve`), which is what makes the
stakes level reach a fire site rather than only the seam. A `config.mjs get` of
a gate is not a source for one either way: unset, it answers `null` and names
`route.mjs resolve` as where the level's gate is resolved.
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
(references/seam-spawn-agent.md), in the normal working tree, no worktrees, and
wait for it to finish before starting the next.

Record the pre-plan HEAD, then dispatch with a prompt ordered stable-first, so
successive executors in the phase share a cached prefix: phase-level context
(identical across the phase's plans) before the plan-specific tail.
- Phase number, name, and the one-line goal.
- Shared files to read first (identical for every plan in the phase): project
  `CLAUDE.md` (if present), `.planning/PROJECT.md` (if present),
  `.planning/phases/<N>/CONTEXT.md` (if present).
- The `surfaces` the executor's own `route.mjs resolve` answered, verbatim -
  the bar the work is written to, not a review that fires later. On
  `surfaces_answered: false` say that no layer answered, so ALL of the
  table's categories stand rather than none. That widening is THIS moment's
  answer and not a general reading of the flag: the executor is being told what
  bar to write to, where all eight is the safe direction. The FIRE is the
  opposite - `risk-check run` refuses `surfaces-unanswered` rather than
  detecting on a set nobody chose (`references/risk-surface.md`). One flag,
  two moments, and the difference is which direction is safe in each.
- Then the plan-specific tail: the plan file to read, commit scope
  `{phase}-{plan}` (e.g. `feat(3-2): ...`), and the mode line "Sequential
  executor on the normal working tree."

Do NOT restate the executor's standing rules (atomic commit per task,
deviation recording, checkpoints, never writing STATE/ROADMAP/SUMMARY, the
report format) - `skills/cad-executor-contract/SKILL.md` already carries them as
its stable, cached definition, preloaded by every `cad-executor` rung file
(`agents/cad-executor.md` is a stub naming the rung and that contract). Repeating them in the volatile dispatch tail pays for cached
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
happened to the worker that caused it. The DISPATCH half rides each executor's
own resolve on the spawn-agent seam's routing step:
`--plan <k> --bracket-plan <k> --bracket-read "CLAUDE.md,.planning/PROJECT.md,.planning/phases/<N>/CONTEXT.md,<the plan file>"`
- the worker key is the plan NUMBER here, not the role name, and `--read` is
what this site causes the executor to read: the shared set every plan in the
phase re-reads, plus that plan's own file. `--plan <k>` beside it is a different
quantity carrying the same number: it scopes the RISK FLOOR to this plan's own
declared files, so an executor is routed for the plan it is being handed
(references/seam-spawn-agent.md's Routing block states the rule). Once that
executor comes back, append the CLOSE:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan <k> --role cad-executor --agent-id <the id on the subagent return> --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on that same return> --detail-file <path>
```

ONE line per executor, and the detail is the executor's own return line - write
it to a scratch file and pass the PATH (caller-derived text -
references/conventions.md). `--agent-id` is the host's name for the worker that
just returned and this line is its only writer; it stops a late `SubagentStop`
closing the NEXT executor's bracket, which on the parallel path is the whole of
how that hook tells two executors apart (references/seam-spawn-agent.md). OMIT
it when the return carried no id. OMIT the detail entirely for a `PLAN COMPLETE` or
`PLAN PARTIAL` and the seam closes a `return`; carry it for any checkpoint
return and the seam closes a `checkpoint`. A plan moved to another path or rung is an `escalation`,
which the seam does not infer - it stays on `trace append`. All three close a
bracket. A dispatch that gets none of them is closed by the host's
`SubagentStop` hook instead, so `trace render` reports as `unpaired` only a
worker NEITHER writer closed - but that hook carries none of the RETURN's
figures, so a skipped close still costs the record this worker's tokens, turns
and wall clock.
`--plan`/`--bracket-plan` is the
WORKER key that pairs a dispatch with its close; `--role` is what the per-role
totals group on, and keyed on the plan number alone `cad-executor` - the single
largest spender in a phase - is the one line the totals could never print.
OMIT `--tokens` on a figureless return, and `--turns` and `--duration-ms` on
the same rule - never a `0`, which claims a measurement nobody made
(seam-spawn-agent.md's bracket rule). A
worktree executor still emits nothing of its own - these are the
ORCHESTRATOR's lines.

The `phase_start` line in `git_guard` is NOT one of these. It is the correlation-id
ANCHOR, not a worker bracket, and it takes no `--role`, `--tokens` or `--read`:
keying it into the role table would invent a role that never ran.

A worktree executor emits NO trace events of its own, and inner tool-level
detail is deliberately not captured. The bracket AROUND a worker is what makes
it attributable - the orchestrator writes both halves, and the host's
`SubagentStop` hook writes a close of its own for a dispatch whose hand-written
close never ran; what happened INSIDE a worker is its report file's job.

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
- **turn cap or unusable return** -> two things produce this state:
  the turn cap cut the dispatch, or the return is missing or unparseable.
  The executor rewrites its report after every task commit, so a file exists
  even when nothing was returned: read `<plandir>/reports/plan-<k>.md`, confirm
  it against `git log {pre-plan HEAD}..HEAD` to see what actually landed, report
  the state, and ask the user (ask-user seam) whether to re-dispatch the
  remainder or stop. Never silently re-run a plan on top of partial commits.

**The worker key of a SECOND dispatch.** Three of those arms dispatch again, and
the key is `<k>` - the plan number the first dispatch took, never a coined
`1-fix`. A continuation, a re-dispatched remainder and a `risk_surface` fix pass
are second dispatches against the SAME plan's range, and a minted key splits one
range across two identities in the run record. Whatever key a dispatch carries,
this plan's `risk-check run --plan` record and its fire receipt's
`trace append --plan` (references/triage-gate.md) must be written with that ONE
spelling, or the receipt settles nothing and the gate refuses a range that was
checked. The seam does not require a NUMBER - `--plan` takes the worker key - so
keeping one spelling is the coordinator's job, not the seam's.

After each plan completes, ASK THE SEAM whether the plan's committed range
touched a risk surface - never by reading the diff against a prose list, which
left no record at all when it matched nothing:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase <N> --plan <k> --base {pre-plan HEAD} --head HEAD
```

A non-empty `matches` OR `inconclusive: true` fires the trigger. An unjudged
range is not a cleared one, and widening is the only safe direction on the one
gate that is `blocking` at every stakes level. Each match names the category and
the signal that found it, so the fire states a reason rather than a verdict.

On a fire, write `git diff {pre-plan HEAD}..HEAD` to
`<plandir>/reports/plan-<k>-risk.diff` and fire the trigger with that
path - shape (c), exactly as `workflows/task.md`'s `risk_check` step does, since
shape (a) refs is not one of the shapes the wiring table admits for
`risk_surface`. The file is transient: never stage it, delete it once the
trigger returns. Blocking: on FAIL the findings are fixed or the user explicitly
overrides, and the re-arm on that fix is CAPPED at ONE narrowed round per
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` - RE-READ it
before the fix lands, since this workflow does not preload it.

Then, before the plan is reported done:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check status --phase <N> --plan <k> --base {pre-plan HEAD} --head HEAD
```

The plan is NOT reported done while that call refuses. It re-reads the record,
so it also catches the run that answered `ok:true` while its append came back
`written: false` - a check whose answer never reached the record is a check the
next reader cannot see.

Firing ONCE here rather than per risky commit is the point. Halting the executor
mid-plan cost a fresh-context re-dispatch per match, and a continuation whose
only job was writing code no task authorized - which is itself new risk surface,
and the next halt. The range is committed and complete when this reads it, so
the reviewer judges what the plan actually built instead of a half-finished
staged index.

Then fire the `diff` review trigger
(references/review-triggers.md) with the refs
`{base_ref: {pre-plan HEAD}, head_ref: HEAD}` as the artifact - shape (a), the
reviewer runs the diff itself. Default is `off` at `solo` and `shipped`: an
advisory review gates nothing, and the LAST plan of a phase has no next
dispatch to overlap it with, so it buys a wait for findings that stop nothing.
`risk_surface` above already blocked on this same range, and no gate reviews
the branch again at land. The arms below are what a user who sets
`review.triggers.diff.gate` gets, and what `critical` resolves on its own.

At `advisory`, fire it in the SAME message as the NEXT plan's dispatch rather
than waiting: the artifact is two immutable refs, so the reviewer reads nothing
that executor writes, and nothing downstream waits on the answer. Each fire
carries the advisory persistence tail (review-triggers.md step 4): findings
land at `.planning/phases/<N>/REVIEW-diff-plan-<k>.md` whether or not this
session survives to the return, and `summary` folds the files on disk, naming
any still in flight. The last plan has no next dispatch, so it fires without
waiting on the same tail - the gate, not the overlap, picks the bracket's
writer. When
`review.triggers.diff.gate` resolves it to `adjudicated` instead, the fire
BLOCKS before the next dispatch - triage can change what ships, and answering
about plan 1 while plan 2 commits is answering about a tree that is gone. The
survivors are a numbered list the user triages, NONE is the default, and only
what the user names is acted on - RE-READ
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`
before presenting, since this workflow does not preload it. The
`risk_surface` fire above is untouched by the TRIAGE rule specifically: a matched
risk surface still blocks, and triage is not an override for it. It is NOT
exempt from the same file's ONE-round re-arm cap, which binds every blocking
gate.
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
- **human-verify / decision / blocked** (the plan or a blocker forced a
  pause) -> relay to the user, collect the answer.

A `blocked` halt naming a MISSING PLAN file is the one arm that also has a named
orchestrator-side remedy, because its cause is known: the worktree forked from a
base that does not carry this phase's plans. Reconcile that worktree from the
main tree YOURSELF, in your own serialized turn - bring the branch up to the
main tree's commit, or copy `.planning/phases/<N>/` in - and then re-dispatch
that plan once. The executor contract is not touched by this and must not be:
references/worktree-executor.md, which `<worktree_mode>` reads, forbids
`git merge`, `rebase`, `fetch` and `stash` outright,
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
re-inline the table. Bracket it under the SAME worker key `<k>` the first
dispatch took, and write this plan's risk record and receipt with that one
spelling.
</step>

<step name="execute_parallel">
(Opt-in path. All worktree ceremony lives here and nowhere else. choose_path
has already proven `worktree.baseRef` is `head`, so an executor halting
`blocked` on a missing PLAN here is a real defect to report, not the
fork-point default.)

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/execute-parallel.md` (one
consult site - this step) and follow it: the batching key, the sequential
merge with both HEADs recorded, `workflow.test_command` at its only consumer,
and which review triggers fire on this path alone. Only the opt-in path reaches
this step, so a sequential run carries none of it.
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

A deviation that REFUTES a numbered context decision - it cites a D-NN and
shows that decision's claim false against ground truth - also corrects the
record it refuted: append ` [corrected by plan-<k> deviation: <the true fact,
one clause>]` to that decision's line in `.planning/phases/<N>/CONTEXT.md`.
Later phases receive prior decisions as a summary drawn from these files, so a
falsified claim left standing is inherited by every planner after this one -
the report alone corrects nobody downstream. A deviation that merely adjusts
scope or adds work touches nothing here; only a refuted D-NN does.

An open item lives in `.planning/phases/<N>/SUMMARY.md`'s `## Open items`,
written by this step, and NOWHERE else. It is not filed into
`.planning/CAPTURE.md`, and the reason is in the code rather than in a
preference: `parseSummarySnippets`
(`cadence-core/bin/lib/planning-files.mjs`) already indexes `## Deviations` and
`## Open items` bullets into the recall corpus, so the item is already reachable
by `/cad-plan` and the CAPTURE copy was a second, lower-scoring row for the same
sentence - measured on this repository 2026-08-25, the SUMMARY row scores
42.4677 against the CAPTURE duplicate's 31.1468 for the same query, the same
item twice. CAPTURE holds the phase IN FLIGHT; an open item is by definition
what did not finish inside the phase, so routing it there is the durable write
that makes the queue accumulate.

An item that must outlive the phase is the CLOSE's business, not this step's:
`planning.mjs phase-done`'s `capture` field names whatever is still in the queue
and `workflows/verify.md` prints it, so the disposition - filed on the tracker,
or dropped - is the user's own. Nothing is filed onward from here: no ask, no
forge call.

Then run
`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" debt-harvest --root .`
so a `CADENCE-DEBT` marker planted during the phase lands in the queue on the
phase that planted it. BEST EFFORT: it rewrites its own `## Debt markers`
section and touches nothing else, and a non-zero exit is reported in one line
and never blocks the summary.
</step>

<step name="state">
Update the cursor through the seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase <N> --status executed --next "/cad-verify <N>"
```

**When this run DEFERRED a fire**, the resume pointer stops being a literal -
it is composed from what the run did - so it rides the file transport instead:
write the pointer to a scratch file and pass its PATH.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase <N> --status executed --next-file <path>
```

The pointer names the queue and its count beside the next action
(`/cad-verify <N> - 2 deferred findings queued, triage before landing`). A file
and not the inline flag because caller-derived text rides a path at every seam
flag that carries it (`references/conventions.md`), which is the reason
`cursor set --next-file` exists at all. Keep `--status executed` exactly as it
is: a new status value would land outside `planning.mjs`'s `AGREE` map, be
reported as `cursor` drift and be rewritten by the very next `/cad-progress`.
The pointer is a HINT; the count `/cad-progress` prints comes from the `status`
envelope's `deferred` block and never from this string.

If `planning.commit_docs` is true, commit SUMMARY.md, STATE.md, every plan's
`<plandir>/reports/` DIRECTORY, `.planning/phases/<N>/CONTEXT.md` if the
summary step annotated a corrected decision, and `.planning/CAPTURE.md` only if
the summary step's debt harvest reported `written` - that harvest is the one
thing at this step that can still change the file, now that an open item is
written to SUMMARY.md and nowhere else - `docs(<N>): phase <N> summary` - staging exactly
those paths. Stage `.planning/phases/<N>/DEFERRED-*.json` alongside them, and
stage it whatever that key says: a queue member is the only durable evidence a
fire was deferred - `.planning/trace.jsonl` is gitignored and the sibling
REVIEW file is committed by nothing - so an untracked member is gone on a fresh
clone, and it also leaves the tree dirty at `/cad-land` step 2. It is not a
planning doc the key is the standing answer for; it is what stops the land. The DIRECTORY, never one report by name: an executor rotates a
previous run's report aside to a suffixed sibling, which a by-name stage leaves
untracked. It takes everything in there, so the flagged diffs
(`plan-<k>-risk.diff`, `plan-<k>-risk-task-<n>.diff`) go out by PATHSPEC, not a
rule naming a file: `git add <plandir>/reports/
':(exclude)<plandir>/reports/*.diff'`. With the key false the reports
stay uncommitted exactly like SUMMARY.md, because a report IS a planning doc and
that key is the user's standing answer for all of them - the worktree path
commits regardless not as a docs decision but because the commit is the only
transport across the merge. The cursor is never left uncommitted.
</step>

<step name="done">
Report tersely: the goal-check verdict FIRST - it is the one thing the
reader came for - then plans executed, commits (count and range), deviations
count, open items. One suggestion max: `/cad-verify <N>` - safe
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
- THREE writers touch this run record's brackets and no fourth: the DISPATCH
  half rides each site's own `route.mjs resolve` through `--bracket-read`; the
  CLOSE half is the orchestrator's hand-written `trace close`, which alone sees
  the return and so alone carries `--tokens`, `--turns` and `--duration-ms`; and
  the host's `SubagentStop` hook (`cadence-core/bin/subagent-trace.mjs`) writes
  a figureless close for a dispatch whose hand-written one never ran. Executors
  write no trace events of their own, on either path.
- The hand-written close is a FALLBACK kept on purpose, never a duplicate to
  prune: `/cad-task`'s phase-0 bracket has no subagent behind it for any hook to
  close, and a hook-only design goes silently quiet on a host rename, where a
  missing close renders as the visible `unpaired` defect instead. Two closes of
  one dispatch render as ONE bracket - the worker-key dedup in
  `cadence-core/bin/lib/trace.mjs` folds whichever arrived second into the row
  the first opened.
</guardrails>

<success_criteria>
- [ ] Guard applied before the first executor dispatch
- [ ] One cad-executor per plan; sequential unless every parallel condition held
- [ ] Each task is one conventional commit of specific files
- [ ] `diff` trigger per plan - `off` at solo/shipped, overlapped at
      `advisory`, blocking at `adjudicated`; `risk_surface` fired ONCE per plan
      on the committed range, never mid-plan
- [ ] SUMMARY.md written: what shipped, commits, deviations, open items, goal check
- [ ] STATE.md is exactly the 4-line cursor, overwritten
</success_criteria>
