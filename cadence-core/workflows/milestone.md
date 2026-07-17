# cad-milestone workflow

Close a finished milestone and set up the next one. A thin close-out: audit,
tag (release projects only), prune, evolve, refresh. Git is the archive -
pruning removes completed work from the LIVE planning docs, not from history.

## 1. Scope + audit gate
Identify the milestone being closed (from PROJECT.md's current version/
milestone). Run the traceability audit (the requirement->phase->plan->verified FAIL
gate) over
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
PROJECT.md's current).

Then, before the tag, bump the manifest + scaffold the changelog. Run, on its
own line (add `--version <version>` when the user named one via `$ARGUMENTS`):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/release-bump.mjs" bump --dir <root>
```

The seam auto-detects `.claude-plugin/plugin.json` and returns `action:"skip"`
when absent (non-plugin projects are unaffected). Otherwise it bumps the
manifest `version` to the shipping release (and any versioned sibling) and
scaffolds the dated `## [<version>]` CHANGELOG heading + link reference. Then
YOU author the entry's bullet prose under that heading - what shipped this
milestone, including any default flips - the seam owns the deterministic
scaffold, prose owns the judgment. Commit the manifest + changelog as
`chore: bump manifest to <version> + changelog` BEFORE the tag, so the tag
captures the bumped manifest. This runs before step 4 evolves `### Active`, so
derivation reads the shipping version, and the `git.auto_close` chain (step 7)
inherits it because step 2 always runs pre-tag.

Then create an annotated tag at HEAD (`git tag -a <version> -m ...`), and do
NOT push it - publishing the tag is /cad-land's decision.

## 3. Prune completed phases + cleanup
- Remove the completed phases (`- [x]`) from ROADMAP.md's live `## Phases` list;
  the tag + git history are their archive.
- Archive the completed phases' `.planning/phases/<N>/` directories out of the
  live tree. Tagged (release) milestone: delete them - recoverable from the tag.
  Untagged (non-release) milestone: there is no tag to name them by, so MOVE
  them into an on-disk `_archive-<label>/` (label = the shipped milestone's
  name from PROJECT.md) rather than delete, so git history is not the only copy.
- Leave any unfinished phase and its dir in place - a milestone can close with
  deferred work that rolls to the next.
Commit this as `chore: prune <label> completed phases` (label = the version on
a release, else the milestone name).

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
Point the cursor at the new cycle through the seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
  --phase 1 --status "ready to plan" --next "<first action of the next milestone>"
```

(Pass `--name`/`--total` explicitly if the new roadmap is not written yet.)
Commit the doc changes (`docs:`), cursor included, per references/git.md -
never leave the tree dirty.

## 7. Autonomous close (`git.auto_close` only)
When `git.auto_close` is `false` (default), stop here: the tag stays unpushed
and publishing is the user's separate `/cad-land` call (step 8's note). When
`git.auto_close` is `true`, chain the publish end-to-end - invoke `/cad-land`
via the SlashCommand tool so it runs PR -> merge -> reset with no per-step
prompts (audit -> tag already ran above). The `pre_ship` gate-halt inside
cad-land still applies: a surviving blocker/high finding stops the chain before
merge (nothing is force-merged).

Ordering note (intentional, not a latent bug): this chain runs AFTER step 4
evolved PROJECT.md `### Active` to the NEXT version, so cad-land can no longer
re-derive the just-shipped branch name by version. It reaps via the
`land-cleanup.mjs` `cadence/*`-merged fallback (resolveReapBranch): the sole
`cadence/*` branch actually merged into base is the shipped
`cadence/<this-version>`, so it is still reaped correctly.

## 8. Report
Tag created (unpushed) - or "no tag (non-release)" - phases pruned,
PROJECT/REQUIREMENTS refreshed, cursor reset. One line on the next action. Note
that publishing the tag is /cad-land (already chained when `git.auto_close` is
on).
