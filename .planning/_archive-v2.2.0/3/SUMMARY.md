---
phase: 3
status: complete
completed: 2026-08-03
---

# Phase 3: The release seam cannot lie about the release - Summary

The release seam refuses instead of guessing: `decideManifestBump` gained a
semver §11 comparator with downgrade/unparseable/not-an-upgrade refusals behind
one `ok:false`/exit-1 envelope, the prose version derivation is deleted
(`--version` is the required shipping number), `promoteUnreleased` moves staged
`## [Unreleased]` content into the dated heading, and `workflows/milestone.md`
halts the close on refusals, sibling refusals, and empty sections.

## What shipped

- One refusal envelope end to end - `cadence-core/bin/release-bump.mjs` emits
  `ok:false` / exit 1 with a machine `reason` code on every refusal
  (`no-target-version`, `unparseable-version`, `unreadable-manifest`,
  `downgrade`, `not-an-upgrade`); `reason` is a code on success paths too, with
  the prose in `detail`. `readManifest` distinguishes absent (skip) from
  unparseable (refuse), including a non-object JSON parse.
- The shipping number is the explicit `--version` -
  `normalizeTargetVersion(argVersion)` replaced `deriveTargetVersion`'s prose
  arms; the seam reads neither `PROJECT.md` nor `ROADMAP.md`;
  `branch-decision.mjs`'s `activeVersion`/`titleVersion` are module-private
  again (D-11 untouched - branch naming keeps its derivation).
- Strict-upgrade gate - `compareVersions` (semver §11: prerelease precedence,
  length-then-lexicographic numeric compare safe above 2^53, build metadata
  ignored) drives an 8-arm first-match-wins `decideManifestBump`; AC1/AC2
  refusals proven to fail against pre-phase HEAD (assertion output captured in
  the executor report, five rows, all `actual: 'bump', expected: 'refuse'`).
- Promotion - `promoteUnreleased(changelogText, version)` in the pure lib
  (D-09), composed after `prependChangelogEntry` in the seam, one atomic write;
  changelog block gated on `bump`/`noop` so a `skip` run can no longer write a
  dated heading; `section_empty` reported in the envelope.
- The close halts - `milestone.md` documents the refusal arm, the
  `siblings[]` refuse check, and the `section_empty` "author before the bump
  commit" rule; `--version` unconditional on the run line; budget 7181 -> 8002
  regenerated in the same commit; REL-03's release note staged under
  `## [Unreleased]`; tag-at-HEAD contradiction recorded to CAPTURE (deferred
  per CONTEXT).

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 2c3c2cb | refusal envelope: `ok:false`/exit 1, verdict `code` field, `action:'error'` -> `'refuse'`, `readManifest` three-way split, `seamStatus` test helper |
| 1 | 2 | 1dd5ad5 | `normalizeTargetVersion` replaces prose derivation; `branch-decision.mjs` exports trimmed; PROJECT/ROADMAP reads deleted |
| 1 | 3 | 86929d4 | `compareVersions` (semver §11) + 8-arm first-match-wins verdict list; failing-first AC1/AC2 tests |
| 1 | 4 | 67f0379 | `promoteUnreleased` + seam composition, changelog gated off `skip`, `section_empty` signal |
| 1 | 5 | c253a3b | milestone.md three halts, budget 8002, REL-03 CHANGELOG note, CAPTURE todo |

## Deviations

- [deviation] Task 2's verify grep hit my own JSDoc naming the removed sources
  in a negative sentence; reworded to carry the meaning without the literal
  tokens so the drift guard stays clean (1dd5ad5).
- [deviation] The sibling loop shares `readManifest`, so a sibling's
  unparseable state needed a call the plan did not make: recorded as
  `{action:'refuse', reason:'unreadable-manifest'}` in `siblings[]`, matching
  D-08 record-without-abort and the task-5 sibling halt (2c3c2cb).
- [deviation] Inline correctness fix: a JSON.parse returning a non-object
  (`null`, number, array) previously reached `manifest.version` and surfaced
  as `reason:'internal'`; now `unreadable-manifest` (2c3c2cb).
- [deviation] `section_empty` is computed in the lib (returned as
  `sectionEmpty`, the seam maps it) rather than in the seam - computing it
  there would duplicate the heading/bounding grammar, the two-homes mistake
  task 3 avoids; D-09 preserved (67f0379).
- [deviation] Task 1 test-count prediction was 19, observed 22 - a miscount of
  the pre-existing baseline, pass/fail exactly as predicted.
- [deviation] The §11 chain is seven per-pair `test()` calls rather than one
  test of pairwise asserts, honoring `retired-keys.test.mjs:4-6`'s
  count-equals-rows convention (86929d4).

## Open items

Diff-review survivors (adjudicated, three-voice panel - gemini dropped on a
provider 503; user triaged all six to record-only):

- HIGH (convergent, live-verified): `plugin.json` present but missing its
  `version` field + valid `--version` -> `skip/no-version-field`, exit 0, no
  changelog write, and `milestone.md`'s halts do not cover that skip reason -
  a close could tag with no bump and no notes.
- HIGH: a `## ` line inside a fenced code block in the Unreleased body
  truncates promotion mid-body (`sectionEnd` is fence-blind).
- MEDIUM (convergent): an Unreleased body of empty scaffold headings
  (`### Added`, no bullets) promotes and reports `section_empty:false` -
  empty-in-substance notes ship and the scaffold is consumed.
- MEDIUM: absent `CHANGELOG.md` -> `changelog:{changed:false}` with no
  distinct signal; the milestone cannot tell "no changelog surface" from a
  clean run.
- LOW (verified): an in-body link-ref definition contiguous with the trailing
  ref block stays under the stub after promotion; refs resolve file-wide, so
  cosmetic.
- LOW: the seam header's verdict-code list names 4 of the 7 lib codes;
  `--version v` refuses with `target:""` under `no-target-version` rather
  than a cleaner shape.

Other:

- `review.triggers.diff.gate="adjudicated"` is back in a config layer despite
  the 2026-08-01 CAPTURE decision that the gate stays `blocking`
  (`route.mjs resolve` warns the config wins) - find the layer, remove or
  re-decide.
- `milestone.md` sits at exactly its budget again (8002/8002); the next prose
  edit there must move `weight-budgets.json` in the same commit.
- The sibling-refusal arm remains fixture-exercised only (`marketplace.json`
  carries no `version` field); if one appears, D-08's record-without-abort
  choice needs revisiting.
- Accepted cost (recorded in PLAN Notes, reconfirmed by two diff reviewers):
  a `--version` naming an already-published release is indistinguishable
  inside the seam from a legitimate re-run and will promote into the published
  section; the guard is the milestone workflow confirming the version with
  the user (D-13 declines the cross-check).

## Goal check

The three failures the goal names are closed at the seam: a downgrade refuses
(`decideManifestBump` arm 6, pinned by AC1 tests that failed against
pre-phase HEAD with `actual: 'bump', expected: 'refuse'`), staged Unreleased
content is promoted into the dated heading (`promoteUnreleased`,
`release-decision.mjs`, with re-run and new-content-re-run seam tests), and
the prose derivation is gone (`grep -n "PROJECT\.md\|ROADMAP" release-*.mjs`
returns nothing; the no-`--version` run refuses while the fixture's
`### Active` still names a version - the test that fails against HEAD).
The full gate held: 1067/1067 tests (baseline 1027), `tsc -p tsconfig.ci.json`
exit 0, `self-verify` `ok:true` with empty `problems`, budgets regenerated in
the same commit as the milestone.md edit. What the phase did NOT deliver, per
the review: the `skip/no-version-field` path and an absent `CHANGELOG.md`
still exit 0 with nothing said (open items above), so "cannot lie" holds for
the refusal paths this phase defined but not yet for those two
degenerate-manifest shapes.
