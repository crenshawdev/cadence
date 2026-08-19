---
phase: 1
status: complete
completed: 2026-08-19
---

# Phase 1: The re-run that overwrites its own evidence - Summary

A second `/cad-execute` of an already-executed phase is now refused at the locate
step, and when one is deliberately re-run under `--rerun` the executor rotates the
previous run's `reports/plan-<k>.md` aside to `plan-<k>.<n>.md` before its first
write, so two runs leave two readable records.

## What shipped

- The free-suffix picker - `cadence-core/bin/lib/report-rotation.mjs`, pure
  (classify, never emit), answering `{rotate,from,to}` from the plan number and a
  `readdirSync` listing; 7 tests in `cadence-core/bin/report-rotation.test.mjs`
- The locate refusal - `cadence-core/workflows/execute.md:26`, on the DERIVED
  status `executed`/`complete`, naming `/cad-undo <N>` then `/cad-execute <N>` as
  the supported path and `--rerun` as the deliberate override
- Rotate-before-first-write in the executor contract -
  `skills/cad-executor-contract/SKILL.md:205`, citing the module rather than
  invoking it
- The rotated report survives the transports that carry it: the worktree commit
  pathspec (`plan-<k>.md` plus `plan-<k>.<n>.md`) and the phase docs commit
  (the `reports/` DIRECTORY, with `.diff` excluded by pathspec)
- A prose-agreement test pinning the refusal and its unconditional `status` call

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | e32fa3f | Add the tested free-suffix picker for executor report rotation |
| 1 | 2 | 4f644d7 | Stage the reports directory in the phase docs commit |
| 1 | 3 | 0106ba8 | Commit the rotated report from a worktree executor |
| 1 | 4 | 48361c6 | State rotate-before-first-write in the executor contract |
| 1 | 5 | b93522b | Refuse an already-executed phase in the locate step |
| 1 | 6 | b7470a5 | Pin the locate refusal and its unconditional status call |
| 1 | 7 | ea38b30 | Prove the rotated report reaches /cad-report's glob |
| 1 | gate | b3e5ded | Exclude the flagged diff by pathspec, not by naming it (risk_surface survivor) |
| 1 | gate | 9da7b15 | Find a base report stored in another case (risk_surface survivor) |

## Deviations

None - the seven planned tasks executed as written. The two `gate` commits are the
`risk_surface` gate's own fix round, not plan deviations.

## Open items

- AC4 is a human-verify arm: it needs a live `/cad-execute <N>` against a phase
  whose derived status is `executed`, observing the refusal and that
  `trace render --phase <N>` records no `phase_start` and no executor dispatch for
  that invocation. An executor cannot make that run - carry it to UAT.
- `--rerun` takes no `cadence-core/references/COMMANDS.md` row, per the plan's
  instruction. The refusal message and `skills/cad-execute/SKILL.md`'s
  `argument-hint` are the only surfaces that show the flag exists.
- `lease-check`'s report exemption is still exactly `<pdir>/reports/plan-<k>.md`
  (`cmdLeaseCheck`'s `reportFile`), so a ROTATED report would read as
  `undeclared-files` if it were ever staged during a task commit. Not reachable by
  this plan and deliberately not changed - the one place the two halves could
  later collide.
- The correlation-id overstatement in `cadence-core/bin/lib/trace.mjs` stays live
  per CONTEXT's Out section.

## Goal check

The nine commits plausibly deliver the goal, and both halves of `#195` have a fix
site each. The unguarded half: `cadence-core/workflows/execute.md:26` stops on a
DERIVED status of `executed` or `complete` and names `/cad-undo <N>` then
`/cad-execute <N>`, with `--rerun` as the explicit override, and
`cadence-core/bin/prose-agreement.test.mjs` reads that step by its own anchor so a
later edit that deletes the refusal or puts the `status` call back under an `else`
fails the suite (the executor's report records falsifying it by hand in both
directions at b7470a5). The destructive half: `report-rotation.mjs` answers a name
no directory entry holds, `node --test 'cadence-core/bin/*.test.mjs'` passes 2387
of 2388 with 0 failures, and the AC6 case globs `phases/1/reports/plan-*.md` over a
SUMMARY-less fixture to show the rotated record is still visible to
`workflows/report.md`, the only reader that lists reports - the property a per-run
subdirectory would have broken. What is NOT proven here is the runtime behaviour:
every artifact above is prose or a pure module, so the refusal has been shown to
exist and to be pinned, never to have fired in a live run - that is AC4, and it is
the first open item above. One live edge stays open by design: `lease-check`'s
report exemption is still the unrotated name, so a rotated report staged during a
task commit would read as `undeclared-files`; the plan's Notes deliberately left it
and the open items record it. The `risk_surface` gate fired once on the committed
range, adjudicated 2 survivors of 3 raised, and both were fixed and re-reviewed
clean (b3e5ded, 9da7b15).
