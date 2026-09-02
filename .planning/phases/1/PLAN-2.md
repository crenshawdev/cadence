---
phase: 1
plan: 2
requirements:
  - RNG-05
  - RSK-10
files:
  - cadence-core/references/risk-surface.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/debug.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/task.md
  - cadence-core/references/execute-parallel.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
---

# Phase 1: A gate refuses the range it could not resolve - Plan 2 of 2 (the workflow prose)

## Goal

## Goal

A partial resolve keeps the end that resolved and names the end that failed,
and no caller hands the blocking `risk_surface` check a range that cannot
match: the staged scope has exactly one machine spelling, and a plan or task
that landed no commits records a skip instead of a clean check over a range
whose two ends are one commit.

## Must be true when done

- Every `risk-check run` invocation line under `cadence-core/workflows/` and
  `cadence-core/references/` carries `--base <ref>` and exactly one of
  `--head <ref>` or `--staged`; `verify.md` and `debug.md` spell their staged
  fix with `--staged`, and no surface names a rev like `STAGED` that
  `git rev-parse --verify` rejects.
- `execute.md`, `task.md` and `references/execute-parallel.md` do not ask the
  seam about a range whose two ends are the same commit: when HEAD still names the pre-plan commit (or the task's
  start sha) they append an `outcome/risk_check_skipped` event under that plan
  or slug and continue, with no `checked: true, empty: true` row written.
- `node cadence-core/bin/self-verify.mjs --root .` answers `ok: true` (every
  edited prose surface re-pinned in `weight-budgets.json`), the full suite is
  green, and `npx tsc -p tsconfig.ci.json` is clean.

## Context

- OQ-1 is answered and locked in ROADMAP.md: an explicit `--staged` arm on the
  two `resolveRange` call sites in `risk-check.mjs`, branched BEFORE
  `resolveRange` is reached; `resolveRange` itself learns no staged spelling
  and nothing that is not a ref ever passes `riskRef`. The tree has no
  `risk-check fire` subcommand: the second call site the answer cites by line
  is `cmdRiskCheckStatus`, so the second arm goes there (see Notes).
- The self-comparing range is a CALLER fix per the roadmap: the seam's D-01
  rule that `empty` is decided from the diff body and never from equal ids
  (`lib/risk-diff.mjs`, recalled from v3.5.6 phase 3 UAT) stays as it is,
  because a revert pair has differing ids and an empty net diff.
- Hand-maintained censuses this plan's files sit under, each declared above so
  `lease-check --plan-time` passes: `planning-detail-sites`
  (planning-lease-check.test.mjs:361, 15 sites / 6 wrapped),
  `arg-contract-flag-entries` (arg-contract.test.mjs:423, 199 entries),
  `trace-refusal-sentences`, `phase-spelling-callsites`,
  `self-verify-merge-layers`, and `weight-budgets` (byte CEILINGS; verify.md,
  execute.md, task.md and risk-surface.md sit exactly at theirs today and
  debug.md has 9 bytes of headroom, so every prose task re-pins its entry from
  `node cadence-core/bin/weight.mjs --root .`, whose `surfaces[].bytes` is the
  figure to write).
- Out of scope, flagged in Notes for the human: the fire-receipt seams behind
  `fireIdentity` (core.mjs `--base/--head` guard) stay ref-only; the parallel
  path's range in `references/execute-parallel.md`; `task-record`'s own range;
  `git-guard.md` section 4's generic "at commit time" sentence.

## Tasks

### Task 1: risk-surface.md documents the staged spelling beside the ref-range one

- **Files:** cadence-core/references/risk-surface.md, cadence-core/bin/weight-budgets.json
- **Action:** The detection block at risk-surface.md:11-14 shows only
  `--base <ref> --head <ref>`, which is why two projects improvised
  `HEAD..STAGED` when their scope was the index. Beside that call, state the
  second spelling `risk-check run --phase <N> --base <ref> --staged` as the
  one machine spelling for a fix staged in THIS tree and not yet committed
  (the `/cad-verify` and `/cad-debug` fires, whose reviewer scope is shape
  (b)), and that its record carries `staged: true` with `head_id` null because
  no head commit exists yet. Keep it to the sentences that state the
  spelling and when it applies; the trigger contract around it is unchanged.
  The surface sits exactly at its byte ceiling (12640), so measure the edited
  file with `node cadence-core/bin/weight.mjs --root .` and write that
  `bytes` figure as the `cadence-core/references/risk-surface.md` entry in
  `weight-budgets.json`.
- **Verify:** `grep -n -- "--staged" cadence-core/references/risk-surface.md`
  shows the invocation line carrying `--base <ref> --staged`, and `node
  cadence-core/bin/self-verify.mjs --root .` answers `ok: true` with no
  `budget-overrun` problem.

### Task 2: verify.md and debug.md ask the seam over the staged set with --staged

- **Files:** cadence-core/workflows/verify.md (route_failures step, item 3), cadence-core/workflows/debug.md (Resolve, item 3), cadence-core/bin/weight-budgets.json, cadence-core/bin/prose-agreement.test.mjs
- **Action:** Both sites today describe the staged scope in prose ("the fix
  is staged in THIS tree, so that fire carries the staged-diff scope") and
  never ask the seam, which is the gap verbatim and weathervane filled with a
  spelling git cannot name. Rewrite each so detection is the seam's answer
  over the index: verify.md's "Apply now" arm invokes
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run
  --phase <N> --base HEAD --staged` with the phase under verification, and
  debug.md's fix step invokes the same with `--phase 0`, citing task.md's rule
  that 0 is the one number no roadmap phase carries and a debug session sits
  outside the phase spine. In both, a non-empty `matches` or `inconclusive:
  true` fires the `risk_surface` trigger with shape (b) - keep the phrase
  "the reviewer runs `git diff --cached` in the cwd it inherits" verbatim, so
  the `bulk-output` register row for that call in each file still settles its
  occurrence and no count moves - and an `ok:false` answer (`no-diff`,
  `surfaces-unanswered`) is not a clean answer: the gate is blocking and a
  check that could not run clears nothing, so the fix does not land on it.
  Keep verify.md's ONE-round re-arm sentence and its triage-gate re-read
  intact, and debug.md's `blocking`/CAPPED sentence intact. Add one test to
  prose-agreement.test.mjs (helpers `doc`, `stepBody`, `sentenceAround` exist
  there) that reads every `.md` under `cadence-core/workflows/` and
  `cadence-core/references/`, takes each line naming both `planning.mjs` and
  `risk-check run`, and asserts it carries `--base \S+` and exactly one of
  `--head \S+` or `--staged`; and that verify.md's route_failures step and
  debug.md each carry at least one `--staged` invocation, debug.md's with
  `--phase 0`. Both surfaces are at or within 9 bytes of their ceilings;
  measure each with `weight.mjs --root .` and write the new `bytes` figures
  into `weight-budgets.json`.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes
  including the new test; `grep -rn "risk-check run" cadence-core/workflows
  cadence-core/references | grep -v -- "--head" | grep -v -- "--staged"`
  prints only prose mentions, never a line naming `planning.mjs`;
  `grep -rn "STAGED" cadence-core/workflows cadence-core/references` prints
  nothing; `node cadence-core/bin/self-verify.mjs --root .` answers
  `ok: true`.

### Task 3: execute.md and task.md skip the self-comparing range and record the skip

- **Files:** cadence-core/workflows/execute.md (execute_sequential step, the post-plan risk_check paragraph), cadence-core/workflows/task.md (risk_check step), cadence-core/references/execute-parallel.md (step 5, the per-plan risk sequence), cadence-core/bin/weight-budgets.json, cadence-core/bin/prose-agreement.test.mjs
- **Action:** `execute.md`'s post-plan call is `risk-check run ... --base
  {pre-plan HEAD} --head HEAD` and `task.md`'s is `--base <parent of the
  task's first commit> --head HEAD`; a plan or task that landed no commits
  makes both ends one commit, and the seam records that as `checked: true,
  empty: true` - a clean check over nothing (smithers, twice). Add a skip arm
  in front of each call, one spelling in both files: when HEAD still names the
  pre-plan commit (execute.md: `git rev-parse HEAD` equals the recorded
  `{pre-plan HEAD}`; task.md: `git rev-parse --short HEAD` still prints the
  echoed `$S`), there is no range to check, so do NOT run `risk-check run`,
  and in execute.md do NOT run that plan's `risk-check status` either (it
  would refuse `risk-record-missing` for a record that has nothing to hold);
  instead append the skip with `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/
  planning.mjs" trace append --phase <N> --family outcome --event
  risk_check_skipped --plan <k> --sha {pre-plan HEAD}` (task.md: `--phase 0
  --plan <the task's slug> --sha "$S"`), state that the event name IS the
  record that nothing was checked because nothing landed, and report done
  on that append's `written: true` exactly as the run's own record is held to
  (task.md's `written: false` sentence and execute.md's "not reported done
  while that call refuses" sentence are pinned by prose-agreement tests and
  stay). The arm carries no `--detail`: `--detail` is a `text-transport`
  register flag, and adding a site would move that census for a sentence the
  event name already states. Everything after the skip (the `diff` trigger in
  execute.md, the `record` step in task.md) proceeds as written. Keep every
  pinned sentence: `risk-check run`, `inconclusive`, `plan-<k>-risk.diff`,
  "never stage it", "delete it once the trigger returns", `risk-check run
  --phase 0`, `.planning/tasks/{slug}/risk-task-{slug}.diff`. Add one test to
  prose-agreement.test.mjs that reads execute.md's `execute_sequential` step
  body and task.md's `risk_check` step body and asserts each carries a `trace
  append` invocation line with `--family outcome --event risk_check_skipped`
  (the same token in both, held in one constant) and each states the
  condition in the sentence around it (the pre-plan commit, the start sha).
  The trace producer census (trace.test.mjs:3141) parses every prose `trace
  append` line, so run it. Both surfaces sit exactly at their byte ceilings;
  measure with `weight.mjs --root .` and write the new figures into
  `weight-budgets.json`. The parallel path carries the same shape at
  `references/execute-parallel.md` step 5: its per-plan call is `--base {that
  plan's pre-merge HEAD} --head {that plan's post-merge HEAD}`, and a worktree
  plan that landed nothing merges to the same HEAD. Add the identical skip arm
  there in the same spelling - when the two HEADs step 3 recorded are one
  commit, run neither `risk-check run` nor that plan's `risk-check status`
  (`:48`), append `risk_check_skipped --plan <k> --sha {that plan's pre-merge
  HEAD}` instead, and state the condition in the sentence around it; restate
  nothing else, since that reference already follows `execute_sequential` for
  everything after the call. Its `weight-budgets.json` entry (5992 today)
  moves too: measure and re-pin it. The prose-agreement test above reads that
  step body as a third surface. (Added by plan-review finding [2], 2026-09-02:
  RSK-10's outcome clause names no site, so the worktree path is in scope.)
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs
  cadence-core/bin/trace.test.mjs` passes including the new test;
  `grep -n "risk_check_skipped" cadence-core/workflows/execute.md
  cadence-core/workflows/task.md cadence-core/references/execute-parallel.md`
  shows one invocation line in each of the three files, all
  with `--family outcome`; `node cadence-core/bin/self-verify.mjs --root .`
  answers `ok: true`; `node cadence-core/bin/test.mjs` is green and
  `npx tsc -p tsconfig.ci.json` prints no error.


## Notes

- Two siblings carry the same self-comparing shape and are not in RSK-10's
  named sites (`references/execute-parallel.md:34` was a third and moved into
  task 3 by plan-review finding [2], 2026-09-02): `task.md`'s `record` step
  (`task-record --base $S --head HEAD`), and `task-record.mjs:221` which
  still nulls both ids on a failed resolve. `git-guard.md` section 4 still
  says "if the diff matches a risk surface" without naming the seam.
- Split by hand from the planner's single PLAN.md on 2026-09-02 at the coordinator's check_size step: that file declared 1,095,062 bytes against the 675,000 ceiling. PLAN-1 carries tasks 1-4 (the seam) and PLAN-2 carries the three prose tasks; the two share no declared file. PLAN-2 depends on PLAN-1's `--staged` arm existing, so it runs after it (sequential is /cad-execute's default). Task text is the planner's, unchanged except renumbering in PLAN-2 and cross-references rewritten to name the plan they point at.
- The `Unreleased` CHANGELOG entry is written at the release bump, not here
  (every prior entry landed in a `chore: bump manifest` commit).
