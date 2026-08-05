---
name: cad-help
description: "Cadence's own help - the command reference for every /cad-* skill, grouped by cluster; pass a command name for just that entry"
argument-hint: "[command name]"
allowed-tools:
  - Read
---

<objective>
Show what Cadence can do. A static reference (references/COMMANDS.md) - the
clusters are the headings. No search, no state, no side effects.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/COMMANDS.md
</execution_context>

<process>
- No argument: present the full command reference above, grouped by cluster.
- A command name in `$ARGUMENTS` (with or without the `cad-`/`/` prefix): show
  that command's row and cluster, and point at the skill for detail. If it does
  not match a known command, say so and list the closest names.
Read-only: display the reference, do nothing else.
</process>
