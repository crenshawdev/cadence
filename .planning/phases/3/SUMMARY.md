---
phase: 3
status: complete
completed: 2026-08-26
---

# Phase 3: Pin the stem list and fix the prose - Summary

A census test now pins `GROUPS.planning` against the tree in both directions,
`CADENCE-CENSUS` has the prose home in `conventions.md` that `CADENCE-DEBT`
already had, and `seam-calls.test.mjs`'s header names the archived plan its
figure argues against instead of a `PLAN-2` no reader can locate.

## What shipped

- `planning-capture-check` named in `GROUPS.planning` - `cadence-core/bin/test.mjs`
- Both-directions stem census, no count written down - `cadence-core/bin/test-groups.test.mjs`, row `planning-group-stems` in `cadence-core/bin/lib/census-registry.mjs`
- Two headers corrected to describe what is on disk - `cadence-core/bin/test.mjs`, `cadence-core/bin/census-registry.test.mjs`
- `CADENCE-CENSUS` grammar and its one reddening rule in prose - `cadence-core/references/conventions.md` `## Deliberate shortcuts`, budget re-pinned in `cadence-core/bin/weight-budgets.json`
- The seam-call figure's source named by archive path - `cadence-core/bin/seam-calls.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 9fc4f192 | Name `planning-capture-check` in the `planning` group |
| 1 | 2 | f4114c28 | Pin `GROUPS.planning` against the tree with a census |
| 1 | 3 | fcdfdd7c | Stop the two headers denying the check beside them |
| 1 | 4 | 33e539c6 | Give `CADENCE-CENSUS` its prose home in conventions |
| 1 | 5 | 40cfe0c6 | Name the archived plan the seam-call header derives from |

## Deviations

None - plans executed as written.

## Open items

- The `planning-detail-sites` registry row says "the 14 error-detail sites" while its marker at `cadence-core/bin/planning-lease-check.test.mjs:315` says 15. Left alone per CONTEXT D-11: nothing asserts `counts`, and fixing it would pull a file outside this plan's lease.

## Goal check

The five commits deliver the phase goal. The stem list is pinned both
directions: `ls cadence-core/bin/planning-*.test.mjs | wc -l` returns 23 and the
`planning` group's `planning-*` entries in `node cadence-core/bin/test.mjs
--list` count 23, with `planning-capture-check` printed under `planning` rather
than `other`; `node cadence-core/bin/test-groups.test.mjs` passes, and its
`CADENCE-CENSUS` marker joins to a row at
`cadence-core/bin/lib/census-registry.mjs:279` whose `holder` is that same file,
which `node cadence-core/bin/census-registry.test.mjs` confirms by passing. The
prose home exists at `cadence-core/references/conventions.md:60-72`, describing
the marker grammar and stating the one rule that a marked site whose id no
registry row names reddens the suite, with no literal marker line written
(`grep -n 'CADENCE-CENSUS' cadence-core/references/conventions.md` returns the
backticked mention only). The header fix landed as comment lines only in
`40cfe0c6`, which now names `.planning/_archive-v3.3.0/4/PLAN-2.md` task 6 as
the source of the 5-for-`context.md` figure. The whole suite is green
(`node cadence-core/bin/test.mjs`: fail 0) and
`node cadence-core/bin/self-verify.mjs` reports `problems: []`, so the budget
move that rode task 4 did not overrun. Nothing in the goal is missing. The one
carried item is the `planning-detail-sites` 14-versus-15 mismatch, which
CONTEXT D-11 had already scoped out of this plan and which is recorded as an
open item rather than a gap in what was asked for.
