---
phase: 5
status: complete
completed: 2026-08-18
---

# Phase 5: The retune says what to change - Summary

`/cad-suggest` now returns a direction, the value a key holds now, and - where
one can be READ rather than guessed - a target, presented above the receipts
instead of mixed into them; and the coordinator residue is keyed on the run
that opened it rather than on a phase number several runs share.

## What shipped

- Run-scoped coordinator residue - `coord`/`coordRow` re-keyed on `corr` at all
  three sites in `cadence-core/bin/planning.mjs`; `trace render --phase 2` over
  the live record went from `residue_ms` 366,716,303 to 3,508,747 (plan-1
  report, task 1).
- Direction, current value and target on every keyed suggestion -
  `suggestFromRender(render, resolution?)` in
  `cadence-core/bin/lib/trace-suggest.mjs`, with the layer/ladder/level reads in
  `suggestResolution()` (`planning.mjs`), so the pure module stays pure (D-05).
- A ceiling rule that goes silent when its evidence does not bind -
  `checkpointPlanTasks()` resolves each executor checkpoint to a plan file;
  unreadable is UNKNOWN, never under-ceiling (D-09).
- A rung target that has to name an actual raise - `raiseTarget()` in
  `trace-suggest.mjs`, wired to `route-table.json`'s `rung_order` through
  `rungLadder()`.
- The tweak/receipt split and the routing offer - `cadence-core/workflows/suggest.md`
  and `skills/cad-suggest/SKILL.md`; the command now ends by offering to run
  `/cad-config` with the exact tokens and still writes no key itself.
- README's retune sentence names `/cad-suggest`, the direction and the target,
  and states the offer.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 4bb725a | The residue is scoped to one run, and every surface that describes it says so |
| 1 | 2 | 01b2ca1 | The MSR-04 falsifier, watched failing at d94c79d |
| 2 | 1 | 6544a60 | A keyed suggestion says which way to move and what it holds now |
| 2 | 2 | 36841d5 | The suggest arm resolves the layer, the ladder and the level |
| 2 | 3 | 7dd531e | The ceiling rule goes silent when its evidence does not bind |
| 2 | 4 | 299ae4c | The three new keys stay off every receipt that computed none |
| 2 | 5 | 28fb7ba | The SGT-01 falsifier, watched failing at 01b2ca1 |
| 2 | 5 | 3ad6ff3 | The census counts the callsite D-13 required (approved structural checkpoint) |
| 2 | - | 774a56c | The rung target has to name a raise against the rung in force (blocking gate fix) |
| 3 | 1 | 55138ae | The tweaks get a heading, the receipts get their own below it |
| 3 | 2 | d93cd2e | The run ends by offering to route the tweaks, not by declining to |
| 3 | 3 | 3ffb0fd | The README retune sentence names the command and states the offer |

`183ac63` sits inside this range and is not a task: it is the pause cursor
written when plan 2 checkpointed.

## Deviations

None - plans executed as written. One plan-2 lease was WIDENED mid-phase by the
orchestrator, on the user's explicit approval, to add
`cadence-core/bin/self-verify.test.mjs`: task 2's `mergeLayers` callsite (which
D-13 requires) moved the live census from 13 to 14 and the pinned total sat in a
file no phase-5 plan declared. That is a scope decision, not a deviation from a
plan's own instructions.

## Open items

- `cadence-core/bin/planning.mjs` `checkpointPlanTasks()` resolves a checkpoint
  by phase number and plan key alone, and a new cycle reuses both while
  `trace.jsonl` is not pruned at a milestone close. A retained checkpoint from a
  closed milestone can therefore bind to an unrelated current plan file and
  suppress R4. Raised as `high` by the blocking `risk_surface` review and
  adjudicated down to `medium`: the mis-binding can only SUPPRESS an advisory
  line under D-08's all-known-all-under rule, never emit a wrong one. Persisted
  at `.planning/phases/5/REVIEW-risk_surface-plan-2.md`.
- Plan 2's AC2 live clause is unmet BY DESIGN, as that plan's Notes state:
  `trace suggest --phase 2` on this repo still returns the ceiling entry,
  because two of that phase's three executor checkpoints carry the worker plan
  keys `1-cut` and `1-fix`, which map to no plan file and are UNKNOWN under
  D-09.
- `cadence-core/references/COMMANDS.md:53` says `/cad-suggest` "Applies
  nothing". Still literally true - the command writes no config key itself - but
  it names no direction, target or offer, so it is the last surface describing
  the pre-offer shape. Outside plan 3's lease.
- `skills/cad-suggest/SKILL.md` no longer declares `Read` in `allowed-tools`,
  the first shipped skill that does not. No step reads a file, so it was an
  unearned grant - but the asymmetry with every other skill is worth a second
  look.
- The routing offer binds the ask-user seam's OPEN-ENDED arm rather than its
  structured-choice arm, so `AskUserQuestion` is deliberately not granted. A
  later per-tweak multi-select is what would add that arm and its grant.
- `workflow.lint_command` is unset and `detect-commands` reports `lint: null` on
  this repo, so static analysis across the whole phase was
  `npx tsc -p tsconfig.ci.json` alone.

## Goal check

The commits plausibly deliver both halves. The MSR-04 half is measured rather
than asserted: plan 1's task 1 re-keyed `coord`/`coordRow` on `corr` and the
same `trace render --phase 2` call over the live record dropped `residue_ms`
from 366,716,303 to 3,508,747, with the largest `steps[]` window moving from a
280,613,472 ms `commit` span to a 1,081,370 ms `acceptance_criteria` one
(plan-1 report, task 1), and `01b2ca1` carries the invariant as a test watched
failing at d94c79d. The SGT-01 half is live on this tree:
`node cadence-core/bin/planning.mjs trace suggest --phase 2` returns 8 entries,
of which the one `suggest` entry carries `action: workflow.max_plan_tasks`,
`direction: lower` and `current: 8` while the 7 `info` receipts carry none of
the three keys - which is the intended shape, and `299ae4c` pins it as a
key-presence test. That same run shows the honest limit of the target half: R4
prices no `proposed`, because no field in the record names a plan task count, so
this repo's own only tweak states a direction and an absence rather than a
number. What the sum does NOT prove is the presentation: plans 3's two live-run
clauses (the headed tweak block, and the `/cad-config` offer) are workflow prose
that only a real `/cad-suggest <N>` run exercises, and both were left as
human-verify by the executor rather than claimed. Whole suite 2165 pass / 0 fail,
`self-verify.mjs` exit 0, `tsc -p tsconfig.ci.json` exit 0.
