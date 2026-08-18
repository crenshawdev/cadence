# cad-milestone workflow

Close a finished milestone and set up the next one. A thin close-out: audit,
bump (release projects only), prune, evolve, refresh. Git is the archive -
pruning removes completed work from the LIVE planning docs, not from history.
The release tag is NOT cut here: /cad-land cuts it on the pulled base after
the merge confirms (tag-after-merge).

This close reads ONE config key: `config.mjs get git.auto_close` up front, reused
at step 7 rather than re-read. Step 2 decides release mode from evidence - a
confirmed version and the tags this project has published - and from no key at
all. Independent probes here share one message; only a call that consumes a
prior call's output is serialized.

## 1. Scope + audit gate
Identify the milestone being closed (from PROJECT.md's current version/
milestone). Invoke `/cad-audit <milestone>` via the SlashCommand tool (the
requirement->phase->plan->verified FAIL gate), mirroring step 7's chained
/cad-land, rather than re-deriving the break-codes inline. On FAIL - a requirement untraced, unverified, or dropped -
report it and STOP, unless the user explicitly overrides (a milestone must not
ship with silent gaps). On PASS, continue.

## 2. Version bump (release projects only)
First probe what this project has published, naming the project ROOT - the
read is bounded to the repository at that path, so a project inside an
unrelated repository does not read its releases as its own:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-branch.mjs" tags --dir <root>
```

Then confirm the version: `$ARGUMENTS`, else propose the next from PROJECT.md's
current - EXCEPT on an empty `tags` (never published): propose nothing unless
`$ARGUMENTS` named one. Do not press the user toward a release they did not ask
for.

NO CONFIRMED VERSION - declined, or never proposed - is the skip rule: skip the
remainder, note "no version bump (non-release milestone)", never frame the
close as a version cut; continue at step 3. No config key decides this: a project that tags by hand
still bumps its manifest, and the key that governs the release tag is read where
that tag is cut (/cad-land, after the merge - the tag-after-merge note below).

Everything below runs only on the version you confirmed: the bump never runs
without `--version`, so the seam's `no-target-version` refusal is unreachable
here; an `ok:false` on a named version is a genuine failure - the halts below
STOP the close.

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

Three halts, each before the bump commit:

- `ok:false` (exit 1). The seam wrote NOTHING and named a `reason`:
  `no-target-version`, `unparseable-version`, `unreadable-manifest`,
  `downgrade` or `not-an-upgrade`. Report that reason and STOP the close. A
  close continued past a refused bump ships a manifest still carrying the
  previous version.
- a `siblings[]` entry with `action:"refuse"`. Top-level `ok` stays true (the
  primary manifest already wrote), but that sibling still ships the old
  version - name the file and STOP.
- `changelog.section_empty: true`. The dated heading has no body at all;
  author the release notes into it before the bump commit rather than shipping
  a heading over silence.

Commit the manifest + changelog as
`chore: bump manifest to <version> + changelog`, so the merge - and the tag
cut after it - carries the bumped manifest.

**No tag is cut here - tag-after-merge.** A tag cut at close names a pre-merge
commit on the integration branch, and any non-fast-forward land leaves that
commit off base entirely: the release tag then points at history main does not
contain. `/cad-land` cuts the tag in its cleanup step, on the pulled base,
after the merge is confirmed - this close's job ends at the bump commit.

## 3. Prune completed phases + cleanup

**Carry the `risk_surface` survivors forward FIRST.** The prune below removes
`.planning/phases/<N>/`, which holds the only producer `/cad-land`'s unattended
halt has, and step 7 chains `/cad-land` AFTER this - so pruning first leaves
that gate globbing empty, which reads as "nothing survived" and merges over a
held blocker. Union every `.planning/phases/*/REVIEW-risk_surface*.md` into one
`{"findings": [...]}` at `.planning/REVIEW-risk_surface-<label>.md`, outside
`phases/`. Empty union -> write nothing.

**TRANSIENT, never staged**, deleted by step 7 when the close resolves. Commit
it and a survivor rides onto base, where every later autonomous land unions it
again and halts on a finding answered a milestone ago.

One seam call does the mechanical half of the close - checked phases leave
ROADMAP.md (their `- [x]` line AND their `### Phase N:` detail section, since
a surviving detail section is the signature of an INTERRUPTED close per
`references/roadmap-phases.md`), their `.planning/phases/<N>/` directories
leave the live tree, and their requirements move from `## Active` and
`## Traceability` into `## Shipped` rows carrying the label:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" milestone-prune \
  --label-file <path> --mode <delete|archive>
```

`<label>` = the version on a release, else the milestone name from PROJECT.md -
repository content either way, so write it to a scratch file and pass the PATH
(caller-derived text - references/conventions.md). `--mode delete` on a release milestone (the tag cut at land is their archive);
`--mode archive` on an untagged one - there is no tag to name them by, so the
dirs MOVE to `_archive-<label>/` rather than delete, and git history is not
the only copy. Relay `warnings[]` (a missing detail section, an unreadable
REQUIREMENTS.md). `action:"skip"` means no checked phase existed - an
interrupted close or the wrong milestone; stop and look rather than continue.

The seam also writes `.planning/ARCHIVE.md` BEFORE it removes anything: the
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
`.planning/ARCHIVE.md` and any `_archive-<label>/` move. NOT the carry-forward
file - it is transient, and ARCHIVE.md is its opposite: that file exists to be
consumed and deleted by step 7, while the residue IS the recall corpus for every
milestone this project has closed and dies with the working tree untracked.

## 4. Evolve PROJECT.md
Bump the version/milestone and set the next cycle's goal and scope. Ask the user
(ask-user seam) for the next milestone's intent if it is not obvious from
deferred work. Keep it to what changed - PROJECT.md is the north star, not a
changelog.

## 5. Refresh REQUIREMENTS
The shipped rows already moved under `## Shipped` (step 3's seam call - that
archival is what keeps /cad-audit able to trace shipped scope after the phase
dirs are pruned). What remains is judgment, not surgery:
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
Commit the doc changes (`docs:`), cursor included, per references/git-guard.md -
never leave the tree dirty.

## 7. Autonomous close (`git.auto_close` only)
When `git.auto_close` is `false` (default), stop here: merging, tagging and
publishing are the user's separate `/cad-land` call (step 8's note). When
`git.auto_close` is `true`, chain the publish end-to-end - invoke `/cad-land`
via the SlashCommand tool so it runs PR -> merge -> tag -> reset with no
per-step prompts (audit -> bump already ran above). The close gate inside
cad-land still applies: a surviving blocker/high `risk_surface` finding from this
branch's own fires stops the chain before merge (nothing is force-merged) - and
only because step 3 carried those survivors out of the phase dirs it pruned.
Skip that and this sentence is false: the gate globs empty and merges.

Delete `.planning/REVIEW-risk_surface-<label>.md` once the close resolves, on
BOTH arms - the halt included, or a halt the user answers by landing manually
leaves the file behind to halt the next milestone too.

Ordering note (intentional, not a latent bug): this chain runs AFTER step 4
evolved PROJECT.md `### Active` to the NEXT version, so cad-land can no longer
re-derive the just-shipped branch name by version. It reaps via the
`land-cleanup.mjs` `cadence/*`-merged fallback (resolveReapBranch): the sole
`cadence/*` branch actually merged into base is the shipped
`cadence/<this-version>`, so it is still reaped correctly.

## 8. Retune check
The record this milestone wrote prices its own configuration. Invoke
`/cad-suggest` via the SlashCommand tool, unscoped - the milestone's evidence
spans every phase it shipped. Its rules live in
`cadence-core/workflows/suggest.md` and are not restated here.

The close's own posture, which is not a presentation rule: a failed or missing
run degrades to a one-line note, never a halt. The close does not gate on its
own accounting.

## 9. Report
Version bumped and committed - or "no version bump (non-release)" - phases
pruned, PROJECT/REQUIREMENTS refreshed, cursor reset. One line on the next
action: with the roadmap pruned empty that action is `/cad-phase add`, which
opens the next cycle's first phase entry. Note that the merge AND the release
tag are /cad-land's - the tag is cut there on the pulled base after the merge
confirms (already chained when `git.auto_close` is on).
