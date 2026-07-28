---
phase: 5
status: complete
completed: 2026-07-28
---

# Phase 5: An audit armed in the partially-planned state - Summary

`planning.mjs audit` now breaks its verdict on an `## Active` requirement that
no phase has picked up, so the traceability gate holds in the partially-planned
state instead of only against a zero-row table.

## What shipped

- `unpicked` break code and widened `counts` - an `## Active` id with no
  `## Traceability` row enters `requirements[]` with `break:"unpicked"` and
  moves `counts.broken`; `counts.total` widens from `rows.length` to
  `rows.length + unpicked.length` so `total === traced + broken + deferred`
  survives (`cadence-core/bin/planning.mjs`, `cmdAudit`)
- `unseeded` fires at ANY row count, not only zero (same file), naming the
  `## Active` ids with no row
- `classifyActiveSection` - a classifier over `## Active` that reports lines
  which look like they declare an id but fall outside the bold-bullet grammar,
  in a new additive `active_issues` envelope field. `ACTIVE_BULLET` itself is
  byte-identical, so `seed-reqs` and `parseActiveIds` are unchanged (D-05)
  (`cadence-core/bin/lib/planning-files.mjs`)
- `isRequirementId` - the anchored admission test (`REQ_ID_EXACT`) that decides
  what may move the arithmetic, added at the risk_surface gate (same file)
- Out-of-grammar code table with one row per code, each pinned by a test row
  (`cadence-core/references/req-traceability.md`)
- Surfaces moved to the widened contract: `cadence-core/workflows/audit.md`,
  `skills/cad-audit/SKILL.md`, `METHOD.md`, `CHANGELOG.md`,
  `cadence-core/bin/weight-budgets.json`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 982f785 | state the `## Active` grammar as a classifier |
| 1 | 2 | 00fdec8 | break the audit verdict on an unpicked `## Active` id |
| 1 | 3 | 9707c71 | state the widened traceability contract and the out-of-grammar table |
| 1 | 4 | 0f86389 | move every surface the unpicked verdict contradicts, bump the budgets |
| 1 | 5 | 0c58ef0 | record the partially-planned audit in the changelog |

Range `40df6e2..0c58ef0`, 5 commits.

## Deviations

- [deviation] **risk_surface gate FAILed on task 2 and held it uncommitted.**
  Two reviewers (cad-reviewer + `gpt-5.4-mini`) converged on a blocker,
  adjudicated and reproduced: the `unpicked` join treated whatever
  `ACTIVE_BULLET` returned as a requirement id, but that grammar accepts any
  `- **Word**: ...` bullet. A prose bullet `- **Note**: scope frozen` declared
  an id `Note`, took `break:"unpicked"` and hard-FAILed the ship gate by name -
  breaking every existing project with such a bullet on upgrade, with
  `active_issues` silent because the line is IN grammar. Same root cause,
  second trigger: `- **AUTH-01:**` landed in `traced` AND `broken` at once.
  Fixed in 00fdec8 by adding `isRequirementId` (anchored `REQ_ID_EXACT`) and
  admitting only id-shaped ids into the join; user chose report-over-normalize.
  Verified fixed: both now report `active-non-id-bullet` and produce no break.
- [deviation] Consequence the plan did not anticipate: `unseeded.active_ids` at
  zero rows now carries the id-shaped subset rather than the whole `## Active`
  list. Pinned by a new test and stated in `references/req-traceability.md`.
- [deviation] `active-unbolded-bullet` named a cause that was not the cause -
  it fired on lines that ARE bolded (indented sub-bullets, `*`/`+` markers), so
  the implied remedy was a no-op. Split by actual cause into
  `active-indented-bullet`, `active-nondash-bullet`, and
  `active-unbolded-bullet` for the case it describes.
- [deviation] `active-prose-line` false positive on closed-milestone trees was
  reproduced against the real `git archive v1.2.0 .planning` tree, then
  suppressed: it now additionally requires the line to name an id appearing
  nowhere else in REQUIREMENTS.md.
- [deviation] The plan's own fixtures used bare ids `A`, `B`, `X`, which the new
  admission test rejects; renamed to `AUD-01`/`AUD-02`/`SPN-01`/`RCL-06`
  throughout. Cadence's template already requires `[CATEGORY]-[NUMBER]`.
- [deviation] Task 4's `## Deferred` vs `## v2 Requirements` spelling decision,
  which the plan required be settled: **`## v2 Requirements`**, the spelling the
  shipped template uses. The real rule stated alongside it is that exclusion is
  by SECTION PLACEMENT (every parser cuts at the next `## `), which is why this
  repo's own `## Deferred` works identically.
- [deviation] The `design-notes/planning-mjs-interface.md` edit is applied in
  the working tree but is in NO commit: `design-notes/` is gitignored
  (`.gitignore:20`) and a deliberately ignored path was not force-added.
- [deviation] The plan's task-5 evidence step was wrong as written - adding only
  the Traceability row yields `broken:1` as `no-plan`, not `broken:0`; the id
  must also be in `phases/1/PLAN.md` frontmatter, which is what `/cad-plan`
  writes.
- [deviation] Task 4's three other candidate surfaces were checked and none
  contradicts, so none was edited: `workflows/milestone.md:11-17`,
  `skills/cad-health/SKILL.md` rules 4-5, `templates/REQUIREMENTS.md:64-81`.

## Open items

- **HIGH, regression introduced by this phase's own gate fix.** `REQ_ID_EXACT`
  (`cadence-core/bin/lib/planning-files.mjs:275`) requires the category to start
  with `[A-Z]`, so an id whose category leads with a digit (`2FA-01`, `3DS-02`)
  is excluded from the arithmetic AND from `unseeded` - the phase's own goal
  fails vacuously for such a milestone. Verified live: a zero-row tree declaring
  `2FA-01` and `3DS-02` returns `"unseeded":{"active_ids":[]}` and
  `"counts":{"total":0,"traced":0,"broken":0,"deferred":0}` at HEAD, where the
  same tree at `40df6e2` returned `"unseeded":{"active_ids":["2FA-01","3DS-02"]}`.
  They do surface in `active_issues` as `active-non-id-bullet`, so this is not
  fully silent, but that code's documented remedy is a no-op for them and they
  never move `counts`. `A11Y-01` and `V2API-01` (digits not first) are admitted.
  Converged by cad-reviewer at the diff gate.
- **MEDIUM.** The `active-prose-line` suppression predicate tests the
  UN-narrowed grammar id set while the arithmetic tests the narrowed one, so a
  single non-id bold bullet silences the prose diagnostic for the whole section.
  Verified: an `## Active` holding `Milestone v1.5.0 covers AUTH-05 and
  AUTH-06.` plus `- **Note**: scope frozen on 2026-07-28` reports only
  `active-non-id-bullet` and PASSes; delete the `Note` bullet and the same tree
  reports `active-prose-line` on the AUTH-05/AUTH-06 line. One prose bullet is
  the whole difference.
- **MEDIUM.** `workflows/audit.md` describes `unseeded` without mentioning the
  `isRequirementId` admission filter, so a model reading only the workflow
  concludes "no unseeded requirements" and issues PASS for the digit-prefix
  case above. The hedge exists only in `references/req-traceability.md`, which
  `/cad-audit` does not require reading.
- **MEDIUM.** `references/req-traceability.md` claims an id that is not
  id-shaped could not be seeded by `/cad-plan` either. False: `seed-reqs`
  intersects plan frontmatter against the UN-narrowed `parseActiveIds` set, so
  it seeds rows for ids `isRequirementId` rejects.
- **MEDIUM.** The `active-non-id-bullet` remedy is unreachable for an id that is
  already alone inside the bold span but fails `isRequirementId` (the
  digit-prefix case): remedy 1 is a no-op, remedy 2 deletes a real declaration.
- **LOW.** `active-prose-line`'s "appears nowhere else in REQUIREMENTS.md"
  condition cannot distinguish a traced row from a `## v2 Requirements` bullet,
  so a file that both defers an id and claims it as active scope is silent.
- **Pre-existing, out of scope, found while adjudicating.**
  `parseRequirements` (`cadence-core/bin/lib/planning-files.mjs:187`) skips the
  Traceability header only by the literal string `'Requirement'`, so a table
  headed `| ID | Phase | Status |` parses its own header as a requirement row
  (`{"id":"ID","break":"no-phase"}`) and FAILs the audit. Identical at
  `40df6e2`, so not a phase-5 regression - but `isRequirementId`, which this
  phase added, is exactly the tool that would close it.
- **Pre-existing, out of scope.** `skills/cad-health/SKILL.md` rule 4 asserts
  every `Status` is `Pending` or `Complete`, but `Deferred` is legal
  (`templates/REQUIREMENTS.md:71-77`), so cad-health flags a correct row.
- **HUMAN-VERIFY, carried to `/cad-verify 5`.** `/cad-audit` is a slash-command
  surface no executor can invoke. Fixture in the FAIL state was built at
  `/tmp/claude-1000/-data-code-cadence/368aa30a-3867-4251-8e74-a83beb37459b/scratchpad/uat5`
  (session-scoped; rebuild if reaped), with a `-after` PASS-state copy. Expect
  FAIL naming AUD-02 with next action "plan it into a phase or move it to
  `## v2 Requirements`", not PASS-with-warnings.
- This repo's own audit now reports `broken:1` (`AUD-01`, `not-verified`)
  because phase 5's ROADMAP box is unchecked. Expected until `/cad-verify 5`;
  it is `not-verified`, not `unpicked`, and `active_issues` is empty here.
- CONTEXT's flagged assumption stands: an external reader written against
  `total === rows.length` will silently disagree. The CHANGELOG states it;
  nothing in-repo reads it that way.

## Goal check

The phase delivers its goal for the id space it admits, and I verified the
before/after pair directly rather than inferring it: on a fixture whose
`## Active` holds `AUD-01` (rowed) and `AUD-02` (unrowed), HEAD returns
`{"id":"AUD-02","break":"unpicked"}` with `"counts":{"total":2,"traced":1,
"broken":1,"deferred":0}`, while the seam at `40df6e2` on that same tree returns
`"counts":{"total":1,"traced":1,"broken":0,"deferred":0}` with `AUD-02` in no
field of the envelope - which is precisely the blind spot the phase existed to
close. The identity `total === traced + broken + deferred` holds across every
fixture run. The full gate is clean and I ran it myself: `node --test
cadence-core/bin/*.test.mjs` gives 720 pass / 0 fail, `npx tsc -p
tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` prints
`"problems":[]` with no budget-overrun after the prose moves. This repo's own
tree reports zero `active_issues`, so the headline claim holds where it matters
most. What is missing is honest and named above: the goal fails vacuously for a
requirement id whose category starts with a digit, because the anchored
admission test added at the risk_surface gate requires `[A-Z]` first - a
regression this phase introduced against its own goal, verified live at both
commits, and the single most important thing for `/cad-verify 5` to settle. The
prose-line suppression gap has the same shape: one non-id bullet can hide ids
named nowhere else. Both are narrow, both are reachable by real projects, and
neither is covered by a test today.
