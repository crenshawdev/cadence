---
name: cad-execute
description: "Execute a phase's plans - a subagent per plan, an atomic commit per task, a slim per-phase SUMMARY"
argument-hint: "[phase number] [--rerun]"
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
  - Workflow(cadence:execute-wave)
---

<objective>
Execute every plan in a phase with Cadence's guarantees: protected-branch
guard before the first dispatch, one cad-executor per plan, one atomic
conventional commit per task, deviations recorded, a slim SUMMARY.md at the
end. Sequential by default - parallel worktree execution only when config
opts in.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/execute.md
</execution_context>

<process>
Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
