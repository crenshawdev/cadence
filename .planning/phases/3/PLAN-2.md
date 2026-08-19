---
phase: 3
plan: 2
requirements: [RSK-04]
files:
  - cadence-core/bin/lib/risk-diff.mjs
  - cadence-core/bin/risk-diff.test.mjs
---

# Phase 3: Gates that fire on themselves or cannot be satisfied - Plan 2

## Goal

The blocking `risk_surface` detector stops matching its own source and its own
fixtures, so a phase that edits the detector no longer fires the gate on a
self-match and spends the one-round re-arm budget on nothing.

## Must be true when done

- A whole-file add of `cadence-core/bin/lib/risk-diff.mjs`, scanned through
  `scanDiff`, returns no matches - under this repository's three configured
  surfaces and under the full eight-category set. It returns six categories
  today: auth, migrations, billing, concurrency, destructive and
  untrusted_input.
- A whole-file add of `cadence-core/bin/risk-diff.test.mjs` returns no matches
  under both sets. It returns four today: auth, migrations, destructive and
  untrusted_input.
- Every pattern's REACH is unchanged: each of the eight categories still matches
  exactly the added and removed lines it matched before, proven by the existing
  pure-lib rows passing untouched.
- A committed test in `risk-diff.test.mjs` asserts both files scan clean under
  both surface sets, and its header records what it observed against the pre-fix
  tree.
- `node --test cadence-core/bin/risk-diff.test.mjs` passes with the same test
  count it reports today plus the new census row.

## Context

D-06 binds the mechanism: the fix SPLITS the self-matching literals in both
files and is PINNED by a census test. It is NOT a path rule and NOT a filename
rule - `README.md` states that ban directly ("What the code does decides; what
the file is called does not"), and a path-based rule was measured on 2026-08-18
at 90 of 520 tracked files matching, 32 of them test or fixture files. D-07
records that the reach is not confined to the test file: the DETECTOR'S OWN
SOURCE matches, so a fix scoped to the test file leaves this phase's own edit
firing the gate. D-16 records that `parseDiff` returns a FLAT `changed` array
with no per-file attribution, so a per-path content filter is a parser rewrite
and is not needed here. D-17 puts the eight `CONTENT_SIGNALS` patterns' BREADTH
out of scope - that is an unpromoted capture item, and widening them would
re-tune detection for every project on an unrelated fix.

## Tasks

### Task 1: The detector's own source stops matching its own patterns

- **Files:** cadence-core/bin/lib/risk-diff.mjs (the `CONTENT_SIGNALS` block)
- **Action:** Ten lines of this file match its own patterns when the file
  arrives as an added file in a diff. Measured 2026-08-19 against the eight
  categories, five of them match inside the `label` STRING and five inside the
  regex SOURCE: the auth Authorization-header label (line 106), the migrations
  ALTER-TABLE label (110) and CREATE-TABLE label (111), the billing label naming
  a payment vendor (116), and the destructive label naming a recursive shell
  delete (127) are label-side; the first-listed alternatives of the billing
  provider group (117), the billing pricing-field group (118), the concurrency
  lock-primitive group (123), the destructive delete-call group (130) and the
  untrusted_input group naming HTTP body-parsing middleware (148) are
  pattern-side. In each
  pattern-side group EVERY alternative self-matches, not only the first one
  `exec` reports, because each is preceded by an open paren or a pipe and so
  carries a word boundary - except where an escaped dot already breaks it (the
  Python lock member and the Python rmtree member), which need nothing. Two
  mechanisms are available and both preserve behaviour exactly: a one-character
  class around the first character of a pattern alternative, which matches the
  same language while the source text no longer carries the literal, and a
  string split or concatenation for a prose label. Prefer the pattern-side
  mechanism where the match is pattern-side and a split that PRESERVES the
  label's bytes where it is label-side, so no emitted `signal` string changes
  for a fire site that has to state a reason. Do not add a path rule, a filename
  rule, or an exclusion list keyed on this file: `lib/merge-warnings.mjs` states
  the discipline for a lexical rule that reported itself - "the fix is at the
  mention, not in the rule... A second exclusion list would buy nothing but a
  place for a real callsite to hide" - and `helper-census.test.mjs` follows the
  same rule for its own patterns. Do not widen or narrow what any pattern
  matches (D-17); the reach is not what is being changed.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes unchanged
  - the fourteen pure-lib rows pin the patterns' reach; and a scan of a
  synthesized whole-file add of `cadence-core/bin/lib/risk-diff.mjs` through
  `scanDiff` with all eight categories returns an empty `matches` array where it
  returns six categories today.

### Task 2: The test file's fixtures and harness stop matching

- **Files:** cadence-core/bin/risk-diff.test.mjs
- **Action:** Nineteen lines of this file match, measured 2026-08-19 across four
  categories: ten auth lines carrying the JWT verify fixture (42, 155, 236, 271,
  481, 1102, 1118, 1135, 1149, 1166), two migrations lines carrying an SQL
  column-add fixture (105, 149), two destructive lines - a comment at 162 and a
  fixture string at 167 - naming an SQL table drop, and five untrusted_input
  lines where the harness itself parses JSON (219, 226, 393, 936, 1183). The
  fixture strings must still carry their constructs AT RUNTIME - a fixture that
  stopped carrying the JWT call would stop testing the auth detector, which is
  the failure mode worse than the one being fixed - so the split is in the
  SOURCE spelling only: a concatenation or template that assembles the same
  bytes, or one shared fixture constant the ten call sites reference. For the
  five harness lines, a module-level alias bound to the JSON parser (whose own
  line carries no open paren after the member name, so it does not match) is
  enough, with the call sites using the alias. The comment at 162 is prose and
  can be reworded or split. Change no assertion, no test name and no fixture's
  runtime value - this task changes how the same bytes are SPELLED in source.
  The new census row is task 3's, not this one's.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` reports the same
  number of passing tests, with the same names, as it does before this task; a
  scan of a synthesized whole-file add of `cadence-core/bin/risk-diff.test.mjs`
  under all eight categories returns an empty `matches` array where it returns
  four categories today.

### Task 3: The census that keeps them clean

- **Files:** cadence-core/bin/risk-diff.test.mjs
- **Action:** Add one test that reads both files off disk, synthesizes a
  whole-file-add unified diff for each (a `diff --git` header, a `+++` line, one
  hunk header, and every source line prefixed with a plus), and asserts
  `scanDiff` returns no matches for each under BOTH vocabularies: this
  repository's configured surfaces from `.planning/config.json` (`secrets`,
  `destructive`, `untrusted_input`) and the full eight from
  `lib/surface-scan.mjs`'s `CATEGORIES`. Assert on the category set, never on
  line numbers - the point is that neither file matches, and a line-number
  assertion reddens on an unrelated edit. Record the pre-fix observation in the
  test's header comment the way `prose-agreement.test.mjs` records WIR-01's: the
  commit it was watched failing at, and the categories each file returned there.
  The pin is load-bearing on its own - phase 1's D-07 recorded that a fix nothing
  tests is reverted by the next edit with a green self-verify - and this test IS
  the standing guard, so it must fail loudly rather than skip when a file cannot
  be read. This test's own bytes live inside one of the files it scans, so it may
  carry no literal its own patterns match; the same discipline tasks 1 and 2
  applied applies to it.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with the
  new row; and the falsifier is demonstrated once - write the pre-phase content
  of `cadence-core/bin/lib/risk-diff.mjs` to a temp path with `git show
  <pre-phase sha>:cadence-core/bin/lib/risk-diff.mjs`, run the same whole-file-add
  scan over it, and observe the six categories the test's header records.

## Notes

- This plan file deliberately paraphrases the offending literals rather than
  quoting them: it is committed into the same range `risk-check run` scans for
  this phase, and quoting them would fire the blocking gate on the plan document
  itself - which is the defect, one document over.
- The two files here are shared with no other plan in this phase. PLAN-1's
  RSK-03 end-to-end rows deliberately live in a new `plan-key.test.mjs` rather
  than beside the other risk-check seam cases in `risk-diff.test.mjs`, so this
  lease stays clean and both plans can run independently.
