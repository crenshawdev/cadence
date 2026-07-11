---
name: cad-new-project
description: "Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, phased ROADMAP.md, and .planning/ state"
argument-hint: "[--research]"
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
Start a project properly: question deeply until the idea is concrete, then
write PROJECT.md and REQUIREMENTS.md, derive a phased ROADMAP.md with
falsifiable per-phase success criteria, and initialize .planning/ (config
copied from the engine template, STATE.md cursor). Research is off by
default; `--research` or config `workflow.research` enables a single
research pass.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/new-project.md
</execution_context>

<process>
Execute end-to-end.
</process>
