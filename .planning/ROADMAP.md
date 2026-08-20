# Roadmap

## Overview

**`v3.5.7 - measured, and no lever to change it`, opened 2026-08-20.** Scoped
from the tracker milestone `v3.5.7`, which holds four issues: #167, #174, #189
and #206.

**The theme is one sentence: Cadence measures its own cost and gives you nothing
to spend it with.** `v3.5.6` closed the machinery that records what a run did.
This cycle takes the controls over what a run costs. A read trace that measures
read-set redundancy and no consumer that acts on the number (#167). A security
review invoked 61 times, paying 61 cold prefixes where one process reviewing N
diffs pays one (#174). `stakes` as a single project-level dial, so a README phase
and an auth phase buy the same model, the same effort rung and the same gates
(#189). And the one question Cadence asks on its own, the risk-surface interview,
asked exactly once with no way back to it and a menu that offers the same set
twice (#206).

Three of the four are a control at the wrong granularity or missing outright;
#174 is the bill that granularity runs up, which is why it is scoped here rather
than filed as a cost note.

No phases yet. `/cad-phase add` opens the first, and `/cad-plan` seeds each
requirement's Traceability row as its phase is planned. This cycle seeds
requirement ids up front - `RDX-01`, `BCH-01`, `CER-01`, `IVW-01` - because
`v3.5.6` seeded none and its audit consequently traced zero requirements and
returned PASS on an empty set.

## Phases

_None yet._

## Phase Details

_None yet._
