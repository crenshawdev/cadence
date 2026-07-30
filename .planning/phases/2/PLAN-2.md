---
phase: 2
plan: 2
requirements:
  - STK-01
files:
  - CHANGELOG.md
  - DESIGN.md
---

# Phase 2: The stakes axis - Plan 2 (the historical record)

## Goal

The routing question changes from what a dispatch costs to what it costs if it
is wrong. This plan carries the half of that change a user meets AFTER the
upgrade breaks their config: the release note that states the break and the
design record that says the axis was replaced and why.

## Must be true when done

- A user whose config stopped validating finds the break stated where they look
  for it: `CHANGELOG.md`'s `## [Unreleased]` section names every removed key,
  names `stakes` and its three values, and gives the exact action to take on
  their own `.planning/config.json` - not a description of the change, a command
  and an edit they can run.
- `DESIGN.md`'s "Model routing" decision record carries a dated marker recording
  that the spend axis was replaced by the stakes axis and the `auto` mode
  retired, with the superseded text left standing above it rather than rewritten.

## Context

CONTEXT.md decisions bind this plan: D-14 (the `[2.0.0]` entry is authored under
`## [Unreleased]`, never under a literal `## [2.0.0]` heading - `prependChangelogEntry`
in `lib/release-decision.mjs:95-98` becomes a no-op if that heading already
exists, and `workflows/milestone.md:36-42` states the seam scaffolds while the
human authors), D-13 (`DESIGN.md` gets an appended dated status marker, not a
rewrite - `self-verify.mjs:162-168` deliberately excludes DESIGN/LINEAGE/CHANGELOG
from the prose walk because they legitimately name keys that were later cut,
while explaining the cut), D-01/D-02/D-04/D-12 for the vocabulary these two
files describe.

Both files sit outside self-verify's prose walk and outside the weight manifest,
and neither is touched by PLAN-1, so this plan runs independently of it. The key
set it describes is fixed by CONTEXT and by PLAN-1's recorded decision that
`max_escalations` is dropped rather than renamed - do not restate it as deferred
or as surviving under a new name.

## Tasks

### Task 1: State the break and the upgrade action under [Unreleased]

- **Files:** CHANGELOG.md
- **Action:** Author the v2.0.0 stakes entry UNDER the existing `## [Unreleased]`
  heading at `:7`, adding Keep-a-Changelog subsections beneath it. Do NOT create
  a literal `## [2.0.0]` heading: `prependChangelogEntry` no-ops when one already
  exists and the milestone seam inserts the dated heading below Unreleased at
  release time without moving its contents, so authoring one here silently
  disables the scaffold (D-14, and commit 497a4ea records the promotion being a
  hand step). Write a `### Removed` subsection listing all four retired keys by
  name with what replaced each: `model.profile` -> the top-level `stakes` key;
  `model.auto.escalate_on_failure` -> `model.escalate_on_failure`, now honoured
  at every stakes level rather than only under `auto`; `model.auto.ceiling` and
  `model.auto.max_escalations` -> removed outright, because escalation no longer
  steps a spend ladder and a role escalates to exactly one rung
  (`escalate_to`), so there is no second step to cap. Say plainly that there is
  no back-compat alias and that a config a user wrote stops validating on the
  KEY, not just the value - that is the one reason this release is major. Write
  a `### Changed` subsection stating the reframe in the user's terms: the
  question is no longer how much a dispatch should cost but what it costs if the
  work is wrong, answered by `stakes` taking `solo` (nobody else runs this, a
  break costs only your time), `shipped` (other people run this, a break comes
  back as a bug report) or `critical` (a break is not a bug report), defaulting
  to `shipped`; and that the effort rung ladder v2.0.0's phase 1 shipped is now
  reachable on a default install, because escalate-on-failure no longer sits
  behind a mode nobody enabled. Then give the upgrade action as its own short
  paragraph or list, concrete enough to follow without reading the schema: open
  `.planning/config.json` (and `~/.claude/cadence/config.json` if a global layer
  is set), delete the `profile` and `auto` entries from the `model` block, keep
  or add `"escalate_on_failure": true` there if the old `auto.escalate_on_failure`
  was set, and run `/cad-config stakes=shipped` (or `solo` / `critical`) to set
  the new key. Say why the deletion is a hand edit: `config.mjs set` writes keys
  and never removes them, and the seam refuses the retired names outright, so the
  stale block has to come out of the file directly. Do not touch any entry at or
  below `## [1.5.0]`.
- **Verify:** `sed -n '/## \[Unreleased\]/,/## \[1\.5\.0\]/p' CHANGELOG.md` shows
  the new entry, and within that range `grep -c` finds `model.profile`,
  `model.auto.ceiling`, `model.auto.max_escalations`,
  `model.auto.escalate_on_failure`, `model.escalate_on_failure`, `stakes`,
  `solo`, `shipped`, `critical` and `/cad-config stakes=` each at least once
  (AC7, CHANGELOG arm). `grep -c "^## \[2\.0\.0\]" CHANGELOG.md` reports 0.
  `grep -n "^## " CHANGELOG.md | head -3` still shows `## [Unreleased]`
  immediately followed by `## [1.5.0] - 2026-07-28`.

### Task 2: Append the dated axis-replacement marker to DESIGN's model-routing record

- **Files:** DESIGN.md
- **Action:** Append one marker bullet to the end of the
  `### Model routing = minimal canned profiles + optional auto (the standout feature)`
  subsection, immediately after the existing
  `⚠️ **SUPERSEDED (2026-07-28):**` bullet that ends at `:379`, matching that
  bullet's format and indentation. Use a label distinct from the one already
  carrying that date so the two are not read as one entry - open it
  `- ⚠️ **AXIS REPLACED (2026-07-28):**`. Record four things: the spend axis
  (`model.profile` over `fast`/`balanced`/`quality`) is replaced by a bare
  top-level `stakes` key over `solo`/`shipped`/`critical`, with no back-compat
  alias, which is what makes v2.0.0 major; the `auto` mode is deleted rather than
  kept as a fourth value, because three values answer what a break costs while
  the fourth answered how the resolver should behave, and its difficulty signals
  (`--files`, `--ambiguity`, the table's `auto` block) go with it, having never
  been passed by a live workflow; `escalate_on_failure` is promoted to
  `model.escalate_on_failure` and honoured at every stakes level, while
  `auto.ceiling` and `max_escalations` are dropped outright since the surviving
  escalation is a single rung swap with no second step to cap; and the
  `⚠️ PARTIALLY REOPENED` bullet's stated reason for keeping `fable` pin-only is
  now stale - the ranking IS established and fable ranks above opus - so the
  decision stands instead on three operational facts: a zero-data-retention org
  gets a hard `400` on every request, its safety classifiers refuse
  cyber-adjacent content and Cadence reviews its own git rails, secrets handling
  and shell tokenizer, and its multi-minute turns press against the configured
  provider request timeout inside the host's Bash ceiling. Leave `:334-379`
  untouched - the marker stack is the convention here and the superseded text
  explaining a cut is the point of it (D-13). Leave the `:472` "**Config
  decisions:** model routing -> minimal (3 profiles + auto)" summary line alone
  for the same reason; the marker is the record, not a search-and-replace pass.
- **Verify:** `grep -n "AXIS REPLACED (2026-07-28)" DESIGN.md` returns exactly
  one line, positioned after the existing `SUPERSEDED (2026-07-28)` bullet and
  before the `### Name: Cadence` heading. `git diff DESIGN.md` shows only added
  lines inside that subsection - no line between `:334` and `:379` modified or
  deleted. `sed -n '/AXIS REPLACED/,/^### Name/p' DESIGN.md` names
  `model.profile`, `stakes`, `solo`, `shipped`, `critical`,
  `model.escalate_on_failure` and `fable`.

## Notes

- This plan is genuinely independent of PLAN-1: it shares no file, and both
  surfaces are deliberately excluded from `self-verify.mjs`'s prose walk
  (`:162-168`) and from the weight manifest, so neither task's Verify depends on
  the schema or the resolver having landed. It is the only slice of the CONTEXT
  `Plan shape` sketch that passes the independence test - the schema+route core
  and the prose sweep are coupled through `self-verify.test.mjs:110` and are one
  plan (PLAN-1). The `Plan shape` directive asked for multiple plans in this
  phase and this plan honours it; the deviation is that there are two rather
  than three, recorded in PLAN-1's Notes with its reason.
- The key set described here is settled, not open: PLAN-1's Notes record the
  planner's call that `max_escalations` is dropped rather than renamed to
  `model.max_escalations`, so this plan can state the removal flatly. If that
  call is reversed during execution, this plan's Removed subsection has to move
  with it.
- The release tag is NOT cut here and the version is NOT bumped here. `/cad-milestone`
  promotes `## [Unreleased]` to a dated `## [2.0.0]` heading and bumps the
  manifest; the tag rides with the merge on base (PROJECT.md Key Decisions).
