# Census replay: what the plan-time arm would have refused

Measured 2026-08-25, at commit `ac01bcc7`, by replaying
`censusesAtRisk` from `cadence-core/bin/lib/census-registry.mjs` over the
declared file list of every plan in this repository's own record.

This is AC4's record. It exists because D-03 accepts that each registry row's
`subjects` expression is hand-written and can drift, and a drifted subject
turns the plan-time gate into noise rather than into a signal. The bound is
half: no single registry entry may refuse more than half of the plans it could
speak to. An entry over that line is narrowed again or removed, never tuned -
`cadence-core/bin/planning/lease-check.mjs`'s own header states what happens to
a rail that fires wrong. The bound is asserted, not just recorded: see
`lease-check --plan-time: no registry entry refuses more than half of this
repository's own plans` in `cadence-core/bin/planning-lease-check.test.mjs`.

## Corpus

Every `PLAN.md` and `PLAN-<k>.md` under `.planning/` - the live `phases/`,
every `_archive-v*/` and every `tasks/<slug>/`.

| | |
|---|---|
| Plan files walked | 56 |
| Declaring at least one path under `cadence-core/bin/` | 48 |
| Bound (half of 48) | 24 |
| Worst entry | `planning-detail-sites`, 15 (31%) |

The corpus grows with the record, so the figures are re-measured rather than
carried: 40 plans under `cadence-core/bin/` when phase 2's CONTEXT was gathered
on 2026-08-24, 43 when this file was first written, and 48 now that phases 3
through 6 have written their own plans. The worst entry has not moved in
absolute terms across any of those re-measurements - only its share, which
falls as the corpus grows.

## Per-entry refusal counts

Each row is the number of those 48 plans whose declared list intersects that
entry's subjects while declaring neither its holding file, so the plan-time arm
would have refused and named it.

| Registry entry | Holding file | Refuses | Share |
|---|---|---|---|
| `planning-detail-sites` | `cadence-core/bin/planning-lease-check.test.mjs` | 15 | 31% |
| `seam-call-counts` | `cadence-core/bin/seam-calls.test.mjs` | 9 | 19% |
| `self-verify-merge-layers` | `cadence-core/bin/self-verify.test.mjs` | 6 | 13% |
| `trace-refusal-sentences` | `cadence-core/bin/trace.test.mjs` | 6 | 13% |
| `phase-spelling-callsites` | `cadence-core/bin/phase-spelling.test.mjs` | 4 | 8% |
| `weight-budgets` | `cadence-core/bin/weight-budgets.json` | 2 | 4% |
| `deferred-reads-register` | `cadence-core/bin/deferred-reads.test.mjs` | 2 | 4% |
| `arg-contract-flag-entries` | `cadence-core/bin/arg-contract.test.mjs` | 0 | 0% |
| `bulk-output-register` | `cadence-core/bin/bulk-output.test.mjs` | 0 | 0% |
| `capture-writers-register` | `cadence-core/bin/capture-writers.test.mjs` | 0 | 0% |
| `rung-agent-files` | `cadence-core/bin/rung-agent.test.mjs` | 0 | 0% |
| `text-transport-register` | `cadence-core/bin/text-transport.test.mjs` | 0 | 0% |

## What the numbers say

Phase 2's plan predicted four of these while it was being written -
`self-verify.test.mjs` 6, `trace.test.mjs` 6, `weight-budgets.json` 2 and
`arg-contract.test.mjs` 0 - and every re-measurement since has confirmed all
four at the same absolute counts over a larger corpus each time. The rest of
the table arrived without a prediction: `planning-detail-sites` at 15 and
`deferred-reads-register` at 2 were already here when this file was written,
`phase-spelling-callsites` at 4 and `capture-writers-register` at 0 were
registered after it, and `seam-call-counts` at 9 is phase 6's row - predicted
at 9 by its CONTEXT's own replay, and measured at 9 here.

`planning-detail-sites` is the widest entry in the registry and by a long way
the loudest. Its subject pair is `cadence-core/bin/planning.mjs` plus
`cadence-core/bin/planning/`, which is wide by NECESSITY rather than by choice:
that census is taken over the concatenated seam `seamSource()` reads, so a
narrower subject would not be what the assertion pins. It sits at 31%, inside
the bound with room, and it is the entry to watch - the next plan-shaped change
to the planning seam is the one that would push it. If it crosses, the remedy
is not a wider bound.

Five of the twelve entries refuse nothing at all over the whole record. That is
not a defect: their subjects are single `lib/` modules that few plans touch,
and an entry that has never fired is an entry that has never fired wrong.
