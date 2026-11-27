---
name: cad-milestone
description: "Cut a milestone - audit that nothing was dropped, bump a release's version, prune completed phases from the roadmap, evolve PROJECT and refresh REQUIREMENTS"
argument-hint: "[version | next-milestone name]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Task
  - AskUserQuestion
  - PushNotification
  - SlashCommand
---

<objective>
Close a finished milestone and set up the next.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/milestone.md
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
doesn't), stop before anything else, with this line and nothing after it: "This
project is on the agile path. /cad-agile shows what comes next."

Run the milestone workflow end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
