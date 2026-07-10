---
name: cad-phase
description: "CRUD phases in ROADMAP - add, insert, remove, edit. The op that earns the skill is remove/insert: it renumbers the following phases, their .planning/phases dirs, and every phase-number reference in one consistent pass - the thing humans botch by hand"
argument-hint: "add | insert <N> | remove <N> | edit <N>"
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
a phase number lives in four places that must move together or the project's
references rot. This skill keeps them consistent.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/workflows/phase.md
@$HOME/.claude/cadence-core/references/git.md
</execution_context>

<process>
Route on `$ARGUMENTS` (add | insert N | remove N | edit N) and run the phase
workflow. For insert/remove, do the full renumber-and-repair pass - never edit
ROADMAP alone. Commit the change atomically (protected-branch guard applies);
never leave phase dirs and references out of sync.
</process>
