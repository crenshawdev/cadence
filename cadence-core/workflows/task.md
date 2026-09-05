<purpose>
Execute a small, off-roadmap task with Cadence's two guarantees - atomic
conventional commits and the references/git-guard.md rail-1 guard (the protected-branch check
plus base-integrity and the integration-branch decision, not a bare branch
check) - and no planning apparatus beyond that: inline by default (no subagents,
no plan files). `--plan` opts into a written PLAN.md for genuinely multi-step
work.

One command, not a fast/quick split: the skill classifies the task instead of
making the user pick a lane.
</purpose>

<process>

<step name="parse">
Parse `$ARGUMENTS`: task description plus optional `--plan` flag.
If the description is empty, ask: "What's the task? (one sentence)"
Store as $TASK.
</step>

<step name="scope">
Classify $TASK before touching anything:

- **Inline** (default): single concern, roughly <= 3 file edits, no research,
  no new dependencies or architecture changes.
- **Planned**: `--plan` was passed, OR the task is multi-step enough that you
  would want a written breakdown (4+ edits, ordering matters, partial
  completion would leave the repo broken).
- **Too big**: feature-sized, belongs on the roadmap. Ask what is on disk
  before naming a destination - run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status` and let
  its own answer pick the branch. Then say so and stop; no work path runs.

  On `ok:true` there is a roadmap to append to, so the first stop is the one
  command that appends. Take `total + 1` as `{N}` and print, substituting
  `$TASK` and the resolved `{N}` rather than printing either literally:
  "This is phase-sized. Run /cad-phase add $TASK to put it on the roadmap as
  phase {N}, then /cad-context {N} and /cad-plan {N}. Or /cad-capture it for
  later."

  On `ok:false` with reason `no-planning-dir` there is no roadmap, so do NOT
  compute `total + 1` and do NOT name the command that appends to one - it is
  the command that refuses here. NAME BOTH doors and let the user pick: "This
  is phase-sized, and there is no Cadence project here yet. /cad-adopt starts
  one from a repo that already has code and history; /cad-new-project starts
  one from a blank page. Either gets you a roadmap this can go on." The arm
  NAMES the two rather than measuring which applies: Cadence has no seam for
  "existing code" versus "blank page" - `status` collapses every treeless
  repository into that one reason - and probing the git root here would make
  /cad-task answer differently than /cad-progress on the same tree. Add no
  `[ -d .planning ]` check beside it either; the seam's answer is the gate,
  and two ways of asking "is there a project here" in one workflow drift.

  On any other `ok:false`, relay the envelope's `reason` and `hint` and stop,
  the way `workflows/execute.md`'s `locate` step relays a seam refusal.

When unsure between inline and planned, pick planned.
</step>

<step name="git_guard">
(Inline and planned scope only. The "too big" arm has already said so and
stopped, so it reaches no commit and is charged no branch question. Before
`bracket` rather than after, because the guard's `ask` arm carries an Abort
option and an abort taken past an open bracket would leave a dispatch event
with nothing to close it.)

Apply the protected-branch guard from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` before any work.
</step>

<step name="bracket">
(Both work paths, and NOT the "too big" arm: that arm says so and stops, so a
bracket opened there would have nothing left to close it.)

One Bash invocation makes this run's own directory, mints its run token, reads
the start sha off HEAD, writes the read set, and opens the bracket. The three
`trace` lines stay on their own lines rather than chained with `\`, because a
continuation joins them into one command and one command carries one event:

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-task-XXXXXX")" && T="$$-$(date +%s)" && S="$(git rev-parse --short HEAD)" && printf '%s' "<the paths this task will open, comma-separated>" > "$D/read-set.txt" && echo "scratch dir: $D  run token: $T  start sha: $S"
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase 0 --family lifecycle --event phase_start --sha "$S-$T"
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase 0 --family lifecycle --event dispatch --plan <the task's slug> --role cad-task --read-file "$D/read-set.txt"
```

The correlation id is DERIVED from the `--sha` value, the way
`workflows/execute.md` derives a phase's from its own `phase_start`. Without an
anchor every phase-0 event keys to the bare `0`, and two task runs then fund one
worker. The TOKEN half is what makes the id PER-RUN rather than per-commit: a
run that ends without committing leaves HEAD where it was, so a re-run of the
same slug from the same commit would mint a byte-identical anchor, and because
the worker key pairs FIFO the second run's close would pair against the first
run's still-open dispatch. `--sha` is a free-form string flag here - nothing
validates it as hex - so carrying the token in it costs no seam change.

The START SHA ALONE - the echoed `$S`, never the anchor value - is what the
`risk_check` step's `--base` and the `record` step's `--base` want. Two
quantities from one measurement: name them apart and hand neither the other's.

The read set rides a PATH and not an inline `--read` because it is
caller-derived text, which references/conventions.md binds to a file transport.

The bracket is closed by ONE line, and it lives in the `done` step. Exactly one:
the trace census asserts closes equal dispatches, and a second closing call on
one moment appends a duplicate terminal that either funds this dispatch twice or
strands the next run as unpaired. EVERY path that ends this run once the bracket
is open routes through that one line - a blocking `risk_surface` FAIL surviving
its one narrowed re-arm included.

That close carries no `--tokens` and no `--turns`, and neither is an oversight:
both figures are read off a SUBAGENT's return, and this bracket bills the
COORDINATOR, which has no return to read. So the role renders `unrecorded`
rather than claiming a number - an invented figure would land in
`trace suggest`'s share denominator and misprice every other role with it.
</step>

<step name="inline_path">
(Inline scope only.)

1. Read the relevant files.
2. Make the change.
3. Verify: run `workflow.test_command` from config if set and relevant,
   otherwise do a direct sanity check of the changed behavior.
4. Commit per references/git-guard.md rail 2 (specific files, conventional message).

No PLAN.md, no SUMMARY.md, no state writes.
</step>

<step name="planned_path">
(Planned scope only.)

1. Write `.planning/tasks/{slug}/PLAN.md`: 1-3 atomic tasks, each with files,
   action, and a falsifiable verification ("running X shows Y", not "X works").
   If `.planning/` does not exist, put the plan nowhere - keep it in-context
   and say so; a task plan does not justify creating project scaffolding.
2. Execute task-by-task in the current context: change, verify, commit
   atomically per task.
   Exception: if the current context is already heavy or the work benefits
   from a fresh context, dispatch cad-executor with the plan via the
   spawn-agent seam instead, and wait for its result.
3. Append a 3-5 line "Outcome" section to the PLAN.md (what shipped, commit
   hashes, deviations). When step 2's cad-executor exception was taken, write
   it from `.planning/tasks/{slug}/reports/plan-1.md` - the executor returns a
   digest, not a table - read once here. No separate SUMMARY.md for tasks.
4. If `planning.commit_docs` is true and the plan file exists, commit it, plus
   that report file when one was written (`docs: task plan {slug}`).
</step>

<step name="risk_check">
ASK THE SEAM whether any commit's diff touched a risk surface - never by reading
the diff against a prose list, which left no record at all when it matched
nothing.

FIRST, whether there is a range to ask about. A run that landed no commits
leaves HEAD where it was, so `git rev-parse --short HEAD` still prints the
echoed `$S` and the range's two ends are ONE commit. Nothing landed, so nothing
can have matched: do NOT run `risk-check run`. Append the skip in its place:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase 0 --family outcome --event risk_check_skipped --plan <the task's slug> --sha "$S"
```

The event NAME is the record that nothing was checked because nothing landed.
Asking the seam over that pair instead writes `checked: true, empty: true` - a
completed clean check over a range that could not have matched. Done is reported
on that append's `written: true` under the completion rule below, and its
`written: false` takes that same rule's absent-root arm rather than a verdict of
its own; the `record` step proceeds as written either way.

When HEAD has moved, the range is real:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase 0 --base <parent of the task's first commit> --head HEAD
```

`--phase 0` because a task sits outside the phase spine while `--phase` is
required: 0 is the one number no roadmap phase carries, so a task's records
never join a phase's.

When that call answers `ok:false` with reason `surfaces-unanswered` it has
delivered neither a verdict nor a skip - the seam is declining to scan on the
all-eight set nobody chose - so run `detect-surfaces --root .` and put the
one-time surface question to the user IN THIS RUN, exactly as
`references/risk-surface.md` states it: the envelope's `options` rendered in
the order they arrive, the eight-line legend beside them, through the ask-user
seam. Then re-run the same `risk-check run --phase 0` line with `--surfaces
<the chosen set, comma-separated>` and carry on from THAT envelope. Persisting
the answer at the repo layer is the `config.mjs set` line that reference
already carries and is not restated here; but where this run's own `bracket`
append answered the absent-root reason there is no repo layer to persist into,
because `config.mjs set` writes `.planning/config.json` and creating it is the
scaffolding this workflow's success criterion forbids - so the answer rides
`--surfaces` for this run alone and the question is asked once per run. Stopping
at the refusal instead is how the one gate the schema defaults to `blocking`
never runs at all for the fresh user this inline path exists for.

A non-empty `matches` OR `inconclusive: true` fires the `risk_surface` review
trigger per references/review-triggers.md before reporting done - an unjudged
range is not a cleared one. The commits
already exist, so there is no staged diff in the index: write
`git diff <parent of the task's first commit>..HEAD` to
`.planning/tasks/{slug}/risk-task-{slug}.diff` and fire with that path - shape (c), the
flagged-diff FILE path, since shape (a) refs is not one of the shapes the wiring
table admits for `risk_surface`. That file is transient exactly like
`execute.md`'s `plan-<k>-risk-task-<n>.diff`: never stage it, and delete it once
the trigger returns.

THE COMPLETION RULE, stated here and nowhere else - it decides every
`written: false` this run can see: the skip append above, this check's own
`trace`, and the `record` step's envelope below.

On `ok:true`, done is reported in exactly two states: the record REACHED the
trace, which the envelope states as `written: true`; and a `written: false`
whose `reason` is the absent planning root - `ENOENT` from the trace seams, "no
planning root" from `task-record` - where the run reports done with the check's
disposition stated and its record called unrecorded, because git is the code
record and the durable Cadence receipt is the one thing a treeless run has
nowhere to put. `ENOENT` is the whole of that spelling on the trace side:
`trace.jsonl` sits directly under `.planning/`, so an append that raised it
found no planning root, and there is no second reading of it.

A `written: false` for any other reason - a symlinked trace, a failed stat,
`EACCES` or `ENOSPC` on the append, `oversized-event`, a rotation that failed,
an unwritable or symlinked `tasks/{slug}/` - does not report done: state the
reason and re-run once a record can land. The two are told apart on the
envelope's own `reason`, never on a `[ -d .planning ]` check beside the seam;
the `scope` step already states why two ways of asking one question drift. This
path has no `risk-check status` call of its own the way `execute.md` does, so
that flag is its whole guard, and an `ok:true` with nothing on the record for
any other cause is exactly the state this step exists to refuse.

`{slug}` is this task's own slug, and neither it nor that directory is created
by the INLINE path - `planned_path` step 1 is the only writer of
`.planning/tasks/{slug}/`, and it declines to create even that when `.planning/`
is absent, because a task plan does not justify project scaffolding. So derive
the slug here when the inline path did not (kebab-case of the task description).
A redirect into a directory nothing created fails `No such file or directory`,
and this trigger is `blocking` at every level, so that failure is a blocking
gate that cannot fire rather than a gate that passes.

Which directory depends on whether this task already owns one, and the INLINE
path never does:

- The PLANNED path wrote `.planning/tasks/{slug}/PLAN.md`, so the directory
  exists and the diff goes beside it at the named path above. Delete the
  `.diff` on return and the directory stays, correctly - it holds the plan.
- The INLINE path creates no directory and must not start now: the `record`
  step below is the only writer under `.planning/tasks/{slug}/` on this path,
  and an inline task that `mkdir -p`s a slug directory HERE leaves it behind
  empty whenever the run ends before that step - a blocking FAIL, say - once the
  transient diff is deleted, accreting one per risk-surface task. So make this
  run's own directory - `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-risk-XXXXXX")"` - write
  the diff to `$D/cadence-risk-task-{slug}.diff`, and fire with THAT path -
  still shape (c), which since `v2.6.1` admits a flagged-diff file however it
  was produced. A fixed shared name collides between two inline runs of the
  same-slugged task, and what collides is the artifact of the trigger the schema
  defaults to BLOCKING - the shape `v2.3.0` already closed once as a stale diff
  reaching a blocking gate. The `.diff` is still deleted once the trigger
  returns and the run directory is left for the operating system to reap;
  neither is a `.planning/` artifact, so the success criterion holds. The same
  applies when `.planning/` does not exist at all.

The settle writes its record with `--task {slug}` - `/cad-task` fires with
`--phase 0` on purpose and keeps its artifacts under `.planning/tasks/{slug}/`,
so that flag is what puts the ruling beside the sibling REVIEW file instead of
in a `phases/0/` that does not exist (`references/review-record.md`). The INLINE
path owns no directory, so it owns no home for a record either: its FAIL stays
with the user, the same absence the `<guardrails>` line below already states.

This trigger is `blocking` at every level, so its re-arm is CAPPED at ONE
narrowed round - RE-READ
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` before fixing a
FAIL, since this workflow does not preload it and the cap lives only there.

On the `--plan` path, the fix is owned by a continuation `cad-executor`
dispatched with `.planning/tasks/{slug}/PLAN.md` and the persisted findings
path, bracketed like any executor. Its worker key is the plan key `1` -
`skills/cad-executor-contract/SKILL.md` derives `k` from the plan file's own
name, `1` for a bare `PLAN.md` - deliberately a different key from this run's
own `--plan {slug}` `cad-task` bracket, so the two workers do not pair FIFO
against each other. Its lease gate does not fire at all: the executor
contract skips `lease-check` whenever `<plandir>` is not
`.planning/phases/<N>/`, and `/cad-task` dispatches from
`.planning/tasks/<slug>/`. The INLINE path never writes a PLAN.md, so it mints
no worker key for a fix to dispatch under: its `risk_surface` FAIL stays with
the user there, the same absence that already keeps the `<guardrails>` line
below true.
</step>

<step name="record">
(Both work paths. The fast path is where the majority of real commits land, so
the hole in the corpus is precisely there.)

Write what shipped into this run's own directory and hand the seam the PATH -
that prose is caller-derived text, which references/conventions.md binds to a
file transport, so it never rides the inline `--text` form:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" task-record --slug <the task's slug> --base <the echoed start sha> --head HEAD --text-file <the echoed scratch directory>/what-shipped.txt
```

Every figure in the record is DERIVED from the range - the commits table from
one `git log` and the declared-files lines from one `git diff --name-only` - so
nothing is retyped onto a flag and a re-run over an unchanged range rewrites the
same bytes.

The seam creates `.planning/tasks/{slug}/` under an EXISTING `.planning/` and
creates NOTHING where `.planning/` is absent: there it answers `written: false`
with a reason and writes no record at all. That reason is the absent-root one
the `risk_check` step's completion rule already decided - the run reports done
and calls its record unrecorded - so an inline task in a repository with no
planning tree scaffolds nothing AND still finishes, which is what this
workflow's success criterion actually protects.
</step>

<step name="done">
Close the bracket first - this is the only close of THIS RUN's own `cad-task`
bracket, and every path that ends the run reaches it. A dispatched fix
worker's bracket takes its own close, keyed to that worker:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase 0 --plan <the task's slug> --role cad-task --agent-id <the id on the subagent return>
```

On a run that ends WITHOUT reporting done - a blocking `risk_surface` FAIL that
survived its one narrowed re-arm, a guard refusal, a stop you can still describe
- add `--detail-file "<the echoed scratch directory>/close-detail.txt"` naming
why, and the seam closes a `checkpoint` instead of a `return`. A run that never
reaches this line at all is reported as unpaired, which is what it is.

Report:

```
Done: {what changed}
Commit(s): {hashes}
Files: {list}
Risk check: {`risk_check_skipped` when nothing landed | `checked: false` and the row's cause when the range could not be read | `checked: true, empty: true` when it was read and held nothing | the `matches` list or `inconclusive: true` and the review's outcome when the trigger fired}, {recorded, or unrecorded because <the reason, in words>}
Record: {the `record` path from the task-record envelope}
```

Two lines, two rules. The `Record:` line rides an envelope that said
`written: true`; on `written: false` - no planning tree, an unwritable or
symlinked `tasks/{slug}/`, a range that would not resolve - drop the line and
state the envelope's reason in its place, because a record that never landed
must not read as one that did.

The `Risk check:` line is never dropped, because a verdict that RAN is reported
whether or not its receipt landed. Both halves are the envelope's own words and
nothing minted: the verdict from the `risk-check run` envelope or the
`risk_check_skipped` event that stood in for it, then `trace: {written: true}`
rendered as recorded and `trace: {written: false, reason}` as unrecorded with
the reason in words - the absent planning root where that reason is `ENOENT`.
That second half is what tells a treeless run's done block apart from an adopted
one's. Whether this block is reached at all was decided by the `risk_check`
step's completion rule; this step only renders what that rule let through.

No next-step menu.
</step>

</process>

<guardrails>
- Never spawn a subagent on the inline path.
- Never use worktrees - cad-task is always sequential.
- Never write STATE.md or any activity log for a task - git is the record.
- If mid-task the scope grows past "planned", stop and re-route to
  /cad-phase add rather than improvising a phase inline.
</guardrails>

<success_criteria>
- [ ] Protected-branch guard applied before the first commit
- [ ] Each logical change is one conventional commit of specific files
- [ ] Verification was observed behavior, not assumption
- [ ] No PLAN.md and no SUMMARY.md for an inline task, and no `.planning/` tree
      created where none exists
</success_criteria>
