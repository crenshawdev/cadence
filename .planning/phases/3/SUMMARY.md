---
phase: 3
status: complete
completed: 2026-08-29
---

# Phase 3: The too-big arm opens a door - Summary

`/cad-task`'s phase-sized arm now names `/cad-phase add` first and prints a phase number Cadence resolved from `planning.mjs status` (`total + 1`), and the three other surfaces that stated the old route - the mid-task guardrail, the `cad-task` SKILL objective, and `/cad-context`'s off-roadmap stop - name the same door.

## What shipped

- The too-big arm, rewritten to resolve `{N}` and print `/cad-phase add $TASK` -> `/cad-context {N}` -> `/cad-plan {N}` - `cadence-core/workflows/task.md:34-42`
- The mid-task re-route guardrail, renamed to the same door - `cadence-core/workflows/task.md:275`
- The `/cad-task` objective that rides every session's prompt - `skills/cad-task/SKILL.md:20`
- `/cad-context`'s off-roadmap stop, naming the command that creates the phase - `cadence-core/workflows/context.md:33`
- `/cad-phase`'s `argument-hint`, advertising that `add` takes a description - `skills/cad-phase/SKILL.md:4`
- Five prose-agreement tests pinning order, the resolve rule, the `$TASK` carry, the absence of the old route, and the context stop - `cadence-core/bin/prose-agreement.test.mjs:3167+`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 8b4dd932 | the too-big arm names /cad-phase add and resolves the phase number |
| 1 | 2 | deaa20c1 | the guardrail and the SKILL objective name the open door too |
| 1 | 3 | 044d7653 | the off-roadmap stop in /cad-context names the door that creates the phase |
| 1 | 4 | dcbff533 | /cad-phase's argument-hint advertises the description add already takes |
| 1 | 5 | b73c2965 | pin the new route so it cannot drift back to the locked door |

## Deviations

None - plans executed as written.

## Open items

- Test (4) also asserts the ABSENCE of `/cad-context` in task.md's `<guardrails>` block, where the plan required only the presence of `/cad-phase add`. One extra line, and it closes the surviving `low` finding in `ADJUDICATION-plan-plan-1.json`: a guardrail rewritten as "re-route to /cad-context, then /cad-phase add" would have passed a presence-only check with the mid-task path regressed.
- Task 5's mutation check reddened assertions (1), (2) and (3) rather than (1) alone, because all three pin facts of the arm the mutation deleted (312 prose tests, 309 pass, 3 fail; (1) failed on its own named message). That is the surviving `medium` adjudication finding at `PLAN.md:201`. A single-assertion mutation would have to delete only the route sentence and leave the resolve rule and the `$TASK` carry standing.
- No helper was extracted for the `<guardrails>` slice or the off-roadmap-stop slice in task 5. Each is a two-line `indexOf`/`slice` at one caller; only `tooBigArm` is reused across tests.
- AC6 - following the printed sequence live, from a repo whose roadmap carries no matching phase - is human-verify by design and belongs to `/cad-verify`'s UAT walk. Its mechanical half is test (2).
- The `diff` fire's one survivor, filed as an issue on `crenshawdev/cadence` (fingerprint `ca31319a4c232c0c`, low): the PHS-02 tests certify prose strings and that `status` returns an integer `total`, not that the printed sequence reaches the phase `/cad-phase add` creates. Same gap AC6 covers by hand.

## Goal check

The commits plausibly deliver the goal. Every surface that stated the old locked route now states the open one: the arm itself prints `/cad-phase add $TASK` before `/cad-context {N}` (`cadence-core/workflows/task.md:40`), the mid-task guardrail re-routes to `/cad-phase add` (`task.md:275`), the SKILL objective says "Feature-sized requests get re-routed to /cad-phase add" (`skills/cad-task/SKILL.md:20`), and `/cad-context`'s own refusal now names the creating command instead of dead-ending (`cadence-core/workflows/context.md:33`). The number is real rather than a placeholder - the arm resolves it from `planning.mjs status` as `total + 1`, and `status` answers `total: 5` on this repo today - and `/cad-phase`'s `argument-hint` advertises `add [description]`, which is what the printed sequence hands it (`skills/cad-phase/SKILL.md:4`). Five tests pin all of it without line numbers, and the executor's mutation check confirmed they redden when the old sentence is restored (312 prose tests, 309 pass, 3 fail). What is NOT proven mechanically is success criterion 2 - that following the printed sequence end to end in a live session reaches a planned phase with no command refusing. The tests assert prose and one envelope field; the walk is `/cad-verify`'s UAT item, and the gap is filed as an issue. One further honest caveat, raised by both blocking reviews and downgraded in both: `{N}` is printed before `/cad-phase add` runs, so a roadmap that gains a phase in between leaves the trailing `/cad-context {N}` pointing at the wrong one. That needs a concurrent writer in a single-operator planning repo, and `/cad-phase add` still appends at the true end.
