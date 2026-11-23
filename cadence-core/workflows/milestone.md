# cad-milestone workflow

Close a finished milestone and set up the next one. A thin close-out: audit,
bump (release projects only), prune, evolve or record, refresh. Git is the archive -
pruning removes completed work from the LIVE planning docs, not from history.

This close makes one script call up front and reuses its answer at step 7:
`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" authorized --dir <root>`.
Independent probes here share one message; only a call that consumes a prior
call's output is serialized.

## 1. Scope + audit gate
Identify the milestone being closed (from PROJECT.md's current version/
milestone). Invoke `/cad-audit <milestone>` via the SlashCommand tool (the
requirement->phase->plan->verified FAIL gate). On FAIL, for any cause
audit.md section 4 gives, report it and STOP, unless the user explicitly
overrides. On PASS, continue.

## 2. Version bump (release projects only)
First probe what this project has published, naming the project ROOT:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-branch.mjs" tags --dir <root>
```

Then confirm the version: `$ARGUMENTS`, else propose the next from PROJECT.md's
current - EXCEPT on an empty `tags` (never published): propose nothing unless
`$ARGUMENTS` named one. Do not press the user toward a release they did not ask
for.

NO CONFIRMED VERSION - declined, or never proposed - is the skip rule: skip the
remainder, note "no version bump (non-release milestone)", never frame the
close as a version cut; continue at step 3. No config key decides this.

Everything below runs only on the version you confirmed: an `ok:false` on a
named version is a genuine failure - the halts below STOP the close.

Then bump the manifest + scaffold the changelog. Run, on its own line, naming
the version you just confirmed - `--version` is REQUIRED, the seam derives no
number of its own and refuses without it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/release-bump.mjs" bump --dir <root> --version <version>
```

The seam auto-detects `.claude-plugin/plugin.json` and returns `action:"skip"`
when absent. Otherwise it bumps the manifest `version` to the shipping release
(and any versioned sibling), scaffolds the dated `## [<version>]` CHANGELOG
heading + link reference, and PROMOTES whatever was staged under
`## [Unreleased]` into that dated section. Then YOU author bullet prose only
for what the promotion did NOT already move.

Four halts, each before the bump commit:

- `ok:false` with `action:"refuse"` (exit 1). The seam wrote NOTHING and named a
  `reason`: `no-target-version`, `unparseable-version`, `no-version-field`,
  `unreadable-manifest`, `unreadable-sibling-manifest`, `unreadable-changelog`,
  `downgrade`, `not-an-upgrade` or `bad-date`. Report it and STOP.
- `ok:false` with `action:"partial"` and `reason:"partial-bump"` (exit 1). The
  write set was decided and a step failed part way, so the seam DID write:
  `manifest.bumped`, each `siblings[]` row's `bumped` and `changelog.changed`
  name what actually landed. Read those three fields, repair the tree and STOP -
  it is the one halt where re-running the bump is not a clean retry.
- a `siblings[]` entry with `action:"refuse"`. Top-level `ok` stays true: that
  sibling was READABLE and simply not upgradeable - a downgrade, a non-upgrade,
  an unparseable version in the sibling itself - so the rest of the set landed
  and it still ships the old version. Name the file and STOP. A sibling that
  cannot be READ is not this case: it refuses the whole run under
  `unreadable-sibling-manifest` above, with nothing written.
- `changelog.section_empty: true`, or `changelog.state: "absent"`: the dated
  heading has no body at all, or there is no `CHANGELOG.md` to scaffold. Author
  the notes before the bump commit; on `absent` STOP and say so unless the user
  confirms this project keeps none.

Commit the manifest + changelog as
`chore: bump manifest to <version> + changelog`.

**No tag is cut here - tag-after-merge.** `/cad-land` cuts it on the pulled
base after the merge confirms.

## 3. Prune completed phases + cleanup

**Carry the `risk_surface` RULINGS forward FIRST.**

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-carry --phase <N>
```

Run it for every phase this close prunes, BEFORE the prune seam call below. It
COPIES that phase's `REVIEW-risk_surface*.md` files and every
`ADJUDICATION-risk_surface*.json` sitting beside them - every round, filenames
preserved - into `.planning/records/risk-carry/<N>/`. It refuses rather than
overwriting a carried ruling that differs, so relay any `ok:false` and STOP.

**Then carry the DEFERRED queue out of each pruned phase, per phase, before the
prune seam call below.**

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" deferred carry --phase <N>
```

Run it for every phase this close prunes. It MOVES that phase's unadjudicated
members to `.planning/records/deferred/<N>/`, leaves the settled ones behind to be
pruned with the phase, and refuses rather than overwriting - relay any
`ok:false` and stop. The moved members are committed with the prune and stay
until they are adjudicated; the close never deletes them.

One seam call does the mechanical half of the close - checked phases leave
ROADMAP.md (their `- [x]` line AND their `### Phase N:` detail section), their
`.planning/phases/<N>/` directories leave the live tree, and their requirements
move from `## Active` and `## Traceability` into `## Shipped` rows carrying the
label:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" milestone-prune \
  --label-file <path> --mode <delete|archive>
```

`<label>` = the version on a release, else the milestone name from PROJECT.md -
repository content either way, so write it to a scratch file and pass the PATH
(caller-derived text - references/conventions.md). `--mode delete` on a release
milestone (git history is the archive, with the tag /cad-land cuts when it cuts
one); `--mode archive` on an untagged one: the dirs MOVE to `_archive-<label>/`
rather than delete. Relay `warnings[]` (a missing detail section, an unreadable
REQUIREMENTS.md). `action:"skip"` means no checked phase existed - an
interrupted close or the wrong milestone; stop and look rather than continue.

The seam also writes `.planning/records/ARCHIVE.md` BEFORE it removes anything: the
pruned phases' SUMMARY deviations, UAT items and CONTEXT decisions, which
`recall` can index only while `phases/<N>/` is live. Relay `residue_rows`. `0`
is an answer, not a failure: either nothing under those phases was indexable, or
a re-run found this milestone's heading already carrying their rows.

`ok:false` STOPS the close - do not commit, do not chain to `/cad-land`.
`partial-prune` means `failed`'s phases did not clear and were left in BOTH
documents on purpose, so tree and docs still agree: surface them with their
`warnings[]` lines, clear what blocked them, re-run (already-pruned phases are
skipped). `archive-root-unusable` means `_archive-<label>` is not a real
directory and nothing moved - show the path, never delete it to clear the way.
Unfinished phases, their dirs and their requirements are untouched by
construction - a milestone can close with deferred work that rolls to the next.

Commit this as `chore: prune <label> completed phases` (label = the version on
a release, else the milestone name), staging ROADMAP.md, REQUIREMENTS.md,
`.planning/records/state.json`, `.planning/records/ARCHIVE.md`, the removed
`.planning/phases/<N>/` folders, any `.planning/records/deferred/` members and
any `_archive-<label>/` move, and NOT `.planning/records/risk-carry/`.

## 4. Evolve PROJECT.md - or close only
First the arm, asked through the ask-user seam with no preselected default: does
this close OPEN the next cycle, or close only? A close is sanctioned to open
none.

**Close only.** `### Active` opens `No cycle open.` and then RECORDS the cycle
just shipped: its label, close date, requirement ids, phase and commit counts,
the audit result, the manifest version, where its rows, narrative and residue now
live, and what is still outstanding - the merge and the tag are /cad-land's. Step
5 takes its own close-only bullet, and step 6 is unchanged.

**Opening a cycle.** Bump the version/milestone and set the next cycle's goal and
scope. Ask the user (ask-user seam) for the next milestone's intent if it is not
obvious from deferred work. Keep it to what changed.

## 5. Refresh REQUIREMENTS
The shipped rows already moved under `## Shipped` (step 3's seam call). What
remains is judgment, not surgery:
- **Close only** (step 4's arm): `## Active` opens `No cycle open.` too, points
  at `## Shipped` for the shipped ids, and names `/cad-phase add` as what opens
  the next cycle. Deferred ids keep their reasons and nothing is promoted to fill
  the section. The two bullets below do not apply - there is no next milestone to
  seed - and step 6's cursor call is the same on both arms.
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

On a fully pruned roadmap this needs no flags beyond those, and the cursor then
reads as no cycle open.

(Pass `--name`/`--total` explicitly when this close DEFERRED work: step 3
leaves unfinished phases' lines untouched, so the list is still live and
its entries do not include phase 1 - the seam finds nothing to derive from and
returns `cannot-derive`.)
Commit the doc changes (`docs:`), cursor and `.planning/records/state.json`
included, per references/git-guard.md - never leave the tree dirty.

## 7. Autonomous close (`git.auto_close` only)
When the up-front `authorized` call answered `ok:false`, this step does nothing
more: merging, tagging and publishing are the user's separate `/cad-land` call
(step 9's note), and steps 8 and 9 still run. On `ok:true`, invoke `/cad-land`
via the SlashCommand tool so it runs PR -> merge -> tag -> reset and asks once,
before the tag push. Its own gate, over the rulings step 3 carried, can still
halt the chain before the merge.

Do NOT delete `.planning/records/risk-carry/` here, on either arm. Step 3
already pruned the phase dirs, so the carry is the last surviving copy of the
rulings that halt rests on. The actor that clears it is `/cad-land` step 4, on
a merge it CONFIRMED landed. If the branch it belongs to merged outside
Cadence, see cad-land step 1's already-merged arm and its step 4's clear by
hand.

Ordering note: on the opening arm step 4 above has already moved PROJECT.md
`### Active` to the next version, so the land finds the shipped branch by
`git.integration_branch_name` or its `cadence/*` fallback; on the close-only
arm it has not.

## 8. Retune check
Invoke `/cad-suggest` via the SlashCommand tool, unscoped. Its rules live in
`cadence-core/workflows/suggest.md`. A failed or missing run degrades to a
one-line note, never a halt.

## 9. Report
Version bumped and committed - or "no version bump (non-release)" - phases
pruned, PROJECT/REQUIREMENTS refreshed, cursor reset. One line on the next
action: with the roadmap pruned empty that action is `/cad-phase add`, which
opens the next cycle's first phase entry. Note that the merge AND the release
tag are /cad-land's (already chained when step 7 ran it).
