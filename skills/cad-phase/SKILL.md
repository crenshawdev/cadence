---
name: cad-phase
description: "CRUD phases in ROADMAP - add, insert, remove, edit, with remove/insert renumbering the following phases, their .planning dirs and their live references, while insert leaves shipped requirement rows as written"
argument-hint: "add [description] | insert <N> | remove <N> | edit <N>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Edit the phase list in ROADMAP.md safely. `add` and `edit` are near-trivial
markdown changes; `insert` and `remove` are not - they shift phase numbers, and
a phase number lives in four places whose live references have to follow or
the project's references rot. Shipped requirement rows are history: insert
leaves them as written. This skill keeps the live references consistent.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/phase.md
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
Route on `$ARGUMENTS` (add | insert N | remove N | edit N) and run the phase
workflow. For insert/remove, do the full renumber-and-repair pass - never edit
ROADMAP alone. Commit the change atomically (protected-branch guard applies);
never leave phase dirs and live references out of sync, and never hand-shift a
requirement row the seam left as written.
</process>
