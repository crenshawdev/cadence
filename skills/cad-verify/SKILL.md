---
name: cad-verify
description: "Verify a completed phase by conversational UAT - a persistent checklist that survives /clear, plus cross-phase and goal-backward passes"
argument-hint: "[phase] [--sweep] [--deep]"
allowed-tools:
  - mcp__cadence__cadence_apply
  - mcp__cadence__cadence_query
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
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/verify.md
</execution_context>

<process>
Execute end-to-end.
</process>

<review_delivery>
At review boundaries, follow the shared `cad-review-delivery` contract below
with ordinary caller `verify`. Retain the actual plan/diff/staged target,
wait for raw return and durable acknowledgment, and satisfy deferred enqueue
before commit preparation, completion or further plan dispatch. This takes
precedence over frozen review write/trace and gate instructions. Keep the rest
of this workflow with its existing owner.
Diagnosis uses the retained diagnosis specialist target; preserve the user’s fix selection.

@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md
</review_delivery>
