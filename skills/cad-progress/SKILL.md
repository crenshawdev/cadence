---
name: cad-progress
description: "Project progress - count-based status from files and git, finds incomplete or paused work and offers to resume it, --stats for a quick summary"
argument-hint: "[--stats|--trace]"
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
  - SlashCommand
---

<objective>
Answer "where am I and what's next" for the current Cadence project, and route
to the skill that does it.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/progress.md
</execution_context>

<process>
Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
