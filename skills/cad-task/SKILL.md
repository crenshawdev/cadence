---
name: cad-task
description: "Execute a small off-roadmap task with atomic commits - inline by default, --plan for multi-step work"
argument-hint: "[task description] [--plan]"
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
Do a small task now, outside the roadmap, keeping Cadence's guarantees:
protected-branch guard and atomic conventional commits. Inline by default -
no subagents, no plan files. `--plan` writes a short PLAN.md first for
multi-step work. Feature-sized requests get re-routed to /cad-phase add.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/task.md
</execution_context>

<process>
Execute end-to-end.
</process>

<review_delivery>
At review boundaries, follow the shared `cad-review-delivery` contract below
with ordinary caller `task`. Retain the actual plan/diff/staged target,
wait for raw return and durable acknowledgment, and satisfy deferred enqueue
before commit preparation, completion or further plan dispatch. This takes
precedence over frozen review write/trace and gate instructions. Keep the rest
of this workflow with its existing owner.
Fix continuations consume supplied provisional-selected through planned-task-fix.

@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md
</review_delivery>
