# Roadmap

## Overview

`v1.3.1` is shipped and tagged — the latest in the lineage from `v1.0.0`
through `v1.1.0`, `v1.2.0` (cross-model review seam, durable-decision recall,
DeepSeek provider), the `v1.2.1` sweep-highs patch, the `v1.3.0` liteSpeed
flow-and-latency pass, and the `v1.3.1` tech-debt cycle that closed all 13 bugs
from the post-v1.2.0 sweep. Git history and each release tag are that cycle's
archive.

**v1.4.0 — Stated grammars** is the active cycle (opened 2026-07-27). Cadence
parses formats it owns with accreted heuristic regexes, and every one of them
fails silently in both directions: an over-read fabricates a requirement id that
surfaces as an `/cad-audit` orphan, an under-read drops a real path and hands
the parallel-safety gate a false `overlaps: []`. Both look like success. This
cycle replaces three of those readers with grammars that are written down, plus
the spine bookkeeping that has now failed at two consecutive milestone closes.

## Phases

Scope drawn from the open CAPTURE.md backlog at the v1.3.1 close, not from
filed issues: nine items are defects in one function (`readFrontmatterList`),
six more are `git-guard` rail-3 holes whose own capture note argues for one
tokenizer over six more regex arms, and the empty-roadmap fix reverted at that
close failed for the same reason one layer up. Per-task plans come at
`/cad-plan`.

- [x] **Phase 1: The plan-file frontmatter grammar** - Goal: `readFrontmatterList`
  reads every shipped PLAN.md form (inline, block, scalar; a comment on the key
  line, heading the block, or as a block item; `#` with and without a following
  space; CRLF checkouts; a leading blank line or BOM) to exactly the ids and
  files declared, and reports anything outside the grammar instead of silently
  over- or under-reading it. Closes the HIGH regression phase 3 introduced, the
  greedy `\[(.*)\]` three reviewers found independently, and the seven other
  capture items in the same function. One semantic call belongs to the user at
  `/cad-context`: whether `#` followed by a digit is the id test.
- [x] **Phase 2: The spine's own bookkeeping** - Goal: `/cad-plan` seeds the
  REQUIREMENTS `## Traceability` row for every requirement a plan covers, so a
  milestone close never again needs a hand-populated table before `/cad-audit`
  passes (it has now failed to fire at the v1.2.0 and v1.3.1 closes); and a
  parallel executor asserts its own `PLAN-<k>.md` exists before task 1 rather
  than planning against an old merge point, the phase-4 worktree fork bug that
  three executors caught only by noticing. Lands early so the rest of this
  cycle dogfoods both.
- [ ] **Phase 3: One quote-state tokenizer for git-guard** - Goal: the rail-3
  push guard sees a real `git push` through a quoted `-C` path with a space, an
  `&` separator, `$(...)`, backticks, a subshell, an escaped `\"`, and
  `bash -c "..."` - all six holes verified silent at `c4ab89f` and at HEAD -
  closed by one left-to-right quote/escape-state tokenizer rather than six more
  regex arms, since regex patching is what produced phase 4's own two push-rail
  regressions. The shipped rail-3 claim in `references/git.md` moves with it.
- [ ] **Phase 4: A stated grammar for the roadmap phase list** - Goal: what
  counts as a phase-shaped line is defined rather than guessed, so an empty
  `## Phases` is a derived closed-milestone state instead of
  `unparseable-roadmap`, `/cad-progress` works between milestones and routes to
  a destination that exists, and cursor-drift detection stays live in exactly
  the state where the cursor is the only surviving evidence. The four findings
  that got the v1.3.1 attempt reverted are the design brief; each must be
  closed by construction, not by another heuristic. Landing it late means this
  cycle's own close exercises it.
- [ ] **Phase 5: An audit armed in the partially-planned state** - Goal:
  `audit` counts an `## Active` requirement that no phase has picked up, so the
  traceability gate holds in the state a milestone spends most of its life in,
  not only against a zero-row table. `unseeded` fires only when
  `## Traceability` has zero rows (`planning.mjs:553-557`) and `counts.total`
  is `rows.length`, so once any phase is planned an unpicked id is never
  counted and never breaks - verified live here, where TOK-01 and RDM-01 sit in
  `## Active` with no row and `audit` reports neither. Phase 2 closed the
  empty-table hole and retired the hand-populated table that used to cover this
  state, so what is left is the residue of the blind spot that let the v1.2.0
  and v1.3.1 closes through. Whether an unpicked id breaks the verdict or stays
  an additive signal is the `/cad-context` call, since phase 2's D-07 scoped
  verdict arithmetic out.
