---
phase: 1
plan: 1
requirements: [GRM-01]
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/references/plan-frontmatter.md
  - cadence-core/templates/PLAN.md
  - cadence-core/workflows/audit.md
  - cadence-core/workflows/execute.md
  - cadence-core/bin/weight-budgets.json
  - .planning/CAPTURE.md
---

# Phase 1: The plan-file frontmatter grammar - Plan

## Goal

`readFrontmatterList` reads every shipped PLAN.md form - inline, block, scalar;
a comment on the key line, heading the block, or as a block item; `#` with and
without a following space; CRLF checkouts; a leading blank line or BOM - to
exactly the ids and files declared, and reports anything outside the grammar
through the `audit` and `plan-overlap` envelopes instead of silently over- or
under-reading it.

## Must be true when done

- A PLAN.md whose `requirements:` key line carries a trailing comment above a
  block list audits to exactly the two declared ids: zero `orphans.plan_ids`
  entries, no `no-plan` break on either id.
- Two plans whose `files:` block lists each contain a comment line and share a
  path have that path reported in `plan-overlap`'s `overlaps`, so the parallel
  gate can no longer greenlight two plans that write the same file.
- Every shipped value form reads to exactly the strings declared: an inline list
  with a bracketed trailing comment yields no entry containing `]`, `#`, or
  comment words; `requirements: #TODO fill this in` above a block list of two
  quoted ids yields those two ids and mints nothing containing `TODO`; a block
  item `- "#41"` still reads as the id `#41`.
- The CRLF, leading-blank-line, and BOM variants of one PLAN.md return ids and
  files identical to its plain-LF equivalent.
- A frontmatter line that is neither item, comment, blank, nor terminator is
  named (file, line, code) in a `frontmatter_issues` field on both the `audit`
  and `plan-overlap` envelopes REGARDLESS of which key's list it sits in or
  whether any block list is read at all, and its presence changes neither
  `counts` nor the audit PASS/FAIL verdict - because an unknown line is
  recorded and SKIPPED, never treated as a terminator, so no item below it is
  lost.
- The grammar is written down in `cadence-core/references/plan-frontmatter.md`,
  and `node --test cadence-core/bin/*.test.mjs`,
  `npx tsc -p tsconfig.ci.json` and `node cadence-core/bin/self-verify.mjs` are
  all green, with the rewritten seam-level frontmatter tests and the new
  parser-level grammar table among the passing set.

## Context

Locked decisions bind this plan; read `.planning/phases/1/CONTEXT.md` first.
D-01: an unquoted `#` after `key:` always starts a comment, `"#41"` is data -
the `requirements: #41` case INVERTS and its test is rewritten. D-03: the
function body is replaced by an explicit line classifier, never a tenth regex
arm. D-04: a block list skips blank and comment-only lines and stops on a
stated terminator set. D-05: `normalize(text)` lives in `planning-files.mjs` on
the PARSE path only, never in `planning.mjs`'s `read()`. D-02: what falls
outside the grammar is reported through an additive, omitted-when-empty
diagnostic field on both envelopes, never `{ok:false}`. D-06: a new parser-level
`planning-files.test.mjs` carries the grammar table ALONGSIDE the seam tests.
Out of scope (D-09, D-10): the `- **Files:** a, b` task-line arm and its `add()`
helper, `PHASE_LINE`, `parseRoadmapPhases`, the snippet parsers, and `parseUat`'s
fence. Existing shapes to follow: the `orphans` / `undeclared` envelope idiom in
`planning.mjs:512-517,545-553`, and the lib unit-test style in
`cadence-core/bin/require-int.test.mjs`.

## Tasks

### Task 1: Normalize, fence, and wire the diagnostic end to end

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `planning-files.mjs`, add and export `normalize(text)` that
  strips one leading `U+FEFF` byte-order mark and converts `\r\n` and lone `\r` to `\n`. Its
  JSDoc states D-05: parse path only, deliberately NOT in `planning.mjs`'s
  `read()`, whose text is written back verbatim by `phase-done` and `renumber`
  so normalizing there would rewrite a user's CRLF ROADMAP.md wholesale; phase 4
  adopts it for the roadmap grammar. Restructure the reader into ONE pass over
  the frontmatter block rather than one scan per key, because the structural
  diagnostics must not depend on which key the caller asked for: `audit` reads
  only `requirements` (`planning.mjs:478`) and `plan-overlap` reads only `files`
  (`:537`), so a per-key scan can report a stray line to only ONE envelope, and
  under the shipped template's inline `requirements: []` / `files: []` no block
  scan runs at all so a stray line reaches NEITHER - which would leave the
  must-be-true bullet and D-02 undelivered for the most common shipped shape.
  Add and export `parseFrontmatter(text)` returning
  `{keys: Map<string, string[]>, issues: Issue[]}` - the single classifying pass
  D-03 calls for, walking every line of the block ONCE and classifying it as
  fence, column-0 key line, item, comment, blank, or unknown.
  `readFrontmatterList(text, key)` becomes a thin selector over that result,
  returning `{items, issues}` where `items` is `keys.get(key) ?? []` and
  `issues` is the WHOLE pass's issue list, never a key-scoped subset; export it
  too (the grammar table in Task 4 drives it directly). Declare a JSDoc
  `@typedef` for
  `Issue = {line: number, code: string, text: string}` - `line` is 1-indexed
  into the NORMALIZED text, `text` is the offending line trimmed and truncated
  to 120 characters with a trailing `...`. Replace the byte-0 fence match: run
  `normalize`, split on `\n`, skip leading whitespace-only lines, require the
  first non-blank line to match `/^---\s*$/` (anything else means the file has
  no frontmatter - return empty items and NO issue, since audit's `no-plan` and
  plan-overlap's `undeclared` already make that loud), then take the block up to
  the next line matching `/^---\s*$/`; an opening fence with no closing fence
  returns empty items plus one issue `unterminated-frontmatter` at the opening
  fence's line. Replace the `new RegExp('^' + key + ':\\s*(.*)$')` key lookup
  with an exact column-0 prefix test (`line.startsWith(key + ':')` on a line with
  no leading whitespace, remainder = `line.slice(key.length + 1)`, first
  occurrence wins). Be precise about what this does and does not fix: swapping
  the interpolated `\s*` for a slice does NOT by itself close the HIGH
  regression, because this task still trims the remainder, so
  `requirements:   # note` still arrives at the value arms as `# note`,
  byte-identical to today. Task 2's scanner is the only thing that closes it,
  and this task's verify cannot detect that case - do not read the key-lookup
  change as closing the HIGH defect, and do not let it justify weakening Task 2.
  What the exact prefix test buys is a stated rule (column 0, first occurrence
  wins) in place of an interpolated regex, per D-03. Keep the three value arms
  unchanged in this task (Task 2 replaces them) and keep the existing contiguous
  block loop as the pass's provisional item rule (Task 3 replaces it); trim the
  remainder as today so behavior is otherwise identical. Widen the two wrappers:
  `parsePlanRequirements` returns `{ids, issues}` and `parsePlanFiles` returns
  `{files, issues}`, where `files` is the existing `Set` union with the untouched
  task-line arm and `issues` comes from the frontmatter arm only (D-09). In
  `planning.mjs`, destructure both call sites (`cmdAudit:478`,
  `cmdPlanOverlap:537`) and collect per-plan issues in plan-file order; emit
  `frontmatter_issues` on `audit` as `[{file: 'phases/<n>/<PLAN>.md', issues}]`
  placed between `orphans` and `deferred`, and on `plan-overlap` as
  `[{plan: '<PLAN>.md', issues}]` placed after `undeclared`, each omitted when
  empty per the seam contract. `cmdPlanOverlap` has TWO success returns and the
  diagnostic must ride both: the fewer-than-two-plans early return at
  `planning.mjs:534-536` builds its own `{phase, plans: [], overlaps: [], note}`
  envelope, so a one-plan phase's grammar diagnostic would otherwise reach
  `plan-overlap` never. Parse the plan file(s) BEFORE that early return and add
  `frontmatter_issues` to its envelope too, keeping `note` as it is. Issues must
  never flip `ok`, never change `counts`, and never add or clear a `break`. In
  `planning.test.mjs`, add three tests: a PLAN.md written with CRLF line endings
  audits to the same ids and breaks as its LF twin, AND its `files:` list reaches
  `plan-overlap` identically to the LF twin's (assert the files path, not only
  the ids - the goal names both, and only the ids are otherwise covered; write
  only the PLAN.md as CRLF, the sibling parsers stay out per D-10); a PLAN.md
  prefixed with a BOM and a leading blank line does the same; and a plan whose
  frontmatter opens with `---` and never closes reports `frontmatter_issues` with
  code `unterminated-frontmatter` on both `audit` and `plan-overlap` while
  `audit` stays `ok:true`. That third test must exercise the early-return path
  deliberately - `blockPlanTree()` (`planning.test.mjs:910`) builds exactly one
  PLAN.md, so it hits `:534` and would fail against the pre-fix envelope; assert
  the diagnostic there rather than weakening the assertion to `audit` alone,
  which would silently drop half of D-02's both-envelopes requirement.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with the
  three new test names in the output, and `npx tsc -p tsconfig.ci.json` exits 0
  (the widened return shape is what the `// @ts-check` pragma must accept).

### Task 2: The quote-state value scanner for the key line and block items

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add a module-private `scanValue(s)` returning `{value, code}`:
  walk left to right tracking `quote` (null, `"`, or `'`); a quote character
  opens a span when `quote` is null and closes it when it matches the open
  quote; an unquoted `#` ends the value at that index (D-01: quoting decides -
  no `# ` versus `#x` discrimination, no whitespace-preceded rule, so
  `requirements: #TODO fill this in` and `requirements: #41` both scan to an
  empty value); end of string ends the value; the returned value is right
  trimmed. If the scan ends inside a quote span, yield NO items for that key
  plus code `unterminated-quote`, and do not fall through to any other arm.
  Fail loud, not half-parsed: `files: [src/it's-a-file.md]` must not be
  silently rewritten by a global quote strip (the old `clean()` behavior), but
  neither may it be half-read - an apostrophe opens a span that never closes, so
  the closing `]` is inside quotes and no honest item boundary exists. Yielding
  nothing makes the plan `undeclared` in `plan-overlap` and gives its ids
  `no-plan` breaks in `audit`, both already-loud states, with the diagnostic
  naming the real reason. **Every code any arm produces is appended to the
  pass's `issues` with that line's 1-indexed number - the key line, the scalar
  arm, and each block item alike.** A code that is computed and dropped on the
  floor is the exact failure this phase exists to end, and the inline arm is not
  privileged: a scalar `files: some/path'` and a block item `- 'unclosed` each
  report `unterminated-quote` just as an inline list does. Add a module-private `unwrap(s)` implementing D-08's
  WRAPPING-quote strip: strip exactly the first and last character when the
  trimmed string is at least 2 characters and starts and ends with the same
  quote character; never a global `["']` replace, which both mangles real paths
  and destroys the signal D-01 now reads. Delete `clean()` entirely - its
  `/\s+#.*$/` cannot fire on a `#` at index 0 (the block-item over-read) and its
  global quote strip is superseded. Rewrite the value arms against the scanned
  value: a value starting with `[` is the inline flow list - find the closing
  `]` at quote depth 0 by the same scan, split the payload on commas at quote
  depth 0 (a comma inside quotes is literal), trim and `unwrap` each element and
  drop empties; no closing `]` yields empty items plus code
  `unterminated-inline-list`; non-whitespace after the closing `]` yields code
  `trailing-inline-content` with the payload still parsed. Never use a
  `\[(.*)\]` capture in any form - the greedy version is the defect three
  reviewers found, and a non-greedy regex still cannot see quoting. A non-empty
  value not starting with `[` is a scalar: exactly one element, `unwrap`ped,
  never a fall-through to the block reader. An empty value (including a
  remainder that was entirely a comment) falls through to the block reader. Run
  block-item payloads through the same `scanValue` + `unwrap` pair so the two
  paths cannot drift. Rewrite the function's JSDoc to state this grammar and
  delete the now-false paragraph claiming `#` followed by a non-space is an id.
  In `planning.test.mjs`, rewrite the affected seam tests: the block-form
  `#48.1` test's items become quoted (`- "#41"`, `- "#46"  # with a comment`)
  since an unquoted `- #41` is a comment under D-01; the inline-with-comment
  test's comment gains brackets (`requirements: ["#41", "#46"]  # ids, see
  [D-06]`) and asserts exactly the two ids with `orphans` undefined; and the
  `bare #41-shaped scalar` test INVERTS - replace it with one named for the new
  rule, using `requirements: #TODO fill this in` above a block list of two
  quoted ids, asserting both ids resolve to the plan, neither breaks `no-plan`,
  and nothing containing `TODO` appears anywhere in the output, plus a quoted
  scalar case (`requirements: "#41"`) reading as the single id `#41`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with the
  rewritten tests, and `node --input-type=module -e "import {parsePlanRequirements} from './cadence-core/bin/lib/planning-files.mjs'; console.log(JSON.stringify(parsePlanRequirements('---\nrequirements: [\"#41\"]  # ids, see [D-06]\nfiles: []\n---\n').ids))"`
  prints exactly `["#41"]`.

### Task 3: The block reader with a stated terminator set

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Replace the contiguous `- item` loop (D-04). From the line after
  the key line, walk to the end of the frontmatter block classifying each line:
  a whitespace-only line is skipped; a comment-only line (`/^\s*#/`) is skipped;
  an item (`/^\s*-\s+(.*)$/`) has its payload scanned and unwrapped by Task 2's
  helpers and is pushed when the result is non-empty - an item whose payload is
  entirely a comment (`- # stray`, and under D-01 also `- #41`) contributes
  nothing and is NOT an issue, which is CONTEXT's accepted D-01 cost, and a bare
  `-` line likewise contributes nothing; a terminator stops the list, and the
  terminator set is exactly three things - a line matching `/^---\s*$/`, a key
  line at column 0 (`/^[A-Za-z_][A-Za-z0-9_.-]*:(\s|$)/`), and the end of the
  frontmatter block. Anything else records an `unknown-line` issue carrying that
  line's number and text and is then SKIPPED, exactly like a blank or comment
  line - it does NOT stop the list. D-04 fixes the terminator set at three
  things; making an unknown line a de-facto fourth terminator would contradict
  that locked decision, and it would also make the truncation it causes real:
  items below the stray line would be dropped, so `audit` would emit `no-plan`
  breaks on ids the plan genuinely declares, `counts.broken` would move, and the
  verdict could flip PASS to FAIL - which is precisely what must-be-true bullet
  5 and the `audit.md` prose in Task 5 promise a diagnostic never does. Skipping
  keeps that promise true: the stray line is reported, and nothing is lost.
  Do not introduce indentation or nesting rules - the grammar
  deliberately has none, so any indent on an item line is accepted. In
  `planning.test.mjs`, rewrite the block-form audit test so its list survives a
  comment heading it, a comment splitting it, and a blank line inside it
  (`requirements:   # ids` then `  # covers auth`, `  - "#41"`, an empty line,
  `  - "#46"`), asserting both ids resolve with `orphans` undefined; add the
  acceptance-criterion plan-overlap test where two plans' `files:` block lists
  each contain a comment line and both declare `src/shared.rs`, asserting
  `overlaps` reports that path with both plan names and `undeclared` is
  undefined; and add a test placing a stray non-item line BETWEEN the two ids of
  a block list - not after both, which is the one arrangement where truncation
  and skipping are indistinguishable and a stop-the-list implementation would
  pass unnoticed - asserting that BOTH ids still resolve, that the line appears
  in `frontmatter_issues` with code `unknown-line` on both `audit` and
  `plan-overlap`, and that `counts` is identical to the same tree without the
  stray line. Add one further test proving the diagnostic is not key-scoped: a
  stray line sitting under `requirements:` must reach `plan-overlap` (which reads
  only `files:`), and a stray line between two INLINE keys - the shipped template
  shape, where no block scan runs at all - must reach both envelopes.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes, and
  `node cadence-core/bin/planning.mjs plan-overlap --phase 1 --dir <a two-plan
  fixture whose files: block lists carry a comment line and share src/shared.rs>`
  prints one `overlaps` entry naming `src/shared.rs`.

### Task 4: The parser-level grammar table

- **Files:** cadence-core/bin/planning-files.test.mjs
- **Action:** New zero-dep `node:test` file in the style of
  `cadence-core/bin/require-int.test.mjs`, importing `normalize` and
  `readFrontmatterList` from `./lib/planning-files.mjs`. Carry the grammar as a
  table of at least 20 rows, each `{name, text, key, items, issues}` asserted
  with `assert.deepEqual` on both the items and the issue codes, covering: the
  template's own `requirements: []` and `files: []` lines with their trailing
  comments; inline quoted; inline unquoted; inline with a bracketed comment;
  inline carrying a quoted `#` id; unterminated inline list; trailing content
  after the closing `]`; a two-space block list; a block list with a comment
  heading it; a comment splitting it; a blank line inside it; termination at the
  next key line; termination at the closing fence; a block item that is entirely
  a comment; a block item `- "#41"`; a bare `-` item; a quoted scalar; an
  unquoted scalar; a key line whose remainder is entirely a `# ` comment; the
  `#TODO` no-space comment form; a whole-file CRLF variant; a leading blank
  line; a BOM; an unterminated fence; a missing key; a file with no frontmatter
  at all; and a prose `requirements:` line below the closing fence contributing
  nothing. Pin the three cases the review found under-specified, each with an
  explicit expected `items` so the executor cannot choose either behavior: an
  unterminated quote inline (`files: [src/it's-a-file.md]`) with
  `items: []` and code `unterminated-quote`; an unterminated quote as a SCALAR
  (`files: some/path'`) with the same; and an unterminated quote as a BLOCK ITEM
  (`- 'unclosed`) with the same - the scalar and block-item rows exist precisely
  because the code was specified once and wired only on the inline arm. Add two
  rows for the skip-don't-terminate rule: a stray line BETWEEN two items, whose
  `items` must contain BOTH, plus one `unknown-line` issue; and a stray line
  between two inline keys, where `items` is unaffected and the issue is still
  reported. Add a small second table for `normalize` alone: CRLF to LF, a lone
  CR to LF, a BOM stripped, and plain LF text returned unchanged. Assert issue
  line numbers, not just codes, on at least the `unknown-line` and
  `unterminated-frontmatter` rows. This file is picked up by CI's existing
  `cadence-core/bin/*.test.mjs` glob with no config change.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes and
  reports at least 20 tests, and `node --test cadence-core/bin/*.test.mjs` is
  green across the whole suite.

### Task 5: State the grammar in prose and move the budgets with it

- **Files:** cadence-core/references/plan-frontmatter.md, cadence-core/templates/PLAN.md, cadence-core/workflows/audit.md, cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** Write `cadence-core/references/plan-frontmatter.md` as the format's
  statement: normalization (a leading BOM stripped, CRLF and lone CR to LF), the
  fence (leading blank lines tolerated, both fences a bare `---` line), the key
  line (column 0, first occurrence wins), the comment rule as D-01 states it (an
  unquoted `#` starts a comment anywhere in a value, `"#41"` is data, so quote
  every `#`-shaped id), the three value forms, the block-list skip rules and the
  three-item terminator set, the wrapping-quote strip, and each diagnostic code
  (`unterminated-frontmatter`, `unterminated-inline-list`,
  `trailing-inline-content`, `unterminated-quote`, `unknown-line`) with what it
  means and the edit that clears it. Name
  `cadence-core/bin/lib/planning-files.mjs` `readFrontmatterList` as the single
  implementation. In `templates/PLAN.md`, extend the `requirements:` and `files:`
  frontmatter comments to say a `#`-shaped id must be double-quoted, and point at
  `references/plan-frontmatter.md`; do not add a body line, since template body
  text lands in every generated plan. In `workflows/audit.md`, add
  `frontmatter_issues` to the step-2 field list and one line in step 4 stating
  that a grammar diagnostic is orthogonal to the verdict - it names a plan file
  whose frontmatter fell outside the grammar and is reported alongside the trace,
  and it neither creates nor clears a break, so the no-PASS-with-warnings rule at
  the end of step 4 is untouched. In `workflows/execute.md`'s `choose_path`, add
  that any `frontmatter_issues` entry forces sequential for the same reason
  `undeclared` does: a plan whose frontmatter did not fully parse cannot be
  proven independent. Then run `node cadence-core/bin/weight.mjs` and set each
  changed surface's entry in `weight-budgets.json` to the exact reported byte
  count - `audit.md` (2599) and `execute.md` (12140) sit at their budgets today,
  so the budgets must move in this same change or CI fails `budget-overrun`.
  `references/` and `templates/` are not measured by
  `lib/surface-weight.mjs`, so the grammar file itself costs no budget.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`
  (no `budget-overrun`, no `missing-path`), and
  `grep -c frontmatter_issues cadence-core/workflows/audit.md cadence-core/workflows/execute.md`
  reports a non-zero count for both files. Because `choose_path` is prose the
  model follows rather than code a test can branch through, also assert the
  sentence landed where it governs, not merely somewhere in the file:
  `sed -n '/<step name="choose_path">/,/<\/step>/p' cadence-core/workflows/execute.md | grep -c frontmatter_issues`
  returns a non-zero count.

### Task 6: File the task-line `add()` mangling as a capture item

- **Files:** .planning/CAPTURE.md
- **Action:** Append one `- [ ] (phase 1)` bullet under `## Todos` recording the
  defect D-09 deliberately left out of this phase. Word it against the real call
  site, which is NOT the task-line arm alone: `add()`
  (`cadence-core/bin/lib/planning-files.mjs:506-509`) is applied to EVERY path
  from BOTH sources - the frontmatter items at `:510` as well as the
  `- **Files:**` task-line matches at `:511-513`. So its
  `.replace(/\s*\(.*\)\s*$/, '')` and backtick strip post-mangle a
  grammar-exact frontmatter read: `src/a (new).mjs` reduces to `src/a`, which
  can collide with a plan that genuinely declares `src/a` (a phantom overlap) or
  miss a real collision, with `overlaps` reported as authoritative and no
  `frontmatter_issues` entry, because by then the grammar layer has already
  returned cleanly. Record that this phase rewrote the frontmatter arm against a
  stated grammar but left `add()` untouched, so a second route to a wrong
  `overlaps` survives ON the arm this phase claims to have closed - and that
  fixing it is a file-not-fix here by CONTEXT D-09. Describing it as a task-line
  defect would send the follow-up to the wrong call site.
- **Verify:** `node cadence-core/bin/planning.mjs recall "task line Files paren
  path mangled add"` returns the new item among its results (CAPTURE `## Todos`
  bullets are part of the recall corpus).

## Notes

- **No seeded requirement IDs this cycle.** `requirements:` is deliberately
  empty: `.planning/REQUIREMENTS.md` `## Active` reads "None." with no v1.4.0
  rows, and the ROADMAP phase entries carry no requirement IDs. Phase 2 of this
  same cycle exists precisely to make `/cad-plan` seed the `## Traceability`
  rows, and that seeding has now failed to fire at two consecutive closes
  (v1.2.0 and v1.3.1). Inventing IDs here would fabricate exactly the orphan
  `audit` reports as `orphans.plan_ids`. `/cad-verify` should seed this phase's
  row by hand at the close if phase 2 has not shipped yet.
- **Plan shape honored:** one PLAN.md, matching CONTEXT's directive. Tasks 1-3
  all rewrite the same function and Tasks 5-6 depend on the field names Task 1
  fixes, so no independent slice exists.
- **Recalled prior evidence** (CAPTURE.md, phase 3) drove the task order: the
  HIGH `ef75864` regression (a comment that IS the whole remainder) is closed by
  Task 1's column-0 key lookup plus Task 2's scanner; the greedy `\[(.*)\]` three
  reviewers found independently is closed by Task 2's quote-depth scan; the
  first-non-item block break and the comment-as-block-item over-read are closed
  by Task 3; the byte-0 fence anchor and total CRLF failure are closed by
  Task 1. The parallel-safety consequence recorded there (a comment line
  truncating a `files:` list into a false `overlaps: []`) is the acceptance
  criterion Task 3's second test pins.
- **One planner choice recorded** (CONTEXT left it open): Task 5 makes a
  `frontmatter_issues` entry force sequential in `execute.md`'s `choose_path`.
  D-02 names the partial read as the one failure with no observable, and
  `choose_path` already treats `undeclared` and `ok:false` as unproven; leaving
  the diagnostic advisory there would report the exact condition that greenlights
  a collision and then parallelize anyway.
- **Adjudicated `plan` review applied** (cad-reviewer @ opus/high,
  openai/gpt-5.3-codex @ high, deepseek/deepseek-v4-pro @ high; 13 raw findings,
  9 survived grounding). Two were blockers and both are now closed in the text
  above. First: issue detection was scoped per key, but `audit` reads only
  `requirements` and `plan-overlap` reads only `files`, so a stray line could
  reach only ONE envelope - and under the shipped template's inline `[]` form,
  neither - making must-be-true bullet 5 and D-02 undeliverable. Closed by the
  single `parseFrontmatter(text)` pass in Task 1, with `readFrontmatterList` a
  selector over it. Second: Task 3 made an `unknown-line` stop the list, adding a
  de-facto fourth terminator against D-04's stated three AND making the
  diagnostic drop items, move `counts` and flip the verdict - the opposite of
  what Task 5 would have shipped into `audit.md` as prose. Closed by recording
  and SKIPPING an unknown line. The surviving mediums closed the `plan-overlap`
  early-return envelope (`planning.mjs:534`), the `unterminated-quote`
  self-contradiction (now pinned to no items plus a loud diagnostic), the
  scanner codes that were computed but wired only on the inline arm, and Task 6's
  misattribution of `add()` to the task-line arm when it mangles frontmatter
  paths too. One finding was downgraded rather than applied: a claim that
  `parsePlanFiles` might regress onto raw CRLF text is prevented by
  construction, since `normalize` runs inside the shared reader both wrappers
  call - the CRLF assertion added to Task 1 covers the files path anyway.
- **One inaccurate claim removed from Task 1**: it asserted the interpolated
  `\s*` was the HIGH regression's root cause, while still trimming the remainder
  and so reproducing the same whitespace-eating. Task 2's scanner is what closes
  that defect. Left uncorrected, an executor could have read the regression as
  closed at Task 1 and weakened the scanner.
- **Nine CAPTURE items close with this phase** but are not marked here: the
  `readFrontmatterList` bullets under `## Todos` need the shipping commit's SHA
  in their `- closed by <sha>` suffix, which is `/cad-verify`'s step, not the
  executor's.
