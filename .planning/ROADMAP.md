# Roadmap: v3.6.0 - reading the corpus back

## Overview

**`v3.6.0`, opened 2026-08-23.** Scoped from the tracker's #190, #191 and #192,
filed 2026-08-16 and held out of `v3.5.9` as a cycle of their own rather than
filler for a defect cycle.

**The theme is one sentence: everything Cadence writes down is written by a gate
and read by nobody.** The Core Value claims the record comes back on its own at
the moment it matters, and that is the one claim in this project with no evidence
behind it. Recall ships and nothing checks that it landed, so a planner can
receive twelve prior decisions and cite none of them (#190). The corpus can
already answer "why is this code like this" and no command walks the join (#192).
And `/cad-task`, the path most real work actually takes, leaves commits and
nothing recall can find, no risk-surface check on its committed range, and no
trace bracket (#191).

**Advisory before gate, reader before writer.** #190 REPORTS the zero-citation
case rather than refusing it, and becomes a gate only once there is data on how
often that case is legitimate. #192 is a deterministic seam join with no model
judgment and no summarization pass. Nothing in this cycle changes what the write
side records, which is what keeps it falsifiable.

**The fast path gains guarantees, not machinery.** #191 explicitly does not add a
context step, a plan gate or a verify walk to `/cad-task`. Below roughly half a
day of work the phase overhead dominates, and adding the spine back is how the
fast path becomes the thing it exists to avoid.

This cycle seeds ids up front - `RBK-01`, `FST-01`, `FST-02`, `FST-03`, `WHY-01` -
so every one is either traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.
Phases are added with `/cad-phase add`.

## Phases


## Phase Details
