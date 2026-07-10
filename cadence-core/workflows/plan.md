<purpose>
Turn one roadmap phase into an executable plan: .planning/phases/<N>/PLAN.md
with numbered atomic tasks, each carrying files, action, and a falsifiable
verification. Pipeline: read the phase goal (plus CONTEXT.md if /cad-context
ran) -> spawn cad-planner -> optional cad-plan-checker gate -> fire the
`plan` review trigger -> commit docs.

Replaces GSD's plan-phase: one planner plus one optional checker instead of
a four-agent fan-out, 4 flags instead of ~20, one bounded revision instead
of a convergence loop. Research is /cad-context's job; second opinions
belong to the review subsystem.
</purpose>

<process>

<step name="parse">
Parse `$ARGUMENTS`:

- `[phase]` - phase number. If omitted, take the current phase from the
  .planning/STATE.md cursor; if that is missing or already planned, list the
  ROADMAP.md phases that still need plans and ask (ask-user seam).
- `--skip-check` - skip the plan-checker gate even when workflow.plan_check
  is true.
- `--inline` - plan in the main context instead of spawning cad-planner.
  Honored only for small phases (see route).
- `--gaps` - plan closure tasks for unresolved items in phases/<N>/UAT.md
  instead of planning the phase from scratch.

Load config per references/conventions.md. Keys used: workflow.plan_check,
workflow.inline_plan_threshold, planning.commit_docs, review.triggers.plan,
git.protected_branches, git.on_protected.
</step>

<step name="load_phase">
1. Read this phase's entry in .planning/ROADMAP.md: name, goal, requirement
   IDs. No entry -> stop: "Phase {N} is not in ROADMAP.md."
2. Read .planning/phases/<N>/CONTEXT.md if present (locked decisions,
   deferred ideas, discretion areas from /cad-context). Absent is fine -
   plan from the roadmap goal alone.
3. If PLAN*.md already exists in the phase dir (and not --gaps): ask
   (ask-user seam) - replan from scratch (overwrite) or abort. Never
   overwrite silently.
4. --gaps: read phases/<N>/UAT.md and extract unresolved or failed items.
   If the file is missing or everything passed, report that and stop.
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
`--attempt 1`). Then wait - do not read, edit, or plan anything else while the
subagent runs.

Prompt:

```markdown
<planning_context>
Phase: {N} - {name}
Mode: {standard | gaps | revision}
Goal: {goal line from ROADMAP.md}
Requirements: {phase requirement IDs - every ID must appear in a plan}

Read before planning:
- .planning/ROADMAP.md (this phase's entry and its dependencies)
- .planning/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/phases/{N}/CONTEXT.md (locked user decisions - if present)
- {gaps mode: .planning/phases/{N}/UAT.md plus existing PLAN* and SUMMARY* files}
- The actual source files your tasks will touch

Write .planning/phases/{N}/PLAN.md per
$HOME/.claude/cadence-core/templates/PLAN.md. Default is ONE PLAN.md; split
into PLAN-1.md, PLAN-2.md only for genuinely independent slices (no shared
files, no cross-slice ordering).

Return ## PLANNING COMPLETE (plan files + task counts, split rationale if
any) or ## PHASE TOO BIG (reason + proposed split).
</planning_context>
```

Revision mode: append the checker's issues verbatim in a `<checker_issues>`
block and instruct: fix each issue with minimal edits to the existing plan
file(s), or rebut it explicitly; return ## REVISION COMPLETE.
</step>

<step name="inline_plan">
(--inline under the threshold only.)

Follow cad-planner's methodology yourself: goal-backward truths, read the
files the tasks will touch, task anatomy (files / action / falsifiable
verify). Write .planning/phases/<N>/PLAN.md from the same template. One plan
file only - inline never splits.
</step>

<step name="handle_return">
- `## PLANNING COMPLETE` - confirm the listed files exist on disk, continue.
- `## PHASE TOO BIG` - present the planner's reason and proposed split, then
  ask (ask-user seam): restructure the roadmap (stop; point at /cad-phase,
  re-run /cad-plan after) or plan the full scope anyway (re-dispatch ONCE
  with that instruction). This is a consult dead-end: before that ask, run
  offer_consult (references/consult.md) with the split problem as the
  situation - a second model may see a cleaner cut. User-gated; skip silently
  if consult is not configured.
- Empty or unmarked return - if phases/<N>/PLAN*.md exists on disk, treat
  the files as authoritative and continue; otherwise report the failed
  spawn and stop.
</step>

<step name="check_gate">
Skip when workflow.plan_check is false or `--skip-check` was passed.

Dispatch cad-plan-checker via the spawn-agent seam. Prompt:

```markdown
<verification_context>
Phase: {N} - {name}
Goal: {goal from ROADMAP.md}
Requirements: {phase requirement IDs}

Read:
- .planning/phases/{N}/PLAN*.md (the plans under review)
- .planning/ROADMAP.md and .planning/REQUIREMENTS.md
- .planning/phases/{N}/CONTEXT.md (if present)

Will these plans achieve the phase goal? Return ## VERIFICATION PASSED or
## ISSUES FOUND (numbered; each BLOCKER or WARNING with location and fix).
</verification_context>
```

Handle the return:
- `## VERIFICATION PASSED` -> continue.
- `## ISSUES FOUND` -> ONE revision, maximum:
  1. Plans came from cad-planner: re-dispatch it in revision mode with the
     issues (see spawn_planner), this time with `--attempt 2` so the routing
     seam can escalate under `auto`. Plans were written inline: apply the fixes
     in the main context.
  2. Re-dispatch the checker once on the revised plans, with `--attempt 2`
     (routing seam escalates it to the `-high` effort variant under `auto`).
  3. Passes -> continue. Still failing -> present the remaining issues and
     ask (ask-user seam): proceed to execution anyway, or stop and revise
     by hand. Never loop again.
- Empty or unmarked return -> report it, ask whether to proceed unchecked.
</step>

<step name="review">
Fire the `plan` review trigger per references/review-triggers.md, payload =
the PLAN file(s). Act on the configured gating level (default adjudicated):
advisory -> report findings and continue; blocking -> halt on FAIL until
findings are fixed or the user overrides; adjudicated -> apply the
surviving, grounded findings to the plan file(s) directly. Do not re-enter
the checker loop afterward - this trigger is the second opinion, not
another iteration.
</step>

<step name="commit">
1. Overwrite the .planning/STATE.md cursor in the canonical schema
   (references/conventions.md): `Phase: {N} of {total} ({name})`,
   status "planned", next "/cad-execute {N}", `Updated:` today. No log entries.
2. If planning.commit_docs is true: apply the protected-branch guard
   (references/git.md rail 1), then commit the plan file(s) and STATE.md -
   `docs: plan phase {N} - {name}` - staging exactly those files.
</step>

<step name="done">
Report:

```
Planned phase {N}: {name}
Plan(s): {files, task counts}
Checker: {passed | passed after revision | skipped | overridden with N open issues}
Review: {plan trigger outcome}
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
- Never push (references/git.md rail 3).
- Config keys only as named in templates/config.json - nothing invented.
</guardrails>

<success_criteria>
- [ ] phases/<N>/PLAN.md exists; tasks numbered and atomic, each with exact
      files, directive action, falsifiable verification
- [ ] Every phase requirement ID appears in a plan's `requirements`
- [ ] Checker gate honored (ran, or skipped via config/flag), max one revision
- [ ] `plan` review trigger fired after the plan was written
- [ ] Cursor updated; docs committed per planning.commit_docs
- [ ] No existing plans overwritten without asking
</success_criteria>
