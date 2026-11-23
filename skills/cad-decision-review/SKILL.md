---
name: cad-decision-review
description: "Adversarial refute-then-adjudicate pass over one load-bearing decision - a CONTEXT D-NN line or a PROJECT Key Decisions row - with per-objection rulings"
argument-hint: "[path/to/decision doc]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - PushNotification
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

<objective>
Stress-test ONE decision the user names: reviewers try to refute it, then the
main model checks each objection, rules on it and proposes amendments.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/decision-review.md
</execution_context>

<process>
Run decision-review.md end to end with `$ARGUMENTS`.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
