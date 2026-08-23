# Roadmap: v3.6.1 - the gaps v3.6.0 named

## Overview

**`v3.6.1`, opened 2026-08-23.** A patch cycle over the three gaps the `v3.6.0`
changelog states about its own work, and nothing else. No new command, no new
surface, no theme beyond closing what shipped named.

**The theme is one sentence: `/cad-why` reaches less of the corpus than it
claims, and says so in a comment rather than in its behavior.** All three
defects are in what `v3.6.0` shipped, and all three are measured rather than
suspected.

The bare-path arm inherits git's default history simplification, so the join is
correct and the history it reaches is short: 7 commits against 10 with
`--full-history` on `lib/release-decision.mjs`, the three missing being the
merges `b86fc25c`, `051f0df1` and `9237a539`, none of which resolves to a
planning record (`WHY-02`). The
renderer's entry cap of 10 claims ten entries stays under the 10,000-byte line
in `references/conventions.md`, and `planning.mjs` renders 15,637 B (`WHY-03`).
And `closeOver` compares `%cI` timestamps as strings, so a mixed-offset pair
straddling a prune can attach to the wrong close (`WHY-04`).

**What this cycle is not.** It does not touch the read-back gate. `cite-count`
stays ADVISORY for the reason `v3.6.0` stated: it becomes a gate only once there
is data on how often a zero-citation plan is legitimate. Nothing here changes
what the write side records.

This cycle seeds ids up front - `WHY-02`, `WHY-03`, `WHY-04` - so every one is
either traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.
Phases are added with `/cad-phase add`.

## Phases


## Phase Details
