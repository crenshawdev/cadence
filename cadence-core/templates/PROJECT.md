# PROJECT.md template

Fill and write to `.planning/PROJECT.md` - the living project context: what
this is, why it exists, and its boundaries. Evolves at milestone boundaries
via /cad-milestone; do not embed evolution procedures in the document itself.

<template>

```markdown
# [Project Name]

## What This Is

[2-3 sentences. What it does and who it's for, in the user's own framing.
Update whenever reality drifts from this description.]

## Core Value

[The ONE thing that must work. One sentence. Drives prioritization when
tradeoffs arise.]

## Requirements

### Validated

[Shipped and confirmed valuable. Format: `- ✓ [capability] - [phase/version]`.
For a brownfield init, seed with what the existing code already does.]

(None yet - ship to validate)

### Active

[Current scope. Hypotheses until shipped and validated.]

- [ ] [Requirement]
- [ ] [Requirement]

### Out of Scope

[Explicit exclusions, each with a reason - the reason prevents re-adding later.]

- [Exclusion] - [why]

## Context

[Background that informs implementation: technical environment, prior work,
known issues, current state of any existing code.]

## Constraints

- **[Type]**: [What] - [Why]

[Common types: tech stack, timeline, dependencies, compatibility,
performance, security.]

## Key Decisions

[Choices that constrain future work. Add rows as decisions are made.]

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice] | [Why] | - Pending |

---
*Last updated: [date] after [trigger]*
```

</template>

Notes:
- Capture everything gathered during questioning; do not compress.
- Core Value rarely changes. If it does, that is a pivot - log it in Key Decisions.
- Outcome column values: `✓ good`, `revisit`, `- pending`.
- Validated requirements are locked; changing one requires explicit discussion.
