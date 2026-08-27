# Phase 2: Refuse the replay - Context

Gathered: 2026-08-27
Feeds: /cad-plan 2

## Scope boundary

In: a guard in `execute.md`'s `locate` step that stops `/cad-execute <N>` when
every one of the phase's plans already has a report reading `PLAN COMPLETE`,
before `git_guard`, before the `phase_start` trace anchor and before any
executor dispatch; plus the per-plan skip that keeps a partially-reported phase
executable.
Out: any resume path that re-enters a dispatch where it died - the spike
measured what one would duplicate (`.planning/spikes/execute-replay-blast-radius/SPIKE.md`,
probes C2 and C2b, both noisy: zero commits, zero byte changes). Out: minting a
new derived status in `derivePhases`. Out: a subset-execution flag.
Deferred: the `<report>` digest has no field that can say "no new commits" -
both spike executors improvised one - filed as its own issue rather than folded
in (spike recommendation 3). Deferred: the planner-contract line stating that a
criterion asserting an ACTION rather than an END STATE is what makes a plan
unsafe to re-run (spike recommendation 4).
Plan shape: one plan

## Durable decisions

- D-01 (guard site): The replay guard lives in `execute.md`'s `locate` step, not
  in `derivePhases`. `locate` already stops before `git_guard` and the
  `phase_start` anchor, so the ordering AC1 asks for comes free, and the change
  touches one workflow file. Rejected after real consideration: minting a new
  derived status in `derivePhases`, which is the more honest place because the
  wrong answer IS the derivation's - but it teaches `status`, `audit`,
  `phase-done` and the cursor a new value at once, and every consumer switching
  on the status string would have to handle it. Evidence:
  `cadence-core/workflows/execute.md` `locate` step;
  `cadence-core/bin/planning/core.mjs:191-206`;
  `.planning/spikes/execute-replay-blast-radius/SPIKE.md` recommendation 1.
- D-02 (fire condition): The guard fires only when EVERY plan file in the phase
  has a `reports/plan-<k>.md` reading `PLAN COMPLETE`. A phase with any plan
  lacking a report is a genuine continuation and must still dispatch. The
  rejected simpler rule - any `PLAN COMPLETE` report is a replay - would strand
  a multi-plan phase and force a `/cad-undo` of commits that are fine. Evidence:
  `cadence-core/workflows/execute.md:187,243-248`.

## Decisions

- D-03 (evidence read): The discriminator is the report file's `PLAN COMPLETE`
  text alone. `locate` makes no git read to cross-check it against commits on
  the branch. A report file with no commits behind it is not a state a real run
  produces, and the reports are already on disk and already free. Evidence:
  `.planning/spikes/execute-replay-blast-radius/SPIKE.md` recommendation 1 -
  both probes had the report file.
- D-04 (no resume): No resume path and no subset-execution flag. `--rerun`
  stays the only override, unchanged. Evidence:
  `.planning/spikes/execute-replay-blast-radius/SPIKE.md` recommendation 2.

## Acceptance criteria

- [ ] AC1: On a phase deriving `planned` where every plan has a
      `reports/plan-<k>.md` reading `PLAN COMPLETE`, `/cad-execute <N>` stops
      before `git_guard`, before the `phase_start` trace anchor and before any
      executor dispatch, naming the phase, the report files it read, and both
      remedies (`/cad-undo <N>`, or `--rerun`).
- [ ] AC2: The stop does NOT fire for a phase with plans and no `reports/`
      directory, nor for a phase whose report reads `PLAN PARTIAL`; both still
      reach the dispatch.
- [ ] AC3: A phase whose `PLAN-1` report reads `PLAN COMPLETE` and whose
      `PLAN-2` has no report reaches the dispatch, and plan 1 is not
      re-dispatched: `trace.jsonl` shows exactly one executor dispatch for that
      run, keyed to plan 2.
- [ ] AC4: `/cad-execute <N> --rerun` still reaches the dispatch, unchanged.
- [ ] AC5: Against the spike's own probe shape - tasks committed, report on
      disk, no `SUMMARY.md` - the run stops with zero executors dispatched,
      verified by the absence of a `dispatch` event in `trace.jsonl` for that
      run. (human-verify: needs a live /cad-execute run)
- [ ] AC6: `node cadence-core/bin/test.mjs` is green and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Flagged assumptions

- `execute.md` has no per-plan skip today - it dispatches every plan the phase
  lists (`cadence-core/workflows/execute.md:187,403`). AC3 therefore adds
  surface the file does not have, rather than reusing an existing branch.
  Likely; if wrong: the per-plan skip is already there and AC3 costs only a
  test.
- The plan-report filename is `reports/plan-<k>.md` under the plan file's OWN
  directory (`<plandir>`), which is not always `.planning/phases/<N>/` on the
  parallel worktree path. Likely; if wrong: the guard reads the wrong path on a
  phase that executed in parallel and never fires for it.
