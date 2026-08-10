# Roadmap

## Overview

**`v2.6.2 — what the plugin carries`, opened 2026-08-10.** Scoped from a
context-weight sweep of Cadence's own eager surfaces — four parallel read-only
passes over the heaviest `@`-included prose, recorded in
`design-notes/sweep-2026-08-10-context-weight.md` and filed as issues #98-#103.

The measured baseline: 119,232 est tokens of shipped prose, and an eager set per
command of 28,682 B on `/cad-execute`, 24,533 B on `/cad-verify`, 22,662 B on
`/cad-plan`, 20,777 B on `/cad-context`, 20,547 B on `/cad-config` and 18,209 B
on `/cad-land`. Those are the bytes an `@`-include puts in context on turn one
and keeps there every turn after, before the command reads a single project
file. ~39,700 B of it is removable.

**The sweep also falsified the obvious hypothesis, and that is why this cycle
looks the way it does.** Skill frontmatter `description:` fields — the suspected
bloat — total 3,730 B across all 29 skills, against 27,940 B for
`workflows/execute.md` alone. One command's eager include outweighs the entire
description surface by 7x, and descriptions are what make the model select the
right command at all. Nothing in this cycle touches them.

**Phase 1 is checks, not cuts, and the ordering is the design.** This tree
shipped a 5,792 B eager include that nothing has ever read, with a `CHANGELOG`
entry defending it on a comparison that is false on inspection. Two CI holes let
that happen and are still open: check 13 cannot watch a deferral made from a
workflow file or a contract skill, and no check at all catches an `@`-include
whose consumer does not exist. Cutting prose before those close means cutting it
on exactly the evidence that produced the defect — and phase 3's deferrals would
ship unguarded by the one check written to guard them.

**Phase 2 is bounded by a real risk and is sequenced accordingly.** Roughly
9,000 B of what it removes is rationale, and this repo keeps rationale because
removing it caused regressions before. Rationale bound to a rule the model
applies at runtime stays; rationale addressed to a human maintainer moves to a
`.mjs` header or a design-note, where it costs zero context. `self-verify`
structurally cannot tell those apart, which is why each surface gets its own
commit and its own `/cad-verify` walk rather than one bulk edit.

## Phases


## Phase Details

