---
name: cad-verify
description: "Verify a completed phase by conversational UAT - a persistent checklist that survives /clear, plus cross-phase and goal-backward passes"
argument-hint: "[phase] [--sweep] [--deep]"
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
Walk the user through a phase's acceptance criteria one item at a time,
recording pass/fail/skip in .planning/phases/<N>/UAT.md. Results survive
/clear and session ends - re-run to resume at the first untested item.
Failures are diagnosed and routed to a user-approved atomic fix commit, or
/cad-plan for phase-sized gaps. `--sweep` scans every phase's UAT file and
reports what is still outstanding. `--deep` spawns cad-verifier for a
goal-backward check of what the code actually delivers.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/verify.md
</execution_context>

<process>
On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
doesn't), stop before anything else, with this line and nothing after it: "This
project is on the agile path. /cad-agile shows what comes next."

Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
