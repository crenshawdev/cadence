---
name: cad-plan
description: "Create an executable phase plan (PLAN.md) - planner subagent, optional check gate, plan review trigger"
argument-hint: "[phase] [--skip-check] [--inline] [--gaps]"
allowed-tools:
  - mcp__cadence__cadence_apply
  - mcp__cadence__cadence_query
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - Task
---

<objective>
Turn one roadmap phase into .planning/phases/<N>/PLAN.md: numbered atomic
tasks, each with files, action, and a falsifiable verification. Spawns
cad-planner (fresh context), gates through cad-plan-checker when
workflow.plan_check is true, then fires the `plan` review trigger.
`--inline` plans small phases in the main context; `--gaps` plans closure
tasks from unresolved UAT items.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/plan.md
</execution_context>

<process>
Execute end-to-end.
</process>

<review_delivery>
At review boundaries, follow the shared `cad-review-delivery` contract below
with ordinary caller `automatic-plan`. Retain the actual plan/diff/staged target,
wait for raw return and durable acknowledgment, and satisfy deferred enqueue
before commit preparation, completion or further plan dispatch. This takes
precedence over frozen review write/trace and gate instructions. Keep the rest
of this workflow with its existing owner.
Use review-consumer plan-completion for reporting.

@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md
</review_delivery>
