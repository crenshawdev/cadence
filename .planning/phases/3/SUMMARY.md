---
phase: 3
status: complete
completed: 2026-08-14
---

# Phase 3: The scan's correctness gaps close - Summary

`git.protected_branches` string form is honored by all four readers through one
shared coercion (`lib/protected-branches.mjs`), the `## Phases` / `## Active`
scanners skip fenced examples (`sectionSpan` + fence-aware walks), blank
`--root` is refused by both detect commands, and the four copied helpers now
live once in `lib/` pinned by a body-idiom census test.

## What shipped

- One protected-branch coercion for all four readers - `cadence-core/bin/lib/protected-branches.mjs`, consumed by git-guard, git-publish, git-branch, land-cleanup; string form honored everywhere, `[]` stays "nothing protected"
- One home for the seam argv/file readers - `cadence-core/bin/lib/seam-input.mjs` (`optionalFlag`, `flagValue`, `''`-on-failure `readText`), imported by seven bins
- One current-branch reader - `cadence-core/bin/lib/git-head.mjs` (`readCurrentBranch`)
- Helper-definition census - `cadence-core/bin/helper-census.test.mjs`, reddens on any re-copy of the four helpers under `cadence-core/bin/`
- Fence-aware section scanners - `parseRoadmapPhases`, `classifyPhaseList`, `classifyActiveSection` in `cadence-core/bin/lib/planning-files.mjs` read the real section, not a fenced example; shipped templates now classify `no-section` / `ids: null`
- Blank `--root` refusal - `planning.mjs` `detect-commands` / `detect-surfaces` return `{"ok":false,"reason":"bad-args"}` on empty/whitespace roots, byte-matching `debt-harvest`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 0342204 | One protected-branch coercion; git-guard and git-publish consume it |
| 1 | 2 | 9b45035 | git-branch and land-cleanup honor a string protected_branches |
| 1 | 3 | 8338b6a | `lib/seam-input.mjs`: shared argv and file input readers |
| 1 | 4 | 52b1935 | Five bins import the flag and file readers |
| 1 | 5 | 8b2aedd | weight and self-verify import the throwing flag reader |
| 1 | 6 | 3d1beb2 | `lib/git-head.mjs`: one reader of the repo's current branch |
| 1 | 7 | fcaee97 | Tree-wide helper-definition census that reddens on a re-copy |
| 2 | 1 | 74c8dcc | `## Phases` scanners read the real section, not a fenced example |
| 2 | 2 | 47eab72 | `## Active` scanner reads the real section, not a fenced example |
| 2 | 3 | 79346fc | detect-commands and detect-surfaces refuse a blank `--root` |

Plus per-plan executor report commits `8dd0093`, `55f99e4` and merge `60a7d39`
(parallel worktree path; plan ranges `860eac1..8dd0093` and `8dd0093..60a7d39`).

## Deviations

None - both plans executed as written (0 deviations reported). Two declined
alternatives recorded by the executors: no second name-based census rule
(body idiom already catches a paste-back under any name), and no
`sectionSpan`-shaped rewrite of the roadmap write paths (D-02 keeps them
fence-blind this phase).

## Open items

- `resolveProtectedBranches` coerces a string `""` to `[""]`, silently
  unprotecting everything (pre-existing: git-guard and git-publish had the
  identical arm before this phase; risk_surface review raised it, adjudicated
  pre-existing-to-range). Decide: warn or fall to default on `""`.
- land-cleanup `base` is `undefined` under `protected_branches: []` with no
  `git.base_branch` and no `--base` (pre-existing pass-through; raised by the
  same review) - the merged-branches query degrades and a merged branch is not
  reaped.
- `sectionSpan` matches a heading by trimmed equality, so a four-space-indented
  `## Active` / `## Phases` (CommonMark indented code) can shadow the real
  section below it - the one risk_surface survivor (medium), introduced this
  range; the old matcher was column-0 anchored.
- `planning.mjs:130-132` `read()` is a third file-reader contract (null on any
  failure, no `isFile()` guard) - named in the census message, pinned by
  nothing.
- `git.protected_branches` as a string still fails `config.mjs validate`
  (`array_string`) while all four readers honor it (D-08 accepted this phase).
- Roadmap WRITE paths stay fence-blind (`setPhaseBox`, `cutPhaseDetail`,
  `cmdRenumber`) per D-02 - reader/writer divergence now costs one call site to
  close.

## Goal check

The phase goal - the config key the guard honors and land ignores, the
fence-blind section scanners, and the copied helpers that already drifted - is
delivered by the ten task commits above. Criterion 1: all four readers consume
`resolveProtectedBranches` (0342204, 9b45035), each with a string-form test in
its own test file (git-guard.test.mjs, git-publish.test.mjs,
git-branch.test.mjs, land-cleanup.test.mjs per the plan-1 report). Criterion 2:
the shipped templates now classify `no-section` / `{ids:null}` instead of
phantom `[Name]` phases and `[CAT]-` ids, with 6 regression tests measured
red-on-pre-fix (74c8dcc, 47eab72). Criterion 3: all four blank/whitespace
`--root` spellings return `bad-args` matching debt-harvest (79346fc).
Criterion 4: `helper-census.test.mjs` (fcaee97) pins the four helpers at one
definition each, falsified with two probe files during execution. On the merged
tree (60a7d39) `node --test cadence-core/bin/*.test.mjs` reports fail 0 and
`node cadence-core/bin/self-verify.mjs` returns `problems: []` - the
integrated run the per-worktree reports still owed. Gap named honestly: the
fence fix widened heading matching to trimmed equality (risk_surface survivor
above), an edge the old anchored regex rejected.
