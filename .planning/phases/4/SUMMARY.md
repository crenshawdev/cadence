---
phase: 4
status: complete
completed: 2026-08-22
---

# Phase 4: The number nobody can spend - Summary

The in-dispatch read redundancy `lib/read-trace.mjs` computes now reaches
`trace suggest` as a per-role `info` entry naming the worst re-read file inside
one dispatch, with its coverage, its exclusions and its no-config-key remedy
stated beside it.

## What shipped

- `inDispatchReads(rows)` - per-role fold over joined reads, giving opens per
  distinct file inside one dispatch plus the worst single file - `cadence-core/bin/lib/read-trace.mjs`
- R7, the in-dispatch re-reading rule, with exported frozen `IN_DISPATCH_FLOORS`
  (`cad-executor` 3.00, `cad-verifier` 2.00) and no config key behind it -
  `cadence-core/bin/lib/trace-suggest.mjs`
- `trace suggest` opens `.planning/reads.jsonl` through one lifted
  `readReadsRecords(dir)` helper shared with `cmdReads` - `cadence-core/bin/planning.mjs`
- `inDispatch` key on the `reads --join` envelope, off the same fold -
  `cadence-core/bin/planning.mjs`
- Both prose faces state the figure, its coverage and its exclusions -
  `cadence-core/workflows/report.md`, `cadence-core/workflows/suggest.md`
- Fixtures `reread.reads.jsonl` / `reread.trace.jsonl`, and a prose-agreement arm
  falsified in both directions over all 14 asserted clauses -
  `cadence-core/bin/prose-agreement.test.mjs`
- The spike's throwaway `measure.mjs` / `measure2.mjs` deleted; `SPIKE.md` stands
  alone - `.planning/spikes/read-set-redundancy/`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 49137e7a | Fold joined reads into per-role in-dispatch file figures |
| 1 | 2 | 509b7bb7 | R7 in-dispatch re-reading rule, per-role floors, no config key |
| 1 | 3 | 90e127ee | `trace suggest` opens `.planning/reads.jsonl` through one lifted parse |
| 1 | 4 | eecceaaa | Carry the in-dispatch fold on the `reads --join` envelope |
| 1 | 5 | d25b644c | State the figure, its coverage and its exclusions on both prose faces |
| 1 | 6 | 7910e7ed | Retire the spike's throwaway measurement code |

## Deviations

None - the plan executed as written.

## Open items

- PRE-EXISTING, not caused here: `milestone-prune.test.mjs`'s "corpus: pruning
  this repository's own REQUIREMENTS.md needs no hand repair" fails at
  `milestone-prune.test.mjs:575` - "IVW-01 must be a wrapped bullet for this
  corpus to bite". Confirmed failing at `5e223b2a`, the commit this phase started
  from, and still failing at `7910e7ed`. Nothing in plan 1's lease touches
  `milestone-prune.mjs` or `REQUIREMENTS.md`.
- The `reads --join` byte figure in `report.md`'s transport paragraph (2,494 B) is
  a live measurement of a gitignored record that grows by roughly a byte per few
  tool calls. It agreed exactly at `d25b644c`, and the prose carries the same
  growth caveat the render figure above it already carried, so a later reader does
  not read a drifted digit as a broken claim.

## Goal check

The six commits deliver the phase goal. The consumer that ACTS on the figure now
exists and is live on this repository: `node cadence-core/bin/planning.mjs trace
suggest` returns an `info` entry for `cad-executor` reading "in-dispatch
re-reading: 3.64 opens per distinct file inside one dispatch over 79
dispatch(es) ... worst inside one dispatch: read `cadence-core/bin/planning.mjs`
29 times (phase 5, plan 2)", plus the sibling `cad-verifier` entry at 2.05 with
`cadence-core/bin/route.mjs` 16 times - both stating "Computed over 64% of the
joined reads in scope", the unscoped-record caveat, "Excludes 4,485 coordinator
read(s)", and "No key in `config.schema.json` governs in-dispatch re-reading -
the remedy is discipline, not configuration". That entry names no config key, and
`prose-agreement.test.mjs` (+101 lines, `cadence-core/bin/prose-agreement.test.mjs`)
holds both prose faces to it. `trace suggest` reaching `.planning/reads.jsonl`
at all is visible in the envelope's `scope`/`events_read` fields, which the
no-reads path never carried. The `risk_surface` gate fired once on the committed
range `5e223b2a..7910e7ed` (match: `untrusted_input`), 1 finding raised, 0
survivors after adjudication, recorded as `gate_pass` in `.planning/trace.jsonl`.
Nothing in the phase goal looks missing. The one gap is not this phase's: the
`milestone-prune.test.mjs` corpus failure above pre-dates `5e223b2a` and sits
outside plan 1's declared files.
