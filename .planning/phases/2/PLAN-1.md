---
phase: 2
plan: 1
requirements: [CEN-01]
files:
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/bin/census-registry.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/text-transport.test.mjs
  - cadence-core/bin/bulk-output.test.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/deferred-reads.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
---

# Phase 2: Census registry and plan-time lease check - Plan 1 (the registry)

## Goal

The repository's hand-maintained census counts stop being invisible as a class:
one frozen table names each one - the file holding it, what it counts, the site
that asserts it, and the narrow subject path set it is taken over - and a census
site carrying the marker with no row in that table fails the suite.

## Must be true when done

- A single module under `cadence-core/bin/lib/` exports the registry as a frozen
  table, and it can be imported by a seam without a second copy of the table
  existing anywhere.
- The registry holds a row for each of the NINE hand-maintained censuses this
  tree carries - `self-verify.test.mjs`, `arg-contract.test.mjs`,
  `trace.test.mjs`, `weight-budgets.json`, `text-transport.test.mjs`,
  `bulk-output.test.mjs`, `rung-agent.test.mjs`, `deferred-reads.test.mjs` and
  `planning-lease-check.test.mjs` - and each row names four things: the file
  holding the count, what it counts, the site that asserts it, and its narrow
  subject path set. Nine is every census this repository has, not a sample:
  CEN-01 says every one is registered, so a known count left out is the
  requirement unmet.
- A census site in the tree carrying the marker with no registry row fails the
  suite, and the failure names the file and the assertion. Removing the row for
  a marked site reddens the suite; putting it back greens it.
- The nine census sites above carry the marker in the live tree, and the walk
  that finds them is provably non-vacuous.
- Asking the registry which registered censuses a declared file list puts at
  risk is one call over the table, answered through
  `cadence-core/bin/lib/lease-grammar.mjs`'s existing predicates rather than a
  second containment rule.
- `node cadence-core/bin/test.mjs` reports 0 failures and
  `node cadence-core/bin/self-verify.mjs` reports zero problems.

## Context

Locked decisions that bind this plan: D-01 (the registry is a frozen table in a
NEW `cadence-core/bin/lib/` module - not JSON, not a config key, not a table
inside a `.test.mjs`, because plan 2's seam must IMPORT it), D-02 (a row carries
a fourth field, the SUBJECT path set the census counts over, distinct from the
file that holds it), D-03 (subjects are NARROW and hand-written per entry, and
that narrowing is itself hand-maintained), D-04 (the registry asserts its rows'
SHAPE, never its row COUNT, so it needs no exemption from itself), D-05 (DERIVED
numbers are excluded - a number the test computes from the tree at run time is a
measurement no plan can invalidate), D-06 (discovery is a LEXICAL MARKER on the
`CADENCE-DEBT` model, with the stated cost that an unmarked census is invisible).

Patterns to follow: `cadence-core/bin/lib/deferred-reads.mjs` (pure hand-
maintained table in `lib/`, disk half in `self-verify.mjs`, header states why
the table is hand-maintained), `cadence-core/bin/lib/debt-markers.mjs` (the
marker head built from the token rather than written as a literal, so the file
is not itself ingested as a marked site), `cadence-core/bin/helper-census.test.mjs`
(a tree walk with a non-vacuity bound and a self-reference that needs no
exemption).

Out of scope here: `cadence-core/bin/planning/lease-check.mjs`, the
`workflows/plan.md` wiring and the trace record - all of those are plan 2, which
READS this plan's module and does not edit it.

## Tasks

### Task 1: Create the registry module and its four rows

- **Files:** cadence-core/bin/lib/census-registry.mjs
- **Action:** Create the module. It exports one frozen, deeply frozen table of
  census entries. Each entry carries a stable `id` used to join a marker to its
  row, plus the four things AC1 requires: the file that HOLDS the count, prose
  saying what it counts, the site that ASSERTS it, and the narrow subject path
  set the count is taken over. The nine rows, with the values measured in this
  tree on 2026-08-24:
  (a) `cadence-core/bin/self-verify.test.mjs`, holding "sixteen `mergeLayers(`
  callsites over twelve files, each in one of the two warning-surfacing arms",
  asserted by the test named `check 12: the live tree is SIXTEEN callsites over
  TWELVE files, each in an arm`, over the twelve subject paths
  `cadence-core/bin/config.mjs`, `cadence-core/bin/forge.mjs`,
  `cadence-core/bin/git-branch.mjs`, `cadence-core/bin/git-guard.mjs`,
  `cadence-core/bin/git-publish.mjs`, `cadence-core/bin/issue-check.mjs`,
  `cadence-core/bin/land-cleanup.mjs`, `cadence-core/bin/planning/core.mjs`,
  `cadence-core/bin/planning/risk-check.mjs`, `cadence-core/bin/planning/trace.mjs`,
  `cadence-core/bin/review-provider.mjs`, `cadence-core/bin/route.mjs`.
  `cadence-core/bin/lib/config-merge.mjs` is deliberately NOT a subject: that
  test's own `skip` excludes it, so editing it cannot move the count.
  (b) `cadence-core/bin/arg-contract.test.mjs`, holding "the flag entries the
  `CONTRACTS` table declares and its top-level row count", asserted by the test
  named `every flag in every row declares a complete grammar`, over the single
  subject `cadence-core/bin/lib/arg-contract.mjs`.
  (c) `cadence-core/bin/trace.test.mjs`, holding "each of the four refusing
  trace flags' sentences appears exactly once across the whole planning seam",
  asserted by the test named `the four refusing trace flags carry ONE sentence
  each, in one map`, over the two subjects `cadence-core/bin/planning.mjs` and
  `cadence-core/bin/planning/` (a directory lease - that test deliberately reads
  the whole seam, not the entry file).
  (d) `cadence-core/bin/weight-budgets.json`, holding "the exact UTF-8 byte size
  of each budgeted prose surface", asserted by `cadence-core/bin/self-verify.mjs`'s
  budget check (the `budget-overrun` arm), over the five subjects `agents/`,
  `cadence-core/references/`, `cadence-core/templates/`,
  `cadence-core/workflows/` and `skills/` - measured 2026-08-24, those five
  directory leases cover all 111 budgeted keys, so copying the key list into
  this table would be a second copy of `weight-budgets.json` and is refused.
  Row (d) stretches criterion 1's "the test that asserts it" to a non-test
  asserting site on purpose (D-08): it is the one census every prose-editing
  plan in this repository invalidates.
  (e) `cadence-core/bin/text-transport.test.mjs`, holding "the register's own
  row count and its derived-row count - 36 and 20", asserted by the test named
  `the register pins its row count` (`text-transport.test.mjs:45-46`), over the
  single subject `cadence-core/bin/lib/text-transport.mjs`.
  (f) `cadence-core/bin/bulk-output.test.mjs`, holding "the register's row
  count and its two transport splits - 17, 4 redirect and 3 file", asserted by
  the test named `the register pins its row count` (`bulk-output.test.mjs:54`),
  over the single subject `cadence-core/bin/lib/bulk-output.mjs`.
  (g) `cadence-core/bin/rung-agent.test.mjs`, holding "the 19 rung file stems
  across the six roles, each serving exactly one rung", asserted by the test
  named `RUNG_FILES names 19 files across the six roles, and is frozen`
  (`rung-agent.test.mjs:80`), over the single subject
  `cadence-core/bin/lib/rung-agent.mjs`.
  (h) `cadence-core/bin/deferred-reads.test.mjs`, holding "the register's 10
  rows, pinned alongside a byte-identical slice of the export's own source",
  asserted by the test named `register: the surviving cut rows are
  byte-identical, and the register is exactly the rows the cuts made`
  (`deferred-reads.test.mjs:153`), over the single subject
  `cadence-core/bin/lib/deferred-reads.mjs`.
  (i) `cadence-core/bin/planning-lease-check.test.mjs`, holding "the 14 error-
  detail sites across the whole planning seam and the 6 of them wrapped in
  `redactUrl`", asserted at `planning-lease-check.test.mjs:313-314` inside the
  test named `source: planning.mjs's no-staged-set detail goes through
  redactUrl`, over the two subjects `cadence-core/bin/planning.mjs` and
  `cadence-core/bin/planning/` - the union `seamSource()` reads
  (`planning.test.mjs:53-55`), the same subject pair row (c) carries.
  Rows (e) through (i) are the five counts this plan's own Notes previously
  listed as out of scope. They are IN scope because CEN-01 and criterion 1 both
  say EVERY hand-maintained census, and a count already named and measured is
  not one D-06's marker cost can excuse - D-06 explains why an UNKNOWN census
  is invisible, not why a known one may be skipped.
  Row (i)'s subject pair is wide by necessity rather than by choice: that census
  is taken over the concatenated seam, so a narrower subject would not be what
  the assertion pins. Its cost is real and is measured rather than assumed -
  plan 2's replay task records its refusal count against the same under-half
  bound every other row answers to.
  The module header states, in this order: why the table is hand-maintained and
  what a row costs (the `lib/deferred-reads.mjs` header is the model); D-03's
  rule that subjects are NARROW and hand-written, scoped to what the assertion
  actually pins rather than to whatever the census really scans, with the
  measurement behind it - a `cadence-core/bin/` subject for the whole-tree
  `helper-census.test.mjs` walk would have refused 38 of 40 historical plans and
  `walk(binDir)` gives 22 of 40, and `cadence-core/bin/planning/lease-check.mjs`'s
  own header says a rail that fires wrong gets deleted, not tuned; D-05's line
  between a census and a DERIVED measurement, citing
  `cadence-core/bin/seam-calls.test.mjs`'s own statement that its numbers are
  derived and never baselined; and D-04's reason this table's own length is
  never asserted - a length assertion would make adding a row a census-
  invalidating act and put the registry in its own table, so the shape of the
  rows is what gets asserted instead. Do NOT add a length or count export: that
  is the exact self-reference D-04 rejects.
- **Verify:** A `node --input-type=module -e` one-liner importing the module's exported table prints 9 rows with nine distinct ids, and each row prints a holding file, a what-it-counts string, an asserting site and a non-empty subject list; three further one-liners each throw - pushing onto the table, assigning to a row's own `id` field, and pushing onto a row's subject list - so the freeze is proven at the table, the entry object and the nested array rather than at the outer two only.

### Task 2: Add the marker grammar and the unregistered-census rule

- **Files:** cadence-core/bin/lib/census-registry.mjs
- **Action:** Extend the module with the discovery half, as PURE functions over
  text - no `fs`, no walk, no throw, the split `lib/debt-markers.mjs` states
  ("the caller owns the tree walk, the file reads and the envelope; this owns
  the grammar"). Export the marker token as its own constant, spelled
  `CADENCE-CENSUS`, and build the marker head (token immediately followed by a
  colon) by concatenation rather than writing the head as a literal anywhere in
  this file - `lib/debt-markers.mjs` does exactly this, and
  `cadence-core/references/conventions.md`'s marker section requires that
  documentation about the convention never contain a literal marker, because the
  scanner walks tracked source and would ingest its own prose as a marked site.
  Verified 2026-08-24: `git grep -w CADENCE-CENSUS` returns nothing in this
  tree, so the token collides with neither `CADENCE-DEBT` nor anything else, and
  `lib/debt-markers.mjs`'s head is a different string so the debt harvest cannot
  pick these up.
  The grammar: the head, then the registry `id`, then ` | ` and a field named
  for what the site asserts, carrying one line naming the assertion. Both parts
  are required; a marker missing the second is RETURNED with that field flagged,
  never dropped, for `lib/debt-markers.mjs`'s stated reason - dropping it makes
  an incomplete marker invisible, which is worse than the marker.
  Then export the rule that turns marked sites into issues: given the marked
  sites found in one file's text and that file's path, every marker whose `id`
  matches no registry row is an issue naming the path, the line, the id and the
  marker's own one-line statement of the assertion. A marker whose id DOES match
  a row is not an issue. Do not add the reverse direction - a registry row with
  no marked site is not an issue here; D-06 states one direction only.
- **Verify:** `node --test cadence-core/bin/census-registry.test.mjs` does not exist yet, so verify by one-liners: a `node --input-type=module -e` call passing a synthesized line carrying the marker head plus an id no row uses returns exactly one issue whose message contains the file path and the assertion text; the same call with one of the nine real ids returns an empty array; and a string naming the token WITHOUT a following colon returns no markers at all.

### Task 3: Add the lease predicate over the registry

- **Files:** cadence-core/bin/lib/census-registry.mjs
- **Action:** Add the one relation available at plan time (D-10): given a list
  of declared file paths, return the registry entries the declarations put at
  risk - an entry qualifies when some declaration intersects one of its subject
  paths AND no declaration covers the entry's own holding file. Both halves go
  through `intersects` and `covers` imported from
  `cadence-core/bin/lib/lease-grammar.mjs`; never re-implement either, because
  `helper-census.test.mjs`'s `covers` row fails the suite on a second copy of
  that body and the two-readers-one-rule divergence is what that module exists
  to close. Pure: no `fs`, no git, no envelope - the caller owns those. The
  return names, per entry, the file the lease is missing and enough of the row
  to say which census it holds, so a caller can render "this file, for this
  census" without opening the table again.
  This predicate lives HERE rather than in the seam because plan 2 must read
  this module without editing it, and because a pure predicate is what makes
  plan 2's historical replay possible without a seam invocation per plan.
  It reads paths and nothing else: a PLAN's Action prose and the census test's
  own body are both out of reach by construction, which is criterion 2's "reads
  the lease and the registry only".
- **Verify:** `node --input-type=module -e` passing the five paths phase 5's PLAN-1 declared - `cadence-core/bin/planning.mjs`, `cadence-core/bin/planning/`, `cadence-core/bin/helper-census.test.mjs`, `cadence-core/bin/prose-agreement.test.mjs`, `cadence-core/bin/planning.test.mjs` - returns exactly THREE entries, holding `cadence-core/bin/trace.test.mjs`, `cadence-core/bin/self-verify.test.mjs` and `cadence-core/bin/planning-lease-check.test.mjs` - the third because row (i) carries the same `planning.mjs` + `planning/` subject pair row (c) does and that lease declares neither holding file; the same call with those three appended returns an empty list.

### Task 4: Write the registry's own test file

- **Files:** cadence-core/bin/census-registry.test.mjs
- **Action:** Create the test file. Three arms.
  (i) SHAPE, per D-04: every row carries the id, the holding file, what it
  counts, the asserting site and a non-empty subject list; ids are distinct;
  every subject and every holding file is a plain repo-relative path that
  `lib/lease-grammar.mjs`'s `isRefusedSpelling` does not refuse; the table and
  each row's subject list are frozen against mutation. Assert NO row count -
  D-04 is the reason, and a length assertion here would be the census this
  phase exists to prevent.
  (ii) THE FIXTURE PAIR, which is AC2's proof: build a synthesized source text
  carrying a marker whose id no row uses, and assert the rule reports exactly
  one issue whose text names the fixture's file path and the marker's assertion
  line; then the same text with a real row's id, and assert no issue. Build
  every fixture string from the exported token by concatenation, never as a
  literal marker head, or arm (iii) below will walk this file and find the
  fixtures as real marked sites - the `lib/merge-warnings.mjs` discipline
  `helper-census.test.mjs` states, where the fix belongs in the pattern and
  never in a second exclusion list.
  (iii) THE LIVE TREE: walk every `.mjs` file under `cadence-core/bin/`,
  including `lib/` and `.test.mjs` files, since a census site LIVES in a test
  file; collect every marked site; assert the issue list is empty, so a marked
  site with no row reddens the suite. Guard the walk against vacuity the way
  `helper-census.test.mjs` does - assert the walk reached more than 60 modules
  and includes `cadence-core/bin/lib/census-registry.mjs` itself - because a
  walk that silently reached nothing makes this arm pass by measuring nothing.
  No entry is needed in `cadence-core/bin/test.mjs`'s `GROUPS`: a stem no group
  names lands in `other`, which the default run and CI both execute, and that
  file's header states this is deliberate.
- **Verify:** `node --test cadence-core/bin/census-registry.test.mjs` passes with 0 failures, and its output shows the live-tree arm asserting a walk of more than 60 modules. Deleting one of the nine rows from the table and re-running the fixture arm reddens; restoring it greens.

### Task 5: Mark the nine live census sites

- **Files:** cadence-core/bin/self-verify.test.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/trace.test.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/text-transport.test.mjs, cadence-core/bin/bulk-output.test.mjs, cadence-core/bin/rung-agent.test.mjs, cadence-core/bin/deferred-reads.test.mjs, cadence-core/bin/planning-lease-check.test.mjs
- **Action:** Put the marker at each of the nine asserting sites named in the
  registry, one line each, in the comment syntax the file already uses, with the
  row's `id` and a one-line statement of what that assertion pins.
  `cadence-core/bin/self-verify.test.mjs` at the `check 12: the live tree is
  SIXTEEN callsites over TWELVE files, each in an arm` test;
  `cadence-core/bin/arg-contract.test.mjs` at the `every flag in every row
  declares a complete grammar` test, beside the entry-count assertion;
  `cadence-core/bin/trace.test.mjs` at the `the four refusing trace flags carry
  ONE sentence each, in one map` test; `cadence-core/bin/self-verify.mjs` at the
  budget check's `budget-overrun` arm; `cadence-core/bin/text-transport.test.mjs`
  and `cadence-core/bin/bulk-output.test.mjs` at each file's `the register pins
  its row count` test; `cadence-core/bin/rung-agent.test.mjs` at the `RUNG_FILES
  names 19 files across the six roles, and is frozen` test;
  `cadence-core/bin/deferred-reads.test.mjs` at the `register: the surviving cut
  rows are byte-identical, and the register is exactly the rows the cuts made`
  test, beside its `DEFERRED_READS.length` assertion; and
  `cadence-core/bin/planning-lease-check.test.mjs` at the `IDIOM` / `WRAPPED`
  count assertions inside `source: planning.mjs's no-staged-set detail goes
  through redactUrl`. Change NOTHING else in these nine files -
  no count is re-pinned here and no assertion is rewritten; the marker is a
  comment and must not move a number.
  Two placement constraints in `self-verify.mjs`: put the marker BELOW line 104,
  so `.planning/DOCS-CLAIMS.md`'s `SELFVERIFY-01` row (which pins that file at
  `90-104`) stays true; and accept that the four `self-verify.mjs:927` and
  `:1236` citations inside `prose-agreement.test.mjs` and
  `citation-census.test.mjs` comments shift by the line this adds -
  `citation-census.test.mjs`'s own header states that a claim about
  `self-verify.mjs` "is a different seam's record and stays out of this census",
  so nothing enforces them and they are deliberately not chased here.
- **Verify:** `node --test cadence-core/bin/census-registry.test.mjs` passes and its live-tree arm now finds exactly nine marked sites, all registered. `node cadence-core/bin/test.mjs` reports 0 failures and `node cadence-core/bin/self-verify.mjs` reports zero problems, proving no count moved. Deleting any one of the nine registry rows and re-running the suite reddens with a message naming that file and its assertion.

## Notes

- This phase splits into two plans against a task ceiling of 8 (9 tasks are
  needed end to end), at the seam CONTEXT's `Plan shape` directive names. The
  two plans SHARE three declared paths - `cadence-core/bin/arg-contract.test.mjs`
  (this plan marks its census site; plan 2 re-pins the flag-entry count the new
  `--plan-time` row moves) and `cadence-core/bin/trace.test.mjs` (this plan
  marks its census site; plan 2 must declare it because its own edit to
  `cadence-core/bin/planning/lease-check.mjs` lands inside that census's
  subject), plus `cadence-core/bin/planning-lease-check.test.mjs` (this plan
  marks its census site under row (i); plan 2 writes every fixture arm into it).
  They are therefore SEQUENTIAL, plan 1 first, not parallel - which
  they would have been anyway, since plan 2 imports the module plan 1 creates.
  No shared path can be moved to one side: the marker must sit at the
  asserting site, and the re-pin must sit with the row that moves it.
- The registry is complete for every hand-maintained census this tree carries as
  of 2026-08-24 - nine, not the four AC1 names by example. The five beyond that
  list (`lib/bulk-output.mjs`'s 17 rows, `lib/text-transport.mjs`'s 36,
  `lib/rung-agent.mjs`'s 19 stems, `lib/deferred-reads.mjs`'s 10 and
  `planning-lease-check.test.mjs`'s 14 detail sites) were added on the user's
  decision at the blocking `plan` review gate, over an earlier draft of this
  plan that scoped them out: CEN-01 says EVERY hand-maintained census, and five
  counts already named and measured are not ones D-06's marker cost excuses.
  D-06's cost still stands for a census nobody has found - an unmarked one stays
  invisible to the walk - and that is a statement about UNKNOWN counts, not a
  licence to skip known ones.
- CONSEQUENCE of that widening, stated rather than buried: criterion 3's replay
  fixture now names THREE files, not the two the ROADMAP criterion states. Row
  (i) carries the `planning.mjs` + `planning/` subject pair, phase 5's PLAN-1
  declared both and declared neither holding file, so the arm names
  `planning-lease-check.test.mjs` beside `trace.test.mjs` and
  `self-verify.test.mjs`. Criterion 3 says the arm names the two; it does not
  say ONLY those two, and a third grounded name is the check working rather than
  failing. Plan 2's task 3 and task 4 are written to that three.
