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
whose Status is `Deferred` - the one pinned marker),
`version_drift` (`{doc_version, published_as, cycle_state}` - OMITTED whenever
there is nothing to report, so its absence is the normal state), and `counts`
(whose `total` is Traceability rows PLUS unpicked ids, so
`total = traced + broken + deferred`).

If a milestone scope was given, filter the returned requirements to that
milestone's IDs before judging; the seam always traces the whole file.

Then the second arm - the criterion -> UAT trace, one verdict over both:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" criteria-coverage
```

`version` (`{plugin, uat_fields}`, always first) - the plugin version and UAT
fields version the check ran as; quote it in the report, since a stale plugin
cache silently downgrading this gate is what it exists to expose.
Per phase holding both a CONTEXT.md and a UAT.md: `phases`
(`{phase, criteria, items}`), `breaks` (`{phase, id, break:"uncovered"}` - a
criterion that reached NO item - or `{phase, break:"fieldless-checklist", file}`,
one per phase), `untraced` (an item with no `criterion` and no exempting
`origin`), `legacy` (`{phase, reason}` - checklists predating the fields, with
the exemption's reason stated), `unknown_criterion`, `context_issues` (lines
outside the criterion grammar) and `counts` (`criteria = covered + uncovered`).
Grammar and field semantics: `references/acceptance-criteria.md`.

The milestone filter above does NOT apply to `breaks`, and they need none:
`milestone.md` step 3 removes completed phases from ROADMAP.md's live
`## Phases` list, so `parseRoadmapPhases` only ever holds the current cycle's
phases; and within that cycle a phase whose checkbox is unchecked contributes
its `uncovered` count but no `uncovered` or `missing-uat` break, so unfinished
work cannot fail a mid-cycle run on those two. `fieldless-checklist` is NOT
box-gated and fires on an unchecked phase: `uat init` writes `fields_version`
before it looks at an item, so no phase is ever transiently fieldless, and the
break is a real drop rather than work in progress - do not explain it away as
mid-cycle. Filtering by id is impossible anyway - a criterion break carries no
requirement id.

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
- `uncovered` (coverage arm) - an acceptance criterion that reached no UAT
  item: the phase was verified against a checklist missing that criterion, so
  the criterion was never proven and nothing said so. Two exits: add the item
  through `/cad-verify <N>`, or correct the criterion id in CONTEXT.md.
- `fieldless-checklist` (coverage arm) - the checklist carries items but none of
  the traceability fields, beside a CONTEXT that DID declare ids: nothing in it
  can be traced, so the phase's whole coverage claim is unchecked. One break per
  phase, naming the file. Two exits: repair the links per item with
  `uat record --phase <N> --item <k> --result <its current status> --criterion AC<N>`,
  or re-run `/cad-verify <N>` if the phase never got a real checklist.
  `--origin criterion` is not a repair - it names no id.
- `version_drift` - not a per-requirement break but a milestone-scoped signal,
  and it moves the verdict all the same (§4): the planning docs name a version
  this repo has ALREADY tagged while its cycle is still open. That is issue
  #87's failure mode - a cycle planned, branched and worked under a number that
  already shipped - and it is invisible to every other key here. `published_as`
  is the tag spelling that carries it. Two exits: open the NEXT version in
  `PROJECT.md ### Active` (and the ROADMAP title, if it names one), or - if the
  cycle really is finished - complete the close so no phase is left open.

## 4. Verdict
Arithmetic over both seam calls - in-scope `counts.broken` (after any milestone
filter) and coverage `breaks`:
- **PASS** - zero broken and zero `breaks`: every in-scope requirement traces
  requirement -> phase -> plan -> verified, and every acceptance criterion
  reached a UAT item. Deferred rows are allowed (list them; they are not
  counted as delivered).
- **FAIL** - any requirement is untraced, unverified, dropped, or in drift, OR
  the coverage arm returned ANY break, whatever its code, OR `version_drift` is
  present. List each failing
  requirement with exactly where its chain breaks; each `uncovered` criterion BY
  ID with its phase and its next action (add the missing UAT item through
  `/cad-verify <N>`, or correct the criterion id in CONTEXT.md); and each
  `fieldless-checklist` break by the file it names, with the repair. This gate is
  meant to block a ship; do not soften it or mark it PASS-with-warnings.

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

`version_drift` is NOT additive either, and for the same reason `unseeded`
stopped being: an additive report would change nothing here. `/cad-health`
already reports this in prose, and the requirement's own wording is
"mechanically, rather than only reported" - a signal that never moves a verdict
leaves the ship gate exactly as permeable as it was. Present -> FAIL, naming the
doc version, the tag spelling that carries it, and the cycle state. It moves no
count: it is milestone-scoped rather than per-requirement, and
`total = traced + broken + deferred` stays an invariant.

State what is NOT drift in the same breath, so this gate is not softened later
by someone re-deriving it:

- A doc version NO tag carries is the ordinary mid-cycle state - the docs are
  supposed to run ahead of the last release. The key is absent, and that absence
  is not a near-miss to report.
- A tagged doc version with EVERY phase complete is exempt: that is exactly what
  a close interrupted between `milestone.md` step 2 (the tag) and step 4 (the
  PROJECT.md evolve) leaves on disk, and the user is already finishing it.
- A version that merely sorts BELOW the newest tag was published by nothing. The
  test is membership in the tag list, not order.

The manifest is deliberately not a comparand. `pluginVersion()` resolves
relative to the SCRIPT while the command above invokes the seam through
`${CLAUDE_PLUGIN_ROOT}`, so reading it here would judge a downstream project
against CADENCE's release number; and `skills/cad-health/SKILL.md` already
settled that tags are the publication evidence, a manifest in the checkout is
not. A manifest test could not have caught #87 anyway - at that tag the manifest
agreed with the docs.

On the coverage arm, `breaks` is the only verdict-moving key; `untraced`,
`legacy`, `unknown_criterion` and `context_issues` are additive and change
neither counts nor the verdict - the same split `active_issues` and `unpicked`
already carry. `legacy` exempts only a checklist that predates the fields on all
five terms - items present, no `fields_version` marker, no `criterion` or
`origin` on any item, and a CONTEXT declaring no `AC<N>` ids - and it states its
reason, so the exemption can be checked rather than taken on trust. Miss the
last term alone and it is a `fieldless-checklist` break: the AC-id grammar
post-dates the fields, so a marker-less checklist beside declared ids is a
dropped link, not an old file. DECLARED is what the CONTEXT says, not what the
grammar could parse: an id written in a shape the grammar refuses
(`- [ ] **AC1**: x`, `### AC1: x`, a missing colon) is declared and breaks, and
a near-miss heading is unknown rather than none, so it breaks too.
An absent CONTEXT.md is nothing to prove -
this gate runs at `milestone.md` step 1 while the prune that deletes phase
directories runs at step 3, so a prior milestone's phases are simply gone, and
the prune takes CONTEXT with the directory. An absent UAT.md under a PRESENT
CONTEXT is the opposite: on a checked box every declared criterion breaks as
`missing-uat`, the total drop. Additive is not invisible: `context_issues` carrying
`criterion-duplicate-id` or `criterion-unidded` on a phase NOT in `legacy` must
be named in the report. The reader keeps first-occurrence-wins on a duplicate
id, so a second bullet reusing one is dropped from the coverage domain
entirely - a real criterion left unproven with the gate green, which is the
failure this arm exists to close.

Report: the one-line verdict, the trace table (requirement | phase | plan |
verified), the dropped/unmapped/drift lists, the uncovered criteria by phase and
id, and - on FAIL - the concrete next action per failing requirement (assign to a
phase, plan it, verify it, or mark it deferred) and per uncovered criterion.
Ends here; fixing is a separate, deliberate step.
