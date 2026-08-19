---
phase: 4
status: complete
completed: 2026-08-19
---

# Phase 4: One argument contract instead of nine - Summary

Every seam CLI's argument refusals now come from one declarative table in
`cadence-core/bin/lib/arg-contract.mjs` - 16 scripts, 77 subcommand rows, 145
flag entries, each declaring `required`, `type`, `value` and `bare` - and
`self-verify.mjs` checks documented invocations against that same table, so a
flag with no row is a flag no prose may spell. Plan 5 closed the gap the phase's
own UAT found: the table stated 145 rules and `planning.mjs` read two of them, so
231 declared refusals are now walked against the shipped binaries by a census
that reddens when a row goes unread.

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
- The rule stated once in prose - `cadence-core/references/conventions.md`, a
  `## Seam arguments` section, with `weight-budgets.json` re-pinned twice against
  measured figures (12082 -> 14556 -> 15791)
- The row door - `evaluateRow` and `subcommandKey` in the shared module, wired at
  `planning.mjs`'s dispatch ahead of `COMMANDS[cmd]`, so the whole resolved row is
  judged in one place instead of at the two sites the bin consulted before
- The adoption census - `cadence-core/bin/arg-contract-adoption.test.mjs` spawns
  the owning script for all 231 declared refusals across 145 entries, in two
  passes: the flag as its only occurrence, and the same refusal preceded by a
  well-formed occurrence of the same flag
- `config.mjs get --global` declared and read off its row, closing this phase's
  own open item about a working invocation with no row
- The door judges EVERY occurrence of a flag, not the first - the `risk_surface`
  gate's finding on plan 5's range, fixed in `c32be66`

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
| 5 | 1 | ddf2f6f | The row door, and one home for the subcommand key |
| 5 | 2 | dafa18d | `planning.mjs` gates every declared row at its dispatch |
| 5 | 3 | 5d3143a | One flag->sentence map, read by the door and by the trace body |
| 5 | 4 | 7269cc6 | The adoption census - every declared refusal, against the shipped CLI |
| 5 | 5 | a4ee0d2 | `config.mjs get` declares `--global` and reads it off that row |
| 5 | 6 | 763cf23 | The header and the prose state the reach that shipped |
| 5 | gate | c32be66 | The door judges every occurrence of a flag, not the first |

22 commits, `953bf52..c32be66`. The last is the `risk_surface` fix pass, not a
plan task: it carries plan 5's scope because it is a second landing on plan 5's
own range.

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
- [deviation] (plan 5, 5d3143a) The plan's Context put re-dispositioning any flag
  row out of scope, and `--tokens` made that unachievable: its declared
  `int`/`refuse` row is NARROWER than the shipped body grammar, which accepts a
  comma-grouped integer (`146,405`, the form this plugin prints token figures in)
  and refuses a negative one. Under `refuse` the door rejected `146,405` after the
  `dispatch` half of the bracket was already written, stranding the worker unpaired
  forever - two `trace.test.mjs` failures. Re-dispositioned `--tokens` to
  `value: 'fallback'` on both trace rows, bare axis unchanged.

## Open items

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
- A repeated flag whose LATER occurrence takes the `fallback` disposition is
  discarded when an earlier one parsed cleanly: only a `warn` result overrides the
  first, so `evaluateFlag(['--timeout-ms','1','--timeout-ms','abc'], ...)` returns
  `1` while a reader keeping the last occurrence sees `abc`. The `risk_surface`
  narrowed round raised this as `medium` and it survives at
  `.planning/phases/4/REVIEW-risk_surface-plan-5.md`. No declared refusal is
  bypassed - all six fallback rows answer with a benign default.
- `uat merge --payload` (bare) now answers `bad-args` naming the flag instead of
  `no-payload`. The "never a read of fd 1" invariant holds and `no-payload` still
  answers a missing, unreadable or empty path; nothing under `workflows/`,
  `references/`, `skills/` or `agents/` branches on which of the two fires.
- A LOOSENED axis is a census skip, not a census failure, so emptying a row's
  `bare` disposition to `fallback` does not redden the adoption walk by itself.
  The three UAT-8 rows are pinned in `arg-contract.test.mjs` to catch that
  direction; every other row is still one-directional.
- `planning.mjs`'s numeric rows approximate in both directions: `int` accepts a
  negative that the trace body then refuses (`--turns`, `--raised`). No behaviour
  changed - the body's wording is identical to the door's - but the rows state
  less than the bins enforce.

## Goal check

The phase delivers its goal, and plan 5 is what made that claim survive contact
with the shipped binaries. The refusals are expressed once:
`cadence-core/bin/lib/arg-contract.mjs` carries 16 scripts / 77 subcommand rows /
145 flag entries (counted through its own `CONTRACTS` and `flagNames` exports),
and twelve non-test bins import it - the four remaining parsers plus the eight
seams D-01 named. `optionalFlag` no longer exists in source. What plans 1-4 could
not establish, and the phase's own UAT item 8 caught, is that a declared rule is a
rule the owning bin APPLIES: the table stated 145 rows and `planning.mjs` read two
of them, so `cursor set --name` (bare) answered `ok:true` and wrote
`Phase: 1 of 5 (true)` into STATE.md against a row saying `refuse`. Plan 5 wired
the whole resolved row at that bin's dispatch (`dafa18d`) and added the census
that walks the table against the real binaries (`7269cc6`), which now reports
`231 declared refusals exercised against the shipped CLI across 145 table
entries`. All three UAT-8 spellings refuse live and leave their file
byte-unchanged - `cursor set --name` -> `cursor set --name needs a value after
it`, `uat init --sources` -> the same sentence for its flag, `uat record
--reason` likewise - and `config.mjs get stakes --global` returns
`{"ok":true,"values":{"stakes":"shipped"},"source":"global"}` off its now-declared
row, closing this phase's own open item. `node cadence-core/bin/test.mjs` reports
2379 tests, 2379 pass, 0 fail; `node cadence-core/bin/self-verify.mjs` returns
`{"ok":true,...,"problems":[]}` across 25 checks.

The `risk_surface` gate fired twice this phase and both fires are worth reading
rather than counting. On plan 2's range the cross-model reviewer raised one `high`
against `config.mjs:356`; adjudication killed it (`cmd` is bound at module scope,
and both cited invocations return `ok:true` live). On plan 5's range it raised a
`high` that adjudication CONFIRMED against the running CLI: the door judged only a
flag's first occurrence while `planning.mjs`'s `parseArgs` keeps the last, so
`cursor set --phase 1 --total 5 --status planned --next /x --name valid --name`
passed on `valid` and wrote `Phase: 1 of 5 (true)` - the exact defect plan 5
existed to close, at a spelling its own census never typed. Fixed in `c32be66`,
the census widened to walk all 231 refusals a second time with a well-formed
occurrence in front, and the capped narrowed round returned one `medium` (a later
`fallback` occurrence losing to a clean earlier one), which is an open item rather
than a blocker: no declared refusal is bypassed by it. Gate PASS.

What is honestly weaker than the goal sentence implies, unchanged by plan 5: the
"a tenth seam inherits the rules" half reaches a new seam only through flags some
workflow prose spells, and the census catches REFUSALS only - a row added later
declaring just `fallback` or `warn` has no refusal arm to exercise, which
`arg-contract-adoption.test.mjs`'s header now states rather than implies. A new
bin that parses its own argv and is never documented still inherits nothing
automatically.
