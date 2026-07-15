# cad-undo workflow

Roll back a phase's commits safely. The phase SUMMARY.md is the manifest -
cad-execute writes commits-per-task with their hashes there - so discovery is a
read, not a guess.

## 1. Resolve the target
`$ARGUMENTS` names the phase number. Read `.planning/phases/<N>/SUMMARY.md` and
collect the commit hashes it lists (per task), plus the phase's docs commit
(`docs(<N>): ...`). If SUMMARY.md is missing or lists no hashes, fall back to
`git log` filtered to that phase's conventional-commit scope, and SHOW the
matched commits for confirmation before trusting them.

## 2. Dirty guard
If the working tree has uncommitted or staged changes, STOP - do not undo over
dirty state. Offer (ask-user seam) to stash first, or to abort. A clean tree is
a precondition; never discard the user's in-flight work.

## 3. Confirm + factual later-work check
Show the exact hashes (oldest->newest) that will be reverted and the phase they
belong to. State plainly whether later phases exist (phases N+1..) or later
commits sit on top - "phases 4-5 were built after this; reverting phase 3 may
break them." This is a factual notice, NOT a dependency analysis (no heuristic
dependency-guessing). Require an explicit yes (ask-user seam).

## 4. Revert
- **Default**: `git revert --no-edit <hashes in reverse order>` - one revert
  commit per undone commit, preserving history (the safe, auditable path).
- **`--no-commit`**: `git revert --no-commit <hashes reverse>` - apply the
  reversal to the index without committing, so the changes are staged for the
  user to adjust and re-do. A squash-style undo; leave it staged, do not commit.
Reverting a range that does not apply cleanly stops on the conflict - report it,
do not force; the user resolves or aborts (`git revert --abort`).

## 5. Reset the phase status
Because the phase is being undone, roll its status back (the one legitimate
exception to cad-verify owning status):
- ROADMAP `## Phases`: the phase's box `- [x]` -> `- [ ]`.
- REQUIREMENTS traceability: that phase's requirements Status Complete -> Pending.
- STATE cursor: point back at the phase as its now-current work
  (`planned` or `ready to plan` depending on how far back the revert went).
Do this only for a committed revert; for `--no-commit`, leave status alone (the
user has not finalized the undo).

## 6. Report
Which commits were reverted (or staged), the new HEAD, the status reset, and the
next action. Never auto-push the reverts - publishing is /cad-land's call.
