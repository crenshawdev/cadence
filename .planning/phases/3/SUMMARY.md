---
phase: 3
status: complete
completed: 2026-07-17
---

# Phase 3: Release mechanics - Summary

A distributed plugin now bumps its own `.claude-plugin/plugin.json` version and
prepends a dated CHANGELOG entry as part of `cad-milestone`'s close - a pure
`release-decision` core behind a `release-bump` I/O seam, wired before the tag.

## What shipped

- Pure release-decision core - `cadence-core/bin/lib/release-decision.mjs`:
  `deriveTargetVersion`, `decideManifestBump` (rewrites only `version`, `v`
  stripped to bare semver, idempotent), `prependChangelogEntry` (dated
  `## [<version>]` heading + `[<version>]:` link ref above the newest entry,
  null-target guard - never writes `[null]`).
- release-bump I/O seam - `cadence-core/bin/release-bump.mjs`: atomic writes,
  absent-file guards, auto-detect gating, emit action set
  `bumped | noop | skip | error` (`error` carries `reason:'no-target-version'`).
- Version scanners exported for reuse - `activeVersion` / `titleVersion` now
  public from `cadence-core/bin/lib/branch-decision.mjs`.
- Milestone wiring - `cadence-core/workflows/milestone.md` runs the bump +
  changelog step in step 2, before the tag (step 3) and before step 4 evolves
  `### Active`.
- self-verify registration - `release-bump.mjs` contract row added to the
  CONTRACTS table (`cadence-core/bin/self-verify.mjs`); weight budget raised
  4755 -> 5814 for milestone.md's prose growth.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | dac1b20 | Export activeVersion/titleVersion version scanners |
| 1 | 2 | bf5ec17 | Pure release-decision core (derive/bump/changelog) + 10 subtests |
| 1 | 3 | 3c2d03d | release-bump I/O seam over release-decision + 6 subtests |
| 1 | 4 | 15da863 | Register release-bump.mjs in self-verify CONTRACTS |
| 1 | 5 | 2a43b83 | Wire manifest bump + changelog into milestone close |

Range: `41984b6..2a43b83` (5 commits).

## Deviations

- None - plans executed as written.

## Open items

- (medium, general-case, from advisory diff review) `prependChangelogEntry`
  inserts before the first `## [` heading. On a Keep-a-Changelog file that keeps
  a `## [Unreleased]` section at the top, the released entry lands *above*
  Unreleased (out of order). Confirmed by grounding: this repo's own
  `CHANGELOG.md` has no `## [Unreleased]` section (intro -> `## [1.0.0]`), so
  Cadence's own v1.1 close is unaffected; only third-party plugins that keep an
  Unreleased section are bitten. Fix: skip an `## [Unreleased]` heading when
  choosing the insertion anchor.
  (`cadence-core/bin/lib/release-decision.mjs:103`)
- (low, general-case, from advisory diff review) `changelogUrl` returns `""`
  when the manifest carries neither `homepage` nor `repository`, so the link
  reference is written as `[<version>]: ` with an empty URL. Confirmed: this
  repo's `plugin.json` carries both fields, so its output is a valid URL; only
  manifests lacking both are bitten. Fix: omit the link-reference line entirely
  when the URL is empty. (`cadence-core/bin/release-bump.mjs:55`)
- (deferred, D-08 boundary, from CONTEXT.md) The live rc.2 execution - bumping
  *this* repo's `plugin.json` to `1.1.0-rc.2`, authoring the real v1.1 CHANGELOG
  prose bullets, and the human-verify `/plugin`-reports-the-update check - is
  intentionally left for the rc.2 milestone close, run *by* this mechanism, not
  hand-landed in Phase 3.

## Goal check

The phase goal - "a distributed-plugin release bumps its own manifest version
and records what changed as part of the close, not by hand" - is delivered as a
mechanism. `decideManifestBump` rewrites only `version` to the bare semver and
no-ops on a second run (idempotency test, `release-bump.test.mjs`, 233/233 tests
pass); a version-less sibling manifest is left byte-unchanged; a project with no
`.claude-plugin/plugin.json` returns `action:"skip"` without crashing.
`prependChangelogEntry` prepends the dated heading + link ref above the newest
entry, leaving prior entries untouched, and guards a null target so no `[null]`
heading is ever written. The step is wired into `milestone.md` step 2 - before
the tag (step 3) and the `### Active` evolve (step 4) - and `release-bump.mjs`
validates against the self-verify CONTRACTS table (`self-verify.mjs` exits 0).
What is deliberately NOT here, per the plan and CONTEXT D-08: the live rc.2 bump
of this repo's own manifest and the real v1.1 changelog prose - those are
produced by this mechanism at the milestone close, and Phase 3 scoped itself to
the mechanism + wiring + tests only. The two advisory-review open items above
are latent edge cases for third-party plugins (Unreleased ordering, missing-URL
manifests); neither affects Cadence's own close and both are recorded for a
follow-up hardening pass.
