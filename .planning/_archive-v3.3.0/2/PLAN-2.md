---
phase: 2
plan: 2
requirements: [TRC-01]
files:
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - .planning/phases/2/R1-DEMO.md
---

# Phase 2: The run record joins - Plan 2

## Goal

`trace suggest`'s gate rule reads the record a fire at a time, so a re-arm
round is visible on both halves of the rule and R1 can actually speak on the
corpus this project has been writing for four cycles.

## Must be true when done

- `parseAdjudication` reads both on-disk re-arm spellings
  (`risk_surface rearm:` and `risk_surface re-arm:`) as the BASE trigger
  `risk_surface` carrying a re-arm marker, and no trigger token with a space in
  it is ever minted.
- A re-arm suppresses only the fire it belongs to; a re-arm recorded in one
  cycle no longer mutes a trigger for the life of the file.
- R1's survivor test is per-fire: the evidence it prints names how many of a
  trigger's fires adjudicated zero survivors, out of how many fires.
- `node cadence-core/bin/planning.mjs trace suggest` run in this repo emits at
  least one R1 suggestion, and the run's input lines and emitted suggestion are
  recorded in the phase record.
- `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface` and no
  `budget-overrun`.

## Context

- D-03: the re-arm veto is FIRE-scoped. `.planning/trace.jsonl` is never pruned
  or archived, so today's lifetime veto spans four cycles in one file and is
  permanent by construction.
- D-04: a re-arm round's adjudication normalizes to its base trigger token with
  a marker on the parsed row, never a trigger of its own - a `risk_surface
  rearm` trigger would mint the phantom config key
  `review.triggers.risk_surface rearm.gate` and fail the schema test at
  `trace-suggest.test.mjs`'s `config keys named in actions exist in
  config.schema.json` against `cadence-core/config.schema.json`.
- D-09: the live-corpus demonstration is a recorded measurement or live lines
  quoted as string literals. No committed test may read
  `.planning/trace.jsonl` - it is gitignored and absent in CI.
- D-11: no I/O and no new rule inside `lib/trace-suggest.mjs`; the file's stated
  contract is that every rule is a pure function over the render.
- `lib/trace.mjs` is PLAN-1's file and is not touched here.

## Tasks

### Task 1: Admit both on-disk re-arm spellings as the base trigger

- **Files:** cadence-core/bin/lib/trace-suggest.mjs, cadence-core/bin/trace-suggest.test.mjs
- **Action:** Widen `parseAdjudication` so a detail line whose trigger token is
  followed by either `rearm` or `re-arm` before the colon parses to the BASE
  trigger (`risk_surface`) with a boolean re-arm marker on the returned row,
  beside the existing `trigger`, `survivors` and `raised` fields. Both spellings
  live on disk today (corr `3-d558479` writes `rearm:`, corr `1-7502567` writes
  `re-arm:`), and the legacy `of <m>` clause must still be read from immediately
  after the survivor count on both. Admit nothing else: a trigger token carrying
  any other embedded space stays unparseable, and the `plan: 6 raised,
  unadjudicated (advisory gate)` line - which never adjudicated - must still
  return `null`. Re-point the two rows pinned as unparseable at the
  `parseAdjudication: the two lines unparseable today are still unparseable`
  test and at the tail of the `of <m>` test: the `re-arm:` line is now a parsed
  row (one test row per spelling), the `unadjudicated` line stays pinned as
  `null`. Every existing `deepEqual` over a `parseAdjudication` return gains the
  new field, so update them rather than loosening the assertions to `partial`
  shape checks.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes,
  including assertions that both
  `risk_surface rearm: 2 survivors of 2 raised; voices openai` and
  `risk_surface re-arm: 0 survivors of 1 raised; voices openai/gpt-5.6-sol`
  parse to trigger `risk_surface` with the re-arm marker set and their raised
  clause read, and that
  `plan: 6 raised, unadjudicated (advisory gate); voices openai/gpt-5.6-sol`
  still parses to `null`.

### Task 2: Scope the re-arm veto and the survivor test to the fire

- **Files:** cadence-core/bin/lib/trace-suggest.mjs, cadence-core/bin/trace-suggest.test.mjs
- **Action:** In `suggestFromRender`, replace R1's per-trigger lifetime totals
  with per-FIRE rows: each parsed `outcome/adjudication` event is one fire,
  carrying its `corr`, its trigger, its survivor count, its raised count and its
  re-arm marker. An `outcome/rearm` event vetoes exactly ONE fire
  in its own `(corr, trigger)` group: the nearest non-re-arm fire PRECEDING it
  by file position - the fire that forced the round - never an earlier
  unrelated fire, and a re-arm round's OWN adjudication (the marked row) is
  never the vetoed fire, because it is the second round's result rather than
  the fire that forced the round. R1 then speaks when a trigger has at least
  `MIN_FIRES_FOR_GATE_SUGGESTION` unvetoed fires that adjudicated ZERO
  survivors, and its evidence names that count out of the trigger's total fires
  so a reader sees the productive fires beside the empty ones; the two-arm split
  stays exactly as it is (raised summed over the EMPTY fires alone decides
  between the `review.reviewers` arm and the `review.triggers.<t>.gate` arm, an
  UNKNOWN raised count still contributing 0 rather than being invented). Leave
  R2 trigger-scoped: a trigger that ever re-armed still earns its keep-the-gate
  receipt. Do not raise or lower `MIN_FIRES_FOR_GATE_SUGGESTION` - it was
  measured on 2026-08-14 to clear at 2 under this rule (see Notes); it is the
  lever only if task 3's demonstration comes back empty.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes,
  including a test where two zero-survivor fires under one `corr` plus one
  `rearm` for that trigger yield NO gate suggestion (the surviving fire is below
  the floor) while two zero-survivor fires under DIFFERENT `corr` values with a
  `rearm` under only one of them, plus a re-arm-marked zero-survivor fire, DO
  clear the floor; and a mixed-survivor test: a zero-survivor fire, then a
  three-survivor fire, then a `rearm`, all under one `(corr, trigger)`, vetoes
  the three-survivor fire and leaves the zero-survivor fire counted - an
  assertion that fails under an oldest-first veto. The `config keys named in actions exist in config.schema.json`
  test and the `R2: a rearm becomes a keep-the-gate receipt` test stay green
  untouched.

### Task 3: Demonstrate R1 firing on this repo's live record

- **Files:** .planning/phases/2/R1-DEMO.md, cadence-core/bin/trace-suggest.test.mjs
- **Action:** Run `node cadence-core/bin/planning.mjs trace suggest` from the
  repo root against the real `.planning/trace.jsonl` and record the
  demonstration in `.planning/phases/2/R1-DEMO.md`: the date of the run, the
  `outcome/adjudication` and `outcome/rearm` lines that produced the R1
  suggestion quoted verbatim from the file, the emitted suggestion object
  verbatim, and one line of arithmetic saying which fires were vetoed and which
  cleared the floor. Then add a test to `trace-suggest.test.mjs` that quotes
  those same live lines as STRING LITERALS - the shape
  `parseAdjudication: the hand-written 'of <m>' clauses already on disk still
  read` already uses - and asserts R1 emits for them, so the demonstration keeps
  a regression guard behind it. The test must NOT read `.planning/trace.jsonl`:
  the file is gitignored and absent in CI, so a test reading it goes green by
  reading nothing (D-09). If the run emits no R1 suggestion, do not weaken the
  rule to force one - lowering `MIN_FIRES_FOR_GATE_SUGGESTION` is the only
  sanctioned lever, and taking it means recording the new value and the
  arithmetic that justified it in the same file.
- **Verify:** `node cadence-core/bin/planning.mjs trace suggest` in
  `/data/code/cadence` prints a `suggestions` array containing at least one
  entry whose `subject` names `risk_surface` and whose `action` is a
  `config.schema.json` key, and `.planning/phases/2/R1-DEMO.md` quotes that
  exact entry; `node --test cadence-core/bin/trace-suggest.test.mjs` passes.

## Notes

- Measured 2026-08-14 before planning, simulating this rule over the live
  `.planning/trace.jsonl`: `risk_surface` has 6 parsed fires, of which 3
  adjudicated zero survivors; the one `rearm` under corr `1-7502567` vetoes that
  corr's non-re-arm fire and the one under corr `3-d558479` vetoes a
  three-survivor fire, leaving 2 unvetoed zero-survivor fires - exactly the
  floor - with 1 raised finding across them, which lands the suggestion on the
  `review.reviewers` arm. `plan` (9 fires, 0 empty) and `diff` (3 fires, 1
  empty) stay silent. The arithmetic is unchanged by PLAN-1's correlation
  repair: every `rearm` on disk is post-anchor already. That simulation used
  the oldest-first veto; task 3's demonstration re-runs it under the
  nearest-preceding rule, and if the vetoed fire in `3-d558479` shifts and the
  floor no longer clears, `MIN_FIRES_FOR_GATE_SUGGESTION` is the sanctioned
  lever (task 3).
- The rule change makes `MIN_FIRES_FOR_GATE_SUGGESTION` count unvetoed EMPTY
  fires rather than fires; the constant's name and value stay as they are, and
  its doc comment should say what it now counts.
