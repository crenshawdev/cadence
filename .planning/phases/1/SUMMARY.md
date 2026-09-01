---
phase: 1
status: complete
completed: 2026-08-31
---

# Phase 1: The next step it names is one you can take - Summary

Three routing sites now name a next action that is actually reachable: `/cad-task`
classifies before it guards and its phase-sized arm branches on whether a planning
tree exists, `status` reports an `outstanding` plan set that `/cad-progress` routes
on, and the five auto-resume doc claims say what the command really does.

## What shipped

- Guard-after-classify in `/cad-task` - `cadence-core/workflows/task.md`, `<step name="git_guard">` now opens after `scope` closes and is scoped to the inline and planned arms
- A treeless phase-sized arm - the same file's `- **Too big**` arm branches on `planning.mjs status`: `ok:true` keeps `/cad-phase add`, `no-planning-dir` names `/cad-adopt` and `/cad-new-project` instead
- One definition of "this plan's report says complete" - `readPlanReports` hoisted to `cadence-core/bin/planning/core.mjs`, imported by `replay-check.mjs`
- The `outstanding` key on the `status` envelope - `cadence-core/bin/planning/status.mjs`, always present, `[]` when empty, deep-equal to `replay-check`'s `dispatch_set`
- The route row that reads it - `cadence-core/workflows/progress.md:196`, an executed phase `outstanding` names routes to `/cad-execute {N}` instead of `/cad-verify {N}`
- A gap plan the seam can see - `cadence-core/workflows/plan-gaps.md` step 3 writes the next free `PLAN-<n>.md` instead of overwriting `PLAN.md`
- The auto-resume claims restated - `README.md:49`, `skills/cad-progress/SKILL.md:3`, `skills/cad-pause/SKILL.md:3,16`, `cadence-core/references/COMMANDS.md:18`, `cadence-core/workflows/progress.md:6-7`, plus the `DOCS-CLAIMS.md` README-32 row

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | d546d91c | Run the branch guard after classification, on the arms that commit |
| 1 | 2 | bf02a407 | The phase-sized arm branches on what is actually on disk |
| 2 | 1 | d5e78e6d | One definition of a plan report reading complete |
| 2 | 2 | 071dde61 | `status` reports the outstanding executable plan set |
| 3 | 1 | 95d791b2 | An executed phase with outstanding dispatches routes to `/cad-execute` |
| 3 | 2 | c682da4e | `/cad-plan --gaps` writes the next free plan number |
| 4 | 1 | 7e3e23a1 | `/cad-progress` offers to resume, it does not auto-resume |

## Deviations

None - plans executed as written.

## Open items

- The `DOCS-CLAIMS.md` ledger gained the rewritten README-32 row but no prose callout under `## Reading this ledger`. Plan 4 declined it because the row's own resolution cell names the README-44 shape it follows, so the paragraph would restate the row. Add one if a future sweep finds the resolution cell too small to carry it.
- Both of plan 3's `diff` review findings were confirmed as accurate observations and downgraded rather than fixed: `progress.md`'s always-present rule for `outstanding` has no routing row acting on an absent key (unreachable - the workflow and the seam ship as one plugin artifact, and `deferred` already carries the same wording), and `plan-gaps.md`'s `ls`-then-write filename pick is check-then-act under two concurrent `/cad-plan --gaps` on one phase (no plan-file write path in the tree takes a lock). Both were declined to `.planning/DECLINED.md`.

## Goal check

The seven commits deliver the phase goal. Site one: `cadence-core/workflows/task.md` now
orders `scope` before `git_guard` before `bracket` (`grep -n '<step name='` lists them in
that order, and the new `PHS-03` prose test is non-vacuous because `scope < guard` was false
on the pre-change file, guard at line 21 and scope at 26), and its `- **Too big**` arm names
`/cad-adopt` and `/cad-new-project` rather than `/cad-phase add` when `status` answers
`no-planning-dir`. Site two: `planning.mjs status` on this repo printed
`"outstanding":[{"phase":1,"plans":["PLAN-2.md","PLAN-3.md","PLAN-4.md"]}]` at 071dde61, a
fixture test pins that list deep-equal to `replay-check --phase 1`'s `dispatch_set`, and
`cadence-core/workflows/progress.md:196` is the route row that consumes it - so the gap-plan
skip is closed at both the deriving end and the routing end, and c682da4e closes the third
end by making `--gaps` write a plan the seam can see (a scratch fixture returned
`dispatch_set:["PLAN-2.md"]`). Site three: `grep -rn -iE 'auto[- ]?resum|automatic(ally)?
resum|resumes automatically'` over `README.md`, `skills`, `cadence-core` and
`.planning/DOCS-CLAIMS.md` now exits 1 with no output. Nothing is missing against the three
requirements, and the full suite at 7e3e23a1 was 3684 tests, 3683 pass, 0 fail, 1
pre-existing skip, with `npx tsc -p tsconfig.ci.json` clean. What this phase does NOT do is
teach `/cad-progress` to invoke the resumed step without asking - that was never the defect;
the ask-user gate at `progress.md:233-239` predates it and stands.
