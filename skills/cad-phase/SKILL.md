---
name: cad-phase
description: "CRUD phases in ROADMAP - add, insert, remove, edit, with remove/insert renumbering the following phases, their .planning dirs and their live references, while insert and remove leave shipped requirement rows as written"
argument-hint: "add [description] | add --brief <design folder> | insert <N> | remove <N> | edit <N>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
---

<objective>
Edit the phase list in ROADMAP.md safely. `add` and `edit` are near-trivial
edits; `insert` and `remove` are not - they shift phase numbers, and a number
lives in the state, the phase dirs and the generated views, which must all
follow or the references rot. Shipped requirement rows are history: insert and
remove leave them as written. This skill keeps the live references consistent.
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

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
