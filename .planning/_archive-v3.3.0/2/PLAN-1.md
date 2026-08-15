---
phase: 2
plan: 1
requirements: [TRC-01]
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/trace.test.mjs
---

# Phase 2: The run record joins - Plan 1

## Goal

The joined run record answers correctly about itself at read time: every event
resolves to the fire that produced it, a bracket closed under the wrong role is
reported rather than absorbed, and a replayed terminal cannot fund a dispatch
that never came back.

## Must be true when done

- A `lifecycle`, `routing`, `provider` or `outcome` event written before its
  phase's `lifecycle/phase_start` renders under that phase's `<phase>-<sha>`
  correlation id instead of the bare `<phase>` form, and the file on disk is
  unchanged by the repair.
- The committed fixture's `roles` figures are byte-identical to what they are
  today; the only rendered difference is which bracket surfaces as `unpaired`.
- Closing a dispatch with a terminal naming a different `--role` produces a
  visible entry in a top-level `mismatched` array on the render and through
  `planning.mjs trace render`, while the `roles` map's keys and values stay
  exactly as they are.
- Two dispatches on one worker key, closed by one genuine terminal plus a byte
  identical replay of it, render `unrecorded: 1` - the replay funds nothing and
  adds no tokens.
- `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface` and no
  `budget-overrun`.

## Context

- D-01: the pre-anchor gap closes at READ time only. The writer's
  "never mints an id" contract (`lib/trace.mjs` header, DERIVED id) and
  `correlationId`'s own derivation stay untouched, and no line on disk is
  rewritten - a writer-side fix strands the 51 live and 17 fixture events
  already written, and a file rewrite breaks the append-only contract.
- D-02: `corr` stays PHASE-scoped. The fire a provider call belongs to is
  carried by that event's own `trigger` field, which `review-provider.mjs`
  already writes when the caller names one. Do not make `corr` fire-scoped:
  `references/triage-gate.md` caps the blocking re-arm at one round by looking
  for a prior `rearm` under the same id, and a per-fire id hands every fire a
  fresh round.
- D-05: the mismatch is a NEW top-level array; the `roles` map's keys and
  values are FROZEN. Four tests deep-equal `roles` whole and two prose
  renderers (`workflows/progress.md`, `workflows/report.md`) iterate its rows
  expecting exactly `dispatches`/`tokens`/`unrecorded`.
- D-07: the accounting half of the role mismatch already shipped (a terminal is
  billed to its matched dispatch's role). This plan adds the REPORT only.
- Out of scope here: phase 4's `trace close` subcommand, the bounded `trace
  render` default, and the reads/report wiring (PLAN-3).

## Tasks

### Task 1: Attribute a pre-anchor event to its phase's next anchor at read time

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/trace.test.mjs
- **Action:** In `renderTrace` (`cadence-core/bin/lib/trace.mjs`), an event whose
  `corr` equals the bare phase form is attributed to the FIRST
  `lifecycle/phase_start` for its own phase at or after its position in the
  file, taking that anchor's `<phase>-<sha>` id. The repaired id is what the
  rendered event object carries, what the `(corr, phase, plan)` worker key pairs
  on, and what an `unpaired` row reports; an event whose `corr` is already the
  derived form is untouched, and an event with no later anchor for its phase
  keeps the bare form (a head-truncated read over `MAX_TRACE_BYTES` is exactly
  that case). Nothing is written back to the file and `appendEvent`,
  `renderEvent` and `correlationId` keep their current behaviour - `correlationId`
  still scans BACKWARD for the newest anchor, which is what a WRITER needs and is
  the opposite direction from this read-time repair, so state that difference in a
  comment where the repair lives. Then re-baseline the pinned fixture render at
  the `fixture: the committed verbatim trace renders exactly as it did before this
  phase` test: measured 2026-08-14, all five `roles` rows are byte-identical and
  the single `unpaired` entry changes from
  `{corr:'1', ts:'2026-08-12T12:24:57.907Z'}` to
  `{corr:'1-573f325', ts:'2026-08-12T13:51:44.001Z'}` (same `phase:'1'`,
  `plan:'cad-reviewer'`), because the pre- and post-anchor worker-key namespaces
  merge (D-06). Do not adjust any `roles` figure to make the test pass - a
  changed figure means the repair changed accounting, which it must not.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes, including a
  new test that appends a routing event and THEN a `phase_start` with a sha for
  the same phase and asserts the routing event renders under `<phase>-<sha>`;
  that test fails against the pre-fix reader (confirm by reverting the reader
  change locally or by asserting the pre-fix bare value is absent), and the
  fixture test's `roles` block is unchanged from the values on `main`.

### Task 2: Report a bracket closed under a different role

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/trace.test.mjs
- **Action:** `renderTrace` gains a top-level `mismatched` array, always present
  in the returned object exactly as `unpaired` is, carrying one entry per paired
  bracket whose terminal event named a non-empty `role` that differs from the
  role on the dispatch it closed: `{corr, phase, plan, ts, event, dispatched,
  closed}`, where `ts` and `event` are the TERMINAL's, `dispatched` is the
  dispatch's role and `closed` is the terminal's. A terminal that carries no
  `role` at all is NOT a mismatch - an omitted flag is already visible as an
  unkeyed row and calling it a mismatch would raise a false alarm on existing
  history (measured 2026-08-14: 0 mismatches across 88 live paired brackets).
  Change no accounting: the terminal is still billed to the matched dispatch's
  role, `recorded`/`figures`/`unrecorded` are computed exactly as they are now,
  and the `roles` map's keys and values do not move (D-05). Update the
  `TraceRender` typedef, and relay the array in `cmdTrace`'s `render` arm in
  `cadence-core/bin/planning.mjs` using the omit-when-empty shape `roles` and
  `coordinator` already use there, so a clean trace's envelope is byte-identical
  to today's.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with a new
  test where a `cad-executor` dispatch is closed by a `return --role
  cad-reviewer --tokens 500`: `roles` deep-equals
  `{'cad-executor': {dispatches: 1, tokens: 500}}` (the existing pin at the
  `a terminal is billed to the role that DISPATCHED` test), `mismatched` has one
  entry naming both roles, and `trace render` through the CLI shows `mismatched`
  for that trace and omits the key entirely for a trace with no mismatch.

### Task 3: Make a replayed terminal unable to fund a second dispatch

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/trace.test.mjs
- **Action:** In `renderTrace`, a TERMINAL event (one of `TERMINAL`) that
  repeats an earlier terminal's full identity tuple - same `corr` (after task
  1's repair), `phase`, `plan`, `event` name, `role`, `ts` and `tokens` - is a
  REPLAY: it pairs with no pending dispatch, funds nothing, contributes no
  tokens and no `figures`, and opens no coordinator span. A second close
  differing only in `role` is NOT a replay - it pairs normally and surfaces
  through task 2's `mismatched` report, while a byte-identical replay carries
  the same role, so replay detection loses nothing. It still lands in `out.events` and
  in `counts`, because the render reports the file rather than editing it.
  Apply this to terminals only - a duplicated DISPATCH is a different hazard and
  is out of scope here. This closes the hole D-08 probed: with two dispatches on
  ONE worker key the `funded` flag does not help, because the FIFO
  `pending.shift()` hands the replay a second, genuinely open dispatch and marks
  it funded. State the accepted cost in the comment: two genuinely distinct
  closes that share worker key, event name, role, token figure AND millisecond
  are indistinguishable from a replay and the second is dropped. Do not introduce a
  per-dispatch id quoted by the close - that is a writer-contract change across
  the six prose close sites phase 4's `trace close` subcommand will absorb, and
  this plan must not fight that seam. The existing `a duplicated terminal cannot
  fund a second dispatch` test uses two DIFFERENT event names (`return` then
  `checkpoint`), so it is not a replay under this rule and its assertions must
  stay exactly as they are.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes, including a new
  test that appends two `dispatch` events with the same `plan` and role, one
  `return` with `tokens`, then the identical `return` again (pass an explicit
  `ts` to both closes so the tuple is deterministic), and asserts the render
  shows `unrecorded: 1`, the token total counted once, and the second dispatch
  in `unpaired`. Then `node cadence-core/bin/self-verify.mjs` reports no
  `unbudgeted-surface` and no `budget-overrun`.

## Notes

- The `mismatched` key name is fixed HERE and is quoted by PLAN-3, which wires
  it into `/cad-report`'s record-health line. Renaming it means editing PLAN-3's
  prose task in the same change.
- Measured 2026-08-14 before planning, on the committed fixture at phase `1`:
  the read-time repair leaves `cad-assumptions-analyzer` 1/75100,
  `cad-planner` 1/93882, `cad-reviewer` 4/297506 + unrecorded 1,
  `cad-executor` 2/423846 and `cad-verifier` 1/78371 unchanged, and moves the
  one `unpaired` row as described in task 1. 17 of the fixture's events carry
  the bare form today.
