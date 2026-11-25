---
name: cad-context
description: "Gather phase context before planning - codebase assumptions, locked decisions, falsifiable acceptance criteria - in one pass"
argument-hint: "[phase number]"
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
Close a phase's gray areas before planning and lock falsifiable acceptance
criteria. Two asks, never merged into one: one spend question (is the analyzer
pass worth buying here?) before it runs, and one size question (too big for one
plan?) after the criteria. Writes `.planning/phases/<N>/CONTEXT.md`.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/context.md
</execution_context>

<process>
On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
doesn't), stop before anything else, with this line and nothing after it: "This
project is on the agile path. /cad-agile shows what comes next."

Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
