---
phase: 4
status: complete
completed: 2026-08-19
---

# Phase 4: One argument contract instead of nine - Summary

Every seam CLI's argument refusals now come from one declarative table in
`cadence-core/bin/lib/arg-contract.mjs` - 16 scripts, 77 subcommand rows, 144
flag entries, each declaring `required`, `type`, `value` and `bare` - and
`self-verify.mjs` checks documented invocations against that same table, so a
flag with no row is a flag no prose may spell.

## What shipped

- The declarative contract and its evaluator - `cadence-core/bin/lib/arg-contract.mjs`
  (763 lines), with `evaluateFlag` returning one flat `{ok, value, detail}` and
  `requireFlag` throwing for the seams that own an `e.seam` catch arm
- One table, not two - `self-verify.mjs`'s `CONTRACTS` moved into that module and
  is read back from it; `grep -c "const CONTRACTS = {"` on `self-verify.mjs` is 0
- The four never-migrated parsers adopted - `planning.mjs`, `route.mjs`,
  `review-provider.mjs`, `config.mjs`, closing the flag-swallow in the middle two
  and phase 2's `--dir` gap in the first
- The eight `lib/seam-input.mjs` bins re-declared - `git-branch`, `git-publish`,
  `land-cleanup`, `worktree-base`, `issue-check`, `weight`, `release-bump`, and
  `optionalFlag` collapsed into the contract's `fallback` disposition rather than
  surviving as a second reader
- `trace append --role` moved from silent-drop to refuse, killing the empty-string
  aggregation key `trace render` was producing
- The rule stated once in prose - `cadence-core/references/conventions.md:76-111`,
  a `## Seam arguments` section, with `weight-budgets.json` re-pinned 12082 -> 14556
  against a measured figure

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 67e6593 | The declarative contract module and its evaluator |
| 1 | 2 | c4f34a6 | `CONTRACTS` moves into the module, self-verify reads it back |
| 1 | 3 | e0a19c8 | Every row gains its value grammar |
| 1 | 4 | 983c143 | self-verify reads its own `--root` through its declared row |
| 2 | 1 | c1eecd5 | `planning.mjs --dir` refuses the empty, bare and flag-shaped spellings |
| 2 | 2 | 2306cfa | The trace body's bare-flag dispositions come from the declaration |
| 2 | 3 | 1599223 | `route.mjs` stops swallowing the next flag as a value |
| 2 | 4 | cb7da4f | A malformed `--phase` warns and still resolves |
| 2 | 5 | 9641b9e | `review-provider.mjs` stops swallowing the next flag as a value |
| 2 | 6 | 1cd36c9 | `config.mjs` reads `--file` through its declared row |
| 3 | 1 | 1963c8e | The four `--dir` seams read their flags through declared rows |
| 3 | 2 | 6bd11ea | `issue-check` and `weight` read their flags through declared rows |
| 3 | 3 | df718c6 | `release-bump` declares `--date` and its presence probe goes |
| 3 | 4 | 2351d5f | `optionalFlag` collapses into the fallback disposition |
| 4 | 1 | 6985052 | State the argument contract once in `conventions.md` |

15 commits, `953bf52..6985052`.

## Deviations

- [deviation] (plan 1, e0a19c8) Task 3 required every disposition to reproduce
  shipped behavior. For ~12 value-carrying string flags on `planning.mjs`
  (`--name`, `--sources`, `--reason`, `--reported`, `--severity`, `--cause`,
  `--fix`, `--evidence`) that was not expressible: a bare spelling minted the
  boolean `true` at `parseArgs` and the seam WROTE IT THROUGH - `Name: true` into
  STATE.md, `sources: true` into a UAT front-matter - which is neither refuse,
  warn nor fallback. Declared `refuse`, the same disposition the plan mandates
  for `--dir`/`--root`/`--role`.
- [deviation] (plan 3, 1963c8e) STRUCTURAL CHECKPOINT, user-resolved. Reading
  `--branch` through its declared `fallback` row made
  `git-publish reap --dir <d> --branch --force` refuse `no-branch` where
  `git-publish.test.mjs:224-231` pinned `bad-branch`. The user ruled the earlier
  refusal stands and widened plan 3's lease to that file. Safety property
  unchanged and asserted: `ok:false`, exit 1, no argv built, branch still present,
  nothing deleted; `publish-decision.test.mjs:253-261` still tests SAFE_BRANCH at
  the core, green.
- [deviation] (plan 2, 2306cfa) STRUCTURAL CHECKPOINT, user-resolved. Moving
  `--role` to refuse reversed the guarantee at `trace.test.mjs:640`, outside the
  lease. The user ruled the move stands and widened plan 2's lease; the assertion
  was rewritten to pin the refusal, plus a new row pinning the fallback half so
  the two dispositions cannot collapse into each other.
- [deviation] (plan 3, 1963c8e/6bd11ea) The plan asserted no subcommand's output
  changes. Three spellings do, all because `fallback` means "reads as absent"
  where the permissive reader consumed the next token positionally:
  `git-branch decide --branch --dir <p>` answered `branch:"--dir"` and now answers
  the derived branch; `land-cleanup cleanup --dir <p> --base ''` answered
  `base:""` and now `base:"main"`; `issue-check check --base --dir <p>` answered a
  log-failed skip and now answers as the same call without `--base`. The other 60
  rows of the before/after matrix are byte-identical.
- [deviation] (plan 3, df718c6) `release-bump bump --version "   "` moved from
  `no-target-version` to `missing-flag-value`, and `bump --version --dir <p>` /
  `--version --date <d>` from `unparseable-version` to `no-target-version`. Both
  still refuse, exit 1 and write nothing; only the reason code moved, to one this
  file already publishes for `--dir`. 15 of 18 measured spellings byte-identical.
- [deviation] (plan 4, 6985052) The first draft of the conventions section broke
  the suite by its own prose: `trace.test.mjs:1599`'s producer census reads any
  line naming both `planning.mjs` and `trace append` as a real invocation, and the
  draft put them on one line. The plan anticipated only self-verify check 2 as the
  prose-lint hazard. Reworded onto separate lines; 2373/2373 green.

## Open items

- `config.mjs`'s `get` row declares no `--global`, though `config.mjs get <key>
  --global` works and is exercised. Nothing is red because no prose invocation
  spells that pair.
- The `optionalFlag` collapse costs census coverage: `helper-census.test.mjs` can
  no longer catch a hand-written positional flag reader pasted into a bin under a
  new name. What refuses it now is the declaration requirement, which self-verify
  enforces only for flags prose actually spells.
- `release-bump.test.mjs:424-428` still names `optionalFlag` in a comment. It is
  historical narrative, and the file was outside plan 3's lease.
- `--dir "   "` (whitespace-only) now refuses `missing-flag-value` at four seams
  instead of reaching git with a blank path - the shared `string` type's trim
  clause arriving from the declaration.
- No lint command exists for this repo (`workflow.lint_command` is null).
  `npx tsc -p tsconfig.ci.json` is the whole static-analysis surface, exit 0.

## Goal check

The phase delivers its goal. The refusals are expressed once:
`cadence-core/bin/lib/arg-contract.mjs` is 763 lines carrying 16 scripts / 77
subcommand rows / 144 flag entries, and twelve non-test bins import it -
`git-branch`, `git-publish`, `issue-check`, `land-cleanup`, `release-bump`,
`planning`, `review-provider`, `route`, `self-verify`, `worktree-base`, `weight`,
`config` - which is the four remaining parsers plus the eight seams D-01 named.
`optionalFlag` no longer exists in source (`grep -rn optionalFlag cadence-core/bin`
returns two comment lines, both narrating the collapse), so the second reader that
answered differently for a valueless flag is gone rather than merely deprecated.
`node cadence-core/bin/test.mjs` reports 2373 tests, 2373 pass, 0 fail;
`node cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`
across 25 checks. The "a tenth seam inherits the rules" half is enforced and not
merely documented: plan 1 recorded the falsifier - deleting `--phase` from the
`plan-overlap` row makes self-verify report `unknown-flag` against
`cadence-core/workflows/execute.md` - and `references/conventions.md:76-111` states
the vocabulary and the one declaration home. What is honestly weaker than the goal
sentence implies: that enforcement reaches a new seam only through flags some
workflow prose spells, and the `optionalFlag` collapse removed the census row that
used to catch a hand-copied positional reader, so a new bin that parses its own
argv and is never documented inherits nothing automatically. `config.mjs get
--global` is a live example of a working invocation with no row. The
`risk_surface` gate fired once, on plan 2's `untrusted_input` match; the
cross-model reviewer raised one `high` against `config.mjs:356`, and adjudication
killed it - `cmd` is bound at module scope on `config.mjs:329`, and `get --file
.planning/config.json stakes` and `validate --file .planning/config.json` both
return `ok:true` live. Zero survivors, gate PASS.
