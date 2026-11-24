---
name: cad-new-project
description: "Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, a phased ROADMAP.md and .planning/ state"
argument-hint: "[--research] [--brief <file or design folder>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
  - Task
---

<objective>
Start a project: question until the idea is concrete, then leave PROJECT.md,
REQUIREMENTS.md, a phased ROADMAP.md, STATE.md and config.json in `.planning/`.
new-project.md takes `--research` and `--brief`.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/new-project.md
</execution_context>

<process>
Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
