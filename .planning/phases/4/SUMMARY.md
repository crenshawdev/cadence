---
phase: 4
status: complete
completed: 2026-08-26
---

# Phase 4: Keep the record writable - Summary

`.planning/trace.jsonl` rotates at `MAX_TRACE_BYTES` instead of refusing every
append forever, the rotation is named on both reader envelopes, the rotated
sibling stays out of git, and two writers racing the bound produce one rotation
and lose no events.

## What shipped

- Rotation at the bound - `appendEvent` rotates rather than returning
  `size-cap`; the trigger is "this line would reach the bound", and a single
  line larger than the bound is refused as `oversized-event` instead of
  write-deading the record (`cadence-core/bin/lib/trace.mjs`)
- The rotation on both reader envelopes - a `record_rotated` marker written as
  the fresh record's last line, carrying the anchor's `corr`/`phase`;
  `renderTrace.rotated` is detected ahead of the `--phase` filter and emitted
  only where a marker exists, so a record that never rotated renders
  byte-identically (`cadence-core/bin/lib/trace.mjs`)
- The rotated generation kept out of git - `.gitignore:31` covers
  `/.planning/trace.1.jsonl`; `cmdTraceIgnore` reads and writes both literals
  with the sibling's basename derived from `lib/trace.mjs`, and reports
  `ignored` true only when both travel (`cadence-core/bin/planning/trace.mjs`)
- One rotation under a race - a create-exclusive `linkSync` claim, an inode
  discriminator separating an in-flight claim from a stale generation, a
  re-stat guard that refuses a stale-stat writer before the rename rather than
  detecting damage after it, and a sibling-delta recovery so the writer that
  lost the claim still keeps its event (`cadence-core/bin/lib/trace.mjs`)
- The retention rule stated where its readers are - `/cad-progress`,
  `/cad-report` and `/cad-suggest` each print the rotation beside `capped` and
  say where the dropped events went (`cadence-core/workflows/{progress,report,suggest}.md`)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | d2021f19 | Rotate the run record at its bound instead of refusing |
| 1 | 2 | 6c92cedb | Say on both reader envelopes that the record rotated |
| 1 | 3 | 5906d331 | Keep the rotated generation out of git |
| 1 | 4 | be7572c2 | Refuse the rotation claim two writers cannot both hold |
| 1 | 5 | a9a50fdd | State the retention rule where the record's readers are |

## Deviations

None - plans executed as written.

## Open items

- `.planning/reads.jsonl` still write-deads exactly as the trace did:
  `lib/read-trace.mjs:282` refuses with `reason: 'size-cap'` at
  `MAX_READS_BYTES` (8 MiB) with no rotation. Measured 2026-08-26 on this
  repository: 7,293,864 B, **86.9% of its bound**, against the trace's 58.1%.
  CONTEXT's scope boundary names `.planning/trace.jsonl` alone, so it was left
  untouched. It is the same defect, closer to firing, and this phase's rotation
  is not shared with it.
- Named by the plan and not tasked: `cadence-core/workflows/adopt.md`'s
  success-criteria line "The trace ignore line is present" stays singular now
  that task 3 writes two rules, and `cadence-core/bin/planning/risk-check.mjs`'s
  comment calls the record "append-only across the whole project", a reach claim
  rotation narrows. Neither is falsified by an acceptance criterion.
- The `risk_surface` gate matched `destructive` and `untrusted_input` on
  `47280bdf..a9a50fdd` and was cleared by explicit user override, not by a
  reviewer pass. Both signals were read at the line first: the destructive match
  is three `unlinkSync` calls in the rotation rollback, each on one named file
  and each in `try/catch`, which the detector labels "a recursive delete call";
  the untrusted_input match is two guarded `JSON.parse` calls, the second of
  which shape-checks before reading `e.corr`. Adjudicated informational - the
  surface was genuinely touched, nothing is at risk. The override receipt with
  this reasoning is in `.planning/trace.jsonl` under `4-47280bdf`.

## Goal check

The phase goal was that `.planning/trace.jsonl` stop being able to reach a state
where every subsequent append fails forever. The five commits deliver it, and
the delivery is verifiable rather than asserted: `cadence-core/bin/lib/trace.mjs`
no longer has a path returning `reason: 'size-cap'` for a file at the bound, and
`node --test cadence-core/bin/trace.test.mjs` passes 163/163 with named coverage
of each half of the claim - "a record at the bound rotates, and the append
lands", "a record already PAST the bound rotates, and its sibling keeps the
excess", "the run in flight keeps its corr and its brackets across a rotation",
"a second append after a rotation does not rotate again", and "a SECOND rotation
replaces the generation, so the pair stays bounded". Success criterion 2 (the
rotated content stays readable, or the drop rule is stated where a reader finds
it) is met on the second arm: `renderTrace` names the sibling on the envelope
and `capped` goes false, and task 5 puts the retention sentence in the three
workflows that print `capped`. The race arm is the strongest evidence, because
it is the one that could have shipped as a latent defect - the six-child race
test was held stable over 15 runs before the task was called done.

What is NOT delivered, and is not claimed to be: this is the trace's rotation
and nothing else. `.planning/reads.jsonl` carries the identical defect at 86.9%
of its own 8 MiB bound - materially closer to firing than the trace was at 58.1%
when this phase was opened - and shares none of this code. That is the first
open item above rather than a gap in the goal, because CONTEXT drew the scope
boundary at the trace file, but a reader of this summary should not take
"the record is writable" to mean both records are.
