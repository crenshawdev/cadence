# Roadmap

## Overview

**`v3.5.5 - a seam that accepts what it should refuse`, opened 2026-08-18.**
Scoped from the tracker milestone `v3.5.5`, which holds twelve issues: #137,
#142, #144, #147, #182, #183, #219, #220, #221, #222, #223 and #224. Six of
those (#219 through #224) were filed at the open, from a full audit of the
capture queue that re-verified each defect live rather than trusting its note.

**The theme is one sentence: an argument face that says yes to input it has a
rule against.** `v3.5.4` closed the shape for a control that reaches its path
and mis-answers. This cycle takes the door: a reader that accepts a malformed
value and answers as if it were well-formed, a guard that reads an empty string
as a configured one, a gate that cannot be satisfied by the key its own seam
document permits.

The first four phases are ordered by what a wrong answer costs, not by where the
code lives. Phase 1 carries the two that REMOVE a protection - one unprotects every
branch, the other lets one repository answer another's blocking gate. Phase 2
carries the readers that accept malformed input and answer anyway. Phase 3
carries the gates that fire on themselves or cannot be satisfied at all. Phase 4
is the structural form of phase 2, and goes last on purpose: a declarative
argument contract is only worth writing once the case-by-case fixes have said
what it has to express.

Phase 5 is not part of that theme and does not pretend to be. It is the README
restructure decided 2026-08-18, promoted into this cycle from the capture queue
rather than held for a docs milestone. It shares no code with the four defect
phases and depends on none of them.

The prune left the Overview describing `v3.5.4`; it now describes this cycle.

## Phases


## Phase Details
