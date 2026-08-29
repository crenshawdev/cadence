---
phase: 1
plan: 1
requirements:
  - TRC-10
files:
  - cadence-core/bin/lib/read-trace.mjs
  - cadence-core/bin/read-trace.test.mjs
---

# Phase 1: reads.jsonl rotates instead of dying at the cap - Plan 1

## Goal

`.planning/reads.jsonl` reaches its 8 MiB bound and rotates instead of dropping
every later append forever, keeping exactly one prior generation, with
`lib/trace.mjs`'s own rotation untouched.

## Must be true when done

- Appending to a reads record already at or over `MAX_READS_BYTES` reports the
  record written, and reading `.planning/reads.jsonl` afterwards finds that
  record. The `size-cap` refusal no longer exists anywhere in the tree.
- After two rotations the planning root holds the live record and exactly one
  sibling generation, and no record written before the first rotation is in
  either of them.
- Two `appendRead` processes appending at the bound at the same time leave every
  record they wrote present somewhere across that pair on disk, leave the
  sibling as a separate file rather than a second name for the live record, and
  leave no private claim stamp behind.
- A claim a killed rotation left behind does not disable rotation forever: with
  the sibling still a hard link to the live record and the claim sidecar older
  than the staleness budget, the next append rotates rather than waiting out its
  budget and giving up.
- A single record whose own line reaches the bound is refused by a reason of its
  own instead of throwing the record away to make room for something that still
  would not fit.
- `cadence-core/bin/lib/trace.mjs` and `cadence-core/bin/trace.test.mjs` are
  unmodified, and that test file's rotation rows still pass.

## Context

D-01 locks this as a SECOND rotation written in `lib/read-trace.mjs` reusing
`rotateTrace`'s link-claim technique, never a generalization of `rotateTrace`:
that function is bound to the trace at four levels and fourteen rotation rows at
`cadence-core/bin/trace.test.mjs:175-560` are the proof it did not change.
D-02 locks the carry policy: the reads record carries NOTHING across the cut -
the whole live file becomes the sibling and the fresh record starts with the
rotation marker and nothing else. Nothing scans this record backwards, so there
is no `freshRecord` analogue and no run-in-flight tail to preserve.
D-03 locks the trigger: the pre-emptive `size + pending` form plus an
oversized-record refusal, the shape `appendEvent` already carries.
D-05/D-06/D-07 fix the posture: lock-free, silent, bounded, fail-live, inside a
5-second hook budget, against concurrent appends that are the ordinary case.
Out of scope here: every reader-side and prose-side change (plan 2), any
retention key, and any change to the value of `MAX_READS_BYTES`.

## Tasks

### Task 1: Rotate at the bound instead of refusing

- **Files:** cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/read-trace.test.mjs
- **Action:** Start reading at `MAX_READS_BYTES`, `readsPath` and `appendRead`.
  Give this module the names its rotation needs and then the rotation, and move
  `appendRead` onto it.

  Five exports, and their spellings are the contract plan 2 imports, so keep
  them exactly: `ROTATED_READS_FILE`, the string `reads.1.jsonl`;
  `READS_CLAIM_FILE`, derived from `ROTATED_READS_FILE` with a `.claim` suffix
  rather than written out, so a rule that has to name the file names what the
  writer actually produces (the reason `lib/trace.mjs:138` states for
  `ROTATION_CLAIM_FILE`, and the reason its basename keeps the record's own
  prefix); `rotatedReadsPath(planningRoot)` and `readsClaimPath(planningRoot)`,
  joining those onto the planning root the way `readsPath` does;
  `READS_ROTATION`, the marker's `event` value, spelled `record_rotated`; and
  `isReadsRotationMarker(record)`, true only for a plain object whose `event` is
  `READS_ROTATION` and which carries no `tool` key. That predicate is safe
  because `recordFromHook` writes a `tool` from `RECORDED_TOOLS` on every record
  it produces and never writes an `event` key at all.

  Do NOT import `lib/trace.mjs` to reuse its `ROTATION` constant or its file
  names. `bin/read-trace.mjs` loads this module on every Read, Grep, Glob, Bash
  and NotebookRead call under the 5-second timeout at `hooks/hooks.json:15-25`,
  and `lib/trace.mjs` is 104 KB of source to parse for one string. Same
  spelling, second statement, deliberately - the same reason this module's
  header already gives for being a sidecar rather than a family of `trace.jsonl`.

  Add the rotation as an exported function, `rotateReads(planningRoot, reserve)`,
  taking the pending line's byte length as its reserve. Export it for the reason
  `rotateTrace` is exported (`lib/trace.mjs:651-655`): the losing arms cannot be
  reached through `appendRead`, which re-stats the record and so can never be
  made to arrive holding a stale one. Nothing but `appendRead` and the tests may
  call it. What it must do: claim the record with `linkSync` from the live path
  to the sibling, NEVER `renameSync` - a rename replaces its destination
  silently, so a writer holding a stale stat would destroy a generation another
  writer had already made, while `linkSync` fails `EEXIST`, which is atomic,
  single-winner and refuses the claim rather than detecting the damage
  afterwards (`lib/trace.mjs:633-641`). With the claim held, write the fresh
  record WHOLE to a private path carrying this process's pid and a random
  suffix, with an exclusive-create flag, and rename it over the live path: never
  a read-modify-write, so the live path is never absent and no concurrent
  append is trimmed away by a rewrite it did not see (`lib/trace.mjs:642-650`).
  The fresh record is ONE line: the marker, an object carrying an ISO `ts`, the
  `event` value, and the sibling's file name. Nothing else crosses the cut
  (D-02). Hold the claim from the link until the swap and release it on EVERY
  arm through a `finally` that unlinks the sibling while the claim is still
  held, plus drops any private temp: a claim left behind is a second name for
  the live file forever, every later writer reads a rotation as in flight, and
  the record never rotates again - the exact state v3.7.4 phase 4's UAT recorded
  for the trace. Report `{rotated:true}`, `{rotated:false}` where somebody else
  already made room, and a `reason` ONLY where the rotation failed outright.

  Then move `appendRead`'s bound. Render the line to its JSON string BEFORE the
  size stat rather than after it, which is a reordering and not a rearrangement:
  the arm now needs this line's own byte length. Refuse a line that reaches
  `MAX_READS_BYTES` by itself with its own reason, `oversized-record`, before
  any rotation - rotating there throws the record away to make room for a line
  that still would not fit and the next append does it again
  (`lib/trace.mjs:1014-1019`). Otherwise, where the current size plus the
  pending line reaches `MAX_READS_BYTES`, rotate and then append; return the
  rotation's `reason` where it carries one, and append anyway where it does not.
  Delete the `size-cap` reason entirely - it is the write-death this phase
  exists to remove, and D-12 establishes that no user-facing surface names it,
  so nothing outside this module and its test has to be told. The post-hoc
  `statSync(file).size >= MAX_READS_BYTES` arm at `:282` is what admitted one
  last record past the bound and it goes with it. The `lstatSync` symlink guard
  stays first, unchanged, so a redirected record is refused whatever its size.

  Replace the existing `the cap is enforced BEFORE the write` row in
  `read-trace.test.mjs:147-156`, which asserts the `size-cap` refusal: it is
  asserting the defect. Its replacement is the rotation row below.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` passes, with a
  new row that pads `.planning/reads.jsonl` to one byte under `MAX_READS_BYTES`,
  calls `appendRead`, and shows: the return is `{written:true}`; the live record
  is afterwards smaller than `MAX_READS_BYTES`; its last line parses to the
  record just appended; its first line satisfies `isReadsRotationMarker`;
  `reads.1.jsonl` exists and holds the pre-rotation bytes; and no record already
  on disk before the call is in the live file. A second row shows a single
  record whose serialized line reaches `MAX_READS_BYTES` returns
  `{written:false, reason:'oversized-record'}` with the record's size and the
  sibling's absence both unchanged. `grep -rn "size-cap" cadence-core` returns
  nothing outside `lib/trace.mjs`'s and `trace.test.mjs`'s comments about the
  trace's own history. `node --test cadence-core/bin/trace.test.mjs` passes and
  `git status --porcelain cadence-core/bin/lib/trace.mjs cadence-core/bin/trace.test.mjs`
  prints nothing.

### Task 2: The second rotation evicts the generation the first one left

- **Files:** cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/read-trace.test.mjs
- **Action:** Start reading at `rotateReads`. After task 1 a SECOND rotation
  cannot claim: the sibling the first
  one produced is already at that path, so `linkSync` fails `EEXIST` and the
  record write-deads one indirection down. Add the arm that tells the two
  `EEXIST` causes apart and handles the leftover one.

  The discriminator is inode identity, because between the claim and the swap
  the live path and the sibling are the same inode: same device and same inode
  means a rotation is IN FLIGHT and this task leaves that case alone (task 3
  owns it); different means the sibling is a generation an earlier rotation left
  behind. Where a platform supplies no inode number, or either stat throws, read
  it as IN FLIGHT - the answer that never evicts, costing a deferred rotation
  while the append still lands (`lib/trace.mjs:565-588`).

  On the leftover arm, RE-STAT the live record before touching anything and
  abandon the rotation where the record plus the reserve no longer reaches
  `MAX_READS_BYTES`. This is the one destructive act on the path and the
  interleaving is real: another writer rotated while this one was still holding
  the stat that sent it here, and carrying that fresh file away would destroy
  the generation the other writer just made and leave the record with nothing in
  it. `EEXIST` cannot see that case and a check afterwards is too late, so the
  claim is refused rather than the damage detected (`lib/trace.mjs:812-825`).
  Evict single-winner: rename the sibling to a private path carrying this
  process's pid and random suffix, so exactly one contender wins and the losers
  get `ENOENT`, and unlink that private path in the `finally`. Then retry the
  claim once, and stop - two attempts, never a loop.

  Exactly one prior generation is the entire retention policy. No dated
  generations, no keep-N, no config key: the pair on disk is the bound.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` passes with two
  new rows. The first pads to the bound and appends twice over, with a
  distinguishable record written into each generation, and then shows: the
  planning root's files matching a `reads` prefix are exactly the live record,
  the sibling, and nothing else named after another generation; the live record
  holds the second appended record; the sibling holds the generation written
  between the two rotations; and the record written before the FIRST rotation is
  in neither file. The second row builds a planning root whose sibling is a
  leftover generation and whose live record is UNDER the bound, calls
  `rotateReads` directly, and shows it returns rotated false with the sibling's
  bytes unchanged.

### Task 3: Two writers at the bound lose no record and leave no claim

- **Files:** cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/read-trace.test.mjs
- **Action:** Start reading at `rotateReads`. Handle the other `EEXIST` cause: the sibling is the same inode as
  the live record, so a rotation is genuinely in flight and this process lost
  the claim. It must NOT append immediately - while the claim is held the live
  path still names the old inode, so its record would land in the file about to
  become the sibling rather than in the record. Wait for the swap by polling the
  inode identity, stopping the moment it changes, and then report that this
  process did not rotate so `appendRead` appends into whatever the winner left.

  The wait is a CEILING, never a deadline, and it always proceeds when the
  budget runs out: it acquires nothing, blocks nobody and refuses nothing.
  Choose 250 ms, the figure `lib/trace.mjs:541` uses, and record why here rather
  than inventing a second budget for the same posture: the common wait is the
  one or two milliseconds a rotation actually takes (1.72, 1.76, 1.76, 2.36 and
  3.90 ms measured 2026-08-28 on the real 7,852,530-byte record, D-06), the
  ceiling is only ever paid where the winner died holding its claim, and it is
  5% of the 5,000 ms this hook gets at `hooks/hooks.json:15-25`. Refuse
  `withPlanningFileLock` outright for the reason `lib/trace.mjs:626-631` refuses
  it and for a stronger one this hook has: `bin/read-trace.mjs:10-16` may emit
  nothing on any stream and exits 0 unconditionally, so a lock refusal would
  have no path to be reported on. Concurrent appends are the ordinary case, not
  a theoretical one - `hooks/hooks.json:17` matches five tools and one OS
  process runs per tool call, so parallel subagents are concurrent `appendRead`
  processes (D-07).

  Do NOT port `lib/trace.mjs:884-909`'s carry-back loop, which reads the bytes
  a loser appended into the sibling during the window and copies them into the
  fresh record. The bar here is every record present ACROSS THE PAIR, and a
  record that landed in the sibling during the window already satisfies it;
  copying those bytes back would also put a previous generation's reads into a
  record D-02 says starts with the marker and nothing else. Expect and accept
  that a losing writer's record can be in the sibling, which is where this
  differs from `trace.test.mjs:469`'s assertion that every racing writer's event
  is in the LIVE record - that assertion holds for the trace only because of the
  carry-back this record does not have.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` passes with a
  new row that spawns several child processes, each appending one uniquely named
  record through the real `appendRead` against a planning root already padded to
  the bound, all started before any finishes - the shape
  `trace.test.mjs:446-468`'s `writer` helper already uses. Afterwards: every
  spawned writer's record is found in the live record or in the sibling, none
  missing from both; the live record and the sibling are different inodes;
  exactly one sibling exists; and no file in the planning root has a name
  containing a private stamp or temp suffix.

### Task 4: An abandoned claim is reclaimed instead of disabling rotation forever

- **Files:** cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/read-trace.test.mjs
- **Action:** Start reading at `rotateReads`. After task 3 a claim whose holder
  was killed stands forever: the
  sibling stays a second name for the live record, every later writer reads a
  rotation as in flight, waits out its budget and returns, and the live record
  grows past the bound for the rest of the project - the state v3.7.4 phase 4's
  UAT recorded for the trace before TRC-09 closed it. Close it here the way
  TRC-09 closed it there.

  The claim needs an age, and only a file written beside it can carry one: the
  live record and the sibling are one inode until the swap and every append
  bumps that shared inode's timestamps, so the claim's own age cannot be read
  off the record (`lib/trace.mjs:120-137`). Write a sidecar at
  `readsClaimPath(planningRoot)`, and write it PRIVATE first - at a path
  carrying this process's pid and random suffix - publishing it onto the shared
  path by rename only from the two arms that have established the claim is this
  process's to date: the arm where the link succeeded, and the arm where the
  sidecar read abandoned and this process is about to evict it. Writing straight
  to the shared path means every append that LOSES the link has refreshed
  somebody else's claim, which on a record appended more often than the
  staleness budget restarts the clock on every append and the abandoned claim
  never ages into a reclaim at all; and having the loser put back what it
  overwrote is a check-then-write on a shared path whose losing race rewinds a
  live claim's stamp to a dead one's age, which costs the whole record rather
  than one rotation. Read the age BEFORE publishing anything, because a publish
  overwrites the only evidence a killed claimant left. Drop an unpublished
  private stamp unconditionally in the `finally`, and unlink the shared sidecar
  only while the claim is still held: a completed rotation leaves its sidecar
  behind deliberately, inert once the sibling is a separate inode and overwritten
  by the next claimant, because an unconditional unlink after the swap would
  delete the FRESH sidecar of a process that took the claim legitimately in that
  window and leave a standing claim with no sidecar, which reads as live forever
  (`lib/trace.mjs:912-932`). Set the staleness budget to 30 seconds, the figure
  `lib/trace.mjs:557` uses, and state the two numbers behind it for this record:
  it is roughly 7,700x the slowest rotation measured here (3.90 ms, D-06), so a
  live claim is nowhere near it, and it bounds the degraded window at about one
  wait budget per append rather than the four times as much a two-minute figure
  would charge.

  Fail LIVE everywhere the answer is unknowable: abandoned only where the
  sidecar's mtime is strictly further in the past than the budget, so an absent
  sidecar, a stat that throws and a future mtime from a skewed clock all read as
  a LIVE claim that is left standing. The asymmetry is the whole argument - a
  wrong live answer costs one deferred rotation, a wrong abandoned answer breaks
  a live claimant and costs the record. v3.7.5 phase 4's UAT recorded both
  halves for the trace: an abandoned claim rotating on the next append, and a
  missing sidecar reading as live and leaving the claim in place. After evicting
  on an age, CONFIRM before reading or writing anything: re-stat the sidecar and
  where its mtime is not the one this process published, put the sibling back
  only if nothing has taken that path meanwhile, clear the eviction and report
  no rotation - a second reclaimer may have won the eviction race, re-linked and
  stamped its own sidecar, and breaking THAT claim is the record rather than one
  rotation. That confirm belongs to the abandoned arm alone; task 2's
  leftover-generation eviction has its own discriminator and does not gain one.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` passes with
  four new rows, each building the killed-claim state directly with a `linkSync`
  and a dated sidecar rather than by killing a process, the way
  `trace.test.mjs:149-173`'s helper does. First: with the record at the bound,
  the sibling a hard link to it, and the sidecar dated older than the staleness
  budget, `appendRead` returns `{written:true}`, the live record is afterwards
  under `MAX_READS_BYTES`, and the sibling is a separate inode holding the prior
  generation. Second: the same state with the sidecar dated NOW leaves the claim
  standing and the sibling still a hard link to the live record. Third: the same
  state with NO sidecar at all leaves the claim standing the same way. Fourth: a
  completed ordinary rotation leaves the shared sidecar on disk and no private
  stamp, and the following append does not rotate again.

## Notes

- The exact factoring under D-01 was left to the planner. This plan COPIES the
  claim technique into `lib/read-trace.mjs` rather than extracting a shared
  primitive both records call, because every shared-module shape reaches
  `lib/trace.mjs`'s call sites and D-01's rail exists to keep that function
  closed; and because this module is on the PostToolUse hot path, where an
  import of a 104 KB module is a real per-tool-call cost. The accepted cost is
  the one CONTEXT names: a copy can drift from the trace's claim semantics on
  the next fix to either one.
- A COMPLETED rotation deliberately leaves the shared `.claim` sidecar on disk,
  for the reason `lib/trace.mjs:912-932` states. AC3's "no claim file behind" is
  therefore read as: no HELD claim (the sibling is a separate file, not a second
  name for the live record) and no private stamp or temp. Plan 2's `.gitignore`
  rule is what keeps that inert sidecar out of a working tree's commits, which
  is why AC7 asks for it in the plural.
- AC5 holds by construction: this plan declares neither `lib/trace.mjs` nor
  `trace.test.mjs` in its files, so `lease-check` refuses a write to either.
