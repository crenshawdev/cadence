---
phase: 2
status: complete
completed: 2026-08-22
---

# Phase 2: The collision plan-overlap was built to catch - Summary

`plan-overlap` now reports a markdown-decorated `files:` path instead of
comparing it clean, and the four value-level grammar codes are scoped to the
two list keys, so a defect in one scalar stops surfacing on an unrelated list
read.

## What shipped

- `markdown-decorated-path`, a new grammar code raised in `parsePlanFiles`'
  frontmatter loop for the bold, link and matched-interior-backtick shapes -
  `cadence-core/bin/lib/planning-files.mjs`. The declaration keeps its bytes in
  the returned `files` list; the code reports, it never repairs.
- `scopeToListKeys` at the four value-level push sites in `parseFrontmatter`,
  gating `trailing-value-content`, `backtick-wrapped-value` and their siblings
  to `files:` and `requirements:` - `cadence-core/bin/lib/planning-files.mjs`.
  No field added to `Issue`, nothing filtered in `readFrontmatterList`, so all
  five readers keep their envelope shape.
- `item-without-key` raised on `parseFrontmatter`'s early-continue path when no
  block key is open, closing a line that went fully silent once the gate landed
  (see Deviations) - `cadence-core/bin/lib/planning-files.mjs`.
- The `frontmatter_issues` envelope proven end to end at the `plan-overlap`
  seam - `cadence-core/bin/planning.test.mjs`.
- A code-set guard: a grammar code literal added to `planning-files.mjs`'
  frontmatter region without its row in the reference table reddens
  `cadence-core/bin/prose-agreement.test.mjs`.
- The `markdown-decorated-path` reference row plus its `weight-budgets.json`
  re-pin (17312 -> 18700 -> 20460) -
  `cadence-core/references/plan-frontmatter.md`.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 9ca79259 | Report markdown decoration on a declared `files:` path, keeping its bytes |
| 1 | 2 | 43c97fd8 | Prove the decoration collision reaches the `plan-overlap` envelope |
| 1 | 3 | c103017d | Scope the value-level grammar codes to the two list keys |
| 1 | 4 | d92ca270 | Redden when a grammar code never reaches the reference table |
| - | - | 25b8cdad | Orchestrator: unhostage the live-corpus prune test (out of plan 1's lease, user-approved) |

## Deviations

- [deviation] Task 3's Action asserted that a block item whose value-level codes
  are scoped away still raises `item-without-key` when no block key is open. It
  did not: the item arm returned early on a `scanValue` failure, BEFORE the
  no-block-key diagnosis, so `goal: something` followed by `- "unbalanced`
  reported `unterminated-quote` before the gate and NOTHING after it - a
  frontmatter line gone fully silent, the one outcome D-02 exists to prevent.
  Fixed inside task 3 (c103017d) by raising `item-without-key` on that path, and
  pinned by a new grammar row. A behaviour change beyond the gate itself, in the
  loud direction.
- [deviation] CONTEXT's flagged assumption and the plan's Notes both state
  `detect-commands --root .` returns `lint:null, typecheck:null`. It returns
  `typecheck: "npx tsc -p tsconfig.ci.json"`. The executor ran that typecheck
  before every commit: exit 0, no diagnostics, each time. Lint is genuinely
  null.
- [deviation] AC7's second half - `node cadence-core/bin/test.mjs` reports 0
  failures - could not be met from plan 1's `files:` lease, because a
  pre-existing failure in `milestone-prune.test.mjs` blocked it. Resolved by the
  orchestrator in 25b8cdad after the user chose the vehicle; see below.

## Open items

- Declined a shared decoration helper in `lib/lease-grammar.mjs` beside
  `isRefusedSpelling`: D-03 places the rule in `parsePlanFiles` and D-06
  confines it to one arm, so `isDecoratedPath` is a local closure with exactly
  one caller. Promote it if a second arm or a second reader ever needs the same
  test.
- Declined a `markdown-decorated-path` row in the `parsePlanFiles`-level seam
  tests for the link and interior-pair shapes: the bold shape carries the seam
  test and `planning-files.test.mjs` carries all three at parser level. Add the
  other two at seam level if a shape ever diverges between parser and envelope.
- `plan-overlap` still reports `overlaps: []` for two plans declaring the same
  file when one declaration is decorated - the strings genuinely compare
  unequal. `frontmatter_issues` is what routes the phase sequential, which is
  what D-04 chose (report, never repair). Worth a look if a future caller wants
  the intersection itself rather than a refusal to trust it.

## Goal check

The phase goal was that `plan-overlap` can prove file-list independence before a
parallel dispatch, which it could not while the frontmatter reader attributed
issues to the wrong key and accepted decorated paths as clean. All four of the
plan's tasks landed and all seven acceptance criteria were re-verified directly
against the built code rather than taken from the executor's report. On the
wrong-key defect: `readFrontmatterList(doc, 'files')` over a document whose
`goal:` is backtick-wrapped with trailing content now returns `issues: []`,
while the identical value under `files:` still returns
`['backtick-wrapped-value']`, and an `unknown-line` inside the `requirements:`
block still reaches a `files:` read - so the gate is scoped to value-level codes
and the structural five still cross keys, which is D-01 and D-02 exactly. On the
decorated-path defect: `parsePlanFiles` returns `markdown-decorated-path` for
`**src/a.rs**`, for `[src/a.rs](x)` and for the matched interior pair
``src/`a`.rs``, and returns nothing for `src/a.rs` or for the single interior
backtick ``src/a`.rs`` - and every flagged entry comes back in `files` with its
bytes unchanged. End to end, `plan-overlap --phase 9` over a bold `PLAN-1` and a
plain `PLAN-2` declaring the same file returns
`frontmatter_issues: [{plan: 'PLAN-1.md', issues: [{line: 5, code:
'markdown-decorated-path', ...}]}]`, which `execute.md`'s `choose_path` reads as
"sequential" - so the two plans are no longer cleared into separate worktrees.
The code-set guard bites: renaming the code literal without touching the
reference table fails `prose-agreement.test.mjs` naming the missing row. Nothing
in the goal looks missing. The one honest caveat is the third open item above -
`overlaps` itself is still empty in the decorated case, by design, so the
protection is the refusal to trust the comparison rather than a corrected
comparison.
