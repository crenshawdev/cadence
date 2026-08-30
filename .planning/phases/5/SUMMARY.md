---
phase: 5
status: complete
completed: 2026-08-30
---

# Phase 5: A contended rotation loses no event - Summary

Both append-only records - `.planning/trace.jsonl` and `.planning/reads.jsonl` -
now seal each generation on the rotation marker, finish the previous cut's
carry-back before destroying that generation, reserve the marker in the
admission check, and confirm the claim on the leftover-eviction arm.

## What shipped

- The rotation marker seals its generation - `carried_bytes` after `file` on the
  marker written by `freshRecord`/`rotationMarker` (`cadence-core/bin/lib/trace.mjs:497`)
  and by `readsRotationMarker` (`cadence-core/bin/lib/read-trace.mjs`)
- The writer that destroys a leftover generation finishes the earlier cut's
  carry-back first, whole lines only, skipping what is already in the live
  record - `trace.mjs:1010-1050`, `read-trace.mjs:868-893`
- A rescue that cannot complete states `shortfall` beside `rotated: true`
  (`null` where even the stat failed) instead of returning clean
- The admission check reserves the marker the rotation will write, so a line
  that fits alone but not beside the marker is refused `oversized-event` /
  `oversized-record` rather than rotating into a record still over its bound -
  `trace.mjs:1189`, `read-trace.mjs:992`
- Both eviction arms confirm the claim they published before destroying
  anything, and restore the sibling where the mtime is not the one they wrote
- Test-only proof that both trace envelopes (`trace render`, `trace suggest`)
  and the reads seam (`planning.mjs reads`) still report the rotation after a
  SECOND cut, with the marker folding into no count

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 962dc8c9 | the rotation marker seals the generation it carried away |
| 1 | 2 | 2032c0da | the writer that destroys a generation finishes its carry-back |
| 1 | 3 | 98f72c06 | the admission check reserves the marker the rotation writes |
| 1 | 4 | a3c17c5b | the leftover eviction confirms the claim it published |
| 1 | 5 | 75a57dde | both trace envelopes still report the rotation after a second cut |
| 2 | 1 | da6f21a2 | the reads rotation marker seals the generation it carried away |
| 2 | 2 | 5fba7c1f | the writer that destroys a generation finishes the carry |
| 2 | 3 | dd84d56e | the reads admission check reserves the marker a rotation writes |
| 2 | 4 | b2a3e295 | the leftover eviction confirms the claim it published |
| 2 | 5 | d9eda28e | the reads rotation still reaches the seam and the marker no fold |

## Deviations

- [deviation] plan 2, task 5 (`d9eda28e`): the plan's Action asserted that
  `summarizeReads` and `joinReads`, handed a marker carrying the new field,
  produce no call, no `byAgent` row and no `unresolved` row. Measured, they
  produce exactly those - `summarizeReads([marker]).calls` is 1 and
  `joinReads([marker], []).unresolved` is 1 - because both fold every object
  they are handed by design, which `isReadsRotationMarker`'s own docblock at
  `lib/read-trace.mjs:140-144` states as the reason the predicate exists. The
  filter is `planning/core.mjs`'s, not the folds'. The row therefore asserts the
  guard that is real: the predicate still answers `true` for a marker carrying
  `carried_bytes`, the unfiltered marker WOULD be billed, and filtered the way
  `readReadsRecords` filters it, it reaches neither fold. The plan's stated
  criterion is proved on the seam envelope, where it is a fact.

## Open items

- `publish()` nulls `pending` even when its `renameSync` throws, so on a root
  whose sidecar path cannot be written the private stamp
  (`trace.1.jsonl.claim.<pid>.<rand>` / `reads.1.jsonl.claim.<pid>.<rand>`) is
  left behind by the `finally`'s `if (pending)` release. Present in BOTH
  `lib/trace.mjs` and `lib/read-trace.mjs`, visible in each plan's task 4
  fixture. Pre-existing, on an arm no task here owns, and inert residue rather
  than a lost event; a task that states the release contract should carry both.
- The NO-SEAL arm is the one place the phase goal's "or the shortfall is
  stated" does not hold: a leftover generation whose marker carries no readable
  `carried_bytes` - one left by pre-upgrade code, or one whose marker line is
  corrupt - is rescued not at all and unlinked, and the return is a clean
  `{rotated: true}` with no `shortfall`
  (`lib/read-trace.mjs:851`, same shape at `lib/trace.mjs:1028`). Raised by the
  plan-2 `risk_surface` review and ruled `downgraded`: no offset can be guessed,
  the fail-closed choice is deliberate and documented, and nothing regressed -
  before this phase every leftover generation died silently. A `shortfall: null`
  on that arm would close it.

## Goal check

The ten commits above plausibly deliver the goal, and each half of it is
carried by a specific one. "Loses no event" rests on plan 1 task 2
(`2032c0da`) and plan 2 task 2 (`5fba7c1f`), which move the carry-back to the
writer that is about to destroy the generation; both were reproduction-proved -
with the library stashed, the new row FAILs with "the racing writer's event is
in NEITHER file". "Admits no record it has no room for" rests on task 3 of each
plan (`98f72c06`, `dd84d56e`), where the reserve became the marker plus the
pending line and a line that reaches the bound alone is refused
`oversized-event`/`oversized-record` with the record byte-identical; pre-fix
that refusal row returns `{written:true}`. "The tail is complete or the
shortfall is stated" rests on the seal (`962dc8c9`, `da6f21a2`, asserted equal
to `statSync(rotated...).size`) plus the `shortfall` field on every failure arm.
The one gap is named in Open items and is honest rather than incidental: the
no-seal arm states nothing at all, so the goal's second clause holds for every
FAILED rescue but not for a generation that carried no readable seal to rescue
from. Task 5 of each plan (`75a57dde`, `d9eda28e`) is test-only and confirms the
envelopes still report `rotated` after a second cut with the marker folding into
no count. Suite: `node cadence-core/bin/test.mjs` 3638/3638,
`node cadence-core/bin/self-verify.mjs` `ok:true` with 0 problems,
`npx tsc -p tsconfig.ci.json` exit 0.
