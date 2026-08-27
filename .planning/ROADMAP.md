# Roadmap: v3.7.5 - the defects a user's own project feels

## Overview

**`v3.7.5`, opened 2026-08-26.** Five phases, eight issues, one admission
criterion: would a user running Cadence on their own project ever feel this, or
does it only bite while Cadence is being developed on Cadence?

**Why this scope and not the tracker.** The 22 open issues were re-triaged
2026-08-26 against that question alone, and seven answered the first way. They
are not a subject, they are a standard, and the cycle is honest about that: the
forge cluster hard-blocks a user with a self-hosted instance on a non-default
port, the replay bug charges them for a dispatch that does nothing, the risk
detector trips on their own review record, an abandoned rotation claim quietly
drops the bound the record is supposed to keep, and recall misses `seams` when
they typed `seam`.

**What was left out, and why.** GH-144, GH-130 and GH-100 are Cadence-on-Cadence
by their own labels. GH-119, GH-120, GH-107 and GH-102 are measurements and
questions, not deliverables. GH-140 is a keep/cut decision with no code behind
it yet. GH-148 was filed this same day out of the GH-137 spike and is genuinely
real, but its whole consequence lands in a trace record users do not read, so it
fails the standard this cycle is built on and waits.

**GH-145 is the close call.** `.planning/reads.jsonl` goes permanently
write-dead at 8 MiB with no rotation, and this repo is at 7.00 MiB. That is a
real deadline, but it is OUR deadline: the file got there on 935 sessions of
Cadence-on-Cadence. A user reaches it eventually and no user reaches it soon, so
it is excluded on the same standard as everything else rather than promoted on
urgency that belongs to the maintainer.

**What phase 2 already knows.** GH-137's blast radius is measured, not assumed:
`.planning/spikes/execute-replay-blast-radius/SPIKE.md` (bd052ac3) ran two real
executor dispatches against already-committed work and found both noisy - zero
commits, zero byte changes. That is why phase 2 is a guard and not a resume
path, and it is why phase 2 is small.

## Open Questions

- **OQ-1 - where the replay guard lives.** The spike recommends `execute.md`'s
  `locate` step, because minting a new derived status in `derivePhases`
  (`bin/planning/core.mjs:191-206`) makes `status`, `audit`, `phase-done` and
  the cursor all learn it at once. The workflow guard is the smaller change and
  covers the reported bug. The derivation is the more honest place, since the
  wrong answer is the derivation's. Phase 2 planning decides, and the cheaper
  reading is not automatically right.
- **OQ-2 - whether the port half belongs in the key or comes out of the
  comparison.** GH-106 states both readings: `git.forge_host` grows a port
  grammar, or `loginNamesHost` drops the port half it cannot be given. Phase 1
  picks one, and the one that leaves a ported instance addressable wins.

## Phases


## Phase Details
