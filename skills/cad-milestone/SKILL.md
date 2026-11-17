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
Close a finished milestone and set up the next. It collapses
new-milestone + complete-milestone + cleanup into one flow. It bumps a
release's version (non-release projects skip it), it never ships (the tag is
/cad-land's, cut after the merge), and it never cuts a milestone that silently
dropped a requirement (cad-audit gates it).
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/milestone.md
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
Run the milestone workflow end-to-end. The audit gate is real - a failing
traceability audit stops the close unless the user explicitly overrides. Prune
from the working tree only (git keeps the history). Under `git.auto_close`,
chain `/cad-land` to complete the close (PR -> merge -> tag -> reset), asking
once, before the tag push, and halting on a surviving blocker/high
`risk_surface` finding; otherwise leave the merge and the tag to a separate
`/cad-land`.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
