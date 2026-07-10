---
name: cad-context
description: "Gather phase context before planning - codebase assumptions, locked decisions, falsifiable acceptance criteria - in one conversational pass"
argument-hint: "[phase number]"
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
Run the single pre-plan gate for a phase: spawn the assumptions analyzer
against the codebase, close the gray areas it surfaces with a few targeted
questions, lock falsifiable acceptance criteria, and ask exactly once whether
the phase is too big for one plan. Writes `.planning/phases/<N>/CONTEXT.md`
for /cad-plan to read. Optional - /cad-plan runs without it.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/workflows/context.md
</execution_context>

<process>
Execute end-to-end.
</process>
