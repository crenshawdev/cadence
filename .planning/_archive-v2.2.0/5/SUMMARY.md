---
phase: 5
status: complete
completed: 2026-08-04
---

# Phase 5: The install path is verified where it actually runs - Summary

The complete vehicle for the human cold-state install walk: a committed record
sheet with pre-walk baseline and 7 transcript slots, the README install path
pinned verbatim, and the UAT checklist re-keyed to the three locked cold-state
criteria - hardened by an adjudicated three-reviewer diff pass before any walk
step runs.

## What shipped

- Install-walk record sheet - `.planning/phases/5/install-walk.md`: baseline at
  `origin/main` = `0bba96f4159f5570dee727e2fe416e51e3a3281a` with the full
  `plugin.json` manifest (`2.0.0`) verbatim per D-01, the SSH-vs-HTTPS evidence
  caveat, the window rule (including the in-window commit command and the
  early-end `not reached: <reason>` rule), 7 empty slots, and a Deviations
  section with the harness/doc-owed distinction.
- Documented-path pin and AC3 discharge rule - same sheet: README.md lines
  51-60 quoted verbatim at `2884e9e` inside a 4-backtick fence, plus the rule
  that only doc-owed deviations reach README (in `https://` spelling, behind
  `self-verify.mjs` `ok:true`).
- Re-keyed phase-5 checklist - `.planning/phases/5/UAT.md`: three items carrying
  `criterion: AC1/AC2/AC3`, each `expected` a numbered step list with exact
  commands, `human-verify` markers on items 1-2 rejecting any machine or
  verifier auto-pass under D-04. `criteria-coverage` for phase 5: uncovered
  3 -> 0, no untraced items.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 2884e9e | Build the install-walk record sheet with pre-walk baseline |
| 1 | 2 | 6ef98ad | Pin the documented install path and the AC3 discharge rule |
| 1 | 3 | aa84ede | Re-key the phase-5 checklist to the cold-state criteria |
| 1 | review | ee9cd1f | Close the four adjudicated defects in the phase-5 checklist |
| 1 | review | 0a03e5f | Mark unreached slots honestly when the walk ends early |
| 1 | review | a291c6d | Re-evaluate the D-02 merge-base check on baseline refresh |

## Deviations

- [deviation] The adjudicated `diff` review (cad-reviewer-xhigh + gpt-5.6-terra
  + gemini-3.6-flash) surfaced 4 confirmed defects in the checklist the plan's
  own text prescribed; fixed in `ee9cd1f` via the sanctioned seam path
  (deliberate remove + one `uat init`): item 3's pass predicate now survives
  harness-only deviations (steps 3-5 scoped to doc-owed lines, step 8's first
  clause widened), items 1-2 step 0 spell the full
  `node .../planning.mjs uat record` invocation, item 1 step 5's purge/absence
  transcripts land in slot 3, and item 2's race remediation re-purges the cache
  so step 6's exactly-one-directory check stays valid.
- [deviation] Two low review survivors fixed in the sheet: `0a03e5f` (unreached
  slots overwritten `not reached: <reason>` before the final transcripts
  commit) and `a291c6d` (baseline refresh re-runs the D-02 merge-base check).
- [deviation] `merge-base --is-ancestor 52f995a origin/main` printed `1`
  (unmerged) at capture time - the plan's anticipated no-note arm, recorded
  factually in the sheet.

## Open items

- The live cold-state walk itself (AC1/AC2, the interactive `/plugin` prompt)
  runs at `/cad-verify 5` by design (D-06) - the phase goal is discharged
  there, through the sheet and checklist this phase built.
- The sheet's `## Documented path` block is pinned at `2884e9e`; the baseline
  refresh step updates the sha and the D-02 check but not that excerpt, so if
  README's install section changes on `origin/main` before the walk, the AC3
  comparison target goes stale (low review survivor, unfixed).
- `DESIGN.md:174` still spells the user install with the retired
  `https://github.com/crenshawdev/cadence.git` URL inside a dated
  locked-decision record - D-07 fixes SC3's doc target as README only, so out
  of scope here.
- Pre-existing `criteria-coverage` untraced rows for phase 3 item 8 and phase 4
  item 8 - present before this phase, not phase-5-owed, unchanged.

## Goal check

The phase goal - v2.0.0's documented Forgejo install proven live, not
inferred - is not yet delivered by these six commits, and by locked design
cannot be: D-06 rules that no machine check stands in for the interactive
`/plugin` prompt, so the walk runs at `/cad-verify 5`. What the commits
deliver is everything that makes that walk falsifiable and durable: the sheet
holds the walk-time comparison baseline (`origin/main` at
`0bba96f4159f5570dee727e2fe416e51e3a3281a`, manifest version `2.0.0` verbatim -
`grep -c '"version"' install-walk.md` >= 1), seven paste slots
(`grep -c "^## Slot"` = 7) and the README contract byte-for-byte (the task-2
line loop printed no `MISSING:`), the checklist asks for exactly the D-03
cold-state sequence with every item traced (`criteria-coverage`: phase 5
uncovered 0, untraced none), and the evidence survives the uninstall window
via the in-sheet commit rule, since `/cad-verify`'s own commit step stages a
closed list that excludes the sheet (`workflows/verify.md:234-237`). The
adjudicated review then closed the four paths where an honest walk would have
failed or an auto-pass slipped through (`ee9cd1f`). Remaining gap, named: the
sheet's pinned README excerpt is not refreshed if `origin/main`'s install
section moves before the walk - listed as an open item, not a blocker.
