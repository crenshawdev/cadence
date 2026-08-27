---
phase: 4
plan: 1
requirements:
  - TRC-09
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - .gitignore
---

# Phase 4: A killed rotation must not disable rotation - Plan

## Goal

`rotateTrace` claims the record with a hard `linkSync` and releases it only in
its own `finally`, so a SIGKILL or a host timeout leaves the claim standing
forever. The record never write-deads, but the unconditional bound it promises
is gone and every append pays about 252 ms for the state. An abandoned claim
must be reclaimed on the next append, so the record keeps the bound it
promises.

## Must be true when done

- On a planning root whose `trace.jsonl` is at or over `MAX_TRACE_BYTES` and
  whose `trace.1.jsonl` is a hard link to it, with the claim sidecar's `mtime`
  older than the staleness constant, the next `appendEvent` rotates: it returns
  `{written:true}`, the live record afterwards is under `MAX_TRACE_BYTES`, and
  `trace.1.jsonl` is a SEPARATE inode holding the prior generation.
- After that reclaim `statSync` on the live record reports `nlink === 1` - no
  claim standing - and the following `appendEvent` on the same root returns in
  under 50 ms, against the 252, 252 and 255 ms measured per append while the
  claim stood.
- With the same hard-linked claim but a sidecar written inside the staleness
  constant, `rotateTrace` returns `{rotated:false}`, `trace.1.jsonl` still
  shares the live record's inode, and no `.evict.` file exists in the root.
- With the same hard-linked claim and NO sidecar at all, `rotateTrace` returns
  `{rotated:false}` and leaves the claim in place: missing evidence reads as
  live, never as abandoned.
- A rotation that COMPLETES leaves no sidecar behind - the planning root holds
  exactly `trace.1.jsonl` and `trace.jsonl` after the existing six-writer race -
  and `git check-ignore -v .planning/trace.1.jsonl.claim` exits 0 naming a
  `.gitignore` line.
- The sidecar's name is produced from ONE exported constant in
  `cadence-core/bin/lib/trace.mjs`; neither the module nor the test file spells
  it a second time.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Context

CONTEXT.md's eight decisions bind this plan and are implemented exactly. D-01:
the discriminator is a SIDECAR the claimant writes at claim time and the reclaim
reads its `mtime`; no property of the claim itself can carry an age, because the
sibling IS the live file until the swap, so every `appendFileSync` bumps the
shared inode's `mtime` and `ctime` (measured 2026-08-27: a sidecar-less claim's
age reads 0.86-0.88 ms on every append into an abandoned state) and `birthtime`
dates the current generation rather than the claim. D-02: absent, unreadable or
ambiguous evidence reads as LIVE and the claim is left standing, the same
posture `rotationInFlight`'s own "unknowable reads as in flight" comment states.
D-03: the staleness bound is a module constant at 30,000 ms, never a config key.
D-04: satisfying the cost clause requires COMPLETING a rotation on the first
contended append - shortening or skipping `ROTATE_WAIT_MS` is not sufficient,
because the trigger is re-read from `statSync(file).size` on every call. D-05:
the eviction reuses the existing single-winner rename arm with a re-stat after
claiming, never a direct unlink. D-06: one spelling of the sidecar name, its
`.gitignore` rule, and `trace.test.mjs`'s `siblings()` helper accounting for it.
D-07: `MAX_TRACE_BYTES` stays 1,048,576 and nothing here mints a 2 MiB constant.
D-08: the abandoned claim is constructed DIRECTLY with `linkSync`, no kill, no
signal, no child process.

Out of scope by the same file: repurposing `rotationInFlight` to answer
live-vs-abandoned (measured 2026-08-27, a live claim and an abandoned one are
byte-identical to it - same `ino`, same `dev`, `nlink === 2`); any process
liveness arm (`process.kill(pid, 0)`, `/proc`), which has no precedent anywhere
in `cadence-core/bin/lib/*.mjs`; an adopt-and-finish arm, which re-opens the
interleaving `linkSync` exists to refuse; and a config key for the threshold.
Deferred as its own item and NOT to be folded in: `.gitignore` rules for the
`trace.jsonl.rotate.<pid>.<rand>` temps and the
`trace.1.jsonl.evict.<pid>.<rand>` files.

Five facts read out of the tree bind the tasks. `rotateTrace`'s `finally`
already releases three things by local - `temp`, `held` and `evicted` - so the
sidecar joins that set as a fourth rather than getting cleanup of its own. Its
`EEXIST` arm has exactly two outcomes today, a busy-wait that returns
`{rotated:false}` when `rotationInFlight` answers true and a single-winner
eviction when it answers false; the reclaim adds a third way INTO the second,
not a third arm. `trace.test.mjs`'s `siblings()` helper filters
`readdirSync(dir)` on `startsWith('trace.')` and four assertions after it
already require the planning root to hold exactly `trace.1.jsonl` and
`trace.jsonl` after a rotation, so a sidecar leaked on any arm reddens tests
that already exist - which is why the sidecar's name must keep that prefix.
`cadence-core/bin/planning/trace.mjs` holds a SECOND ignore surface,
`TRACE_IGNORE_LINE` and `ROTATED_IGNORE_LINE`, which `trace ignore` writes into
projects Cadence scaffolds; CONTEXT's scope boundary names this repository's own
`.gitignore` rule alone, so that surface is not touched and is raised for the
human in Notes. And nothing under `cadence-core/references/`,
`cadence-core/workflows/` or `docs/` names the rotated sibling or the size bound
(grepped 2026-08-27), so this phase moves no prose surface and re-pins no
`weight-budgets.json` entry.

## Tasks

### Task 1: The claim dates itself, with the sidecar's name spelled once

- **Files:** cadence-core/bin/lib/trace.mjs (the `ROTATED_TRACE_FILE` export,
  the `rotatedTracePath` helper beside it, and the claim inside `rotateTrace`),
  cadence-core/bin/trace.test.mjs (the `siblings` helper and the existing
  rotation rows that assert against it)
- **Action:** Export one new constant beside `ROTATED_TRACE_FILE` naming the
  claim sidecar, and derive it from `ROTATED_TRACE_FILE` rather than respelling
  `trace.1.jsonl` - that constant's own comment states it is the one place the
  writer, the reader, the `.gitignore` rule and every test read the name from,
  and a second literal is exactly the drift it exists to prevent (D-06). This
  plan calls the constant `ROTATION_CLAIM_FILE` with the value
  `trace.1.jsonl.claim`, and tasks 2, 4 and 5 import whatever name this task
  chooses. The spelled suffix must leave the name starting with the live
  record's own `trace.` prefix: `siblings()` in `trace.test.mjs` filters on
  exactly that, and a name outside it silently stops a leaked sidecar reddening
  the six-writer race row. Add a path helper beside `rotatedTracePath` deriving
  the full path with `join` the way that one does; this plan calls it
  `rotationClaimPath`.
  In `rotateTrace`, write the sidecar IMMEDIATELY BEFORE each `linkSync(file,
  sibling)` attempt, never after it - before the first attempt and again before
  the retry that follows an eviction, so the file on disk is never older than
  the claim standing beside it. The ordering is load-bearing and the intuitive
  one is wrong: writing it after the link succeeds opens a window where the
  claim is HELD while the sidecar at that path is still the aged one a previous
  run left, and a third process reading that age during the window concludes
  ABANDONED and evicts a genuinely LIVE claim. That is the record-destroying
  case AC3 forbids - the holder's `readFileSync(sibling)` then gets `ENOENT`,
  `carried` falls back to `''`, and it swaps a record holding only the rotation
  marker over the live path (`lib/trace.mjs:636-637`, `:644-645`, `:649-650`).
  Writing first cannot lose the race the other way: a sidecar with no claim
  behind it is never read, because every read of it is gated on
  `rotationInFlight(file, sibling)` being true.
  NOT on the `renameSync(file, sibling)` fallback arm that runs where the
  filesystem has no hard links: no claim is held there, the sibling is the
  generation rather than a second name for the live file, and a sidecar written
  there is residue nothing releases. Because the write now precedes the link, a
  sidecar HAS been written by the time that arm is reached - unlink it on that
  arm before falling back.
  Write it as a PLAIN overwrite and never with `{flag:'wx'}`. The sidecar a
  killed process left behind is still on disk at exactly this path when a
  reclaim takes the claim, so an exclusive create would throw `EEXIST` there and
  turn the reclaim this phase exists to deliver into a failed rotation. The
  `wx` on the `temp` write two blocks down is not the precedent to copy - that
  one writes a PRIVATE path carrying `priv`, where an existing file means
  something has gone wrong.
  The file's CONTENT is diagnostic only, and nothing in this module may read or
  parse it: the single property any arm takes off this file is its `mtime`
  (D-01). Do not write a pid meaning a later liveness check to read it - D-01
  rejected `process.kill(pid, 0)` outright, it has no precedent anywhere in
  `cadence-core/bin/lib/*.mjs`, and it degrades on a foreign host and on a
  network `.planning` root.
  Track the written path in a local beside `temp` and `evicted`, and unlink it
  in the same `finally` GUARDED BY `held`, exactly as the `sibling` unlink one
  line above it already is - never unconditionally. A claimant may delete only a
  sidecar it still owns, and `held` is precisely the flag that says it does.
  The unconditional unlink is the tempting version and it reintroduces this
  phase's own bug: `held` goes false at `renameSync(temp, file)` while this
  process is still inside the carry-back loop below it, doing up to four passes
  of `statSync`, `readSync` and `appendFileSync`. A second process arriving in
  that window takes the claim legitimately (`EEXIST`, `rotationInFlight` now
  false, re-stat, evict, link) and writes its own fresh sidecar - and an
  unconditional unlink in this process's `finally` then deletes it. That second
  claim now stands with NO sidecar, which D-02 classifies as LIVE forever, and
  TRC-09's reclaim is defeated permanently and silently.
  A sidecar left behind by a rotation that COMPLETED is inert and must be left
  alone: once the swap has happened `sibling` is a separate inode, so
  `rotationInFlight` is false, nothing reads the sidecar, and the next claimant
  overwrites it before it links. Task 2's `.gitignore` line is what keeps that
  residue out of a user's commits.
  Because a completed rotation now leaves that third file on disk, this task
  also owes `trace.test.mjs` the accounting for it, or it lands the tree red:
  `siblings()` filters on the `trace.` prefix, and every existing rotation row
  asserting the planning root holds exactly `[ROTATED_TRACE_FILE,
  'trace.jsonl']` sees three entries the moment the sidecar is written. Import
  the constant and the path helper from `./lib/trace.mjs` beside the existing
  `ROTATED_TRACE_FILE` and `rotatedTracePath` imports, update each of those
  existing expectations to the three-file set through the imported constant and
  never a second string literal, and state in the `siblings` helper's comment
  that its prefix filter deliberately covers the sidecar - so a sidecar leaked
  on an arm that still HOLDS the claim reddens these rows rather than being
  filtered out of them. The six-writer race row is the one to read first: it is
  what proves the guard still holds under contention.
  Comment the constant with why the age cannot come off the claim itself: the
  sibling IS the live file until the swap, so every `appendFileSync` bumps the
  shared inode's `mtime` and `ctime` (measured 2026-08-27, a sidecar-less
  claim's age reads 0.86-0.88 ms on every append into an abandoned state), and
  `birthtime` dates the current generation rather than the claim.
- **Verify:** Three checks, run from `/code/cadence`.
  (a) `node --input-type=module -e "import {ROTATION_CLAIM_FILE,
  rotationClaimPath} from './cadence-core/bin/lib/trace.mjs';
  console.log(ROTATION_CLAIM_FILE, rotationClaimPath('/tmp/x'))"` prints
  `trace.1.jsonl.claim /tmp/x/trace.1.jsonl.claim` (substituting whatever names
  this task chose), and the printed file name begins with `trace.`.
  (b) `grep -rn 'trace\.1\.jsonl\.claim' cadence-core/` returns at most ONE
  line, and returns none at all where the constant is derived from
  `ROTATED_TRACE_FILE`: the full name is never spelled twice in the source.
  (c) `node cadence-core/bin/test.mjs planning` is green, with the six-writer
  race row and the `siblings()` assertions after it now expecting the three-file
  set. That is not a formality: those rows are what catch a sidecar leaked on an
  arm that still holds the claim, and they are why this task carries the harness
  edit rather than deferring it to task 2.

### Task 2: Ignore the sidecar, and keep a leaked one reddening the race rows

- **Files:** .gitignore, cadence-core/bin/trace.test.mjs (one new row in the
  rotation section; the `siblings` helper and the existing rows it feeds were
  settled in task 1)
- **Action:** Add one line to `.gitignore` immediately after
  `/.planning/trace.1.jsonl`, spelling the sidecar's path
  `/.planning/trace.1.jsonl.claim`, inside the same comment block that already
  explains the joined run record and its `.1` sibling. Extend that comment by
  one clause naming what the third file is: the dated claim a rotation holds
  while it runs, left in a working tree by a process killed mid-rotation, which
  is why the rule ships with the change rather than after it (D-06).
  This is the ONE ignore surface this phase touches. Do NOT extend
  `TRACE_IGNORE_LINE` or `ROTATED_IGNORE_LINE` in
  `cadence-core/bin/planning/trace.mjs`: that pair is the scaffold-time writer
  `/cad-new-project` runs and `/cad-health` reports on for projects Cadence
  creates, it is outside CONTEXT's scope boundary, and it is raised for the
  human in Notes instead of being folded in here. Do NOT add rules for the
  `trace.jsonl.rotate.<pid>.<rand>` temps or the
  `trace.1.jsonl.evict.<pid>.<rand>` files - CONTEXT defers that residue as its
  own item on purpose.
  Add exactly one `test()` row, in this file's one-row-per-test style, asserting
  the positive that task 1's `finally` owes - the RELEASED claim, not an absent
  sidecar: on a fresh root with an anchor, `padToBound(dir)` and one
  `appendEvent` - the rotation the row above it already exercises -
  `statSync(tracePath(dir)).ino` differs from `statSync(rotatedTracePath(dir)).ino`
  afterwards, so no claim is standing. The sidecar itself SURVIVES a completed
  rotation by design (task 1: a claimant unlinks only a sidecar it still owns),
  so assert `existsSync(rotationClaimPath(dir))` is TRUE and that it is inert -
  a file whose age nothing consults while no claim is held. Assert the sidecar
  through the imported constant or helper, never a second string literal of the
  name.
- **Verify:** (a) `git check-ignore -v .planning/trace.1.jsonl.claim` from
  `/code/cadence` exits 0 and names `.gitignore` and the new line number; before
  this task the same command exits 1 with no output.
  (b) `grep -rn 'trace\.1\.jsonl\.claim' .gitignore` returns exactly one line.
  (c) `node cadence-core/bin/test.mjs planning` is green, including the new row.

### Task 3: An abandoned claim reads as abandoned, and reaches the eviction the module already has

- **Files:** cadence-core/bin/lib/trace.mjs (the `ROTATE_WAIT_MS` constant, the
  `rotationInFlight` predicate beside it, and the `EEXIST` arm inside
  `rotateTrace`)
- **Action:** Add one module constant beside `ROTATE_WAIT_MS` holding the
  staleness bound at 30,000 ms (D-03). Never a config key, and never derived
  from one: this is the posture `MAX_TRACE_BYTES`, `ROTATED_TRACE_FILE`,
  `ROTATE_WAIT_MS` and `capture-file.mjs`'s `LOCK_STALE_MS` all take. Comment it
  with the two figures that set the value: 30 s is about 4,600x the slowest full
  1 MiB rotation measured on this repository (3.17-6.50 ms over five runs,
  2026-08-27), and it bounds the degraded window to 30 s where a
  `LOCK_STALE_MS`-sized 120 s would cost 120 s at 252 ms an append.
  Add a module-private predicate beside `rotationInFlight` taking the sidecar's
  path and answering whether the claim is ABANDONED: true only where `statSync`
  returns an `mtimeMs` strictly further in the past than the constant.
  Everything else answers false, which is LIVE - an absent sidecar, a stat that
  throws, and an `mtime` in the future from a skewed clock (D-02). Comment it
  the way `rotationInFlight`'s "unknowable reads as in flight" paragraph is
  commented, and say what failing live buys: the change is safe to ship while
  claims taken before it exist in the wild carrying no sidecar at all, and the
  cost of a wrong LIVE answer is a deferred rotation while the cost of a wrong
  ABANDONED answer is the whole record.
  Wire it into the `EEXIST` arm of `rotateTrace` so a claim that looks in flight
  but whose sidecar says abandoned stops taking the busy-wait return and falls
  through to the eviction the arm below already performs. Consult the sidecar
  ONLY where `rotationInFlight` answered true: where the sibling is a different
  inode it is a leftover generation, that arm's own discriminator already
  answers, and a rule locked for the new case must not be widened over code that
  already shipped. The `attempt > 0` half of the condition does not change -
  one eviction round stays the bound, and a second `EEXIST` after an eviction
  still waits out the budget and returns `{rotated:false}`.
  Do NOT add a second eviction. The existing one is D-05's whole point: it
  re-stats `statSync(file).size` over the trigger and returns `{rotated:false}`
  where `now + reserve < MAX_TRACE_BYTES`, renames the sibling to
  `${sibling}.evict.${priv}` so exactly one contender acts and the losers get
  `ENOENT`, records the private path in `evicted`, and lets the loop's second
  attempt take the claim. A direct `unlinkSync` of the sibling deletes whatever
  is at the path NOW rather than the thing that was measured, which is the
  failure `lib/capture-file.mjs:254-259` documents.
  On the abandoned arm ONLY, after the rename claims the sibling and before
  anything is read or written, re-read the sidecar and confirm it STILL says
  abandoned. Where it now reads live - refreshed by a claimant that took the
  claim between the first read and the rename, since task 1 has every claimant
  write the sidecar immediately BEFORE its `linkSync` - put the sibling back at
  its own path when nothing
  has taken that path meanwhile, unlink the private path otherwise, CLEAR the
  local the `finally` cleans so the release cannot delete a claim that was just
  restored, and return `{rotated:false}` without rotating. This mirrors
  `lib/capture-file.mjs:263-273`. What it protects is not a deferred rotation:
  breaking a claim a rotation is genuinely holding makes that holder's
  `readFileSync(sibling)` return `ENOENT`, `carried` falls back to `''`, and it
  swaps a record holding only the rotation marker over the live path while this
  call's `finally` unlinks the last remaining name of the old inode - the whole
  record, not one rotation. Leave the leftover-generation eviction that already
  ships without that confirm.
  Do NOT shorten or skip `ROTATE_WAIT_MS` as the remedy for the cost (D-04).
  The trigger is re-read from `statSync(file).size` on every call, so a record
  left over the bound sends the very next append straight back into this arm:
  three consecutive appends measured 252, 252 and 255 ms on 2026-08-27, each
  returning `{written:true}`, with the live file growing 1,048,974 to 1,049,186
  bytes. Only a COMPLETED rotation ends the state. Do NOT repurpose
  `rotationInFlight` to answer live-vs-abandoned: measured the same day, a live
  claim and an abandoned one are byte-identical to it.
- **Verify:** Two behavioral checks against a scratch planning root outside this
  repository, both scriptable with `node --input-type=module -e` importing
  `appendEvent`, `rotateTrace`, `tracePath` and `rotatedTracePath` from
  `cadence-core/bin/lib/trace.mjs`. Build the root the way task 4's fixture
  will: an anchor event, pad the live file to one byte under `MAX_TRACE_BYTES`,
  `linkSync(tracePath(dir), rotatedTracePath(dir))`, then a sidecar written at
  the claim path and backdated 60 s with `utimesSync`.
  (a) One `appendEvent` on that root returns `{written:true}` and afterwards
  `statSync(tracePath(dir)).ino !== statSync(rotatedTracePath(dir)).ino` and
  `statSync(tracePath(dir)).nlink === 1`. Before this task the same script
  returns `{written:true}` with the two inodes EQUAL and `nlink === 2` - the
  claim still standing - which is the defect. Paste both readings into the
  task's report.
  (b) The reclaim goes through the existing arm rather than a new eviction:
  build the same root but pad the live file well UNDER the bound before the
  `linkSync`, then call `rotateTrace(dir, 120)` directly. It returns
  `{rotated:false}`, `trace.1.jsonl` still shares the live record's inode, and
  `readdirSync(dir)` holds no name containing `.evict.` - the re-stat over the
  trigger refused a rotation this writer did not observe over the bound, even
  with the sidecar reading abandoned.

### Task 4: Prove the reclaim on a claim created directly, and prove the cost stops

- **Files:** cadence-core/bin/trace.test.mjs (the rotation and claim section,
  beside `padToBound` and the six-writer race row)
- **Action:** Add a fixture helper beside `padToBound` that builds an ABANDONED
  claim on a fresh root: an anchor event with `sha: 'abc1234'`, `padToBound`,
  `linkSync(tracePath(dir), rotatedTracePath(dir))`, then a sidecar written at
  the claim path and backdated with `utimesSync` to 60 s ago - clear of the
  30 s bound with margin on either side. No kill, no signal, no child process
  (D-08): this two-line construction was verified on 2026-08-27 to reproduce
  `nlink 2`, the 252 ms appends and the unbounded growth, and a spawned holder
  is reserved for the multi-writer race the `writer()` helper already runs.
  `linkSync`, `utimesSync` and `statSync` are not in this file's `node:fs`
  import list today and have to be added.
  Add exactly two `test()` rows in this file's one-row-per-test style - a table
  looped inside one `test()` reports the loop's count and not the rows', which
  is the hazard that style exists for.
  Row one, the reclaim (AC1). On that root `appendEvent(dir, {phase: 1, family:
  'routing', event: 'resolve'})` returns `{written:true, corr:'1-abc1234'}`;
  the live record afterwards is under `MAX_TRACE_BYTES`; `statSync` on the live
  record and on `rotatedTracePath(dir)` report DIFFERENT `ino` values; the
  sibling holds the prior generation with the anchor as its first line; the
  appended event is in the LIVE record read back through the existing `lines`
  helper; and `siblings(dir)` is exactly `[ROTATED_TRACE_FILE, 'trace.jsonl']`,
  so the killed claimant's stale sidecar is gone and no `.evict.` or `.rotate.`
  file was left behind. Say in the row's comment why the separate-inode
  assertion is the one that cannot be dropped: a sibling that still shared the
  live inode satisfies every size and content assertion in this file and is
  still a standing claim.
  Row two, the cost (AC2). After the same reclaim,
  `statSync(tracePath(dir)).nlink === 1` - no claim standing - and a second
  `appendEvent` on the root returns `{written:true}` in under 50 ms measured
  across the call. Say in the comment what the number is against: 252, 252 and
  255 ms per append measured 2026-08-27 while the claim stood, so 50 ms is a
  five-fold margin under the cheapest of those and is not a benchmark of the
  append itself.
  Assert the sidecar's path through task 1's exported constant or path helper,
  never a second string literal of the name (D-06). Do not assert a 2 MiB
  figure anywhere: `MAX_TRACE_BYTES` is 1 MiB and the pair's 2 MiB bound is
  derived, not a constant this phase mints (D-07).
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` is green with both
  new rows reported, and `node cadence-core/bin/test.mjs planning` is green.
  Paste the measured second-append duration into the task's report beside the
  252/252/255 ms figures it is being compared against.

### Task 5: Prove both sides of the discriminator - a fresh sidecar and no sidecar both leave the claim

- **Files:** cadence-core/bin/trace.test.mjs (beside task 4's rows and the
  existing stale-stat row that already imports `rotateTrace`)
- **Action:** Add exactly two `test()` rows, both calling `rotateTrace(dir,
  120)` DIRECTLY the way the existing stale-stat row does rather than going
  through `appendEvent`, so what is asserted is the rotation's own answer rather
  than an append's.
  Row one, a LIVE claim (AC3). Task 4's fixture with the sidecar written NOW
  instead of backdated: `rotateTrace` returns `{rotated:false}`, `statSync` on
  the live record and on `rotatedTracePath(dir)` report the SAME `ino` - the
  claim still shares the live record's inode - the live record's bytes are
  unchanged, and `readdirSync(dir)` holds no name containing `.evict.`. Say in
  the comment why this row is the reason the discriminator is a sidecar at all:
  breaking a claim a rotation is genuinely holding destroys the whole record,
  not one rotation, because the holder's `readFileSync(sibling)` then returns
  `ENOENT` and it swaps a record holding only the rotation marker over the live
  path.
  Row two, NO sidecar (AC4). The same fixture with no sidecar written at all:
  `rotateTrace` returns `{rotated:false}` and the claim is still in place
  afterwards - same `ino` as the live record, and `nlink === 2` on it. Say in
  the comment that this is D-02's fail-live posture, that it is what makes the
  change safe to ship before every claim in the wild carries a sidecar, and that
  it is today's behaviour deliberately preserved rather than new behaviour.
  Both rows cost roughly `ROTATE_WAIT_MS` in wall clock, because the live arm
  still waits out its budget before returning. That is expected and must not be
  "fixed" by shortening the wait: D-04 rules the budget out as the remedy, and a
  live claim that lands normally is the case the budget exists for.
- **Verify:** (a) `node --test cadence-core/bin/trace.test.mjs` is green with
  both rows reported. (b) `node cadence-core/bin/test.mjs` is green across every
  group. (c) `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

CONTEXT's fourth flagged assumption is now SETTLED, and settled the other way
from how it was written. It reads: "The sidecar must be written INSIDE the
window `linkSync` opens and cleaned up by the same `finally` that releases the
claim, or a successful rotation leaves its own sidecar behind and the next claim
reads a stale age." The `plan` review gate refuted the second half and tasks 1-3
now do the opposite of both clauses. The sidecar is written BEFORE each
`linkSync` attempt, not inside the window it opens, because writing it after the
link leaves a held claim carrying a previous run's aged sidecar - and a third
process reading that age evicts a LIVE claim, which destroys the record. And it
is NOT cleaned up on the success arm, because `held` is already false there
while the carry-back loop still runs, so an unconditional unlink deletes the
sidecar of a claim a second process legitimately took - leaving that claim
sidecar-less, which D-02 reads as live forever and defeats TRC-09 exactly as the
bug being fixed does. The next claim never reads a stale age because it writes
one before it links, and a sidecar with no claim behind it is never read at all:
every read is gated on `rotationInFlight` being true. Nothing in D-01 or D-02
changes - only the ordering the plan chose inside "at claim time", which was
never a locked decision.

Two further things surfaced during planning that are NOT in any task, for the
human to decide rather than for an executor to act on.

`cadence-core/bin/planning/trace.mjs` carries a second ignore surface -
`TRACE_IGNORE_LINE` and `ROTATED_IGNORE_LINE`, which `cmdTraceIgnore` writes at
`/cad-new-project` scaffold time and `/cad-health` reports on with `--check`.
A killed rotation strands the claim sidecar in a USER's working tree exactly as
it does in this one, and that surface will not ignore it. CONTEXT's scope
boundary and D-06 both name this repository's own `.gitignore` rule alone, so
extending it here would be scope invention; it is a real follow-up and it is the
same shape as the deferred `.rotate.` and `.evict.` residue item.

The put-back branch inside task 3 - the eviction that claimed the sibling and
then found the sidecar reading live - is not deterministically reachable from a
single-threaded in-process test, because the only thing that happens between the
first sidecar read and the confirming re-read is the rename itself. Task 3's
Verify pins the arms that ARE reachable (the reclaim, and the re-stat over the
trigger refusing a record no longer at the bound), and the confirm is carried by
inspection against `lib/capture-file.mjs:263-273`, which it mirrors. D-08 rules
out a spawned holder for this phase, so no test is proposed for it rather than
one that pretends to cover it.
