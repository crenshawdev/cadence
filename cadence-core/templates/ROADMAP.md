# ROADMAP.md template

Fill and write to `.planning/ROADMAP.md` - phases with falsifiable success
criteria. The `## Phases` list is generated from the state file and never
edited by hand: write the heading empty and enter each line with `phase-entry
add`. /cad-phase edits phases later; /cad-milestone prunes completed ones
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
- Integer phases are planned work. Decimal phases (2.1, 2.2) are urgent
  insertions added later via /cad-phase; execution follows numeric order.
- Phase status is held in the state file and shown as the `## Phases`
  checkbox: `- [ ]` open, `- [x]` complete. /cad-verify completes a phase when
  its UAT fully passes. A status that drifts is reported by /cad-progress, which
  edits neither file (this one or REQUIREMENTS.md) and routes to /cad-verify
  where the drift involves completion. There is no separate progress table -
  /cad-progress derives live status from phase artifacts.
- No time estimates, no plan sub-lists - plans live in
  .planning/phases/<N>/PLAN.md, created by /cad-plan when a phase starts.
