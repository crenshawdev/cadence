---
name: cad-audit
description: "Pre-ship requirement-traceability audit - every requirement traced to a phase, a plan, and a verification; orphan detection both directions; a FAIL gate that catches silently-dropped requirements before a milestone ships"
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

This is the check that catches the quiet failure GSD's per-phase flow can miss -
a requirement that no phase ever picked up, or one marked done while its phase
never verified. It reads the authoritative status - the REQUIREMENTS
traceability table (Requirement | Phase | Status) and the ROADMAP `## Phases`
checkbox, the only persisted status, both written solely by cad-verify. It does
not write status itself.
</objective>

<execution_context>
@$HOME/.claude/cadence-core/workflows/audit.md
</execution_context>

<process>
Run the audit workflow end-to-end and return a clear PASS or FAIL with the
evidence. A FAIL is a real gate - report exactly which requirements are untraced,
unverified, or orphaned; do not soften it. Read-only: never edit status to make
the audit pass.
</process>
