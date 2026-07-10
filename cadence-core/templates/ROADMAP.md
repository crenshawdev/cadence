# ROADMAP.md template

Fill and write to `.planning/ROADMAP.md` - phases with falsifiable success
criteria. /cad-phase edits phases later; /cad-milestone prunes completed ones
at version cuts (git is the archive - no collapsed-history sections here).

<template>

```markdown
# Roadmap: [Project Name]

## Overview

[One paragraph: the journey from nothing to done, and why the phases are
ordered this way.]

## Phases

- [ ] **Phase 1: [Name]** - [one-line description]
- [ ] **Phase 2: [Name]** - [one-line description]

## Phase Details

### Phase 1: [Name]
**Goal:** [What this phase delivers]
**Depends on:** Nothing (first phase)
**Requirements:** [CAT]-01, [CAT]-02
**Success Criteria:**
1. [Falsifiable, observable: "running X shows Y", "user can Z"]
2. [Criterion]

### Phase 2: [Name]
**Goal:** [What this phase delivers]
**Depends on:** Phase 1
**Requirements:** [CAT]-03
**Success Criteria:**
1. [Criterion]
2. [Criterion]
```

</template>

Notes:
- Phase count follows config `granularity`: coarse 3-5, standard 5-8,
  fine 8-12. When in doubt, fewer phases.
- Prefer vertical slices: each phase delivers something a user can exercise
  end to end, not a horizontal layer to be wired up later.
- Success criteria are what /cad-verify checks: 2-5 per phase, each a
  statement that could be shown false. "X works" is not a criterion.
- Integer phases are planned work. Decimal phases (2.1, 2.2) are urgent
  insertions added later via /cad-phase; execution follows numeric order.
- Every v1 REQ-ID appears in exactly one phase; the Traceability table in
  REQUIREMENTS.md mirrors this mapping.
- Phase status is the `## Phases` checkbox, and nothing else: `- [ ]` open,
  `- [x]` complete. /cad-verify checks the box when a phase's UAT fully
  passes; /cad-progress reconciles it if it ever drifts. There is no separate
  progress table - live status is derived by /cad-progress from phase
  artifacts (git is the log, not a hand-maintained mirror).
- No time estimates, no plan sub-lists - plans live in
  .planning/phases/<N>/PLAN.md, created by /cad-plan when a phase starts.
