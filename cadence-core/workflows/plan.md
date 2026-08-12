<purpose>
The pipeline runs one step past where the skill's objective stops: read the
phase goal (plus CONTEXT.md if /cad-context ran) -> spawn cad-planner ->
optional cad-plan-checker gate -> fire the `plan` review trigger -> COMMIT
DOCS.

Research is /cad-context's job; second opinions belong to the review
subsystem.
</purpose>

<process>

Step markers: at the START of each step below, from the step where the phase
number is known onward, append one coordinator marker naming that step.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append \
  --phase <N> --family lifecycle --event coordinator --step "<this step's name>"
```

Written once here, run once per step. The marker carries the step name and
nothing else - never `--role`, never `--tokens`. What the coordinator itself
cost is DERIVED from these markers by `/cad-report`: a step's span minus the
worker brackets inside it. A figure written onto a marker is one no host
reported.

<step name="parse">
Parse `$ARGUMENTS`:

- `[phase]` - phase number. If omitted, run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status` and
  take `current`; if the current phase is already planned, its `phases[]`
  entries show which phases still need plans - ask (ask-user seam). An
  `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a derived
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
  planning.commit_docs \
  git.protected_branches git.on_protected \
  git.base_branch memory.backend
```

Then size the phase, BEFORE spending a planner dispatch on it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-size --phase {N} \
  --max-reqs 12 --max-tasks {workflow.max_plan_tasks}
```

A `phase-too-big` entry in `over` means this phase names more requirements than
one phase should carry. Present it with the offer at `too_big` below WITHOUT
dispatching the planner: a ten-to-fourteen minute planner run to learn what a
count already knows is the cost this check exists to remove. `--max-reqs 12` is
a fixed rail rather than a config key, because it is a shape rule about
roadmaps, not a per-project preference; a phase over it is one that will produce
compound tasks whatever ceiling the planner is handed. `requirements_found:
false` is NOT zero - a phase with no ROADMAP detail block is unmeasured, and it
is never compared.

The `plan` gate is NOT in that batch: fire(trigger) takes every gate from the
routing bundle (`route.mjs resolve`), so the stakes level reaches this fire site
rather than only the seam. `config.mjs get` returns the schema DEFAULT for a
gate no layer set, which would fire at the default while the seam reported the
level's.

`memory.backend` rides this same batch so the effective recall backend is read
through the config touchpoint already here - no extra Bash round-trip. It gates
recall in spawn_planner and inline_plan below.
</step>

<step name="load_phase">
Once N is known, steps 1-3 are independent reads/globs - fire them
in one message and evaluate the stop/ask gates after they return. Only a call
that consumes a prior call's output is serialized.

1. Read this phase's entry in .planning/ROADMAP.md: name, goal, requirement
   IDs. No entry -> stop: "Phase {N} is not in ROADMAP.md."
2. If .planning/phases/<N>/CONTEXT.md is present, extract just its `Plan shape`
   line (grep the Scope boundary) - the planner reads the whole file itself
   (see the dispatch prompt below), so the coordinator needs only that one
   directive line, not the bytes (seams.md handoff read discipline). Absent is
   fine - plan from the roadmap goal alone.
3. If PLAN*.md already exists in the phase dir (and not --gaps): ask
   (ask-user seam) - replan from scratch (overwrite) or abort. Never
   overwrite silently.
</step>

<step name="route">
- `--inline`: estimate the task count from the goal and CONTEXT.md. Estimate
  <= workflow.inline_plan_threshold -> go to inline_plan. Bigger -> tell the
  user the phase exceeds the inline threshold and continue to spawn_planner.
- Otherwise: spawn_planner. Do not plan inline without the flag - the fresh
  context is what keeps plans grounded in files rather than conversation
  residue.
</step>

<step name="spawn_planner">
Dispatch cad-planner via the spawn-agent seam (references/seams.md) - resolve
its model + agent file through the seam's routing step (first dispatch is
`--attempt 1`), and put the dispatch bracket ON that resolve:
`--bracket-read ".planning/ROADMAP.md,.planning/REQUIREMENTS.md,.planning/PROJECT.md,.planning/phases/{N}/CONTEXT.md"`
- the read-set this site causes the planner to read, one comma-separated value,
never a repeated flag. In gaps mode append `.planning/phases/{N}/UAT.md` and
the existing PLAN* and SUMMARY* files to that value, matching the read list the
prompt below carries. The resolve writes the lifecycle dispatch event itself;
only the CLOSE in handle_return stays here. Then wait - do not read, edit, or
plan anything else while the subagent runs.

Before assembling the prompt, recall prior-project memory when the effective
`memory.backend` read in `parse` is `builtin` (skip this entirely when `none` -
do not issue the call). The gate precedes the call on purpose (D-03): recall's
own backend-off return is a backstop for a direct caller, not this workflow's
gate, so `none` means no recall runs and no block is appended. When recall does
run, batch it with the `route.mjs resolve` above in one message - both only feed
the single dispatch and neither depends on the other, which is the only thing
that would serialize them.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the phase goal>"
```

Parse its JSON line (`{ok, results:[{score, source, phase?, snippet}]}`) and
append a `<recalled_memory>` block at the END of the `<planning_context>` below
(its volatile region), one line per top result carrying the `snippet`, `source`
file, and `phase` when present (optional - phaseless CAPTURE items omit it;
render it only when present). These snippets ride the dispatch prompt, never the
cad-planner definition (D-01 / cache discipline): they are volatile per-phase
data, while the planner's stable instruction to treat them as prior art and cite
them lives in its cached file. On `none`, or when results are empty, omit the
block.

Prompt:

```markdown
<planning_context>
Phase: {N} - {name}
Mode: {standard | gaps | revision}
Goal: {goal line from ROADMAP.md}
Requirements: {phase requirement IDs - every ID must appear in a plan}
Plan shape (from CONTEXT, directive): {one plan | multiple plans | split - deferred slice | not specified}
Task ceiling: {workflow.max_plan_tasks} tasks PER PLAN, not per phase. A phase needing more capacity than that gets MORE PLANS, sequential if they share files - splitting is the expected move, not an escape hatch. Return `## PHASE TOO BIG` only when the phase cannot be delivered by any number of plans of that size, which is a statement about the PHASE's scope and not about task count. Reporting the overrun is not reducing scope - it is the one path that does not. This ceiling replaces any task-count target you carry: where your contract says "target 3-10 tasks", this number wins.

Read before planning:
- .planning/ROADMAP.md (this phase's entry and its dependencies)
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/phases/{N}/CONTEXT.md (locked user decisions - if present)
- {gaps mode: .planning/phases/{N}/UAT.md plus existing PLAN* and SUMMARY* files}
- The actual source files your tasks will touch

Write .planning/phases/{N}/PLAN.md per
${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/PLAN.md. Default is ONE PLAN.md; split
into PLAN-1.md, PLAN-2.md only for genuinely independent slices (no shared
files, no cross-slice ordering). If a Plan shape directive is given above,
honor it; if your file-independence analysis contradicts it (e.g. it asks
for multiple plans but the slices share files), follow your analysis and
record the deviation and its reason in your return marker and the PLAN
Notes - never diverge silently.

<recalled_memory>{one line per recalled result: snippet - source file, phase (when present); this block is present only under memory.backend builtin with non-empty results}</recalled_memory>
</planning_context>

(The return markers and report shape are the agent's own cached definition -
never restate them in the dispatch tail; seams.md's cache discipline.)
```

Revision mode: dispatch a FRESH cad-planner (never resume the prior run - the
plan on disk carries the grounding). Append the checker's issues verbatim in a
`<checker_issues>` block and instruct: fix each issue with minimal edits to the
existing plan file(s), or rebut it explicitly; return ## REVISION COMPLETE.
</step>

<step name="inline_plan">
(--inline under the threshold only.)

Follow cad-planner's methodology yourself: goal-backward truths, read the
files the tasks will touch, task anatomy (files / action / falsifiable
verify). Write .planning/phases/<N>/PLAN.md from the same template. One plan
file only - inline never splits.

Recall applies here too: the `--inline` under-threshold path is a real
task-breakdown moment with no cad-planner dispatch, so it must not skip prior
memory. When the effective `memory.backend` read in `parse` is `builtin`, run
the same gated recall as spawn_planner and fold its results into the inline
plan's truths and tasks, citing each recalled item's `source` file and `phase`
(when present) in the task's Action or the plan's Notes. When the backend is
`none`, the inline path issues no recall call, exactly like spawn_planner.
</step>

<step name="handle_return">
The dispatch came back, so close its bracket before anything else. OMIT
`--tokens` on a figureless return (seams.md's bracket rule - the one statement
of why):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event return --plan cad-planner --role cad-planner --tokens <the token count on the subagent return>
```

On the empty-or-unmarked arm below, close it as a checkpoint instead - one of
the two, always exactly one, or `trace render` reports a worker that never came
back:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event checkpoint --plan cad-planner --role cad-planner --detail "<empty or unmarked return>"
```

- `## PLANNING COMPLETE` - confirm the listed files exist on disk, continue.
- `## PHASE TOO BIG` - rejoin at `too_big` below.

<step name="too_big">
Reached two ways: a `phase-too-big` entry from `plan-size` at `parse` (before
any planner ran), or a `## PHASE TOO BIG` return from the planner.

State the measurement first, in one line - the requirement count and the
ceiling, or the planner's own reason - then ask (ask-user seam) with these
three options, the first marked `(recommended)`:

1. **Split into plans inside this phase (recommended).** Re-dispatch the
   planner ONCE, instructed to write `PLAN-1.md`, `PLAN-2.md`, ... each within
   the task ceiling. Plans that share a declared path are SEQUENTIAL: mark each
   one so, and `/cad-execute` runs them in order. This is the ordinary move.
   The phase keeps one goal, one CONTEXT, one UAT, and one landing.
2. **Split into phases via `/cad-phase add`.** For when the phase carries more
   than one deliverable rather than one deliverable too large. Stops here; you
   run `/cad-phase add`, then `/cad-plan` per phase. Independent phases can run
   concurrently (see `parallelization.max_concurrent_agents`) and each verifies
   and lands on its own.
3. **Plan the full scope anyway.** Re-dispatch ONCE with that instruction. The
   result is a plan over its ceiling, and `check_size` below will say so rather
   than let it pass silently.

Do NOT claim option 1 is unavailable because plans cannot share files.
`plan-overlap` reports a shared path so the caller knows the plans are
sequential rather than concurrent; it does not refuse the split, and a
sequential multi-plan phase is a shape this workflow supports.

This is a consult dead-end: before that ask, run offer_consult per
references/consult.md with the split problem as the situation.
</step>
- Empty or unmarked return - if phases/<N>/PLAN*.md exists on disk, treat
  the files as authoritative and continue; otherwise report the failed
  spawn and stop.
</step>

<step name="check_size">
The written plan against the ceiling the planner was handed. A COUNT, run after
`handle_return` and before `check_gate`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-size --phase {N} \
  --max-tasks {workflow.max_plan_tasks}
```

`plan-too-many-tasks` names the PLAN file and both numbers. It is per plan, so
the remedy is the same one `too_big` recommends: re-dispatch ONCE instructed to
split this plan's tasks across more plans, sequential where they share files.
Say the numbers out loud when you do - "PLAN.md carries 8 tasks against a
ceiling of 4" - because the point of this step is that the overrun stops being
silent.

Not a hard halt. The user may have chosen option 3 at `too_big` and asked for
the full scope, and a check that refused what the user just authorized would be
arguing with them. One re-dispatch, or the user's word, then continue.

This exists because soft enforcement was measured and failed: a planner told
the ceiling and a checker told to flag the overrun both passed an 8-task plan
against a ceiling of 4. Two model-judgment gates missed a comparison a count
makes exactly.
</step>

<step name="check_gate">
Skip when workflow.plan_check is false or `--skip-check` was passed.

Dispatch cad-plan-checker via the spawn-agent seam, the bracket on its resolve:
`--bracket-read ".planning/phases/{N}/PLAN*.md,.planning/ROADMAP.md,.planning/REQUIREMENTS.md,.planning/phases/{N}/CONTEXT.md"`.
Prompt:

```markdown
<verification_context>
Phase: {N} - {name}
Goal: {goal from ROADMAP.md}
Requirements: {phase requirement IDs}
Task ceiling: {workflow.max_plan_tasks} - the resolved value, for dimension 6.

Read:
- .planning/phases/{N}/PLAN*.md (the plans under review)
- .planning/ROADMAP.md and .planning/REQUIREMENTS.md
- .planning/phases/{N}/CONTEXT.md (if present)

Will these plans achieve the phase goal? Return ## VERIFICATION PASSED or
## ISSUES FOUND (numbered; each BLOCKER or WARNING with location and fix).
</verification_context>
```

Close its bracket the moment the return is in hand, before reading a single
severity. OMIT `--tokens` on a figureless return (seams.md's bracket rule):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event return --plan cad-plan-checker --role cad-plan-checker --tokens <the token count on the subagent return>
```

An empty or unmarked return closes as a checkpoint instead:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event checkpoint --plan cad-plan-checker --role cad-plan-checker --detail "<empty or unmarked return>"
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
- Empty or unmarked return -> report it, ask whether to proceed unchecked.
</step>

<step name="review">
Fire the `plan` review trigger per references/review-triggers.md, payload =
the PLAN file(s). The gate comes from the routing bundle; act on it:

- **advisory** (the `shipped` default) -> fire in the SAME message as the
  `commit` step's seam calls rather than waiting. The payload is the PLAN
  file(s) already on disk and the commit alters none of them, so the reviewer
  reads nothing the commit writes, and advisory findings gate nothing
  downstream - serializing them buys a wait for findings that stop nothing
  (the same overlap the per-plan `diff` review runs at advisory). The dispatch
  carries the advisory persistence tail (review-triggers.md step 4): the
  reviewer writes its findings to `.planning/phases/<N>/REVIEW-plan.md` and
  closes its own bracket, so this session ending before the return lands
  loses nothing. `done` reads that file if it is on disk by then; otherwise
  its Review line names the path as in flight - never a clean pass.
- **blocking** -> fire and WAIT; halt on FAIL until findings are fixed or the
  user overrides.
- **adjudicated** -> fire and WAIT - triage precedes the commit because an
  applied survivor EDITS the plan files the commit stages. Triage the
  survivors, then apply ONLY the ones the user picked to the plan file(s) and
  leave the rest recorded in this step's report. The survivors are a numbered
  list the user triages, NONE is the default, and only what the user names is
  acted on - RE-READ
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`
  before presenting, since this workflow does not preload it.

Do not re-enter the checker loop afterward - this trigger is the second
opinion, not another iteration.
</step>

<step name="commit">
1. Seed this phase's Traceability rows through the seam, right where the plan
   was just written:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" seed-reqs --phase {N}
   ```

   Inserts `| <id> | Phase {N} | Pending |` for exactly the declared
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

2. Update the cursor through the seam (it derives name/total from ROADMAP
   and stamps the date):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase {N} --status planned --next "/cad-execute {N}"
   ```

3. If planning.commit_docs is true: apply the protected-branch guard
   (references/git-guard.md rail 1), then commit the plan file(s), STATE.md, and
   `.planning/REQUIREMENTS.md` when seed-reqs reported any `seeded` ids -
   `docs: plan phase {N} - {name}` - staging exactly those files.
</step>

<step name="done">
Report:

```
Planned phase {N}: {name}
Plan(s): {files, task counts}
Checker: {passed | passed after revision | skipped | overridden with N open issues}
Review: {plan trigger outcome}
Traceability: {seeded ids | none seeded | orphan_ids: [...] | no_active_section}
Commit: {hash | not committed (planning.commit_docs false)}
```

One suggestion only: `/cad-execute {N}` - safe to `/clear` first: the plan is
on disk and each executor runs in a fresh context.
</step>

</process>

<guardrails>
- Planner and checker run in fresh contexts through the spawn-agent seam.
  Never perform the checker role in the main context, and never spawn any
  reviewer outside the `plan` trigger.
- One revision loop, hard cap. A plan that fails the checker twice goes to
  the human.
- ONE PLAN.md is the default; accept a split only with the planner's
  independence rationale (no shared files, no cross-slice ordering).
- STATE.md stays a ~4-line overwritten cursor. No audit entries, no roadmap
  annotations - git is the log.
- Config keys only as named in templates/config.json - nothing invented.
</guardrails>

<success_criteria>
- [ ] phases/<N>/PLAN.md exists; tasks numbered and atomic, each with exact
      files, directive action, falsifiable verification
- [ ] Every phase requirement ID appears in a plan's `requirements`
- [ ] Checker gate honored (ran, or skipped via config/flag), max one revision
- [ ] `plan` review trigger fired after the plan was written
- [ ] Its adjudicated survivors triaged by the user, not applied wholesale
- [ ] seed-reqs run; seeded/orphan_ids/no_active_section reported to the user
- [ ] Cursor updated; docs committed per planning.commit_docs
- [ ] No existing plans overwritten without asking
</success_criteria>
