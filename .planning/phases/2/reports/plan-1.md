PLAN COMPLETE
Plan: .planning/phases/2/PLAN-1.md
Tasks: 5 of 5
| Task | Commit | Note |
|---|---|---|
| 1. The `/cad-adopt` command, end to end | 22a2bd0 | New skill (923 B) + workflow (11,941 B), both budgeted at measured size; self-verify green, no `Task` grant, nothing in `route-table.json` or `trace.test.mjs`, `--show-toplevel` gate in `setup` with `--git-dir` named on exactly one line, the one forbidding it. |
| 2. Adopt asks only what the repo cannot answer | 1abf6b9 | `questioning` step added between `survey` and `write_project`; budget row re-pinned 11,941 -> 14,966 B. The forbidden-mechanism grep returns only the two forbidding lines: the roadmap coverage rule was reworded "100% coverage" -> "full coverage" so the `[0-9]+%` arm has no non-forbidding hit. |
| 3. The five absent-`.planning/` surfaces learn the second door | 838d155 | One hit per file at its D-15 site (progress.md:40, cad-health/SKILL.md:25, context.md:40, config.md:13, git-guard.md:42); five budget rows re-pinned; `test.mjs prose` 212/212. |
| 4. Register `/cad-adopt` in the command reference | 0bbf708 | Row at COMMANDS.md:13, directly under `/cad-new-project` in `## Build spine (the core loop)`; budget re-pinned 4,190 -> 4,370 B. `skills/cad-help/SKILL.md` untouched per the task's own instruction - its eager `@`-include (:15) and its objective (:10) both name the reference, so the row IS cad-help's registration. |
| 5. README names the second door, ledger README cites re-pinned | 7a87530 | README.md:72 (second-door paragraph under `## The loop`) and :119 (Support bullet under `## The commands`). 19 `README-*` `line` cells re-pinned to live locations in the SAME commit, `claim`/`verdict`/`resolution` untouched; the `## Reading this ledger` note records the re-pin. Ten tail rows (README-41 on, README-47 excepted) were already off by one before this phase and are now live too. |
Deviations: none
Open items:
- Four human-verify items are deferred to `/cad-verify 2` exactly as the plan routes them, none blocking here: the subdirectory refusal walk (task 1), AC1 + AC2 (a walked `/cad-adopt` on a brownfield checkout - the plan's Notes name `/code/axel` as the cheapest candidate, `/code/powercurve` and `/code/headroom` larger), and AC3 (adopt asks about no goal/stack/build-command the repo already states).
- README.md:142's "23 skills" count is wrong before this phase touched it (v3.0.0's `cad-report` made it 24) and `/cad-adopt` makes it 25. Left standing per the plan's Notes; the next docs sweep files it as its own defect. README-44 in the ledger cites that line and its verdict cell was deliberately not changed.
