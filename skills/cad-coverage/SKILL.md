---
name: cad-coverage
description: "Find a completed phase's requirements with no failing-capable test coverage and generate tests to close the gaps, in the project's own framework"
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
---

<objective>
Close the test-coverage gaps for a completed phase.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/coverage.md
</execution_context>

<process>
Run the coverage workflow end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
