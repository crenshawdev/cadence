# cad-audit workflow

Pre-ship traceability audit. Prove every requirement was delivered and verified,
and that no work is unmapped. Read-only: it reports and gates, it never edits
status. The persisted status is the REQUIREMENTS traceability table
(Requirement | Phase | Status: Pending/Complete) and the ROADMAP `## Phases`
checkbox, both written solely by cad-verify.

## 1. Scope
`$ARGUMENTS` = a milestone (audit its requirements), else all active
requirements in REQUIREMENTS.md. State the scope and the requirement count.

## 2. Run the trace
The joins are the planning seam's job - never build the table by hand:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" audit
```

One JSON line returns the full requirement -> phase -> plan -> verified
chain: per requirement a `break` code where the chain fails (`no-phase` |
`phase-missing` | `no-plan` | `not-verified` | `drift`), `orphans.plan_ids`
(plan frontmatter referencing unknown REQ-IDs - scope creep, weigh lighter
than a dropped requirement), `deferred` (rows whose Status is `Deferred` -
the one pinned marker), and `counts`.

If a milestone scope was given, filter the returned requirements to that
milestone's IDs before judging; the seam always traces the whole file.

## 3. Interpret the breaks
- `no-phase` / `no-plan` - a dropped requirement: nothing committed to
  deliver it. This is the silent-drop this audit exists to catch.
- `phase-missing` - the table points at a phase that is not in ROADMAP.md.
- `not-verified` - planned but not yet Complete + checked. Expected mid-cycle;
  a defect at ship time.
- `drift` - the two status sources contradict (row Complete vs box, either
  direction). The status cannot be trusted until reconciled (cad-verify
  re-run, or the discrepancy explained).

## 4. Verdict
Arithmetic over the seam's output - in-scope `counts.broken` (after any
milestone filter):
- **PASS** - zero broken: every in-scope requirement traces requirement ->
  phase -> plan -> verified. Deferred rows are allowed (list them; they are
  not counted as delivered).
- **FAIL** - any requirement is untraced, unverified, dropped, or in drift.
  List each failing requirement with exactly where its chain breaks. This gate
  is meant to block a ship; do not soften it or mark it PASS-with-warnings.

Report: the one-line verdict, the trace table (requirement | phase | plan |
verified), the dropped/unmapped/drift lists, and - on FAIL - the concrete next
action per failing requirement (assign to a phase, plan it, verify it, or mark
it deferred). Ends here; fixing is a separate, deliberate step.
