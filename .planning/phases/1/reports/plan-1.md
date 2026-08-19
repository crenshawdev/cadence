PLAN COMPLETE
Plan: .planning/phases/1/PLAN.md
Tasks: 7 of 7
| Task | Commit | Note |
|---|---|---|
| 1. Add the tested free-suffix picker | e32fa3f | `lib/report-rotation.mjs` + 5 fixture tests; mutation to `to: from` reddened case 2, restored green; `test.mjs --list` shows the stem in `other`; tsc clean |
| 2. Stage the reports directory in the phase docs commit | 4f644d7 | state step now stages `<plandir>/reports/`; never-stage rule restated against the directory; `execute.md` budget re-pinned 27834 -> 28097 |
| 3. Worktree report commit carries the rotated file | 0106ba8 | pathspec widened to `plan-<k>.md [plan-<k>.<n>.md]`; directory pathspec explicitly refused; budget re-pinned 3038 -> 3441 |
| 4. Rotate-before-first-write in the executor contract | 48361c6 | one sentence + reason clause ahead of the write rule, citing the module (not invoking it); glance exemption untouched; budget re-pinned 12050 -> 12458 |
| 5. Refuse an already-executed phase in the locate step | b93522b | `status` call unconditional; refusal on derived `executed`/`complete` naming `/cad-undo <N>`, `/cad-execute <N>`, `--rerun`; argument-hint updated; budgets re-pinned 28097 -> 29218 and 742 -> 752. AC4's live-run arm is a human check, see Open items |
| 6. Pin the locate refusal with a prose-agreement test | b7470a5 | reads `<step name="locate">` by its own anchor; falsified both ways by hand (refusal deleted -> FAIL, `status` back under the `else` -> FAIL) and `execute.md` restored byte-identical |
| 7. Prove the rotated report reaches `/cad-report`'s reader | ea38b30 | AC6 case globs `phases/1/reports/plan-*.md` over a SUMMARY-less fixture; mutating the module to a `run-<n>/plan-<k>.md` subdirectory reddened it, restored green; `report.md` unchanged |
Deviations: none
Open items:
- AC4 is a human-verify arm: it needs a live `/cad-execute <N>` against a phase whose derived status is `executed`, observing the refusal and that `trace render --phase <N>` records no `phase_start` and no executor dispatch for that invocation. An executor cannot make that run - carry it to UAT.
- `--rerun` takes no `cadence-core/references/COMMANDS.md` row, per the plan's instruction (`/cad-plan`'s `--skip-check` has none either). The refusal message and `skills/cad-execute/SKILL.md`'s `argument-hint` are the only surfaces that show the flag exists.
- `lease-check`'s report exemption is still exactly `<pdir>/reports/plan-<k>.md` (`cmdLeaseCheck`'s `reportFile`), so a ROTATED report would read as `undeclared-files` if it were ever staged during a task commit. Not reachable by this plan and deliberately not changed, per the plan's Notes; recorded as the one place the two halves could later collide.
- The correlation-id overstatement in `cadence-core/bin/lib/trace.mjs` stays live per CONTEXT's Out section, and belongs in the capture queue.
