# Roadmap: v3.7.7 - the record says what happened

## Overview

**`v3.7.7`, opened 2026-08-28.** Two phases, both filed as S2 off real runs
rather than off a read: `GH-145` and `GH-159`. The thread between them is that a
record Cadence keeps cannot represent a state that actually occurs, and in both
cases it fails silently rather than refusing.

**What is broken.** `.planning/reads.jsonl` has a write-time bound at
`lib/read-trace.mjs:52` (`MAX_READS_BYTES`, 8 MiB) and no rotation: at the bound
`:282` returns `size-cap` and every later append is dropped, permanently. This
repository's own file measured 7.5 MiB on 2026-08-28, 93% full, against 0.37 MiB
for a project two cycles old, so the fill tracks age and not size and the oldest
project fails first. That file is the evidence base `trace suggest` joins and the
one the v3.7.6 AC6 result was measured from, so losing it also loses the ability
to re-check what shipped. `lib/trace.mjs` already solves exactly this problem for
the trace record - `rotateTrace` at `:660`, a claim sidecar with staleness
eviction, and a `record_rotated` marker - and none of it is reachable from the
reads writer.

Second, a blocking gate is documented to report its below-blocker/high findings
and move past them, and the adjudication record refuses to store that. `RULINGS`
at `lib/adjudication-record.mjs:79` is `survived | downgraded | refuted`, and
`:366` requires a `fix_commit` on every `survived` entry, while
`lib/filing-decision.mjs:76-79` and `references/triage-gate.md:41-43,277-278`
both define a survived finding below blocker/high as one that was NOT fixed. So
the remainder state has no representation: the fire cannot be settled without
either fixing a finding the gate never asked to have fixed, or recording a ruling
the adjudicator does not hold. Measured cost on one foreign-project run: three
halts and three subagent dispatches the gate had not earned.

**The standard.** Would a user on their own project feel it. Both do, and both
were found that way rather than Cadence-on-Cadence: the reads cap kills the
record on whichever project has been running Cadence longest, and the ruling gap
halts any run whose blocking gate returns a medium with nothing above it.

## Open Questions

- **OQ-1 - shared rotation or a second one.** `rotateTrace` is written against
  the trace filenames and carries a "run in flight" tail that `reads.jsonl` has
  no analogue for. Whether phase 1 generalizes that function or writes a second
  rotation beside it, reusing the link-claim technique but not the code, is
  phase 1 planning's call. The rail is that the trace record's own rotation
  behaviour does not change: it was fixed in v3.7.5 and is not being reopened.
- **OQ-2 - a fourth ruling, or a conditional requirement.** `GH-159` can be
  closed either by adding a ruling value meaning "confirmed, not fixed" or by
  gating the `fix_commit` requirement on the raised severity being blocker or
  high, which is the predicate `filing-decision.mjs` already uses. The typo
  guard at `:132-137` that the requirement actually exists to serve must survive
  either way.

## Phases

- [x] **Phase 1: reads.jsonl rotates instead of dying at the cap**
- [x] **Phase 2: a confirmed finding can be recorded unfixed**

## Phase Details

### Phase 1: reads.jsonl rotates instead of dying at the cap

`.planning/reads.jsonl` reaches its 8 MiB bound and stops recording forever
instead of rotating. Give it a rotation, keeping exactly one prior generation,
without changing how the trace record rotates.

**Success criteria**

- A writer that reaches `MAX_READS_BYTES` rotates rather than returning
  `size-cap`, and the append that triggered it lands.
- Exactly one prior generation is kept, evicted by the next rotation, so the
  pair on disk is bounded and there is no retention key to tune.
- Two processes appending across the bound at once lose no record and leave no
  claim behind that would stop a later rotation.
- A killed rotation does not disable rotation permanently: an abandoned claim is
  reclaimed by a later append.
- `lib/trace.mjs`'s own rotation behaviour is unchanged, proven by its existing
  rotation rows still passing untouched.
- A reader can tell a rotated record from a whole one rather than reading a
  truncated file as complete.

### Phase 2: a confirmed finding can be recorded unfixed

A blocking gate's below-blocker/high remainder is documented as reported and
moved past, and `adjudication-record.mjs` cannot store that state. Close the gap
without losing the typo guard the `fix_commit` requirement actually exists for.

**Success criteria**

- A finding confirmed at a severity below blocker/high can be adjudicated and
  recorded without inventing a fix commit or a ruling the adjudicator does not
  hold.
- A `survived` blocker or high still requires its fix commit, and a misspelled
  `fix_commit` key is still refused rather than silently stored.
- `issue-filing unfixed` no longer returns an entry that carries a real fix
  commit, so the filing step cannot open issues for committed work.
- `adjudication-record.mjs`, `filing-decision.mjs` and
  `references/triage-gate.md` agree on what `survived` means, with a test that
  reddens if they drift apart again.
- The reproduction in GH-159 settles cleanly end to end: a blocking fire
  returning a medium with nothing above it can be closed.
