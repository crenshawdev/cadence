---
name: cad-execute
description: "Execute a phase's plans - a subagent per plan, an atomic commit per task, a slim per-phase SUMMARY"
argument-hint: "[phase number] [--rerun]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - Task
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
</process>
