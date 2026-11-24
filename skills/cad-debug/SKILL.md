---
name: cad-debug
description: "Systematic debugging - hypothesis and symptom tracked in a state file that survives /clear, with a user-gated second-model consult at dead ends"
argument-hint: "[list | status <slug> | continue <slug> | --diagnose] [symptom]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
  - Workflow
  - Workflow(cadence:review-panel)
---

<objective>
Debug a symptom by the scientific method: form hypotheses, run the cheapest
discriminating test for each, confirm a root cause, fix it and verify the
symptom is gone. The state file at `.planning/debug/<slug>.md` lets a new
session resume it.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/debug.md
</execution_context>

<process>
Route on `$ARGUMENTS`, then run the debug workflow single-pass end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
