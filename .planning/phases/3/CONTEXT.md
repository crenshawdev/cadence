# Phase 3: Pin the stem list and fix the prose - Context

Gathered: 2026-08-26
Feeds: /cad-plan 3

## Scope boundary

In: a new `cadence-core/bin/test-groups.test.mjs` asserting `GROUPS.planning`
against the `planning-*.test.mjs` files on disk in both directions, with a
matching row in `cadence-core/bin/lib/census-registry.mjs`; the missing
`planning-capture-check` stem added to that group; the two header comments that
argue against such a check corrected (`cadence-core/bin/test.mjs:11-15` and
`cadence-core/bin/census-registry.test.mjs:19-21`); a `CADENCE-CENSUS`
paragraph in `cadence-core/references/conventions.md`'s `## Deliberate
shortcuts` with `cadence-core/bin/weight-budgets.json` re-pinned in the same
commit; and the attribution at `cadence-core/bin/seam-calls.test.mjs:49`
corrected.

Out: the `planning-detail-sites` row's 15-vs-14 disagreement (open item, D-11);
any change to the `seam-call-counts` figures 14 and 6; any new group in
`GROUPS` or any stem re-homed out of `other` beyond `planning-capture-check`;
a coverage check over the whole `bin` tree - the census is scoped to the
`planning` group only.

Deferred: None.

Plan shape: one plan. Three edits over five files with no ordering constraint
between them, unlike phase 2 where criterion 1's own wording forced a split.

## Durable decisions

- D-01 (census shape): The census pins `GROUPS.planning` itself - the
  hand-typed list - by comparing it to the `planning-*.test.mjs` files on disk
  in BOTH directions: a file on disk named by no group entry fails, and an
  entry with no file fails. NO stem count is written down, so a legitimate new
  planning test costs one list edit rather than two. The shipped precedent is
  `rung-agent-files` (holder `cadence-core/bin/rung-agent.test.mjs`, subjects
  `cadence-core/bin/lib/rung-agent.mjs`, counting 19 rung file stems across six
  roles), which registers exactly this hand-list-versus-tree shape. That is
  what reconciles ROADMAP criterion 4's "passes its own registry check" with
  the registry header's D-05 rule that a number the test computes from the tree
  and checks against another computed number is a MEASUREMENT and takes no row:
  here one side of the comparison is written by a human. Typing the count as
  well, and shipping a derived-only check with no row after
  `cadence-core/bin/reason-census.test.mjs:56-75`, were both considered and
  refused - the first re-creates the re-pin churn on every honest addition, the
  second declines the row CEN-03 asks for.
- D-02 (registry row): The row's `subjects` is the single file
  `cadence-core/bin/test.mjs` and its `holder` is the new test file, never the
  directory. Replayed against this repository's own record on 2026-08-25 with
  the same corpus and filter as
  `cadence-core/bin/planning-lease-check.test.mjs:784-805`: 39 plans declare a
  path under `cadence-core/bin/`, so the half-the-plans rail's line is 19.5.
  Subject `cadence-core/bin/` refuses 39 of 39; subject
  `cadence-core/bin/test.mjs` with a separate test-file holder refuses 1 of 39;
  setting `holder` to `test.mjs` itself refuses 0, i.e. the row could never
  fire. Phase 1's own deviation narrowed the `reference-router-branches` row
  from a directory to one file for this exact reason
  (`cadence-core/bin/lib/census-registry.mjs:245-256`), and D-02 in that same
  header states holder and subjects are different paths on purpose.
- D-03 (prose authority): `cadence-core/references/conventions.md` SUMMARIZES
  the `CADENCE-CENSUS` grammar - the token, the immediate colon, the id, the
  ` | ` separator, the `asserts:` clause - plus the one rule that a marked site
  with no registry row reddens the suite, then points at
  `cadence-core/bin/lib/census-registry.mjs` for D-03 through D-06 rather than
  restating them. The single-carrier discipline is already enforced in this
  repo: `cadence-core/bin/prose-agreement.test.mjs:1553-1559` asserts the
  bulk-output rule has exactly one carrier file, and `lib/bulk-output.mjs:6`,
  `lib/scratch-path.mjs:6` and `lib/text-transport.mjs:5` each say "THE RULE
  ITSELF IS NOT HERE". Inverting it the way `CADENCE-DEBT` is split between
  `lib/debt-markers.mjs` and conventions.md was considered and refused: it
  re-homes roughly 60 lines of module header for no gain and moves
  authorship away from the file the checks live in.

## Decisions

- D-04 (drift on disk): `cadence-core/bin/planning-capture-check.test.mjs` is
  on disk and is NOT named in `GROUPS.planning`, so it runs in `other` today.
  Verified at gather time: 23 `planning-*.test.mjs` files on disk, 22 of them
  named in the group. Adding that stem is part of this phase's work - the new
  check fails on the live tree the moment it exists, and a plan written as if
  the tree were already consistent would read that red as its own bug.
- D-05 (stale self-claims): `cadence-core/bin/test.mjs:11-15` currently argues
  against the check being added - "There is deliberately NO coverage check... a
  manifest that could silently drop a file is the failure mode a coverage check
  would then have to exist to catch" - while the narrower counter-argument
  already sits in the same file at the `planning` group comment. Amend that
  header, and `cadence-core/bin/census-registry.test.mjs:19-21`, which cites it
  as settled rationale. A tree that ships a header denying the check beside it
  is the stale-self-claim defect class this repo already treats as a bug
  (`cadence-core/bin/seam-calls.test.mjs:1-5`).
- D-06 (prose): The stated reason for describing the marker WITHOUT writing a
  literal marker line is not `CADENCE-DEBT`'s. No walk ingests markdown for
  this token - `cadence-core/bin/census-registry.test.mjs:114-121` walks only
  `.mjs` files under `cadence-core/bin/`, whereas `debt-harvest --root .` scans
  the tracked tree, which is why conventions.md:57-58 gives the harvest reason
  for its own token. The reason here is the grammar's: the token followed
  IMMEDIATELY by a colon is what makes a marker, and a backticked mention never
  is. Stating the harvest reason for this token would be a self-claim no check
  would catch.
- D-07 (budget): Editing `cadence-core/references/conventions.md` re-pins
  `cadence-core/bin/weight-budgets.json` in the same commit, and the plan's
  `files:` lease must declare that JSON. The budget entry equals the file's
  exact current byte size, `cadence-core/bin/self-verify.mjs:814-820` raises
  `budget-overrun` on any excess, and the `weight-budgets` row's subject is
  `cadence-core/references/`, so `censusesAtRisk` refuses the plan at
  `check_census` before any executor is dispatched.
- D-08 (attribution): The header at `cadence-core/bin/seam-calls.test.mjs:49`
  derives from v3.3.0 PHASE 4's `PLAN-2` task 6, not a phase 5 plan.
  `git log --diff-filter=A` on that file returns exactly one commit,
  `ad1294c6 test(4-2): pin the per-workflow seam-invocation count with a
  census`, and `.planning/_archive-v3.3.0/4/PLAN-2.md:225-251` is "Task 6: Pin
  the per-workflow seam-invocation count with a census", stating the 5 for
  `context.md` that line 49 argues against. ROADMAP criterion 3 and
  `.planning/ARCHIVE.md:774` both say "phase 5 plan" and are wrong, apparently
  taken from the correct and different phase-5 reference on lines 4-5 of the
  same header. The corrected text names the archive path so the claim is
  checkable.
- D-09 (registry facts): The registry carries 13 rows today, not the 12 ROADMAP
  criterion 1 states - `reference-router-branches` was added by phase 1 of this
  cycle after the roadmap was written - and no length or count is asserted
  anywhere, so the new row re-pins no number. `lib/census-registry.mjs`'s
  header (D-04) and `census-registry.test.mjs:5-10` both instruct "Do NOT add a
  length or count export"; a plan written to reconcile the 12 would either add
  the forbidden export or hunt a discrepancy that is a stale roadmap figure.
- D-10 (lease): `cadence-core/bin/seam-calls.test.mjs` is a census holder, so
  the plan's `files:` must name it even though the edit is comment-only.
  `cadence-core/bin/planning-lease-check.test.mjs:459-481` refuses a staged
  census file the lease does not declare with `undeclared-census-files`, keyed
  off the staged path being a holder rather than off what changed inside it.
- D-11 (out of scope): The `planning-detail-sites` row says "the 14
  error-detail sites" while its marker at
  `cadence-core/bin/planning-lease-check.test.mjs:315` says "15 error-detail
  sites". `counts` is prose nothing asserts - `census-registry.test.mjs` arm
  (i) checks only that it is a non-empty string - so the suite is green either
  way. Left as an open item rather than fixed here: correcting it pulls a file
  this phase otherwise never opens into the lease.

## Acceptance criteria

- [ ] AC1: A `planning-*.test.mjs` file present on disk but absent from
      `GROUPS.planning` makes `node cadence-core/bin/test.mjs` fail, printing
      the offending stem; a stem named in `GROUPS.planning` with no file on
      disk fails the same way, printing that stem. Both directions checked
      against a mutated tree.
- [ ] AC2: `node cadence-core/bin/test.mjs --list` shows
      `planning-capture-check` under `planning`, not `other`, and the
      `planning` group's `planning-*` stems equal the 23 such files on disk.
- [ ] AC3: `cadence-core/bin/lib/census-registry.mjs` holds a row whose
      `holder` is `cadence-core/bin/test-groups.test.mjs` and whose `subjects`
      is exactly `['cadence-core/bin/test.mjs']`;
      `grep -c 'CADENCE-CENSUS' cadence-core/bin/test-groups.test.mjs` returns
      at least 1, and `node cadence-core/bin/census-registry.test.mjs` passes.
- [ ] AC4: `cadence-core/references/conventions.md`'s `## Deliberate
      shortcuts` section describes the `CADENCE-CENSUS` fields and states that
      a marked site with no registry row fails the suite, cites
      `cadence-core/bin/lib/census-registry.mjs` as the carrier of the rest,
      and `grep -c 'CADENCE-CENSUS:' cadence-core/references/conventions.md`
      returns 0.
- [ ] AC5: `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`,
      and `weight-budgets.json`'s entry for
      `cadence-core/references/conventions.md` equals that file's `wc -c`.
- [ ] AC6: `cadence-core/bin/seam-calls.test.mjs`'s header names v3.3.0 phase
      4's `PLAN-2` task 6 as the source of the 5-for-`context.md` figure it
      argues against, and the census marker at `:139` still asserts 14 for
      `workflows/plan.md` and 6 for `workflows/context.md`.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green.

## Flagged assumptions

- A new test file left unnamed in `GROUPS` lands in `other` and that is
  acceptable for this one, following `census-registry.test.mjs`'s own
  precedent - Likely; if a group placement is wanted instead, it is a one-line
  edit to the same list this phase already touches.
- The `planning-detail-sites` 15-vs-14 disagreement (D-11) is the only stale
  `counts` string in the registry - Unclear; nothing asserts `counts`, so a
  second one would be equally invisible. Left to a later sweep, not this phase.
