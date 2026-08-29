---
phase: 2
status: complete
completed: 2026-08-29
---

# Phase 2: a confirmed finding can be recorded unfixed - Summary

`adjudication-record.mjs` now stores a `survived` finding below blocker/high with no
`fix_commit`, and an overridden blocker/high on an explicit `overridden: true` marker,
while the fix-commit requirement and its typo guard still bind at blocker/high.

## What shipped

- Severity-gated `fix_commit` requirement - `cadence-core/bin/lib/adjudication-record.mjs`,
  split into an unconditional VALUE check (presence = key set, never truthiness) and a
  severity-gated PRESENCE requirement, with `HALTING_SEVERITIES` declared here
- `overridden: true` as the second way a `survived` blocker/high satisfies that
  requirement - same file, validated to the boolean alone, with an `overriden` typo row
  beside the existing `fix_comit` one
- An overridden blocker reaches the filing set - `cadence-core/bin/lib/filing-decision.mjs`,
  `unfixedFindings` reads the marker as a third field so an override is filed rather than
  dropped silently
- `issue-filing unfixed` stops offering committed work - `cadence-core/bin/issue-filing.mjs`,
  `cmdUnfixed` removes every entry carrying a `fix_commit` before the forge is touched, and
  accounts for the removal on a new `already_fixed` envelope key
- A survivor carries whether it was fixed - `cadence-core/bin/lib/why-record.mjs`
  (`parseAdjudication` gains the field, fail-soft, no rule) and
  `cadence-core/bin/lib/why-render.mjs` (`findingLines` prints a `fix:` line on every
  survivor - the commit id, or `fix: none - confirmed and left standing`)
- The four prose surfaces state one meaning of `survived` -
  `lib/adjudication-record.mjs`, `lib/filing-decision.mjs`, `references/triage-gate.md`
  and `references/review-record.md`, with `review-record.md` now telling a coordinator how
  to compose both the unfixed case and the override case
- A drift row that reddens when one of those four is edited apart from the others - row
  `RSK-07` in `cadence-core/bin/prose-agreement.test.mjs`, falsified per surface

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | f728176e | Gate the fix-commit requirement on the raised severity |
| 1 | 2 | f6bee0db | Accept an overridden blocker or high on an explicit marker |
| 1 | 3 | 68b7ad31 | Stop the shared payload fixtures encoding the old rule |
| 1 | 4 | fb7a606f | The GH-159 reproduction settles end to end |
| 1 | 5 | 154ef5fb | An overridden fire settles end to end |
| 1 | fix | 3341ffb0 | An overridden blocker reaches the filing set (risk_surface high) |
| 2 | 1 | dda38c4c | `unfixed` stops offering findings whose fix is committed |
| 2 | 2 | 40a63ff4 | A parsed survivor carries whether it was fixed |
| 2 | 3 | 60c80e21 | The review line tells a fixed survivor from an unfixed one |
| 2 | 4 | 128e1381 | The halting pair states the remainder the record now holds |
| 2 | 5 | 0b8af4a1 | `review-record.md` tells a coordinator how to compose both cases |
| 2 | 6 | bef7687d | A drift row reddens when one survived surface is edited alone |

## Deviations

- [deviation] plan 1: CONTEXT D-07 asserts `lib/filing-decision.mjs` keeps its
  "TWO FIELDS DECIDE IT AND NOTHING ELSE" rule; closing the `risk_surface` high required
  that module to read the `overridden` marker, so its header now states THREE fields
  (3341ffb0). D-07's actual subject is unchanged and stated in the comment: `fix_commit`
  still decides nothing there, and the fix-commit filter landed in `cmdUnfixed` as planned.
  The alternative - keying the exclusion on `fix_commit` presence - would have put exactly
  the field D-07 excludes into this decision.
- [deviation] plan 2: Task 3's `Verify:` says 7 `ADJUDICATION-*.json` files exist under
  `.planning/`; `find` returns 8. The eighth is
  `.planning/phases/2/ADJUDICATION-risk_surface-plan-1-r2.json`, written by this phase's
  own plan-1 review after the plan was authored. All 8 read `ok: true` with no issue code,
  so the criterion is met over a larger set than it named (60c80e21).

## Open items

- `references/triage-gate.md:275-281` still enumerates the returned set as excluding
  exactly two things. After plan 2 task 1 a survived `medium` carrying a voluntary
  `fix_commit` is also excluded, and the `RSK-07` drift row pins the meaning of `survived`
  rather than that set statement, so nothing reddens.
- The override case has no consumer in `issue-filing unfixed` beyond reaching the filing
  set: nothing downstream distinguishes an overridden blocker from an ordinary filed entry.
- AC7's second half is narrowed: the corpus check covers the 8 `ADJUDICATION-*.json` on
  disk, not the 3 recoverable from git history alone - the oldest writer shapes, so the
  ones most likely to differ, are read by no test.
- `counter_evidence` disagrees across the writer and the reader.
  `lib/adjudication-record.mjs:425-441` requires an OBJECT (`{file, line?, note?}`), while
  `lib/why-record.mjs:524` reads it through the `str` helper, which answers on a string.
  Found while composing this phase's own `risk_surface` record; not in any plan's scope.
- `workflow.lint_command` is null and `detect-commands` resolves no lint command for this
  repo. `npx tsc -p tsconfig.ci.json` is the only static analysis available and ran clean
  after every task.
- Two `medium` findings from plan 1's `risk_surface` round are confirmed and unfixed, both
  filed on `crenshawdev/cadence` (`ca1fbd834199dfcb`, `dd09d6a6113e9112`): the
  `fix_commit` VALUE check is still scoped inside the `survived` branch, so a `downgraded`
  or `refuted` ruling stores an arbitrary unspendable string; and `overridden: true` is an
  unverifiable self-assertion with nothing requiring the corresponding `override` receipt.

## Goal check

The twelve commits deliver the goal. The storable state the roadmap names exists and is
demonstrated on this repository's own record rather than only in tests:
`.planning/phases/2/ADJUDICATION-risk_surface-plan-1-r2.json`, written by this phase's own
blocking gate over its own code, holds two `survived`/`medium` entries with no
`fix_commit` key at all - exactly the shape GH-159 was refused on - beside a
`survived`/`high` that still names its commit. The typo guard the requirement exists for is
intact: `FIX_COMMIT = /^[0-9a-fA-F]{7,40}$/` at `lib/adjudication-record.mjs:162` is
enforced unconditionally wherever the key is SET (`:450-453`), so a misspelled or
unspendable value is still refused at any severity, and `RULING_KEYS` (`:213`) still
refuses `fix_comit` and now `overriden`. The four prose surfaces agree and the `RSK-07`
row in `prose-agreement.test.mjs` was falsified per surface - four mutations, four red
runs, four reverts (bef7687d). Full suite 3552 pass / 0 fail; `self-verify.mjs` reports
`problems: []`. What is NOT closed, and is an open item rather than a gap in the goal: the
override marker is storable and now reaches the filing set, but nothing downstream treats
it differently from an ordinary entry, and the `fix_commit` VALUE check's scope inside the
`survived` branch leaves `downgraded` and `refuted` free to store an unspendable string -
both filed as issues rather than fixed here.
