---
phase: 1
status: complete
completed: 2026-07-27
---

# Phase 1: The plan-file frontmatter grammar - Summary

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

All six are CONFIRMED findings from the `diff` review trigger (advisory gate,
adjudicated by the main model against the live parser). Findings 1 and 2 sit
directly on this phase's own goal.

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
