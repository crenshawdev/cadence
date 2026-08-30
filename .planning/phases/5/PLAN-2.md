---
phase: 5
plan: 2
requirements: [TRC-11]
files:
  - cadence-core/bin/lib/read-trace.mjs
  - cadence-core/bin/read-trace.test.mjs
---

# Phase 5: A contended rotation loses no event - Plan 2 of 2 (the reads record)

## Goal

A second rotation of `.planning/reads.jsonl` neither loses a racing writer's
record nor admits a line it has no room for, so the reads record's tail is
complete or the shortfall is stated.

## Must be true when done

- A record line that reached only `reads.1.jsonl` during a rotation's claim
  window is still readable after a second rotation, and appears exactly once
  across the pair - never in neither file.
- The live record's rotation marker states how many bytes of the generation
  that cut accounted for, so the writer that destroys the generation knows what
  was never carried.
- A pending record too big to sit beside the rotation marker is refused
  `oversized-record` before anything rotates, and the record it would have
  rotated is byte-identical afterwards.
- Where the marker plus the pending line is what decides it, the live record is
  at or below `MAX_READS_BYTES` after the rotation's first write.
- An eviction of a leftover generation that cannot confirm the claim it
  published puts the generation back and refuses the rotation, and the writer's
  own record still lands in the live record.
- A rescue that cannot complete states the bytes it did not carry on the
  rotation's return rather than destroying the generation silently.
- `planning.mjs reads` still reports the rotation on its own `reads.rotated`
  key after a second cut, and the marker appears in none of `calls`, `byAgent`
  or the unresolved/coordinator split.
- `node cadence-core/bin/test.mjs` is green and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Context

Locked: D-01 (this record carries the same two defects as the trace and is not
deferred), D-03 (no shared rotation helper - this plan touches
`lib/read-trace.mjs` only, and `rotateReads`'s own docblock at `:447-453`
already states the copy and names drift as the accepted cost), D-04 (exactly one
prior generation), D-05 (the loss is a two-step: rotation 1 leaves a racing
writer's bytes only in the generation and rotation 2 evicts it; the fix is never
a refusal to evict a grown generation and never a loser re-checking the live
inode after its wait budget), D-06 (the admission check to change is
`appendRead`'s `pending >= MAX_READS_BYTES` at `:783`, not the re-stat at
`:643`), D-07 (the reads marker is fixed-shape and caller-supplied nothing, so
this record's reserve IS a constant - the opposite of the trace's), D-09 (records
between `MAX - marker` and `MAX` moving to `oversized-record` is intended), D-10
(hand-planted state driven through the real `appendRead`, never a spawned race),
D-11 (rows go in the existing `read-trace.test.mjs`), D-12 (the reads marker
stays filtered out of every fold), D-13 (no new on-disk artifact).

Out of scope, deliberately: `cadence-core/bin/planning/core.mjs:366-381`, the
single reads filter, and `isReadsRotationMarker`'s predicate - both already
correct and both tolerant of extra fields on the marker (D-11, D-12).

Planner's choice, mirroring Plan 1 and recorded because CONTEXT leaves the
mechanism open: what tells a later writer where the first cut stopped
accounting is one new numeric field, `carried_bytes`, on the rotation marker
line. That is a seam the record already has, so D-13's "no new artifact" holds.
This plan and Plan 1 share no files; `parallelization.enabled` is `false`, so
they run sequentially.

## Tasks

### Task 1: Seal the generation on the reads rotation marker

- **Files:** cadence-core/bin/lib/read-trace.mjs (start at the `marker` object
  `rotateReads` writes), cadence-core/bin/read-trace.test.mjs
- **Action:** the marker object gains ONE field after `file`: `carried_bytes`,
  the byte size the record had at the instant this call claimed it. Unlike
  the trace, `rotateReads` never reads the record it carries away - "NOTHING
  CROSSES THE CUT (D-02)" at `:487-492` is why - so take the size with a `stat`
  of the LIVE file taken immediately BEFORE the `linkSync`, and carry that
  number onto the marker. NEVER stat after the link: linking does not freeze the
  inode, the live path still names it until the swap, and a writer appending in
  the window between the link and a later stat would have its bytes folded into
  `carried_bytes` - which Task 2 then reads as already accounted and never
  rescues, reproducing the exact AC1 loss this phase exists to close. Sealing
  before the claim can only make Task 2's rescue window LARGER, never smaller,
  and the widest it can be is the bytes appended between that stat and the
  eviction, every one of which is a byte no cut ever accounted for. A stat that
  throws seals nothing: omit the field rather
  than writing a guess, because Task 2 treats an absent field as "rescue
  nothing" and a wrong offset would re-append a whole generation. Nothing else
  about the fresh record changes - it is still the marker and nothing else.
  `isReadsRotationMarker` at `:151` keys on `event` plus the absence of `tool`
  and already tolerates extra fields, and `planning/core.mjs:375-379` reads only
  `file` and `ts` off the marker; neither may be edited (D-11). Say in the
  docblock what the field is FOR, naming the leftover-generation eviction as its
  only consumer, which Task 2 adds.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` green with a
  new row showing that after one rotation through `appendRead` the live
  record's first line carries a numeric `carried_bytes` equal to `statSync` of
  `rotatedReadsPath(d)`'s size, and that `isReadsRotationMarker` still answers
  true for that line. `read-trace.test.mjs:168` (a record at the bound rotates
  and the append lands, marker first) is unchanged and green. `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 2: Finish the carry the cut never made, before the generation is destroyed

- **Files:** cadence-core/bin/lib/read-trace.mjs (start at `rotateReads` - its
  eviction rename and the `evicted` release in its `finally`),
  cadence-core/bin/read-trace.test.mjs
- **Action:** close the two-step loss D-05 names. This record has no carry-back
  by design, so a writer that appended during a claim window has its bytes ONLY
  in the sibling - which the row at `read-trace.test.mjs:270-278` accepts today
  because the bar was "present across the pair". The second rotation evicts that
  sibling and the bar fails. The writer that evicts a LEFTOVER generation must
  therefore carry what the earlier cut never accounted for, before its `finally`
  unlinks the file at `evicted`: read the sealed offset off the live record's
  rotation marker, take the generation's bytes beyond that offset, whole lines
  only, and append them to the live path after the swap. The fresh record starts
  with the marker by construction, so read the offset from the record's head
  rather than reading an 8 MB file on the rotation path. Where the live record
  carries no marker, or the marker carries no numeric `carried_bytes` - a
  generation sealed by the code that shipped before this phase - rescue NOTHING
  and leave the eviction exactly as it is. Never throw and never let a failed
  rescue change WHETHER the rotation rotated: this function reports `reason`
  only where the rotation failed outright. It must not be SILENT either - the
  goal is a tail that is complete OR a shortfall that is stated, and a rescue
  that cannot complete before the `finally` unlinks the generation states nothing
  at all today. Where the rescue cannot complete for ANY reason - the read, the
  parse or the append - return the bytes beyond the sealed offset that it did not
  carry, taken from the stat it already has, on a `shortfall` field beside
  `rotated: true`. Scoping this to the append alone would leave the read and
  parse arms silent, which is the same loss one step earlier: a failed read never
  establishes a byte count, so the count comes from the stat and not from what
  was successfully read. Where even that stat fails, return `shortfall: null`,
  which states that the tail was cut by an unknown amount rather than stating
  nothing. Nothing on disk changes shape, and a caller that ignores the field
  behaves exactly as it does now. Do NOT refuse to evict a grown generation and do
  NOT keep a second one - both are rejected by D-05 and D-04 - and do not add a
  carry-back to the ordinary rotation path, which would put a previous
  generation's reads into a record `:487-492` says starts with the marker and
  nothing else. The rescue is the one thing that crosses the cut, only at an
  eviction, and only for bytes no cut ever accounted for; say exactly that in
  the comment, because the surrounding prose currently states the opposite
  without qualification. Where the rescued lines leave the live record over
  `MAX_READS_BYTES`, carry them anyway and let the next append rotate.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` green with a
  new row that rotates once through `appendRead`, hand-plants one well-formed
  record line into `rotatedReadsPath(d)` (a racing writer's record that only
  reached the generation), pads and forces a SECOND rotation through
  `appendRead`, and asserts the planted record appears exactly once across the
  live record and `reads.1.jsonl` together - never in neither, never twice.
  Then prove the row is a reproduction: `git stash push --
  cadence-core/bin/lib/read-trace.mjs`, run `node --test --test-name-pattern`
  against that row and see it FAIL, then `git stash pop`.
  A third row makes the rescue's READ fail (the generation made unreadable after
  the swap) and asserts the return carries `rotated: true` with a numeric
  `shortfall` equal to the generation's bytes beyond the sealed offset, so a
  failure that never read a byte still states the cut tail rather than being
  silent.
  `read-trace.test.mjs:195` (the second rotation evicts the generation the first
  one left, including its assertion that `/gen-one` survives in neither file)
  and `:263` (six racing writers) are unchanged and green.

### Task 3: Reserve the rotation marker in the reads admission check

- **Files:** cadence-core/bin/lib/read-trace.mjs (start at `appendRead`),
  cadence-core/bin/read-trace.test.mjs
- **Action:** `appendRead`'s `pending >= MAX_READS_BYTES` refusal at `:783`
  counts only the pending line, but a rotation always writes the marker into the
  fresh record too, so a record in the band between `MAX_READS_BYTES - marker`
  and `MAX_READS_BYTES` rotates and then lands a file over its bound on the
  first write (measured 2026-08-30: 74 B over, against an 82-byte marker). Make
  that refusal reserve the marker as well. Here the reserve IS a constant
  (D-07): the marker is fixed-shape and nothing on it is caller-supplied, unlike
  the trace's, which embeds the anchor's `corr` and an unvalidated `phase`.
  Derive the constant ONCE from the same object shape `rotateReads` writes -
  never a hand-counted number - and make it an upper bound rather than a sample,
  since `carried_bytes` is a number whose printed width varies: render the shape
  with the widest value that field can take. State in the comment that it is a
  bound and why, so a later reader does not "correct" it to a measurement of one
  instance. Keep the `oversized-record` reason and the existing sentence
  explaining why a line that reaches the bound alone is refused rather than
  rotated. This deliberately moves a narrow band of record sizes from "rotate
  and land" to `oversized-record` (D-09) - state that so a later reader does not
  read it as a regression.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` green with two
  new rows: a record padded to the bound plus a pending record whose serialized
  line is `MAX_READS_BYTES - 8` bytes returns `{written:false,
  reason:'oversized-record'}`, the live record is byte-identical to before, and
  `readsSiblings(d)` shows nothing was rotated; and the same root with a pending
  record just inside the new threshold rotates and leaves the live record at or
  below `MAX_READS_BYTES` after that first write. `read-trace.test.mjs:371` (a
  single record that reaches the bound by itself) and `:168` are unchanged and
  green.

### Task 4: Confirm the claim on the leftover-generation eviction too

- **Files:** cadence-core/bin/lib/read-trace.mjs (start at `rotateReads`'s `if
  (abandoned)` confirm), cadence-core/bin/read-trace.test.mjs
- **Action:** the confirm-after-claiming at `:670-681` runs on the abandoned-
  claim arm only, and the comment at `:667-669` says the leftover-generation arm
  has its own discriminator and does not gain one. D-02 revisits that: the
  discriminator is `readsRotationInFlight(file, sibling)` read at `:595`, BEFORE
  the `renameSync(sibling, path)` at `:656`, so a writer that linked in between
  has its live claim renamed away with no confirm to put it back - and breaking
  a live claim costs the whole record rather than one deferred rotation. Run the
  confirm on BOTH arms: after the eviction rename, re-stat the sidecar, and
  where it does not answer with the `mtime` this call published - including the
  case where `publish` could not date it at all and `mine` is still null - put
  the sibling back only if nothing has taken that path meanwhile, clear
  `evicted` so the release cannot delete a restored claim, and return
  `{rotated:false}`. Rewrite the comment that states the exclusion, and the
  cross-reference to `lib/trace.mjs:837-867` it carries; do not leave prose
  saying the leftover arm stays without a confirm. Nothing else moves: the
  publish stays at `:651`, before the eviction, because the confirm reads the
  `mtime` that line leaves.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` green with a
  new row that plants a leftover generation beside a record at the bound and
  puts the claim sidecar in a state `publish` cannot date, then drives
  `appendRead`: the leftover generation is still on disk byte-identical
  afterwards, no `.evict` file is left in `readsSiblings(d)`, and the writer's
  own record is in the live record. `git stash push --
  cadence-core/bin/lib/read-trace.mjs`, run that row by name and see it FAIL,
  then `git stash pop`. `read-trace.test.mjs:319` (an abandoned claim is
  reclaimed), `:333` (a live claim is left standing), `:347` (a sidecar-less
  claim reads as live) and `:216` (a leftover sibling beside a record under the
  bound is left where it is) are unchanged and green.

### Task 5: Prove the reads rotation still reaches the seam and the marker still reaches no fold

- **Files:** cadence-core/bin/read-trace.test.mjs
- **Action:** criteria 3 and 4 ask that the marker is still never counted as a
  read and that a rotation that happened is still visible, and this phase has
  changed what the marker carries and what a second rotation does with the
  generation it destroys. Add one row that drives two rotations through
  `appendRead` into a planning root the existing seam helpers can run
  `planning.mjs reads` against, and assert: the envelope carries
  `reads.rotated.file` naming the sibling, `carried_bytes` reaches no key of the
  envelope, and the marker contributes to none of `calls`, `byAgent` or
  `topTargets`. Add the join half in-process rather than through the seam where
  that is cheaper: `summarizeReads` and `joinReads` must be handed a marker
  carrying the new field and still produce no call, no `byAgent` row and no
  `unresolved` row for it - the phantom-read failure `isReadsRotationMarker`'s
  docblock at `:137-149` describes. This is a regression guard and adds no
  production code.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` green including
  the new row; `node cadence-core/bin/test.mjs` is green and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true`; `npx tsc -p
  tsconfig.ci.json` exits 0.

## Notes

The mechanism in Task 2 is the planner's choice within D-05's discretion and is
worth a reviewer's attention: D-05 offers "the winner's carry-back (or the
loser's append target)", and this record has neither a carry-back nor any way
for a loser to retarget an append whose file descriptor is already open. The
reading taken here is that the carry the cut never made is FINISHED by the
writer about to destroy the generation, which is the last moment it can be.
Plan 1 takes the same reading for the trace.

AC1 says the record appears "in exactly one of the live record or the rotated
sibling". For this record that is literally true at every point - there is no
carry-back to duplicate it - so the row asserts exactly one occurrence across
the pair.

Left flagged by CONTEXT and untouched here: the claim protocol's POSIX premises
are verified on Linux only.
