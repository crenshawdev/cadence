---
phase: 2
status: complete
completed: 2026-08-14
---

# Phase 2: The run record joins - Summary

The joined run record now answers correctly about itself: pre-anchor events join
their phase's anchor at read time, a replayed terminal funds nothing, a
wrong-role close surfaces in `mismatched`, the re-arm veto is fire-scoped, and
`/cad-report` prices the in-dispatch reading and names record-health defects.

## What shipped

- Read-time pre-anchor repair - `cadence-core/bin/lib/trace.mjs` (renderTrace
  pass 2; the file on disk is never rewritten)
- `mismatched` array on the render and through `trace render` -
  `cadence-core/bin/lib/trace.mjs`, `cadence-core/bin/planning.mjs`
- Replayed-terminal dedup (byte-identical closes fund one bracket) -
  `cadence-core/bin/lib/trace.mjs`
- Fire-scoped re-arm veto, dual on-disk re-arm spellings, per-fire R1 evidence -
  `cadence-core/bin/lib/trace-suggest.mjs`
- Live R1 demonstration on this repo's own record -
  `.planning/phases/2/R1-DEMO.md` plus a string-literal regression test
- `/cad-report` reads the `reads` summary (`fileCalls`, `fileRedundancy`,
  `topFiles`) and names `mismatched` in Record health -
  `cadence-core/workflows/report.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 8fb4110 | join a pre-anchor event to its phase's anchor at read time |
| 1 | 2 | b7a92c5 | report a bracket closed under a role its dispatch did not name |
| 1 | 3 | 5855efe | stop a replayed terminal funding a dispatch that never came back |
| 1 | gate | d017c2b | keep a no-sha run's events out of the run after it (risk_surface fix) |
| 2 | 1 | 1eb2161 | read both on-disk re-arm spellings as the base trigger |
| 2 | 2 | 9c36dc8 | scope the re-arm veto and R1's survivor test to the fire |
| 2 | 3 | 093e894 | pin R1 firing on this repo's live run record |
| 3 | 1 | ef1cd43 | price the in-dispatch reading in /cad-report |
| 3 | 2 | f4ce46e | name a bracket closed under the wrong role in the report |

## Deviations

- [gate] Plan 1's `risk_surface` fire (blocking, openai) confirmed one high:
  the forward repair pulled a no-sha run's events into the run after it, letting
  a new run's terminal fund a previous run's dispatch. Fixed in d017c2b with a
  regression test; the narrowed re-arm round confirmed it closed. Settle in
  `REVIEW-risk_surface-plan-1.md`.
- [gate] Plan 2's `risk_surface` fire raised 3; adjudication killed all three
  against the plan's acceptance criterion and the committed live-record test
  (the trace's adjudication line says 1 survivor - it was appended before the
  downgrade; `REVIEW-risk_surface-plan-2.md` is the settle). No fix round.

Plans executed as written otherwise - 0 executor deviations.

## Open items

- A re-arm round's own empty adjudication is unvetoable R1 evidence: defensible
  on the reviewers arm (it is what makes the live demo emit), but a
  confirmation round that raised nothing feeds the gate-off arm while R2
  receipts the same loop as "keep it". Semantics refinement for phase 4's
  suggestions work (filed to CAPTURE).
- `trace render --phase N` still aggregates every cycle's runs of phase number
  N into one `roles` table - corr ids now distinguish the runs but the totals
  do not split on them, so a re-used phase number reads as one inflated run
  (filed to CAPTURE, phase 4's render work).
- Events after a no-sha anchor render unpaired/unrecorded rather than joining
  the next run - the adjudicated accepted default on degraded records
  (`REVIEW-risk_surface-plan-1.md` open item); no workflow writes a no-sha
  anchor. Not filed - documented where it lives.

## Goal check

The phase goal - correlation and role accounting produce figures `/cad-report`
and `/cad-suggest` can be trusted with - is plausibly delivered by the nine
commits above. The live-corpus smoke check in plan 1's report ran
`trace render` over the real 533-event `.planning/trace.jsonl` and found zero
bare-form corr ids left (all 18 ids are `<phase>-<sha>`), zero mismatches, and
5 unpaired brackets now correctly attributed to their runs; the replay rule has
a proved-failing-first test (pre-fix it rendered `{dispatches:2, tokens:200}`
where `unrecorded: 1` was true). On the suggest side, task 2's falsification
flipped the veto loop to oldest-first and failed exactly the
nearest-preceding-fire test (1 of 23), and `trace suggest` over the live record
emits the R1 suggestion recorded verbatim in `R1-DEMO.md` - the plan's own
acceptance criterion. `/cad-report` now names `fileCalls`, `fileRedundancy`,
`topFiles` and `mismatched` (report.md, commits ef1cd43/f4ce46e; self-verify 0
problems, 1710/1710 tests). What remains short of "trusted": the cross-cycle
aggregation open item above - per-role totals for a re-used phase number still
join runs the corr ids can now tell apart.
