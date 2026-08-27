# Phase 4: A killed rotation must not disable rotation - Context

Gathered: 2026-08-27
Feeds: /cad-plan 4

## Scope boundary

In: a claim SIDECAR written by `rotateTrace` at claim time and a reclaim arm
that reads its age, so a `trace.1.jsonl` claim abandoned by a killed process is
evicted and the rotation completed on the next append, restoring the
unconditional bound. Plus the single exported spelling of the sidecar name, its
`.gitignore` rule, and the `trace.test.mjs` `siblings()` helper edit those
require.
Out: repurposing the inode-identity check at `bin/lib/trace.mjs:527-536`, which
answers in-flight-vs-stale-generation and cannot answer live-vs-abandoned - a
live claim and an abandoned one are byte-identical to it (same `ino`, same
`dev`, `nlink === 2`, measured 2026-08-27). Out: any process-liveness arm
(`process.kill(pid, 0)`, `/proc`) - no precedent in the tree and it degrades on
a foreign host or a network `.planning` root, both unsettled. Out: an
adopt-and-finish arm, which re-opens the interleaving `linkSync` exists to
refuse (`bin/lib/trace.mjs:549-556`). Out: a `2 MiB` constant - the bound in
code is `MAX_TRACE_BYTES` at 1 MiB and 2 MiB is the derived bound on the PAIR.
Out: a config key for the staleness threshold.
Deferred: the other residue a kill strands - `trace.jsonl.rotate.<pid>.<rand>`
temps and `trace.1.jsonl.evict.<pid>.<rand>` files, neither in `.gitignore` -
is the same failure mode but wider than TRC-09, which names the claim and the
bound only. Filed as its own item rather than folded in.
Plan shape: one plan

## Durable decisions

- D-01 (discriminator): The reclaim reads a SIDECAR the claimant writes at claim
  time, and takes the claim's age off that sidecar's `mtime`. No property of the
  claim itself can carry an age: the sibling IS the live file, so every
  `appendFileSync` bumps the shared inode's `mtime` and `ctime` (measured
  2026-08-27: sidecar-less claim age reads 0.86-0.88 ms on every append into an
  abandoned state), and `birthtime` dates the current generation rather than the
  claim. Rejected after real consideration: (a) budget exhaustion - treat a
  claim surviving the full `ROTATE_WAIT_MS` as abandoned, no new file, and the
  measured margin is 35-70x (a full 1 MiB rotation ran 3.17-6.50 ms over five
  runs against `ROTATE_WAIT_MS = 250`) - but it is a heuristic, and a suspended
  host or a stalled write makes it break a LIVE claim, which destroys the
  record; (b) `process.kill(pid, 0)` liveness, which has no precedent anywhere
  in `cadence-core/bin/lib/*.mjs` and degrades off-host and on a network root;
  (c) adopt-and-finish. Evidence: `cadence-core/bin/lib/trace.mjs:593`,
  `:511-536`, `:549-556`; `cadence-core/bin/lib/capture-file.mjs:216-223`,
  `:263-273`.
- D-02 (fail live): An absent, unreadable or ambiguous sidecar reads as LIVE -
  the claim is left standing, the append lands, exactly as today. No arm evicts
  on missing evidence. This is the same posture the module already takes where
  it cannot know ("unknowable reads as in flight"), and it is what makes the
  change safe to ship before every claim in the wild carries a sidecar.
  Evidence: `cadence-core/bin/lib/trace.mjs:522-524`, `:533-535`, `:572-574`.
- D-03 (threshold is a constant): The staleness bound is a module constant
  beside the code that enforces it, never a config key - the posture
  `MAX_TRACE_BYTES`, `ROTATED_TRACE_FILE`, `ROTATE_WAIT_MS` and
  `capture-file.mjs`'s `LOCK_STALE_MS` all take, and the one the prior cycle's
  D-05 locked for the bound itself. Value: 30,000 ms - about 4,600x the slowest
  measured rotation (6.50 ms), and it bounds the degraded window to 30 s rather
  than the 120 s `LOCK_STALE_MS` would impose at 252 ms per append. Evidence:
  `cadence-core/bin/lib/trace.mjs:98-104`, `:118`, `:504`;
  `cadence-core/bin/lib/capture-file.mjs:223`.
- D-04 (the reclaim rotates): Satisfying the cost clause requires COMPLETING a
  rotation on the first contended append. Shortening or skipping the 250 ms
  busy-wait is not sufficient: the trigger is re-read from `statSync(file).size`
  on every call, so a record left over the bound sends the next append straight
  back into the same arm. Measured 2026-08-27 on a padded scratch root: three
  consecutive appends took 252, 252 and 255 ms, each returning `{written:true}`,
  with the live file growing 1,048,974 -> 1,049,186 bytes. Evidence:
  `cadence-core/bin/lib/trace.mjs:761`, `:614-618`, `:504`, `:507-509`.

## Decisions

- D-05 (eviction path): The reclaim reuses the existing single-winner arm -
  `renameSync(sibling, '<sibling>.evict.<priv>')` with a re-stat after claiming -
  rather than unlinking the sibling name directly, so exactly one contender acts
  and the losers get ENOENT. A direct unlink deletes whatever is at the path
  NOW rather than the thing that was measured, which is the failure
  `capture-file.mjs:254-259` documents. Evidence:
  `cadence-core/bin/lib/trace.mjs:620-637`;
  `cadence-core/bin/lib/capture-file.mjs:254-272`.
- D-06 (one spelling): The sidecar name is stated ONCE as an export beside
  `ROTATED_TRACE_FILE`, added to `.gitignore` beside `/.planning/trace.1.jsonl`,
  and taught to `trace.test.mjs`'s `siblings()` helper - which today asserts the
  planning root holds nothing else matching `trace.*`, so a new artifact reddens
  the existing race tests until it is accounted for. A killed process leaves the
  sidecar in a user's working tree, which is why the ignore rule is part of the
  change and not a follow-up. Evidence:
  `cadence-core/bin/lib/trace.mjs:89-111`; `.gitignore:30-31`;
  `cadence-core/bin/trace.test.mjs:123`, `:296-299`, `:320`, `:344`.
- D-07 (no 2 MiB constant): `MAX_TRACE_BYTES` stays 1,048,576. The "2 MiB bound"
  the roadmap goal names is the DERIVED bound on the pair on disk, because the
  rotated path is fixed and a second rotation evicts the first. Nothing in this
  phase mints a 2 MiB constant. Evidence:
  `cadence-core/bin/lib/trace.mjs:118`, `:98-104`.
- D-08 (test construction): The abandoned claim is created DIRECTLY -
  `linkSync(tracePath(dir), rotatedTracePath(dir))` on a root padded by the
  existing `padToBound` helper - with no kill, no signal and no child process.
  The live side of D-01's discriminator is proved in-process by calling
  `rotateTrace` directly against a fresh sidecar, the way the suite already
  forces the losing arm deterministically; a spawned holder is reserved for the
  multi-writer race that already exists. Verified 2026-08-27: the two-line
  construction reproduced `nlink 2`, the 252 ms appends and the unbounded
  growth. Evidence: `cadence-core/bin/trace.test.mjs:128-135`, `:26-32`,
  `:323-344`, `:255-307`.

## Acceptance criteria

- [ ] AC1: Given a trace root at or over `MAX_TRACE_BYTES` whose
      `trace.1.jsonl` is a hard link to the live record and whose sidecar
      `mtime` is older than the staleness constant, the next `appendEvent`
      rotates: the append reports `{written:true}`, the live record afterward is
      under `MAX_TRACE_BYTES`, and `trace.1.jsonl` is a SEPARATE inode holding
      the prior generation.
- [ ] AC2: After that reclaim, `statSync` on the live record reports
      `nlink === 1` - no claim standing - and the following append completes in
      under 50 ms, against the 252/252/255 ms measured per append while the
      claim stood.
- [ ] AC3: Given the same root with a sidecar `mtime` NEWER than the staleness
      constant, `rotateTrace` returns `{rotated:false}`, `trace.1.jsonl` still
      shares the live record's inode, and no `.evict.` file exists in the root.
      Both sides of the discriminator carry a test.
- [ ] AC4: With the sibling present as a hard link and NO sidecar at all,
      `rotateTrace` returns `{rotated:false}` and leaves the claim in place - a
      missing signal reads as live, never as abandoned.
- [ ] AC5: The sidecar name appears exactly once in the source as an export,
      `.gitignore` ignores it beside `/.planning/trace.1.jsonl`, and
      `trace.test.mjs`'s `siblings()` helper accounts for it with the existing
      six-writer race tests still green.
- [ ] AC6: `node cadence-core/bin/test.mjs` is green and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Flagged assumptions

- `process.kill(pid, 0)` semantics on non-Linux hosts are unsettled, and the
  codebase has no precedent to read them off. Unclear; if wrong: nothing this
  phase - D-01 rejected the pid arm, so the answer only matters if a later
  phase wants a fast arm layered over the age arm.
- Whether Cadence supports a `.planning/` directory on a network filesystem
  (NFS/SMB) is stated nowhere in the tree. Unclear; if wrong: `linkSync` EEXIST
  atomicity and hard-link semantics degrade there - but that is the EXISTING
  rotation design's exposure, not surface this phase adds, and D-01's age-only
  sidecar is the option least sensitive to it.
- Breaking a claim that is genuinely live destroys the whole record, not merely
  a rotation: the holder's `readFileSync(sibling)` gets ENOENT, `carried` falls
  back to `''`, and it swaps a record holding only the rotation marker over the
  live path while the evictor's `finally` unlinks the last remaining name of the
  old inode. Confident; if wrong: nothing - this is why AC3 and AC4 exist and
  why D-02 fails live. Evidence: `cadence-core/bin/lib/trace.mjs:636-637`,
  `:644-645`, `:649-650`, `:688`.
- The sidecar must be written INSIDE the window `linkSync` opens and cleaned up
  by the same `finally` that releases the claim, or a successful rotation leaves
  its own sidecar behind and the next claim reads a stale age. Likely; if wrong:
  the reclaim fires on a healthy record, which AC3 catches.
