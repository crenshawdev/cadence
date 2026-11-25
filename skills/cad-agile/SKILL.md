---
name: cad-agile
description: "The agile path's one command - starts a release from a Seldon design with --brief, and on a project that has one open names what comes next"
argument-hint: "[--brief <design folder>]"
allowed-tools:
  - Read
  - AskUserQuestion
  - PushNotification
---

<objective>
With no release open, turn the Seldon design `--brief` names into
`.planning/agile/` and commit it. With one open, name its next step.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile.md
</execution_context>

<process>
Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
