---
name: cad-progress
description: "Project progress - count-based status from files and git, finds incomplete or paused work and offers to resume it, --stats for a quick summary"
argument-hint: "[--stats|--trace]"
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
  - SlashCommand
---

<objective>
Answer "where am I and what's next" for the current Cadence project. Truth is
derived by counting: ROADMAP.md phases vs phases/<N>/ artifacts (PLAN.md,
SUMMARY.md, UAT.md fully passed) plus recent git log. STATE.md is a hint, not
a source. Detects incomplete or paused work and offers to resume at the right
step, routing to the spine skill that does it (/cad-context, /cad-plan,
/cad-execute, /cad-verify, /cad-milestone, /cad-phase add between milestones) -
never does the work itself.
`--stats` prints a summary derived on demand; `--trace` prints the current
phase's joined run record - routing, provider, worker-lifecycle and outcome
events - and writes nothing.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/progress.md
</execution_context>

<process>
Execute end-to-end.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
