---
name: cad-task
description: "Execute a small off-roadmap task with atomic commits - inline by default, --plan for multi-step work"
argument-hint: "[task description] [--plan]"
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
Do a small task now, outside the roadmap, keeping Cadence's guarantees:
protected-branch guard and atomic conventional commits. Inline by default -
no subagents, no plan files. `--plan` writes a short PLAN.md first for
multi-step work. Feature-sized requests get re-routed to /cad-context.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/workflows/task.md
</execution_context>

<process>
Execute end-to-end.
</process>
