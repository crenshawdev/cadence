# Why /cad-plan is shaped this way

Companion to `cadence-core/workflows/plan.md`. **Not read at runtime** - no
workflow, skill or agent loads this file, and it is outside every budgeted
prose surface (`weight.mjs` measures `cadence-core/workflows/*.md` top-level
only).

Read it before EDITING that workflow. Every step below survived a measured
failure or a rejected alternative, and a step removed for looking redundant
takes its failure back with it.

Anchors match the step names in the workflow.

---

## parse - why the size check runs before the dispatch

A ten-to-fourteen minute planner run spent learning what a count already knows
is the cost this check exists to remove. That is the whole argument for
`plan-size` running at `parse` rather than only after the return.

`--max-reqs 12` is a fixed rail rather than a config key because it is a shape
rule about roadmaps, not a per-project preference. A phase over it will produce
compound tasks whatever ceiling the planner is handed, so a project that raised
the number would only be choosing to be told later.

## parse - why the plan gate is not in the config batch

`fire(trigger)` takes every gate from the routing bundle (`route.mjs resolve`),
which is what makes the schema's own default - and the plan-time risk floor that
raises the `plan` gate over it - reach a fire site rather than only the
seam. A `config.mjs get` of a gate is not a source for one either way: unset, it
answers `null` and names `route.mjs resolve` as where the gate is
resolved. Adding the gate to the batch would create a second, staler answer to a
question the bundle already answers.

## parse - why memory.backend rides this batch

So the effective recall backend is read through the config touchpoint already
present here, with no extra Bash round-trip.

## spawn_planner - why the resolve command is spelled out at the site

It is four lines, and finding them in `references/seam-spawn-agent.md` costs a
grep with a window wide enough to be the tell that the caller is guessing -
measured at ~9 KB read to recover a 4-line command.

`seam-spawn-agent.md` stays the source for what the resolve RETURNS (the retry
rungs, the per-role pin, the `{ok:false}` arm). The workflow carries only the
invocation. `check_gate`'s resolve is written out again for the same reason: its
role and flags differ, and what the call returns is stated once, elsewhere.

## spawn_planner - why the recall gate precedes the call (D-03)

Recall's own backend-off return is a backstop for a direct caller, not this
workflow's gate. `none` means no recall runs and no block is appended, rather
than a call made and a result discarded.

## spawn_planner - why surfaced.json is a file

The query is model-authored. Re-running the search at `count_planned` from
re-typed terms returns a different top 5, and a plan that had cited every real
hit would then report zero - indistinguishable from a genuine zero, which is the
false signal the count exists to remove (D-03).

The `cat` is chained on the write with `&&` because the step still needs the
results in hand to build the `<recalled_memory>` block. The response measures
8,617 B, under the transport threshold, so a redirect that left the step blind
would buy a second round trip for nothing.

## spawn_planner - why the scratch directory is guarded at creation

A carried literal is pasted into a later command unquoted-by-construction, so
the guard REFUSES the directory at creation rather than trying to quote it
defensively at every use site. `mktemp` builds the path from `$TMPDIR`, which
the operator does not always own (a cloned repo's `.envrc`, a devcontainer, a CI
runner), and one `"` in it closes the argument and runs the rest as commands.

The character class is deliberately narrow. A temp root holding a space is
refused too, and fixing that is one `export` away, where a path that executes is
not.

## check_size - why a count sits behind two model-judgment gates

Soft enforcement was measured and failed: a planner told the ceiling and a
checker told to flag the overrun both passed an 8-task plan against a ceiling of
4. Two model-judgment gates missed a comparison a count makes exactly.

## check_census - why this one refuses instead of reporting

`plan-size` above and `criteria-size` report, because the workflow decides what
to do about a size. A soft report HERE reproduces exactly the failure this check
exists against: the planner is told, continues, and the count goes red inside an
executor's commit with no plan naming the file that would re-pin it.

Not hypothetical. This project's own record (`.planning/_archive-v3.7.1`)
carries two `undeclared-files` refusals that were committed rather than obeyed.

## count_planned / count_committed - why the pair, and why advisory (D-05)

`check_gate` drives one checker revision that edits the plan file, and an
adjudicated survivor edits it again. A single early count describes a plan that
no longer exists, and a revision that ADDED the missing citation would still sit
on the record as a zero-citation plan. Recording the PAIR is what makes a
revision's effect on citation visible.

Both are advisory because a measurement that could halt planning is the gate
this cycle deliberately did not ship: a threshold needs a legitimate-zero rate
to be set against, and these two counts are what produce it.

`inline_plan` runs both for the same reason one step further on (D-12):
criterion 2 names `/cad-plan`, not a dispatch mode, and leaving the cheap path
out would make it the one path with no citation data.

## done - why the three citation states are named apart

A near-zero count reads two ways that need opposite fixes: the search surfaced
the wrong things, or the planner ignored the right ones. Naming the states apart
is what keeps the report from implying one when it measured the other, and it is
why "it surfaced S and the plan cited ZERO of them" is said in those words rather
than left as a `0` for a reader to interpret.

The step adds no second suggestion and no branch on the count because this cycle
produces the data that settles which of those two readings is true, rather than
acting on it.

## review - why the reviewer gets four paths, not one

The reviewer's contract asks it for "a requirement with no task" and "a
contradicted locked decision". Handed the PLAN alone it has nothing to check
either against, while `check_gate` hands `cad-plan-checker` these same three
files for the same questions.

All four are reference paths rather than inlined text because inlining would
keep every byte of them resident for the rest of the run.

## review - why advisory overlaps the commit but adjudicated does not

The advisory payload is the PLAN file(s) already on disk, and the commit alters
none of them, so the reviewer reads nothing the commit writes and advisory
findings gate nothing downstream. Serializing them would buy a wait for findings
that stop nothing.

Adjudicated waits because an applied survivor EDITS the plan files the commit
stages.
