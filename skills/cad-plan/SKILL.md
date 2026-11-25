---
name: cad-plan
description: "Create an executable phase plan (PLAN.md) - planner subagent, optional check gate, plan review trigger"
argument-hint: "[phase] [--skip-check] [--inline] [--gaps]"
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
---

<objective>
Turn one roadmap phase into an executable plan under .planning/phases/<N>/.
`--inline` plans a small phase in the main context; `--gaps` plans closure
tasks from unresolved UAT items.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/plan.md
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
