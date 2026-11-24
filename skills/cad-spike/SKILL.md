---
name: cad-spike
description: "Spike - a time-boxed experiment resolving one unknown before you bet on it, risk-first, with a validated | invalidated | inconclusive verdict"
argument-hint: "<the question or hypothesis to resolve>"
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
Answer one unknown with evidence before a plan commits to it - "will this
approach work", "is this library fast enough", "does this API do what we need".
The code is throwaway; the SPIKE.md verdict is the deliverable.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/spike.md
</execution_context>

<process>
Run the spike workflow end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
