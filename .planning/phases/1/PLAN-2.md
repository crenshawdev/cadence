---
phase: 1
plan: 2
requirements:
  - TRC-10
files:
  - cadence-core/bin/planning/core.mjs
  - cadence-core/bin/planning/reads.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/planning-trace-ignore.test.mjs
  - .gitignore
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
---

# Phase 1: reads.jsonl rotates instead of dying at the cap - Plan 2

**RUNS AFTER PLAN 1 AND BEFORE PLAN 3 - not in parallel with either.** The
running order for this phase is PLAN 1, then PLAN 2, then PLAN 3. Plan 1
establishes the five exports this plan imports from
`cadence-core/bin/lib/read-trace.mjs` - `ROTATED_READS_FILE`,
`READS_CLAIM_FILE`, `rotatedReadsPath`, `READS_ROTATION` and
`isReadsRotationMarker` - and writes the marker this plan filters and reports.
Plan 1 and plan 2 share no declared file, so their commits do not collide, but
this one cannot be executed or verified before plan 1 has landed. Plan 3 does
share a declared file with this one, `cadence-core/bin/trace-suggest.test.mjs`,
and its prose points at the envelope key task 2 below adds, so plan 3 runs after
this plan has landed and never beside it.

## Goal

A reader of `.planning/reads.jsonl` can tell a record that was cut from a whole
one instead of reading a shortened file as complete, the rotation marker is
never billed as a tool call, and neither the cut record nor its residue is left
for the next `git add .planning` to sweep in.

## Must be true when done

- Running `planning.mjs reads` and `planning.mjs trace suggest` against a
  rotated record, each envelope names `.planning/reads.jsonl` as a record it
  read and states that a reads rotation happened, on a key that is not the
  top-level `rotated` the trace's own cut already uses.
- On that same rotated record, the rotation marker is counted in none of
  `calls`, `byAgent`, or the unresolved/coordinator split: the figures are
  exactly what they would be if the marker were not on disk.
- Running `planning.mjs trace ignore --root .` on a project covered only for the
  trace reports it half-covered and then writes rules covering the LIVE reads
  record, its rotated sibling and its claim files, and a re-run adds nothing and
  changes no byte.
- This repository's own `.gitignore` covers the reads sibling and its claim
  files beside the live record line it already carries, so the first rotation
  here leaves nothing for `git add .planning` to sweep in.

## Context

D-04 locks the signal onto a key DISTINCT from the existing `rotated`, because
`rotated` on `trace suggest` already means the TRACE rotated and
`workflows/suggest.md:29-30` ties it to that record specifically. The planner's
call on which channel carries it (flagged in CONTEXT) is resolved here as a
nested `reads` object on both envelopes rather than a new top-level key or a
`warnings[]` entry - see the Notes.
D-08 fixes the shape of the reader side: `readReadsRecords`
(`planning/core.mjs:325-360`) is the ONE parse both readers go through, and no
prose surface opens the record itself.
D-09 is why a filter is owed at all: `summarizeReads` counts any object into
`calls` and bills `r.agent || 'coordinator'` into `byAgent`, and `joinReads`
pushes `unresolved` for a record with no `agent`.
D-11 names the missing ignore rule. Out of scope: the rotation itself (plan 1),
every prose correction D-10 names - R7's evidence string and the two workflows -
which is plan 3, any ignore rule for the TRACE's `.rotate` and `.evict` temps
(CONTEXT defers those explicitly), and any new flag on either subcommand.

## Tasks

### Task 1: The one parse drops the marker and reports the cut

- **Files:** cadence-core/bin/planning/core.mjs
- **Action:** Start reading at `readReadsRecords` and at the `READS_FILE` import
  above it. `readReadsRecords` is the single line parse both readers reach the
  record through, so the marker is filtered and the cut is reported here rather
  than in either caller. Import `isReadsRotationMarker` beside the existing
  `READS_FILE` import from `../lib/read-trace.mjs`. As each line parses, a
  record the predicate accepts is kept OUT of the returned `records` array and
  its file name and timestamp are remembered instead; the function's return
  gains a field carrying that, present only where a marker was seen, so a record
  that never rotated returns exactly what it returns today. Keep the existing
  three-status contract and the partial-tail rule untouched: `absent` and
  `unreadable` are still handed back separately and decide nothing, because the
  two callers take deliberately different postures on them.

  Doing this here and not in `summarizeReads` or `joinReads` is the point. Those
  two are pure folds over records a caller supplies, `inDispatchReads` folds off
  `joinReads`'s rows, and filtering in three places is three places for the
  filter to drift; the parse is the seam every reader already crosses.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes with
  a new row that writes a `.planning/reads.jsonl` whose first line is a rotation
  marker and whose remaining lines are ordinary `Read` records under a named
  agent, runs `planning.mjs --dir <dir> reads`, and shows `calls` equal to the
  count of ordinary records alone, `byAgent` carrying no entry the marker would
  have created, and `topTargets` naming no sibling file. Deleting the filter and
  re-running the row shows `calls` one higher.

### Task 2: Both reader envelopes name the record and state the cut

- **Files:** cadence-core/bin/planning/reads.mjs, cadence-core/bin/planning/trace.mjs, cadence-core/bin/trace-suggest.test.mjs
- **Action:** Start reading at `cmdReads` and at the `trace suggest` arm's
  `readReadsRecords` call. Ride the two facts task 1 now returns onto both envelopes, under
  ONE nested key spelled `reads`, carrying the record's path and - only where a
  marker was seen - the rotation. A nested object rather than two top-level
  keys, because `trace suggest`'s envelope already spends `file` on the TRACE
  path and `rotated` on the trace's own cut: a second `rotated` at top level
  would make one key mean two records and would silently falsify
  `workflows/suggest.md:29-30`, which ties `rotated` to the trace's size-bound
  cut. One shape on both envelopes so a later reader has no special case to
  learn.

  In `cmdReads`, the key rides every `ok` arm including the early
  `no reads recorded yet` return, because the command is being asked which
  record it read and an absent record is still a named path. Do not disturb the
  existing arms otherwise: the `--join` keys must still ride only under the
  flag, the `unreadable` arm must still fail loudly, and the shared half of the
  envelope must stay identical between a flagged and an unflagged call -
  `read-trace.test.mjs:630-641` asserts that equality and this plan may not
  edit that file.

  In the `trace suggest` arm, source the key from the `readReadsRecords` result
  the arm already holds at `:898`, so the two can never name different files.
  The existing `warnings[]` entry for an unreadable reads record stays exactly
  as it is - it reports a different fact, and moving it would change the channel
  `workflows/suggest.md:52-55` already dedicates to it.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes with
  a new row in the shape of the existing both-faces row at `:1110`: one planning
  root holding a `trace.jsonl` that never rotated and a `reads.jsonl` whose
  first line is a rotation marker, run through `planning.mjs reads --join` AND
  `planning.mjs trace suggest`. Both envelopes carry a `reads` object naming the
  reads record and reporting the rotation; `trace suggest`'s top-level `rotated`
  is ABSENT, proving the two records' cuts are not the same key; and on the
  `reads --join` return `unresolved` is 0 and `coordinator` counts only the
  ordinary coordinator records, proving the marker reached neither side of that
  split. A second row shows a planning root with no reads record at all still
  returns `no reads recorded yet` with a `reads` object naming the path and no
  rotation on it.

### Task 3: An ignore rule covers the reads record, its sibling and its claim files

- **Files:** cadence-core/bin/planning/trace.mjs, cadence-core/bin/planning-trace-ignore.test.mjs, .gitignore
- **Action:** Start reading at `cmdTraceIgnore` and at the `TRACE_IGNORE_LINE`
  and `ROTATED_IGNORE_LINE` constants above it. Nothing Cadence ships writes an
  ignore rule for this record or its
  residue, so on a scaffolded project the live record is untracked and unignored
  today and the first rotation adds up to 8 MiB more of local diagnostics beside
  it, all of it there for the next `git add .planning` to sweep in - exactly what
  `TRACE_IGNORE_LINE` and `ROTATED_IGNORE_LINE` exist to prevent for the trace,
  one filename over (D-11). Extend `trace ignore`, which is the only ignore
  writer in the tree, with FOUR rules in one block: the live reads record, its
  rotated sibling, the shared claim sidecar, and the private stamps a killed
  rotation strands beside it. Derive each basename from `READS_FILE`,
  `ROTATED_READS_FILE` and `READS_CLAIM_FILE` imported from
  `../lib/read-trace.mjs`, beside the existing `inDispatchReads`/`joinReads`
  import at `:33`, so the rules and the files the writer actually produces
  cannot drift apart - the reason `:76` derives `ROTATED_IGNORE_LINE` from
  `ROTATED_TRACE_FILE`. Write a comment above the block naming what it is, the
  way both existing rules carry one.

  Ask about each new rule through the same two readers the sibling's rule
  already uses - git's own `check-ignore` answer first, the literal
  `.gitignore` scan only where git could not answer - and fold the results into
  the existing `ignored` field, because a project covered for the trace and not
  for the reads record and its residue is the same half-covered state
  `/cad-health` has to report rather than pass over, and
  `skills/cad-health/SKILL.md:28-38` already turns `ignored:false` into "run the
  same command without `--check`". Report the new rules on a field of their own
  beside `line` and `rotated_line`. Do NOT touch `line` or `rotated_line`
  themselves: `line` is what `/cad-health` reports and what `traceTracked`
  passes to `ls-files --error-unmatch` as a pathspec.
  Only what is MISSING is added, so a project scaffolded before this existed is
  upgraded on its next non-`--check` run without its existing rules being
  written twice, and every existing byte of a brownfield `.gitignore` survives.

  Write nothing for the TRACE's own `.rotate` and `.evict` temps - CONTEXT
  defers those deliberately as the trace's residue.

  Then bring THIS repository's `.gitignore` to the same coverage, under the
  existing block at `:28-36` that already carries the trace's record, sibling
  and claim lines and the live reads record by hand, in that block's own
  root-anchored spelling. The live reads line is already there at `:36`, so only
  the sibling and the two claim lines are added and no existing line is written
  twice: this repo's own reads record measured 93% full on 2026-08-28, so it
  will rotate, and the sweep the residue would feed is the same one.
- **Verify:** `node --test cadence-core/bin/planning-trace-ignore.test.mjs`
  passes with new rows showing: a fresh repo with no `.gitignore` gets all four
  reads rules written and reported; a repo carrying only the two trace rules
  reports `ignored:false` under `--check` with nothing written, and is upgraded
  by the same command without `--check`, adding only the missing lines; a repo
  carrying the two trace rules AND a live reads line gains only the remaining
  three; a re-run after any of those adds no second line and changes no byte;
  and the reads rules name the files the writer actually produces, asserted
  against `readsPath`, `rotatedReadsPath` and `READS_CLAIM_FILE` rather than
  against copied strings. In a fresh repo where the command has run,
  `git check-ignore -v .planning/reads.jsonl` and
  `git check-ignore -v .planning/reads.1.jsonl` both name that repo's
  `.gitignore` as the source. `git check-ignore -v .planning/reads.1.jsonl`
  inside THIS repository names `.gitignore` as the source.

## Notes

- Which channel carries the signal was flagged in CONTEXT as the planner's call.
  Resolved as a single nested `reads` object on both envelopes. A new TOP-LEVEL
  key was rejected because `trace suggest` already spends `file` on the trace
  path, so the reads record's own name would need a second, differently spelled
  top-level field on one envelope and not the other. `warnings[]` was rejected
  because that channel means a partial or failed read that degraded the answer,
  and a rotation degraded nothing - it is a fact about the record's span, and
  `/cad-report` and `/cad-suggest` would then have to present a routine cut as a
  warning.
- The rotation marker is filtered at the parse rather than made inert by
  construction the way the trace's is (`lib/trace.mjs:276-280`). It cannot be
  inert here: `summarizeReads` counts any object at all, so there is no shape a
  line in this record can take that the folds ignore on their own.
- The running order for the phase is PLAN 1, then PLAN 2, then PLAN 3. Plans 1
  and 2 share no declared file but plan 2 imports symbols plan 1 creates; plans
  2 and 3 share `cadence-core/bin/trace-suggest.test.mjs` outright and plan 3's
  prose names the envelope key task 2 adds. None of the three may be dispatched
  in parallel with another.
- `self-verify.test.mjs`, `trace.test.mjs`, `planning-lease-check.test.mjs` and
  `phase-spelling.test.mjs` are declared because the census registry names each
  of them at risk for work under `cadence-core/bin/planning/` - the `mergeLayers`
  callsite census, the four refusing trace flags' one-sentence-each count, the 14
  error-detail sites with the 6 wrapped in `redactUrl`, and the 21
  phase-argument callsites. No task here is expected to move any of the four
  counts; declaring them is what lets the executor re-pin one in the same commit
  if it does, instead of amending the lease mid-run. None of the four may be
  edited for any other reason.
