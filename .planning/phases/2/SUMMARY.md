---
phase: 2
status: complete
completed: 2026-08-27
---

# Phase 2: Refuse the replay - Summary

`/cad-execute <N>` now reads each plan's `reports/plan-<k>.md` first line inside
`locate` and refuses to re-dispatch a phase whose every plan already reports
`PLAN COMPLETE`, and dispatches only the plans that do not.

## What shipped

- The replay stop - a new `locate` arm in `cadence-core/workflows/execute.md:40-68`,
  placed below the existing `executed`/`complete` arm so
  `prose-agreement.test.mjs`'s `#195` test still finds its own. It fires on no
  `--rerun` plus a first line reading exactly `PLAN COMPLETE` for every plan,
  names each report path and both remedies, and stops before `git_guard`, the
  `phase_start` anchor and any dispatch.
- The dispatch set - `cadence-core/workflows/execute.md:70-85`: the phase's plans
  minus every plan already reporting complete, with the rail stated once for both
  paths and the two things it does not govern (`plan-overlap` in `choose_path`,
  and `summary` still reading every report) written down rather than inferred.
- Both dispatch sites spend it: `execute_sequential` iterates the set
  (`execute.md:207`) and `cadence-core/references/execute-parallel.md:9-10`
  dispatches per plan in the set. That second half is the plan review's surviving
  finding - the rail alone would have left the parallel path saying "per plan".
- Test coverage - 130 new lines in `cadence-core/bin/prose-agreement.test.mjs`
  pinning the arm, its trigger clause, the `PLAN COMPLETE` first-line-exact
  discriminator, both dispatch sites, the `--rerun` arm and the `summary`
  carve-out.
- Rationale - two new `## locate` sections in `docs/rationale/execute.md`, naming
  the unmerged-worktree fail-open at line 57.
- `cadence-core/bin/weight-budgets.json` re-pinned for both prose surfaces:
  `execute.md` 29001 -> 32404, `execute-parallel.md` 5674 -> 5711.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 154a54fd | `locate` stops when every plan already reports complete |
| 1 | 2 | 92b21bee | Dispatch only the plans with no completed report |
| 1 | 3 | 8c2720b5 | Record why the replay guard reads a file, not the derivation |

## Deviations

None - plans executed as written.

## Open items

- The plan's task 1 asked the arm to say "never a `plan-*.md` glob" while the same
  task's test asserts the arm carries no `plan-*.md` literal. Both cannot hold, so
  the arm forbids globbing the `reports/` directory without spelling the glob.
  The prohibition and the assertion both stand; nothing about the criterion turned
  out wrong.
- AC3 and AC5 are human-verify and were not observed by this run. Both need a live
  `/cad-execute` against a phase in the replay shape to read `.planning/trace.jsonl`
  for the dispatch count. The prose halves are pinned by tests; the workflow's
  obedience to them is not.
- From the plan review (`ADJUDICATION-plan-plan-ce20da59.json`), the downgraded
  finding asked the prose test to pin the FIRST LINE reading exactly
  `PLAN COMPLETE`. The executor folded that assertion in at task 1, so this item
  is closed rather than carried.

## Goal check

The three commits plausibly deliver the goal. The stop the goal asks for exists at
`cadence-core/workflows/execute.md:40-68` and is worded as a `-> stop:` arm below
the `executed`/`complete` one, which is where it has to sit for
`prose-agreement.test.mjs:717` to keep finding its own arm by the first `/cad-undo`.
The "pays nothing" half is structural rather than asserted: the arm's closing
sentence stops before `git_guard`, before the `phase_start` trace anchor and before
any executor dispatch, so a refused run writes no lifecycle event and buys no
dispatch. The partial case the goal implies - some plans complete, some not - is
handled by the dispatch set at `execute.md:70-85`, and both sites that dispatch
now read it (`execute.md:207` and `references/execute-parallel.md:9-10`).
`node cadence-core/bin/test.mjs` reports 3460 pass / 0 fail and
`node cadence-core/bin/self-verify.mjs` reports `ok:true` with an empty `problems`
array, so the budget re-pins landed and no prose-agreement check regressed.

What is NOT shown by this run: every criterion above is pinned as PROSE, and prose
is what the orchestrator is asked to obey rather than what a program enforces. AC3
(exactly one dispatch keyed to plan 2 on a half-reported phase) and AC5 (zero
dispatches against the spike's probe shape) are both statements about
`.planning/trace.jsonl` after a live run, and no live run in that shape happened
here. They are carried as open items, not claimed.
