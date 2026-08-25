PLAN CHECKPOINT: structural
Plan: .planning/phases/4/PLAN-1.md
Tasks: 0 of 8

| Task | Commit | Note |
|---|---|---|
| 1 - Extract the shared core module | none | Implemented, NOT committed. `cadence-core/bin/planning/core.mjs` holds all 28 named symbols, `planning.mjs` imports the 20 it still uses, 32 handlers still declared there. `tsc -p tsconfig.ci.json` exits 0, `self-verify` prints `"problems":[]` across all 26 checks, `criteria-coverage` reports `version.plugin` `3.7.0` (matches `.claude-plugin/plugin.json`, so `HERE` did not slip a level). Suite is `pass 3069, fail 2` - both failures are in files this plan does not lease. |

Deviations: see below.
Open items: see below.

## Why this stopped

Task 1's `Verify:` asks for `fail 0`. It cannot be reached inside this plan's
`files:` lease. Two tests outside the lease assert over what task 1 moves:

1. `cadence-core/bin/trace.test.mjs:2425` - "the four refusing trace flags carry
   ONE sentence each, in one map" reads `planning.mjs`'s source bytes and
   requires each of four sentences to appear exactly once. `FLAG_SENTENCES` is
   in task 1's own core list, so after the move `planning.mjs` holds 0 of them.
   Observed: `"needs a role name after it" is written 0 times in planning.mjs`,
   actual 0, expected 1.

2. `cadence-core/bin/self-verify.test.mjs:1622` - "check 12: the live tree is
   SIXTEEN callsites over TEN files" walks `cadence-core/bin/**` counting
   `mergeLayers` callsites independently of the rule. `memoryBackend` carries one
   of them and is in task 1's core list, so the FILE count moves 10 -> 11 while
   the callsite total stays 16. Observed: actual 11, expected 10. By task 8 it
   becomes 12 - `planning.mjs` drops out and `planning/trace.mjs` and
   `planning/risk-check.mjs` join, per PLAN-1 D-11.

Neither file can be worked around: both read the seam's source, and the two
symbols are named in task 1's Action.

## What is needed

Add these two paths to PLAN-1.md's `files:` lease:

- `cadence-core/bin/trace.test.mjs`
- `cadence-core/bin/self-verify.test.mjs`

The intended edits, both preserving the claim rather than weakening it:

- `trace.test.mjs`: read `planning.mjs` PLUS every `planning/*.mjs` and keep the
  "exactly once" assertion. Pointing it at `planning/core.mjs` alone would stop
  seeing a second copy pasted into a command module, which is the drift the row
  exists to catch.
- `self-verify.test.mjs`: `total === 16` is unchanged and stays; only
  `files.length` and the test's title move (10 -> 12 at the end of the plan, 11
  after task 1 alone). The arm-(a)/arm-(b) assertion per callsite is untouched,
  so the check still proves every callsite chose an arm.

This creates no new plan intersection: PLAN-2 declares `planning.test.mjs`, the
22 new `planning-*.test.mjs` stems and `test.mjs`; PLAN-3 declares
`citation-census.test.mjs`, `REQUIREMENTS.md`, `DOCS-CLAIMS.md`,
`cad-verifier-contract/SKILL.md` and `READ-COST.md`. Neither names either file.

## Tree state

Task 1's implementation is applied to the working tree and NOT committed. On
disk right now:

- `cadence-core/bin/planning/core.mjs` - new, 28 exported symbols, bodies moved
  verbatim. The one edited body is `HERE`, which is
  `resolvePath(dirname(fileURLToPath(import.meta.url)), '..')` so it still names
  `cadence-core/bin`; the `'..'` segments at `MANIFEST_PATH` and `routeLadder`
  are untouched, per D-03.
- `cadence-core/bin/planning.mjs` - 7,117 lines, imports the core symbols it
  still uses, all 32 handlers still declared.
- `cadence-core/bin/planning.test.mjs` - the detail-site census now reads the
  whole seam (`planning.mjs` plus `planning/*.mjs`) through a new `seamSource()`
  helper; the 14 / 6 counts and the `redactUrl` match are unchanged.
- `cadence-core/bin/helper-census.test.mjs` - the `readText` row's note now says
  `planning/core.mjs's read()`.

A continuation dispatch should confirm with `git status --short` before
re-running task 1; the extraction is not idempotent.

## Deviations

- [deviation] CONTEXT D-10 asserts that THREE assertions in other test files read
  `planning.mjs`'s source bytes. The tree carries six, across four files. The two
  in `prose-agreement.test.mjs` that D-10 names are leased and are tasks 4 and 6.
  The four it does not name: `planning.test.mjs`'s detail-site census (leased -
  repointed at the whole seam in this dispatch, since task 1 breaks it),
  `planning.test.mjs`'s two renumber rows (leased, task 8's, already named in the
  plan body), `trace.test.mjs`'s sentence census and `self-verify.test.mjs`'s
  check-12 count (both unleased - the reason for this checkpoint).
- [deviation] The plan's task-1 Verify predicts a clean suite. Observed three
  failures, one of which was fixable inside the lease and two of which were not.

## Open items

- `cadence-core/bin/skim.test.mjs:99` ("every shipped .mjs skims without losing a
  line") walks `bin/` and `bin/lib/` only, so the 29 modules this plan creates
  under `bin/planning/` fall outside it. Nothing fails; the coverage simply does
  not reach the new directory. The file is outside this plan's lease.
- `cadence-core/bin/planning.mjs` carried one dead import, `sectionBound` from
  `lib/planning-files.mjs`, named only inside a comment. The import-pruning pass
  dropped it. Noted rather than defended: it is a deletion the split caused, not
  a behaviour change.
- PLAN-1 D-06 and task 1 disagree about `DISPATCH_WINDOW_DEFAULTS`. CONTEXT D-06
  calls it "genuinely shared"; measured over comment-stripped source its only
  reader is `cmdTrace`. Task 1's Action names it in the core list, so it went to
  `core.mjs` as written. It costs nothing against AC1 (it is not in the entry
  file either way) and can move into `planning/trace.mjs` at task 6 if the
  by-use rule is meant to win.
