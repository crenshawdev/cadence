---
phase: 1
status: complete
completed: 2026-08-23
---

# Phase 1: The chain reaches what it claims - Summary

`/cad-why` now states its own reachability gap in words, carries an entry cap
whose stated reason measurement supports, and orders closes by parsed instants
rather than by string comparison - the three defects `v3.6.0` named about its
own work.

## What shipped

- A measured exclusion report on the chain query - `lib/why-corpus.mjs`
  computes which commits `--full-history` reaches that the `--follow` arm does
  not, with each one's parent count.
- That gap stated in the rendered chain - `lib/why-render.mjs`'s
  `excludedBlock`, which names the count, how many are merges, the shas, and the
  `git log --full-history` invocation that shows them. A path with nothing
  excluded renders no block at all.
- `DEFAULT_TOP` lowered to 6 with a parseable `// MEASURED CAP: 6 entries,
  2026-08-23.` header claim - `lib/why-render.mjs`.
- A pin that reddens when the number and its stated reason disagree -
  `why-render.test.mjs` reads the header claim out of the module source and
  asserts it equals `DEFAULT_TOP`.
- `closeOver` ordering by parsed instants with an unparseable date guarded -
  `lib/why-corpus.mjs`.
- The phase's five numbered decisions - `.planning/phases/1/CONTEXT.md`, written
  as task 1 because no `/cad-context` run preceded this phase.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | ff3236b8 | Record the phase's five decisions as CONTEXT.md |
| 1 | 2 | 2c01a7a5 | Repair the /cad-why tests the v3.6.0 close reddened |
| 1 | 3 | e43ff284 | closeOver orders by parsed instants and guards an unparseable date |
| 1 | 4 | 9ec9c556 | The seam measures what history simplification excluded |
| 1 | 5 | e6834a79 | The chain states that exclusion in words |
| 1 | 6 | f25580d5 | The entry cap carries a claim measurement supports |
| 1 | 7 | 65267c0a | The pin that reddens when the number and its reason disagree |

## Deviations

- [deviation] The plan and the dispatch both asserted the suite was red with 6
  failures, 5 of them in `why-corpus.test.mjs` including two pinned to a live
  `phases/1`. Measured on the clean tree at dispatch: 2,907 tests, fail 4 -
  three in `why-corpus.test.mjs` (prune count 25 now 26, `--full-history`
  control 25 now 26, labelled-close count 7 now 8) and one in
  `why-record.test.mjs`. The two live-`phases/1` cases pass today because commit
  `321b9b65` re-created `.planning/phases/1/`. Their fragility is real and
  unchanged, so task 2's repair was applied anyway: the both-tiers-are-walked
  proof moved onto a built root, and the real-corpus case now asserts only the
  group-level discrimination it can uniquely prove. (2c01a7a5)
- [deviation] The dispatch flagged that task 6's re-measurement might land
  somewhere other than 6, which would move its `--top 7` overflow assertion. It
  did not: re-measured AFTER task 5's exclusion block landed, 6 is still the
  largest cap under which the worst path stays under 10,000 B (9,129 B at 6,
  10,343 B at 7 on `lib/capture-file.mjs`). Recorded because the plan named the
  re-measurement as the thing not to trust from the Notes, and the confirmation
  is that check's outcome rather than an inherited figure. No assertion changed.
  (f25580d5)
- [deviation] The dispatch noted task 7's planned assertions inspect byte
  lengths and `DEFAULT_TOP` only, never the D-13 comment's own claimed figure,
  leaving Success Criterion 4 half-closed. Closed properly instead:
  `lib/why-render.mjs`'s header carries a parseable `// MEASURED CAP:` line and
  `why-render.test.mjs` asserts it equals `DEFAULT_TOP`. Proved falsifiable in
  both directions - `DEFAULT_TOP = 7` reddens the under-threshold case AND the
  header-claim case, `DEFAULT_TOP = 5` reddens the over-threshold case AND the
  header-claim case. (65267c0a)

## Open items

- `.planning/ROADMAP.md:53-56` and `.planning/PROJECT.md`'s `### Active` still
  carry a false account of WHY-02: both say the three missing commits are
  `_archive-v2.2.0/3` phase commits collapsed into merge `0bf62847`.
  Independently re-measured and confirmed false - `0bf62847` is single-parent
  (`0bba96f4`) and is one of the 7 the chain already carries; the three
  `--full-history` adds are the merges `b86fc25c`, `051f0df1`, `9237a539`.
  `CONTEXT.md`'s D-01 records the correction, but the ROADMAP and PROJECT prose
  are outside this plan's lease and still say the wrong thing.
- `why.test.mjs`'s new "the exclusion reaches the rendered text" case names
  three shas that the exclusion block caps at three; a later merge into main
  touching `lib/release-decision.mjs` would push one out of the listing and
  redden it. Left as the plan's Verify asks, with the fragility stated in the
  case's own comment.
- `risk_surface` review (openai/gpt-5.6-terra, blocking gate, ruled downgraded):
  `excludedBlock` interpolates the queried path verbatim into terminal-facing
  `text` at `lib/why-render.mjs:225`, so a path containing terminal escape bytes
  is emitted unchanged by a caller that relays `text`. Ruled `low` and not fixed
  here: the path is the caller's own `/cad-why` argument, so it requires typing
  a hostile path yourself. Recorded in
  `ADJUDICATION-risk_surface-plan-1.json`.

## Goal check

The seven commits deliver the phase goal. All three named gaps close with
evidence rather than assertion: `9ec9c556` makes the seam compute the excluded
set and `e6834a79` states it in the rendered text, verified by
`why.mjs cadence-core/bin/lib/release-decision.mjs --dir .` naming exactly
`b86fc25c`, `051f0df1` and `9237a539` as excluded with parentCount 2 each and
none of them among the chain's 7 - which is WHY-02's "stop being silently
7-of-10" in the second arm Success Criterion 1 admits. `f25580d5` re-measured
the cap after the exclusion block landed rather than inheriting the planner's
figure, confirming 6 as maximal (9,129 B at 6, 10,343 B at 7), which closes
WHY-03. `e43ff284` replaces the `%cI` string comparison and guards an
unparseable date, with the new cases proved to go red against the old
implementation - WHY-04's falsifiability requirement, met in the direction that
matters. `65267c0a` closes Success Criterion 4 more completely than the plan
asked, since the pin now reads the comment's own claimed figure instead of only
the byte lengths.

Nothing in the goal is missing. Two things are true and outside it: the ROADMAP
and PROJECT prose still carry the account of WHY-02 that this phase measured
false, and the new `why.test.mjs` case is pinned to live-corpus shas that a
future merge can move. Both are open items rather than gaps in the delivery.
Full suite reports 2,935 tests with fail 0, and `self-verify --root .` returns
`ok:true` with `problems: []`, which is Success Criterion 6.
