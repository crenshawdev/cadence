# Roadmap

## Overview

**`v3.5.0 - the check that proves it ran`, opened 2026-08-15.** Scoped off the
Forgejo milestone, which holds one issue: #130.

**The theme is one sentence: the only gate live on a default install fires on a
model reading a prose list, and leaves no record either way.** `risk_surface` is
`blocking` at every stakes level, and at the shipped default it is the only
trigger that fires at all. Its firing condition is `workflows/execute.md`
instructing the orchestrator to check a diff against the eight categories in
`references/review-triggers.md`. A fire writes a lifecycle event; a non-match
writes nothing. The run record therefore cannot tell "the detection step was
skipped" from "it ran and matched nothing".

`lib/surface-scan.mjs` is not the missing piece - it is explicitly a scoping
aid, returns every category unconditionally, and never inspects source text. No
risk-check seam exists under `cadence-core/bin/` at all.

RSK-01 is the seam that always records `{checked, categories, matches,
inconclusive}` for a diff range; RSK-02 is what makes plan and task completion
require it. Semantic detection stays heuristic on purpose - what changes is that
"did not run" stops masquerading as "ran clean".

## Phases


## Phase Details
