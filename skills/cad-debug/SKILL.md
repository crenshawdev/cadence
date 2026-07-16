---
name: cad-debug
description: "Systematic debugging - scientific method with hypothesis state persisted across /clear, and a user-gated second-model consult at dead-ends. Single pass, no session-manager layer"
argument-hint: "[list | status <slug> | continue <slug> | --diagnose] [symptom]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Debug a symptom by the scientific method - form hypotheses, run the cheapest
discriminating test for each, confirm a root cause, fix it, verify the symptom
is gone. The investigation is persisted to `.planning/debug/<slug>.md` after
every step, so a `/clear` or a new session resumes it losslessly. At a genuine
dead-end (repeated failed fixes, exhausted hypotheses), OFFER a second-model
consult (references/consult.md) - user-gated, decision-support only.

Routing: parse `$ARGUMENTS` per the workflow's Route table (debug.md) -
`list`, `status <slug>`, `continue <slug>`, `--diagnose`, else a new symptom.
The table lives in the workflow, once.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/debug.md
</execution_context>

<process>
Route on `$ARGUMENTS`, then run the debug workflow single-pass end-to-end.
Persist the state file after every hypothesis test and fix attempt. Never
auto-loop fixes and never auto-consult - both are deliberate, and the consult
is always user-gated.
</process>
