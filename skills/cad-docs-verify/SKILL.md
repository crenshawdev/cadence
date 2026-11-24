---
name: cad-docs-verify
description: "Verify docs claims against the live codebase - paths, commands, symbols, config keys - each reported accurate, stale or unverifiable. Reports; it does not rewrite docs"
argument-hint: "[path or glob | defaults to README + docs/]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
---

<objective>
Check the target docs' claims against the live code and report each as accurate,
stale or unverifiable.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/docs-verify.md
</execution_context>

<process>
Run the verify workflow end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
