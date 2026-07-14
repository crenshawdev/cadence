# cad-milestone workflow

Close a finished milestone and set up the next one. A thin close-out: audit,
tag (release projects only), prune, evolve, refresh. Git is the archive -
pruning removes completed work from the LIVE planning docs, not from history.

## 1. Scope + audit gate
Identify the milestone being closed (from PROJECT.md's current version/
milestone). Run cad-audit (the `plan`/traceability FAIL gate, /cad-audit) over
its requirements. On FAIL - a requirement untraced, unverified, or dropped -
report it and STOP, unless the user explicitly overrides (a milestone must not
ship with silent gaps). On PASS, continue.

## 2. Tag the release (release projects only)
Detect release mode first: read `git.create_tag` from config and probe for any
existing tag (`git tag`). It is a non-release milestone when `git.create_tag`
is false, or the project has never tagged and the user is not cutting a named
version - then skip this step, note "no tag (non-release milestone)", and do
not frame the close as a version cut. Do not press the user toward a tag they
did not ask for.

Otherwise confirm the version (`$ARGUMENTS`, else propose the next from
PROJECT.md's current), create an annotated tag at HEAD (`git tag -a <version>
-m ...`), and do NOT push it - publishing the tag is /cad-land's decision.

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
  audit) and move them under a shipped/archived heading - keep each REQ-ID as a
  row with its phase and `Complete` status. Do NOT collapse them into a prose
  bullet or drop them from the file: the archived rows are what keeps
  /cad-audit able to trace shipped scope after phase dirs are pruned. Git holds
  the detail; the live file keeps the trace.
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
