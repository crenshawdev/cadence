# Census replay: what the plan-time arm would have refused

Measured 2026-08-25, at commit `55c8ec1f`, by replaying
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
| Plan files walked | 51 |
| Declaring at least one path under `cadence-core/bin/` | 43 |
| Bound (half of 43) | 21 |
| Worst entry | `planning-detail-sites`, 15 (35%) |

The CONTEXT measured 40 on 2026-08-24, before this phase's own plans and phase
1's landed. The three added plans plus this phase's two account for the
difference.

## Per-entry refusal counts

Each row is the number of those 43 plans whose declared list intersects that
entry's subjects while declaring neither its holding file, so the plan-time arm
would have refused and named it.

| Registry entry | Holding file | Refuses | Share |
|---|---|---|---|
| `planning-detail-sites` | `cadence-core/bin/planning-lease-check.test.mjs` | 15 | 35% |
| `self-verify-merge-layers` | `cadence-core/bin/self-verify.test.mjs` | 6 | 14% |
| `trace-refusal-sentences` | `cadence-core/bin/trace.test.mjs` | 6 | 14% |
| `weight-budgets` | `cadence-core/bin/weight-budgets.json` | 2 | 5% |
| `deferred-reads-register` | `cadence-core/bin/deferred-reads.test.mjs` | 2 | 5% |
| `arg-contract-flag-entries` | `cadence-core/bin/arg-contract.test.mjs` | 0 | 0% |
| `text-transport-register` | `cadence-core/bin/text-transport.test.mjs` | 0 | 0% |
| `bulk-output-register` | `cadence-core/bin/bulk-output.test.mjs` | 0 | 0% |
| `rung-agent-files` | `cadence-core/bin/rung-agent.test.mjs` | 0 | 0% |

## What the numbers say

The plan predicted four of these while it was being written -
`self-verify.test.mjs` 6, `trace.test.mjs` 6, `weight-budgets.json` 2 and
`arg-contract.test.mjs` 0 - and the re-measurement confirms all four at the
same absolute counts over a larger corpus. The two it did not name are
`deferred-reads-register` at 2 and `planning-detail-sites` at 15.

`planning-detail-sites` is the widest entry in the registry and by a long way
the loudest. Its subject pair is `cadence-core/bin/planning.mjs` plus
`cadence-core/bin/planning/`, which is wide by NECESSITY rather than by choice:
that census is taken over the concatenated seam `seamSource()` reads, so a
narrower subject would not be what the assertion pins. It sits at 35%, inside
the bound with room, and it is the entry to watch - the next plan-shaped change
to the planning seam is the one that would push it. If it crosses, the remedy
is not a wider bound.

Four of the nine entries refuse nothing at all over the whole record. That is
not a defect: their subjects are single `lib/` modules that few plans touch,
and an entry that has never fired is an entry that has never fired wrong.
