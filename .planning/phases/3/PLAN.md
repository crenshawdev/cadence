---
phase: 3
plan: 1
requirements:
  - CEN-03
  - DOC-04
files:
  - cadence-core/bin/test.mjs
  - cadence-core/bin/test-groups.test.mjs
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/bin/census-registry.test.mjs
  - cadence-core/references/conventions.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/seam-calls.test.mjs
---

# Phase 3: Pin the stem list and fix the prose - Plan

## Goal

Three small carried items, each placed where a file this cycle already opened is
already open. A new `planning-*.test.mjs` stem stops silently running in the
`other` group, `CADENCE-CENSUS` gets the prose home `CADENCE-DEBT` already has,
and a test header stops misattributing its own derivation.

## Must be true when done

- Both directions of the stem list fail loudly, on a mutated tree: a
  `planning-*.test.mjs` file on disk that `GROUPS.planning` does not name fails
  and prints that stem, and an entry of `GROUPS.planning` with no file on disk
  fails and prints that stem.
- `node cadence-core/bin/test.mjs --list` shows `planning-capture-check` under
  `planning` and not under `other`, and the `planning` group's `planning-*`
  entries are exactly the `planning-*.test.mjs` files in `cadence-core/bin/`
  (23 today).
- `cadence-core/bin/lib/census-registry.mjs` carries a row whose `holder` is
  `cadence-core/bin/test-groups.test.mjs` and whose `subjects` is exactly
  `['cadence-core/bin/test.mjs']`, that holder carries a `CADENCE-CENSUS` marker
  joining to it, and `node cadence-core/bin/census-registry.test.mjs` passes.
- No header in the tree argues against the check that now ships:
  `cadence-core/bin/test.mjs`'s header and
  `cadence-core/bin/census-registry.test.mjs`'s disposition note both describe
  what is on disk.
- `cadence-core/references/conventions.md`'s `## Deliberate shortcuts` describes
  the `CADENCE-CENSUS` fields and the one rule that a marked site with no row
  reddens the suite, cites `cadence-core/bin/lib/census-registry.mjs` for the
  rest, writes no literal marker line, and
  `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`.
- `cadence-core/bin/seam-calls.test.mjs`'s header names v3.3.0 phase 4's
  `PLAN-2` task 6 by its archive path as the source of the 5-for-`context.md`
  figure it argues against, and its census marker still asserts 14 for
  `workflows/plan.md` and 6 for `workflows/context.md`.
- `node cadence-core/bin/test.mjs` is green.

## Context

Locked by CONTEXT.md: the census pins `GROUPS.planning` as a SET against the
tree in both directions with no stem count written down (D-01); the row's
`subjects` is the single file `cadence-core/bin/test.mjs` and its `holder` is
the new test file (D-02); `conventions.md` summarizes the grammar and points at
`lib/census-registry.mjs` for the rest rather than restating it (D-03).
The live tree is already drifted - 23 `planning-*.test.mjs` files, 22 named in
the group (D-04) - so the stem lands before the check that would redden on it.
Out of scope, do not touch: the `planning-detail-sites` 15-vs-14 disagreement
(D-11), the `seam-call-counts` figures 14 and 6, any new group or any other stem
re-homed out of `other`, and any coverage check over the whole `bin` tree.

## Tasks

### Task 1: Name `planning-capture-check` in `GROUPS.planning`

- **Files:** cadence-core/bin/test.mjs
- **Action:** Start at the `GROUPS` const and its `planning` entry. Add the stem
  `planning-capture-check` to the `planning` array in
  `GROUPS`, in the alphabetical position the entries around it already keep -
  between `planning-audit` and `planning-capture-sections`. CONTEXT D-04
  measured the drift at gather time: 23 `planning-*.test.mjs` files on disk, 22
  of them named, so that one file runs in `other` today and the census in task 2
  would otherwise land red against a tree that was already wrong. Change nothing
  else in this file here - the header amendment is task 3, and re-flowing the
  array's line breaks would put unrelated churn in front of that edit. Do not
  re-home any other stem out of `other` and do not add a group; CONTEXT rules
  both out.
- **Verify:** `node cadence-core/bin/test.mjs --list` prints
  `planning-capture-check` in the `planning` group's list and not in `other`,
  and the `planning-*` entries it prints under `planning` number the same as
  `ls cadence-core/bin/planning-*.test.mjs | wc -l` (23).
  `node cadence-core/bin/test.mjs planning` runs and passes.

### Task 2: A census pins the stem list against the tree, both directions

- **Files:** cadence-core/bin/test-groups.test.mjs,
  cadence-core/bin/lib/census-registry.mjs
- **Action:** In the registry module, start at the `CENSUSES` export. Create the
  new test module holding one census over
  `GROUPS.planning`. It compares the hand-typed list in
  `cadence-core/bin/test.mjs` against the `planning-*.test.mjs` files in
  `cadence-core/bin/` in BOTH directions (D-01): a `planning-*.test.mjs` file on
  disk that no entry of that group names fails, and an entry of that group with
  no `<stem>.test.mjs` file on disk fails. Write NO stem count anywhere - the pin
  is set equality, so a legitimate new planning test costs one list edit and not
  two. Direction one is scoped to `planning-*.test.mjs` files only, never to the
  wider `bin` tree, which CONTEXT rules out; direction two covers every entry of
  `GROUPS.planning`, its four non-`planning-*` members included, which is what
  AC1 states without qualification. Each side's failure message prints the
  offending stem.
  Read the group list out of `cadence-core/bin/test.mjs` AS SOURCE TEXT, not by
  importing it: that module's body ends in the `spawnSync` at its foot that runs
  the suite, so an import would run the whole suite from inside a test, and the
  alternative - adding a run-as-script guard to the repository's suite
  entrypoint - puts a silent `exit 0` between CI and every test in the tree,
  which is the failure mode `review-provider.mjs` already cost this repo (REV-01,
  and the realpath guard at `cadence-core/bin/review-provider.mjs:1330-1346` is
  what that cost bought). Mechanism chosen at planning; a text read fails loudly
  where the guard fails green. Guard the parse against vacuity: a parse that
  matched nothing must FAIL rather than pass over an empty set, so assert the
  extracted list is non-empty and contains stems you can see in that file today.
  Plant exactly one `CADENCE-CENSUS` marker at the asserting site, with the id
  and an `asserts:` clause stating the set-equality claim in both directions and
  no number. `cadence-core/bin/lib/census-registry.mjs`'s `censusMarkersIn` is
  what parses it and `cadence-core/bin/rung-agent.test.mjs:78` is the shipped
  one-line example. Add the matching row to `CENSUSES` with id
  `planning-group-stems` (chosen at planning; the ids in that table name the
  thing pinned), `holder` `cadence-core/bin/test-groups.test.mjs`, and `subjects`
  exactly the one path `cadence-core/bin/test.mjs` and nothing wider - D-02
  replayed the alternatives against this repository's own plans, where a
  `cadence-core/bin/` subject refuses 39 of 39 against a half-the-plans rail
  whose line is 19.5, and a `holder` of `test.mjs` itself refuses 0 and so could
  never fire. `counts` says in one sentence what is pinned and says it is a set
  rather than a number; `asserted_by` quotes the real name of the test that
  performs the comparison, as a reader would find it. Do NOT add a length or
  count export to that module and do not assert the table's length - its own
  header (D-04) and `cadence-core/bin/census-registry.test.mjs:5-10` both forbid
  it, and CONTEXT D-09 records that the registry holds 13 rows today, not the 12
  ROADMAP criterion 1 states, with no count asserted anywhere.
  The new stem `test-groups` is deliberately left out of `GROUPS` and lands in
  `other`, which the default run and CI both execute; state that disposition in
  the new file's header the way `cadence-core/bin/phase-spelling.test.mjs:19-21`
  does, without citing `test.mjs`'s header as the authority for it, because task
  3 removes that sentence. Do not define a helper under any name
  `cadence-core/bin/helper-census.test.mjs` claims a single home for - that file
  asserts exactly one definition per listed helper across the whole `bin` tree.
- **Verify:** `node --test cadence-core/bin/test-groups.test.mjs` passes on the
  live tree; with one entry temporarily removed from the `planning` array in
  `cadence-core/bin/test.mjs` it fails naming that stem, and with a temporary
  empty `cadence-core/bin/planning-zz-probe.test.mjs` on disk it fails naming
  `planning-zz-probe` - both mutations reverted afterwards, and
  `git status --short` clean of them before the commit.
  `node cadence-core/bin/census-registry.test.mjs` passes, and
  `grep -c 'CADENCE-CENSUS' cadence-core/bin/test-groups.test.mjs` returns at
  least 1.

### Task 3: The two headers stop denying the check beside them

- **Files:** cadence-core/bin/test.mjs, cadence-core/bin/census-registry.test.mjs
- **Action:** Both edits are in the file header comment block - above
  `'use strict'` in the first file, above the imports in the second.
  In `cadence-core/bin/test.mjs`, replace the paragraph at :11-15
  that states there is deliberately NO coverage check and that a manifest could
  silently drop a file. The check now exists for the `planning` group: say which
  group is pinned, name `cadence-core/bin/test-groups.test.mjs` as the file
  holding it, and say that a stem outside that group still lands in `other` and
  still runs. The new text must agree with the narrower counter-argument already
  sitting in this file's own `planning` group comment, not contradict it. The
  paragraph at :8-10 ends "nothing else reads them", which task 2 makes false;
  correct that clause in the same edit rather than ship a header that denies its
  own reader - this repo treats a stale self-claim as a defect, which is D-05's
  whole basis and what `cadence-core/bin/seam-calls.test.mjs:1-5` states about
  itself. Do not move `GROUPS` into a manifest file and do not add an export from
  this module: the reason for keeping the declaration here is unchanged, and the
  census reads the source text.
  In `cadence-core/bin/census-registry.test.mjs`, the note at :19-21 KEEPS its
  disposition - this stem is in no group and lands in `other`, which the default
  run and CI both execute - and loses only the clause citing `test.mjs`'s header
  as stating that is deliberate, which after this edit it no longer does.
  `cadence-core/bin/phase-spelling.test.mjs:19-21` cites THIS note rather than
  `test.mjs`'s header, so the disposition sentence has to survive or that
  citation breaks; that file is not in this plan's lease and must not be edited.
- **Verify:** `grep -n 'deliberately NO coverage check' cadence-core/bin/test.mjs`
  returns nothing; `grep -n 'test-groups' cadence-core/bin/test.mjs` returns the
  amended header line naming the holder; `grep -n 'nothing else reads them'
  cadence-core/bin/test.mjs` returns nothing; `node cadence-core/bin/test.mjs
  --list` still prints every group with its files; `node --test
  cadence-core/bin/census-registry.test.mjs
  cadence-core/bin/phase-spelling.test.mjs` passes.

### Task 4: `CADENCE-CENSUS` gets its prose home, and the budget moves with it

- **Files:** cadence-core/references/conventions.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Start at the `## Deliberate shortcuts` heading in the reference,
  and at that reference's own entry in the budget JSON.
  Add a `CADENCE-CENSUS` paragraph to `## Deliberate shortcuts`,
  after the `CADENCE-DEBT` material that section already carries. It SUMMARIZES
  the marker grammar - the token followed immediately by a colon, then the
  registry id, then the ` | ` separator, then an `asserts:` clause saying what
  the count claims - plus the one rule that a marked site whose id no registry
  row names reddens the suite. It then points at
  `cadence-core/bin/lib/census-registry.mjs` as the carrier of the rest - what
  makes a count a census, why the table is hand-maintained, why subjects are
  narrow, why the table's own length is never asserted - instead of restating
  any of it. D-03 is the reason: this repo already enforces one carrier per rule,
  and `cadence-core/bin/prose-agreement.test.mjs:1553-1559` asserts the
  bulk-output rule has exactly one carrier file.
  Write NO literal marker line, and state the reason that is actually true for
  THIS token: the token followed immediately by a colon is what MAKES a marker,
  so a spelled-out example would be one. Do not give the harvest reason the
  `CADENCE-DEBT` paragraph gives for its own token (D-06) -
  `debt-harvest --root .` scans the tracked tree, while
  `cadence-core/bin/census-registry.test.mjs:114-121` walks only `.mjs` files
  under `cadence-core/bin/` and never reaches markdown, so the harvest reason
  here would be a self-claim no check catches. Keep the token backticked with no
  colon immediately following it anywhere in the file.
  Re-pin `cadence-core/bin/weight-budgets.json`'s entry for
  `cadence-core/references/conventions.md` to the file's new exact UTF-8 byte
  size in the SAME commit (D-07). The entry is 15457 today and equals the file's
  current size exactly, and `cadence-core/bin/self-verify.mjs:814-820` raises
  `budget-overrun` on any excess.
- **Verify:** `grep -c 'CADENCE-CENSUS:' cadence-core/references/conventions.md`
  returns 0 while `grep -c 'CADENCE-CENSUS' cadence-core/references/conventions.md`
  returns at least 1; `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun` problem; the JSON entry for that surface equals
  `wc -c < cadence-core/references/conventions.md`;
  `node cadence-core/bin/test.mjs prose` passes.

### Task 5: The seam-calls header names the plan it derives from

- **Files:** cadence-core/bin/seam-calls.test.mjs
- **Action:** Start at the header paragraph beginning "PLAN-2 task 6 stated 5 for
  `context.md`". That sentence names "PLAN-2 task 6" with no phase and no cycle, so
  it reads as the plan that re-pinned the row directly above it. It derives from
  v3.3.0 phase 4 (D-08): `git log --diff-filter=A` on this file returns exactly
  one commit, `ad1294c6 test(4-2): pin the per-workflow seam-invocation count
  with a census`, and `.planning/_archive-v3.3.0/4/PLAN-2.md:225-251` is "Task 6:
  Pin the per-workflow seam-invocation count with a census", which is where the 5
  for `context.md` is stated. Rewrite the sentence to name that archive PATH, so
  a reader can check the claim instead of having to know which cycle "PLAN-2"
  meant. Change nothing else: the paragraph's arithmetic and the two figures it
  defends stay as they are. ROADMAP criterion 3's "phase 5 plan" wording is
  WRONG - it was taken from the correct and different phase-5 reference on lines
  4-5 of this same header - so do not follow it. Leave the `CADENCE-CENSUS`
  marker at :139 and its 14 and 6 figures exactly as they are; this plan does not
  touch the `seam-call-counts` row.
- **Verify:** `grep -n '_archive-v3.3.0/4/PLAN-2.md'
  cadence-core/bin/seam-calls.test.mjs` returns the amended header line;
  `grep -c 'exactly 14 seam invocations and workflows/context.md exactly 6'
  cadence-core/bin/seam-calls.test.mjs` returns 1;
  `node --test cadence-core/bin/seam-calls.test.mjs` passes;
  `git diff cadence-core/bin/seam-calls.test.mjs` shows comment lines only.

## Notes

Plan shape follows the CONTEXT directive: one plan. The five tasks share
`cadence-core/bin/test.mjs` (tasks 1 and 3) and would fail the file-independence
test for a split anyway.

Mechanism chosen at planning, recorded per the discretion CONTEXT leaves open:
task 2 reads `GROUPS.planning` out of `cadence-core/bin/test.mjs` as source text
rather than importing it. Importing needs a run-as-script guard on the suite
entrypoint, whose failure mode is `node cadence-core/bin/test.mjs` exiting 0
having run nothing; a text read's failure mode is a red test. Task 2's Verify
pins the property either way.

Task 3 also corrects the "nothing else reads them" clause at
`cadence-core/bin/test.mjs:8-10`, which CONTEXT's scope boundary does not name.
It is not new scope: task 2's census makes that clause false, and leaving it is
the same stale-self-claim defect D-05 mandates fixing four lines below it, in the
same header, in the same file, in a commit this plan already leases.

CONTEXT D-11 leaves the `planning-detail-sites` 15-vs-14 disagreement between
the registry row and the marker at
`cadence-core/bin/planning-lease-check.test.mjs:315` as an open item. Nothing
asserts `counts`, so the suite is green either way, and fixing it here would pull
a file this phase never opens into the lease.
