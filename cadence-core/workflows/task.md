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

<step name="git_guard">
Apply the protected-branch guard from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md` before any work.
</step>

<step name="scope">
Classify $TASK before touching anything:

- **Inline** (default): single concern, roughly <= 3 file edits, no research,
  no new dependencies or architecture changes.
- **Planned**: `--plan` was passed, OR the task is multi-step enough that you
  would want a written breakdown (4+ edits, ordering matters, partial
  completion would leave the repo broken).
- **Too big**: feature-sized, belongs on the roadmap. Say so and stop:
  "This is phase-sized. Route it through /cad-context -> /cad-plan, or
  /cad-capture it for later."

When unsure between inline and planned, pick planned.
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
nothing:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase 0 --base <parent of the task's first commit> --head HEAD
```

`--phase 0` because a task sits outside the phase spine while `--phase` is
required: 0 is the one number no roadmap phase carries, so a task's records
never join a phase's.

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

Done is reported only on an `ok:true` run whose record actually REACHED the
trace, which the envelope states as `written: true`. On `written: false` - a
symlinked trace, a failed stat, a full disk, or the size cap - do not report
done: state the reason and re-run once a record can land. This path has no
`risk-check status` call of its own the way `execute.md` does, so that flag is
its whole guard, and `ok:true` with nothing on the record is exactly the state
this step exists to refuse. When there is no `.planning/` at all the record has
nowhere to go and the same rule holds - create it, or say the check is unrecorded
rather than reporting done on it.

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
  same-slugged task, and what collides is the artifact of a trigger that BLOCKS
  at every stakes level - the shape `v2.3.0` already closed once as a stale diff
  reaching a blocking gate. The `.diff` is still deleted once the trigger
  returns and the run directory is left for the operating system to reap;
  neither is a `.planning/` artifact, so the success criterion holds. The same
  applies when `.planning/` does not exist at all.

This trigger is `blocking` at every level, so its re-arm is CAPPED at ONE
narrowed round - RE-READ
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` before fixing a
FAIL, since this workflow does not preload it and the cap lives only there.
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
with a reason and writes no record at all. So an inline task in a repository
with no planning tree still scaffolds nothing, which is what this workflow's
success criterion actually protects.
</step>

<step name="done">
Close the bracket first - this is the only closing call in this workflow, and
every path that ends the run reaches it:

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
Record: {the `record` path from the task-record envelope}
```

The `Record:` line rides an envelope that said `written: true`. On
`written: false` - no planning tree, an unwritable or symlinked
`tasks/{slug}/`, a range that would not resolve - drop the line and state the
envelope's reason in its place: a record that never landed must not read as one
that did. This is the same discipline the `risk_check` step applies to its own
flag.

No next-step menu.
</step>

</process>

<guardrails>
- Never spawn a subagent on the inline path.
- Never use worktrees - cad-task is always sequential.
- Never write STATE.md or any activity log for a task - git is the record.
- If mid-task the scope grows past "planned", stop and re-route to
  /cad-context rather than improvising a phase inline.
</guardrails>

<success_criteria>
- [ ] Protected-branch guard applied before the first commit
- [ ] Each logical change is one conventional commit of specific files
- [ ] Verification was observed behavior, not assumption
- [ ] No PLAN.md and no SUMMARY.md for an inline task, and no `.planning/` tree
      created where none exists
</success_criteria>
