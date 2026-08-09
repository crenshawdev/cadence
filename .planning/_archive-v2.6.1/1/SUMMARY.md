---
phase: 1
status: complete
completed: 2026-08-09
---

# Phase 1: The filed defects - Summary

DFC-01..DFC-04 closed at their source, each with a check proved to fail against
the unpatched tree, plus a new `cadence-core/bin/prose-agreement.test.mjs` that
pins prose to the machine-readable fact it copies.

## What shipped

- The two literal U+0000 bytes in `cadence-core/bin/lib/trace.mjs:336` replaced
  by `\0` escapes; the separator itself unchanged (DFC-01). `file(1)` now reports
  `JavaScript source, ASCII text` and `grep -rn "const worker" cadence-core/bin/`
  finds line 336 without `-a`.
- `self-verify.mjs` check 15 `nul-byte-in-source`, walking every REGULAR file
  under `cadence-core/bin` via `binFiles(root, { every: true })` - test files and
  non-`.mjs` files included, so the guard covers what the goal claims.
- `self-verify.mjs` check 4 made exact in both directions: the new
  `budget-undershoot` kind fails a surface that SHRINKS below its
  `weight-budgets.json` entry, not only one that grows (D-13). `METHOD.md:589-595`
  restated to match.
- `skills/cad-plan-checker-contract/SKILL.md:113` corrected `five` -> `six`
  dimensions (DFC-03), with the budget entry re-pinned 5,344 -> 5,343 in the same
  commit.
- `review-triggers.md:244` and `docs/WORKFLOW.md:168` state `phase_diff` as
  `off / advisory / adjudicated`, what the resolver returns (DFC-02); the
  `risk_surface` row's shape-(c) producer qualifier dropped so a `/cad-task` fire
  is a shape the row admits (DFC-04), with `workflows/task.md` untouched.
- The coupled `review-triggers.md` byte figure moved 17,733 -> 17,714 in all four
  places at once: `weight-budgets.json`, `skills/cad-land/SKILL.md:44`,
  `skills/cad-plan-review/SKILL.md:39`, `docs/EVIDENCE.md`.
- `cadence-core/bin/prose-agreement.test.mjs` - six tests: dimension-count
  three-way agreement, the `phase_diff` row against `route.mjs resolve` driven at
  all three stakes levels, the `risk_surface` row plus `task.md`'s three retained
  properties, and three `weighAll`-backed byte checks.
- `docs/EVIDENCE.md` re-measured at `98be3d2`, including a pre-existing 159 B
  staleness from `716fb60` corrected in three places (D-14 named two).
- `.planning/DOCS-CLAIMS.md` records all four closures with their commits.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 1e949bc | Close DFC-01; `\0` escapes + self-verify check 15 over every file under `cadence-core/bin`; 4 self-verify tests + 1 trace separator test |
| 1 | 2 | 20c59b6 | Weight budget exact in both directions; `budget-undershoot` kind; `METHOD.md` restated |
| 1 | 3 | f6eed02 | Close DFC-03; `five` -> `six`; budget re-pinned 5,344 -> 5,343; new `prose-agreement.test.mjs` |
| 1 | 4 | 98be3d2 | Close DFC-02 and DFC-04; `phase_diff` cell and `risk_surface` qualifier corrected; 17,733 -> 17,714 moved in all four sites |
| 1 | 5 | 99d4e78 | `docs/EVIDENCE.md` re-measured; three `weighAll`-backed byte tests |
| 1 | 6 | f50a8a0 | Four DFC closures recorded in the sweep ledger; all three gates run |

Range: `234aeff..f50a8a0` (6 commits).

## Deviations

- [deviation] Task 5 named the twelve-largest row, the per-directory table and
  the four dispatch rows as the figures that move. `/cad-task`'s turn-one figure
  (5,221) and the 23-command total (279,064) were ALSO 159 B stale from the same
  `716fb60` cause, because `/cad-task` eagerly includes `workflows/task.md`.
  Corrected under the task's own "update EVERY figure that differs" instruction
  (`99d4e78`).
- [deviation] Task 6's `+ DFC-04` append was first applied by a text match on
  `| stale | corrected - 044806c |`, which matched SEVEN rows rather than
  `TASK-01` alone. Caught before staging by an id-keyed re-scan; the six intended
  rows are the only ones in the committed diff, verified with `git diff -U0`
  (`f50a8a0`).

## Open items

- The DFC-04 test bans the word `checkpoint` in the shape-(c) clause rather than
  binding each listed producer to an artifact it can actually produce. Rewriting
  the row to `the flagged-diff FILE path the executor returned` would exclude
  `/cad-task` again and still pass (`cadence-core/bin/prose-agreement.test.mjs:164`).
  Confirmed against the code, from the `diff` review.
- The inline byte-figure check asserts `text.includes("17,714 B")` over the whole
  SKILL.md, not at the pinned line, so a stale figure at `cad-land/SKILL.md:44`
  passes if the number appears anywhere else in the file
  (`cadence-core/bin/prose-agreement.test.mjs:200`). Confirmed against the code,
  from the `diff` review.
- `docs/EVIDENCE.md`'s reachable-command and eager/runtime tables carry
  byte-derived figures this phase updated but did not put under test: the new
  checks cover the twelve-largest rows and the directory sums only, so a routing
  change that moves a reachable total drifts silently. From the `diff` review.
- `cadence-core/bin/dispatch-phrasing.test.mjs:254` carries an inline fixture
  string copying the old `off / off / adjudicated` row. It is a fixture for the
  dispatch-phrasing rule, not a claim about the gate, and that file is outside
  this plan's `files:` lease - left as-is per the plan's Notes.
- `detect-commands --root /data/code/cadence` reports `lint:null, typecheck:null`,
  so Cadence detects no static-analysis command. The real typecheck is
  `npx tsc -p tsconfig.ci.json`, named in the plan's gates and run at every task;
  there is no separate linter in the tree.

## Goal check

The six commits deliver the goal. Each of the four filings is closed at its
source and independently re-checked here, not merely reported closed:
`file cadence-core/bin/lib/trace.mjs` returns `JavaScript source, ASCII text` and
`grep -rn "const worker" cadence-core/bin/` prints `lib/trace.mjs:336` without
`-a` (DFC-01); `grep -rn "off / off" cadence-core docs skills METHOD.md README.md`
returns only two test/comment hits, neither a live gate claim (DFC-02);
`skills/cad-plan-checker-contract/SKILL.md:42` and `:113` both say six (DFC-03);
the `risk_surface` shape-(c) clause carries no producer qualifier (DFC-04). All
three gates are green on the final tree: `node --test cadence-core/bin/*.test.mjs`
1467 pass / 0 fail, `node cadence-core/bin/self-verify.mjs --root .` prints
`"problems":[]` across 20 checks including the new `nul-bytes`, and
`npx tsc -p tsconfig.ci.json` exits 0. ROADMAP criterion 6 is met task by task:
the report records a mutation or patch-and-rerun proof for every check, each with
the exact failure text observed (the planted NUL reported at offset 14802, the
one-byte deletion reported as `budget-undershoot`, `five` restored producing
`<success_criteria> says 5 but <dimensions> enumerates 6`, `off / off /
adjudicated` and `the checkpoint returned` each producing their own assertion).
What is honestly weaker than the plan implied: two of those checks are narrower
than the invariant they name - the DFC-04 test pins one historical qualifier word
rather than the producer-to-shape relation, and the inline-figure check is a
whole-file substring rather than a site assertion - so both defects remain
reachable through a differently-worded regression. Both are recorded as open
items with their line numbers rather than smoothed over. The exact-budget flip in
task 2 is a repository-wide enforcement change riding a defect-fix phase; that is
D-13, a locked CONTEXT decision with the plan's ordering built around it, not
scope creep discovered at execution time.
