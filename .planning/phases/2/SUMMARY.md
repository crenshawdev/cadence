---
phase: 2
status: complete
completed: 2026-07-22
---

# Phase 2: Planner separation-of-concerns heuristic - Summary

A standing `<separation_of_concerns>` nudge baked into `agents/cad-planner.md` that steers every plan toward small, single-purpose tasks split on six axes, applied with no per-phase restatement and no forced unearned splits.

## What shipped

- `<separation_of_concerns>` heuristic block - `agents/cad-planner.md` (after `</task_anatomy>`, before `<plan_output>`); names all six split axes (trigger, size, lifecycle, failure-resume, freshness, ownership), frames splitting as a nudge that "never forces a split that does not earn itself", and distinguishes task/artifact-level decomposition from the `<plan_output>` PLAN-file split.
- Exact-byte budget bump in lockstep - `cadence-core/bin/weight-budgets.json`, `agents/cad-planner.md` entry `7714` -> `8786` (equals `wc -c`), so `self-verify.mjs` never sees an over-budget state.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 10b6b14 | add separation-of-concerns nudge to cad-planner (block + lockstep budget bump), signed |

## Deviations

- [deviation] The plan's own axis-presence Verify check (`grep -qw` per axis, case-sensitive) reported all six MISSING because the draft used bolded capitalized axis labels (`**Trigger**`). Fixed by rewriting the list to lead with lowercase axis names, matching the plan's lowercase phrasing convention; rebudgeted to 8719 B. (commit 10b6b14)
- [deviation] The plan's framing Verify check (`grep -qiE "separation[ -]of[ -]concerns"`, block-scoped) exited 1 because the `[ -]` class matches space/hyphen but not the underscore in the `<separation_of_concerns>` tag, and the prose never spelled the phrase out. Fixed by opening the block with "Apply separation of concerns to the tasks and artifacts you write"; rebudgeted to the final 8786 B. (commit 10b6b14)

## Open items

- None.

## Goal check

The single commit `10b6b14` delivers the phase goal. `agents/cad-planner.md` now carries a `<separation_of_concerns>` block (diff: +21 lines after `</task_anatomy>`) naming all six axes - trigger, size, lifecycle, failure-resume, freshness, ownership - with explicit nudge framing ("This is a nudge to weigh, not a hard rule ... it never forces a split that does not earn itself"), verified by the executor's per-axis `grep -qw` sweep printing nothing and the framing regex exiting 0. It is standing prose in the cached agent file only: `grep -rn "failure-resume\|freshness\|separation of concerns"` across `cadence-core/workflows/plan.md`, `plan-gaps.md`, `cadence-core/templates/`, and both plan-checkers returned no matches, so the heuristic applies to every plan with zero per-phase restatement, and neither checker gained a gate rule (D-04 held). The budget moved in lockstep (`weight-budgets.json` -> 8786, matching `wc -c agents/cad-planner.md`), `node cadence-core/bin/self-verify.mjs` exits 0 with no problems, 245/245 tests pass, and `tsc -p tsconfig.ci.json` exits 0. The advisory `diff` review (opus reviewer) returned zero findings. Nothing looks missing against the automated criteria. CONTEXT AC5 - a live `/cad-plan` run confirming the planner separates a multi-axis phase while not force-splitting a single-concern one - is human-verify by design (plan Notes) and carries to `/cad-verify 2`; it is a verification step, not a gap.
