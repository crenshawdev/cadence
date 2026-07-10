---
name: cad-pause
description: "Pause work cleanly - a WIP commit of in-flight changes plus a STATE cursor set to paused with a one-line 'where I was' as the resume pointer. Resume is /cad-progress, which auto-detects it. No Stop hook"
argument-hint: "[one-line note about where you are]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
Stop mid-work without losing the thread. Two small acts: commit the in-flight
changes as WIP so nothing is lost, and write the STATE cursor so the next
session (via /cad-progress, which auto-resumes) knows exactly where to pick up.
Tiny by design - no Stop hook, no handoff document, no activity log.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/references/git.md
@$HOME/.claude/cadence-core/references/conventions.md
</execution_context>

<process>
1. **WIP commit.** If the tree has changes, stage exactly what the user was
   working on and commit `wip: <short description>` (protected-branch guard
   applies - references/git.md). If the tree is clean, skip this; there is
   nothing to preserve.

2. **Set the cursor.** Rewrite `.planning/STATE.md` in place, keeping the strict
   4-line schema (references/conventions.md - never add a 5th line):
   - `Status: paused`
   - `Next:` = the resume pointer: a one-line "where I was" that names the next
     concrete action (from `$ARGUMENTS`, or ask via the ask-user seam if not
     given). This line IS the pause note /cad-progress surfaces.
   - keep `Phase:`; set `Updated:` to today.
   Commit the cursor (`docs:`), or fold it into the WIP commit if one was made.
   Never leave the tree dirty.

3. **Report.** One line: paused at <phase>, resume with /cad-progress.
</process>
