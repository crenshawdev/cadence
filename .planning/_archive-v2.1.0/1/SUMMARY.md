---
phase: 1
status: complete
completed: 2026-07-30
---

# Phase 1: The gate that proved nothing - Summary

`criteria-coverage` now reports a fieldless checklist as a `fieldless-checklist`
break instead of exempting it as legacy, decides that exemption on ids DECLARED
rather than ids parsed, states the plugin and `uat_fields` versions it ran as, and
`uat merge` persists its envelope to `phases/<N>/FINDINGS.json` so a discarded
verifier entry outlives the dispatch that produced it.

## What shipped

- Fieldless-checklist break, replacing the silent legacy exemption -
  `cadence-core/bin/planning.mjs:985-1026`
- Legacy exemption keyed on a `declaresIds: 'none' | 'some' | 'unknown'` signal
  computed from raw source lines, replacing the near-miss-only `unreadableCriteria`
  boolean - `cadence-core/bin/lib/planning-files.mjs` (`classifyAcceptanceCriteria`),
  consumed at `planning.mjs:1005`
- Provenance in the coverage envelope: `version: {plugin, uat_fields}` -
  `cadence-core/bin/planning.mjs` (`cmdCriteriaCoverage`)
- Persisted findings envelope with `rejected_entries` / `skipped_entries` -
  `cadence-core/bin/planning.mjs:657-686`, written to `phases/<N>/FINDINGS.json`
- `uat record --criterion`, repairing a dropped criterion link, declared in CONTRACTS
- Frozen phases-1-4 criteria fixture as inlined constants, round-tripped byte-exact
  against `git show v2.0.0:...`
- The rule stated where the gate is documented -
  `cadence-core/references/acceptance-criteria.md`, `cadence-core/workflows/audit.md`,
  `cadence-core/workflows/verify.md`, `cadence-core/workflows/verify-deep.md`,
  `cadence-core/templates/UAT.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 59f3c18 | Freeze the phases-1-4 criteria fixture as inlined constants |
| 1 | 2 | 0132981 | Report a fieldless checklist as a break instead of exempting it |
| 1 | 3 | d29c249 | Pin every arm of the fieldless split, phase 6's shipped checklist included |
| 1 | 4 | 5949de6 | `criteria-coverage` states the plugin and UAT fields versions it ran as |
| 1 | 5 | 3cf7c62 | Persist the merge findings envelope to `phases/<N>/FINDINGS.json` |
| 1 | 6 | 4a4bf33 | `uat record --criterion` repairs a dropped link, declared in CONTRACTS |
| 1 | 7 | 380c4c6 | State the five-term legacy rule and the fieldless-checklist break |
| 1 | 8 | dbed518 | State the criterion repair and the persisted findings envelope |
| 1 | fix | 96dcf26 | Decide the legacy exemption on ids DECLARED, not ids parsed |

Range `22c8a03..96dcf26`, nine commits, all GPG-signed, author
`John Crenshaw <john@jcrenshaw.dev>`.

## Deviations

- [deviation] `96dcf26` is a post-review fix commit, not a planned task. The
  `diff` review trigger (adjudicated, three reviewers) surfaced a blocker that
  defeated the phase's own goal: the legacy exemption's `unreadableCriteria` guard
  covered only the `criteria-heading-near-miss` issue code, so a CONTEXT with the
  exact heading whose AC ids were written in any shape `CRITERION_HEAD` rejects
  parsed to zero criteria and still collected the exemption. Fixed within the phase
  rather than deferred.
- [deviation] The `declaresIds` probe is deliberately wider than
  `CRITERION_HEAD_NEAR`: it admits backtick and underscore wrappers, so
  `` - [ ] `AC1`: x `` counts as declared while the classifier still reports it
  `criterion-unidded`. The diagnostic names the author's fix; the probe decides
  whether an exemption may claim nothing was declared, and it errs toward
  "declared". Pinned as its own test row.
- [deviation] Two test tables rather than one: `DECLARES_ROWS` (20 rows) in
  `planning-files.test.mjs` pins the classifier signal per shape including
  fence-awareness and both `'unknown'` arms; `REFUSED_ID_SHAPES` (7 rows) in
  `planning.test.mjs` pins the break and the absence of `legacy` end to end.
  Adding `declares` to all ~40 existing `CRITERION_ROWS` would have been a larger
  diff than the fix.
- [deviation] `cadence-core/workflows/audit.md` grew past its exact-size budget
  (9633 -> 9894); regenerated its `weight-budgets.json` entry from `weight.mjs`,
  matching what task 7 already did for this surface.

## Open items

- CONTEXT.md D-15 states the red-baseline ENOENT was on `phases/1/CONTEXT.md`;
  measured, it is `phases/2/CONTEXT.md`. PLAN.md task 1 already states this
  correctly; nothing was changed on that basis.
- CONTEXT AC5's literal command omits `--result`, which `uat record` requires.
  Confirmed live: `uat record --phase 1 --item 2 --criterion AC3` returns
  `{"ok":false,"reason":"bad-result"}` with the file unchanged. Read AC5 as
  `--result <the item's current status> --criterion AC<N>` at verification.
- Widening the criterion grammar to admit the seven refused shapes is still
  deferred, as is the near-miss heading grammar and the non-fence-aware criteria
  walk. All are now `fieldless-checklist` breaks rather than silent exemptions, so
  the deferral no longer hides a phase.
- The `uat merge` counting gap stands (D-14): a `human_checks` entry matching an
  existing item moves no counter. The entry is now written to `skipped_entries`
  while `skipped` holds at its deferred value, and both code and test say so.
- `cadence-core/references/acceptance-criteria.md` calls the rule five-term in its
  heading while one shipped sentence in the same section says "satisfy the first
  three terms but not the fourth". Pre-existing ordinal drift, sidestepped rather
  than renumbered.
- The exemption still reasons only about the `## Acceptance criteria` section, so
  an `AC<N>` id written outside it is not a declaration. Unchanged by this phase
  and consistent with the grammar's stated bound.

## Goal check

The phase goal has two halves and both hold, checked against the shipped artifacts
rather than the abbreviated fixture. On the first half, `git show
v2.0.0:.planning/phases/6/{CONTEXT,UAT}.md` replayed through the old seam returns
`{"legacy":[6],"counts":{"criteria":0,...}}` - no breaks, gate green - while
`phases[6]` in the same object simultaneously reports `criteria: 9`; at HEAD the
same input returns no `legacy` key, `breaks:[{"phase":6,"break":"fieldless-checklist","file":"phases/6/UAT.md"}]`
and `counts.uncovered: 9`. On the exemption's remaining reach, I rebuilt the
fixture by hand under the scratchpad and ran all nine shapes through
`planning.mjs criteria-coverage --dir`: the seven that name an AC id the grammar
refuses (`- [ ] AC1 the feature works`, the indented, unboxed, non-dash-bullet,
heading, ordered-list and `**AC1**` forms) each now return
`{"legacy":false,"breaks":["fieldless-checklist"]}`, and the two that genuinely
declare nothing (`- [ ] the AC3 pin still holds`, `- [ ] no ids at all here`)
still return `{"legacy":true,"breaks":[]}`, so the fix did not close the exemption
by deleting it. On the second half, a contract-shaped `uat merge` payload on a
scratch tree persisted `phases/1/FINDINGS.json` carrying the full body of both
discarded entries - a `no-usable-name` rejected gap and an `already-recorded`
skipped human check - including the one whose counter deliberately does not move.
`node --test cadence-core/bin/*.test.mjs` is 1094/1094, `npx tsc -p tsconfig.ci.json`
exits 0, and `self-verify` returns `ok:true` with `problems: []`.

One permeability is assessed and kept: a phase whose roadmap box is UNCHECKED, with
declared criteria and a marker-less checklist carrying an `origin`, produces no
break. Reproduced both ways - checked yields two `uncovered` breaks, unchecked
yields none - and this is the deliberate box-gate for work in flight
(`planning.mjs:1017-1021`). The criteria still appear as `uncovered: 2` in `counts`,
so nothing leaves the coverage domain; the gate is silent only where the phase is
not yet claiming to be done.
