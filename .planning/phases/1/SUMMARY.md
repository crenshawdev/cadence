---
phase: 1
status: complete
completed: 2026-08-29
---

# Phase 1: The record's guards hold for every ruling - Summary

`fix_commit` is now validated wherever the key is set on any ruling rather than only under
`ruling === 'survived'`, and `overridden: true` no longer discharges `trace append`'s strongest
refusal: a reasonless settle receipt over a record holding a cleared halt is refused, and so is
one over a record that cannot be read.

## What shipped

- The `fix_commit` VALUE check hoisted out of the `survived` branch, so a blank, `null` or junk
  value is refused on `downgraded` and `refuted` too, with the refusal naming both the field and
  the ruling - `cadence-core/bin/lib/adjudication-record.mjs`
- `unfixedFromEntries(entries)` as the one entries-level home for the unfixed-halting-survivor
  test, with `unfixedFindings` kept as its wrapper - `cadence-core/bin/lib/filing-decision.mjs`
- `overrideAccounted` beside `recountReceipt`: a settle receipt carrying no reason at all is
  refused when the record it settles holds a survived blocker or high marked `overridden: true`,
  and nothing is appended - `cadence-core/bin/planning/trace.mjs`
- That guard refusing an UNREADABLE record with `reason: 'bad-record'` rather than passing on it,
  while an absent record still passes - `cadence-core/bin/planning/trace.mjs`
- An end-to-end arm over a mixed-ruling fixture walking `risk-check run` -> `adjudication` ->
  receipt -> `risk-check status` - `cadence-core/bin/planning-adjudication.test.mjs`
- Both rules stated in `cadence-core/references/review-record.md` and
  `cadence-core/references/triage-gate.md`, with their ceilings re-pinned in `weight-budgets.json`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 9f52e361 | Validate `fix_commit` wherever the key is set, on every ruling |
| 1 | 2 | e61bc8f9 | Give the unfixed-halting-survivor test one entries-level home |
| 1 | 3 | 36ba2652 | Refuse a reasonless receipt over a record holding a cleared halt |
| 1 | 4 | 6541bd8d | Reproduce both refusals end to end over a mixed-ruling fixture |
| 1 | 5 | 96d32686 | State both guards in the two references and re-pin their ceilings |
| 1 | 5 (cont.) | aa61edf1 | Re-pin EXECUTE-22 to the line trace.mjs's new import shifted it to |
| 1 | risk_surface fix | 776c67ef | Refuse an unreadable record in the cleared-halt check |

## Deviations

- [deviation] Task 3's `Action:` asserted that an absent OR unreadable record omits the check,
  and the code was written to it. The blocking `risk_surface` review's surviving `high` found
  half of that wrong: an unreadable record is not an unresolvable one, it is a record somebody
  changed, and passing on it discharges the `overridden: true` marker. Fixed in 776c67ef - the
  unreadable case refuses, the absent case still passes. The review's own rationale was half
  wrong too: it claimed `recountReceipt` is documented to omit its check on an unreadable
  record, where in fact it REFUSES one with `bad-record`. The real hole was the asymmetry
  between the two guards plus that refusal's all-three-figures precondition, which lets a
  partial settle line skip it entirely.
- [deviation] Task 5's `Verify:` asserts the full suite is green. At 96d32686 it was not:
  task 3's one added import at `cadence-core/bin/planning/trace.mjs:33` shifted the file down by
  one line, so `citation-census.test.mjs`'s EXECUTE-22 row no longer resolved. The repair needed
  two files outside the plan's `files:` lease, so the executor returned `CHECKPOINT: structural`.
  The user approved it, the lease was amended to cover `.planning/DOCS-CLAIMS.md` and
  `cadence-core/bin/citation-census.test.mjs`, and aa61edf1 re-pinned the one affected row
  `244-246` -> `245-247`. Suite green after it: 3562 pass, 0 fail, 1 skipped.
- [deviation] D-04's claim that an overridden entry is "by construction a survived blocker/high
  with no `fix_commit`" is FALSE against the shipped schema, which permits both fields on one
  entry (`cadence-core/bin/lib/adjudication-record.mjs:473` refuses only when NEITHER is
  present). Found by the `diff` review; D-04's line in CONTEXT.md is annotated with the
  correction, and the consequence is filed as GH issue `eb3c4bdae2b8fb82`.

## Review record

- `risk_surface` fired blocking on the committed range, 2 raised, 1 survived. The surviving
  `high` was fixed in 776c67ef. The re-arm's one narrowed round raised 1 more `high`, which
  adjudication downgraded: the escape it names requires rewriting the record file, and a record
  replaced by `{"entries":[]}` is byte-identical to a legitimate fire that ruled nothing, so no
  check inside the module can tell them apart without tamper-evidence the format does not carry.
  Records at `ADJUDICATION-risk_surface-plan-1.json` and `-r2.json`.
- `diff` fired blocking on the same range and PASSED - 1 raised, 1 survived at `medium`, nothing
  at blocker or high. Record at `ADJUDICATION-diff-plan-1.json`.
- Filed: the `diff` survivor accepted as a GitHub issue; both `risk_surface` non-survivors
  declined with the decline label.

## Open items

- A pinned `DOCS-CLAIMS.md` row that names a file by LINE NUMBER rots whenever any earlier line
  is added to that file, and nothing warns the executor at the edit site - the failure surfaces
  only in the full-suite run, one task later. An import added at line 33 silently invalidated a
  citation 200 lines below it.
- `filing-decision.mjs:117` marks a survived blocker/high as a halting survivor whenever
  `overridden: true`, without checking for a `fix_commit` beside it, so an override backed by a
  real commit still trips `overrideAccounted`'s refusal and its detail text then falsely reads
  "STOOD with no fix commit". Filed on the tracker.
- The adjudication record is unsigned plaintext with no hash or chain, so a record rewritten to
  `{"entries":[]}` plus a partial settle line still discharges the override marker. Downgraded
  rather than fixed: tamper-evidence for the record format is work this phase did not scope.

## Goal check

The phase goal has two halves and the commits deliver both. The `fix_commit` half is 9f52e361:
the VALUE check moved out of the `survived` branch, and `adjudication-record.test.mjs` went 49
pass / 0 fail with three new arms proving `'not-a-sha'`, `''` and `null` refused on `downgraded`
and `refuted` with the ruling named, while D-01's rejected stronger arm stays pinned as rejected.
The `overridden` half is 36ba2652 plus 776c67ef: `overrideAccounted` refuses a reasonless receipt
over a record holding a cleared halt, and refuses an unreadable record rather than passing on it,
with `planning-adjudication.test.mjs` at 27 pass / 0 fail and the end-to-end arm in 6541bd8d
walking the whole chain from `risk-check run` to `risk-check status` at `recorded`. Nothing looks
missing against the six acceptance criteria: AC1-AC2 are 9f52e361's arms, AC3 is 36ba2652's,
AC4's unchanged-vocabulary tests are green at `adjudication-record.test.mjs:292-300` and
`:309-317`, AC5 is e61bc8f9's one primitive driving both faces, and AC6 is 6541bd8d. Full suite
is green at 776c67ef - 3563 tests, 3562 pass, 0 fail, 1 skipped, exit 0 - and
`self-verify.mjs` reports `ok:true` with `problems: []`. The one honest gap is not a gap in the
goal but in what the goal assumed: D-04 claimed an overridden entry carries no `fix_commit` by
construction, the shipped schema permits both, and the predicate at `filing-decision.mjs:117`
was written to the false claim. That is filed rather than fixed, because closing it changes
which receipts `overrideAccounted` refuses and no plan task authorized that.
