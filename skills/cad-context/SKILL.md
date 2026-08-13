---
name: cad-context
description: "Gather phase context before planning - codebase assumptions, locked decisions, falsifiable acceptance criteria - in one pass"
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
against the codebase when this phase buys that pass, close the gray areas it
surfaces with a few targeted questions, and lock falsifiable acceptance
criteria. Two asks, never merged into one: one spend question (is the analyzer
pass worth buying here?) before it runs, and one size question (too big for one
plan?) after the criteria. Writes `.planning/phases/<N>/CONTEXT.md` for
/cad-plan to read. Optional - /cad-plan runs without it.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/context.md
</execution_context>

<process>
Execute end-to-end.
</process>
