# Why /cad-execute is shaped this way

Companion to `cadence-core/workflows/execute.md`. **Not read at runtime** - no
workflow, skill or agent loads this file, and it is outside every budgeted
prose surface (`weight.mjs` measures `cadence-core/workflows/*.md` top-level
only).

Read it before EDITING that workflow. Every step below survived a measured
failure or a rejected alternative, and a step removed for looking redundant
takes its failure back with it.

Anchors match the step names in the workflow.

---

## locate - why `complete` is refused beside `executed`

It re-runs identically and destroys the same evidence one status later. Refusing
only `executed` would leave the destructive path open to any phase that had
since been verified.

## locate - why the stop is placed before git_guard

The refusal has to land before the protected-branch guard, before the
`phase_start` trace anchor, and before any executor dispatch. Placed after any of
them, a re-run that the workflow is about to refuse has already asked the user a
branch question and written a lifecycle event for a run that never happens.

## locate - why the replay stop is here and not in derivePhases

A phase whose plans all committed but whose `SUMMARY.md` never landed derives
`planned` (`bin/planning/core.mjs:191-206` reads artifacts, and committed work
moves nothing), so the `executed`/`complete` refusal above never fires and the
next run re-dispatches finished work.

Minting a new derived status is the more honest fix, because the wrong answer
IS the derivation's. Rejected on blast radius: it teaches `status`, `audit`,
`phase-done` and the cursor a new value at once, and every consumer switching on
the status string would have to learn it. `locate` already stops before
`git_guard` and the `phase_start` anchor, so the ordering the stop needs is free
there.

## locate - why the report FILE decides, over every plan

The spike (`.planning/spikes/execute-replay-blast-radius/SPIKE.md`) dispatched
two real executors at already-committed work and measured zero commits and zero
byte changes. The cost is money and a false run record, not a corrupted tree -
which is why this is a guard and not a resume path. Both probes had
`reports/plan-<k>.md` on disk with no `SUMMARY.md` beside it, so the report file
alone separates the two states and `locate` cross-checks it against no git read.

It quantifies over EVERY plan because the simpler rule - any `PLAN COMPLETE`
report is a replay - would strand a multi-plan phase mid-flight and force a
`/cad-undo` of commits that are fine.

One state this cannot see, stated rather than left out: a parallel-path plan
whose report was written inside an unmerged worktree leaves nothing at
`.planning/phases/<N>/reports/` for `locate` to read. The stop does not fire for
it, and that run behaves as it does today.

## git_guard - the two gaps the index check cannot close

The check reads the INDEX, so it establishes that no work was staged at phase
start, not that the worktree was clean. Neither gap is closable by widening the
check:

- An UNSTAGED edit the user already made to a file a plan declares rides into
  that task's commit, because staging a path stages its whole working-tree
  content. The lease gate cannot separate them either: the path is declared, so
  the write is legal, and provenance is not a property of a path.
- An unstaged or untracked file OUTSIDE the lease that some later `git add`
  sweeps in reads as an executor violating its lease, blocking the phase on work
  the executor never did.

So the guarantee is "no staged work at phase start", and the executor's commits
are only as attributable as the worktree was clean.

## choose_path - why the baseRef fix is offered here rather than in /cad-config

This is the only moment the user is demonstrably affected, and the `/cad-config`
step that would otherwise set it is gated on `parallelization.enabled` already
being true. A user who turned parallelization on by editing the config directly
never reaches that step, and their runs degrade to sequential forever with one
line of explanation per run.

## execute_sequential - why `surfaces_answered: false` widens to all categories

The executor is being told what bar to WRITE to, and all eight is the safe
direction there. The FIRE is the opposite: `risk-check run` refuses
`surfaces-unanswered` rather than detecting on a set nobody chose
(`references/risk-surface.md`). One flag, two moments, and the difference is
which direction is safe in each.

## execute_sequential - why the report file is never re-inlined

Re-inlining the table returns the bytes the file exists to move out, on the most
expensive path there is - a dispatch prompt.

## execute_sequential - why `--role` rides the close beside `--plan`

`--plan`/`--bracket-plan` is the worker key that pairs a dispatch with its close;
`--role` is what the per-role totals group on. Keyed on the plan number alone,
`cad-executor` - the single largest spender in a phase - is the one line the
totals could never print.

## execute_sequential - why phase_start takes no --role

It is the correlation-id anchor, not a worker bracket. Keying it into the role
table would invent a role that never ran.

## execute_sequential - why a worktree executor emits nothing

The bracket AROUND a worker is what makes it attributable: the orchestrator
writes both halves, and the host's `SubagentStop` hook writes a close of its own
for a dispatch whose hand-written close never ran. What happened INSIDE a worker
is its report file's job, and inner tool-level detail is deliberately not
captured.

## execute_sequential - why risk-check is a seam call, not a diff read

Reading the diff against a prose list left no record at all when it matched
nothing. A seam call records the judgement either way, which is what
`risk-check status` re-reads one step later.

## execute_sequential - why risk_surface fires ONCE, on the committed range

Halting the executor mid-plan cost a fresh-context re-dispatch per match, and a
continuation whose only job was writing code no task authorized - which is itself
new risk surface, and the next halt. The range is committed and complete when
this reads it, so the reviewer judges what the plan actually built instead of a
half-finished staged index.

## execute_sequential - why the diff trigger defaults off at solo and shipped

An advisory review gates nothing, and the LAST plan of a phase has no next
dispatch to overlap it with, so it buys a wait for findings that stop nothing.
`risk_surface` already blocked on this same range, and no gate reviews the branch
again at land.

## handle_checkpoint - why the orchestrator reconciles the worktree, not the executor

N executors each reconciling their own tree have no conflict policy at all.
`references/worktree-executor.md` forbids `git merge`, `rebase`, `fetch` and
`stash` outright for that reason, so reconciliation is the orchestrator's
serialized decision.

## handle_checkpoint - why the fallback is not a bounded retry loop

Every failure arm in `choose_path` already resolves to sequential, and a loop
here would put a second re-arm on the execute path beside the review triggers'
own, which `references/triage-gate.md` caps at one round.

## summary - why an open item is not also filed to CAPTURE

`parseSummarySnippets` already indexes `## Deviations` and `## Open items`
bullets into the recall corpus, so the CAPTURE copy was a second, lower-scoring
row for the same sentence. Measured on this repository 2026-08-25: the SUMMARY
row scores 42.4677 against the CAPTURE duplicate's 31.1468 for the same query,
the same item twice.

Routing it to CAPTURE is also the durable write that makes the queue accumulate,
since an open item is by definition what did not finish inside the phase.

## state - why DEFERRED-*.json is staged regardless of commit_docs

A queue member is the only durable evidence a fire was deferred:
`.planning/trace.jsonl` is gitignored and the sibling REVIEW file is committed by
nothing. An untracked member is gone on a fresh clone, and it also leaves the
tree dirty at `/cad-land` step 2.

## state - why the worktree path commits reports regardless of the key

With `planning.commit_docs` false the reports stay uncommitted exactly like
SUMMARY.md, because a report IS a planning doc and that key is the user's
standing answer for all of them. The worktree path commits anyway, not as a docs
decision but because the commit is the only transport across the merge.

## guardrails - why the hand-written close is kept beside the hook

`/cad-task`'s phase-0 bracket has no subagent behind it for any hook to close,
and a hook-only design goes silently quiet on a host rename, where a missing
close renders as the visible `unpaired` defect instead. Two closes of one
dispatch render as ONE bracket: the worker-key dedup in
`cadence-core/bin/lib/trace.mjs` folds whichever arrived second into the row the
first opened.
