PLAN CHECKPOINT: structural
Plan: .planning/phases/2/PLAN-1.md
Tasks: 1 of 6
| Task | Commit | Note |
|---|---|---|
| 1. State the record's grammar as a pure module | 0387268 | `cadence-core/bin/lib/adjudication-record.mjs` + a 30-case test, all green. Falsification run per Verify: editing the module to merge convergent findings into one entry reddens the AC1 case, restored and green. `test.mjs --list` shows the `adjudication-record` stem under `other`, so CI runs it. Typecheck flagged one TS2339 (`isPlainObject` did not narrow `unknown`) - closed with a type predicate. self-verify `ok:true`, `problems: []`. |
| 2. Add the validating seam that writes the record | (uncommitted) | BLOCKED at the `CONTRACTS` row, which is the task's first step (D-12: declare the row FIRST). The row is written and correct; committing it is refused by the plan's own file lease. See below. |

Deviations:

[deviation] The plan asserts PLAN-1's `files:` lease covers the work. It does
not. Task 2's `CONTRACTS` row adds 7 flag entries to
`cadence-core/bin/lib/arg-contract.mjs`, and
`cadence-core/bin/arg-contract.test.mjs:297` asserts the whole-table entry count
as a literal: `assert.equal(entries, 145, ...)`. With the row it is 152, so that
census reddens (measured - it is the ONLY failure the row causes across the full
suite). `cadence-core/bin/arg-contract.test.mjs` is declared by neither PLAN-1
nor PLAN-2, so the one-number bump that repairs it cannot ride any commit in
this phase: `lease-check --phase 2 --plan 1` would answer `undeclared-files`.
What I did: stopped at the checkpoint rather than committing a red census or
staging an undeclared path.

Open items:

- PRE-EXISTING, not caused by this plan:
  `cadence-core/bin/milestone-prune.test.mjs:557` "corpus: pruning this
  repository's own REQUIREMENTS.md needs no hand repair" fails on this tree -
  the roadmap names a completed phase while `.planning/REQUIREMENTS.md`'s
  `## Active` still reads "No cycle open". That is the fourth flagged assumption
  in `.planning/phases/2/CONTEXT.md`, which records the gap as deliberately
  uncorrected. No file of mine is read by that test (`git diff --name-only HEAD`
  is three `cadence-core/bin` files).

- The working tree is left DIRTY on purpose so a continuation does not redo
  finished work: `cadence-core/bin/lib/arg-contract.mjs` carries the new
  `adjudication` row (uncommitted), and `lib/adjudication-record.mjs` plus its
  test carry one addition past commit 0387268 - a `voices` roster on the
  module's return, so a fire where every voice returned nothing (D-02's
  `gate_pass` case) still records which voices ran. Both are green in
  `adjudication-record.test.mjs` (32 cases).
