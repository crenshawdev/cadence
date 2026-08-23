# Phase 1: The chain reaches what it claims - Context

Gathered: 2026-08-23
Feeds: /cad-plan 1

## Scope boundary

In: the three gaps the `v3.6.0` changelog states about its own `/cad-why` work -
reachability on the bare-path arm (`WHY-02`), the renderer's entry cap and the
byte claim under it (`WHY-03`), and `closeOver`'s string-compared commit dates
(`WHY-04`) - plus the repair of the `/cad-why` tests the `v3.6.0` close reddened,
without which no "the suite passes" check in this phase is readable.

Out: the read-back gate, `cite-count`'s ADVISORY disposition, the `-L` line
arm's own history simplification, and every carried-in open item PROJECT.md
lists unassigned (`PRS-01`, `EVD-01`, `RCL-06`, `CTX-02`, and the mediums from
the `v3.6.0` reviews). Nothing here changes what the write side records.

Deferred: none. The phase is the three named defects and the suite repair they
are measured through.

Plan shape: one plan. The natural split (WHY-02 + WHY-03 against WHY-04 + the
suite repair) fails the independence test twice: D-01 through D-05 are one
record in this file, and the entry-cap measurement cannot be taken until the
exclusion block WHY-02 adds has landed, because that block is bytes on every
chain that has one.

## Durable decisions

- D-01 (reachability, WHY-02): the bare-path arm KEEPS `--follow` and REPORTS
  what git's default history simplification excluded, rather than trading
  `--follow` away for `--full-history`. The two flags do not compose - measured
  on git 2.55.0 on 2026-08-23, `git log -M --follow --full-history --
  cadence-core/bin/lib/release-decision.mjs` returns the same 7 commits
  `--follow` alone returns, while `--full-history` without `--follow` returns 10
  - so this is a choice between rename-following and full history and never a
  flag that can simply be added. `--follow` is already measured-justified (D-17
  in `cadence-core/bin/lib/why-query.mjs`: 173 rename records in the last 400
  commits of the surface this command reads). What `--full-history` would buy is
  merges and only merges, and the `--follow` set is a subset every time:
  `cadence-core/bin/planning.mjs` 152 against 191, all 39 of the difference
  merges; `README.md` 68 against 96, all 28 merges; `lib/issue-decision.mjs` 12
  against 17, all 5 merges; `lib/release-decision.mjs` 7 against 10, all 3
  merges. Every one of those merges resolves to NOTHING in the merged four-tier
  index - the three on `release-decision.mjs` (`b86fc25c`, `051f0df1`,
  `9237a539`) come back `unresolved` from `resolveCommit` - so admitting them
  spends entry-cap slots on gap blocks that name no phase. **The cost, on a path
  with a busy merge history:** one extra `git log --full-history` per bare query,
  measured at 6 ms on the 191-commit `planning.mjs`, plus a capped note of a few
  hundred bytes; against the rejected arm's cost of 39 unresolvable entries
  competing for a cap of 6 on that same path, and the loss of rename-following
  on all of them. **And the premise is corrected here rather than inherited:**
  `.planning/ROADMAP.md:53-56` and `.planning/PROJECT.md`'s `### Active` both say
  the three commits missing on `release-decision.mjs` are `_archive-v2.2.0/3`
  phase commits collapsed into merge `0bf62847`. Measured, that is false in both
  halves - `0bf62847` is single-parent (`0bba96f4`) and is already one of the 7
  the chain carries, and the five commits `_archive-v2.2.0/3/SUMMARY.md` records
  (`2c3c2cb`, `1dd5ad5`, `86929d4`, `67f0379`, `c253a3b`) exist as objects but
  are not ancestors of HEAD, so no `git log` flag reaches them and no
  reachability change recovers that phase. Evidence:
  `cadence-core/bin/lib/why-query.mjs:37-46`,
  `cadence-core/bin/lib/why-corpus.mjs:506-514`, `.planning/ROADMAP.md:53-56`,
  `.planning/PROJECT.md:203-209`.
- D-02 (entry cap, WHY-03): `DEFAULT_TOP` drops from 10 to the largest value
  under which the worst measured path's render stays beneath the 10,000-byte
  line `cadence-core/references/conventions.md` states, and the comment above it
  states THAT measurement - the paths, their byte counts, the date, and the
  maximality claim - instead of the reason it carries today, which measurement
  has already falsified. The decided value is 6 and it is re-measured after the
  D-01 exclusion block lands, since that block adds bytes to every chain that
  has one. Measured 2026-08-23 at the shipped cap of 10 with all join edges
  filled: `lib/capture-file.mjs` 11,211 B over 8 entries, `lib/issue-decision.mjs`
  12,481 B over 10 of 12, `planning.mjs` 14,626 B over 10 of 152,
  `lib/release-decision.mjs` 8,274 B over 7. Cumulative rendered bytes at six
  entries: 8,702 / 7,675 / 8,048; at seven: 9,926 / 9,001 / 9,296, which the
  truncation note and D-01's exclusion block push past 10,000 on
  `capture-file.mjs`. The roadmap's alternative arm - keep 10 and re-justify it
  on some other ground - is rejected: bounding the response is the only job this
  constant has and there is no second reason available for it. Evidence:
  `cadence-core/bin/lib/why-render.mjs:34-60,91`,
  `cadence-core/references/conventions.md`, `.planning/ROADMAP.md:71-80`.
- D-04 (ordering, WHY-04): `closeOver` selects on parsed instants, the selection
  is ORDER-INDEPENDENT, and an unparseable date is a stated absence rather than
  a throw. The string comparison is the reported defect - ISO-8601 values under
  different UTC offsets do not string-sort chronologically - but the function
  also silently depends on `prunes` arriving newest-first from
  `findPruneCommits`, and a caller change would break it just as quietly, so the
  fix picks the SMALLEST instant at or after the commit's rather than the last
  match in the incoming order. The absence arm matters because this runs inside
  the gap pass over an already-answered chain: a throw there loses a query git
  had already answered, so an unparseable commit date returns null and a prune
  whose own date will not parse is skipped rather than allowed to decide.
  Evidence: `cadence-core/bin/lib/why-corpus.mjs:911-924`,
  `cadence-core/bin/why-corpus.test.mjs:593-609`, `.planning/ROADMAP.md:82-88`.

## Decisions

- D-03 (the pin, Success Criterion 4): the `DEFAULT_TOP` pin measures a REAL
  captured worst case - the chain entries and the simplification report exactly
  as the seam handed them to `renderChain`, committed as a frozen fixture - and
  asserts BOTH directions: the render at the default is under the threshold, and
  the render at one above the default is not. A synthetic per-entry size drifts
  from what the seam actually renders, which is exactly how the shipped comment
  came to claim a figure nothing measured; and the under-assertion alone would
  let the cap be lowered while the comment went on claiming maximality. The
  fixture is frozen on purpose - its job is to pin the cap against a shape that
  was really measured, not to track whatever that path's history does next.
  Evidence: `cadence-core/bin/why-render.test.mjs:29-41`,
  `cadence-core/bin/fixtures/verbatim.trace.jsonl` (the same committed-real-bytes
  precedent).
- D-05 (the reddened suite, Success Criterion 6): the `/cad-why` tests the
  `v3.6.0` close broke are repaired to assertions a LATER close cannot redden,
  never re-pinned at today's numbers. Discovered at plan time rather than carried
  in from the roadmap: `node cadence-core/bin/test.mjs` reports 2,907 tests with
  failures on a clean tree before this phase begins. Three are in
  `why-corpus.test.mjs` and grow by one at every close (the prune count, the
  `--full-history` control count, the labelled-close count), two more there pin a
  LIVE `phases/1` that does not exist between milestones, and one is in
  `why-record.test.mjs`, which reads
  `.planning/phases/1/ADJUDICATION-risk_surface-plan-1.json`, deleted by the
  `v3.6.0` prune commit `d8173830` and recoverable from its parent. Re-pinning
  the constants would only move the same breakage to the next close, so the
  live-corpus counts become monotone lower bounds carrying their measured figure
  and date, the both-tiers walk moves onto a built root, and the deleted record
  is committed verbatim as a fixture. Evidence:
  `cadence-core/bin/why-corpus.test.mjs:318-359`,
  `cadence-core/bin/why-record.test.mjs:352-365`.

## Acceptance criteria

- [ ] AC1: `/cad-why cadence-core/bin/lib/release-decision.mjs` prints a `text`
      that names `b86fc25c`, `051f0df1` and `9237a539` as commits also touching
      that path which the chain does not list, and says history simplification
      dropped them - the currently-silent 7-of-10 stops being silent - while a
      path with nothing excluded prints no such block at all.
- [ ] AC2: this file records the reachability choice as a numbered decision
      (D-01) naming what it costs on a path with a busy merge history, with the
      figures and the date it was measured on.
- [ ] AC3: rendering the worst measured path at the shipped default prints under
      the 10,000-byte line `cadence-core/references/conventions.md` states, and
      `lib/why-render.mjs`'s comment states that measurement, its date and the
      maximality claim it supports.
- [ ] AC4: `why-render.test.mjs` reddens when `DEFAULT_TOP` and the comment's
      stated reason disagree - the fixture render is under the threshold at the
      default and over it at one above.
- [ ] AC5: `closeOver` attaches a commit whose `%cI` string sorts on the wrong
      side of a close to the close it actually belongs to as an instant, returns
      null on an unparseable date rather than throwing, and the pinning test
      fails against the string-compare implementation.
- [ ] AC6: `node cadence-core/bin/test.mjs` reports 0 failures and `node
      cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
      `problems: []`.

## Flagged assumptions

- 6 is the largest `DEFAULT_TOP` under which the worst measured path stays under
  10,000 bytes - MEDIUM, because the figure was taken before the D-01 exclusion
  block existed; if wrong: the cap is set to whatever the re-measurement after
  that block lands on and the difference is logged as a deviation.
- The exclusion block's cost is a few hundred bytes on a path that has one -
  MEDIUM, estimated from the capped-list shape rather than measured; if wrong:
  the cap absorbs it, since the cap is measured after the block ships.
- No third `/cad-why` caller depends on `closeOver` receiving `prunes`
  newest-first - HIGH, `why.mjs`'s gap pass is the only call site; if wrong: an
  order-independent selection is still the correct answer, so the consequence is
  a changed answer only where the old one was wrong.
