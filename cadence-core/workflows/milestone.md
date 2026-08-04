# cad-milestone workflow

Close a finished milestone and set up the next one. A thin close-out: audit,
tag (release projects only), prune, evolve, refresh. Git is the archive -
pruning removes completed work from the LIVE planning docs, not from history.

Read the config keys this close needs in ONE `config.mjs get` up front
(conventions.md Parallel work) - `git.create_tag git.auto_close` - and reuse them
at steps 2 and 7 rather than re-reading.

## 1. Scope + audit gate
Identify the milestone being closed (from PROJECT.md's current version/
milestone). Invoke `/cad-audit <milestone>` via the SlashCommand tool (the
requirement->phase->plan->verified FAIL gate), mirroring step 7's chained
/cad-land, rather than re-deriving the break-codes inline. On FAIL - a requirement untraced, unverified, or dropped -
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
own line, naming the version you just confirmed - `--version` is REQUIRED, the
seam derives no number of its own and refuses without it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/release-bump.mjs" bump --dir <root> --version <version>
```

The seam auto-detects `.claude-plugin/plugin.json` and returns `action:"skip"`
when absent (non-plugin projects are unaffected). Otherwise it bumps the
manifest `version` to the shipping release (and any versioned sibling),
scaffolds the dated `## [<version>]` CHANGELOG heading + link reference, and
PROMOTES whatever was staged under `## [Unreleased]` into that dated section.
Then YOU author bullet prose only for what the promotion did NOT already move -
re-authoring what it moved lists one change twice. The seam owns the
deterministic scaffold, prose owns the judgment.

Three halts, each BEFORE the tag and before the bump commit:

- `ok:false` (exit 1). The seam wrote NOTHING and named a `reason`:
  `no-target-version`, `unparseable-version`, `unreadable-manifest`,
  `downgrade` or `not-an-upgrade`. Report that reason and STOP the close. A tag
  cut after a refused bump names a commit whose manifest still carries the
  previous version.
- a `siblings[]` entry with `action:"refuse"`. Top-level `ok` stays true (the
  primary manifest already wrote), but that sibling still ships the old
  version - name the file and STOP.
- `changelog.section_empty: true`. The dated heading has no body at all;
  author the release notes into it before the bump commit rather than shipping
  a heading over silence.

Commit the manifest + changelog as
`chore: bump manifest to <version> + changelog` BEFORE the tag, so the tag
captures the bumped manifest. The `git.auto_close` chain (step 7) inherits the
bump because step 2 always runs pre-tag.

Then create an annotated tag at HEAD (`git tag -a <version> -m ...`), and do
NOT push it - publishing the tag is /cad-land's decision.

## 3. Prune completed phases + cleanup
- Remove the completed phases (`- [x]`) from ROADMAP.md's live `## Phases` list,
  AND each one's `### Phase N: ...` detail section under `## Phase Details`
  (leave that heading itself standing - it carries no phase token). A surviving
  detail section is the signature of an INTERRUPTED close and the phase-list
  grammar reports it as one (`references/roadmap-phases.md`), so a finished
  close must leave none. The tag + git history are their archive.
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
  and the user's intent, as `## Active` bullets in the `- **<ID>**: <one line>`
  form (`references/req-traceability.md`) - the section `/cad-plan`'s seeding
  step reads. Deep per-phase requirements come later via /cad-plan; keep this
  to the milestone's top-level asks.

## 6. Reset the cursor
Point the cursor at the new cycle through the seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
  --phase 1 --status "ready to plan" --next "/cad-phase add"
```

On a fully pruned roadmap this needs no flags beyond those: the seam derives
`of 0 (no active cycle)` from the empty phase list step 3 now produces.
`/cad-phase add` is the destination because it is the only workflow that
appends a phase line to an existing roadmap - `/cad-plan` stops with "Phase
{N} is not in ROADMAP.md".

(Pass `--name`/`--total` explicitly when this close DEFERRED work: step 3's
third bullet leaves that phase's line in place, so the list is still live and
its entries do not include phase 1 - the seam finds nothing to derive from and
returns `cannot-derive`.)
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
PROJECT/REQUIREMENTS refreshed, cursor reset. One line on the next action: with
the roadmap pruned empty that action is `/cad-phase add`, which opens the next
cycle's first phase entry. Note that publishing the tag is /cad-land (already
chained when `git.auto_close` is on).
