# REQUIREMENTS.md template

Fill and write to `.planning/REQUIREMENTS.md` - checkable requirements that
define "done". The Traceability table is generated from the state file and
never edited by hand: write it as bare headers; `/cad-plan` seeds each row when
its phase is planned (`references/req-traceability.md`).

<template>

```markdown
# Requirements: [Project Name]

**Defined:** [date]
**Core Value:** [from PROJECT.md]

## Active

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

Bare headers - `/cad-plan` seeds a row per requirement when its phase is
planned (`references/req-traceability.md`).

---
*Last updated: [date] after [trigger]*
```

</template>

Notes:
- REQ-ID format: `[CATEGORY]-[NUMBER]` with a 3-5 letter category code
  (AUTH-01, CLI-02, SYNC-03). IDs are stable; never renumber.
- A requirement reads "User can X", not "System does Y", and is atomic
  (one capability each).
- `## Active` bullet form: `- **[CAT]-01**: [requirement]`, one bullet per
  committed requirement (the checkbox shown above is optional and tolerated,
  never required). An unbolded bullet declares no id - see
  `references/req-traceability.md` for the full stated grammar.
- Status values: Pending / Complete / Deferred. /cad-verify flips a phase's
  requirements to Complete when that phase's UAT fully passes (Complete means
  implemented AND verified, never just written). `Deferred` is the ONE marker
  for a requirement explicitly postponed with the user's consent; no other
  deferral notation is recognized. A status that drifts is reported by
  /cad-progress, which edits neither file (this one or ROADMAP.md) and routes
  to /cad-verify where the drift involves completion.
