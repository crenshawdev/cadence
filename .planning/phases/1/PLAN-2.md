---
phase: 1
plan: 2
requirements: []
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/templates/PLAN.md
  - cadence-core/references/plan-frontmatter.md
  - cadence-core/workflows/audit.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The plan-file frontmatter grammar - Plan 2

## Goal

Close the open half of the phase goal: `readFrontmatterList` reports anything
outside the stated grammar instead of silently over- or under-reading it. The
five shapes that still read wrong with `issues: []` - a block item under a key
that took the inline arm, a value carrying trailing text after its closing
quote or its own token, a commented-out key line, a key line missing the space
after its colon, and a backslash escape - each become a named diagnostic, and a
path declared in frontmatter reaches `plan-overlap` byte-exact as the plan
wrote it.

## Must be true when done

- Two plans each shaped `files: [src/a.rs]  # comment` followed by
  `  - src/shared.rs` are both named in `plan-overlap`'s `frontmatter_issues`,
  and neither plan's files list contains `src/shared.rs` - so `choose_path`
  routes sequential instead of greenlighting two plans that write one file.
- A declared path survives its own annotation: `- "src/shared.rs" (new)` and
  `- src/a.rs (new)` read as `src/shared.rs` and `src/a.rs`, each with a
  trailing-content diagnostic, and no value the reader returns contains a `"`
  or `'` character it did not declare.
- Every line that looks like a key but is not one is named by a code that names
  its repair: `requirements:["#41"]` reports `malformed-key-line`, a `# files:`
  line inside an open block reports `commented-key-line`, and
  `files: ["a\"b.md", "c\"d.md"]` reports a diagnostic instead of `issues: []`.
- A path declared in `files:` frontmatter reaches `plan-overlap` byte-exact -
  `src/x(1)` and a backtick-bearing path each overlap between two plans that
  declare them - while a `- **Files:** src/a.rs (edit)` task line still
  normalizes to `src/a.rs`.
- `references/plan-frontmatter.md` states per diagnostic code whether it keeps
  or drops the payload it read, `workflows/audit.md` states the general rule
  (a diagnostic never creates or clears a break by itself, a payload-dropping
  code can leave a requirement untraced) and points at that table rather than
  duplicating it, and a test at the audit seam - not a reading of the prose -
  proves each code behaves as its row states. See Notes: this is a stated,
  deliberate narrowing of CONTEXT acceptance criterion 6's literal wording.
- The shipped `templates/PLAN.md` frontmatter reads to exactly what it
  declares, and a path added under its `files:` key is read rather than
  dropped, asserted against the template file on disk so drift back to the
  `[]`-plus-items shape fails CI.
- `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
  both pass, `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun`, and the new grammar rows are among the passing set.

## Context

Locked decisions bind this plan; read `.planning/phases/1/CONTEXT.md` first.
This is the SECOND pass: `PLAN.md` (executed, `7b58a80..766c307`) shipped the
grammar spine and must NOT be edited - it is what the SUMMARY commit table and
`verify.md:59` point at. D-03 binds here too: the five remaining defects are
closed by extending the stated grammar and its code table, never by
special-casing an input or adding a tenth regex arm. D-13 (an orphan block item
is diagnosed and dropped, never back-attached), D-14 (a commented-out key line
is diagnosed, the terminator set stays at three members), D-15 (the stated
invariant moves, not the classification), D-16 (`KEY_LINE` stays strict, the
rejection gets a name), D-17/D-18 (trailing content is parse-then-diagnose,
symmetric on the quoted and unquoted forms), D-19 (`add()` comes off the
frontmatter arm; D-09 superseded), D-20 (escapes are out of the grammar AND
detectable), D-22 (`workflows/audit.md` is at 3002/3002 bytes - any byte added
requires `weight-budgets.json` in the SAME commit or CI fails
`budget-overrun`). Out of scope: the `- **Files:**` task-line arm keeps
`add()`; escapes are detected, never implemented; `PHASE_LINE` /
`parseRoadmapPhases` / the snippet and UAT parsers are phase 4's (D-10);
`cadence-core/workflows/execute.md` needs no change this pass and stays out of
the file list (it is also at 12292/12292). Shapes to follow: the one-test-per-row
table at `planning-files.test.mjs:205`, and `blockPlanTree`
(`planning.test.mjs:910`) for seam trees.

## Tasks

### Task 1: Resolve a value at its own boundary - trailing content and residual quotes

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Replace the module-private `unwrap(s)` (`planning-files.mjs:477`)
  with a module-private `resolveValue(raw)` returning
  `{value: string, codes: string[]}`, and delete `unwrap` outright - no dead
  helper, no second resolution path. `raw` is one already-comment-stripped,
  trimmed candidate: an inline list element, a block-item payload, or a key
  line's scalar remainder. The algorithm, exactly: an empty `raw` returns
  `{value:'', codes:[]}`; if `raw[0]` is `"` or `'`, find the next occurrence of
  that SAME character with `raw.indexOf(raw[0], 1)` - if there is none, return
  `{value:'', codes:['unterminated-quote']}`, otherwise the value is the span
  between the quotes and the remainder after the closing quote is the rest; if
  `raw[0]` is not a quote, the value is `raw` up to its first whitespace
  character (`raw.search(/\s/)`, the whole string when there is none) and the
  rest is what follows. When that rest is non-whitespace, push
  `trailing-value-content` - the payload before it is still the value (D-17's
  parse-then-diagnose, mirroring `trailing-inline-content`'s established
  precedent at `references/plan-frontmatter.md:121`). Finally, per D-20, the
  residual test - which fires on a value that could only have been written with
  an escape rule the grammar does not have. Push `residual-quote` and KEEP the
  payload when the resolved value contains either (a) a backslash, or (b) the
  SAME quote character that wrapped it (for an unquoted value, either quote
  character). Both halves of that test are load-bearing and neither is
  negotiable:
  - The backslash half is what makes D-20's own example detectable at all. A
    ONE-element escape has no trailing rest and no surviving quote, so the
    trailing-content and same-quote arms both miss it: verified against the
    current parser, `files: ["a\"]` returns `{"items":["a\\"],"issues":[]}`, a
    fabricated path with no diagnostic, and the rule as first drafted left it
    exactly there. AC4 names the two-element form, but the goal says "reports
    anything outside the grammar", and the one-element form is the same defect
    with the diagnostic removed.
  - The same-quote restriction is what stops the test firing on input the
    grammar ACCEPTS. `references/plan-frontmatter.md:96-99` prescribes
    `"src/it's-a-file.md"` as the correct spelling of a path with an apostrophe
    - that is why the wrapping-quote strip exists - and the unquoted spelling
    already returns `[]` + `unterminated-quote` (row at
    `planning-files.test.mjs:170`). A bare "contains a quote" test would leave
    NO diagnostic-free spelling of that path, so every audit and `plan-overlap`
    on the plan would carry a permanent `frontmatter_issues` entry and
    `execute.md:74` would route the phase sequential forever - a standing
    penalty for a conforming file. A `'` inside a `"`-wrapped value needs no
    escape and is in the grammar; a `"` inside one could only have been escaped
    and is not.
  Add NO escape state to `scanValue`, `splitDepth0` or `parseInlineList` (D-20)
  - this is a test on the RESOLVED value, which is detection, not an escape
  rule. Wire
  `resolveValue` at exactly three call sites: `parseInlineList`'s per-element
  map (each depth-0-split element trimmed, empty results dropped), the key-line
  scalar arm (`planning-files.mjs:630`), and the block-item arm (`:651`).
  `parseInlineList` returns `{items, codes}` instead of `{items, code}` -
  `codes` is the bracket-level code (`unterminated-inline-list` /
  `trailing-inline-content`) when present, followed by every element's codes.
  In `parseFrontmatter`, every code from any arm becomes one
  `{line, code, text}` issue carrying that line's 1-indexed number and
  `issueText(line)`, DEDUPLICATED per line so a five-element list with five
  annotated elements reports `trailing-value-content` once, not five times.
  Whitespace ending an unquoted value is the rule that makes the two forms
  symmetric (D-18): once Task 4 takes `add()` off the frontmatter arm,
  `- src/a.rs (new)` would otherwise return the literal `src/a.rs (new)` while
  its quoted twin returns a clean path, so two plans declaring the same file in
  the two forms would not overlap. Do not special-case a trailing parenthetical
  instead - that is the accreted-arm pattern D-03 forbids, and it would still
  miss `- "#41" stray`. State the accepted cost in the JSDoc: an unquoted value
  can no longer contain a space, so quote a value that does. Verified against 21
  commits of plan frontmatter in git history - every value there is a single
  token (`phase:`, `plan:`, `requirements:`, `files:` only) - so no shipped form
  regresses. In `planning-files.test.mjs`, add these rows to `ROWS` (one
  `test()` per row, the shape at `:205`), each with the exact expected `items`
  so no behavior is left for the executor to choose: `- "src/shared.rs" (new)`
  -> `['src/shared.rs']` + `['trailing-value-content']`; `- src/a.rs (new)` ->
  `['src/a.rs']` + the same code; `- "#41" stray` -> `['#41']` + the same code;
  the scalar `requirements: "#41" stray` -> `['#41']` + the same code; the
  inline element `requirements: ["#41" stray, "#46"]` -> `['#41','#46']` + ONE
  `trailing-value-content` (the dedupe rule); `files: ["src/it's-a-file.md"]`
  -> `["src/it's-a-file.md"]` + `issues: []` - the apostrophe sits inside a
  `"`-wrapped value, so it is IN the grammar and the residual test must NOT
  fire; this row is the regression guard for the over-fire; the ONE-element
  escape `files: ["a\"]` -> items `['a\\']` + `['residual-quote']` (the
  backslash half - this row returns `issues: []` against the parser as it ships
  today and against the residual rule without its backslash arm);
  `requirements: ["#41", a'b'c]` -> `['#41', "a'b'c"]` + `['residual-quote']`
  (unquoted value, either quote character); and the D-20 two-element case
  `files: ["a\"b.md", "c\"d.md"]` -> items `['a\\']` with BOTH
  `trailing-value-content` and `residual-quote` - the value is a fabricated
  fragment, which is precisely why the diagnostic replacing `issues: []` is the
  deliverable. Pin the exact `items` on every row; if the real `splitDepth0`
  boundary makes a two-element expectation differ, correct the expectation to
  observed behavior and record the actual string in the row - but the ISSUE
  codes on each row are the contract and may not be relaxed.
  In `planning.test.mjs`, add one seam test: PLAN-1.md declaring
  `files:` block item `- "src/shared.rs" (new)` and PLAN-2.md declaring
  `- src/shared.rs` now report `overlaps` on `src/shared.rs`, with
  `frontmatter_issues` naming PLAN-1.md with `trailing-value-content` - the
  UAT-9 observable, which before this task returned `overlaps: []` with no
  diagnostic.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` and
  `node --test cadence-core/bin/planning.test.mjs` both pass with the new row
  and test names in the output and no previously passing row regressed;
  `npx tsc -p tsconfig.ci.json` exits 0 (the `{items, codes}` shape change must
  typecheck under `// @ts-check`); and
  `node --input-type=module -e "import {parsePlanFiles} from './cadence-core/bin/lib/planning-files.mjs'; const r = parsePlanFiles('---\nfiles:\n  - \"src/shared.rs\" (new)\n---\n'); console.log(JSON.stringify(r))"`
  prints `files` as exactly `["src/shared.rs"]` with one
  `trailing-value-content` issue.

### Task 2: An item with no open key is diagnosed and dropped; the template writes a block key

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs, cadence-core/bin/planning.test.mjs, cadence-core/templates/PLAN.md
- **Action:** In `parseFrontmatter`'s item arm (`planning-files.mjs:650`),
  replace the silent `if (currentKey)` guard with an explicit two-branch
  classification: when a block key is open the resolved item is pushed as
  today; when `currentKey` is null the payload is DROPPED and one issue
  `{line, code:'item-without-key', text}` is recorded. Never back-attach the
  item to the most recent key line whatever arm that key took (D-13): merging an
  inline value with a following block fuses two separate statements under a
  merge rule the grammar does not state, and adopting only when the inline value
  was `[]` closes the harmless shape while leaving the dangerous non-empty one
  open. Note in the JSDoc that a REPEATED key does not reopen a block either
  (first occurrence wins, `:613`), so items under a second `files:` line report
  the same code - a stated consequence, not an accident. Then rewrite lines 4-5
  of `cadence-core/templates/PLAN.md` so both keys are bare block keys carrying
  their trailing comment (`requirements:` and `files:` with no `[]`, the comment
  text preserved including the `quote a #-shaped id ("#41")` guidance and the
  `see references/plan-frontmatter.md` pointer), so that an id or path a planner
  adds on the following lines is READ rather than dropped - the shipped
  template's own `[]` shape is what made this defect reach every generated plan.
  Leave the `phase:` and `plan:` lines and the template body untouched, and add
  no body text (template body text lands in every generated plan);
  `templates/` is not walked by `lib/surface-weight.mjs`, so no budget moves
  here. In `planning-files.test.mjs`, add rows: `files: []            # files
  this plan touches` followed by `  - src/shared.rs` and `  - src/a.rs` ->
  items `[]` with `['item-without-key','item-without-key']` (one per line, the
  dedupe rule is per line); a frontmatter that is only `- "#41"` between the
  fences (no key at all) -> `[]` + `['item-without-key']`;
  `files: [src/a.rs]  # comment` followed by `  - src/shared.rs` ->
  `['src/a.rs']` + `['item-without-key']`. Add one further test that reads the
  SHIPPED template off disk with
  `readFileSync(new URL('../templates/PLAN.md', import.meta.url), 'utf8')` and
  asserts `readFrontmatterList(text, 'requirements')` and
  `readFrontmatterList(text, 'files')` are both `{items: [], issues: []}`, and
  that the same text with `\n  - src/a.rs` spliced in after the `files:` line
  (via a `/^(files:.*)$/m` replace) yields `items: ['src/a.rs']` with no issues -
  so a future edit reverting the template to `[]`-plus-items fails CI instead of
  silently re-opening this hole. In `planning.test.mjs`, add the acceptance-
  criterion seam test: PLAN-1.md with `files: [src/a.rs]  # comment` then
  `  - src/shared.rs`, PLAN-2.md with `files: [src/b.rs]  # comment` then
  `  - src/shared.rs`; assert `plan-overlap` returns `ok:true`, `overlaps: []`,
  and `frontmatter_issues` naming BOTH plans with `item-without-key`. Assert
  the dropped path is absent from the FILES LISTS specifically - no plan's
  `files` array contains `src/shared.rs`, and `overlaps` is empty - never
  `JSON.stringify(result).includes('src/shared.rs')`, which is false by
  construction on correct behavior: every issue carries
  `text: issueText(line)` (`planning-files.mjs:436`) and that text reaches the
  envelope verbatim (`planning.mjs:553`), so the diagnostic itself quotes the
  line `- src/shared.rs`. Naming the dropped line is the POINT of the
  diagnostic; a whole-envelope substring check would fail the task for doing
  its job.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` and
  `node --test cadence-core/bin/planning.test.mjs` pass with the new row and
  test names present, and
  `node --input-type=module -e "import {parsePlanFiles} from './cadence-core/bin/lib/planning-files.mjs'; console.log(JSON.stringify(parsePlanFiles('---\nfiles: []            # files this plan touches\n  - src/shared.rs\n---\n')))"`
  prints `files` as `[]` with an `item-without-key` issue - the exact UAT-8
  reproduction, which returned `{"files":[],"issues":[]}` before this task.

### Task 3: Name the two key-line near-misses

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs
- **Action:** Give `parseFrontmatter` two new classifications, both
  record-and-skip, neither a terminator - the terminator set stays at exactly
  the three members D-04 states. First, `commented-key-line` (D-14): a
  comment-only line (`COMMENT_LINE`) whose body, after stripping leading
  whitespace, the run of `#` characters and any following spaces
  (`/^\s*#+\s*/`), matches `KEY_LINE` records that code and is otherwise
  skipped exactly as any comment is. Do NOT promote it to a terminator: once
  the `#` is stripped, an ordinary prose comment like `# TODO: fill this in`
  also satisfies `KEY_LINE`, so promoting would let prose truncate a real list -
  the silent under-read D-04 exists to close, and truncating a real list is
  worse than folding one. State the accepted cost plainly in the JSDoc:
  `requirements:` / `- "#41"` / `# files:` / `  - src/shared.rs` still folds
  `src/shared.rs` into `requirements` and audit still mints it as an orphan, but
  now with a diagnostic beside it and `choose_path` routing sequential, so it is
  no longer silent; and a prose `# TODO:` comment reports the same code, which
  is accepted noise, not a defect to special-case away. Second,
  `malformed-key-line` (D-16): a line at column 0 (no leading whitespace)
  matching `/^[A-Za-z_][A-Za-z0-9_.-]*:/` but NOT `KEY_LINE` - that is,
  key-shaped but missing the whitespace-or-EOL after its colon - records that
  code instead of the generic `unknown-line`, drops its data, and is skipped.
  Leave `KEY_LINE` itself strict: dropping its `(\s|$)` group would read a
  hand-written `requirements:["#41"]` at the cost of parsing every colon-bearing
  column-0 line as a key/value pair, turning a bare URL `http://example.com`
  into key `http` with value `//example.com`; the new code names the repair (add
  a space after the colon) rather than guessing. Pin the classification order in
  the loop and in the JSDoc, since two of these arms overlap in shape: key line
  (`KEY_LINE`) first, then blank, then comment-only (with the
  `commented-key-line` test inside that arm), then item, then the column-0
  `malformed-key-line` test, then the `unknown-line` fallback. In
  `planning-files.test.mjs` add rows: `requirements:["#41"]` -> items `[]` +
  `['malformed-key-line']`; `requirements:` / `- "#41"` / `# files:` /
  `  - src/shared.rs` -> items `['#41','src/shared.rs']` +
  `['commented-key-line']`, pinned exactly so the executor cannot quietly
  "fix" the accepted fold; a `# TODO: fill this in` comment line inside a block
  -> the block's items unaffected + `['commented-key-line']`; a column-0
  `http://example.com` -> `['malformed-key-line']`, NOT `unknown-line`; and a
  comment-only line that is not key-shaped (`  # shared with plan 2` inside a
  `files:` block) -> items intact and `issues: []`, which guards against
  over-firing and is the shape the seam test at `planning.test.mjs:1014`
  depends on. Add one line-number assertion in the style of `:213` pinning the
  `malformed-key-line` issue's `line` and `text`.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes
  with the new row names, `node --test cadence-core/bin/planning.test.mjs`
  stays green (no existing comment-bearing seam test gains an issue), and
  `node --input-type=module -e "import {readFrontmatterList} from './cadence-core/bin/lib/planning-files.mjs'; console.log(JSON.stringify(readFrontmatterList('---\nrequirements:[\"#41\"]\n---\n','requirements').issues))"`
  prints one issue whose `code` is `malformed-key-line`.

### Task 4: Take `add()` off the frontmatter arm

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `parsePlanFiles` (`:705-717`), add each frontmatter item to the
  `Set` VERBATIM - skipping only the empty string - and keep `add()` exactly as
  it is for the `- **Files:** a, b` task-line matches (D-19; the task-line half
  of D-09 stands). Do not touch `add()`'s body and do not apply its
  parenthetical strip, backtick strip or `{`-placeholder filter to the
  frontmatter arm: the grammar has already resolved that value (comment,
  quoting, trailing content), so re-processing it is a second, silent route to a
  wrong `overlaps` on the very arm this phase claims to have closed -
  `src/x(1)` -> `src/x`, `lib/(x)/y)` -> `lib/`, `docs/notes (draft)` ->
  `docs/notes`, `` a`b.mjs `` -> `ab.mjs`, each a phantom or missed overlap
  reported as authoritative with no `frontmatter_issues` entry. The
  `{`-placeholder filter belongs to the task line, where the template's own
  `{exact/paths, comma-separated}` placeholder lives; frontmatter never carries
  it.

  Close the cross-arm gap this narrowing opens, in the same task. Once the two
  arms normalize differently, the SAME declared path reaches the shared `Set`
  as two different strings depending on which arm a plan used, and
  `plan-overlap` intersects those flat lists across plans - so PLAN-1 declaring
  `src/x(1)` in frontmatter and PLAN-2 declaring `src/x(1)` on a
  `- **Files:**` task line yield `src/x(1)` vs `src/x`, no overlap, no
  `undeclared` (both plans declare files), no `frontmatter_issues`, and
  `choose_path` (`execute.md:72-77`) greenlights PARALLEL on two plans writing
  one file. That is a NEW hole: today both arms normalize to `src/x` and the
  overlap IS reported, so shipping the narrowing alone trades a wrong-string
  defect for a missed-collision defect on the same gate this phase exists to
  make trustworthy. Fix it inside the task-line arm, which keeps its
  normalization per D-19: have the task-line arm add BOTH the normalized form
  and the raw trimmed form (skipping empties and `{`-placeholders on both), so
  a task-line declaration matches a frontmatter one whichever spelling the
  sibling plan used. This can only ADD entries, never remove one, so its
  failure direction is a phantom overlap routing sequential - the safe
  direction for a parallel-safety gate - where the alternative fails toward
  parallel execution on a shared file. State the accepted cost in the JSDoc:
  an annotated task line contributes a non-path string (`src/a.rs (edit)`) to
  that plan's files list, which can appear in `overlaps` output as a duplicate
  beside its normalized twin. Rejected alternative, recorded: normalizing for
  COMPARISON only while reporting the raw string, which lives in
  `planning.mjs`'s overlap logic - a file outside this plan's scope, and a
  wider change than the gap needs.

  Rewrite `parsePlanFiles`' JSDoc accordingly: the frontmatter arm returns
  what the plan declared byte for byte, the task-line arm contributes both its
  normalized and its raw form, and the issues on the return still come from
  the frontmatter arm only. In `planning.test.mjs`, add a seam test for
  acceptance criterion 5: two plans whose `files:` frontmatter each declare
  `src/x(1)` and `` lib/a`b.mjs `` report both paths in `overlaps` byte-exact
  as written. Add the CROSS-ARM test the gap above names, in both directions:
  PLAN-1 declaring `src/x(1)` in frontmatter and PLAN-2 declaring it only on a
  `- **Files:** src/x(1)` task line still report `src/x(1)` in `overlaps`; and
  the same pair with a backtick-bearing path. Extend the existing task-line
  test at `:1508` (or add one beside it) asserting a
  `- **Files:** src/a.rs (edit)` task line still yields the normalized
  `src/a.rs`, so the frontmatter narrowing is provably scoped to one arm.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with the
  new test names, and
  `node --input-type=module -e "import {parsePlanFiles} from './cadence-core/bin/lib/planning-files.mjs'; console.log(JSON.stringify(parsePlanFiles('---\nfiles:\n  - src/x(1)\n---\n\n- **Files:** src/a.rs (edit)\n').files))"`
  prints a list containing `src/x(1)` (the frontmatter path byte-exact),
  `src/a.rs` (the task-line path normalized) and `src/a.rs (edit)` (its raw
  form, the cross-arm bridge) - and no other entry.

### Task 5: State per code what happens to its payload, and move the budget with the prose

- **Files:** cadence-core/references/plan-frontmatter.md, cadence-core/workflows/audit.md, cadence-core/bin/weight-budgets.json, cadence-core/bin/planning.test.mjs
- **Action:** Amend `references/plan-frontmatter.md` to match the parser tasks 1-4
  ship. Delete the falsified invariant at `:113-115` ("never changes `counts`,
  and never adds or clears an audit `break`") and replace it with the accurate
  statement (D-15): a diagnostic is additive, never flips `ok` and is never
  itself a `break`, but it is NOT verdict-neutral in general - where the code
  DROPS the payload it read, the ids or files that line would have contributed
  are simply absent, so `audit` can report `no-plan` and `counts.broken` can
  move for that reason, with the diagnostic naming why. Add a Payload column to
  the code table with one row per code, stating exactly: `unterminated-frontmatter`
  drops the whole block (every key reads empty); `unterminated-inline-list`
  drops that key's list; `unterminated-quote` drops that value;
  `malformed-key-line` drops that line's key and value; `item-without-key`
  drops that item; `commented-key-line` drops nothing but does not terminate the
  open block, so items below it fold into the previous key (the stated,
  accepted over-read); `unknown-line` drops WHATEVER THAT LINE CARRIED, which
  is nothing when the line was never data (a stray prose line between items
  leaves the items above and below intact) but is a whole key when the line was
  a malformed one - `1requirements: ["#41"]` fails `malformed-key-line`'s own
  `/^[A-Za-z_]/` start and falls here, contributing no ids at all, and a
  block-item line missing its `- ` (`  "#46"` under an open key) loses that id;
  `trailing-inline-content`, `trailing-value-content` and `residual-quote` all
  preserve their payload. Do NOT write `unknown-line` as a flat
  "drops nothing" row: CONTEXT D-15 verified at the audit seam that it returns
  `counts:{total:1,traced:0,broken:1}` alongside its diagnostic, so a flat row
  would contradict the locked decision this very task exists to honor, and the
  per-code test below would fail against its own fixture. It is the one
  conditional code in the table and must be stated as conditional.
  Document the three new codes with the edit that clears each. Restate the
  "wrapping-quote strip" section as value resolution: a quoted value ends at the
  next matching quote character, an unquoted value ends at its first whitespace,
  trailing content after either is diagnosed and dropped while the value before
  it stands, a resolved value still containing a quote is reported and kept, and
  the grammar has NO escape rule (D-20). Add the block-list rule for an item
  arriving with no open key, and note that a line reports at most one issue per
  code. In `workflows/audit.md`, rewrite the step-4 paragraph at `:52-55` to the
  same two-part claim in two or three lines - a diagnostic never creates or
  clears a break by itself, but a payload-dropping code can leave a requirement
  untraced, and `references/plan-frontmatter.md` says which codes drop - keeping
  the no-PASS-with-warnings rule untouched. Then run
  `node cadence-core/bin/weight.mjs` and set
  `cadence-core/workflows/audit.md`'s entry in
  `cadence-core/bin/weight-budgets.json` to the exact reported byte count in
  this SAME commit: the file is at 3002 against a 3002 budget, zero headroom, so
  any added byte fails CI with `budget-overrun` (D-22). Do not touch
  `workflows/execute.md` - its `choose_path` already routes `frontmatter_issues`
  to sequential and it has zero headroom too. Finally, make the prose falsifiable
  rather than eyeballed: add a per-code table test to `planning.test.mjs` that,
  for each code, builds a `blockPlanTree` frontmatter producing exactly that
  code (`requirements: ["#41"` for `unterminated-inline-list`;
  `requirements: ["#41]` for `unterminated-quote`; `requirements:["#41"]` for
  `malformed-key-line`; `requirements: []` then `  - "#41"` for
  `item-without-key`; `requirements:` / `- "#41"` / `# files:` /
  `  - src/shared.rs` for `commented-key-line`; `requirements: ["#41"] stray`
  for `trailing-inline-content`; `requirements:` then `  - "#41" stray` for
  `trailing-value-content`; `requirements:` then `  - "#41"` with
  `files: ["a\"]` for `residual-quote`; and the unclosed-fence file written
  directly as at `:1136` for `unterminated-frontmatter`), and asserts for each:
  `ok` is true, the code appears in `audit`'s `frontmatter_issues`, and
  `counts.broken` is STRICTLY GREATER than the payload-preserving twin
  (`requirements:` / `  - "#41"` / `files: []`) for every dropping code and
  EQUAL to it for every preserving code.

  Two constraints on how that comparison is built, both of which the naive
  version gets wrong. First, every fixture and the twin must seed the SAME
  requirement ids in the tree and declare the same number of them, or the
  comparison measures the fixture's id count rather than the code's payload
  behavior - a two-id `blockPlanTree` fixture compared against a one-id twin
  differs in `counts.broken` for a reason that has nothing to do with the
  diagnostic. Use a single-id (`#41`) tree for the twin and every fixture,
  varying ONLY the frontmatter line that mints the code. Second,
  `unknown-line` cannot be asserted with one row, because it is conditional
  (see its table entry): give it TWO rows - a stray prose line between items
  (`requirements:` / `  - "#41"` / `  this line is not an item`), asserting
  `counts.broken` EQUAL to the twin, and a data-carrying malformed line
  (`1requirements: ["#41"]` at column 0), asserting STRICTLY GREATER. Those two
  rows together are what make the table's conditional row falsifiable; one row
  of either shape would pin half the behavior and read as the whole of it. For
  `commented-key-line` also assert `orphans.plan_ids` carries the folded
  `src/shared.rs`, which is the over-read the reference now states out loud.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes whole - the glob
  form CI runs and acceptance criterion 7 names, not the two files this phase
  touches, so a regression anywhere in `bin/` is caught here rather than at the
  phase gate - with the per-code table test names in the output;
  `npx tsc -p tsconfig.ci.json` exits 0;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]` (no
  `budget-overrun`, no `missing-path`);
  `grep -c "never changes" cadence-core/references/plan-frontmatter.md`
  reports 0 (the falsified invariant is gone, not merely qualified) - do NOT
  reuse that string as the audit.md check, which reports 0 today before any
  edit (audit.md:52-55 reads "neither creates nor clears a `break`", never
  "never changes"), so it would pass for a file left untouched; assert audit.md
  instead with `grep -c "neither creates nor clears"` reporting 0 AND
  `grep -c "plan-frontmatter.md" cadence-core/workflows/audit.md` reporting at
  least 1, so the paragraph provably moved and the pointer provably landed; and
  `node cadence-core/bin/planning.mjs audit` on this repo's own `.planning`
  prints no `frontmatter_issues` key - proving the two new key-line codes do not
  fire on Cadence's own shipped plan files.

## Notes

- **No seeded requirement IDs this cycle.** `.planning/REQUIREMENTS.md`
  `## Active` reads "None." and its `## Traceability` table is empty for the
  newly-opened v1.4.0 cycle, so `requirements: []` is correct and matches the
  executed `PLAN.md`. Inventing an ID here would fabricate exactly the orphan
  `audit` reports as `orphans.plan_ids`. Phase 2 of this cycle owns the seeding
  fix (recalled: CAPTURE.md, phase 3 - the seeding step has failed to fire at
  two consecutive closes); do not take it on here.
- **Plan shape honored:** one plan, written as `PLAN-2.md` alongside the
  executed `PLAN.md` per D-21, matching the CONTEXT directive. All five tasks
  edit `cadence-core/bin/lib/planning-files.mjs` or the two test files, and
  Task 5's prose depends on the codes Tasks 1-3 mint, so no independent slice
  exists. D-21's accepted consequence stands: `plan-overlap --phase 1` now
  reports a real and correct overlap between `PLAN.md` and `PLAN-2.md` on
  `planning-files.mjs`, and `status` reads phase 1 as a split phase.
- **Two planner choices recorded** (CONTEXT left the code names open). The
  trailing-content code is `trailing-value-content`, deliberately distinct from
  the existing `trailing-inline-content` (which means content after an inline
  list's closing `]`, a different repair). The D-20 code is `residual-quote`,
  named for what is actually detected - a quote character surviving into a
  resolved value - rather than for the backslash escape that is only one way to
  produce it.
- **One stated cost this pass introduces, recorded rather than hidden:** under
  D-18's symmetry an unquoted frontmatter value now ends at its first
  whitespace, so an unquoted value containing a space reads as its first token
  plus a `trailing-value-content` diagnostic. Checked against every plan
  frontmatter in git history (21 commits, keys `phase`/`plan`/`requirements`/
  `files` only): every value is a single token, so no shipped form regresses,
  and the grammar's answer is to quote it. A second cost, from D-20 read
  literally: a correctly double-quoted path carrying an apostrophe
  (`"src/it's-a-file.md"`) is reported as `residual-quote` with its payload
  intact - a report, never a loss.
- **Stated deviation from acceptance criterion 6, flagged not smoothed.** AC6
  reads "`references/plan-frontmatter.md` AND `workflows/audit.md` state for
  every diagnostic code whether it changes `counts` or adds a break". This plan
  ships the per-code table in the reference only; `workflows/audit.md` gets the
  general two-part rule plus a pointer. Reason: `audit.md` is workflow prose
  loaded on every `/cad-audit` run and sits at 3002/3002 bytes, so a ten-row
  table there is a permanent per-run token cost for a reference-grade detail,
  and duplicating the table across two surfaces creates exactly the prose-drift
  the first pass's UAT-11 failure was. The criterion's substance - that the
  stated behavior MATCHES what the audit seam returns - is met, and met by
  machine: Task 5's per-code seam test is what proves it, which is stronger
  than either file's prose. Recorded here so `/cad-verify` prices the narrowing
  deliberately rather than reading AC6 as satisfied; if the user wants the
  literal reading, the table goes in `audit.md` too and `weight-budgets.json`
  moves further in the same commit.
- **Seven review findings applied before execution** (`plan` trigger,
  adjudicated; `cad-reviewer` + `openai/gpt-5.3-codex`, `deepseek-v4-pro`
  returned none). Three converged across both reviewers and are the
  load-bearing ones: Task 4's arm split could MISS a real collision when one
  plan declares a path in frontmatter and another declares it on a task line
  (closed by the dual-add bridge, since today both arms normalize alike and the
  narrowing alone would have traded a wrong-string defect for a missed-collision
  defect); the `unknown-line` payload row contradicted locked D-15 (closed by
  stating it as the one conditional code, with two test rows); and AC6's
  two-surface reading (flagged above). Four more were single-reviewer and
  verified against the parser before applying: the one-element escape
  `files: ["a\"]` stayed at `issues: []` under the drafted rule (closed by the
  residual test's backslash arm), the residual test would have over-fired on
  the reference's own prescribed `"src/it's-a-file.md"` spelling (closed by the
  same-quote restriction), Task 2's whole-envelope substring assertion was
  false by construction against its own diagnostic, and Task 5's
  `grep "never changes"` check already reported 0 for `audit.md` before any
  edit.
- **Recalled prior evidence drove the task set** (UAT.md and CAPTURE.md,
  phase 1): the HIGH `if (currentKey)` drop at `planning-files.mjs:650` on the
  shipped template's own shape is Task 2 (and is why Task 2 also moves the
  template and pins it with an on-disk test); the HIGH `unwrap`-plus-`add()`
  regression from `7b58a80` is Tasks 1 and 4; the `KEY_LINE` contradiction the
  reference's own invariant forbids is Tasks 3 and 5; the no-escape-handling
  item is Task 1's `residual-quote`; and the `add()`-on-both-arms capture item
  filed by the first pass's Task 6 is closed by Task 4 - `/cad-verify` marks it
  and the other `readFrontmatterList` capture bullets with the shipping SHA,
  which is not the executor's step. The one-test-per-row shape fixed at
  `afccec8` is the shape every new row in this plan follows.
