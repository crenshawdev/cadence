---
phase: 3
plan: 1
requirements: ["#41", "#46", "#47", "#48"]
files: ["cadence-core/bin/lib/planning-files.mjs", "cadence-core/bin/planning.mjs", "cadence-core/bin/planning.test.mjs", "cadence-core/templates/UAT.md", "cadence-core/workflows/verify-deep.md", "cadence-core/bin/weight-budgets.json", ".planning/REQUIREMENTS.md"]
---

# Phase 3: planning-files parser robustness - Plan

## Goal

The shared `.planning` parsers stop minting phantom requirement rows (no false
`/cad-audit` FAIL), stop silently truncating multi-word recall queries, index
completed captures cleanly, and read block-YAML lists and name-less phase
headings.

## Must be true when done

- `planning.mjs audit` on a REQUIREMENTS.md whose Traceability table uses
  colon-aligned separators (`|:---|:--:|---:|`) returns the same `counts` as the
  byte-equivalent plain-dash table and reports no requirement whose id is made of
  dashes and colons; with a table-bearing `## ` section appended after
  `## Traceability`, none of that section's rows appear in any requirement count.
- `planning.mjs uat refresh` with an empty payload on a UAT.md carrying a
  hand-added `### Manual notes` section containing a `1. check the logs` line
  reports `total: 2` (the real items only), and after a following `uat record`
  the file carries exactly one `### 1. ` heading (no duplicate `k`) and that
  section still present, its content unchanged and occurring exactly once. State
  the truth against these observables, NOT against `uat status`: a phantom item
  carries no `status:` field, so `counts` is byte-identical pre- and post-fix
  (`planning-files.mjs:280` counts only `it.status in counts`) and cannot
  witness the fix. Preservation is content-exact and idempotent, not raw-byte
  round-trip - trailing whitespace inside a preserved section normalizes on the
  first rewrite, deliberately, because that trim is what makes repeated
  parse/render cycles stable.
- `uat merge` fed a gap with neither `k` nor `name`, a `human_checks` entry with
  no name, a gap whose `k` matches no existing item, and one valid gap exits
  `ok:true`, appends only the valid gap, writes no item named `undefined`, and
  reports a nonzero `rejected`; fed a pass or gap for an item already recorded
  non-pending it leaves that result unchanged and reports a nonzero `skipped`.
- `planning.mjs recall decimal phases` (two bare words, unquoted) returns
  byte-identical output to `recall "decimal phases"`, and a `- [x] (phase 3) ...`
  CAPTURE.md line appears in results with `phase: 3`, no `[x]` in the snippet,
  and a marker showing it is closed.
- `audit` on a phase whose PLAN.md frontmatter declares `requirements:` as a
  block YAML list reports that plan's requirement ids rather than zero, and
  `plan-overlap` reads its block-form `files:` list; a `requirements:` line in
  the plan body outside the `---` fence contributes no ids.
- `renumber remove` on a roadmap whose phase detail heading is exactly
  `### Phase N:` (colon, no trailing name) removes that section from the document.
- Each of #41, #46, #47, #48 has at least one test that fails on the pre-fix code
  and passes after it, and all three CI gates pass:
  `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.

## Context

Locked decisions bind this plan: D-01 (separator skip WIDENS to a dash/colon/
space blacklist, never an id whitelist), D-02 (UAT item head anchors to the
first line of each `### ` chunk AND unrecognized `### ` sections round-trip
verbatim), D-03/D-10 (merge is partial-success: skip an unusable entry, merge the
rest, report a rejected count; the guard is "every appended item resolves to a
usable name", covering `human_checks` and an unmatched `k`), D-04/D-05 (strip any
checkbox state THEN extract `(phase N)`; a closed capture keeps a closed marker
in the snippet string - no new result field), D-06/D-07 (ONE shared list reader
bounded to the leading `---` frontmatter block, minimal grammar: key line, then
contiguous `- item` lines, trailing ` # comment` stripped), D-08 (name-less
heading tolerance is scoped to `cutPhaseDetail` only), D-09 (bound `##
Traceability` at the next `## ` and retire REQUIREMENTS.md's now-false
"last in the file" note), D-11 (skips surface as additive scalar counts on the
merge envelope), D-13 (the verify-deep.md line + its zero-headroom budget entry
ride along), D-14 (NO `warnings[]` channel on planning.mjs), D-15 (all
regression tests are seam-level, in `planning.test.mjs`, driving `audit`/`uat`/
`recall`/`plan-overlap`/`renumber`, with raw-file fixtures written after
`makeTree` for shapes the builder cannot express). Out of scope: relaxing
`PHASE_LINE`/`setPhaseBox`/the `renumber remove` list-line filter, any general
YAML subset, any new field on the recall result, a new `planning-files.test.mjs`,
and phase 4's issues (#37, #49, #50).

Every new test must be verified failing-capable against the pre-fix code (stash
or revert the source hunk, run the test, see it fail) - not merely passing. A
prior cycle shipped `JSON.stringify(r).includes('NaN') === false`, which passes
unpatched (`.planning/CAPTURE.md`, phase 2; `.planning/phases/2/SUMMARY.md`).

## Tasks

### Task 1: Bound and de-phantom the Traceability parse (#41)

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs, .planning/REQUIREMENTS.md
- **Action:** In `parseRequirements` (planning-files.mjs:82-95) make two edits.
  (a) Bound the section: after `const section = text.split(/^## Traceability\s*$/m)[1]`,
  derive `const body = section.split(/^## /m)[0]` and iterate `body.split('\n')`
  instead of `section.split('\n')` - the same idiom `parseRoadmapPhases`
  (:61-63) and `sectionBody` (:161-165) already use, and the extent
  `setReqStatus` (:134-137) already writes with, so reader and writer stop
  disagreeing (D-09). (b) Widen the separator skip: replace `/^-+$/.test(id)`
  with `/^[-:\s]+$/.test(id)` so a GFM alignment cell (`:---`, `:--:`, `---:`)
  is skipped. Keep the blacklist form deliberately - do NOT substitute a
  positive id whitelist like `/^[A-Z]{2,}-\d+|#\d+/`, which would drop this
  project's own live ids (`TRI-01 (collect every open bug issue...)`, `#41`) and
  make a populated table audit as `total: 0` (D-01); leave the `!id` and
  `id === 'Requirement'` skips as they are. Update the function's doc comment to
  say the section is bounded at the next `## ` heading and that the separator
  skip is a widened blacklist so a genuinely malformed id still reaches audit as
  a `no-phase` break. Then in `.planning/REQUIREMENTS.md` (:72-73) retire the now
  false sentence "This section must remain the last in the file - the audit seam
  parses every row beneath it.", replacing it with a statement that the audit
  seam reads the rows of this section only, bounded at the next `## ` heading;
  leave the surrounding paragraph and the table intact. Add two tests to
  `planning.test.mjs` under the audit block, each writing REQUIREMENTS.md raw
  after `makeTree` (the builder hardcodes `|---|---|---|`): (1) colon-aligned -
  build a tree with the phase-1 plan/reqs shape, then overwrite REQUIREMENTS.md
  with byte-equivalent rows under a `|:---|:--:|---:|` separator, and assert
  `audit`'s `counts` deep-equal the plain-dash tree's `counts` and that no
  `r.requirements[].id` matches `/^[-:\s]+$/`; (2) unbounded section - append a
  `## Appendix` heading after the table carrying its own table row
  (`| GHOST-1 | Phase 1 | Complete |`) and assert no requirement has id
  `GHOST-1` and `counts.total` equals the un-appended tree's.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; both new
  tests fail before the parser edit (pre-fix the colon run reports one extra
  `no-phase` requirement named `:---`, and the appendix run reports `GHOST-1`).

### Task 2: Anchor the UAT item head and round-trip hand-added sections (#46.1)

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs, cadence-core/templates/UAT.md
- **Action:** In `parseUat` (planning-files.mjs:265-282) replace the `/m`-flagged
  head match with a first-line anchor: for each `### ` chunk take
  `const first = part.split('\n', 1)[0]` and match
  `/^(\d+)\.\s+(.+?)\s*$/` against it, so a numbered line deeper in the chunk can
  never mint an item. When the first line does not match, treat the chunk as a
  hand-added section and preserve it: take its lines up to (not including) the
  first line matching `/^## /` - the same bound the field loop already uses - and
  push `'### ' + those lines joined, with trailing whitespace trimmed` onto a new
  `extras` array. Return `extras` (always an array, `[]` when none) alongside
  `status`, `phase`, `fm`, `items`, `counts`. In `renderUat` widen the parameter
  to `{fm, items, extras = []}` (update its JSDoc so `extras` is optional and
  `cmdUat`'s init literal still type-checks) and emit each extra verbatim between
  the item blocks and `## Summary` as `\n${extra}\n` per entry, appended after
  `blocks.join('\n')` - byte-stable and idempotent across repeated
  parse/render cycles. Do NOT flatten, renumber or reformat an extra's contents,
  and do NOT add a warning channel for them (D-14). Note in both doc comments
  that UAT.md is now partly user-owned: hand-added `### ` sections survive a
  rewrite, items stay machine-owned (D-02). Add a matching one-line rule to
  `cadence-core/templates/UAT.md`'s `## Rules` list stating that a hand-added
  `### ` section that is not a numbered item (e.g. `### Manual notes`) is
  preserved verbatim across seam rewrites, while items remain append-only.
  Add a test to `planning.test.mjs`'s uat block: from `uatTree()`, rewrite UAT.md
  raw to insert `### Manual notes\n\n1. check the logs\n` before `## Summary`;
  assert `uat refresh` with a `[]` payload reports `total === 2` (the item count -
  pre-fix 3); then `uat record --phase 1 --item 2 --result pass` and assert the
  file still contains the exact substring `### Manual notes\n\n1. check the logs`
  exactly once (count the occurrences - a per-cycle re-emission bug duplicates
  the section while still satisfying a bare `includes`), contains exactly one
  `### 1. ` heading (pre-fix the phantom is a second `k: 1`, so this is the
  duplicate-`k` assertion), contains no `### <n>. check the logs` item heading,
  and its Summary reads `total: 2`; run a second `uat record` and assert the
  section text is unchanged again (round-trip idempotence). Do NOT assert on
  `uat status` counts here: that assertion passes unpatched (see the second
  done-truth) and would read as green on pre-fix code during the mandated
  failing-capable check.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; the new
  test fails pre-fix on all three counts (`total: 3` in the refresh result and
  the Summary, the notes section deleted, a materialized `check the logs` item).

### Task 3: Make uat merge partial-success with rejected/skipped counts (#46.2, #46.3)

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cmdUat`'s `merge` branch (planning.mjs:359-404) add
  `let skipped = 0, rejected = 0;` and a local
  `const usableName = (e) => (typeof e.name === 'string' && e.name.trim() ? e.name.trim() : null);`
  - the guard is on the shape the consumer accepts (a name that renders a
  heading), not on the reported input (D-10; phase 2's `--total -2` lesson,
  `.planning/phases/2/UAT.md`). Passes loop: keep the pending fill as-is, add
  `else if (it) skipped++;` (a finding conflicting with an already-recorded
  result - the invariant stands, the drop stops being silent) and `else
  rejected++;` (a pass matching no item can never be applied). Gaps loop: keep
  the matched-pending branch; add `else if (it) skipped++;` for a matched
  non-pending item; in the unmatched branch append ONLY when
  `usableName(g)` returns a string, using it as `name` (keep
  `expected: g.expected || g.reason || ''` and the rest of the pushed shape
  unchanged - do not synthesize a name from `reason`), otherwise `rejected++`
  and append nothing, so `### N. undefined` can no longer be written. Today
  `gaps++` and `added++` fire together in that branch (:393): keep BOTH inside
  the append arm and increment NEITHER on the reject arm - `gaps` counts gaps
  actually recorded in the file, so a rejected entry that wrote nothing must not
  inflate it (otherwise the envelope, and verify-deep's summary line from Task 4,
  reports three gaps found for one item written). Human
  checks: append only when the entry has no match AND `usableName(h)` returns a
  string; a nameless entry is `rejected++` (`human_checks` appends the identical
  phantom at status `pending`, which blocks completion just as permanently -
  D-10). Merge the rest regardless; never reject the whole payload the way
  `init`/`refresh` do (D-03 - verify-deep is an accelerator, never a gate).
  Extend the result to
  `ok({ auto_passed: auto, gaps, added, skipped, rejected, next: ... })`, both
  new keys always present even at zero, matching the envelope's existing
  convention; do not add a per-item `conflicts` array (D-11). Add two tests to
  `planning.test.mjs`: (1) from `uatTree()`, merge a payload carrying
  `gaps: [{reason:'no k, no name'}, {k:99, reason:'k matches nothing'},
  {name:'Rate limiting', reason:'no limiter'}]` and
  `human_checks: [{expected:'nameless'}]`; assert `ok:true`, `added === 1`,
  `rejected === 3`, `gaps === 1` (only the appended gap was recorded), the file
  contains `### 3. Rate limiting`, and
  `assert.doesNotMatch(text, /undefined/)`. (2) record item 1 `pass` as the user,
  then merge `{passes:[{k:1,evidence:'x'}], gaps:[{k:1,reason:'y'}]}`; assert
  `ok:true`, `skipped === 2`, `auto_passed === 0`, `gaps === 0`, and the file
  still shows item 1 `status: pass` with no `reported:` line. Also extend the
  existing `uat merge: fills pending only, appends unmatched gaps and human
  checks` test (:669-686) to assert `skipped === 1` (its `Logout works` pass
  targets a user-recorded item) and `rejected === 0`, rather than adding a
  parallel test (phase-1 D-05: rewrite, do not supplement).
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; both new
  tests fail pre-fix, on this measured baseline (run live against the current
  tree, not assumed): test 1 unpatched returns
  `{auto_passed:0, gaps:2, added:2}` and writes ONE `### 3. undefined` plus
  `### 4. Rate limiting` - not three phantoms, because `find`'s
  `i.name === ref.name` (:366-367) is `undefined === undefined` against the
  phantom the first nameless gap just appended, so the `k:99` gap and the
  nameless `human_check` both "match" it and are dropped. The pre-fix failures
  are therefore `rejected`/`gaps` being `undefined`/`2` and the `/undefined/`
  assertion tripping on that one heading; test 2's `skipped` is `undefined`.
  (That collision is also why D-10's "`human_checks` appends the identical
  phantom" rationale does not literally reproduce in a payload where a nameless
  gap precedes it - the fix is right either way, since post-fix no phantom is
  minted for anything to collide with.)

### Task 4: Carry the merge counts into verify-deep.md and its budget (D-13)

- **Files:** cadence-core/workflows/verify-deep.md, cadence-core/bin/weight-budgets.json
- **Action:** In `verify-deep.md`, update the seam-rules paragraph (:34-38) so
  "conflicting verifier findings are dropped" becomes: a conflicting finding is
  skipped and counted, and an entry that resolves to no usable item name is
  rejected and counted rather than appended as a nameless item. Extend the
  closing line (:40) so the reported one-line summary names all five scalars:
  auto_passed, gaps, added, skipped, rejected. Keep the edit tight - this
  surface's budget has zero headroom. Then run `node cadence-core/bin/weight.mjs` and set
  `budgets["cadence-core/workflows/verify-deep.md"]` in
  `cadence-core/bin/weight-budgets.json` to the exact new `bytes` that run
  reports for that surface (today's 1955 equals the file's current size, and
  `self-verify.mjs:274-278` fails `budget-overrun` on any excess, so omitting the
  bump breaks CI). Change no other budget entry.
- **Verify:** content first, because the CI gates alone cannot witness this task:
  on the unedited tree `self-verify.mjs` already reports `ok:true` with no
  `budget-overrun` and `weight.mjs` already reports `bytes: 1955` equal to the
  standing budget, so a doc edit that never happened passes both. Assert instead
  that `verify-deep.md` no longer contains the string
  `conflicting verifier findings are dropped`, that it contains both `skipped`
  and `rejected`, and that its closing summary line names all five scalars
  (`grep -E 'auto_passed.*gaps.*added.*skipped.*rejected'` matches :40). THEN
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` problem for `cadence-core/workflows/verify-deep.md`, and
  `node cadence-core/bin/weight.mjs` reports that surface's `bytes` equal to the
  new budget value.

### Task 5: Index completed captures with their phase and a closed marker (#47.1)

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `parseCaptureSnippets` (planning-files.mjs:196-214) replace
  `raw = raw.replace(/^\[ \]\s*/, '')` with a checkbox match that captures the
  state - `const box = raw.match(/^\[([ xX])\]\s*/)`, and when it matches slice
  it off and remember `const closed = box[1] !== ' '` - THEN run the existing
  `(phase N)` extraction, which now reaches the start of the line for a checked
  item (D-04: closed captures stay in the corpus; do not skip or de-weight
  them - three of the seven snippets recalled for this phase were `[x]` items and
  all three were load-bearing). When `closed`, emit the text prefixed with the
  literal marker `[closed] ` so a planner cannot read a shipped fix as live prior
  evidence; the result shape does NOT grow a `done`/`closed` field (D-05). Update
  the doc comment to state the checkbox states handled, the marker, and why the
  signal rides the string. Add a test to `planning.test.mjs`'s recall block:
  `makeTree` a corpus, then write `.planning/CAPTURE.md` raw with a `## Todos`
  section containing `- [x] (phase 3) tokenkiller carve-out closed by abc1234`
  and `- [ ] (phase 1) tokenkiller live item`; call `recall('tokenkiller', dir)`
  and assert the CAPTURE.md result for the checked line has `phase === 3`, its
  `snippet` does not include `[x]`, and its `snippet` starts with `[closed] `,
  while the unchecked line's snippet carries `phase === 1` and no marker.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; the new
  test fails pre-fix (unpatched, the checked line's result has no `phase` field
  and its snippet still begins `[x] (phase 3)`).

### Task 6: Join an unquoted multi-word recall query (#47.2)

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In the dispatch block (planning.mjs:741-762) widen the handler
  signature rather than special-casing recall (D-12): annotate `COMMANDS` with
  `/** @type {Record<string, (dir: string, sub: string, opts: any, rest: string[]) => void>} */`
  so the extra argument type-checks, call
  `handler(dir, sub, opts, words.slice(1))`, and change the `recall` entry to
  `(dir, _sub, opts, rest) => cmdRecall(dir, rest.join(' '), opts)`. Leave every
  other entry's 3-parameter implementation as it is. `cmdRecall` keeps its
  `(dir, query, opts)` signature and its `if (!query) return fail('bad-args', ...)`
  guard, which still fires because `[].join(' ')` is `''`; `tokenize`
  (lib/bm25.mjs:24-29) splits on non-alphanumerics, so the space separator is
  immaterial. Do NOT reject extra positional words as `bad-args` - that turns a
  today-degraded interactive call into a hard failure while every workflow caller
  already quotes (D-12). Update the usage comment at the top of the file (:24-25)
  to note that bare words after `recall` are joined into one query. In
  `planning.test.mjs`, widen the `recall(query, dir)` runner (:1023-1033) to
  accept an array as well as a string - `const qargs = Array.isArray(query) ?
  query : [query]`, spread into the argv - keeping the pinned
  `CADENCE_GLOBAL_CONFIG` env and the raw-stdout return untouched. Add a test
  whose corpus separates the two words: phase 1 SUMMARY deviation
  `decimal cursor carve-out`, phase 2 SUMMARY deviation
  `renumber phases desync report`; assert `recall(['decimal','phases'], dir)`
  returns results from BOTH SUMMARY sources and that its `raw` stdout is
  byte-identical to `recall('decimal phases', dir).raw`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; the new
  test fails pre-fix (unpatched, the unquoted run searches only `decimal`, misses
  `phases/2/SUMMARY.md`, and its raw output differs from the quoted run's).

### Task 7: Read block-YAML requirements/files through one bounded reader (#48.1)

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add ONE module-local helper in the PLAN.md section of
  planning-files.mjs - `readFrontmatterList(text, key)` - serving both
  `parsePlanRequirements` and `parsePlanFiles` (D-07: two copies of the same
  inline-only pattern today would drift, and the audit would then accept a plan
  shape the parallel-safety overlap check rejects). Its grammar, deliberately
  minimal: match the leading frontmatter block only, `/^---\n([\s\S]*?)\n---/`
  anchored at the start of the text; within those lines find the first
  `^<key>:\s*(.*)$`; if the remainder trimmed starts with `[`, parse the inline
  form via `\[(.*)\]` split on commas; otherwise, if the remainder with a
  trailing ` #...` comment stripped (the same whitespace-preceded `/\s+#.*$/`
  rule as the item values below, applied to the remainder - NOT a bare `#`
  strip, which would reduce a hand-written `requirements: #41` to empty and
  hand the following lines to the block reader) trims to empty, read the
  contiguous following lines matching `/^\s*-\s+(.+?)\s*$/`, stopping at the
  first line that does not, and take each item's value with a trailing
  ` # comment` removed. The third case is explicit, not left to the executor: a
  remainder that is non-empty and does NOT start with `[` is a scalar value -
  return it as a single-element list after the same quote-strip and trim, and do
  NOT fall through to the block reader (falling through would discard the value
  AND swallow whatever `- ` lines follow, the exact over-read D-06 bounds
  against; returning `[]` instead would re-file the silent under-read #48.1
  exists to close, and D-14 leaves nothing to say so). Strip `"`/`'`
  and trim every value, drop empties, and return a plain `string[]`; no nesting,
  no flow-in-block, no comment-only lines. Strip the comment ONLY on
  whitespace-preceded `#` (`/\s+#.*$/`) applied to the item value - this repo's
  own requirement ids are `#41`-shaped and must survive - and never comment-strip
  the inline `[...]` payload, where the template writes
  `requirements: []     # phase requirement IDs...`. Bounding the key lookup to
  the frontmatter is load-bearing (D-06): an unbounded scan plus a permissive
  block reader would let a prose `requirements:` line in the plan body swallow
  the following bullets as ids, surfacing as fabricated `orphans.plan_ids` in
  `/cad-audit` - an over-read traded for the filed under-read. Rewrite
  `parsePlanRequirements` to `return readFrontmatterList(text, 'requirements')`
  and, in `parsePlanFiles`, replace the `^files:\s*\[(.*)\]` match with
  `for (const f of readFrontmatterList(text, 'files')) add(f)`, leaving the
  whole-body `- **Files:**` task-line union and `add`'s backtick/parenthetical/
  `{`-placeholder handling exactly as they are. Add three tests to
  `planning.test.mjs`: (1) `makeTree` a one-phase tree, overwrite its PLAN.md raw
  with frontmatter declaring `requirements:` as a block list of `#41` and
  `#46  # with a comment`, plus a body line `requirements: these prose ids:`
  followed by `- NOT-AN-ID`, and REQUIREMENTS.md rows for `#41`/`#46`; assert
  `audit` maps both ids to `phases/1/PLAN.md` with no `no-plan` break and that
  `orphans` is undefined (the body list contributed nothing); (2) same tree, both
  ids still read when the frontmatter uses the inline `[...]` form with a
  trailing `# comment` (no regression); (3) a two-plan phase whose PLAN-1.md and
  PLAN-2.md declare block-form `files:` lists sharing `src/shared.rs`; assert
  `plan-overlap --phase 1` reports that overlap and no `undeclared`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; tests 1
  and 3 fail pre-fix (unpatched, the block form reads as zero: `#41`/`#46` break
  `no-plan` and both plans come back `undeclared` with `overlaps: []`).

### Task 8: Cut a name-less phase detail heading (#48.2)

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cutPhaseDetail` (planning-files.mjs:407-417) change the heading
  regex from `^### Phase ${escN(n)}: .*$` to `^### Phase ${escN(n)}:(?: .*)?$`
  so an exactly-`### Phase N:` heading matches while `### Phase 21:` still cannot
  match `n = 2` (the colon stays immediately after the escaped number, and
  `escN` keeps the decimal dot literal). Leave the section-end search and the
  no-match early return untouched. Add a comment stating the tolerance is scoped
  to this function ONLY: `PHASE_LINE` (:52), `setPhaseBox` (:114) and the
  `renumber remove` list-line filter (planning.mjs:640-641) keep requiring a
  name, because unifying them would change what counts as a phase for `status`,
  `audit`, `phase-done` and the cursor's `total` - a state-machine change, not a
  parser fix (D-08). Add a test to `planning.test.mjs`'s renumber block: write a
  ROADMAP.md raw with two named list lines (`- [ ] **Phase 1: One** - a`,
  `- [ ] **Phase 2: Two** - b`) and detail sections `### Phase 1: One` with a
  goal line and a bare `### Phase 2:` with its own goal line (`**Goal:** g2`);
  run `renumber remove --n 2` and assert `ok:true`, `total === 1`, the roadmap no
  longer contains `### Phase 2` or `**Goal:** g2`, and `### Phase 1: One`
  survives intact.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; the new
  test fails pre-fix (unpatched, the bare heading and its `**Goal:** g2` body
  stay in the document after the remove). Then run all three CI gates:
  `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.

## Notes

- Plan structure honors the CONTEXT `Plan shape: one plan` directive, and the
  independence test agrees: seven of the eight tasks touch
  `cadence-core/bin/planning.test.mjs` and five touch
  `cadence-core/bin/lib/planning-files.mjs`, so no split into
  independently-executable slices exists.
- Planner discretion recorded (areas CONTEXT left open):
  - D-05 names a "closed MARKER" without spelling it. Chosen: the literal
    `[closed] ` prefix on the snippet text. It satisfies the acceptance criterion
    (a marker, no `[x]` in the snippet) and costs no schema change. Side effect
    to accept: `tokenize` adds one `closed` term per closed capture doc, a
    negligible ranking shift on a corpus of dozens of snippets.
  - D-02 does not fix where a preserved `### ` section is re-rendered. Chosen:
    verbatim, after the item blocks and before `## Summary`, one blank line
    apart - deterministic and idempotent across repeated parse/render cycles.
  - D-10/D-11 do not name a bucket for a `passes` entry matching no item at all.
    Chosen: `rejected` (it resolves to no usable item and can never be applied),
    consistent with the appended-item guard and adding no field.
  - The CONTEXT flagged assumption about a `templates/UAT.md` line is taken as
    in-scope (Task 2): one line, and templates are not weight-budgeted surfaces,
    so it costs nothing and stops the template's machine-owned framing from
    contradicting the fix it now supports.
- Carried assumption from CONTEXT: D-07's block grammar is settled only for the
  forms the shipped template and a plausible hand-edit produce (contiguous
  `- item`, trailing ` #` comment, and now a bare scalar). An unanticipated
  spelling (a nested or flow-in-block mapping, a `>`/`|` literal block) still
  reads as zero or as one junk scalar, and D-14 means nothing says so. The repo
  is zero-dep with no YAML parser, so the tolerance boundary cannot be derived
  from the codebase.
- Known limit, unchanged by Task 2 and outside D-02: preservation covers
  hand-added `### ` sections only. A `## `-level section a user adds after the
  items is not preserved and never was - the field loop and the extras bound
  both stop at `/^## /` (`planning-files.mjs:273`), and `renderUat` rebuilds the
  document as frontmatter + `## Items` + `## Summary`. Widening to `## ` would
  change which parts of UAT.md are user-owned, a D-02 decision, not a parser
  fix.
- Adjudicated `plan` review round (3 reviewers: `cad-reviewer`, openai
  `gpt-5.3-codex`, deepseek `deepseek-v4-pro`; gate `adjudicated`). Six findings
  survived grounding and are folded in above: the vacuous `uat status`
  assertion and the unwitnessable done-truth in Task 2 (a phantom item has no
  `status:`, so `counts` is identical either way), the missing duplicate-`k` and
  occurs-once assertions, Task 3's `gaps` counter left to executor choice,
  Task 3's measured pre-fix baseline (one phantom, not three), Task 4's Verify
  passing on an unedited tree (raised independently by two reviewers), and
  Task 7's unspecified third grammar case. Two were killed on the code:
  `usableName` needing a format guard (`renderUat`'s `flat()` already flattens
  embedded newlines at the write face, `planning-files.mjs:295`) and a `## `
  heading inside a preserved section truncating it (out of D-02 scope; recorded
  above instead).
- Not this phase, flagged for `/cad-verify`: the v1.3.1 `## Traceability` table
  in `.planning/REQUIREMENTS.md` is still empty, so `audit` will report this
  plan's `#41`/`#46`/`#47`/`#48` as `orphans.plan_ids` until the rows are
  seeded - the same seeding step that did not fire in the v1.2.0 close
  (`.planning/CAPTURE.md`, v1.2.0 milestone-close note). Task 1 edits only the
  stale prose note in that file, never the rows.
