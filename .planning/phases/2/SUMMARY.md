---
phase: 2
status: complete
completed: 2026-08-12
---

# Phase 2: The front door - Summary

Cadence gained a second and a third entrance: `/cad-adopt`, which derives
`.planning/` inline from an existing repo's code and git history, and
`/cad-new-project --brief <file>`, which reads a design brief a freeform
conversation already produced and stops re-asking what it settles.

## What shipped

- `/cad-adopt` end to end - `skills/cad-adopt/SKILL.md` (923 B) and the new
  `cadence-core/workflows/adopt.md` (14,966 B), both budgeted at measured size.
  No `Task` grant, no route-table cell, no rung agent, no `BRACKETING` row: the
  brownfield read is paid in the coordinator's own context (D-01, D-03).
- The subdirectory refusal - `adopt.md`'s `setup` gates on
  `git rev-parse --show-toplevel` equalling the working directory, and names
  `--git-dir` on exactly one line, the one forbidding it. Git discovers a repo
  upward, so `/repo/subdir` would otherwise answer from `/repo`'s log and tags
  while writing `.planning/` into the subdirectory.
- Adopt's questioning rule - a `questioning` step whose suppression is stated
  prose judgment, with no score, threshold, rubric, percentage or per-item walk
  of the repo's own documents (D-06).
- Both doors named at the five absent-`.planning/` surfaces - `progress.md:40`,
  `skills/cad-health/SKILL.md:25`, `context.md:40`, `config.md:13` and
  `git-guard.md:42` (D-15).
- `/cad-adopt` registered - a row in `cadence-core/references/COMMANDS.md` under
  `## Build spine (the core loop)`, so `/cad-help` renders it, plus README's
  `## The loop` and `## The commands`.
- `--brief <file>` - parsed in `new-project.md`'s existing `setup` step beside
  `--research`, read whole with `Read`, no parser and no schema (D-07);
  suppression keys off what the brief SAYS, never off a marker convention (D-08).
- Verbatim's design brief as a committed fixture -
  `cadence-core/bin/fixtures/verbatim.design-brief.md` (527 lines, `cmp`-identical
  to the source at 29,447 B) with `cadence-core/bin/design-brief.test.mjs`
  asserting structural facts only, never the question set (D-09).
- `docs/DISCOVERY.md` - the freeform-conversation to design-brief to `--brief`
  sequence and what a good brief answers, linked from README's `## The loop`.
- 41 `DOCS-CLAIMS.md` line cites re-pinned to live text in the same commits that
  moved them (D-16): 19 `README-*` rows twice over, and all 22 `NEW-PROJECT-*`.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 22a2bd0 | `/cad-adopt` initializes `.planning/` from an existing repo |
| 1 | 2 | 1abf6b9 | adopt asks only what the repo cannot answer |
| 1 | 3 | 838d155 | the absent-`.planning/` surfaces name both front doors |
| 1 | 4 | 0bbf708 | register `/cad-adopt` in the command reference |
| 1 | 5 | 7a87530 | README names the second door, ledger README cites re-pinned |
| 2 | 1 | a9f177b | commit verbatim's design brief as a fixture with a structural test |
| 2 | 2 | cc61863 | `--brief` reads a design brief and stops re-asking what it settles |
| 2 | 3 | e881656 | a discovery page for arriving with a design brief |
| 2 | 4 | b5908c1 | README's loop links the discovery page, ledger README cites re-pinned |

Range: `6790224..b5908c1`, 9 commits.

## Deviations

None - both plans executed as written. The two CONTEXT flagged assumptions each
plan was told to settle were settled as its Notes proposed: adopt REFUSES a
non-repo (and a subdirectory) rather than running `git init`, and the discovery
page is a new `docs/DISCOVERY.md` rather than a section of `docs/WORKFLOW.md`.

## Open items

- Four human-verify walks belong to `/cad-verify 2`, not here: the subdirectory
  refusal, AC1 + AC2 (a walked `/cad-adopt` on a brownfield checkout), AC3
  (adopt asks about no goal, stack or build command the repo already states),
  and AC5 (`--brief` against the committed fixture). PLAN-1's Notes name
  `/code/axel` (74 commits, README + Cargo.toml + SPEC.md, no `.planning/`) as
  the cheapest walk target, with `/code/powercurve` and `/code/headroom` larger.
- `README.md:142`'s "23 skills" is wrong before this phase touched it (v3.0.0's
  `cad-report` made it 24) and `/cad-adopt` makes it 25. Left standing per
  PLAN-1's Notes; correcting a count this phase did not break would be scope
  invention. `README-44` cites that line and its verdict cell was deliberately
  not changed.
- `NEW-PROJECT-12`'s claim text ("Dispatch via the spawn-agent seam with timeout
  `workflow.subagent_timeout`") is now half-false: the key was deleted, and
  `new-project.md:211-213` says so in prose. Its line cite is correct and its
  claim/verdict cells were left untouched per D-16. Needs the CONTEXT-03
  treatment - correct the claim, not the cite - in a sweep that owns claim text.
- `README-39` cites a range ("the three command lists") that PLAN-2 task 4
  shifted arithmetically. The range's edges were checked, not every command
  inside it; a `/cad-docs-verify` sweep is what re-reads it.

## Goal check

The commits plausibly deliver the goal, with one honest caveat: everything
built here is proven structurally and nothing is yet proven behaviourally. The
brownfield door exists as a real command surface -
`skills/cad-adopt/SKILL.md` and a 298-line `cadence-core/workflows/adopt.md`
(22a2bd0) - and it is reachable rather than orphaned: `/cad-adopt` appears once
in `cadence-core/references/COMMANDS.md` under `## Build spine (the core loop)`
(0bbf708), twice in `README.md` (7a87530), and once each at the five
absent-`.planning/` sites that previously offered only the blank page
(838d155). D-01 and D-03 are checkable and hold: `grep -c "Task"
skills/cad-adopt/SKILL.md` returns 0 and `grep -c adopt
cadence-core/route-table.json` returns 0, so adopt dispatches nothing. The brief
door is equally present - `--brief` occurs 3x in
`cadence-core/workflows/new-project.md`, 2x in `skills/cad-new-project/SKILL.md`
and 4x in `docs/DISCOVERY.md` (cc61863, e881656) - and its ground is in the tree
rather than on one machine: the 527-line fixture plus
`cadence-core/bin/design-brief.test.mjs`, which passes under `node --test`
(a9f177b). `node cadence-core/bin/self-verify.mjs` exits ok with no
`unbudgeted-surface` and no `budget-overrun`, and `node cadence-core/bin/test.mjs
prose` passes 212/212. What is missing is exactly the part a subagent cannot
supply: no `/cad-adopt` has been run against a real repo, so AC1's "`/cad-health`
reports zero problems" and AC2's remaining-work shape are unobserved, and no
`--brief` run has been watched declining to re-ask a settled question, so AC5's
suppression is a stated rule that has never fired. Those four walks are the
phase's real remaining risk and they are `/cad-verify 2`'s to close.
