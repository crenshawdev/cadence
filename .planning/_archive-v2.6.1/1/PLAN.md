---
phase: 1
plan: 1
requirements: [DFC-01, DFC-02, DFC-03, DFC-04]
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/review-triggers.md
  - skills/cad-plan-checker-contract/SKILL.md
  - skills/cad-land/SKILL.md
  - skills/cad-plan-review/SKILL.md
  - docs/WORKFLOW.md
  - docs/EVIDENCE.md
  - METHOD.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: The filed defects - Plan

## Goal

The four defects `v2.6.0`'s doc sweep filed rather than reworded away are closed
at their source, and each lands with a check that fails against the unpatched
tree, so none of them is filable again next cycle.

## Must be true when done

- `grep -rn "const worker" cadence-core/bin/` returns the `cadence-core/bin/lib/trace.mjs`
  line without `-a`, `file(1)` no longer reports that source as `data`, and
  planting a literal U+0000 anywhere under `cadence-core/bin/**` makes
  `self-verify` fail with a named problem.
- `renderTrace`'s composite worker key still separates its three parts with
  U+0000 and `node --test cadence-core/bin/trace.test.mjs` is green, so the
  change is to the source bytes and not to behaviour.
- Both statements of `phase_diff`'s gates - the wiring table at
  `cadence-core/references/review-triggers.md` and its copy at
  `docs/WORKFLOW.md` - read `off / advisory / adjudicated`, which is what
  `node cadence-core/bin/route.mjs resolve --role cad-reviewer` returns per
  level, and a test fails if either drifts from `route-table.json`.
- `skills/cad-plan-checker-contract/SKILL.md` states the same dimension count in
  `<dimensions>` and `<success_criteria>`, and that count equals the number of
  dimensions the block enumerates, so a checker cannot report success having
  skipped the dimension that bounds plan size.
- The `risk_surface` row admits a shape-(c) path however it was produced, so
  `/cad-task`'s fire is one the row allows, while
  `cadence-core/workflows/task.md` still names its transient diff path, forbids
  staging it, and deletes it on return.
- A budgeted surface that SHRINKS below its `weight-budgets.json` entry fails
  self-verify exactly like one that grows, and all 93 surfaces sit at exactly
  their entry.
- All four sites naming `review-triggers.md`'s size, and `docs/EVIDENCE.md`'s
  aggregate totals, state what `node cadence-core/bin/weight.mjs --root .`
  reports; `.planning/DOCS-CLAIMS.md` states each defect's real status; and
  `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs --root .` and
  `npx tsc -p tsconfig.ci.json` are green.

## Context

CONTEXT.md decisions bind every task: D-01 (two `\0` escapes, separator
unchanged), D-03 (guard scope is `cadence-core/bin/**`, never the tree - the
archived `_archive-v2.5.0/1/PLAN-2.md` carries the same bytes and is out of
scope), D-04/D-06 (only two `phase_diff` prose sites remain; `METHOD.md` and
`workflows/execute.md` were corrected in `b2bad1a`/`044806c` and stay untouched,
and `METHOD.md:282-283` must stay true), D-07 (six is correct), D-09/D-10
(broaden the row's qualifier, never revert `task.md`), D-11 (the fire sites are a
closed set and the check must not match `verify.md:262`), D-12 (`17,733` appears
in FOUR places), D-13 (`bytes !== budget`), D-14 (EVIDENCE aggregates are already
159 B stale from `716fb60`), D-15 (the ledger records closure).

Two constraints shape the ordering. The budget check flips to exact in task 2,
BEFORE the two prose edits that move bytes, so tasks 3 and 4 are forced to re-pin
in the same commit rather than shipping a silent shrink - that is the failure
mode D-13 exists to catch, and DFC-03's own fix is its worked example. And
`self-verify.test.mjs:858` records a standing decision NOT to parse
`review-triggers.md`'s wiring table from `self-verify.mjs` (it has no stated
grammar), so the three table/prose agreement checks ship as tests in one new
`cadence-core/bin/prose-agreement.test.mjs`, not as self-verify checks. Out of
scope: reverting `cadence-core/workflows/task.md`, editing
`.planning/_archive-v2.5.0/**`, and re-correcting `METHOD.md`'s or
`workflows/execute.md`'s `phase_diff` prose.

## Tasks

### Task 1: Close DFC-01 and guard every source byte under `cadence-core/bin`

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs, cadence-core/bin/trace.test.mjs
- **Action:** In `cadence-core/bin/lib/trace.mjs` line 336 (the single template
  literal that builds `const worker`), replace each of the two literal U+0000
  bytes - at file offsets 14815 and 14831, the only two NULs anywhere under
  `cadence-core/bin/` - with the two-character escape `\0`. The separator itself
  stays U+0000: a different separator would silently merge or split worker keys
  in `renderTrace`'s pairing map (D-01). Give `binFiles(root)` in
  `self-verify.mjs` an options argument `{ every = false }`; when `every` is
  true it yields every REGULAR FILE under `cadence-core/bin` regardless of
  extension - `*.test.mjs` and `lib/config-merge.mjs`, which the default arm
  skips, and the non-`.mjs` files too (`weight-budgets.json`, any future data
  file) - so check 12's input is byte-identical to today's while the guard
  covers what this plan's goal claims: a NUL planted ANYWHERE under
  `cadence-core/bin/**`. A `.mjs`-only walk would leave
  `cadence-core/bin/weight-budgets.json` unguarded while the Must-be-true line
  above asserts otherwise. Add check 15 to `run()` and an
  entry for it to the header check list: for each `binFiles(root, { every: true })`
  entry, propagate an `unreadable` entry as the existing walks do (one
  `unreadable-surface` problem naming it, never an unwound run), otherwise read
  the file as a Buffer and, when `buf.indexOf(0) >= 0`, push
  `{ kind: 'nul-byte-in-source', file: <root-relative path>, detail: 'literal
  U+0000 at byte offset <first offset> (<count> in file) - type \0 instead' }`.
  Scope it to `cadence-core/bin/**` and nothing wider: `.planning/_archive-v2.5.0/1/PLAN-2.md`
  carries the same two bytes inside an immutable phase record this cycle
  declares out of scope, and a tree-wide guard would land red on its first run
  (D-03). Keep `self-verify.mjs` type-clean under `@ts-check`. In
  `self-verify.test.mjs`, beside the existing check-12 tests, add three tests
  built on the existing `binFixture` helper: a `.mjs` carrying a literal NUL is
  reported with kind `nul-byte-in-source` naming the file and its offset; a
  `.mjs` whose source spells the two-character `\0` escape is clean; and a NUL
  inside a `*.test.mjs` under bin is reported too, which is what the `every`
  arm buys over check 12's walk. Add a fourth: a NUL inside a NON-`.mjs` file
  under bin (a `.json` fixture) is reported with the same kind, which is what
  the extension-blind walk buys over a `.mjs`-only one. In `trace.test.mjs` add one test that two
  events whose corr/phase/plan parts concatenate to the same string without a
  separator (corr `a`, phase `bc` versus corr `ab`, phase `c`) do NOT pair into
  one worker row, so deleting or emptying the separator fails loudly.
- **Verify:** `grep -rn "const worker" cadence-core/bin/` (no `-a`) prints
  `cadence-core/bin/lib/trace.mjs:336`, and `file cadence-core/bin/lib/trace.mjs`
  no longer prints `data`. `node --test cadence-core/bin/trace.test.mjs cadence-core/bin/self-verify.test.mjs`
  is green. Mutation proof for the SUMMARY: write a literal NUL back into
  `cadence-core/bin/lib/trace.mjs`, run `node cadence-core/bin/self-verify.mjs --root .`
  and observe exit 1 with a `nul-byte-in-source` problem naming that file, then
  restore and observe `"problems":[]`. Restore from a copy taken BEFORE the
  mutation (`cp cadence-core/bin/lib/trace.mjs "${TMPDIR:-/tmp}/trace.mjs.bak"`
  first, `cp` it back after), never `git checkout --`: until this task is
  committed, `git checkout` restores HEAD, which is the original literal-NUL
  file, so the clean re-run this proof claims could not happen.

### Task 2: Make the weight budget exact in both directions

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs,
  METHOD.md
- **Action:** In check 4 of `self-verify.mjs`, replace `if (bytes > budget)`
  with an exact comparison: keep kind `budget-overrun` with its existing detail
  when `bytes > budget`, and add kind `budget-undershoot` with detail
  `<bytes>B is under budget <budget>B by <budget - bytes>B - re-pin the entry`
  when `bytes < budget`. Two kinds rather than one so triage still reads the
  direction off the kind. Correct check 4's own inline comment - it says a
  surface must "stay at or under" its entry - to state that it must equal the
  entry exactly, and say why: there is no `--write-budgets` regeneration path,
  entries are hand-edited from `weight.mjs`, so "93 surfaces at exactly their
  byte count, total slack 0" was a maintenance convention `docs/EVIDENCE.md`
  published as if it were enforced (D-13). Update the existing test at
  `self-verify.test.mjs:325` - `a surface at or under its budget yields no
  overrun` sets the budget to `bytes + 100` and must now fail - by rewriting it
  as a surface exactly at its budget yielding no problem, and add a falsifier
  test that a surface ONE byte under its entry is reported `budget-undershoot`
  naming the surface and the shortfall. In `METHOD.md:588-591`, the sentence
  ending "and fails when one outgrows its entry" now states that it fails when a
  surface differs from its entry in either direction, growth or shrink.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` prints
  `"problems":[]` on the clean tree (all 93 surfaces already sit exactly at
  budget - measured 2026-08-09, zero mismatches). `node --test cadence-core/bin/self-verify.test.mjs`
  is green. Mutation proof for the SUMMARY: delete one byte from a budgeted
  surface, re-run self-verify and observe exit 1 with `budget-undershoot` naming
  it, then restore the file and observe `"problems":[]`.

### Task 3: Close DFC-03 and pin the dimension count mechanically

- **Files:** skills/cad-plan-checker-contract/SKILL.md,
  cadence-core/bin/weight-budgets.json, cadence-core/bin/prose-agreement.test.mjs
- **Action:** In `skills/cad-plan-checker-contract/SKILL.md:113`, change
  `All five dimensions checked` to `All six dimensions checked`. Six is the
  correct direction: `<dimensions>` says "Check six dimensions" and enumerates
  six ending in Proportionality, and correcting downward would delete the
  dimension `v2.5.0` shipped a cycle early to install and contradict
  `METHOD.md:91` (D-07). `<returns>` at `:91` says "one line per dimension" and
  carries no number - leave it. The edit shrinks the file by one byte
  (5,344 -> 5,343), which task 2 now makes a failure, so re-pin
  `weight-budgets.json`'s `skills/cad-plan-checker-contract/SKILL.md` entry to
  the exact byte count `node cadence-core/bin/weight.mjs --root .` reports after
  the edit, in this same commit. Create `cadence-core/bin/prose-agreement.test.mjs`
  as a top-level test file - CI's `node --test cadence-core/bin/*.test.mjs`
  glob runs it, `tsconfig.ci.json` excludes `*.test.mjs` so it carries no
  `@ts-check` burden, and self-verify check 14 requires no CONTRACTS row for a
  test file - with a header comment stating its subject: prose that copies a
  machine-readable fact must still match that fact, checked here rather than in
  `self-verify.mjs` because the wiring table has no stated grammar and
  `self-verify.test.mjs:858` records the decision not to parse it. Its first
  test reads the SKILL.md and asserts three numbers agree: the count word after
  `Check ` in the `<dimensions>` block, the count word in
  `<success_criteria>`'s `All <n> dimensions checked`, and the number of
  `^\d+\. \*\*` enumerated items inside the `<dimensions>` block, mapping the
  words through a small word-to-number table so a future rename of the count
  word fails loudly rather than silently reading zero.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` is green
  and `node cadence-core/bin/self-verify.mjs --root .` prints `"problems":[]`.
  Patch-and-rerun proof for the SUMMARY: change `:113` back to `five`, re-run
  the test file and observe it fail naming the disagreement, then restore.

### Task 4: Close DFC-02 and DFC-04 and move the coupled byte figures together

- **Files:** cadence-core/references/review-triggers.md, docs/WORKFLOW.md,
  cadence-core/bin/weight-budgets.json, skills/cad-land/SKILL.md,
  skills/cad-plan-review/SKILL.md, cadence-core/bin/prose-agreement.test.mjs
- **Action:** Six files in one task because the byte coupling forces one commit:
  editing `review-triggers.md` moves its budget, which task 2 now fails on in
  either direction, and the same figure is quoted inline by two skills. In the
  Wiring table at `cadence-core/references/review-triggers.md:244`, the
  `phase_diff` gate cell becomes `off / advisory / adjudicated` - what
  `route-table.json:47-49` resolves and `config.schema.json:92` defaults to. At
  `:243`, the `risk_surface` row's payload cell drops the producer qualifier so
  its shape-(c) clause reads `(c) the flagged-diff FILE path`, leaving
  `, or (b) the staged-diff scope in-context` unchanged; section 2's own
  shape-(c) definition at `:59-63` is already broad enough, so nothing else in
  the file moves (D-10). Do NOT touch `cadence-core/workflows/task.md`:
  `716fb60` already restored the named transient path, the never-stage rule and
  the delete-on-return cleanup, and ROADMAP criterion 4 forbids losing them
  (D-09). In `docs/WORKFLOW.md:168`, the `phase_diff` row's three level columns
  become `off | advisory | adjudicated`; that file carries no budget and no
  ledger rows, so nothing else moves with it (D-05). Leave `METHOD.md:276-283`
  and `cadence-core/workflows/execute.md:382-388` alone - corrected in `b2bad1a`
  and `044806c` - and leave `METHOD.md:282-283` true, since `diff` is still
  `off` at solo (D-06). Leave `.planning/REQUIREMENTS.md:35`,
  `.planning/DOCS-CLAIMS.md:105` and `.planning/PROJECT.md:123` alone: they
  quote `off / off / adjudicated` as the defect under description, not as a live
  claim. Then re-measure with `node cadence-core/bin/weight.mjs --root .` and,
  in this same commit, set `weight-budgets.json`'s
  `cadence-core/references/review-triggers.md` entry to the reported byte count
  and the inline figures at `skills/cad-land/SKILL.md:44` and
  `skills/cad-plan-review/SKILL.md:39` to the same number in `NN,NNN` form; the
  value stays five digits so both skills keep their own exact budgets, and if a
  digit count does change, re-pin those two entries too (D-12). Add two tests to
  `prose-agreement.test.mjs`. First: parse the `phase_diff` row's last cell from
  the wiring table, split it on `/`, and assert the three trimmed values equal
  what the RESOLVER returns per level, not merely what `route-table.json`
  stores - run `node cadence-core/bin/route.mjs resolve --role cad-reviewer
  --file <tmp config>` three times, once per level, writing a scratch config
  whose only content is that `stakes` value (`resolve` takes no level flag; the
  per-repo `--file` is the seam for driving it), and read
  `review.phase_diff` off each line. Table-only assertions leave solo and
  critical resolver behaviour - level mapping, schema defaults, role selection -
  free to diverge from the prose both files copy. Assert
  `docs/WORKFLOW.md`'s `phase_diff` row's last three cells equal the same three
  resolved values.
  Second: parse the `risk_surface` row and assert its Fired by cell names
  exactly `cad-execute`, `cad-debug`, `cad-task` and `cad-verify` (the closed
  set, D-11), that its payload cell offers both `(c)` and `(b)`, that its
  shape-(c) clause carries no producer qualifier (no match for `checkpoint`),
  and that `cadence-core/workflows/task.md` still contains
  `.planning/tasks/{slug}/risk-task-{slug}.diff`, a never-stage instruction and
  a delete-on-return instruction. Bound that second test to the wiring row and
  `task.md` so it cannot reach `verify.md:262`, whose shape-(c) fire is a
  diagnosis review naming no wiring-table trigger and carrying no resolved gate
  (D-11).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` and
  `node cadence-core/bin/self-verify.mjs --root .` (`"problems":[]`) are green;
  `node cadence-core/bin/route.mjs resolve --role cad-reviewer` reports
  `phase_diff` as `advisory` at the default `shipped`, matching the corrected
  cell; `grep -rn "off / off" cadence-core docs skills METHOD.md README.md`
  returns nothing. Patch-and-rerun proof for the SUMMARY, run twice: restore
  `off / off / adjudicated` and observe the first test fail naming the cell;
  restore `the checkpoint returned` and observe the second fail; revert both.

### Task 5: Re-measure `docs/EVIDENCE.md` and check the four figure sites

- **Files:** docs/EVIDENCE.md, cadence-core/bin/prose-agreement.test.mjs
- **Action:** Re-run `node cadence-core/bin/weight.mjs --root .` and
  `node cadence-core/bin/weight.mjs resident --root .` and update EVERY figure
  in `docs/EVIDENCE.md` that differs, not only the named ones: the
  `cadence-core/references/review-triggers.md` row in the twelve-largest table
  (both its bytes and its est-token column - take est tokens from the seam's
  own output, never bytes/4, because `estTokens` counts characters, which is why
  17,733 B reads 4,433), the per-directory table and its total, the four
  `cad-plan-checker` dispatch rows at `:120-123` (the contract shrank one byte
  in task 3), and any reachable-column figure whose one-hop set includes
  `review-triggers.md`. Two of the per-directory figures were already stale
  before this phase: `cadence-core/workflows/` is 200,209 and the grand total
  475,571 today against the published 200,050 and 475,412, and the 159 B gap is
  exactly `716fb60`'s `task.md` growth committed after that file's last
  re-measure at `f8f22cf` - name that cause in the commit message so the diff
  does not read as unexplained drift introduced here (D-14). Update the header
  line's measurement date and its commit ref to task 4's commit sha: `docs/`
  holds no measured surface, so task 4's tree is exactly what these numbers
  describe. Reword the "total slack zero, so any added byte anywhere fails
  `self-verify`" sentence at `:171-173` to state what task 2 made true - any
  DIFFERENCE, added or removed, fails on the commit that introduces it. Add one
  test to `prose-agreement.test.mjs` that imports `weighAll` from
  `./lib/surface-weight.mjs` (the same lib the seam and self-verify measure
  with, so the check cannot diverge from the enforced number) and asserts, for
  `cadence-core/references/review-triggers.md`, that `weight-budgets.json`'s
  entry, `skills/cad-land/SKILL.md`'s inline figure,
  `skills/cad-plan-review/SKILL.md`'s inline figure and `docs/EVIDENCE.md`'s row
  all state the measured byte count, and that EVIDENCE's five directory
  subtotals and grand total equal the sums of the measured surfaces under each
  prefix. Extend the same test over EVERY row of the twelve-largest table, not
  just `review-triggers.md`'s: parse each row's path, byte figure and est-token
  figure and assert both against `weighAll`'s measurement and the same
  `estTokens` the seam applies (never a recomputation of `bytes/4` - it counts
  characters). Checking one row of twelve leaves the other eleven, and every
  est-token column, free to stale silently, which is the exact drift class this
  task exists to close. This is the check for a drift class that had none: the deferral rule
  at `references/seams.md:240-242` now requires every future deferral to quote
  its reference's measured bytes inline, and those inline figures were checked
  against nothing (recalled memory, CAPTURE.md phase 2).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` is green.
  Patch-and-rerun proof for the SUMMARY: change one digit of
  `docs/EVIDENCE.md`'s `review-triggers.md` byte figure, re-run the test file
  and observe it fail naming the site, then restore. Spot-check by hand that
  every row of the twelve-largest table matches
  `node cadence-core/bin/weight.mjs --root .`.

### Task 6: Record the closures in the sweep ledger and run the gates

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** In `## Defects filed out of this sweep` (`:91-112`), rewrite the
  `DFC-01`, `DFC-02` and `DFC-03` bullets from open filings to defects closed in
  this phase, each naming what closed it (the `\0` escapes plus the
  `nul-byte-in-source` check; the corrected `phase_diff` gate cell in both
  files; the corrected `<success_criteria>` count), and update the `Filed as
  DFC-01` mention at `:49` the same way. Keep the paragraph at `:114-116`
  explaining what the `+ DFC-0k` suffix is for, and update the five rows
  carrying that suffix - `METHOD-01`, `METHOD-02`, `METHOD-03` (`:173-175`) and
  `EXECUTE-02`, `EXECUTE-03` (`:449-450`) - so the suffix states the filing's
  real status rather than implying an open one, which is the single job it is
  documented as having (D-15). Do not touch any row's `verdict` cell: those
  record what run 1 found and are not this phase's to restate. Do not add a
  `DFC-04` bullet - run 1 never filed one in this block, and inventing a row
  would make the ledger assert a finding the sweep did not make. But DFC-04
  must not close with NO ledger link at all: `TASK-01` at `:588`, the row whose
  claim the filing came out of, reads `corrected - 044806c` with no suffix, so
  append `+ DFC-04` to that resolution in the same closed form the other five
  use. That is the suffix's one documented job - the row's only link to its
  filing - and without it the ledger records three of this phase's four
  closures. Leave `TASK-01`'s `verdict` cell alone like every other row's.
- **Verify:** `grep -n "DFC-0" .planning/DOCS-CLAIMS.md` shows no bullet or
  suffix still stating an open filing, and shows a `DFC-04` link on `TASK-01`. All three gates green:
  `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs --root .` printing `"problems":[]`, and
  `npx tsc -p tsconfig.ci.json`.

## Notes

Plan shape: one plan, as the CONTEXT directive states. No deviation - tasks 3,
4 and 5 all touch `cadence-core/bin/prose-agreement.test.mjs` and tasks 3 and 4
both touch `cadence-core/bin/weight-budgets.json`, so no split passes the
file-independence test.

The CONTEXT flagged assumption about the NUL guard's host is resolved toward
`self-verify.mjs` with a widened walk rather than a plain reuse of `binFiles`:
the default walker skips `*.test.mjs`, so a NUL typed into a test file - equally
invisible to `grep` over `cadence-core/bin/**` - would have gone unguarded. The
`{ every: true }` arm closes that gap without moving check 12's input. The other
flagged assumption is resolved by keeping every table-versus-code check in a
test file: `self-verify.mjs:886-899` and `self-verify.test.mjs:858` record the
standing decision that self-verify does not parse the wiring table, and the
tests here parse one named row rather than the table's shape, so a reformat that
changes no fact does not go red.

Editing the `phase_diff` and `risk_surface` rows is safe for
`dispatch-phrasing.test.mjs:248-266`: those tests assert against their own
literal row strings, not against the file, and neither edit introduces an
imperative into a cell (recalled memory, CAPTURE.md).

Every mutation and patch-and-rerun named in a Verify is recorded in the phase
SUMMARY, per ROADMAP criterion 6 - a check that was never seen to fail is a
vacuous assertion.
