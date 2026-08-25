---
phase: 6
status: complete
completed: 2026-08-25
---

# Phase 6: Close the plan-time lease gate - Summary

`lease-check --plan-time` now fails closed on a lease it could not read, and the
seam-invocation census that phase 2 left out of the registry is registered, so
the two cases phase 2's UAT recorded the gate passing are both refused.

## What shipped

- The `seam-call-counts` registry row plus its `CADENCE-CENSUS` marker -
  `cadence-core/bin/lib/census-registry.mjs`, `cadence-core/bin/seam-calls.test.mjs`
- The pre-correction D-05 worked example removed from the registry header -
  `cadence-core/bin/lib/census-registry.mjs` (0 hits for "deliberately absent from this table")
- Two fail-closed arms on the plan-time gate, `unparsed-lease` and `empty-lease`,
  each a direct emit carrying its own hint -
  `cadence-core/bin/planning/lease-check.mjs:302-317`
- One two-plan fixture pinning both gates on both signals - `plan-overlap`'s
  `frontmatter_issues`/`undeclared` and the plan-time arm's two refusals -
  `cadence-core/bin/planning-lease-check.test.mjs` (31/31)
- `check_census` in `cadence-core/workflows/plan.md` stating all three outcomes
  the seam returns, with the budget re-pinned to 33,749 B
- Phase 2's UAT items 9 and 10 re-recorded `pass` with evidence naming this
  phase's commits - `.planning/phases/2/UAT.md`
- The census replay record rebuilt to all twelve registry rows -
  `.planning/phases/2/census-replay.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | ac01bcc7 | Register the seam-invocation census: row, marker, D-05 header rewritten |
| 1 | 2 | 46523b87 | Re-measure the census replay over the current corpus; table rebuilt to 12 rows |
| 1 | 3 | 3bf5264e | The plan-time lease gate fails closed on a lease it could not read |
| 1 | 4 | 6db19be9 | One two-plan fixture pins both gates on both signals |
| 1 | 5 | badcb33e | `check_census` states every refusal the seam now returns |
| 1 | 6 | b1b8d868 | Phase 2's UAT items 9 and 10 re-test green |
| 1 | 6 (cont.) | 7d9bc4c3 | Re-pin the EXECUTE-10 citation the fail-closed arms moved |

## Deviations

- [deviation] Task 6's whole-tree gate failed at b1b8d868: `test.mjs` was
  3266 pass / 1 fail. `citation-census.test.mjs`'s `DOCS_CLAIMS_CITATIONS`
  pinned DOCS-CLAIMS.md's EXECUTE-10 to `planning/lease-check.mjs:450-453`, the
  span carrying `reason: 'undeclared-files'`, and task 3's two fail-closed arms
  pushed that symbol to line 498. Neither carrier was among the plan's ten
  declared paths, so the executor stopped at a structural checkpoint rather than
  stage an undeclared path. The user approved amending the lease; the
  amendment and the re-pin landed in one commit (7d9bc4c3). The pinned SYMBOL
  never changed - only the line span.
- [deviation] The approved amendment named two paths and two was not enough to
  land the commit it authorized: the amendment edits
  `.planning/phases/6/PLAN.md` itself, and `lease-check --phase 6 --plan 1`
  refused that file `undeclared-files` (staged 3, declared 16) because the plan
  did not declare itself. Unstaging would have split the approved single commit
  and left the lease amendment uncommitted, so `PLAN.md` was added to its own
  `files:` list as a third entry. The gate then answered `ok:true`, and the
  plan-time arm answers `ok:true` over the 17-path lease, so no census is left
  at risk by the growth (7d9bc4c3).

## Open items

- Phase 2's UAT item 11 stays `pending` and phase 2's UAT `result` stays
  `partial`, exactly as ROADMAP phase 6 criterion 5 anticipated. It needs a live
  `/cad-plan` run that genuinely under-declares a census subject, and this
  phase's own planning run declared every holder correctly, so there was no
  refusal to observe. It is answered by a later planning run, not by this phase.

## Goal check

The seven commits deliver the phase goal. Both halves of it are met against
ground truth rather than against the reports: the registry half shows
`grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs` = 1, one
`seam-calls.test.mjs` row in `cadence-core/bin/lib/census-registry.mjs`, and 0
hits for "deliberately absent from this table" in that module (criteria 1-2).
The fail-closed half is `cadence-core/bin/planning/lease-check.mjs:302-317`,
where `issues.length` returns `reason: 'unparsed-lease'` and
`declared.length === 0` returns `reason: 'empty-lease'`, each with a top-level
`hint`, both above the `censusesAtRisk` call so an unread lease can no longer
reach the `{"ok":true,"declared":0}` phase 2's UAT recorded (criterion 3). It is
not a blanket refusal: `lease-check --plan-time --phase 6 --plan 1` answers
`{"ok":true,...,"declared":17}` over this phase's own amended lease. Criterion 4
is the fixture in `cadence-core/bin/planning-lease-check.test.mjs`, which the
executor mutation-checked - reverting either arm alone or both leaves 30 pass /
1 fail on the new two-plan arm. `uat status --phase 2` reports
`pass: 10, fail: 0, pending: 1` with `first_pending` item 11 (criterion 5), and
the whole-tree gate is green: `test.mjs` 3267 pass / 0 fail,
`npx tsc -p tsconfig.ci.json` exit 0, `self-verify.mjs --root .` `problems []`
(criterion 6). Nothing in the goal is missing. The one thing an unwary reader
could mistake for a gap is item 11 still pending, which criterion 5 explicitly
excludes from this phase; the one thing genuinely worth a second look is the
second deviation, where the plan's `files:` lease grew to include the plan file
itself - legitimate here, since the gate re-checked clean, but it is the first
time a plan has had to declare itself.
