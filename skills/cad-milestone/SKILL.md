---
name: cad-milestone
description: "Cut a milestone - verify nothing was dropped (cad-audit), tag the release when the project tags, prune completed phases from the live roadmap (git is the archive), evolve PROJECT.md, and refresh REQUIREMENTS for the next cycle. Works for non-release projects too. Folds in cleanup"
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
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git.md
</execution_context>

<process>
Run the milestone workflow end-to-end. The audit gate is real - do not tag a
milestone with a failing traceability audit unless the user explicitly
overrides. Prune from the working tree only (git keeps the history); never
auto-push the tag.
</process>
