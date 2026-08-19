---
phase: 1
plan: 1
requirements:        # none seeded for v3.5.6 - planned against CONTEXT.md AC1-AC6, see Notes
files:
  - cadence-core/bin/lib/report-rotation.mjs
  - cadence-core/bin/report-rotation.test.mjs
  - cadence-core/workflows/execute.md
  - cadence-core/references/worktree-executor.md
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-execute/SKILL.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The re-run that overwrites its own evidence - Plan

## Goal

Re-running an executed plan stops being both unguarded and destructive: the
locate step refuses a phase whose derived status is `executed`, and a second run
rotates the previous run's `reports/plan-<k>.md` aside before its first write, so
two runs of one plan leave two readable records instead of one.

## Must be true when done

- `/cad-execute <N>` against a phase whose DERIVED status is `executed` or
  `complete` stops in the locate step - before the protected-branch guard, before
  the `phase_start` trace anchor and before any executor dispatch - and names
  `/cad-undo <N>` then `/cad-execute <N>` as the supported path, with `--rerun`
  as the deliberate way through.
- `planning.mjs status` runs on every `/cad-execute` invocation, so a phase
  number on the command line no longer skips the derivation and the plan-file
  list the same step consumes.
- A second executor run against a plan whose report already exists leaves the
  previous run's report readable and byte-identical at a `plan-<k>.<n>.md` name,
  with the new run's record at `plan-<k>.md`.
- The free-suffix choice is a tested pure module under `cadence-core/bin/lib/`,
  and mutating it to return the base name unchanged reddens its tests.
- Both reports reach history: the phase docs commit stages the reports DIRECTORY,
  and a worktree executor's own report commit names the rotated file beside
  `plan-<k>.md` - neither ever carrying a `plan-<k>-risk-task-<n>.diff`.
- The glob `/cad-report` already uses,
  `.planning/phases/<N>/reports/plan-*.md`, matches both records.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array at every commit in this phase.

## Context

Locked by `.planning/phases/1/CONTEXT.md`: D-01 run scoping is rotation-on-write
and NOT a key - no run identifier is derived, minted or carried in the dispatch,
and the current run's path stays `<plandir>/reports/plan-<k>.md` derived from the
plan path alone; D-02 the suffix choice is a pure `cadence-core/bin/lib/` module
with fixture tests, pointed at from the executor contract in one sentence; D-03
the state step stages `<plandir>/reports/` as a directory; D-04 locate refuses
derived `executed` and `complete` and the `status` call becomes unconditional.
Out of scope, deliberately: any change to the correlation id itself, and the
three other `v3.5.6` issues (#139, #140, #145). `cadence-core/workflows/report.md`
and `cadence-core/workflows/task.md` need no edit - their reads still resolve to
the current run's `plan-<k>.md`, and report.md's `plan-*.md` glob already matches
a rotated file.

## Tasks

### Task 1: Add the tested free-suffix picker

- **Files:** cadence-core/bin/lib/report-rotation.mjs (new), cadence-core/bin/report-rotation.test.mjs (new)
- **Action:** Add a pure module under `cadence-core/bin/lib/` that answers where
  an existing per-task report must move before an executor's first write. Given a
  plan number and the entry names already present in that plan's `reports/`
  directory, it answers either that no rotation is needed (no `plan-<k>.md` is
  there) or the free name to move the existing one to, of the form
  `plan-<k>.<n>.md`. That shape is load-bearing and not cosmetic: it is what
  `cadence-core/workflows/report.md`'s `.planning/phases/<N>/reports/plan-*.md`
  glob matches, and a per-run SUBDIRECTORY would not (CONTEXT flagged
  assumption). Planner's discretion, recorded here because CONTEXT left the
  choice open: pick the LOWEST positive integer suffix not already taken, which
  is total, needs no interpretation of a gap left by a hand-deleted report, and
  is what D-01's "a free suffix" names. Pure in the sense
  `cadence-core/bin/lib/plan-key.mjs` and `cadence-core/bin/lib/lease-grammar.mjs`
  are - classify, never emit, no fs, no env, no process, no randomness - so the
  caller owns the directory read and the rename. Give it the header this tree's
  lib modules carry: the defect it closes, and why the answer is a free suffix
  rather than a run key - `correlationId` in `cadence-core/bin/lib/trace.mjs`
  returns `${phase}-${sha}` from the newest `phase_start` anchor, so a run that
  died before committing anything re-mints the same string and a key derived from
  it re-collides (CONTEXT D-01). Add NO CLI entry point and no
  `lib/arg-contract.mjs` `CONTRACTS` row: `self-verify.mjs` check 14 records that
  a `lib/*.mjs` module is one prose never invokes, and a new top-level script
  would pull in a contracts row, a seam envelope and a self-verify obligation
  this phase has no decision for. Test it against real fixture directories built
  under `mkdtempSync` (the pattern `cadence-core/bin/planning.test.mjs` already
  uses), feeding the module what `readdirSync` returns, across the three states
  CONTEXT names - no report present, one present, several already rotated - plus
  the round trip: write a report, rotate by the module's answer, write a new one,
  rotate again, and assert three readable reports with the earliest byte-identical
  to its pre-rotation content.
- **Verify:** `node --test cadence-core/bin/report-rotation.test.mjs` passes, and
  its output names a case covering each of the three fixture states plus the
  rotate-twice round trip. Then edit the module so it answers the base name
  `plan-<k>.md` unchanged, re-run, and at least one case FAILS; restore the
  module and it passes again. `node cadence-core/bin/test.mjs --list` shows the
  `report-rotation` stem in a group, so CI runs it.

### Task 2: Stage the reports directory in the phase docs commit

- **Files:** cadence-core/workflows/execute.md (its `<step name="state">`), cadence-core/bin/weight-budgets.json (its execute.md row)
- **Action:** In the state step's docs-commit list, replace "every plan's
  `<plandir>/reports/plan-<k>.md`" with the DIRECTORY `<plandir>/reports/`, and
  restate the step's existing never-stage rule for
  `plan-<k>-risk-task-<n>.diff` against a directory instead of against a named
  file (D-03). Naming the file by name is what breaks under rotation: the
  executor moves the previous run's report to `plan-<k>.<n>.md` and writes new
  bytes at `plan-<k>.md`, so a by-name stage commits only the new bytes and
  leaves the previous run's record untracked in the working tree - lost from
  history, and leaving the tree dirty for every later step that checks it. Keep
  the staging bounded to that directory and change nothing else in the list:
  `<plandir>/reports/` is the same shape
  `skills/cad-executor-contract/SKILL.md`'s post-commit glance exemption already
  uses (`<plandir>/reports/**`), so the two rules read alike. The transient
  flagged diff lives INSIDE that directory, so a directory add sweeps it in
  unless the restated rule excludes it - `cadence-core/references/worktree-executor.md`
  states why it must never reach history. Re-pin this surface's row in
  `cadence-core/bin/weight-budgets.json` in the SAME commit as the prose edit
  (AC5): it sits at exactly its 27834-byte ceiling with zero headroom and
  `self-verify.mjs` reports `budget-overrun` on any growth. Take the new figure
  from `node cadence-core/bin/weight.mjs --root .`, which is the same measurement
  library self-verify enforces with.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []`. `grep -n 'reports/' cadence-core/workflows/execute.md`
  shows the state step naming `<plandir>/reports/` in its staging list and no
  longer naming `plan-<k>.md` there, and shows the never-stage sentence for
  `plan-<k>-risk-task-<n>.diff` still present in that step.

### Task 3: Make a worktree executor's report commit carry the rotated file

- **Files:** cadence-core/references/worktree-executor.md (its commit-the-report bullet), cadence-core/bin/weight-budgets.json (its worktree-executor.md row)
- **Action:** That bullet commits by pathspec `git commit --
  <plandir>/reports/plan-<k>.md`. Under rotation that pathspec commits only the
  current run's bytes: the file the executor moved the previous run's report to
  is untracked, never reaches the branch, and dies with the worktree - which is
  exactly the evidence the rotation exists to keep, on the path CONTEXT already
  calls the one most likely to be abandoned. Widen it so the rotated file is
  committed beside `plan-<k>.md` when the executor rotated one. Keep it a
  PATHSPEC and never a bare `git commit`: the bullet's own stated reason is that
  a `risk_surface` checkpoint deliberately leaves the flagged changes STAGED and
  a bare commit would sweep them in, turning a blocking gate into a landed
  commit. A bare `<plandir>/reports/` directory pathspec is not the fix either -
  `plan-<k>-risk-task-<n>.diff` lives inside that directory and this same bullet
  forbids it reaching history, so the widening must name what it commits. Leave
  the never-commit sentence for that diff, and the delete-it-first note about
  `git worktree remove`, exactly as they are. Re-pin this surface's budget row in
  the same commit - it measures 3038 against a 3038 budget, so any growth is a
  `budget-overrun` (AC5).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []`. `node cadence-core/bin/test.mjs prose` passes.
  `grep -n 'git commit' cadence-core/references/worktree-executor.md` shows a
  pathspec form that names the rotated report as well as `plan-<k>.md`, and
  `grep -n 'risk-task' cadence-core/references/worktree-executor.md` still shows
  the never-commit rule.

### Task 4: State rotate-before-first-write in the executor contract

- **Files:** skills/cad-executor-contract/SKILL.md (its `<report_file>` section), cadence-core/bin/weight-budgets.json (its cad-executor-contract row)
- **Action:** In `<report_file>`, ahead of the "Write it after EVERY task commit"
  rule, state in ONE sentence that the first write of a dispatch first renames any
  `<plandir>/reports/plan-<k>.md` already on disk to the free `plan-<k>.<n>.md`
  name that `cadence-core/bin/lib/report-rotation.mjs` states and tests, plus the
  reason in a clause: that file is a previous run's only per-task record of what
  ran and what it printed, and a second run's first task commit would otherwise
  overwrite it before anything read it (D-01, D-02). Name the module as where the
  rule is stated and tested, NEVER as a command to run - a `lib/*.mjs` module
  takes no `CONTRACTS` row and prose never invokes one (`self-verify.mjs` check
  14). Do not touch the derive-the-path rule above it: the current run's report is
  still `<plandir>/reports/plan-<k>.md` derived from the plan path alone, which is
  what keeps `/cad-task`'s `.planning/tasks/<slug>/` dispatch working and is
  precisely why D-01 rejected a dispatch-supplied run key. The
  `<plandir>/reports/**` post-commit glance exemption in `<commit_protocol>` step
  5 already covers a rotated file and must not be edited. This surface is
  preloaded into every `cad-executor` rung and sits at exactly its 12050-byte
  ceiling, so hold the addition to that one sentence and its clause and re-pin its
  budget row in the SAME commit (AC5), taking the figure from
  `node cadence-core/bin/weight.mjs --root .`.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []`, and `node cadence-core/bin/test.mjs prose` passes.
  `grep -n 'report-rotation' skills/cad-executor-contract/SKILL.md` shows the rule
  naming the module, while `grep -n 'node .*report-rotation'
  skills/cad-executor-contract/SKILL.md` finds nothing - the module is cited, not
  invoked. `grep -n 'reports/\*\*' skills/cad-executor-contract/SKILL.md` still
  shows the glance exemption unchanged.

### Task 5: Refuse an already-executed phase in the locate step

- **Files:** cadence-core/workflows/execute.md (its `<step name="locate">`), skills/cad-execute/SKILL.md (its argument-hint), cadence-core/bin/weight-budgets.json (the rows for both surfaces)
- **Action:** Restructure the locate step's first bullet so
  `planning.mjs status` runs on EVERY invocation rather than only on the
  no-argument branch (D-04). Today `$ARGUMENTS` short-circuits it, so
  `/cad-execute 3` reaches locate with neither a derived status nor the `phases[]`
  entry the next sentence's plan-file list comes from. `$ARGUMENTS` then selects
  which `phases[]` entry to take and an absent argument takes `current`; keep the
  existing `ok:false` relay, the `cycle: "none"` closed-milestone stop and the
  unplanned/no-plan-files stop exactly as they read. Then add the refusal: a phase
  whose DERIVED status is `executed` or `complete` stops here - before
  `git_guard`, so before the protected-branch guard, before the `phase_start`
  trace append and before any dispatch - naming `/cad-undo <N>` then
  `/cad-execute <N>` as the supported path and `--rerun` as the deliberate way
  through. Refuse `complete` alongside `executed` because it re-runs identically
  today and destroys the same evidence one status later. Read the status from the
  DERIVATION in `phases[]` and never from the cursor: `cadence-core/bin/planning.mjs`
  states in as many words that the cursor is a hint the derivation beats. Parse
  `--rerun` off `$ARGUMENTS` beside the phase number, and add it to
  `skills/cad-execute/SKILL.md`'s `argument-hint`, which is the only other surface
  that shows a user the flag exists. The spelling is the planner's choice, which
  CONTEXT left open: `--rerun` names the one thing it permits rather than reading
  as a general safety override, matches this tree's descriptive flag convention
  (`--skip-check`, `--no-commit`), and occurs nowhere in the plugin today. Do not
  add a row to `cadence-core/references/COMMANDS.md`: `/cad-plan`'s `--skip-check`
  has none either, and the refusal message plus the argument hint are what make
  the flag discoverable. Re-pin BOTH surfaces' budget rows in this same commit
  (AC5) - `execute.md` at its 27834 ceiling and `skills/cad-execute/SKILL.md` at
  742 - from `node cadence-core/bin/weight.mjs --root .`.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []`. `sed -n '/<step name="locate">/,/<\/step>/p'
  cadence-core/workflows/execute.md` prints a locate step in which the
  `planning.mjs status` invocation is stated unconditionally and not after an
  "else", and which carries a refusal naming derived `executed`, derived
  `complete`, `/cad-undo <N>`, `/cad-execute <N>` and `--rerun`.
  `grep -n argument-hint skills/cad-execute/SKILL.md` shows `--rerun`.
  human-verify (AC4, needs a live run the executor cannot make): run
  `/cad-execute <N>` against a phase whose derived status is `executed` and
  observe that it stops with that refusal, that it names `/cad-undo <N>` then
  `/cad-execute <N>`, and that `node cadence-core/bin/planning.mjs trace render
  --phase <N>` records no executor dispatch and no `phase_start` for that
  invocation.

### Task 6: Pin the locate refusal with a prose-agreement test

- **Files:** cadence-core/bin/prose-agreement.test.mjs (beside its WIR-01 test)
- **Action:** Add one test that reads `cadence-core/workflows/execute.md`'s locate
  step and asserts both halves of D-04 (AC3): that the step refuses derived status
  `executed` AND derived status `complete`, and that its `planning.mjs status`
  invocation is not under the `else` branch of the `$ARGUMENTS` bullet. Assert too
  that the refusal names `/cad-undo <N>` and `/cad-execute <N>`, since a refusal
  that names no way forward is the failure D-04's "naming the supported path"
  clause exists against. Follow this file's own stated discipline: read the named
  region by its own anchor rather than by the shape of the prose around it, so a
  rewrap stays green while a revert of either half reddens - the `WIR-01` test
  already in this file reads `execute.md` positionally by a heading it splits on,
  and `sentenceAround` and `doc` are the helpers to reuse. Do NOT assert any
  report-path literal here: under D-01 the current run's path is still
  `plan-<k>.md`, so there is no new literal to assert and a grep for a string the
  same commit writes cannot fail, which is exactly the weak shape D-02 rejected.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes.
  Falsifiable in both directions, checked by hand and then restored: delete the
  `executed`/`complete` refusal from `cadence-core/workflows/execute.md` and the
  test FAILS; restore it, move the `status` call back under the `else` branch and
  the test FAILS again; restore the file and it passes. `node
  cadence-core/bin/test.mjs prose` passes on the restored tree.

### Task 7: Prove the rotated report reaches `/cad-report`'s reader

- **Files:** cadence-core/bin/report-rotation.test.mjs
- **Action:** Close AC6 with a case in the same test file task 1 created, rather
  than with a claim in Notes. The criterion was restated at the `plan` gate on
  2026-08-19 - `cadence-core/workflows/report.md` opens
  `.planning/phases/<N>/reports/plan-*.md` ONLY when `SUMMARY.md` is absent, so
  the observable form is a SUMMARY-less phase - and the property under test is
  the one that makes rotation safe for the reader: BOTH names the rotation
  produces are matched by the glob that workflow uses. Build a fixture phase
  directory under `mkdtempSync` with `reports/plan-1.md` present and no
  `SUMMARY.md`, rotate by task 1's module, write a new report at the base name,
  then resolve `reports/plan-*.md` against that directory with the same glob
  `report.md` names, and assert the resolved set is exactly both files with the
  rotated one's bytes unchanged. Do NOT invoke `/cad-report` from the test: the
  workflow is prose an agent runs, not a callable, which is why the test targets
  its glob. Change nothing in `cadence-core/workflows/report.md` - its glob
  already matches `plan-<k>.<n>.md`, and it is not in this phase's In: list.
- **Verify:** `node --test cadence-core/bin/report-rotation.test.mjs` passes and
  its output names the AC6 case. Then edit task 1's module to answer a per-run
  SUBDIRECTORY name (`reports/<key>/plan-1.md`) instead of a suffixed sibling,
  re-run, and that case FAILS because the glob resolves one file; restore the
  module and it passes. `grep -n 'reports/plan-\*\.md' cadence-core/workflows/report.md`
  still shows the unchanged glob.

## Notes

- **No requirement ids exist for this phase.** `.planning/ROADMAP.md`'s phase 1
  entry reads `**Requirements:** (seeded at /cad-context)` and none were seeded;
  `.planning/REQUIREMENTS.md`'s `## Active` section carries no open-cycle ids.
  This plan is therefore written against `.planning/phases/1/CONTEXT.md`'s
  acceptance criteria AC1-AC6, and the frontmatter `requirements:` list is
  deliberately empty rather than filled with AC ids, which are not requirement
  ids and would trace to nothing at `/cad-audit`. Coverage: AC1 and AC2 by task 1,
  AC3 by task 6, AC4 by task 5's human-verify arm, AC5 by the same-commit budget
  re-pin in tasks 2-5, AC6 by task 7.
- **AC6 was restated at the `plan` gate on 2026-08-19, and task 7 covers it.**
  The blocking cross-model reviewer found the original wording unsatisfiable:
  `cadence-core/workflows/report.md` opens `.planning/phases/<N>/reports/plan-*.md`
  ONLY when `SUMMARY.md` is absent (an unfinished phase), so on a phase that has
  a SUMMARY, `/cad-report <N>` reads the SUMMARY instead and lists no report
  files at all - whatever they are named. The user chose to restate the criterion
  against a SUMMARY-less phase rather than change `report.md`'s selection rule,
  which is out of scope (`report.md` is not in CONTEXT's In: list). Task 7 tests
  the property that makes the restatement true: both names rotation produces are
  matched by the glob that workflow uses. No change to `report.md` is planned,
  and none is needed.
- **`lease-check`'s report exemption is exactly one path**, `<pdir>/reports/plan-<k>.md`
  (`cadence-core/bin/planning.mjs`, `cmdLeaseCheck`'s `reportFile`), so a ROTATED
  report would read as `undeclared-files` if it were ever staged during a task
  commit. It is not reachable by this plan - a sequential executor never stages
  its report, and a worktree executor commits by pathspec without touching the
  index - so no change is planned. Recorded because it is the one place the two
  halves of this phase could later collide.
- **The correlation-id overstatement stays live**, per CONTEXT's Out section:
  `cadence-core/bin/lib/trace.mjs`'s comments assert a per-run uniqueness
  `correlationId` does not provide. This phase routes around it rather than
  fixing it, and it belongs in the capture queue.
- Prior-art citation for D-01's shape: recalled memory from
  `.planning/phases/1/CONTEXT.md`, phase 1 - "Run scoping is rotation-on-write,
  not a key" - is the decision tasks 1 through 4 implement literally.
