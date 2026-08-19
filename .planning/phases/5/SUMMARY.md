---
phase: 5
status: complete
completed: 2026-08-19
---

# Phase 5: A README that asks for a decision - Summary

`README.md` went from 24,850 B to 14,287 B and now runs demand-then-Install
before any mechanism: the cost-to-run section and the worked example moved to
`docs/COST.md` and `docs/EXAMPLE.md`, the 21-bullet command list was cut to one
pointer, `docs/` joined self-verify's markdown walk, and all 86 `README-*`
ledger rows were re-pointed, retired or re-pinned against the post-change file.

## What shipped

- `docs/` on the self-verify markdown walk, with a regression test that asserts
  the reported `file` is the `docs/` path - `cadence-core/bin/self-verify.mjs`,
  `cadence-core/bin/self-verify.test.mjs`
- The cost-to-run section, re-wrapped at 80 columns in the sibling pages' shape
  and linked from the landing page - `docs/COST.md` (3,839 B)
- The worked example, same shape and same accuracy pass - `docs/EXAMPLE.md`
  (2,868 B)
- A landing page that asks one decision: `## What it asks of you` at line 7,
  `## Install` at line 15, then The loop, How it works, What a break costs,
  Where it came from - `README.md`
- `## The commands` cut, its three sharpest arguments folded into How it works
  as prose, and one line pointing at `/cad-help` and
  `cadence-core/references/COMMANDS.md` - `README.md:46`
- Re-measured published counts: Agents `19 rung files (6 roles)`, Skills
  `33 (27 user-invocable, 6 contract)` - `LINEAGE.md`
- The claim ledger re-derived against the post-change tree: 8 rows to
  `docs/EXAMPLE.md`, 8 to `docs/COST.md`, 9 RETIRED, 4 left at provenance, the
  rest re-pinned - `.planning/DOCS-CLAIMS.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 11c2040 | put `docs/` on self-verify's markdown walk |
| 1 | 2 | c081da1 | relocate the cost-to-run section to `docs/COST.md` |
| 1 | 3 | 7b1cd4f | relocate the worked example to `docs/EXAMPLE.md` |
| 1 | 4 | bd7ed83 | cut The commands, fold its three sharpest arguments into How it works |
| 1 | 5 | b3caf88 | state the demand above Install, in plain language |
| 1 | 6 | f9d9832 | order the staying sections and compress How it works |
| 1 | 7 | 3209243 | re-measure LINEAGE's Agents and Skills counts |
| 1 | 8 | 6d3fcf3 | re-point, retire and re-pin every README claim ledger row |

## Deviations

- [deviation] Task 2's Verify wanted `docs/COST.md`'s head to match both D-04's
  "bold one-line subtitle" and `docs/EVIDENCE.md:3`; those cannot both hold -
  `docs/EVIDENCE.md:3` is a plain paragraph. Built to D-04, which
  `docs/DISCOVERY.md:3` and `docs/WORKFLOW.md:3` both carry. D-04's line in
  `CONTEXT.md` is annotated with the correction. The Action also called the
  section three paragraphs; it was five, and all five moved. (c081da1)
- [deviation] Task 2's Action said to cut the whole "went from 8,550 bytes to
  5,397" clause; cutting it outright would have left the paragraph's own "all
  three moved" naming only two. D-10 scopes the cut to the FIGURE, so the clause
  survives numberless as "were cut to one routing line each" - true of the tree
  today (52 of 52 skill and agent `description:` values are single-line) and
  satisfying the Verify, since `5,397` and `8,550` are both absent. (c081da1)
- [deviation] Task 8's Action listed seven rows to retire; nine retired. Task
  6's authorized compression cut two more sentences a row cites - README-53 (the
  DeepSeek adapter) and README-55 (the four-knobs routing parenthetical) -
  neither on the plan's list and neither among task 6's four load-bearing
  claims, so they retire under D-07's own rule. Recorded in the ledger's
  narrative rather than left to the next sweep as vanished claims. (6d3fcf3)
- [deviation] Task 8 retired README-50 against D-07's literal list, as the plan
  itself flagged. Separately README-49, a `corrected - <sha>` row the ledger's
  own rule calls provenance rather than an address, re-points anyway: its
  section left `README.md` entirely, and a `doc` cell naming a file that carries
  nothing like the sentence is worse than losing the run-1 line. Its run-1
  provenance (`README.md:140`) is recorded in the narrative. README-01, -02,
  -25 and -28 stay at provenance. (6d3fcf3)
- [deviation] Task 8's Verify predicted 47 pin misses against the pre-change
  file; 44 observed at `276fbb7`. The criterion that matters is met exactly - 0
  misses across `README.md`, `docs/COST.md` and `docs/EXAMPLE.md` - and the
  baseline differs because the checker skips the four provenance rows and only
  tests rows carrying a backticked literal. (6d3fcf3)
- [deviation] Task 6's compression dropped three details ledger rows cite while
  leaving their sentences standing: README-05's "four-line" state cursor,
  README-11 and README-52's attribution of the 2,251 deleted lines to v2.2.0,
  and README-16's "multi-select prompt". Retiring those rows would have recorded
  a cut that never happened, so task 8 restored the three phrases and bought the
  bytes back in the same section: `## How it works` is 4,488 B (under task 6's
  4,500) and `README.md` is 14,287 B (under 15,000). (6d3fcf3)

## Open items

- `workflow.lint_command` is unset and `detect-commands` reports `lint: null`,
  so `npx tsc -p tsconfig.ci.json` was the only static-analysis command
  available and is what ran on every task.
- README-76 retired with half its claim still live: `README.md:46` states
  "`/cad-help` prints the full reference inside a session" in new words, while
  "`/cad-help <name>` shows one entry" went with `## The commands`. The next
  sweep should extract the surviving half as its own row.
- Pre-existing ledger contradiction, untouched here because task 8 changed no
  `verdict` cell: README-23 records `model.escalate_on_failure` as "on by
  default" with an `accurate` verdict while README-64 records "off by default"
  as accurate. The live default is off.
- No self-verify check enforces D-04's `docs/` page shape. Task 1's Verify asked
  only that the directory join the existing walk, and D-04 is a convention
  without a stated failure mode - and `docs/EVIDENCE.md` would fail such a check
  today.

All four are filed in `.planning/CAPTURE.md` against phase 5.

## Goal check

The eight commits plausibly deliver the goal. The size claim holds directly:
`wc -c README.md` reads 14,287 against the 24,850 the roadmap called a
reference manual, and `grep '^## ' README.md` returns exactly the six staying
sections in the decided order - `## What it asks of you` (line 7), `## Install`
(15), `## The loop` (26), `## How it works` (48), `## What a break costs` (64),
`## Where it came from` (86) - with `## The commands`, `## A worked example` and
`## What it costs to run` all absent. The relocation landed as two real files,
`docs/COST.md` (3,839 B) and `docs/EXAMPLE.md` (2,868 B), and the enforcement
half of the phase is what makes the move more than a move: `node
cadence-core/bin/self-verify.mjs` returns `ok:true` with an empty `problems`
array while now walking `docs/`, so `README.md`'s CI-drift claim covers the
relocated pages too. The accuracy pass is evidenced rather than asserted -
`grep -rc '5,397' README.md docs/` matches nothing, and `node
cadence-core/bin/test.mjs` passes 2380/2380 including `prose-agreement.test.mjs`'s
"27 skills and 6 agent roles across 19 rung files". Nothing in the plan's "must
be true when done" list is unmet. What is worth naming as thin rather than
missing: the ledger's own consistency is now the phase's weakest surface - nine
rows retired against seven planned, one row (README-49) re-pointed against the
ledger's provenance rule, and a pre-existing README-23/README-64 verdict
contradiction left standing, all of which are recorded in the ledger narrative
and the open items above but none of which a check enforces. The D-04 page-shape
convention is likewise unenforced, and `docs/EVIDENCE.md` already violates it.
