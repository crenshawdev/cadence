# REQUIREMENTS.md template

Fill and write to `.planning/REQUIREMENTS.md` - checkable requirements that
define "done". The Traceability table is filled during roadmap creation and
updated as phases complete.

<template>

```markdown
# Requirements: [Project Name]

**Defined:** [date]
**Core Value:** [from PROJECT.md]

## v1 Requirements

Committed scope. Each maps to exactly one roadmap phase.

### [Category]

- [ ] **[CAT]-01**: [User-centric, testable, atomic requirement]
- [ ] **[CAT]-02**: [Requirement]

### [Category]

- [ ] **[CAT]-01**: [Requirement]

## v2 Requirements

Deferred. Tracked, not in the current roadmap.

### [Category]

- **[CAT]-01**: [Requirement]

## Out of Scope

Explicit exclusions. The reason prevents scope creep later.

| Feature | Reason |
|---------|--------|
| [Feature] | [Why excluded] |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| [CAT]-01 | Phase [N] | Pending |

**Coverage:** [X] v1 requirements, [Y] mapped, [Z] unmapped

---
*Last updated: [date] after [trigger]*
```

</template>

Notes:
- REQ-ID format: `[CATEGORY]-[NUMBER]` with a 3-5 letter category code
  (AUTH-01, CLI-02, SYNC-03). IDs are stable; never renumber.
- A good requirement is specific and testable ("User can reset password via
  email link", not "Handle password reset"), user-centric ("User can X", not
  "System does Y"), and atomic (one capability each).
- Status values: Pending / Complete / Deferred. /cad-verify flips a phase's
  requirements to Complete when that phase's UAT fully passes (Complete means
  implemented AND verified, never just written); /cad-progress reconciles if
  it drifts. `Deferred` is the ONE pinned marker for a requirement explicitly
  postponed with the user's consent - /cad-audit lists deferred rows
  separately and never counts them as delivered; no other deferral notation
  is recognized.
  This column and the ROADMAP phase checkbox are the only persisted status -
  everything else is derived.
- Unmapped v1 requirements are a roadmap gap - coverage must reach 100%
  before the roadmap is approved.
