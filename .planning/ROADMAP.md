# Roadmap: v3.7.4 - cut the cost the record can now measure

## Overview

**`v3.7.4`, opened 2026-08-26.** Four phases against the `Dispatch cost`
milestone, which `v3.7.3` opened and did not finish. That cycle fixed the
instruments and closed at phase 1; this one spends what they measure - and, at
phase 2 planning, discovered it has to finish one instrument first.

**Why this scope and not the rest of the tracker.** The 31 open issues were
triaged 2026-08-26 against one question: would a user running Cadence on their
own project ever feel this, or does it only bite while Cadence is being
developed on Cadence? Three issues answered the second way and were declined
(GH-109, GH-111, GH-139). Everything in this cycle answers the first way, and
the first three are felt as money on every dispatch a user makes.

**The measured state.** `cad-executor` is 25,587,266 of 50,145,905 recorded
tokens, 51% of the whole record, and its dispatches re-read 3.52 times per
distinct file, worst case `cadence-core/bin/planning.mjs` opened 57 times inside
one dispatch. 39 checkpoint returns say plans exceed one context. 233 of 239
executor dispatches across cadence and verbatim ran opus at `shipped`, and the
routing discount fired 6 times in total.

**What changed since that was written.** `TRC-05` shipped in `v3.7.3`, so a
bracket CAN record cache traffic. `RNG-03` declared itself blocked on exactly
that, and its layout half is now unblocked. Its measurement half is not: phase 2
planning replayed the `SubagentStop` hook's own rule against the live record and
found 399 brackets carrying 0 cache figures, refused two gates earlier than the
recording path. That is `TRC-07`, promoted out of deferral on 2026-08-26 as
phase 3. The cycle grew a phase rather than shipping a claim it could not check.

**What this cycle is not.** It is not the worktree question (`Worktree verdict`,
blocked on GH-119 and GH-120), it is not reviewer calibration (`Finding flood`,
GH-100), and it is not GH-137, which is the highest-severity user-facing bug on
the tracker but belongs to the execute path rather than to dispatch cost. It is
filed and named here so the next cycle does not have to rediscover it.

## Open Questions

- **OQ-1 - what a byte bound actually bounds.** `BUD-03` can bound the declared
  bytes, the estimated tokens, or refuse at plan time versus warn. The measured
  case (four files, 252,473 B, ~63,000 estimated tokens inside a 70,554-token
  dispatch) says the ratio is stable enough to bound either way. Decided at
  phase 1 planning against the actual `files:` declarations in the archive.

- **OQ-2 - whether the risk floor can read a diff at plan time.** `RSK-05` wants
  the floor to stop inheriting a whole file's matches, but at `check_census`
  time there is no diff yet, because the plan has not run. Whether the fix is a
  narrower read, a waiver key, or a planner-contract line telling planners to
  declare narrow files is decided at phase 1 planning by reading what
  `planning/risk-check.mjs` actually has in hand at that moment.

## Phases


## Phase Details
