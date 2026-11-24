---
name: cad-task
description: "Execute a small off-roadmap task with atomic commits - inline by default, --plan for multi-step work"
argument-hint: "[task description] [--plan]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
  - Task
  - Workflow
  - Workflow(cadence:review-panel)
---

<objective>
Do a small task now, outside the roadmap, with the protected-branch guard and
atomic conventional commits. Inline by default; `--plan` writes a short PLAN.md
first. Feature-sized work stops with the commands that fit the repository.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/task.md
</execution_context>

<process>
Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
