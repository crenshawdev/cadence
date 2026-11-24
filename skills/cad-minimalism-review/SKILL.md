---
name: cad-minimalism-review
description: "Ranked delete-list over code that works and should not exist - reinvented stdlib, one-implementation abstractions, dead flexibility, config nobody sets"
argument-hint: "[path | directory | phase number]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - PushNotification
---

<objective>
Ask whether the code the user names needs to exist, rather than whether it
works, and return a ranked delete-list.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/minimalism-review.md
</execution_context>

<process>
Run minimalism-review.md end to end with `$ARGUMENTS`.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
