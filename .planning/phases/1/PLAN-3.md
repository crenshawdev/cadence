---
phase: 1
plan: 3
requirements:
  - TRC-10
files:
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/workflows/report.md
  - cadence-core/workflows/suggest.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: reads.jsonl rotates instead of dying at the cap - Plan 3

**RUNS AFTER PLAN 2 - not in parallel with it.** The running order for this
phase is PLAN 1, then PLAN 2, then PLAN 3, each after the one before it has
landed. Plan 3 declares `cadence-core/bin/trace-suggest.test.mjs`, which plan 2
also declares, so the two SHARE a file and their commits would collide if they
ran together. Plan 3 also depends on plan 2's result: every correction here
points the reader at the nested `reads` envelope key plan 2's task 2 adds to the
`planning.mjs reads` and `trace suggest` returns, and that key does not exist
until plan 2 has landed.

## Goal

The three shipped surfaces that promise `.planning/reads.jsonl` is never
shortened stop promising it, each says instead what does shorten it and where a
reader learns whether it happened on this run, and each correction is pinned by
a test that reddens when the new wording is deleted.

## Must be true when done

- `trace suggest`'s R7 evidence string no longer concludes that an unscoped run
  reaches every milestone in the reads record. It states that a milestone close
  still prunes nothing AND that the record is cut at its size bound, and points
  at the envelope key for whether this run's record was cut.
- `workflows/suggest.md`'s `scope` step no longer says nothing ever shortens the
  reads record, and its `read_record` step names the new envelope key beside the
  keys the return already carries.
- `workflows/report.md`'s reading rule no longer says `fileCalls`,
  `fileRedundancy` and `topFiles` span every dispatch the project ever recorded,
  its Reading line relays a cut when the return reports one, and its seam-call
  description names the new key.
- Deleting any one of those corrections reddens a named row in
  `trace-suggest.test.mjs` or `prose-agreement.test.mjs`, and restoring it
  greens the same row.

## Context

D-10 names the three shipped surfaces the cut falsifies, two of them already
pinned by tests: `lib/trace-suggest.mjs:672` builds R7's evidence string
asserted verbatim at `trace-suggest.test.mjs:932`, `workflows/suggest.md:32-34`
says "nothing prunes it at a close either", and `workflows/report.md:203-205`'s
span claim is asserted at `prose-agreement.test.mjs:2448-2468`.
D-04 is why the key these surfaces point at is spelled apart from the existing
`rotated`: `rotated` on `trace suggest` already means the TRACE rotated and
`workflows/suggest.md:29-30` ties it to that record specifically. Plan 2
resolved that channel as a nested `reads` object on both envelopes.
D-08 is why no correction here opens the record: `readReadsRecords` is the one
parse both readers go through and `workflows/suggest.md:56-58` instructs readers
to open neither record - that instruction stands.
Out of scope: the rotation itself (plan 1), the parse filter and the envelope
keys (plan 2), the `.gitignore` rules and the `trace ignore` writer (plan 2's
task 3), and any new flag on either subcommand.

## Tasks

### Task 1: R7 stops arguing off a record it calls unshortenable

- **Files:** cadence-core/bin/lib/trace-suggest.mjs, cadence-core/bin/trace-suggest.test.mjs
- **Action:** Start reading at the R7 entry's `evidence` string, at its `SCOPE:`
  clause. R7's evidence string tells the reader
  "nothing prunes `.planning/reads.jsonl` at a milestone close, so an unscoped
  run reaches every milestone still in that file". The first clause stays true;
  the conclusion does not, because the record is now cut at its size bound.
  Rewrite the SCOPE clause so it states both: a close prunes nothing, and the
  one thing that shortens the record is the cut at its size bound, so an
  unscoped run reaches every milestone still in the LIVE record and the reader
  is pointed at the nested `reads` envelope key plan 2's task 2 added for
  whether that happened.

  Change nothing else about the entry. It stays `kind: 'info'` with a null
  `action` and names no config key - `trace-suggest.test.mjs:942` pins that and
  `workflows/suggest.md`'s ask step builds `/cad-config` tokens out of `action`
  plus `proposed`. Do NOT give `suggestFromRender` a new argument or plumb the
  rotation flag into it: the wording above is true of the record whether or not
  this particular one was cut, the envelope is where the per-run answer lives,
  and a signature change here reaches three callers for nothing.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes with
  the assertion at `:932` updated to the new wording and a second assertion
  beside it that the string no longer contains the old conclusion that an
  unscoped run reaches every milestone in that file. Deleting the new clause
  from `lib/trace-suggest.mjs` reddens that row by name.

### Task 2: The two workflows stop promising the record is never shortened

- **Files:** cadence-core/workflows/report.md, cadence-core/workflows/suggest.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Start reading at `report.md`'s Reading line in its shape block, at
  the reading rule that opens "The reading line prices", and at `suggest.md`'s
  `scope` and `read_record` steps. Three claims are now false and each is written down in prose that
  no executor reads, so each is corrected at its own site and pinned.

  `report.md`'s reading rule says `fileCalls`, `fileRedundancy` and `topFiles`
  "span every dispatch the project ever recorded". They span every dispatch
  still in the LIVE record: at the size bound the record is cut and the older
  generation moves to the sibling. Say that, and say the nested `reads` envelope
  key plan 2's task 2 added is how the composer knows a cut happened for this
  run. The Reading line
  in the shape block gains the relay: where the return reports a reads rotation,
  the line states the record was cut and that everything older than the cut is
  in the sibling and is not in this report - the same distinction the Record
  health line already draws for the trace between a cut and a truncation. Keep
  every token the existing pin asserts: `inDispatch.roles`,
  `inDispatch.coverage` and `inDispatch.coordinatorFiles` on the Reading line,
  and `coordinatorFiles`, "no worker bracket by construction",
  `inDispatch.coverage`, "denominator the ratio was actually computed over",
  "NULL `ratio`" and "never narrate the null as `0`" in the rule. The seam-call
  description near `:62` gains the new key in its list of what the `reads`
  return carries, so a composer is not told to read a field the description does
  not name.

  `suggest.md`'s scope step says of the reads record "nothing prunes it at a
  close either". Correct it the same way and in the same terms the step already
  uses two paragraphs above for the trace, where it says the one thing that ever
  shortens the record is the cut at its size bound. The `read_record` step's
  list of what the return carries gains the new key beside `capped`, `rotated`,
  `malformed` and `warnings`, and the instruction to open NEITHER record stands
  unchanged - the seam is still the only reader.

  Do not widen either edit. The reads record's rotation is a different key from
  the trace's `rotated` and the sentences about the trace stay exactly as they
  are.

  `cadence-core/bin/weight-budgets.json` holds a UTF-8 byte ceiling per budgeted
  prose surface and `self-verify.mjs`'s budget check is what asserts it, so a
  correction that pushes either workflow past its own ceiling turns that check
  red in this same commit. Spend the correction inside the existing ceilings
  where the wording allows it; where it does not, raise ONLY the key for the
  surface that grew, by the bytes that surface actually gained, and leave every
  other key in that file untouched.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes,
  with the existing RDX-01 report.md row extended to assert the corrected span
  claim rather than the old one, and a NEW row over `suggest.md`'s `scope` step
  - sliced with the same `stepBody` helper the file's suggest.md row already
  uses, and whitespace-flattened before matching - asserting the step no longer
  claims the reads record is never shortened and does name what shortens it.
  Both new assertions falsified in both directions: delete the clause from the
  workflow, watch the named row fail, restore it, watch it pass.
  `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun` for either
  workflow.

## Notes

- The running order for the phase is PLAN 1, then PLAN 2, then PLAN 3. Plans 1
  and 2 share no declared file but plan 2 imports symbols plan 1 creates; plans
  2 and 3 share `cadence-core/bin/trace-suggest.test.mjs` outright and plan 3's
  prose names an envelope key plan 2 adds. None of the three may be dispatched
  in parallel with another.
- `cadence-core/bin/weight-budgets.json` is declared because the census registry
  names it at risk for any edit under `cadence-core/workflows/` - it is the one
  census every prose-editing plan in this repository invalidates. Declaring it
  is what lets task 2 re-pin the ceiling in the same commit that moves it,
  rather than amending the lease mid-run.
- Which channel carries the rotation signal was the planner's call under D-04
  and plan 2 resolved it as a single nested `reads` object on both envelopes.
  This plan does not reopen that choice; it spells the key the same way on all
  three prose surfaces so a reader learns one shape.
