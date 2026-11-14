---
name: cad-undo
description: "Safely undo a phase - roll back its commits from the SUMMARY manifest, revert (or --no-commit to re-do), and reset the phase status"
argument-hint: "<phase N> [--no-commit]"
disable-model-invocation: true
allowed-tools:
  - Read
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
---

<objective>
Undo a phase's work by reverting its commits, using the phase SUMMARY.md as the
manifest of exactly which hashes to touch (cad-execute records commits-per-task
with hashes there). Safe by construction: never runs on a dirty tree, never
guesses. No heuristic dependency-check - instead cad-undo states plainly
whether later phases exist and lets the user decide.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/undo.md
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
Run the undo workflow end-to-end. Refuse on a dirty tree. Show the exact hashes
and get confirmation before reverting. Reset the phase's status as part of the
rollback (this is the one legitimate exception to cad-verify owning status).

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
