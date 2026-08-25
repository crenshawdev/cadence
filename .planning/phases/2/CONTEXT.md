# Phase 2: Census registry and plan-time lease check - Context

Gathered: 2026-08-24
Feeds: /cad-plan 2

## Scope boundary

In: A registry naming every hand-maintained census in this repository - the
file holding the count, what it counts, the site that asserts it, and the
narrow subject path set the count is taken over - plus a plan-time arm on
`lease-check` that reads a PLAN's `files:` lease against that registry and
refuses when the declared work would invalidate a census the lease does not
declare. `/cad-plan` fires it after PLAN.md is written and before any executor
is dispatched, on both the dispatched and the `--inline` paths. A commit-time
refusal on a registered census file becomes distinguishable in the run record
from an ordinary `undeclared-files` refusal.

Out: Changing what `lease-check` does at commit time on an UNREGISTERED file -
that arm's verdict, its `no-staged-set` fail-closed rule and its envelope are
unchanged. No census is removed, re-pinned or converted to a derived
measurement by this phase. No config key is added: a shape fact about planning
documents is not a config key (`criteria-size.mjs` header states the rule, and
a key would owe a `config.schema.json` entry, a config-catalog row and a
config-reach row). Phases 3 and 4 are the phases this check exists to protect;
neither is touched here.

Deferred: None.

Plan shape: Multiple plans, same phase. Two separable deliverables with a
clean seam - the registry plus its marker-discovery test (AC1, AC2), and the
plan-time arm plus its wiring and record signal (AC3-AC6). The second reads
the first and does not edit it.

## Durable decisions

- D-01 (registry home): The registry is a frozen table exported from a NEW
  module under `cadence-core/bin/lib/` - not a JSON data file, not a config
  key, and not a table held inside a `.test.mjs`. Rejected: the
  `helper-census.test.mjs` shape where the `HELPERS` table lives inside the
  test, because criterion 2 requires the seam at
  `cadence-core/bin/planning/lease-check.mjs` to READ the registry, and a
  table inside a test file cannot be imported by a seam without a second copy -
  the two-readers-one-rule divergence `lib/lease-grammar.mjs` exists to close,
  reproduced inside the phase meant to close it. Evidence:
  `cadence-core/bin/lib/deferred-reads.mjs` (header names itself "the same
  species of stated table as self-verify's CONTRACTS and lib/rung-agent's
  RUNG_FILES", pure rule in `lib/`, disk half in `self-verify.mjs`);
  `cadence-core/bin/lib/lease-grammar.mjs`; `cadence-core/bin/lib/arg-contract.mjs`;
  `cadence-core/bin/planning/criteria-size.mjs` header.

- D-02 (entry shape): An entry carries a FOURTH field beyond the three
  criterion 1 words - the SUBJECT path set the census counts OVER, distinct
  from the file that holds it. Without it the plan-time arm has no predicate
  at all. Evidence: phase 5's PLAN-1 as written
  (`git show 6645ce4b:.planning/phases/4/PLAN-1.md`) leases exactly five paths -
  `cadence-core/bin/planning.mjs`, `cadence-core/bin/planning/`,
  `helper-census.test.mjs`, `prose-agreement.test.mjs`, `planning.test.mjs` -
  and neither `trace.test.mjs` nor `self-verify.test.mjs` appears in that lease
  or anywhere in the plan body. The link exists only in the census bodies:
  `trace.test.mjs` builds its source blob from `./planning.mjs` plus every
  `.mjs` in `./planning/`, and `self-verify.test.mjs` check 12 walks `binDir`.
  The lease intersects those SUBJECTS; it never intersects the census home
  files.

- D-03 (subject width): Subjects are NARROW and hand-written per entry, scoped
  to what the assertion actually pins - `self-verify.test.mjs` check 12's
  subject is files carrying a `mergeLayers(` callsite, not all of
  `cadence-core/bin/`. The narrowing is itself hand-maintained and can drift;
  that cost is accepted. Rejected: a subject equal to whatever the census
  really scans, which is more honest and unusable - measured 2026-08-24 over
  `git ls-files .planning` (46 PLAN files carrying a `files:` block, 40
  declaring at least one path under `cadence-core/bin/`), a `cadence-core/bin/`
  subject for `helper-census.test.mjs` (which walks the whole tree,
  `helper-census.test.mjs:216`) would have refused 38 of those 40 plans, and
  `self-verify.test.mjs` check 12's `walk(binDir)` gives 22 of 40. Evidence:
  `cadence-core/bin/planning/lease-check.mjs` header - "a rail that fires wrong
  gets deleted, not tuned"; `.planning/phases/1/SUMMARY.md:46` already records
  the commit-time arm being overridden twice rather than obeyed, so a noisier
  plan-time arm inherits that fate.

- D-04 (self-reference): The registry asserts its rows' SHAPE, not its row
  COUNT, so adding a registry row is not itself a census-invalidating act and
  the registry needs no exemption from itself. Rejected: keeping a length
  assertion and registering the registry (every future phase adding one row
  pays a lease amendment), and keeping it while exempting the registry (a
  census nothing watches - the exact class the registry enumerates). Evidence:
  `cadence-core/bin/helper-census.test.mjs:217-224` handles self-reference this
  way already; the length-assertion precedents it departs from are
  `self-verify.test.mjs:1768` (`DEFERRED_READS.length, 10`),
  `text-transport.test.mjs:45-46`, `bulk-output.test.mjs:54`,
  `rung-agent.test.mjs:80` and `arg-contract.test.mjs:304`.

- D-05 (what is not a census): DERIVED numbers are excluded from the registry.
  A census is a count a human wrote down that the code must keep true; a number
  the test computes from the tree at run time is a measurement and no plan can
  invalidate it. Evidence: `cadence-core/bin/seam-calls.test.mjs:12-27` states
  its own numbers are "DERIVED, never baselined" and carries the arithmetic.
  [corrected by plan-2 deviation: that self-description covers the header
  arithmetic and NOT the assertion, which compares `seamCalls(text)` against a
  literal `calls: 11` at `cadence-core/bin/seam-calls.test.mjs:86` - a
  hand-written count the code must keep true, so the file IS a census by this
  phase's own definition and belongs in the registry.]

- D-06 (discovery): Criterion 1's "a census live in a test but absent from the
  registry fails the suite" is satisfied by a LEXICAL MARKER the census site
  must carry, on the `CADENCE-DEBT` model - the suite fails on any marked site
  with no registry row, naming the file and the assertion. The cost is stated:
  a census written without the marker is invisible. Rejected: inferring
  censushood from assertion shape - measured 2026-08-24 over
  `cadence-core/bin/*.test.mjs`, 73 `assert.equal(..., <2+ digit literal>)`
  calls and 147 on a looser shape, the large majority fixture-derived rather
  than tree-derived (`git-segments.test.mjs:131` asserts `10000` over a
  synthesized input; `planning-adjudication.test.mjs:152` asserts `40` for a
  sha length). Also rejected: an allowlist of the ten test files that read live
  repo source, which is a second hand-maintained list. Evidence:
  `cadence-core/bin/lib/debt-markers.mjs`;
  `cadence-core/references/conventions.md:38-66` (namespaced-token-plus-colon
  convention, and the rule that the scanner must not ingest documentation about
  itself).

- D-07 (verdict): The plan-time gate REFUSES rather than reports, deliberately
  breaking with `plan-size` and `criteria-size`. Rejected: a report, and a
  report-plus-ask on the `too_big` shape at `cadence-core/workflows/plan.md:238`.
  A soft report reproduces the failure CEN-02 names - the planner is told and
  continues - and the override rate is already measured, not hypothetical:
  `.planning/phases/1/SUMMARY.md:46` and
  `.planning/phases/1/reports/plan-2.2.md:64` record two `undeclared-files`
  refusals committed rather than obeyed. Evidence for the pattern being broken:
  `cadence-core/bin/planning/criteria-size.mjs` header - "A REPORT, never a
  gate ... the workflow decides" - and `cadence-core/workflows/plan.md:290`
  ("Not a hard halt").

## Decisions

- D-08 (`weight-budgets.json`): It is registered, with `self-verify.mjs` named
  as the asserting site, stretching criterion 1's "the test that asserts it".
  It is the one census that every prose-editing plan in this repository
  invalidates. Measured 2026-08-24: `cadence-core/bin/weight-budgets.json:71`
  pins `"cadence-core/workflows/plan.md": 29737` and the file is exactly 29,737
  bytes, so AC5's own required edit to `plan.md` trips
  `budget-overrun` (`cadence-core/bin/self-verify.mjs:750-759`, which reports on
  growth only) on the first byte added. Rejected: restricting the registry to
  test files exactly as criterion 1 words it.

- D-09 (spelling): The plan-time arm is a FLAG on `lease-check`, never a
  `lease-check plan` two-word subcommand. Evidence:
  `cadence-core/bin/lib/arg-contract.mjs:567-572` states the rule and names
  `lease-check` among the one-word precedents - `subcommandKey` consumes a
  second word only for families in `TWO_WORD`, and "one operation does not earn
  widening that Set". The existing row is
  `'lease-check': { '--phase': required, '--plan': required }`
  (`lib/arg-contract.mjs:607-610`), dispatched at `cadence-core/bin/planning.mjs:268`.

- D-10 (predicate): The only relation available at plan time is path
  intersection between the lease and a registry entry's subject set, evaluated
  through `cadence-core/bin/lib/lease-grammar.mjs`'s existing `intersects` and
  `covers` - reused, never re-implemented, since `helper-census.test.mjs`'s
  `covers` row fails the suite on a second copy. Nothing in a PLAN declares what
  it will CHANGE other than paths: `cadence-core/references/plan-frontmatter.md`
  documents the whole frontmatter grammar and `files:` is its only path-bearing
  key, unioned by `parsePlanFiles` (`lib/planning-files.mjs`) with the
  `- **Files:**` task lines. Reading the plan's Action prose, or opening a
  census test to see what it scans, both break criterion 2's "reads the lease
  and the registry only".

- D-11 (no git): The plan-time arm makes no `git` call and reads no staged set,
  so it shares nothing below `parsePlanFiles` with the commit-time arm.
  Registry subjects and lease declarations are both already repo-relative
  strings, so `repoRel` has no input. `planning/lease-check.mjs` reaches git
  only for `rev-parse --show-toplevel` and `diff --cached --name-status -z -M`,
  both to canonicalize and read the staged side; its `no-staged-set`
  fail-closed rule is a statement about the STAGED side and has no plan-time
  analogue. Inheriting it would halt planning in any tree where
  `git diff --cached` fails, on a condition the check does not measure.

- D-12 (wiring): The gate fires in `cadence-core/workflows/plan.md` between
  `check_size` (`:273`) and `check_gate`, and on the `--inline` path
  (`:194-218`) too, with the inline step POINTING at the written step rather
  than restating the call - the D-12 precedent that file already states for
  `count_planned`/`count_committed` ("criterion 2 names `/cad-plan`, not a
  dispatch mode, and leaving the cheap path out would make it the one path with
  no citation data"). Rejected: after `check_gate`, which pays a
  `cad-plan-checker` dispatch to review a lease the count already knows is
  short - the waste `plan-size` at `parse` was built to remove.

- D-13 (record): Criterion 6's distinguishability is carried BOTH ways - a
  distinct refusal reason on the envelope AND an `appendEvent` to
  `.planning/trace.jsonl` - on the `cadence-core/bin/planning/risk-check.mjs:228-245`
  pattern, where the record and the envelope carry different halves and the
  append may NOT change the verdict. Verified 2026-08-24: `grep -c appendEvent
  cadence-core/bin/planning/lease-check.mjs` returns 0, so the seam writes
  nothing to the trace today and a reason code alone would leave `trace render`
  and `read-trace.mjs` with nothing to read. Adding a code-side producer does
  not disturb `trace.test.mjs:1868`, which hardcodes only `route.mjs` and
  `review-provider.mjs` as code producers.

- D-14 (this phase's own exposure): Phase 2's own plans must lease four census
  files or the phase halts on the defect it exists to close.
  (a) `cadence-core/bin/arg-contract.test.mjs` - adding one flag row for D-09
  moves `:303`'s `assert.equal(entries, 184, ...)`, verified at 184 on
  2026-08-24; this is the identical failure `.planning/phases/2/SUMMARY.md`
  records for v3.7.0 at 178 to 179. (b) `cadence-core/bin/weight-budgets.json` -
  per D-08. (c) `.planning/DOCS-CLAIMS.md:855` and
  (d) `cadence-core/bin/citation-census.test.mjs:214-221` - both pin
  `EXECUTE-10 | cadence-core/bin/planning/lease-check.mjs | 331-334` by line,
  and inserting the plan-time arm shifts it.

## Acceptance criteria

- [ ] AC1: The registry lists an entry for each of `self-verify.test.mjs`,
      `arg-contract.test.mjs`, `trace.test.mjs` and `weight-budgets.json`, and
      each entry names four things: the file holding the count, what it counts,
      the site that asserts it, and its narrow subject path set.
- [ ] AC2: A census site carrying the marker with no registry row fails the
      suite, naming the file and the assertion. Proved by a fixture: with the
      row absent the suite reddens, with the row present it greens.
- [ ] AC3: Replayed against phase 5's PLAN-1 lease exactly as written
      (`git show 6645ce4b:.planning/phases/4/PLAN-1.md`, five declared paths),
      the plan-time arm names `trace.test.mjs` and `self-verify.test.mjs`. The
      run spawns no `git` subprocess and executes nothing from the plan.
- [ ] AC4: The arm is replayed over every historical PLAN declaring a path
      under `cadence-core/bin/` (40 measured 2026-08-24), the per-entry refusal
      count is recorded in the phase record, and no single registry entry
      refuses more than half of them.
- [ ] AC5: `/cad-plan` fires the check after PLAN.md is written and before any
      executor is dispatched, on the dispatched path and the `--inline` path
      both, and the refusal text names each missing file beside the census it
      holds.
- [ ] AC6: A commit-time `lease-check` refusal on a registered census file
      carries a different reason code than an ordinary `undeclared-files`
      refusal and appends an event to `.planning/trace.jsonl`; a refusal on an
      unregistered file carries the old reason. Two fixtures, one each.
- [ ] AC7: Full suite green, `self-verify.mjs` reports zero problems,
      `npx tsc -p tsconfig.ci.json` exits 0, and this phase's own PLANs lease
      `cadence-core/bin/arg-contract.test.mjs`,
      `cadence-core/bin/weight-budgets.json`, `.planning/DOCS-CLAIMS.md` and
      `cadence-core/bin/citation-census.test.mjs`.

## Flagged assumptions

- The narrow subject expression for each entry is the planner's to write, and
  D-03 accepts that it is hand-maintained - Likely; if wrong, AC4's replay
  exceeds its half-of-40 bound and the entry must be narrowed again or removed
  rather than tuned.
- `helper-census.test.mjs` walks the whole `cadence-core/bin/` tree
  (`:216`), so it may admit no narrow subject at all - Unclear; if it does not,
  that one entry either stays out of the registry or is the single entry whose
  verdict reports rather than refuses, and D-07 would then need a stated
  exception rather than a silent one.
- The marker token's spelling must not collide with the `CADENCE-DEBT` scanner's
  own harvest, and `conventions.md:38-66` requires the scanner not ingest
  documentation about itself - Likely; if wrong, the registry's own reference
  prose is harvested as a census site.
- `.planning/DOCS-CLAIMS.md` and `citation-census.test.mjs` pin
  `lease-check.mjs:331-334` by LINE, so their new values are only knowable after
  the arm's code lands - Confident; if the plan sequences the re-pin before the
  insertion, the task fails on a line range that does not yet exist.
