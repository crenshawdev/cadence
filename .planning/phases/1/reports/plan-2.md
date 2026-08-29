PLAN COMPLETE
Plan: .planning/phases/1/PLAN-2.md
Tasks: 1 of 1
| Task | Commit | Note |
|---|---|---|
| 1 - Carry the settled figures on every shipped settle-receipt append | 211c92f1 | 15 settle-event `trace append` spawns across the four files migrated. Suite green before and after: 3563 tests, 3562 pass, 0 fail, 1 skipped. Re-run against a scratch copy carrying a PLAN-3 prototype (the presence door wired in `planning.mjs` after `evaluateRow`): same 3562 pass, 0 fail, confirming the 11 arms the plan measured no longer refuse. Typecheck `npx tsc -p tsconfig.ci.json` clean; `detect-commands` reports `lint: null`, so there is no lint command to run. |

Deviations: none

Open items:
- The task was bounded by the INVOCATION census rather than the eleven-arm list,
  and the census reaches two arms the plan did not enumerate: `seam: a bare or
  blank --trigger appends NOTHING at all` (`cadence-core/bin/trace.test.mjs`)
  and the `--round` rows of `seam: a malformed settled count appends NOTHING at
  all`. Both were carried across on the census's authority. All 15 remaining
  grep hits either carry a figure in the spawned array or name no settle event.
- The plan's rationale for the ninth arm - that `seam: a malformed --raised
  appends NOTHING at all` "stays green while silently ceasing to prove the
  `--raised` validation it exists for" - is measured false as stated, and the
  same holds for the two arms above. `--raised`, `--trigger`, `--survivors`,
  `--downgraded`, `--refuted` and `--round` are all declared in
  `CONTRACTS['planning.mjs']['trace append']` with `value: 'refuse'` and
  `bare: 'refuse'`, and PLAN-3 wires its presence door only after `evaluateRow`
  returns `ok`, so the VALUE door answers first and those arms keep proving
  their own refusal either way. The figures were added regardless: harmless,
  asked for, and they make the census clean under every reading. Nothing in the
  plan's `Verify:` or `## Must be true when done` turned out wrong, so this is a
  note rather than a deviation - but PLAN-3's task-1 arms should not assume the
  new door is what refuses a malformed-value call.
- `cadence-core/bin/trace.test.mjs`'s `receipt` helper now takes the event as a
  second parameter (`receipt(extra, event = 'adjudication')`), so its line no
  longer matches the literal census grep. Every one of its 12 call sites was
  audited individually: all carry at least one of the three figures except
  `receipt([], 'rearm')`, which names no settle event by design.
- Two full-suite runs were spent on purpose, not one: the task's `Verify:`
  requires the working-tree suite AND a re-run against a scratch copy carrying
  the PLAN-3 prototype, which is the only check that can falsify the migration's
  completeness.
- Untracked and not mine, present before this dispatch and left alone:
  `.planning/phases/1/REVIEW-risk_surface-plan-1.md` and
  `.planning/tasks/gh-179-gaps-execute/`.
