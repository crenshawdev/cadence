# cad-milestone workflow

Close a finished milestone and set up the next one. A thin version-cut: audit,
tag, prune, evolve, refresh. Git is the archive - pruning removes completed work
from the LIVE planning docs, not from history.

## 1. Scope + audit gate
Identify the milestone being closed (from PROJECT.md's current version/
milestone). Run cad-audit (the `plan`/traceability FAIL gate, /cad-audit) over
its requirements. On FAIL - a requirement untraced, unverified, or dropped -
report it and STOP, unless the user explicitly overrides (a milestone must not
ship with silent gaps). On PASS, continue.

## 2. Tag the release
Confirm the version (`$ARGUMENTS`, else propose the next from PROJECT.md's
current). Create an annotated tag at HEAD (`git tag -a <version> -m ...`). Do NOT
push it - publishing the tag is /cad-land's decision. If `git.create_tag` is
false, skip tagging and note it.

## 3. Prune completed phases + cleanup
- Remove the completed phases (`- [x]`) from ROADMAP.md's live `## Phases` list;
  the tag + git history are their archive.
- Remove the completed phases' `.planning/phases/<N>/` directories from the
  working tree (recoverable from the tag). This folds in GSD's cleanup.
- Leave any unfinished phase and its dir in place - a milestone can close with
  deferred work that rolls to the next.
Commit this as `chore: prune <version> completed phases`.

## 4. Evolve PROJECT.md
Bump the version/milestone and set the next cycle's goal and scope. Ask the user
(ask-user seam) for the next milestone's intent if it is not obvious from
deferred work. Keep it to what changed - PROJECT.md is the north star, not a
changelog.

## 5. Refresh REQUIREMENTS
- Mark the shipped milestone's requirements Complete (they already are, per the
  audit) and move them under a shipped/archived heading or drop them from the
  live list (git holds them).
- Carry forward any deferred/unmet requirement into the new milestone.
- Seed the next milestone's headline requirements from the PROJECT.md evolution
  and the user's intent. Deep per-phase requirements come later via /cad-plan;
  keep this to the milestone's top-level asks.

## 6. Reset the cursor
Set the STATE.md cursor to the new cycle: `ready to plan`, Next = the first
action of the next milestone (e.g. `/cad-plan 1` once the roadmap has phases, or
roadmap the new milestone first). Commit the doc changes (`docs:`), cursor
included, per references/git.md - never leave the tree dirty.

## 7. Report
Tag created (unpushed), phases pruned, PROJECT/REQUIREMENTS refreshed, cursor
reset. One line on the next action. Note that publishing the tag is /cad-land.
