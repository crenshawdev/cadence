# cad-audit workflow

Pre-ship traceability audit. Prove every requirement was delivered and verified,
and that no work is unmapped. Read-only: it reports and gates, it never edits
status. The persisted status is the REQUIREMENTS traceability table
(Requirement | Phase | Status: Pending/Complete) and the ROADMAP `## Phases`
checkbox. `/cad-plan` creates a table row (always at Pending); no writer but
cad-verify ever sets a Status beyond it, and the ROADMAP checkbox is
cad-verify's alone (`references/req-traceability.md`).

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
`phase-missing` | `no-plan` | `not-verified` | `drift` | `unpicked`),
`orphans.plan_ids` (plan frontmatter referencing unknown REQ-IDs - scope
creep, weigh lighter
than a dropped requirement), `frontmatter_issues` (a plan file whose
`requirements:` frontmatter fell outside the stated grammar -
`references/plan-frontmatter.md`), `unseeded` (the `## Active` ids with no
Traceability row, at any row count - each also carries an `unpicked` break;
only ids whose prefix is 2-8 characters STARTING WITH A LETTER, or `#N`, are
admitted here, so a digit-leading category like `2FA-01` appears in neither
`unseeded` nor `counts` and is reported only in `active_issues` - do not read
an empty `unseeded` as proof the section is covered),
`active_issues` (a line inside `## Active` outside the stated bullet grammar -
`references/req-traceability.md`), `nonconforming_plans` (a `PLAN*.md`
filename no seam and no executor reads, e.g. `PLAN-gaps.md`), `deferred` (rows
whose Status is `Deferred` - the one pinned marker), and `counts` (whose
`total` is Traceability rows PLUS unpicked ids, so
`total = traced + broken + deferred`).

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
- `unpicked` - an `## Active` requirement no phase picked up: the same silent
  drop one step earlier, before the requirement ever reached the table (so the
  entry carries no `phase`). Two exits: plan it into a phase (`/cad-plan` seeds
  the row), or move the bullet out of `## Active` into the deferred section
  below it (`## v2 Requirements` in the shipped template). A row with an
  em-dash Phase cell is `no-phase`, not an exit. Expected mid-cycle exactly
  like `not-verified`, a defect at ship time.

## 4. Verdict
Arithmetic over the seam's output - in-scope `counts.broken` (after any
milestone filter):
- **PASS** - zero broken: every in-scope requirement traces requirement ->
  phase -> plan -> verified. Deferred rows are allowed (list them; they are
  not counted as delivered).
- **FAIL** - any requirement is untraced, unverified, dropped, or in drift.
  List each failing requirement with exactly where its chain breaks. This gate
  is meant to block a ship; do not soften it or mark it PASS-with-warnings.

A `frontmatter_issues` entry is additive, not itself a `break` - but a
payload-dropping diagnostic code can still leave a requirement untraced;
`references/plan-frontmatter.md` states per code which ones drop.
`active_issues` and `nonconforming_plans` are additive too and change neither
`counts` nor the verdict - and the id named on an `active_issues` line is in
neither until that line is rewritten as a `- **ID**: ...` bullet whose bold
span is exactly the id. On an `active-non-id-bullet` the line may ALREADY be
such a bullet: if the span holds nothing but the id and it is still reported,
the id failed the admission test above (a digit-leading category), and no
rewrite of that line will count it - say so rather than issuing a remedy that
does nothing. `unseeded` is NOT additive:
every id it names also carries an `unpicked` break and is already counted.
Either way there is no third, softened state: a broken requirement still fails
this gate.

Report: the one-line verdict, the trace table (requirement | phase | plan |
verified), the dropped/unmapped/drift lists, and - on FAIL - the concrete next
action per failing requirement (assign to a phase, plan it, verify it, or mark
it deferred). Ends here; fixing is a separate, deliberate step.
