---
name: cad-undo
description: "Safely roll back a phase's commits - discover the hashes from the phase SUMMARY manifest, guard against a dirty tree, revert (or --no-commit squash to re-do), and reset the phase's status. Reports later work factually instead of guessing dependencies"
argument-hint: "<phase N> [--no-commit]"
allowed-tools:
  - Read
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Undo a phase's work by reverting its commits, using the phase SUMMARY.md as the
manifest of exactly which hashes to touch (cad-execute records commits-per-task
with hashes there). Safe by construction: never runs on a dirty tree, never
guesses. GSD's heuristic dependency-check is dropped - instead cad-undo states
plainly whether later phases exist and lets the user decide.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/undo.md
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git.md
</execution_context>

<process>
Run the undo workflow end-to-end. Refuse on a dirty tree. Show the exact hashes
and get confirmation before reverting. Reset the phase's status as part of the
rollback (this is the one legitimate exception to cad-verify owning status).
</process>
