# cad-audit workflow

Pre-ship traceability audit. Prove every requirement was delivered and verified,
and that no work is unmapped. Read-only: it reports and gates, it never edits
status. The persisted status is the REQUIREMENTS traceability table
(Requirement | Phase | Status: Pending/Complete) and the ROADMAP `## Phases`
checkbox, both written solely by cad-verify.

## 1. Scope
`$ARGUMENTS` = a milestone (audit its requirements), else all active
requirements in REQUIREMENTS.md. State the scope and the requirement count.

## 2. Build the trace table
The REQUIREMENTS traceability table (Requirement | Phase | Status) is the
starting point - it already maps requirement -> phase. For each requirement ID,
follow the chain and record where it breaks:
- **Phase** - does the table assign it to a phase (and does that phase exist in
  ROADMAP.md)? A blank/missing phase is a dropped requirement.
- **Plan** - does that phase's PLAN carry the ID in its `requirements`
  frontmatter (i.e. a plan actually committed to delivering it)?
- **Verified** - is its table Status `Complete` AND the phase's ROADMAP
  `## Phases` checkbox `- [x]`? Both are cad-verify's at phase-complete.

Trace = `requirement -> phase -> plan -> verified`. Any missing link is a defect.

## 3. Orphan detection (both directions)
- **Dropped requirements** - a requirement with no phase, or a phase but no plan
  that carries it. This is the silent-drop this audit exists to catch.
- **Unmapped work** - a phase or PLAN whose `requirements` reference IDs that do
  not exist in REQUIREMENTS.md, or delivered artifacts that trace to no
  requirement (scope creep). Report, but weigh lighter than a dropped requirement.

## 4. Status reconciliation (drift)
Flag contradictions between the two status sources:
- A requirement marked done whose phase is not checked verified (or vice versa).
- A phase checked complete with an unverified requirement still assigned to it.
Drift is a FAIL input - the status cannot be trusted until it is reconciled
(cad-verify re-run, or the discrepancy explained).

## 5. Verdict
- **PASS** - every in-scope requirement traces requirement -> phase -> plan ->
  verified, with no drift. Deferred requirements are allowed ONLY if their
  Traceability Status is `Deferred` - the one pinned marker
  (templates/REQUIREMENTS.md); list them; they are not counted as delivered.
- **FAIL** - any requirement is untraced, unverified, dropped, or in drift.
  List each failing requirement with exactly where its chain breaks. This gate
  is meant to block a ship; do not soften it or mark it PASS-with-warnings.

Report: the one-line verdict, the trace table (requirement | phase | plan |
verified), the dropped/unmapped/drift lists, and - on FAIL - the concrete next
action per failing requirement (assign to a phase, plan it, verify it, or mark
it deferred). Ends here; fixing is a separate, deliberate step.
