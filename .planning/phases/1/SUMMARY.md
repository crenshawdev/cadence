---
phase: 1
status: complete
completed: 2026-08-22
---

# Phase 1: The close that continues over a manifest nobody bumped - Summary

Six release/changelog defects closed in `lib/release-decision.mjs` and
`release-bump.mjs`: the changelog core now decides section bounds, emptiness and
the trailing link-reference block from the document's real structure, and the
seam refuses - rather than skipping or succeeding - on a version-less primary
manifest and an unparseable `--version`.

## What shipped

- Fence-aware `## ` heading scans across `sectionEnd`, all four
  `prependChangelogEntry` anchors, `promoteUnreleased`'s locators and
  `releaseSectionEmpty` - `cadence-core/bin/lib/release-decision.mjs`
- Heading-only release sections report empty; a prose-only body does not -
  `cadence-core/bin/lib/release-decision.mjs`
- Trailing link-reference block bounded by whether a key names an existing
  `## [key]` heading - `cadence-core/bin/lib/release-decision.mjs`
- `decideManifestBump`'s JSDoc names all nine codes the seam owns -
  `cadence-core/bin/lib/release-decision.mjs:160-186`
- A primary manifest with no `version` field halts the close: `ok:false`,
  `action:"refuse"`, `reason:"no-version-field"`, exit 1 -
  `cadence-core/bin/release-bump.mjs`
- `changelog.state` (`not-examined` / `absent` / `unreadable` / `ok`) set on
  every emitting envelope - `cadence-core/bin/release-bump.mjs`
- An unparseable `--version` refuses naming the raw argument instead of
  `no-target-version` over an empty target - `cadence-core/bin/release-bump.mjs`
- A test that derives the verdict-code set from executable source and reddens
  when a code misses either document -
  `cadence-core/bin/prose-agreement.test.mjs`
- `milestone.md` step 2 halts on `no-version-field` and names
  `changelog.state: "absent"` beside `section_empty: true` -
  `cadence-core/workflows/milestone.md:68,84-89`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 73aa7bba | Fence-aware heading scans in release-decision.mjs |
| 1 | 2 | c68f0a71 | Report a heading-only release section as empty |
| 1 | 3 | 57f3421e | Bound the trailing link-reference block by heading keys |
| 1 | 4 | b6b4b9e1 | Name all nine seam codes in decideManifestBump's JSDoc |
| 2 | 1 | e59e80b2 | Refuse a primary manifest that carries no version field |
| 2 | 2 | 889ec6b7 | Name the changelog's state explicitly on every envelope |
| 2 | 3 | 6fb980cc | Refuse an unparseable --version by naming the raw argument |
| 2 | 4 | 5838f100 | Redden when a verdict code never reaches the two documents |
| 2 | 5 | 4b4d0e16 | Halt the close on the two states the seam now names |

Plus each plan's `docs(1-k): plan k executor report` commits and the merge
`051f0df1`. Phase range: `6b0d6c13..051f0df1`.

## Deviations

None - plans executed as written.

## Open items

- `MILESTONE-07`'s line range in `.planning/DOCS-CLAIMS.md` was shifted by task
  5's own edit and corrected to 78-83 in the same commit, though the plan named
  only rows 06 and 08. Staleness the task caused, not scope widening.
- No static-analysis command exists for this tree: `planning.mjs
  detect-commands --root .` returns `lint:null, typecheck:null`, so
  `release-bump.mjs`'s `// @ts-check` annotations are unchecked here and
  `tsconfig.ci.json` excludes `*.test.mjs`.
- No `changelog.state` assertion pins the `unreadable-changelog` and
  `partial-bump` envelopes; both set the field from the same three-value
  vocabulary at their emit sites. Pin them when a fourth distinguishing consumer
  exists.
- `.planning/DOCS-CLAIMS.md` rows `MILESTONE-04` (cites 41-42) and
  `MILESTONE-05` (cites 43-45) are stale against `milestone.md`'s current line
  numbers. Pre-existing; D-14 records that no mechanical check enforces those
  ranges.

## Goal check

The commits plausibly deliver the goal. Both halves of "stops returning success,
or a benign `skip`, over inputs it did not actually handle" are verified by
execution on the merged tree, not by report: a manifest carrying no `version`
now returns `{"ok":false,"action":"refuse","reason":"no-version-field",...}` at
exit 1 with `changelog.state:"not-examined"` (run against a scratch fixture
holding only `.claude-plugin/plugin.json` and a CHANGELOG), where it previously
skipped clean; and `bump --version v` returns
`reason:"unparseable-version", target:"v"` naming the raw argument rather than
`no-target-version` over an empty target. The changelog core's structural
decisions are carried by committed guard tests rather than by prose -
`release-decision.test.mjs` is 48/48 green including the fence-contiguity case,
the scaffold-then-promote compose case (D-09), the prose-only
`sectionEmpty:false` case (D-03) and both link-reference cases. The two plans'
one real interaction - plan 2's `prose-agreement.test.mjs` reading the JSDoc plan
1 rewrote - holds after the merge: the full suite is 2655 pass / 0 fail / 1
skipped and `self-verify.mjs --root .` returns `ok:true` with `problems:[]`.
`milestone.md`'s halt list, the single caller the goal names, changed with the
seam (`milestone.md:68` and `:84-89`) and its weight budget was re-pinned in the
same commit. Nothing in the goal looks unaddressed. The honest gap is that no
type-checker ran over `release-bump.mjs`'s `@ts-check` annotations in this
environment, and that two `DOCS-CLAIMS.md` rows outside this phase's scope
remain stale - both filed as open items rather than fixed.
