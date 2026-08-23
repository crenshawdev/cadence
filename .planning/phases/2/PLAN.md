---
phase: 2
plan: 1
requirements: [FRM-01, FRM-02]
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/references/plan-frontmatter.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The collision plan-overlap was built to catch - Plan

## Goal

`plan-overlap` can prove file-list independence before a parallel dispatch: a
markdown-decorated path is reported instead of parsing clean, and a value-level
defect under a key no seam reads stops surfacing on the two list reads that
decide the gate.

## Must be true when done

- A document whose `goal:` scalar is backtick-wrapped reads clean for the file
  list: `readFrontmatterList(text, 'files')` returns `issues: []`, with both
  `trailing-value-content` and `backtick-wrapped-value` suppressed - while a
  backticked entry in the `files:` list itself still reports its code on that
  same read.
- A structural defect with no owning key - an `unknown-line` inside the
  `requirements:` block - still appears on a `files:` read.
- `parsePlanFiles` reports an issue for a bold path, for the link form, and for
  a path carrying a matched interior backtick pair, and reports none for a plain
  path or for a path carrying a single interior backtick.
- Every flagged decorated entry is still in the returned files list with its
  bytes unchanged - not dropped, and not rewritten to the undecorated form.
- `planning.mjs plan-overlap --phase <N>` over two plans declaring the same file,
  one plain and one decorated, returns a non-empty `frontmatter_issues` naming
  the decorated plan and the line it was declared on, so `execute.md`'s routing
  sends the phase sequential instead of clearing two plans into separate
  worktrees.
- Adding a grammar code literal to `planning-files.mjs`'s frontmatter region
  without adding its row to `references/plan-frontmatter.md`'s code table
  reddens a test.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

CONTEXT.md's decisions bind every task. D-01 gates the four value-level codes to
the two list keys at the PUSH SITES, adding no `Issue` field and filtering
nothing in the selector, so none of D-09's five readers sees a reshaped
envelope; D-02 keeps the five structural codes reaching every key's read; D-03
puts the decoration rule in `parsePlanFiles` beside `redundant-path-segment`,
never pushed down into `parseFrontmatter` or `resolveValue`, which serve
`requirements:` too; D-04 REPORTS a decorated path and keeps its bytes, so
`overlaps` never means "intersect after repair"; D-05 makes the interior rule a
MATCHED PAIR, additive to the unchanged boundary check; D-06 keeps the rule off
the task-line arm; D-11 lands the reference edit and its `weight-budgets.json`
re-pin in the same commit as the code; D-12 derives the code-set guard from
executable source. Out of scope: phase 1's release seam, the `- **Files:**` task
arm, any change to what `plan-overlap` puts in `overlaps`, and any reshaping of
the `frontmatter_issues` payload.

## Tasks

### Task 1: Report markdown decoration on a declared path, keeping its bytes

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs, cadence-core/references/plan-frontmatter.md, cadence-core/bin/weight-budgets.json
- **Action:** Start reading at `parsePlanFiles` in
  `cadence-core/bin/lib/planning-files.mjs` and at the `## Diagnostic codes`
  table in `cadence-core/references/plan-frontmatter.md`. In `parsePlanFiles`'
  FRONTMATTER loop only - the `for (const f of
  items)` loop, never the `- **Files:**` `matchAll` loop below it (D-06: measured
  over 46 committed plan files, the task arm already strips backticks and adds
  both forms, so a both-arms rule turns 5 clean plans into issue carriers) - an
  item that survives the existing `isRefusedSpelling` arm is tested for markdown
  decoration and, when it matches, gets ONE issue with the new code
  `markdown-decorated-path` while STILL being added to `files` verbatim (D-04,
  D-19): it is reported, not dropped the way the refusal arm drops and not
  rewritten to the undecorated form. Leave the refusal arm above it exactly as
  it is. Three shapes, one code, at most one issue per item (D-08): the value
  both starts and ends with a doubled asterisk with at least one character
  between them; the value is wholly the link form, an opening bracket, a closing
  bracket immediately followed by an opening parenthesis, and a closing
  parenthesis at the end; or the value carries TWO OR MORE backticks at
  positions strictly inside it, index greater than zero and less than the last
  index. The interior count is the whole of D-05 and it is what
  `.planning/CAPTURE.md`'s phase-1 UAT note got wrong when it called an interior
  pair and a single interior backtick "structurally identical": a matched pair
  fires while `lib/a` + one backtick + `b.mjs` does not, so UAT-21's over-fire
  guard survives, and a wrap-plus-punctuation value has only ONE interior
  backtick so it keeps reporting `backtick-wrapped-value` alone rather than
  double-reporting. Take the line number from the existing `refuseFrontmatter`
  cursor over `filesListRegion`, the same call the refusal arm makes, so a
  decorated path written twice reports its own line each time; build the issue
  with `issueText` over that line's text, the shape every other push here uses.
  Extend `parsePlanFiles`' own block comment to state the rule and why the
  payload is kept. In the same commit (D-11), add the code's row to
  `references/plan-frontmatter.md`'s `## Diagnostic codes` table beside
  `redundant-path-segment`, stating in the Payload column that it preserves the
  declaration rather than dropping it and that the frontmatter arm is the only
  arm it fires on, and re-pin that file's `weight-budgets.json` entry (17312
  today) to the file's new byte count. Tests: add `parsePlanFiles` to
  `planning-files.test.mjs`'s import list and assert the three decorated shapes
  each report the code, that a plain path and a single-interior-backtick path
  report nothing (AC3), and that each flagged entry is present in the returned
  files array byte-identical to what was declared (AC4).
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes with
  the new cases; `node cadence-core/bin/weight.mjs` reports
  `cadence-core/references/plan-frontmatter.md` at exactly its
  `weight-budgets.json` entry; and `node cadence-core/bin/self-verify.mjs --root
  .` returns `ok:true` with `problems: []`.

### Task 2: Prove the collision reaches the plan-overlap envelope

- **Files:** cadence-core/bin/planning.test.mjs
- **Action:** Add a `plan-overlap` seam test beside the existing "a
  backtick-wrapped path does not silently miss a real collision (UAT-21)" test,
  built on the same `makeTree` fixture shape: two plans in one phase, PLAN-1
  declaring the file in decorated bold form and PLAN-2 declaring it plain, each
  frontmatter block written so the `files:` item lands on line 6 the way that
  neighbouring test's does. Assert `ok` is true, that `overlaps` is still empty -
  the two spellings genuinely do not intersect and D-04 keeps `overlaps` meaning
  "these two declarations intersect", never "intersect after repair" - and that
  `frontmatter_issues` names PLAN-1 with the decorated line's number, the new
  code and the declaring line's text. The point the test pins is the one the
  phase exists for: the collision is DETECTED, because `workflows/execute.md`
  routes any `frontmatter_issues` entry to sequential.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes, and
  reverting Task 1's `parsePlanFiles` change reddens this test specifically.

### Task 3: Gate the value-level codes to the two list keys

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs, cadence-core/references/plan-frontmatter.md, cadence-core/bin/weight-budgets.json
- **Action:** Start reading at `parseFrontmatter` and `readFrontmatterList` in
  `cadence-core/bin/lib/planning-files.mjs`. Emit the four value-level codes - `unterminated-quote`,
  `trailing-value-content`, `residual-quote`, `backtick-wrapped-value` - only
  when the key that owns them is `requirements` or `files` (D-01, D-07's
  enumeration of the family). The gate goes at the push sites inside
  `parseFrontmatter`, where the owning key is already in scope: `key` on the
  key-line arm, for both the `scanValue` code arm and the `pushIssues` call that
  carries `resolveValue`/`parseInlineList` codes, and `currentKey` on the block
  item arm. An item arriving with no block key open owns no list key, so its
  value-level codes are suppressed there too - `item-without-key` still fires on
  that line under D-02, so nothing goes silent. Add no field to the `Issue`
  shape and filter nothing in `readFrontmatterList`: D-01 rejects the
  attribute-and-filter route because it reddens the `files:`-key assertions in
  `planning.test.mjs` and blinds `/cad-audit` to `files:`-key defects, and D-09's
  five readers must all keep the envelope they have. The five structural codes -
  `unterminated-frontmatter`, `malformed-key-line`, `unknown-line`,
  `item-without-key`, `commented-key-line` - keep reaching EVERY key's read
  (D-02: a truncated `requirements:` block that never reached `plan-overlap`
  would let `choose_path` read a half-parsed file as proved independence). The
  two bracket-level codes, `unterminated-inline-list` and
  `trailing-inline-content`, are in neither list D-01/D-02/D-07 enumerates and
  stay exactly as they are - do not widen the gate to them. Correct the two
  JSDoc claims this makes false in the same commit: `readFrontmatterList`'s
  "plus the WHOLE pass's issues (never a key-scoped subset, D-02)" and
  `parsePlanRequirements`' "any frontmatter grammar issues from the pass". In the
  same commit (D-11), state the split in `references/plan-frontmatter.md`'s
  `## Diagnostic codes` preamble - the paragraph that today says every code is
  appended to the pass's `frontmatter_issues` - naming which codes are scoped to
  a `requirements:`/`files:` read and which reach every read, and re-pin that
  file's `weight-budgets.json` entry to its new byte count. Tests: add rows to
  `planning-files.test.mjs`'s ROWS table - a document whose `goal:` scalar is a
  backtick-wrapped token followed by more words (measured 2026-08-22: that form
  returns BOTH `trailing-value-content` and `backtick-wrapped-value` today, D-07)
  read for `files` and expecting no issues; the same document with a backticked
  `files:` entry beside it, expecting `backtick-wrapped-value` alone (AC1); and a
  stray non-item line inside a `requirements:` block read for `files`, expecting
  `unknown-line` (AC2).
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` and `node
  --test cadence-core/bin/planning.test.mjs` both pass; running
  `readFrontmatterList` over a document whose `goal:` value is a backtick-wrapped
  token plus trailing words returns an empty issues array for key `files`, and
  returns those same two codes on that document when the identical value sits
  under `files:` instead - the gate suppresses them at the push site, so no read
  of any key surfaces them off `goal:` and asserting otherwise would assert what
  this task removes; and `node cadence-core/bin/self-verify.mjs --root .`
  returns `ok:true` with `problems: []`.

### Task 4: Redden when a grammar code never reaches the reference table

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add a test that derives the frontmatter grammar's code set from
  EXECUTABLE source and asserts every member has a row in
  `references/plan-frontmatter.md`'s `## Diagnostic codes` table, following the
  precedent phase 1 committed in this same file for `decideManifestBump`'s
  verdict codes (its `doc()` helper reads a repo file; a prose-to-prose
  comparison passes while both lists are stale together, which is what D-12
  forbids). Bound the extraction to the frontmatter region by SYMBOL, from
  `scanValue`'s declaration through the end of `parsePlanFiles`, never by line
  number: the same module defines `active-non-id-bullet`,
  `criteria-heading-near-miss`, `criterion-duplicate-id`, `criterion-empty-text`
  and `criterion-indented-bullet` for other grammars with their own references,
  and an unbounded scan would demand rows for them here. The codes are written
  three ways in that region - as a `code:` property, inside a `codes:` array
  literal, and as a `push` argument - so an extraction matching only the first
  form finds four of them. Assert non-vacuity before the loop, the way the
  phase-1 test does: the twelve codes shipping before this phase
  (`unterminated-quote`, `trailing-value-content`, `residual-quote`,
  `backtick-wrapped-value`, `unterminated-inline-list`,
  `trailing-inline-content`, `unterminated-frontmatter`, `malformed-key-line`,
  `unknown-line`, `item-without-key`, `commented-key-line`,
  `redundant-path-segment`) plus Task 1's must all be found, and each failure
  message names the missing code and the table that lacks it.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  deleting the new code's row from `references/plan-frontmatter.md` makes it
  fail naming that code; and `node cadence-core/bin/test.mjs` reports 0 failures
  across every group.

## Notes

- One plan, per the CONTEXT `Plan shape` directive and the independence test
  alike: FRM-01 and FRM-02 both write `cadence-core/bin/lib/planning-files.mjs`
  and both write `references/plan-frontmatter.md` and
  `cadence-core/bin/weight-budgets.json`, so they cannot be independent slices -
  splitting them would stage exactly the collision this phase exists to make
  detectable.
- The new code's name, `markdown-decorated-path`, is the planner's choice
  (CONTEXT names the shapes, not the code); it collides with nothing in the tree
  today. Tasks 1, 2 and 4 all depend on that one spelling.
- D-12 describes "the 13 grammar-code literals" in the frontmatter region.
  Measured 2026-08-22: that region holds 14 literal occurrences of 12 DISTINCT
  codes (`unterminated-quote` and `redundant-path-segment` each appear twice).
  Task 4 pins the distinct set, so no count is load-bearing.
- Both defects were re-reproduced against the current tree on 2026-08-22 before
  planning, per the ROADMAP's instruction to re-run rather than trust the issue
  text: a `goal:` scalar's codes reach a `files:` read, and `**src/shared.rs**`,
  the link form and an interior backtick pair all return `issues: []` from
  `parsePlanFiles`.
- Carried forward from phase 1's open items and still true: `detect-commands
  --root .` returns null for both lint and typecheck, so nothing checks this
  tree's `@ts-check` annotations locally.
