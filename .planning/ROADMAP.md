# Roadmap: v3.5.9 - the defects that were filed and never read

## Overview

**`v3.5.9`, opened 2026-08-22.** Scoped from the tracker, which holds #231 and
#232: ten defects, every one reproduced by execution against the current tree,
filed between 2026-08-05 and 2026-08-08, archived unread in
`.planning/CAPTURE.md`, and re-verified live on 2026-08-22 by the archive triage.

**The theme is one sentence: the release seam and the frontmatter reader both
return a clean answer over a case they did not actually handle.** Every defect
here is a false green, not a crash. A close continues over a manifest that was
never bumped. A changelog promotion truncates at a `## ` inside a fenced block.
A heading with nothing under it passes the empty-section halt. An absent
`CHANGELOG.md` is reported as a clean run. And two plans that write the same file
are cleared to run in parallel worktrees because one of them decorated the path.

The two phases split on subsystem, not on severity, because the two subsystems
fail for different reasons and their tests have nothing in common. Phase 1 is
the release/changelog seam - the seam `v3.5.8` rewrote, where item 6 of #231 and
the open item `v3.5.8` phase 2 filed against `release-decision.mjs`'s JSDoc code
set are the same defect class filed two weeks apart, neither aware of the other.
Phase 2 is the frontmatter reader underneath `plan-overlap`.

**The citations are fresh and should be checked anyway.** Both issues were
re-verified on 2026-08-22 against the current tree, so their line numbers are
days old rather than weeks. `v3.5.8` phase 1 still had to re-derive a stale #145
citation that the file had grown past. Re-run each reproduction before planning
rather than trusting the issue text.

This cycle seeds ids up front - `REL-01`, `REL-02`, `REL-03`, `FRM-01`, `FRM-02` -
so every one is either traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.

## Phases


## Phase Details
