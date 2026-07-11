---
name: cad-progress
description: "Show where the project stands and what's next - count-based status from files and git, auto-resume of incomplete work, --stats for a quick summary"
argument-hint: "[--stats]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - SlashCommand
---

<objective>
Answer "where am I and what's next" for the current Cadence project. Truth is
derived by counting: ROADMAP.md phases vs phases/<N>/ artifacts (PLAN.md,
SUMMARY.md, UAT.md fully passed) plus recent git log. STATE.md is a hint, not
a source. Detects incomplete or paused work and offers to resume at the right
step, routing to the spine skill that does it (/cad-context, /cad-plan,
/cad-execute, /cad-verify, /cad-milestone) - never does the work itself.
`--stats` prints a summary derived on demand. Replaces GSD's progress +
resume-work + stats.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/progress.md
</execution_context>

<process>
Execute end-to-end.
</process>
