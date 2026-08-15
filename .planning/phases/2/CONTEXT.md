# Phase 2: The run record joins - Context

Gathered: 2026-08-14
Feeds: /cad-plan 2

## Scope boundary

In: `TRC-01` in all six of its halves - the pre-anchor correlation gap and the
fire attribution of provider calls, the role-mismatch report, replay-proof
`recorded` accounting, an R1 rule that can fire on the live corpus, the re-arm
trigger token parsing, and a reader for the three unread `reads` figures.

Out: phase 4's seams even where they touch the same files - the `trace close`
subcommand, the bounded `trace render` default, the batched round-trips, and
the read-instrumentation join to fires; the 2026-08-14 scan's cluster-7
remainder not named by an AC here (cross-cycle `trace render --phase N`
aggregation beyond the corr fix, the empty-name role rows, a read-only
`route.mjs resolve` mode, bracket read-set validation, `read-trace.mjs`'s
superseded stat block, pricing the cross-model reviewer arm) - those stay in
the queue; and phases 3 and 5 (bin correctness, docs truth).

Deferred: None.

Plan shape: multiple plans, same phase - the trace.mjs join and accounting land
together (AC1, AC2, AC3); the trace-suggest rules land together (AC4, AC5); the
reads wiring is its own slice (AC6). AC7 is a gate on all of them.

## Durable decisions

- D-01 (correlation): The pre-anchor gap is closed at READ time - a bare-phase
  event is attributed to the next `lifecycle/phase_start` of its phase - and
  the writer's "never mints an id" contract stays untouched. A writer-side fix
  strands every event already on disk (51 live, 17 of the committed fixture)
  unjoined; a file rewrite breaks the append-only contract. Evidence:
  `cadence-core/bin/lib/trace.mjs:13-21`, `:197-230`, `:23-36`;
  `cadence-core/workflows/execute.md:93` (the anchor is written by
  /cad-execute, after /cad-plan's resolves have already written events).
  Measured 2026-08-14: 51/51 bare-form live events have a later anchor for
  their own phase, so read-time attribution is total on this corpus.
- D-02 (correlation): `corr` stays phase-scoped; "the fire that made it" is
  carried by the event's own `trigger` field beside it, never by making `corr`
  fire-scoped. A fire-scoped id would hand every fire a fresh re-arm round -
  `references/triage-gate.md:41-49` caps the blocking re-arm at one by looking
  for a prior `rearm` under the same id. Evidence: `triage-gate.md:41-49`;
  `review-provider.mjs:437-445` (`--trigger` already written when passed);
  `self-verify.mjs:305`. Measured 2026-08-14: 6/54 provider events carry
  `trigger`, all from 2026-08-14; one corr (`3-d558479`) holds 7 provider
  events against 3 adjudications, so corr alone cannot separate fires.
- D-03 (suggest): The re-arm veto in `trace suggest` R1 is FIRE-scoped - a
  re-arm suppresses only the fire it belongs to - not the lifetime set built
  today at `lib/trace-suggest.mjs:129-131`. `.planning/trace.jsonl` is never
  archived or pruned, so a lifetime veto spans four cycles in one file and is
  permanent by construction: a re-arm from a past cycle keeps muting a gate
  that has since stopped finding anything. User-decided over two alternatives
  (lifetime veto + floor 1; last-N window - the window measured emits nothing
  for any trigger today).
- D-04 (suggest): A re-arm round's adjudication normalizes to its BASE trigger
  token (`risk_surface`) with a rearm marker on the parsed row, and BOTH
  on-disk spellings (`rearm:`, `re-arm:`) are admitted - never a trigger of
  its own, which would mint the phantom config key
  `review.triggers.risk_surface rearm.gate` and fail
  `trace-suggest.test.mjs:277-292` against `config.schema.json:70-82`.
  Evidence: both spellings live on disk (corr `3-d558479` and `1-7502567`);
  `trace-suggest.test.mjs:84-90` pins both as unparseable by design and must
  be re-pointed.
- D-05 (render shape): The role mismatch reports as a NEW top-level array on
  the render (the shape `unpaired` already has); the `roles` map's keys and
  values are frozen. Four tests deep-equal `roles` whole
  (`trace.test.mjs:686-698`, `:705`, `:719`, `:1044`) and two prose renderers
  iterate its rows expecting exactly `dispatches`/`tokens`/`unrecorded`
  (`workflows/progress.md:97-106`, `workflows/report.md:44-50`). Measured
  2026-08-14: 0 mismatches across 88 live paired brackets, so the report
  raises no false alarm on existing history.

## Decisions

- D-06 (correlation): The read-time repair deliberately re-baselines the
  committed fixture's pinned render (`trace.test.mjs:1037-1054`, "renders
  exactly as it did before this phase"). Simulated 2026-08-14 on both corpora:
  every `roles` figure is byte-identical before and after; the only change is
  which bracket surfaces as `unpaired` (`1/cad-reviewer@12:24:57.907Z` becomes
  `1-573f325/cad-reviewer@13:51:44.001Z`), because the pre- and post-anchor
  worker-key namespaces merge.
- D-07 (accounting): AC2's accounting half already shipped - commit `f536040`
  bills a terminal to its matched dispatch's role, pinned by
  `trace.test.mjs:686-698` - so this phase adds only the REPORT of a mismatch.
  Probed at HEAD 2026-08-14: a mismatched close is absorbed silently and
  reported nowhere; the CAPTURE.md phase-4 item describing
  `cad-reviewer:{dispatches:0,tokens:500}` is stale, pre-`f536040`.
- D-08 (accounting): AC3 requires a terminal-identity discriminator - the
  `funded` flag does not close the replay hole when the duplicate lands on a
  worker key that still has a pending dispatch (`trace.mjs:514-539`, FIFO
  `pending.shift()`). Probed at HEAD 2026-08-14: 2 dispatches + 1 genuine
  return + its replay renders `{dispatches:2,tokens:200}`, `unpaired: []`, no
  `unrecorded`. The existing regression test (`trace.test.mjs:708-721`)
  exercises only the empty-queue path.
- D-09 (suggest): AC4's live-corpus demonstration is a recorded measurement or
  live lines quoted as string literals in a test - never a committed test
  reading `.planning/trace.jsonl`, which is gitignored (`.gitignore:29`) and
  absent in CI. Precedent: `trace-suggest.test.mjs:63-81` quotes live lines
  verbatim.
- D-10 (reads): `topFiles`/`fileRedundancy`/`fileCalls` resolve keep-and-wire,
  not delete - decided 2026-08-14 in `.planning/CAPTURE.md:4`, tied to phase
  4's read-instrumentation join. Deleting them removes the file-half
  measurement phase 4 is scheduled to join to fires. Evidence:
  `lib/read-trace.mjs:292-373`; `read-trace.test.mjs:424-440`.
- D-11 (reads): The reader is prose - a `planning.mjs reads` call added to
  `/cad-report` and/or `/cad-suggest` - not a rule inside
  `lib/trace-suggest.mjs`, whose stated contract (`:1-6`) is no I/O, every
  rule a pure function over the render. Measured 2026-08-14: the entire
  `reads` subcommand (`planning.mjs:2536-2560`) has zero consumers today.

## Acceptance criteria

- [ ] AC1: A bare-corr event written before its phase's `lifecycle/phase_start`
      renders joined to that phase's `<phase>-<sha>` corr, proved by a test
      that fails on the pre-fix reader; the committed fixture's every `roles`
      figure is byte-identical before and after the re-baseline.
- [ ] AC2: Closing a dispatch with a terminal whose `--role` differs from the
      dispatch's renders a mismatch entry in a new top-level render array; the
      `roles` map's keys and values are unchanged, no zero-dispatch role
      carries a token total, and the four existing `roles` deep-equal tests
      stay green.
- [ ] AC3: Two dispatches on one worker key, closed by one genuine
      `return --tokens N` plus a replay of that same close, render
      `unrecorded: 1` rather than double-funding - asserted by a test that
      fails on the pre-fix FIFO pairing.
- [ ] AC4: `trace suggest` run over the live corpus emits at least one R1
      suggestion under the fire-scoped veto, and the demonstration (the input
      lines and the emitted suggestion) is recorded in the phase record as
      quoted literals or a recorded measurement - never a committed test
      reading the gitignored `.planning/trace.jsonl`.
- [ ] AC5: `parseAdjudication` admits both on-disk re-arm spellings
      (`risk_surface rearm:`, `risk_surface re-arm:`), normalized to base
      trigger `risk_surface` with a rearm marker; the phantom-config-key
      schema test stays green and the two pinned-unparseable rows are
      re-pointed - one test row per spelling.
- [ ] AC6: `topFiles` / `fileRedundancy` / `fileCalls` reach a reader: a
      `/cad-report` or `/cad-suggest` workflow step calls
      `planning.mjs reads` and renders those fields by name.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` passes and
      `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`
      and no `budget-overrun`.

## Flagged assumptions

- The AC3 discriminator mechanism is the planner's call with the trade-off
  stated: dedupe on an identical `(ts, event, tokens, plan)` tuple (no writer
  change, but a genuine same-millisecond close is discarded) vs. a
  per-dispatch id the close quotes (exact, but a new required field on six
  prose close sites - the same six phase 4's `trace close` subcommand will
  absorb, so the choice should not fight that seam).
- The fire-scoped veto's arithmetic clearing R1's floor of 2 on the live
  corpus is unproven until AC4's demonstration runs: measured 2026-08-14,
  fire-scoping alone leaves `risk_surface` at 1 unvetoed zero fire; admitting
  the `re-arm:` spelling (AC5) adds a third zero-survivor fire. If the
  combined arithmetic still emits nothing, `MIN_FIRES_FOR_GATE_SUGGESTION`
  (`lib/trace-suggest.mjs:30`) is the remaining lever and moving it is in
  scope for AC4.
- Which of `/cad-report` vs `/cad-suggest` gets the `reads` call (or both) is
  the planner's call; D-11 fixes only that it is a prose-level seam call.
- 44 of 54 historical provider events carry no `trigger` field, so the
  fire-level provider join (D-02) is total only going forward; historical
  events remain attributable to their phase, not their fire. Accepted - the
  writer never mints what it did not record.
