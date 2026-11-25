---
name: cad-execute
description: "Execute a phase's plans - a subagent per plan, an atomic commit per task, a slim per-phase SUMMARY"
argument-hint: "[phase number] [--rerun]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
  - Task
  - Workflow
  - Workflow(cadence:review-panel)
  - Workflow(cadence:execute-wave)
---

<objective>
Execute a phase's plans with Cadence's guarantees: protected-branch guard
before the first dispatch, one cad-executor per plan, one atomic conventional
commit per task, deviations recorded, a SUMMARY.md at the end.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/execute.md
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
