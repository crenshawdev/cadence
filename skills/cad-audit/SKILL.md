---
name: cad-audit
description: "Pre-ship traceability audit - every requirement traced to a phase, plan and verification, orphan detection both directions, a FAIL gate before shipping"
argument-hint: "[milestone | defaults to all active requirements]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
---

<objective>
Prove that nothing was silently dropped before a milestone ships, and return
PASS or FAIL.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/audit.md
</execution_context>

<process>
Run the audit workflow end-to-end and return PASS or FAIL with the evidence its
section 4 asks for.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
