# Phase 5: A contended rotation loses no event - Context

Gathered: 2026-08-30
Feeds: /cad-plan 5

## Scope boundary

In: both trace records - `cadence-core/bin/lib/trace.mjs` and
`cadence-core/bin/lib/read-trace.mjs`. Two defects each: a racing writer's
event lost from BOTH files across a second rotation, and an admission check
that admits a pending record leaving no room for the mandatory rotation
marker. Plus the leftover-generation eviction arm's missing
confirm-after-claiming, in both modules.
Out: extracting a shared rotation helper (D-03); retention beyond one prior
generation (D-04); the shipped arm where an un-trimmable carried tail leaves
the fresh record over bound (D-08); any change to the reads filter site or the
`rotated` derivation site, which are already correct (D-11); cross-platform
verification of the claim protocol's file-system premises.
Deferred: None.
Plan shape: multiple plans, same phase - the natural seam is per-record
(trace / read-trace), which keeps each plan's file lease clean and stops two
plans editing one module. Parallel execution is disabled in
`.planning/config.json`, so the plans run sequentially.

## Durable decisions

- D-01 (scope): the phase fixes BOTH records. `read-trace.mjs` carries the
  same two defects as `trace.mjs` and is not deferred to a later requirement.
  Rejected: trace only, reading criteria 3-4 as pure regression guards.
  Evidence: TRC-11 cites `GH-169` (the trace half) *and* issue #160, which
  `gh api` returns HTTP 410 "This issue was deleted" for - so the reads half
  rests on the requirement text plus measurement, not a readable issue.
  Measured 2026-08-30 on this checkout, one run each: the "in neither file"
  loss and the over-bound first write both reproduce on both modules (live
  file 105 B over `MAX_TRACE_BYTES`, 74 B over `MAX_READS_BYTES`).
- D-02 (eviction arm): the leftover-generation eviction arm's missing
  confirm-after-claiming IS in scope, and the comment saying it "stays that
  way" is revisited rather than honoured. Rejected: honouring the comment and
  fixing only the carry-back, which risks leaving AC1 red on this path.
  Evidence: `cadence-core/bin/lib/trace.mjs:849-855` withholds the confirm
  because "its own discriminator already answers", but that discriminator is
  `rotationInFlight` read at `:803`, BEFORE the `renameSync(sibling, path)` at
  `:835` - so a writer that linked in between has its live claim renamed away
  with no confirm to put it back. Same shape at
  `cadence-core/bin/lib/read-trace.mjs:595-681`.
- D-03 (no generalization): the two rotations stay two separate
  implementations; no shared helper is extracted. Rejected: folding them into
  one rotate. Evidence: `cadence-core/bin/lib/read-trace.mjs:447-453` states
  this as its own D-01 ("A SECOND rotation, never a generalization of
  `rotateTrace`") and names drift as the accepted cost.
- D-04 (retention): exactly one prior generation - no `trace.2.jsonl`, no
  dated generations, no keep-N. Evidence:
  `cadence-core/bin/lib/trace.mjs:99-111`,
  `cadence-core/bin/lib/read-trace.mjs:483-485`, pinned at
  `cadence-core/bin/trace.test.mjs:538-560`.
- D-05 (where the loss is): the loss is a TWO-STEP - rotation 1 leaves a
  racing writer's bytes only in the generation, then rotation 2 evicts that
  generation. The fix therefore makes the winner's carry-back (or the loser's
  append target) complete; it does not make the second rotation keep more.
  Rejected: enforcing at the eviction by refusing to evict a grown
  generation, and re-verifying the live path's inode at the loser after the
  wait budget expires. Evidence:
  `cadence-core/bin/lib/trace.mjs:891-909` - the carry-back is 4 passes and
  `break`s the instant `grown <= seen`, so in practice one pass;
  `cadence-core/bin/lib/read-trace.mjs:475-481` - reads has no carry-back at
  all, by design. Measured 2026-08-30: hand-planting one line into
  `trace.1.jsonl` after a completed rotation and forcing a second rotation
  loses it from both files, deterministic, 1/1; a six-writer spawned race at a
  doubly-padded root lost a writer's event from both files in 1 of 60 trials,
  consistent with GH-169's reported 2/40.
- D-06 (which admission check): the check to change is `appendEvent`'s
  `pending >= MAX_TRACE_BYTES` and `appendRead`'s
  `pending >= MAX_READS_BYTES` - NOT the re-stat refusal inside the rotation.
  Rejected: folding the reserve into `rotateTrace`/`rotateReads` and having
  them refuse. Evidence:
  `cadence-core/bin/lib/trace.mjs:1014-1025` and
  `cadence-core/bin/lib/read-trace.mjs:778-789` are the admission sites;
  `freshRecord` already counts the marker into `owed`
  (`cadence-core/bin/lib/trace.mjs:500`), and the re-stat at
  `cadence-core/bin/lib/trace.mjs:823` / `read-trace.mjs:643` judges the OLD
  record, so neither is the site the shortfall comes from.
- D-07 (two reserves, not one): the reserve cannot be a single constant. The
  reads marker is fixed-shape; the trace marker embeds `corr` and `phase`
  copied off the carried anchor, and `phase` reaches the record unvalidated.
  Evidence: `cadence-core/bin/lib/trace.mjs:491-498` (the marker takes
  `anchorCorr` and `anchorPhase`) and `:407-419` (`renderEvent` passes `phase`
  straight through), against `cadence-core/bin/lib/read-trace.mjs:688-693`
  (`{ts, event, file}`, nothing caller-supplied).

## Decisions

- D-08 (bound of criterion 2): AC2 binds the marker-plus-pending case only.
  The shipped arm where an un-trimmable carried tail leaves the fresh record
  over its bound stays as it is. Rejected: reading criterion 2 strictly so the
  fresh record never exceeds the bound, which reopens the bracket-count rule
  at `cadence-core/bin/lib/trace.mjs:446-456`. Evidence: that arm is stated
  deliberately at `:452-456` and pinned at
  `cadence-core/bin/trace.test.mjs:397` ("a tail bigger than the bound is
  carried anyway, never refused"); measured 2026-08-30 with a legitimate
  anchor present, the fresh record landed 66 B over the bound through that arm
  alone.
- D-09 (accepted behaviour change): tightening the admission check moves a
  narrow band of event sizes - between `MAX - marker` and `MAX` - from "rotate
  and land" to `oversized-event` / `oversized-record`. That change is
  intended, not collateral. Evidence:
  `cadence-core/bin/lib/trace.mjs:1015-1019`,
  `cadence-core/bin/lib/read-trace.mjs:779-783`, and the rows pinning the
  refusal at `cadence-core/bin/trace.test.mjs:635` and
  `cadence-core/bin/read-trace.test.mjs:371`.
- D-10 (reproduction shape): the reproduction is hand-planted state driven
  through the real `appendEvent` / `appendRead`, NOT a spawned multi-process
  race. Rejected: keeping the spawned race and repeating it until reliably
  red (real wall-clock cost per run), and adding a test-only seam into the
  carry-back loop. Evidence: the repo's own precedent for forcing an
  interleaving deterministically is the `heldClaim` helper at
  `cadence-core/bin/trace.test.mjs:151-173` ("a spawned holder is reserved for
  the multi-writer race the `writer()` helper already runs") and `:514-536`
  ("forced deterministically"); measured 2026-08-30, the race loses 1 in 60
  trials while the deterministic plant fails 1/1.
- D-11 (test placement): new rows go into the existing
  `cadence-core/bin/trace.test.mjs` and
  `cadence-core/bin/read-trace.test.mjs`; a new test file would need
  registering. Evidence: `cadence-core/bin/test.mjs:43-76` freezes the group
  lists and `cadence-core/bin/test-groups.test.mjs` is its second reader -
  `trace` sits in the `planning` group, `read-trace` falls into `other`.
- D-12 (read paths do not move): criterion 3's "never counted as an event"
  is about the READS marker only - the trace marker is deliberately pushed
  into `events[]` and counted in `counts.lifecycle`. Criterion 4 is satisfied
  by leaving the marker in the fresh record and both envelopes untouched.
  Evidence: `cadence-core/bin/lib/trace.mjs:1310-1313` (the marker sets
  `rotated` then falls through into `out.events` and `out.counts`) and
  `:276-280` ("INERT in the renderer" means it pairs with nothing, not that it
  is uncounted), against `cadence-core/bin/planning/core.mjs:375-379`, which
  `continue`s past the reads marker so it never becomes a record;
  `planning/core.mjs:366-381` is the single reads filter feeding
  `planning/reads.mjs:29` and `planning/trace.mjs:1010-1013`, and the trace's
  `rotated` comes off `lib/trace.mjs:1323` into `planning/trace.mjs:1000` and
  `:1056`.
- D-13 (no new artifact): the fix introduces no new on-disk artifact. If one
  proves unavoidable, its name is spelled ONCE as an export, carries
  `.gitignore` lines, and is accounted for by the tests' sibling helpers.
  Evidence: `cadence-core/bin/planning/trace.mjs:86-123`
  (`READS_IGNORE_LINES`, every basename derived from the module's exports),
  `.gitignore:32-46`, `cadence-core/bin/trace.test.mjs:125-136` (`siblings()`
  / `ROTATED_SET`), and the v3.7.5 phase 4 UAT row "The sidecar name is
  spelled once and accounted for". Note
  `cadence-core/bin/planning/trace.mjs:111-114` records that the trace's own
  `.rotate` and `.evict` temps are deliberately left unignored - out of scope
  here.

## Acceptance criteria

- [ ] AC1: On the pre-fix code, the new contended-second-rotation row in
      `cadence-core/bin/trace.test.mjs` and its twin in
      `cadence-core/bin/read-trace.test.mjs` both FAIL; after the fix both
      PASS. Each asserts the racing writer's event is present in exactly one
      of the live record or the rotated sibling, never in neither.
- [ ] AC2: With a pending event of `MAX_TRACE_BYTES - 8` bytes (and
      `MAX_READS_BYTES - 8` for the reads record), the live record's size
      after the rotation's first write is at or below its bound. Measured
      2026-08-30 on the current code: 105 B and 74 B over respectively.
- [ ] AC3: A writer that claims the live file after a leftover-generation
      eviction has already started still finds its event in the live record
      afterward. One test row per record covers this arm.
- [ ] AC4: After a second rotation, `node cadence-core/bin/planning.mjs reads`
      and `node cadence-core/bin/planning.mjs trace suggest` each still report
      the rotation on their own key, and the reads marker appears in none of
      `calls`, `byAgent`, or the unresolved/coordinator split.
- [ ] AC5: `node cadence-core/bin/test.mjs` is green and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Flagged assumptions

- Cross-platform atomicity of `linkSync` / `renameSync` / `O_APPEND` writes -
  Unclear; the whole claim protocol assumes POSIX single-winner `link(2)`, an
  atomic replacing `rename(2)`, and that an `appendFileSync` larger than the
  pipe buffer cannot interleave with another process's write. The codebase
  states these as premises at `cadence-core/bin/lib/trace.mjs:633-647` but
  contains nothing verifying them off Linux, and the no-hard-links fallback at
  `:766-778` is the only acknowledgement of a differing host. Left flagged by
  user decision: phase 5 targets Linux behaviour and does not widen the
  platform claim. If wrong: the fix holds on Linux and the record can still
  lose events on a host whose file system differs, with no test that would say
  so.
