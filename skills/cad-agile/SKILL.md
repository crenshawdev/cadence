---
name: cad-agile
description: "The agile path's one command - starts a release from a Seldon design with --brief, and on a project that has one open refines its next epic with you, builds its next story, asks you to accept a finished epic or names what comes next"
argument-hint: "[--brief <design folder>]"
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
With no release open, ask what the project's setup leaves open, then turn the
Seldon design `--brief` names into `.planning/agile/` and commit it. With one
open, refine its next epic with the user, build its next story, ask the user
to accept a finished epic, or name its next step.
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
