---
name: cad-verify
description: "Conversational UAT for a completed phase - persistent checklist that survives /clear, --sweep for a cross-phase audit, --deep for a goal-backward codebase pass"
argument-hint: "[phase] [--sweep] [--deep]"
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
Walk the user through a phase's acceptance criteria one item at a time,
recording pass/fail/skip in a persistent .planning/phases/<N>/UAT.md.
Results survive /clear and session ends - re-run to resume at the first
untested item. Failures are diagnosed and routed through the normal
Cadence flow (user-approved atomic fix commit, or /cad-plan for
phase-sized gaps) - no internal auto-fixer loop. `--sweep` scans every
phase's UAT file and reports what is still outstanding. `--deep` spawns
cad-verifier for a goal-backward check of what the code actually delivers.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/workflows/verify.md
@$HOME/.claude/cadence-core/templates/UAT.md
</execution_context>

<process>
Execute end-to-end.
</process>
