---
phase: 3
status: complete
completed: 2026-08-27
---

# Phase 3: Stop the risk detector tripping on the review record - Summary

`risk-check run` now withholds the four stored-reviewer-text artifacts under
`.planning/phases/` from the range it reads, so landing an adjudication record
that quotes a destructive command no longer re-trips the gate that produced it.

## What shipped

- `REVIEWER_TEXT_PATHSPECS` - a frozen, exported four-entry constant of
  `:(top,exclude)` pathspecs appended after the `git diff` `--`, in
  `cadence-core/bin/planning/risk-check.mjs`. `lib/risk-diff.mjs` is untouched:
  the withholding is by PATH, so every category and signal still fires as before.
- Failing-capable coverage in `cadence-core/bin/risk-diff.test.mjs` - two rows
  proving the clear AND that detection survives it, four rows on real withheld
  filenames, a `PLAN.md` boundary row that still trips `destructive`, and an
  iterating row deriving its count on both sides so a fifth entry needs no test
  edit.
- The trigger contract in `cadence-core/references/risk-surface.md` states what
  the range read withholds, why (the byte-for-byte storage requirement in
  `references/review-record.md`), where the boundary is (`PLAN.md` is not
  withheld) and that detection itself is unchanged. Budget re-pinned in
  `cadence-core/bin/weight-budgets.json`, 9785 -> 10768.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 0d049527 | fix: withhold the four stored-reviewer-text artifacts from the range the gate reads |
| 1 | 2 | 82c963f6 | test: redden the pre-fix tree with the clear and with detection surviving it |
| 1 | 3 | d724f613 | test: cover every withheld shape, and prove a plan file is not one |
| 1 | 4 | 31e053fa | docs: the trigger contract states what the range read withholds |

## Deviations

None - plans executed as written.

## Open items

- No lint command exists for this root (`detect-commands` reports `lint: null`),
  so `npx tsc -p tsconfig.ci.json` was the whole static-analysis step for this
  phase.
- Pre-existing flake, unrelated to this phase: the first full
  `node cadence-core/bin/test.mjs` of the continuation dispatch reported 1 fail
  at `self-verify.test.mjs:878` with `SyntaxError: Unexpected end of JSON input`
  from the file's `run()` helper - the spawned `self-verify.mjs` returned empty
  stdout, not a wrong verdict. In isolation: 177 pass, 0 fail. Re-run of the full
  suite: 3483 pass, 0 fail. The failure mode is subprocess output under parallel
  load.
- `DEFERRED-<trigger>-<discriminator>.json` stores the same kind of verbatim
  reviewer text and will trip the destructive category for the identical reason.
  D-02 names four artifacts, so it was deliberately left out of this phase.
  Adding it is one entry in `REVIEWER_TEXT_PATHSPECS`; task 3's iterating row
  already covers it with no test edit.
- The continuation dispatch deliberately did not rotate the prior run's report:
  rows 1-3 are carried into `reports/plan-1.md` verbatim, so a rotated sibling
  would be a strict subset and would make `report.md`'s `plan-*.md` glob list the
  same run twice.

## Goal check

The four commits deliver the phase goal. The defect was
`planning/risk-check.mjs` calling the diff scan with no path exclusion, and
`0d049527` closes it at exactly that call site by appending four
`:(top,exclude)` pathspecs (ROADMAP criterion 1). Criterion 2 - that the
exclusion buys no quiet - is the load-bearing one, and it is proved rather than
asserted: with task 1's spread argument removed, both of `82c963f6`'s rows fail
(93 pass / 2 fail), one on `matches` and one on `signal`, and `d724f613`'s
`PLAN.md` boundary row still trips `['destructive']` under the fix. Criterion 3
is confirmed on real history, not a fixture: `risk-check run --base f70a0443
--head cf2571b8` - the range an earlier cycle's phase 1 settled with an override
- now answers `checked:true, matches:[], inconclusive:false, empty:false`.
Criterion 4 holds: `node cadence-core/bin/self-verify.mjs` reports `ok:true`, and
`node cadence-core/bin/test.mjs` reports 3483 tests, 3483 pass, 0 fail. The
`risk_surface` gate over this phase's own committed range
(`fbb46e7a..31e053fa`) returned `matches:[]` with `empty:false`. One honest gap,
already an open item above: `DEFERRED-*.json` carries the same verbatim reviewer
text and is still exposed to the defect this phase fixed - out of scope by D-02,
not overlooked.
