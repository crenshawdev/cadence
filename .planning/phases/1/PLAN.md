---
phase: 1
plan: 1
requirements:
  - RNG-06
files:
  - agents/cad-planner-low.md
  - agents/cad-planner-medium.md
  - agents/cad-assumptions-analyzer-low.md
  - agents/cad-assumptions-analyzer-medium.md
  - agents/cad-assumptions-analyzer-max.md
  - agents/cad-executor-low.md
  - agents/cad-executor-medium.md
  - agents/cad-executor-max.md
  - agents/cad-verifier-low.md
  - agents/cad-reviewer-low.md
  - agents/cad-plan-checker-max.md
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/config.schema.json
  - cadence-core/bin/self-verify.mjs
  - cadence-core/route-table.json
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/route-cells.test.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/weight.test.mjs
  - cadence-core/bin/read-trace.test.mjs
  - README.md
  - INTERNALS.md
---

# Phase 1: Every role has every rung - Plan

## Goal

Every one of the six roles offers every one of the five rungs, so a user's
effort choice is one uniform question per role instead of six different
questions with six different accepted sets.

## Must be true when done

- `agents/` holds thirty rung files, and reading the `effort:` line of every
  file yields `low`, `medium`, `high`, `xhigh` and `max` for each of the six
  roles.
- `rungFile(role, rung)` returns a non-null stem for all thirty role-rung
  pairs, and the file each stem names exists on disk.
- `cadence-core/bin/config.mjs check model.effort.<role>=<rung>` is accepted
  for all thirty pairs, and a value outside the ladder is refused naming the
  same five-rung set for every role.
- `node cadence-core/bin/self-verify.mjs` reports `ok: true` with no
  `unbudgeted-surface`, no `budget-overrun`, no `effort-enum-drift` and no
  `undeclared-rung-agent`.
- Within each role, every rung file's post-frontmatter body is byte-identical
  to its siblings'.
- The nineteen existing agent filenames are unchanged: `git diff --name-status`
  over this phase's commits shows only `A` and `M` under `agents/`, never `R`
  or `D`.
- `node cadence-core/bin/test.mjs` passes, and no test or shipped doc asserts
  the rung-file count nineteen.

## Context

CONTEXT.md locks: D-01 purely additive in the existing naming style, the
nineteen filenames untouched and the analyzer's inversion preserved; D-02 all
six roles get all five rungs including `cad-executor` and `cad-planner` at
`low`; D-04 each new file's post-frontmatter body is its role's existing body
byte for byte (the two-line pointer `rungBody` states); D-05 `RUNG_FILES` in
`cadence-core/bin/lib/rung-agent.mjs` stays the single source of the
role-to-file map; D-06 `weight-budgets.json` gains its eleven rows in the same
commit as the files.

Three surfaces outside CONTEXT's "Out" list are touched because AC3 is
unreachable without them, measured 2026-09-04 and detailed in Notes: the
`model.effort.*` enums in `config.schema.json`, the disk-to-table arm of
self-verify's check 8, and the shipped docs that state the count nineteen.
Out and untouched: every `cells`/`review`/`tiers`/`efforts`/`verify` value in
`route-table.json`, the `stakes` key, `model_aliases`, and the roles block -
those are phases 2 and 3.

## Tasks

### Task 1: Retire the orphan-rung half of the ladder check

- **Files:** cadence-core/bin/self-verify.mjs (check 8's disk-to-table arm and
  the check-8 line of the header comment), cadence-core/bin/self-verify.test.mjs
  (the two `check 8 (reverse)` tests), cadence-core/bin/route.test.mjs (the
  closing half of `every rung a cell can name has an agent file carrying
  exactly that effort`), cadence-core/route-table.json (`_meta.rungs` string
  only), README.md, INTERNALS.md
- **Action:** Check 8's disk-to-table arm files `undeclared-rung-agent` on two
  faults that want opposite fixes, selected by its `mapped` local: a rung file
  `RUNG_FILES` NAMES that no cell reaches, and a rung file the map does not
  name at all. Keep the second and delete the first, so the arm reports only
  the stale-file fault whose detail reads "maps no file to it". The first is
  the fault every one of this phase's eleven new files is, by design: D-03
  leaves them unreferenced by any routing cell until phase 2's roles block can
  name them, and phase 3 deletes the grid that would have named them, so the
  branch would fail for the whole of this cycle and gate it on itself. This is
  a NARROWING of a shipped rule, not a new one, and the stale-file arm stays at
  full strength - a file like `agents/cad-verifier-high.md`, whose stem the map
  does not file for that role's rung, is still refused. Do not widen it to
  unsuffixed files, which would outlaw the one-off agent the check deliberately
  keeps legal. `route.test.mjs` carries the same orphan assertion a second time,
  in the loop that walks `rungFiles(role)` against the stems its cells reach and
  fails with "is named by no cell"; delete that closing loop and leave the rest
  of the test - the cell-to-disk direction, the `byName.size` count and the
  frontmatter-effort comparison - exactly as it stands, since none of them
  moves in this phase. Then make the prose true rather than leaving three
  surfaces claiming a check that no longer runs: `route-table.json`'s
  `_meta.rungs` note, `README.md`'s "self-verify fails in both directions"
  sentence in the rungs paragraph, and the "and the stale reverse, a rung file
  no cell reaches" clause in `INTERNALS.md`'s effort paragraph. Touch nothing
  else in `route-table.json` - no cell, no vocabulary array - the file is in
  this lease for its `_meta` string alone.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with `ok: true`;
  `grep -c "no cell at any level resolves to it" cadence-core/bin/self-verify.mjs`
  returns 0; `node --test cadence-core/bin/self-verify.test.mjs
  cadence-core/bin/route.test.mjs` passes, with one check-8 reverse test showing
  a fixture rung file the map NAMES and no cell reaches produces no
  `undeclared-rung-agent`, and the other showing a fixture stem the map does not
  name still produces one whose detail matches "maps no file to it"; and
  `grep -rn "both directions" README.md INTERNALS.md cadence-core/route-table.json`
  returns no line about rung files.

### Task 2: Retarget the fixtures that assume a role lacks a rung

- **Files:** cadence-core/bin/route-cells.test.mjs (`a cell rung that maps to no
  agent file is missing-rung-agent naming the cell`, `the starting rung is
  checked as well as the retry rung`, `routableAgents skips a rung with no file
  rather than inventing a stem`), cadence-core/bin/route.test.mjs (`a
  hand-edited rung the role has no FILE for is refused, never fail-open
  dispatched`), cadence-core/bin/rung-agent.test.mjs (`a rung the role does not
  carry is null, never a guessed filename`, `rungPrefixIssues: a stem the map
  does not name is not this rule's business`)
- **Action:** Five tests currently reach their subject by naming a rung that a
  REAL role happens not to have - `cad-verifier` at `low`, `cad-executor` at
  `max`, the stem `cad-executor-low` - and task 3 makes every one of those
  pairs real, so each test would stop exercising the branch it was written for.
  Retarget each so it still proves the same thing after the ladder is complete,
  and keep every assertion about the message's shape. In
  `route-cells.test.mjs`, the `table()` helper already takes the role as its
  first parameter, so a table built for a role `RUNG_FILES` names no files for
  is the way to reach `missing-rung-agent` and the `routableAgents` skip once
  no (declared role, `rung_order` rung) pair is unmapped; note that such a
  table produces the issue for BOTH the `effort` and the `retry` of every
  level, so a test asserting the retry arm must select that issue by its own
  level and the word retry rather than taking the first hit. In
  `route.test.mjs`, the hand-edited config must carry a value outside
  `rung_order` entirely so `rungFile` still returns null; the existing
  assertions that the resolve holds at the cell's rung, dispatches the cell's
  file and warns once naming the key stay as they are, and the assertion on the
  rungs the role does have must stay satisfiable by the fuller set task 3
  ships. In `rung-agent.test.mjs`, the null case and the unmapped-stem fixture
  need a rung token no role will ever file. Do NOT reach for a role that is not
  in `route-table.json`'s `roles` array where the test needs a DECLARED role,
  and do not touch any count in this file - the counts move in task 3 with the
  map. This task is deliberately ordered before the ladder so each edit is
  green on both sides of it, which is what lets it be its own commit.
- **Verify:** `node --test cadence-core/bin/route-cells.test.mjs
  cadence-core/bin/route.test.mjs cadence-core/bin/rung-agent.test.mjs` passes
  against the nineteen-file ladder still on disk, and `node
  cadence-core/bin/test.mjs` passes.

### Task 3: The eleven missing rung files, and the ladder that names them

- **Files:** agents/cad-planner-low.md, agents/cad-planner-medium.md,
  agents/cad-assumptions-analyzer-low.md,
  agents/cad-assumptions-analyzer-medium.md,
  agents/cad-assumptions-analyzer-max.md, agents/cad-executor-low.md,
  agents/cad-executor-medium.md, agents/cad-executor-max.md,
  agents/cad-verifier-low.md, agents/cad-reviewer-low.md,
  agents/cad-plan-checker-max.md, cadence-core/bin/lib/rung-agent.mjs
  (`RUNG_FILES`), cadence-core/bin/weight-budgets.json,
  cadence-core/config.schema.json (the six `model.effort.*` keys),
  cadence-core/bin/rung-agent.test.mjs, cadence-core/bin/config.test.mjs,
  cadence-core/bin/weight.test.mjs, cadence-core/bin/read-trace.test.mjs,
  README.md, INTERNALS.md
- **Action:** Create each new file by copying any existing rung file of the SAME
  role and changing exactly three frontmatter lines - `name:` to the new stem,
  `description:` to the clause every suffixed sibling already carries ("The
  `<rung>` rung of `<role>`; `bin/route.mjs` picks it, not the user."), and
  `effort:` to the new rung. Copying is the method, not a shortcut: `tools:`,
  `disallowedTools:`, `color:`, `maxTurns:` and `skills:` differ per role and
  must land identically, and the post-frontmatter body must be byte-identical
  to its siblings' or `rungPrefixIssues` files `rung-prefix-split` - the rule
  is D-04 and the v3.7.4 phase 2 UAT states it as one distinct body per role
  across every rung file of that role. Add the eleven entries to `RUNG_FILES`
  in low-to-max order within each role: that declared order is what `rungFiles`
  returns, what the tie-break in `rungPrefixIssues` uses, and what
  `effortEnumIssues` compares the schema enum against element by element, so an
  out-of-order insert reads as drift. Leave the analyzer's inversion alone -
  its `xhigh` is the unsuffixed file and its `high` is the `-high` sibling.
  Then bring the two derived surfaces back into agreement in this same commit:
  every `model.effort.<role>` enum in `config.schema.json` becomes the role's
  full rung list followed by `null`, which for all six is now the same five
  rungs, or self-verify files `effort-enum-drift` and `config.mjs` starts
  refusing rungs that have files; and `weight-budgets.json` gains a row per new
  file pinned at its measured byte size, in the existing alphabetical order and
  with no reformatting of the rows already there, since an agent surface with
  no budget row is `unbudgeted-surface` (the v3.7.11 phase 2 UAT names the
  re-pin-in-the-same-commit rule). Four test files and two docs pin the old
  shape and must move with it, and they cannot move before it: the two counts
  and the `cad-verifier` stem list in `rung-agent.test.mjs` plus the "19 file
  stems" wording of its CADENCE-CENSUS marker, the loop count in
  `read-trace.test.mjs`, the executor's agent list in `weight.test.mjs`'s
  `--role` row, the four `config.test.mjs` rows whose expected refusal message
  spells a role's accepted set (their refused VALUE must also move outside the
  ladder, since no role lacks a rung any more), `README.md`'s "Today it is N
  skills and M agent roles across K rung files" sentence, and `INTERNALS.md`'s
  two "19" claims in the effort paragraph. Rename nothing and delete nothing
  under `agents/`.
- **Verify:** `ls agents/*.md | wc -l` is 30, and a loop reading the `effort:`
  line of every file yields exactly `low`, `medium`, `high`, `xhigh` and `max`
  once each for every one of the six roles; a node one-liner importing
  `RUNG_FILES` shows thirty stems, each resolving through `rungFile` and each
  naming a file that exists under `agents/`; `node
  cadence-core/bin/self-verify.mjs` exits 0 with `ok: true` and an empty
  `problems` array; `node cadence-core/bin/config.mjs check
  model.effort.cad-executor=low` returns `ok: true` and the same check with a
  value outside the ladder returns `ok: false` whose error names all five rungs
  and `null`; `node cadence-core/bin/test.mjs` passes and `npx tsc -p
  tsconfig.ci.json` exits 0; `grep -rn "across 19 rung files" README.md` and
  `grep -c "all 19" INTERNALS.md` both return nothing;
  `grep -n "\\b19\\b" cadence-core/bin/rung-agent.test.mjs
  cadence-core/bin/read-trace.test.mjs cadence-core/bin/weight.test.mjs
  cadence-core/bin/config.test.mjs` returns nothing and the
  `CADENCE-CENSUS: rung-agent-files` marker reads thirty rather than nineteen -
  the suite alone does not settle the no-test-pins-19 criterion, since a skipped
  or fixture-only test carries the literal past a green run; and `git diff
  --name-status` over this phase's commits shows only `A` and `M` under
  `agents/`.

## Notes

**Requirement id.** `RNG-06` is the next free number in the `RNG` cluster
(`RNG-01` through `RNG-05` are shipped rows). It reads: every role offers every
rung, so a user's effort choice is one uniform question per role rather than a
per-role subset. It is the phase's fifth success criterion - `GH-249` traces to
a REQUIREMENTS row pointing at Phase 1. `/cad-plan`'s `seed-reqs` call writes
that row, but ONLY because `RNG-06` now has an `## Active` bullet in
REQUIREMENTS.md: `planning/seed-reqs.mjs` bounds seeding by `parseActiveIds`
and an id with no bullet there is reported as an orphan and never seeded. The
bullet was added 2026-09-04, after the `plan` review's second survivor found
this phase could otherwise verify green with its fifth criterion false.

**Plan shape.** One plan, as the CONTEXT directive says. No deviation. The
three tasks share `route.test.mjs`, `rung-agent.test.mjs`, `README.md` and
`INTERNALS.md` and are strictly ordered, so a split would be a shared-file
split, which the independence test forbids anyway.

**Task 3 is twenty files and one concern.** Eleven of them are the same
generated artifact and the other nine are the surfaces that stop agreeing the
moment the map changes. It cannot be split into green commits: the eleven files
without `RUNG_FILES` trip the stale-file arm, `RUNG_FILES` without the schema
trips `effort-enum-drift`, and the counts in four test files and two docs are
false on either side of the change. Splitting it by role instead would re-pin
the same four assertions two or three times.

**Three departures from CONTEXT's scope boundary, measured 2026-09-04.** The
boundary lists as Out "any change to config schema" and adds "No new
self-verify rule", and AC3 (self-verify `ok: true`) cannot be met inside it.
Both were reproduced by building the whole change in a copy of the tree and
running `self-verify.mjs --root` against it:

1. `effortEnumIssues` in `lib/rung-agent.mjs` holds each `model.effort.<role>`
   enum in `config.schema.json` against `[...Object.keys(RUNG_FILES[role]),
   null]`, element by element. Eleven map entries with no schema edit produced
   six `effort-enum-drift` problems, one per role. The enums are derived from
   the map by a shipped check, so they are phase 1's own subject rather than
   phase 2 or 3 work.
2. D-03 reads `route-cells.mjs:249` as filing `missing-rung-agent` for the
   dangerous direction only, and that is true of `cellIssues` - but the reverse
   arm lives directly in `self-verify.mjs` check 8, keyed on the rung-suffixed
   filename shape and `rung_order`. All eleven new files tripped it as
   `undeclared-rung-agent`. Every other way out is explicitly Out (adding
   cells, editing `rung_order`) or breaks D-01 (naming files off-convention),
   so narrowing that arm is the only in-boundary path and Task 1 takes it.
   D-03's own reasoning - a rule for the reverse would fail for the whole of
   phase 1 and gate the cycle on itself - is the argument for narrowing it.
3. `README.md:139` and `INTERNALS.md:11` state the count nineteen, and
   `prose-agreement.test.mjs` measures the README sentence against the tree, so
   AC6 (the suite passes, no test asserts nineteen) reaches the docs too.

**LINEAGE.md is deliberately left stale.** It carries "19 rung files" twice.
`prose-agreement.test.mjs` states in its own comment that LINEAGE.md duplicates
the counts, already publishes a stale agents row, is excluded from self-verify
and stays a queue item. Correcting it is a standing decision this phase does
not reopen.

**What Task 2's retargets cost.** With the ladder complete, no real role lacks
a real rung, so those tests can no longer prove "refused BY ROLE" - only
"refused as not a rung of this role's set". The by-role claim is not lost:
`config.test.mjs`'s `every model.effort enum is exactly that role's rung set
from RUNG_FILES` row still holds the schema against the map for all six roles,
and self-verify holds the same invariant for CI.

**Proven before writing.** The full change set was built in a scratch copy of
the tracked tree and measured there: `self-verify.mjs --root` reports `ok:
true` with an empty `problems` array, and a full-suite run differs from that
same tree's unmodified baseline by zero failures. `npx tsc -p tsconfig.ci.json`
was not exercised in the copy (no `node_modules`) and must be run in the repo.
