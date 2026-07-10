---
name: cad-plan
description: "Create an executable phase plan (PLAN.md) - planner subagent, optional check gate, plan review trigger"
argument-hint: "[phase] [--skip-check] [--inline] [--gaps]"
allowed-tools:
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
@$HOME/.claude/cadence-core/workflows/plan.md
</execution_context>

<process>
Execute end-to-end.
</process>
