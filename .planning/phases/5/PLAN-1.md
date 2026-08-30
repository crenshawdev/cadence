---
phase: 5
plan: 1
requirements: [TRC-11]
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
---

# Phase 5: A contended rotation loses no event - Plan 1 of 2 (the trace record)

## Goal

A second rotation of `.planning/trace.jsonl` neither loses a racing writer's
event nor admits a record it has no room for, so the trace record's tail is
complete or the shortfall is stated.

## Must be true when done

- An event line that reached only `trace.1.jsonl` after one rotation is still
  readable after a second rotation, and appears exactly once across the pair -
  never in neither file.
- The live record's rotation marker states how many bytes of the generation
  that cut accounted for, so the writer that destroys the generation knows what
  was never carried.
- A pending event too big to sit beside the rotation marker is refused
  `oversized-event` before anything rotates, and the record it would have
  rotated is byte-identical afterwards.
- Where the marker plus the pending line is what decides it, the live record is
  at or below `MAX_TRACE_BYTES` after the rotation's first write.
- An eviction of a leftover generation that cannot confirm the claim it
  published puts the generation back and refuses the rotation, and the writer's
  own event still lands in the live record.
- A rescue that cannot complete states the bytes it did not carry on the
  rotation's return rather than destroying the generation silently.
- `trace render` and `trace suggest` still report the rotation on their own
  `rotated` key after a second cut, and the marker still pairs with nothing.
- `node cadence-core/bin/test.mjs` is green and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Context

Locked: D-01 (both records are fixed; the reads half is Plan 2), D-03 (no
shared rotation helper - this plan touches `lib/trace.mjs` only), D-04 (exactly
one prior generation, no `trace.2.jsonl`), D-05 (the loss is a two-step and the
fix belongs to the carry-back, never to a refusal to evict a grown generation
and never to a loser re-checking the live inode after its wait budget), D-06
(the admission check to change is `appendEvent`'s `pending >= MAX_TRACE_BYTES`,
not the re-stat inside the rotation), D-07 (the trace reserve is MEASURED, not a
constant, because the marker embeds the anchor's `corr` and `phase` and `phase`
reaches the record unvalidated), D-09 (events between `MAX - marker` and `MAX`
moving to `oversized-event` is intended), D-10 (the reproduction is hand-planted
state driven through the real `appendEvent`, never a spawned race and never a
test-only seam in the carry-back), D-11 (rows go in the existing
`trace.test.mjs`), D-12 (the trace marker stays in `events[]` and in
`counts.lifecycle`), D-13 (no new on-disk artifact).

Out of scope, deliberately: the shipped arm where an un-trimmable carried tail
leaves the fresh record over its bound (D-08, stated at `lib/trace.mjs:452-456`
and pinned at `trace.test.mjs:397`), the `rotated` derivation at
`lib/trace.mjs:1323` (D-11), and `cadence-core/bin/planning/core.mjs`.

Planner's choice, recorded here because CONTEXT leaves the mechanism open: the
carry-back is completed by the writer that is about to DESTROY the generation,
and what tells it where the first carry-back stopped is one new numeric field on
the rotation marker line. That is a seam the record already has, so D-13's "no
new artifact" holds and neither `.gitignore` nor
`cadence-core/bin/planning/trace.mjs` is touched. The field is spelled
`carried_bytes` in both this plan and Plan 2.

## Tasks

### Task 1: Seal the generation on the rotation marker

- **Files:** cadence-core/bin/lib/trace.mjs (start at `freshRecord`),
  cadence-core/bin/trace.test.mjs
- **Action:** the marker object `freshRecord` builds gains ONE field after
  `file`: `carried_bytes`, the byte length of the `text` argument - the record
  the claim carried away, measured at the instant the rotation read it. No new
  parameter and no new read: `freshRecord` already holds that text, and
  `rotateTrace` computes the identical number one line later as `seen`. This is
  the only thing that will tell a later writer where this cut stopped
  accounting, so it must be the SEALED size and not an estimate. Keep the fixed
  key order the docblock at `:488-490` states, so the marker stays an ordinary
  line of the record rather than a differently shaped one, and leave the `owed`
  arithmetic alone - it already measures `Buffer.byteLength(marker)` after the
  marker is built, so a wider marker tightens the trim on its own. Do not touch
  `renderTrace`'s `rotated` derivation at `:1323`: it takes `file` and `ts` and
  D-11 keeps that site unchanged, so the new field rides the record without
  reaching any envelope. Say in the docblock what the field is FOR - a reader
  will otherwise take it for telemetry - naming the leftover-generation eviction
  as its only consumer, which Task 2 adds.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` green with a new row
  showing that after one rotation through `appendEvent` the live record's marker
  line carries a numeric `carried_bytes` equal to `statSync` of
  `rotatedTracePath(dir)`'s size, that `renderTrace(dir, 1).rotated` still
  deep-equals `{file, ts}` with no third key, and that the marker is still
  counted once in `counts.lifecycle`. The existing rows at `trace.test.mjs:426`
  (no anchor carries nothing forward) and `:2938` (the committed fixture renders
  as before) are unchanged and green. `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: Finish the carry-back before the leftover generation is destroyed

- **Files:** cadence-core/bin/lib/trace.mjs (start at `rotateTrace` - its
  carry-back loop and the `evicted` release in its `finally`),
  cadence-core/bin/trace.test.mjs
- **Action:** close the two-step loss D-05 names. A writer whose append landed
  in the old inode after the winner's carry-back loop ended has its bytes only
  in the generation; the next rotation evicts that generation and the event is
  in neither file. The writer that evicts a LEFTOVER generation must therefore
  finish the carry-back the earlier rotation started, before its `finally`
  unlinks the file at `evicted`: read the sealed offset off the newest rotation
  marker in the `carried` text this call already read, take the generation's
  bytes beyond that offset, whole lines only, and append them to the live path
  after the swap - the same target and the same whole-lines rule the existing
  carry-back at `:891-909` uses. Skip any line already present in `carried`,
  because the earlier rotation's own carry-back put its delta into that record
  and appending it again would double-count a bracket half in a file readers
  actually read; that is the one difference from the generation, where the
  existing comment's "a duplicate copy in a file nothing reads costs nothing"
  applies. Where the live record has no rotation marker, or the marker carries
  no numeric `carried_bytes` - a generation sealed by the code that shipped
  before this phase - rescue NOTHING and leave the eviction exactly as it is:
  failing closed there costs one old event, while guessing the offset would
  re-append a whole generation. Never throw and never let a failed rescue change
  WHETHER the rotation rotated: this whole function's contract is that a rotation
  reports `reason` only where it failed outright. It must not be SILENT either -
  the goal is a tail that is complete OR a shortfall that is stated, and a rescue
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
  behaves exactly as it does now. Do NOT refuse to evict a grown
  generation and do NOT keep a second one - both are rejected by D-05 and D-04.
  Where the rescued lines leave the live record over `MAX_TRACE_BYTES`, carry
  them anyway: that is the arm `:452-456` already states, `renderTrace` reports
  it as `capped`, and the next append rotates again.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` green with a new row
  that rotates once through `appendEvent`, hand-plants one well-formed event
  line into `rotatedTracePath(dir)` (a racing writer's event that only reached
  the generation), pads and forces a SECOND rotation through `appendEvent`, and
  asserts the planted event appears exactly once across the live record and
  `trace.1.jsonl` together - never in neither, never twice. A second row plants
  a line that is ALSO already in the live record and asserts it is still present
  exactly once after the second rotation. Then prove the row is a reproduction:
  `git stash push -- cadence-core/bin/lib/trace.mjs`, run `node --test
  --test-name-pattern` against the first new row and see it FAIL, then `git
  A third row makes the rescue's READ fail (the generation made unreadable after
  the swap) and asserts the return carries `rotated: true` with a numeric
  `shortfall` equal to the generation's bytes beyond the sealed offset, so a
  failure that never read a byte still states the cut tail rather than being
  silent.
  `trace.test.mjs:538` (a second rotation replaces the generation)
  and `:469` (six racing writers) are unchanged and green.

### Task 3: Reserve the rotation marker in the admission check

- **Files:** cadence-core/bin/lib/trace.mjs (start at `appendEvent` and then `freshRecord`), cadence-core/bin/trace.test.mjs
- **Action:** `appendEvent`'s `pending >= MAX_TRACE_BYTES` refusal at `:1019`
  counts only the pending line, but a rotation always writes the marker into the
  fresh record too, so an event in the band between `MAX_TRACE_BYTES - marker`
  and `MAX_TRACE_BYTES` rotates and then lands a record over its bound on the
  first write (measured 2026-08-30: 105 B over). Make that refusal reserve the
  marker as well. The reserve is MEASURED, never a constant (D-07): the marker
  embeds the `corr` and `phase` of the carried anchor and `renderEvent` passes
  `phase` through unvalidated at `:407-419`, so no fixed number bounds it. Lift
  the anchor scan and the marker construction out of `freshRecord` into one
  helper both callers use, so the shape is spelled once and the reserve cannot
  drift from the line the rotation actually writes. Measure it on the SIZE ARM
  ONLY - inside the `size !== null && size + pending >= MAX_TRACE_BYTES` branch,
  which is the rotation path and already reads the record twice; the ordinary
  append path must not gain a read, because every writer in the tree reaches the
  record through this function. A marker measured here can differ from the one
  written a moment later if another writer landed an anchor in between; that is
  acceptable for an admission check and is worth one sentence in the comment,
  but it is not a reason to move the check into `rotateTrace`, which D-06
  rejects. Keep the `oversized-event` reason and the existing sentence
  explaining why a line that reaches the bound alone is refused rather than
  rotated. This deliberately moves a narrow band of event sizes from "rotate and
  land" to `oversized-event` (D-09) - state that in the comment so a later
  reader does not read it as a regression.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` green with two new
  rows: a record padded to the bound with NO anchor plus a pending event whose
  rendered line is `MAX_TRACE_BYTES - 8` bytes returns `{written:false,
  reason:'oversized-event'}`, the live record is byte-identical to before, and
  `siblings(dir)` shows nothing was rotated; and the same root with a pending
  event just inside the new threshold rotates and leaves the live record at or
  below `MAX_TRACE_BYTES` after that first write. `trace.test.mjs:635` (one line
  that reaches the bound by itself) and `:175` (a record at the bound rotates
  and the append lands) are unchanged and green.

### Task 4: Confirm the claim on the leftover-generation eviction too

- **Files:** cadence-core/bin/lib/trace.mjs (start at `rotateTrace`'s `if
  (abandoned)` confirm), cadence-core/bin/trace.test.mjs
- **Action:** the confirm-after-claiming at `:856-867` runs on the abandoned-
  claim arm only, and the comment at `:852-855` says the leftover-generation
  arm ships without it because "its own discriminator already answers". D-02
  revisits that: the discriminator is `rotationInFlight(file, sibling)` read at
  `:803`, BEFORE the `renameSync(sibling, path)` at `:835`, so a writer that
  linked in between has its live claim renamed away with no confirm to put it
  back - and breaking a live claim is the whole record, not one deferred
  rotation, because the holder's `readFileSync(sibling)` then gets ENOENT,
  `carried` falls back to `''`, and it swaps a record holding only the marker
  over the live path. Run the confirm on BOTH arms: after the eviction rename,
  re-stat the sidecar, and where it does not answer with the `mtime` this call
  published - including the case where `publish` could not date it at all and
  `mine` is still null - put the sibling back only if nothing has taken that
  path meanwhile, clear `evicted` so the release cannot delete a restored claim,
  and return `{rotated:false}`. Rewrite the comment that states the exclusion;
  do not leave prose saying the leftover arm stays without a confirm. Nothing
  else moves: the publish stays where it is at `:830`, before the eviction,
  because the confirm reads the `mtime` that line leaves.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` green with a new row
  that plants a leftover generation beside a record at the bound and makes the
  sidecar path one that `publish` cannot write, then drives `appendEvent`: the
  leftover generation is still on disk byte-identical afterwards, no `.evict.`
  file is left in `siblings(dir)`, and the writer's own event is in the live
  record. `git stash push -- cadence-core/bin/lib/trace.mjs`, run that row by
  name and see it FAIL, then `git stash pop`. `trace.test.mjs:235` (an abandoned
  claim is reclaimed), `:320` and `:345` (a live claim and a sidecar-less claim
  are left standing) are unchanged and green.

### Task 5: Prove the rotation still reaches both trace envelopes after a second cut

- **Files:** cadence-core/bin/trace.test.mjs
- **Action:** criterion 4 asks that a rotation that happened is still visible
  and that nothing stitches generations together silently, and this phase has
  changed what the marker carries and what a second rotation does with the
  generation it destroys. Add one row that drives two rotations through
  `appendEvent` and then reads both seam envelopes - `trace render --phase 1`
  and `trace suggest` - through the existing `run` helper, asserting each still
  carries `rotated.file` naming `rotatedTracePath(dir)` and the same `rotated.ts`
  on both, that `capped` is false, and that the marker's `carried_bytes` does
  NOT reach either envelope. Assert too that the marker still pairs with
  nothing: no bracket row is opened or closed by it, matching the INERT contract
  at `lib/trace.mjs:276-280`. This is a regression guard over the seam and adds
  no production code; keep it in the rotation section beside `:607` rather than
  starting a new one.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` green including the
  new row; `node cadence-core/bin/test.mjs` is green and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true`; `npx tsc -p
  tsconfig.ci.json` exits 0.

## Notes

Plan 1 and Plan 2 share no files and neither ordering is required, but
`parallelization.enabled` is `false` in `.planning/config.json`, so they run
sequentially.

The mechanism in Task 2 is the planner's choice within D-05's discretion, and it
is worth a reviewer's attention: D-05 says the fix "makes the winner's
carry-back complete", and the reading taken here is that the carry-back is
FINISHED by the writer that is about to destroy the generation, which is the
last moment it can be. A settle window on the first rotation's own loop was
considered and rejected because no hand-planted, single-process reproduction can
exercise it, and D-10 forbids both a spawned race and a test-only seam in that
loop.

AC1 says the event appears "in exactly one of the live record or the rotated
sibling". After a rescue the event is in the live record only, so the rows
assert exactly one occurrence across the pair. Note the shipped carry-back
deliberately leaves a duplicate copy in the generation on the FIRST rotation
(`lib/trace.mjs:884-890`), which is why the rows count occurrences after the
SECOND rotation rather than after the first.

Left flagged by CONTEXT and untouched here: the claim protocol's POSIX premises
(`linkSync`, a replacing `renameSync`, non-interleaving `O_APPEND` writes) are
verified on Linux only.
