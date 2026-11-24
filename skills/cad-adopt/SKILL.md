---
name: cad-adopt
description: "Initialize .planning/ from a repo that already exists - PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md derived from the code and the git history"
argument-hint: ""
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
Bring a repository that already has code and history into Cadence, writing the
same `.planning/` shape /cad-new-project writes.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/adopt.md
</execution_context>

<process>
Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
