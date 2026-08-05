---
name: cad-audit
description: "Pre-ship traceability audit - every requirement traced to a phase, plan and verification, orphan detection both directions, a FAIL gate before shipping"
argument-hint: "[milestone | defaults to all active requirements]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Before a milestone ships, prove that nothing was silently dropped. Cross-
reference every requirement against the phases, plans, and verifications that
were supposed to deliver it, and detect orphans in both directions. Produce a
PASS/FAIL verdict: FAIL if any requirement is untraced, unverified, or lost.

This is the check that catches the quiet failure a per-phase flow can miss -
a requirement that no phase ever picked up (an `unpicked` break counted in
`counts.broken`, not a note beside a PASS), or one marked done while its phase
never verified. It reads the authoritative status - the REQUIREMENTS
traceability table (Requirement | Phase | Status) and the ROADMAP `## Phases`
checkbox, the only persisted status. `/cad-plan` creates a table row (always
at Pending); no writer but cad-verify ever sets a Status beyond it, and the
ROADMAP checkbox is cad-verify's alone. It does not write status itself.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/audit.md
</execution_context>

<process>
Run the audit workflow end-to-end and return a clear PASS or FAIL with the
evidence. A FAIL is a real gate - report exactly which requirements are untraced,
unverified, or orphaned; do not soften it. Read-only: never edit status to make
the audit pass.
</process>
