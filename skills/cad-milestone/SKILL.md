---
name: cad-milestone
description: "Cut a milestone - audit that nothing was dropped, tag when the project tags, prune completed phases from the roadmap, evolve PROJECT and refresh REQUIREMENTS"
argument-hint: "[version | next-milestone name]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
  - SlashCommand
---

<objective>
Close a finished milestone and set up the next. Thin by design - it collapses
new-milestone + complete-milestone + cleanup into one flow. It tags the
release only when the project tags (non-release projects skip it), it never
ships (publishing a tag is /cad-land's call), and it never cuts a milestone
that silently dropped a requirement (cad-audit gates it).
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/milestone.md
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
Run the milestone workflow end-to-end. The audit gate is real - do not tag a
milestone with a failing traceability audit unless the user explicitly
overrides. Prune from the working tree only (git keeps the history); never
auto-push the tag. Under `git.auto_close` (default off), chain into `/cad-land`
to complete the close (PR -> merge -> reset), still halting on a surviving
blocker/high `risk_surface` finding; otherwise stop at the tag and leave
publishing to a separate
`/cad-land`.
</process>
