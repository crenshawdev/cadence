---
phase: 1
status: complete
completed: 2026-07-27
---

# Phase 1: The plan-file frontmatter grammar - Summary

This phase ran in TWO passes. Pass 1 (`7b58a80..766c307`, `PLAN.md`) shipped the
grammar spine and was UAT'd at 10 pass / 5 fail; pass 2 (`605947c..e0e9026`,
`PLAN-2.md`) closed those five failures and the open half of the goal. Sections
below are pass 1's record as written at the time, followed by
`## Second pass` - the pass-1 open items are all closed there and are kept
verbatim because `/cad-verify` and `recall` both read this file as the phase's
history.

## First pass

`readFrontmatterList` is now a thin selector over one stated grammar - a
`normalize` pass (BOM, CRLF/lone-CR, leading blank lines), a quote-state
value scanner, and a block reader with an explicit three-member terminator
set - and every line outside that grammar is recorded as a `frontmatter_issues`
entry on the `audit` and `plan-overlap` envelopes instead of silently changing
what was read.

## What shipped

- One-pass frontmatter parser (`parseFrontmatter`) with quote-state scanning
  (`scanValue`, `unwrap`, `parseInlineList`, `splitDepth0`) -
  `cadence-core/bin/lib/planning-files.mjs`
- `frontmatter_issues` wired end to end onto both the `audit` and
  `plan-overlap` envelopes, never touching `counts` or the PASS/FAIL verdict -
  `cadence-core/bin/planning.mjs`
- A parser-level grammar table (33 rows) plus a normalization table -
  `cadence-core/bin/planning-files.test.mjs` (new)
- The grammar written down in prose, with every diagnostic code -
  `cadence-core/references/plan-frontmatter.md` (new)
- Template and workflow prose moved with the grammar -
  `cadence-core/templates/PLAN.md`, `workflows/audit.md`, `workflows/execute.md`,
  `cadence-core/bin/weight-budgets.json`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | c1d5c03 | Restructure PLAN.md frontmatter into one normalized classifying pass; wire the diagnostic end to end |
| 1 | 2 | 4dc0ee0 | Quote-aware value scanner; closes the comment-on-key-line regression |
| 1 | 3 | 9433a2c | Block reader skips blank/comment/unknown lines instead of stopping |
| 1 | 4 | 057872f | Parser-level grammar table for the frontmatter reader |
| 1 | 5 | 766c307 | State the grammar in prose; move the weight budgets with it |
| 1 | 6 | (none) | CAPTURE item filed on disk; `.planning/CAPTURE.md` is gitignored by repo design (`79c93ea`), so this task structurally has no commit |

Range: `7b58a80..766c307`, 5 commits, 9 files, +846/-96.

## Deviations

- [deviation] Task 6's target `.planning/CAPTURE.md` is gitignored
  (`git check-ignore -v` -> `.gitignore:23:/.planning/CAPTURE.md`), so the task
  landed on disk with no commit. Expected, not a defect; recorded because the
  plan's task table implies one commit per task.
- [deviation] No code deviations: every task's verify command produced the
  predicted output on first attempt.

## Open items

**All six are CLOSED by the second pass** (see `## Second pass` below); kept
verbatim as the record of what pass 1 left open. All six are CONFIRMED findings
from the `diff` review trigger (advisory gate, adjudicated by the main model
against the live parser). Findings 1 and 2 sit directly on this phase's own
goal.

- **[high] A block item with no active `currentKey` is dropped silently** -
  no item, no `unknown-line` issue
  (`cadence-core/bin/lib/planning-files.mjs:650`, the `if (currentKey)` guard).
  The shipped template's own `files: []` line takes the inline arm, so
  `currentKey` is never set and every path a user adds beneath it vanishes.
  Verified: `files: []            # files this plan touches` followed by
  `  - src/shared.rs` / `  - src/a.rs` returns
  `{"items":[],"issues":[]}`. Two plans in that shape hand `plan-overlap` a
  false `overlaps: []` and the parallel gate dispatches both onto the same
  file - the exact failure the phase exists to close. An item line with no
  preceding key at all (`---\n- "#41"\n---`) is dropped the same way.
  Raised independently by all three reviewers.
- **[high] `unwrap` leaves the quotes on when text follows the closing quote,
  and `add()` then mints a fabricated value** (`planning-files.mjs:479`,
  `:708`). Verified: `- "src/shared.rs" (new)` yields the declared path as
  `"src/shared.rs"` (quotes retained) via `parsePlanFiles`, which never matches
  a sibling plan's `src/shared.rs`; `- "#41" stray` yields the id
  `"#41" stray`, so the declared `#41` is lost and a bogus id is minted. No
  diagnostic in either case. This is a regression from `7b58a80`, which
  stripped quotes globally. Raised by openai and cad-reviewer.
- **[medium] A commented-out key line does not terminate the active block**
  (`planning-files.mjs:640`). Verified: `requirements:` / `- "#41"` /
  `# files:` / `- src/shared.rs` returns
  `{"items":["#41","src/shared.rs"],"issues":[]}` for `requirements` - an
  over-read into one key and an under-read of the other, in one pass, with
  nothing on either envelope.
- **[medium] `KEY_LINE` requires whitespace or EOL after the colon, so
  `requirements:["#41"]` is classified `unknown-line` AND its data is dropped**
  (`planning-files.mjs:534`). Verified: issues carry
  `{"code":"unknown-line"}` and items are `[]`, so audit gains a `no-plan`
  break and `counts.broken` increments - which the plan's must-be-true bullet 5
  and `references/plan-frontmatter.md:115` both promise a diagnostic cannot do.
  The no-space form is defensible to reject on YAML grounds; the invariant's
  wording, or the classification, needs to move so the two stop contradicting.
- **[low] No escape handling in `scanValue`/`splitDepth0`/`parseInlineList`**
  (`planning-files.mjs:461`); the grammar reference states no escape rule.
  Verified: `files: ["a\"b.md", "c\"d.md"]` returns one fabricated path
  (`a\"b.md", "c\"d.md`) and loses both real ones, with `issues: []`.
- **[low] The 33-row grammar table lives inside one `test()` with a sequential
  loop** (`cadence-core/bin/planning-files.test.mjs:203`), so the file reports
  4 tests, not the ">= 20" Task 4's verify names, and the first failing row
  aborts every row below it.

## Goal check

The first half of the goal is delivered and evidenced. Every shipped form the
goal enumerates reads to exactly what is declared: the headline regression
(`requirements:   # TODO fill this in` above a block list) returns
`{"items":["#41","#46"],"issues":[]}`; the greedy `\[(.*)\]` is gone, replaced
by a depth-0 close-bracket scan, so `files: [a.md, b.md]   # [see notes]`
returns `["a.md","b.md"]` rather than swallowing the comment's bracket; the
CRLF and BOM-plus-leading-blank-line variants return results identical to
their plain-LF equivalent; and an unknown line mid-block is recorded and
skipped rather than truncating the list (`garbage here` between two items
yields both items plus one `unknown-line` issue). `node --test
cadence-core/bin/*.test.mjs` is 349/349, `npx tsc -p tsconfig.ci.json` exits 0,
and `node cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,
"problems":[]}`. The grammar is written down at
`cadence-core/references/plan-frontmatter.md`.

The second half - "reports anything outside the grammar instead of silently
over- or under-reading it" - is not fully delivered, and the gap is not
hypothetical. Four confirmed paths still read wrong with `issues: []`: a block
item under a key whose value took the inline arm (which is the shipped
template's own shape), a quoted item carrying trailing text, a commented-out
key line, and a backslash escape. The first is the more serious because it
reproduces the precise false-`overlaps: []` the phase was scoped to eliminate,
and the second is a regression from `7b58a80`. Nothing here undermines the
grammar's structure - it is the right spine and the terminator-set rewrite is
sound - but the "no silent read" property it exists to guarantee has holes on
its own goal surface. These are open items, not a fix loop; `/cad-verify 1`
should treat findings 1 and 2 as the first things to falsify.

---

# Second pass

The five shapes that still read wrong with `issues: []` each became a named
diagnostic, and a path declared in `files:` frontmatter now reaches
`plan-overlap` byte-exact as the plan wrote it.

## What shipped

- `resolveValue(raw)` replaces `unwrap` as the single value-resolution path,
  wired at all three call sites (inline element, key-line scalar, block item):
  a quoted value ends at its next matching quote, an unquoted value at its
  first whitespace, trailing content is diagnosed and the payload stands -
  `cadence-core/bin/lib/planning-files.mjs`
- Four new diagnostic codes - `trailing-value-content`, `residual-quote`,
  `item-without-key`, `commented-key-line`, `malformed-key-line` (five) - each
  named for the repair it asks for, same file
- `parsePlanFiles` takes `add()` off the frontmatter arm (D-19) and bridges the
  cross-arm gap that opens, by having the task-line arm contribute both its
  normalized and its raw form
- The shipped `templates/PLAN.md` moves `requirements:` / `files:` to bare
  block keys, pinned by a test that reads the template off disk
- A per-code Payload table stating for every code whether it drops what it
  read, proved at the audit seam rather than by reading prose -
  `cadence-core/references/plan-frontmatter.md`, `cadence-core/workflows/audit.md`,
  `cadence-core/bin/weight-budgets.json`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 2 | 1 | 4abe064 | Resolve frontmatter values at their own boundary; diagnose residual quotes |
| 2 | 2 | 92e4f6e | Diagnose and drop an item with no open key; template writes bare block keys |
| 2 | 3 | dd5f8a8 | Name the two key-line near-misses: `commented-key-line`, `malformed-key-line` |
| 2 | 4 | 5a4b7a8 | Take `add()` off the frontmatter arm; bridge the cross-arm gap it opens |
| 2 | 5 | e0e9026 | State per code whether it drops its payload; prove it at the seam |

Range: `605947c..e0e9026`, 5 commits, 7 files, +591/-80.

## Deviations

- [deviation] Task 1's new `plan-overlap` seam test predicted the diagnostic's
  line number as 5; observed 6 (the fixture's own lines were miscounted). Test
  expectation corrected to match. Not a parser defect.
- [deviation] Task 5's per-code table test first seeded its one-id tree as
  `Pending` against an unchecked phase box, so the twin was already
  `not-verified` (`broken:1`) - indistinguishable from a dropped id's
  `no-plan` (also `broken:1`), which made every "dropping code" assertion fail.
  Reseeded `Complete` against a checked box so the twin is fully traced
  (`broken:0`) and a dropped id is strictly greater, as the plan's comparison
  rule requires. This is the D-15 distinction being enforced by the test rather
  than asserted in prose.

## Open items

- **[medium] A backtick-wrapped frontmatter path is read verbatim with no
  diagnostic** (`cadence-core/bin/lib/planning-files.mjs`, the frontmatter arm
  of `parsePlanFiles`). Verified live: `files:` / ``  - `src/shared.rs` ``
  returns ``{"files":["`src/shared.rs`"],"issues":[]}``, which never matches a
  sibling plan's `src/shared.rs` (whether that sibling declares it in
  frontmatter or on a task line), so `plan-overlap` returns `overlaps: []` with
  nothing on the envelope and the parallel gate would dispatch both onto one
  file. Taking the path byte-exact is CORRECT per D-19 - the defect is only
  that it is silent, which is a direct miss against the phase goal's "reports
  anything outside the grammar". It is also a regression against pre-`5a4b7a8`
  behavior, where `add()`'s backtick strip normalized it into a match. Not a
  shipped form: D-19 verified zero backtick-bearing paths across 21 commits of
  plan frontmatter. Suggested fix, consistent with the design: extend the
  residual test to fire on a backtick, so markdown formatting that leaked into
  data is reported rather than silently taken as a path - no reintroduction of
  the path rewriting D-19 removed. Raised by `cad-reviewer` on the `diff`
  trigger at `blocker`; downgraded to medium on adjudication for the reasons
  above.
- **[note] Acceptance criterion 6 shipped narrowed, deliberately.** The
  per-code Payload table lives in `references/plan-frontmatter.md` only;
  `workflows/audit.md` carries the general rule plus a pointer. AC6's literal
  wording asks both files to state per code. Reason recorded in `PLAN-2.md`
  Notes: `audit.md` is workflow prose loaded on every `/cad-audit` run at
  3002/3002 bytes, and duplicating the table across two surfaces recreates the
  prose-drift that pass 1's UAT-11 failure was. The criterion's substance - that
  stated behavior matches seam behavior - is proved by the per-code seam test in
  `e0e9026`. Flagged so `/cad-verify` prices the narrowing rather than reading
  AC6 as met.

## Goal check

The open half of the goal is delivered and evidenced. Every shape pass 1 left
reading silently now carries a named diagnostic, each confirmed against the
live parser: the shipped-template shape `files: []  # comment` followed by
`  - src/shared.rs` returns `{"items":["src/a.rs"],"issues":[{"code":
"item-without-key"...}]}` with the dropped path absent from the files list;
`- "src/shared.rs" (new)` and `- src/a.rs (new)` both resolve to clean paths
with `trailing-value-content`, and no returned value carries a quote it did not
declare; `requirements:["#41"]` reports `malformed-key-line` and a `# files:`
line inside an open block reports `commented-key-line`; and the escape case
that returned `issues: []` in pass 1 now reports - in BOTH its two-element form
(`trailing-value-content` + `residual-quote`) and its one-element form
`files: ["a\"]` (`residual-quote`), the latter being a hole the plan review
caught before execution. The residual test does not over-fire: the reference's
own prescribed `"src/it's-a-file.md"` spelling returns
`{"items":["src/it's-a-file.md"],"issues":[]}`. On the byte-exact half,
`files:` items `src/x(1)` and `` lib/a`b.mjs `` survive to `parsePlanFiles`
unrewritten while a `- **Files:** src/a.rs (edit)` task line still normalizes
to `src/a.rs`, and the cross-arm bridge is confirmed at the seam: a path in one
plan's frontmatter and the other's task line now reports
`overlaps: ["src/x(1)"]` where it would otherwise have been a silent miss. CI is
green independently of the executor's own run: `node --test
cadence-core/bin/*.test.mjs` is 411/411, `npx tsc -p tsconfig.ci.json` exits 0,
`node cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`
with the `audit.md` budget moved to 3037 in the same commit that grew it, and
`node cadence-core/bin/planning.mjs audit` on Cadence's own `.planning` emits no
`frontmatter_issues` key - so the two new key-line codes do not fire on any
shipped plan file.

What is not closed: the backtick-wrapped frontmatter path above, which is the
one remaining input that reads outside the grammar without saying so. It is
narrower than anything pass 1 left open - not a shipped form, and correct in
what it returns rather than wrong - but it sits on the same goal surface, so it
is named here rather than folded away. `/cad-verify 1` should falsify it first.
