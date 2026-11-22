<purpose>
The pipeline runs one step past where the skill's objective stops: read the
phase goal (plus CONTEXT.md if /cad-context ran) -> spawn cad-planner ->
optional cad-plan-checker gate -> fire the `plan` review trigger -> COMMIT
DOCS.

Research is /cad-context's job; second opinions belong to the review
subsystem.
</purpose>

<process>

<step name="parse">
Parse `$ARGUMENTS`:

- `[phase]` - phase number. If omitted, run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status` and
  take `current`; if the current phase is already planned, its `phases[]`
  entries show which phases still need plans - ask (ask-user seam):

  - header: "Phase"
  - question: "Which phase do you want to plan?"
  - options:
    - "Phase {N}: {phase name}" - one option for each phase the status read shows without a plan, up to four. When more qualify, name every phase left out in the last option's description and say its number can be typed under Other

  Anything else the person types is taken as a phase number.

  Instead of that ask, an `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a derived
  closed milestone, not a planning target: stop with "The milestone is
  closed - no active cycle. /cad-phase add opens the next one." There is no
  phase to plan until a roadmap entry exists.
- `--skip-check` - skip the plan-checker gate even when workflow.plan_check
  is true.
- `--inline` - plan in the main context instead of spawning cad-planner.
  Honored only for small phases (see route).
- `--gaps` - Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/plan-gaps.md`
  and follow it (it rejoins at spawn_planner).

Read config through the seam - one call for every key this workflow uses:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  workflow.plan_check workflow.inline_plan_threshold workflow.max_plan_tasks \
  workflow.max_plan_bytes \
  planning.commit_docs \
  git.protected_branches git.on_protected \
  git.base_branch memory.backend testing.scope planning.code_map
```

`testing.scope` set means the project accepted a testing policy. Then run, once:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" test-policy check --root .
```

Hold `gate_found`. A project with no gate yet gets `ok:false` with
`gate_found: false`, the answer the setup steps say to expect, so it is not a
stop. Any other failing answer has `gate_found: null`: relay its `detail` and
plan without the CI task until it is fixed. Unset, make no call.

Then size the phase, BEFORE spending a planner dispatch on it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-size --phase {N} \
  --max-reqs 12 --max-tasks {workflow.max_plan_tasks}
```

A `phase-too-big` entry in `over` means this phase names more requirements than
one phase should carry. Present it with the offer at `too_big` below WITHOUT
dispatching the planner. `--max-reqs 12` is a fixed rail, not a config key.
`requirements_found: false` is NOT zero - a phase with no ROADMAP detail block
is unmeasured, and it is never compared.
</step>

<step name="load_phase">
Once N is known, steps 1-3 are independent reads/globs - fire them
in one message and evaluate the stop/ask gates after they return. Only a call
that consumes a prior call's output is serialized.

1. Read this phase's entry in .planning/ROADMAP.md: name, goal, requirement
   IDs. No entry -> stop: "Phase {N} is not in ROADMAP.md."
2. If .planning/phases/<N>/CONTEXT.md is present, extract just its `Plan shape`
   line (grep the Scope boundary). Absent is fine - plan from the roadmap goal
   alone.
3. If PLAN*.md already exists in the phase dir (and not --gaps): ask
   (ask-user seam). Never overwrite silently.

   - header: "Plans exist"
   - question: "Phase {N} already has plan files. Do you want to plan it again from scratch?"
   - options: "Plan again - the new plans replace the existing plan files" / "Stop - leave the existing plans as they are"

   On "Stop", abort. A `--gaps` run asks nothing: it writes the file
   plan-gaps.md step 3 names.
</step>

<step name="route">
- `--inline`: estimate the task count from the goal and CONTEXT.md. Estimate
  <= workflow.inline_plan_threshold -> go to inline_plan. Bigger -> tell the
  user the phase exceeds the inline threshold and continue to spawn_planner.
- Otherwise: spawn_planner. Do not plan inline without the flag.
</step>

<step name="spawn_planner">
Dispatch cad-planner. Resolve its model + agent file and write the dispatch
bracket in ONE call:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-planner \
  --attempt 1 --phase {N} \
  --bracket-read "<the phase input path>"
```

Dispatch the `agent_type` the resolve returns with its `model`; a `model` of
null sends no model parameter. This step needs nothing else from
`references/seam-spawn-agent.md`: open that file only when the resolve answers
`ok:false` or a warning says a retired routing key was ignored. Relay every `warnings[]` entry
the resolve returns to the user before dispatching, each distinct warning once
per workflow run (seam-spawn-agent.md's relay rule). `--bracket-read` is the read-set this site
causes the planner to read, one comma-separated value, never a repeated flag.
The resolve writes the lifecycle dispatch event itself; only the CLOSE in
handle_return stays here. Then wait - do not read, edit, or plan anything else
while the subagent runs.

The planner reads one composed phase input in place of the four phase documents.

- **Compose.** Once per run, before the resolve above goes out, make this stretch's own scratch directory and print it: `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "scratch dir: $D"`. Never recall's directory. Keep the printed path as a literal, then run:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" brief --phase {N} --role phase --out-dir <the scratch directory>
  ```

  Keep the path the answer names as a literal too: `check_gate`, the `review` step and the revision re-dispatch name that same file and compose nothing more. The transcript gets the envelope, never the input. This session never opens the input, and reads the documents only where `load_phase` and an `--inline` `route` say.
- **Bracket.** Its `--bracket-read` value is `<the phase input path>`. In gaps mode it is that path plus `.planning/phases/{N}/UAT.md` and the existing PLAN* and SUMMARY* files.
- **Prompt.** The `Read before planning:` list names that file by its absolute path and keeps the gaps line and the source-files line. Gaps and revision modes reuse this prompt and so name the same file.
- **A refused or unreadable answer.** Print one line with what it names, and dispatch with the four document lines the prompt below lists. The bracket names those four.

Before assembling the prompt, recall prior-project memory when the effective
`memory.backend` read in `parse` is `builtin` (skip this entirely when `none` -
do not issue the call). When recall does run, batch it with the
`route.mjs resolve` above in one message.

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-plan-XXXXXX")" \
  && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D holds a character a carried literal cannot survive" >&2; exit 1;; esac \
  && T="$$-$(date +%s)" && printf '%s' "$T" > "$D/run-token" \
  && node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the phase goal>" > "$D/surfaced.json" \
  && cat "$D/surfaced.json" \
  && echo "scratch dir: $D  run token: $T"
```

`surfaced.json` is the set `count_planned` and `count_committed` read. The query
is model-authored: NEVER re-run the search from re-typed terms at those steps.

Carry both printed values as literals at `count_planned` and `count_committed`
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/conventions.md`'s carried-literal rule).

Parse its JSON line (`{ok, results:[{score, source, phase?, snippet}]}`) and
append a `<recalled_memory>` block at the END of the `<planning_context>` below
(its volatile region), one line per top result carrying the `snippet`, `source`
file, and `phase` when present (optional - phaseless CAPTURE items omit it;
render it only when present). These snippets ride the dispatch prompt, never the
cad-planner definition. On `none`, or when results are
empty, omit the block.

Prompt:

```markdown
<planning_context>
Phase: {N} - {name}
Mode: {standard | gaps | revision}
Goal: {goal line from ROADMAP.md}
Requirements: {phase requirement IDs}
Plan shape (from CONTEXT, directive): {one plan | multiple plans | split - deferred slice | not specified}
Task ceiling: {workflow.max_plan_tasks} tasks per plan.

Read before planning:
- {the phase input path}
- {refused compose, instead:
  - .planning/ROADMAP.md (this phase's entry and its dependencies)
  - .planning/REQUIREMENTS.md
  - .planning/PROJECT.md
  - .planning/phases/{N}/CONTEXT.md (locked user decisions - if present)}
- {gaps mode: .planning/phases/{N}/UAT.md plus existing PLAN* and SUMMARY* files}
- The actual source files your tasks will touch

Write the plan files in .planning/phases/{N}/.

{gaps mode: write .planning/phases/{N}/{the plan filename plan-gaps.md step 3 resolved}.}

<recalled_memory>{one line per recalled result: snippet - source file, phase (when present); this block is present only under memory.backend builtin with non-empty results}</recalled_memory>
</planning_context>

(The return markers and report shape are the agent's own cached definition -
never restate them in the dispatch tail; dispatch-shape.md's cache
discipline.)
```

When `testing.scope` is set, the prompt carries one more block, the
`<testing_policy>` below, placed directly before `<recalled_memory>`, or
directly before `</planning_context>` when that block is absent. With it unset the
prompt carries none of it. Gaps and revision modes reuse this prompt and so
carry the block. The sentence about the CI task is added only when `gate_found`
is `false`.

```text
<testing_policy>
A testing policy is active for this project. Read ${CLAUDE_PLUGIN_ROOT}/cadence-core/references/test-policy.md once and follow it.
{gate_found false: No CI job enforces the policy yet, so this plan's first task builds or extends them as an ordinary plan task, including any required job no workflow defines yet, such as a packaging job. Take the commands, thresholds and required jobs from the values `test-policy.md` says how to read.}
</testing_policy>
```

When `planning.code_map` read in `parse` is `true`, the prompt carries a code map block, and one local scan with no model feeds it. Before assembling the prompt, make the scan once:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" codemap scan
```

On a good answer, print one line with its `stale` and `unbuilt` counts and `/cad-map`: `Code map: {stale} stale, {unbuilt} unbuilt. /cad-map builds or refreshes it.` A module with no entry reads as unbuilt, so a map nobody built still prints a line that prompts the first `/cad-map`. Then place the block below where `<testing_policy>` goes, and after it when both are present. On `ok:false`, or output that won't parse, print nothing about it, leave the block out and go on planning. This step starts nothing else: a refresh is `/cad-map`'s and the user's to type. Gaps and revision modes reuse this prompt and so carry the block, with no second scan. With the key not `true` the prompt carries none of it.

```text
<code_map>
A code map is available. Read ${CLAUDE_PLUGIN_ROOT}/cadence-core/references/code-map.md once and follow it.
</code_map>
```

The prompt carries a plan-graph block, placed after `<testing_policy>` and `<code_map>` when those are present. Gaps and revision modes reuse this prompt and so carry the block.

```text
<plan_graph>
Plans here can be run by a workflow. Read ${CLAUDE_PLUGIN_ROOT}/cadence-core/references/plan-graph.md once and follow it.
</plan_graph>
```

Revision mode: dispatch a fresh cad-planner, a new spawn per seam-spawn-agent.md,
with the checker's issues appended verbatim in a `<checker_issues>` block.
</step>

<step name="inline_plan">
(--inline under the threshold only.)

Follow cad-planner's methodology yourself: goal-backward truths, read the
files the tasks will touch, task anatomy (files / action / falsifiable
verify). Write .planning/phases/<N>/PLAN.md from the same template. One plan
file only - inline never splits.

Recall applies here too, behind spawn_planner's recall gate: run its whole
block, so the same `surfaced.json` and `run-token` land in this run's own echoed
directory, and fold its results into the inline plan's truths and tasks, citing
each recalled item's `source` file and `phase` (when present) in the task's
Action or the plan's Notes.

`count_planned` and `count_committed` apply here too. Run both steps as
written - the first once this step's `PLAN.md` is on disk, the second after
`commit` - against that same `surfaced.json` and behind that same token check.
Do NOT restate either call here.

`check_census` applies here too, under the same prohibition on a second
spelling: run that step exactly as written once this step's `PLAN.md` is on
disk, and do not continue while it refuses.

With `testing.scope` set, read `references/test-policy.md` once and follow it
as spawn_planner's `<testing_policy>` block says: the testing scope in each
task's `Verify:`, and the CI task first when `gate_found` is `false`.

The scan and the printed line in spawn_planner's `planning.code_map` stretch
apply here too, under the same prohibition on a second spelling: with that key
`true`, make that scan once and print that line before planning, and on
`ok:false`, or output that won't parse, print nothing about it and go on
planning. An inline plan has no prompt, so it carries no block.

Read `references/plan-graph.md` once, for its task fields section only: an inline plan never splits, so `depends_on` and the width don't apply, and it carries no block.
</step>

<step name="handle_return">
Close the bracket before anything else, per seam-spawn-agent.md's bracket rule.
On the empty-or-unmarked arm below, that return goes to a scratch file and rides
`--detail-file <path>`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-planner --role cad-planner --agent-id <the id on the subagent return> --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return>
```

- `## PLANNING COMPLETE` - confirm the listed files exist on disk, continue.
- `## PHASE TOO BIG` - rejoin at `too_big` below.
- Empty or unmarked return - if phases/<N>/PLAN*.md exists on disk, treat
  the files as authoritative and continue; otherwise report the failed
  spawn and stop.
</step>

<step name="too_big">
Reached two ways: a `phase-too-big` entry from `plan-size` at `parse` (before
any planner ran), or a `## PHASE TOO BIG` return from the planner.

State the measurement first, in one line - the requirement count and the
ceiling, or the planner's own reason - then ask (ask-user seam) with these
three options, the first marked `(recommended)`:

- header: "Too big"
- question: "This phase is bigger than one plan should carry. How do you want to handle it?"
- options:
  1. "Split into plans (recommended) - the work is divided into several plans inside this phase. Plans that touch the same files run in order. The phase keeps one goal, one verification and one landing."
  2. "Split into phases - use this when the phase holds more than one deliverable. Planning stops here. You add the new phases, then plan each one. Phases that don't depend on each other can run side by side, and each is checked and landed on its own."
  3. "Plan it all anyway - the planner writes plans for the full scope. The result may be over the size limit, and Cadence says so instead of letting it pass quietly."

What each option does:

1. Re-dispatch the
   planner ONCE, instructed to write `PLAN-1.md`, `PLAN-2.md`, ... each within
   the task ceiling.
2. Stops here; you
   run `/cad-phase add`, then `/cad-plan` per phase. Independent phases can run
   concurrently (see `parallelization.max_concurrent_agents`).
3. Re-dispatch ONCE with that instruction. The
   result is a plan over its ceiling, and `check_size` below will say so rather
   than let it pass silently.

Do NOT claim option 1 is unavailable because plans cannot share files.
`plan-overlap` reports a shared path so the caller knows the plans are
sequential rather than concurrent; it does not refuse the split, and a
sequential multi-plan phase is a shape this workflow supports.

This is a consult dead-end: before that ask, run offer_consult per
references/consult.md with the split problem as the situation.
</step>

<step name="check_size">
The written plan against the ceiling the planner was handed. A COUNT, run after
`handle_return` and before `check_gate`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-size --phase {N} \
  --max-tasks {workflow.max_plan_tasks} --max-bytes {workflow.max_plan_bytes}
```

`plan-too-many-tasks` names the PLAN file and both numbers. It is per plan, so
the remedy is the same one `too_big` recommends: re-dispatch ONCE instructed to
split this plan's tasks across more plans.
Say the numbers out loud when you do - "PLAN.md carries 8 tasks against a
ceiling of 4" - because the point of this step is that the overrun stops being
silent.

`plan-too-many-bytes` gets exactly that treatment one question over: the BYTES
that plan's `files:` frontmatter declares, which is the read set ONE executor
dispatch is handed and is what the user pays for. Name the PLAN file and both
numbers out loud - "PLAN-1.md declares 712,004 bytes against a ceiling of
675,000" - and the remedy is the same split into more plans, because a plan's
declared list splits with its tasks. Read the `absent` count beside the figure
before you judge it: it is how many declared paths are not on disk yet, so a low
byte count beside a non-zero `absent` is a plan whose files do not exist yet
rather than a cheap dispatch.

Not a hard halt. The user may have chosen option 3 at `too_big` and asked for
the full scope, and a check that refused what the user just authorized would be
arguing with them. One re-dispatch, or the user's word, then continue.
</step>

<step name="check_brief">
Check each plan's brief, after `check_size` and before `check_census`.

Once per plan file the phase has, because `--plan` names one plan file:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" brief --phase {N} --plan <k>
```

In a `--gaps` run, skip a plan whose `records/reports/plan-<k>.md` opens `PLAN COMPLETE`: `/cad-execute` never dispatches it. If its brief would have been refused, say so in one line and re-dispatch nothing for it.

With no `--out-dir` it writes nothing. An `ok:true` answer may carry `reads_missing`, the `Reads` entries the index lacks, or `reads_unchecked`: relay either in one line per plan and re-dispatch nothing for it. On `ok:false`, say what the answer names out loud, and re-dispatch ONCE:

- A bad id goes to a fresh revision-mode planner on an `--attempt 2` resolve whose `--bracket-read` value is the phase input path, or the four documents when the compose was refused, closed the way `handle_return` closes a planner's return, with the refusal in its `<checker_issues>`.
- A brief over its ceiling gets `check_size`'s instruction: split this plan's tasks across more plans.

Not a hard halt. After the one re-dispatch, or the user's word, continue: `/cad-execute` runs a plan whose brief is refused from the full documents.
</step>

<step name="check_census">
The plan's lease against the hand-maintained COUNTS this repository keeps - the
numbers a human wrote down that the code must keep true. Run after
`check_size`, once the plan is on disk and before any executor could be
dispatched, and ahead of `count_planned`.

Once per plan file, as `check_brief` says:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" lease-check --phase {N} --plan <k> --plan-time
```

It answers `ok:true`, or it refuses one of three ways, and the remedy differs:

- `census-at-risk`, with a `censuses_at_risk` list. Each entry names the FILE
  the lease is missing, what that file's count is a count of, and the site that
  asserts it.
- `unparsed-lease`, with a `frontmatter_issues` list naming the lines of the
  plan's frontmatter that could not be read.
- `empty-lease`, when the plan declared no files at all - usually a `files:`
  key that is missing or misspelled.

The last two say the `files:` list could not be READ, so nothing was measured
and no census can be named. The remedy for those is to repair that plan's
frontmatter, NOT to add a file.

It REFUSES. This step offers no options and asks nothing.

When it names files, the remedy, and the whole remedy: add each named file to
that plan's `files:` list and re-run this check until it answers `ok:true`. Do
not continue to `count_planned`, and do not dispatch anything, while it refuses.

Say the missing files out loud, each beside the census it holds - "PLAN-2.md
does not declare tests/trace.test.mjs (cadence-tests repository), which holds the count of the
four refusing trace flags' sentences".
</step>

<step name="count_planned">
The read-back count at the first of its two points: how many of the prior
decisions, captures and deviations `spawn_planner` surfaced does the plan the
planner just wrote actually cite. Run after `handle_return`, before `check_gate`.

Both `<the echoed ...>` placeholders are the LITERALS `spawn_planner` printed,
never a fresh `mktemp` and never a `$(...)`. Check the token FIRST, in the same
invocation.

```
[ "$(cat "<the echoed scratch directory>/run-token" 2>/dev/null)" = "<the echoed run token>" ] || { echo "scratch-stale: that directory belongs to another run" >&2; exit 1; }
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cite-count --phase {N} --point planned --payload "<the echoed scratch directory>/surfaced.json"
```

When the effective `memory.backend` read in `parse` is `none`, no search ran and
no scratch directory exists: drop the token check and the `--payload` flag, and
the seam answers with its backend-off state - a THIRD thing on the record,
distinct from a run that surfaced nothing.

Read the one JSON line and hold `surfaced.count`, `cited.count` and `trace` for
`done`. ADVISORY, both here and at `count_committed`: this never refuses the
plan, never re-dispatches the planner and never edits a plan file to add a
citation, and a non-zero exit from either call is REPORTED and the workflow
CONTINUES to its next step.
</step>

<step name="check_gate">
Skip when workflow.plan_check is false or `--skip-check` was passed.

Dispatch cad-plan-checker the way `spawn_planner` dispatches the planner, the
bracket on its resolve:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-plan-checker \
  --phase {N} \
  --bracket-read ".planning/phases/{N}/PLAN*.md,<the phase input path>"
```

`--phase {N}` is EXPLICIT here and not left to the cursor, which still names
phase N-1. No `--plan` - the checker reviews every plan of the phase.

The checker reads the plan files and the phase input in place of the phase documents.

- **Input.** Name the phase input `spawn_planner`'s stretch composed. When no earlier step of this run composed it, as on an `--inline` run, run that stretch's compose step first as it is written there, its directory and its call, and never spell the call here.
- **Bracket.** Its `--bracket-read` value is `.planning/phases/{N}/PLAN*.md,<the phase input path>`.
- **Prompt.** The `Read:` list keeps its plans line and names that file by its absolute path. The input carries every CONTEXT decision, so a locked decision no task implements still shows.
- **A refused or unreadable answer.** The planner's arm: print one line with what it names, and dispatch the checker with the documents the prompt below lists, and the bracket names them beside the plans.

Prompt:

```markdown
<verification_context>
Phase: {N} - {name}
Goal: {goal from ROADMAP.md}
Requirements: {phase requirement IDs}
Task ceiling: {workflow.max_plan_tasks} - the resolved value, for dimension 6.
Rung: {the `effort` the resolve above returned} - that value, never a rung named here.
{testing.scope set: Testing policy: active. Read ${CLAUDE_PLUGIN_ROOT}/cadence-core/references/test-policy.md once.}

Read:
- .planning/phases/{N}/PLAN*.md (the plans under review)
- {the phase input path}
- {refused compose, instead:
  - .planning/ROADMAP.md and .planning/REQUIREMENTS.md
  - .planning/phases/{N}/CONTEXT.md (if present)}
</verification_context>
```

Close its bracket before reading a single severity, per seam-spawn-agent.md's
bracket rule. An empty or unmarked return goes to a scratch file and rides
`--detail-file <path>`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-plan-checker --role cad-plan-checker --agent-id <the id on the subagent return> --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return>
```

Handle the return:
- `## VERIFICATION PASSED` -> continue.
- `## ISSUES FOUND` -> read the severities (the checker marks each BLOCKER or
  WARNING; WARNING means quality is degraded but execution can proceed):
  - Only WARNINGs, no BLOCKER -> fold the worthwhile ones into the plan in the
    main context (or note why not) and continue. Do NOT spend the revision loop
    or a re-check on warnings alone.
  - Any BLOCKER -> ONE revision, maximum. Read
    `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/plan-revision.md` (one
    consult site - this step) and follow it: the fresh revision-mode planner
    spawn, the narrowed checker re-dispatch, both of their brackets, and the
    no-BLOCKER-left / still-a-BLOCKER ask that ends the arm.
- Empty or unmarked return -> report it, then ask (ask-user seam):

  - header: "No check"
  - question: "The plan checker came back with nothing usable, so these plans have not been checked. Do you want to go on without the check?"
  - options: "Go on unchecked - the plans go ahead as written" / "Stop - the plans stay as written and nothing more runs"

  On "Stop", abort.
</step>

<step name="review">
Fire the `plan` review trigger per references/review-triggers.md with the
payload the stretch below names. A refused
compose's payload is the PLAN file(s) plus the three artifacts the reviewer
checks them against: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` and
`.planning/phases/{N}/CONTEXT.md`. Every entry is a REFERENCE PATH the reviewer
resolves itself, never inlined text, and every entry rides the fire's
`--read` bracket list (references/review-inline.md).

`.planning/phases/{N}/CONTEXT.md` may be absent for a phase - name it optional
in the payload, as `check_gate` does. Its absence is not a resolve failure and
must not come back as the `blocker` an unresolvable reference earns.

The payload is the PLAN file(s) plus the phase input in place of the three artifacts.

- **Input.** Name the phase input `spawn_planner`'s stretch composed. When no earlier step of this run composed it, run that stretch's compose step first as it is written there, its directory and its call, and never spell the call here.
- **Bracket.** That path rides the fire's `--read` bracket list in place of the three, beside the PLAN file(s).
- **A refused or unreadable answer.** Print one line with what it names, and fire with the three artifacts as the paragraphs above name them.

The gate comes from the routing bundle; act on it.
The schema default is `advisory`, raised to `blocking` by the plan-time risk
floor and beaten by any `review.triggers.plan.gate` a layer sets. A
gate resolved `off` by config
fires nothing and returns immediately (review-triggers.md step 1) - `done`'s
Review line then reports the gate as off rather than as a pass:

- **advisory** (the default) -> fire in the SAME message as the
  `commit` step's seam calls rather than waiting. The dispatch carries the
  advisory persistence tail (references/review-inline.md): the reviewer writes its
  findings to `.planning/phases/<N>/records/REVIEW-plan.md` and closes its own bracket,
  so this session ending before the return lands loses nothing. `done` reads
  that file if it is on disk by then; otherwise its Review line names the path
  as in flight - never a clean pass.
- **blocking** -> fire and WAIT; halt on FAIL until findings are fixed or the
  user overrides.
- **adjudicated** -> fire and WAIT - triage precedes the commit.
  Triage the survivors, then apply ONLY the ones the user picked to the plan
  file(s) and leave the rest recorded in this step's report. The survivors are
  a numbered list the user triages, NONE is the default, and only what the user
  names is acted on - RE-READ
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`
  before presenting. On the workflow
  path (`references/review-workflow.md`) that wait is the launch ending the
  turn and the notice resuming this step, with nothing else dispatched in
  between, and the triage and the applying continue from the notice.

Do not re-enter the checker loop afterward - this trigger is the second
opinion, not another iteration.
</step>

<step name="commit">
1. Seed this phase's Traceability rows and update the cursor - both through the
   seam, right where the plan was just written, and both in ONE message:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" seed-reqs --phase {N}
   ```

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase {N} --status planned --next "/cad-execute {N}"
   ```

   `cursor set` derives name/total from ROADMAP and stamps the date; hold its
   envelope's `cursor.total` for `done`.
   `seed-reqs` inserts `| <id> | Phase {N} | Pending |` for exactly the declared
   `requirements:` ids that also have an `## Active` bullet in
   REQUIREMENTS.md; idempotent, so a replan or a `--gaps` plan can never
   duplicate a row. Report `orphan_ids` to the user - a declared id with no
   `## Active` bullet is scope creep or a typo. `no_active_section: true` is
   a DIFFERENT report: the milestone's `## Active` section itself is absent
   (an old-heading project, or a close that never seeded it), so those ids
   are not scope creep - the fix is to open the section, not to edit the
   plan. Status is always `Pending`; cad-verify remains the only writer of
   any other status. `ok:false` is reported to the user and the workflow
   CONTINUES regardless - the plan is already on disk, seeding is not a gate.

2. If planning.commit_docs is true: apply the protected-branch guard
   (references/git-guard.md rail 1), then commit the plan file(s),
   STATE.md, `.planning/records/state.json`, and `.planning/REQUIREMENTS.md`
   when seed-reqs reported any `seeded` ids -
   `docs: plan phase {N} - {name}` - staging exactly those files.

3. A review fire that held a `blocker` or `high` survivor records now: its
   adjudication record, receipts and `issue-filing unfixed` waited for this
   commit (`references/review-triggers.md` step 5), which is the `fix_commit`
   of a fix, or the plan file as `fix_file` when nothing was committed.
</step>

<step name="count_committed">
The same count at its second point, on the plan as it FINALLY stands, after
`commit`.

Same two literals, same token check first, same `none` arm - only `--point`
differs:

```
[ "$(cat "<the echoed scratch directory>/run-token" 2>/dev/null)" = "<the echoed run token>" ] || { echo "scratch-stale: that directory belongs to another run" >&2; exit 1; }
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cite-count --phase {N} --point committed --payload "<the echoed scratch directory>/surfaced.json"
```

Both counts reach `.planning/records/trace.jsonl` as their own `outcome`-family events
under this phase's correlation id: the seam appends each one itself, so neither
figure is retyped onto a flag, and the envelope's `trace` field is the only
place a caller learns a record was dropped. Hold this count for `done` beside
the first.
</step>

<step name="done">
Report:

```
Phase {N} of {M}: {K} plans written
Plan(s): {files, task counts}
Checker: {passed | passed after revision | skipped | overridden with N open issues}
Review: {plan trigger outcome}
Traceability: {seeded ids | none seeded | orphan_ids: [...] | no_active_section}
Citations: {planned C of S} -> {committed C of S}; {the search was off | it surfaced nothing | it surfaced S and the plan cited ZERO of them}{, record not written: <reason>}
Commit: {hash | not committed (planning.commit_docs false)}
```

M is that `cursor.total`; K is the plan files THIS run wrote (a `--gaps` run
writes one), never the phase's total. K of 1 reads "Phase {N} of {M}: 1 plan
written".

NAME the three states apart: the search was off (`backend: none` on the envelope), it surfaced
nothing (`surfaced.count` 0 with no `backend` field), or it surfaced a non-empty
set the plan cited ZERO of. Where the envelope's `trace.written` is false, name
its reason on the same line.

The counts are advisory, as `count_planned` says. Add no new ask and no branch
on the count.

With `testing.scope` unset, print one more line before the suggestion: "No
testing policy is accepted; `/cad-config --testing` sets one." With it set,
print nothing.

One suggestion only: `/cad-execute {N}` - safe to `/clear` first: the plan is
on disk and each executor runs in a fresh context.
</step>

</process>

<guardrails>
- Planner and checker run in fresh contexts through the spawn-agent seam.
  Never perform the checker role in the main context, and never spawn any
  reviewer outside the `plan` trigger.
- One PLAN.md is the default; more than one comes with the planner's
  one-line reason.
- Config keys only as named in `cadence-core/config.schema.json` - nothing invented.
</guardrails>
