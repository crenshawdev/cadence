# Roadmap

## Overview

**`v3.4.1 - what the config says is what routing does`, opened 2026-08-15.**
Scoped off the Forgejo milestone, which holds three issues: #129, #134 and
#135. One phase carries all three.

**The theme is one sentence: three surfaces describe the review gates and no
check makes them agree.** `config.mjs get` answers a gate from the schema
default when no layer set one, `config.schema.json`'s prose names a level's
gate, and `route-table.json` is what actually fires. `phase_diff` is the case
already on the floor: the schema calls it `advisory` at `shipped`, the route
table says `off`. The last cycle worked around the same defect rather than
fixing it, and `workflows/execute.md` still carries the paragraph explaining
why it must not pre-fetch a gate through `config.mjs get`.

`self-verify.mjs` is where it closes. It fails in both directions on rung files
and routing cells, and it has never compared a trigger's schema default or its
prose to `route-table.json`, so the drift was invisible to the one check whose
job is catching exactly this.

This cycle adds no key, no flag and no command. All three requirements are
corrections to surfaces that already ship.

**One phase, not three.** GAT-03 is the data edit, GAT-02 is the read face and
ENF-02 is the check that keeps them from drifting apart again, and splitting
them would land a reconciliation in one phase and the check proving it holds in
another. The enforcement lands with the fix it enforces, watched to fail against
the unpatched files first - the same shape `v2.6.1` used.

## Phases

- [x] **Phase 1: What the config says is what routing does** - the schema, `config.mjs get` and `route-table.json` give one answer per trigger per level, and self-verify fails when they do not

## Phase Details

### Phase 1: What the config says is what routing does
**Goal:** For every review trigger at every stakes level, `config.schema.json`'s
default and prose, `config.mjs get` and `route-table.json` give one answer, and
`self-verify.mjs` fails when they stop doing so.
**Depends on:** Nothing (first phase)
**Requirements:** GAT-02, GAT-03, ENF-02

Three surfaces describe the review gates and nothing has ever compared them.
`route-table.json` is what fires; `config.schema.json:81` calls
`review.triggers.phase_diff.gate` `advisory` by default and its `purpose` prose
says "advisory at shipped", while `route-table.json`'s `review.shipped.phase_diff`
is `off`. The last cycle met this and wrote around it:
`cadence-core/workflows/execute.md:35` still carries the paragraph telling a
caller not to pre-fetch a gate through `config.mjs get` because the answer would
be the schema default rather than the level's. That paragraph is the defect's
receipt, and it comes out with the defect.

The enforcement is the load-bearing half. `self-verify.mjs` already fails in both
directions on rung files and on the three routing grids (`bin/self-verify.mjs:1046`),
and it reads `config.schema.json` for the gate and stakes vocabularies
(`:1063`) - it has the two files open and has never compared a trigger's gate
across them. Adding that comparison is why one visible `phase_diff` cell is
worth a phase: the cell is a symptom, the missing check is the cause.

Success criteria:
1. A new self-verify check compares every `review.triggers.<t>.gate` schema
   default AND its `purpose` prose against `route-table.json`'s
   `review[level][trigger]`, and it is watched to FAIL against the tree as it
   stands today - reporting the `phase_diff` shipped cell by name - before any
   data edit lands. Proved by running the check against the unpatched files, not
   by inspection.
2. The disagreement is gone: `review.triggers.phase_diff.gate`'s default and
   per-level prose state what `route-table.json` fires, and the criterion-1
   check passes. `plan`, `diff` and `risk_surface` are audited the same way
   across all three levels, each level's answer named in the SUMMARY whether or
   not it moved.
3. `config.mjs get` of a `review.triggers.*.gate` that no layer set stops
   answering as though the schema default were the gate. A reader can tell "no
   layer set this, the stakes level decides" from "this project pinned it", and
   a pinned value still reads back byte-identical. Proved by a failing-capable
   test over both states.
4. The workaround retires: `cadence-core/workflows/execute.md:35`'s paragraph is
   gone or rewritten to state the shipped behaviour, and a repo-wide sweep shows
   no other surface still warning that a `get` of a gate lies.
5. No key, no flag, no command is added. `config.mjs set` of a gate behaves
   exactly as it does today, and the schema's "writing any value pins it at
   every level and warns" claim is still true of the shipped code.
6. `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs`
   both run clean, with the new tests from criteria 1 and 3 in the suite.
