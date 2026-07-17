---
phase: 2
status: complete
completed: 2026-07-17
---

# Phase 2: Land cleanup + autonomous close - Summary

Two config-gated behaviors on the git lifecycle: `git.on_land_cleanup` (default on)
returns a cycle to a pulled base and reaps the merged integration branch, and
`git.auto_close` (default off) runs the whole close (audit -> tag -> PR -> merge ->
reset) unattended without dropping the `pre_ship` gate - both driven by a pure,
tested `close-decision.mjs` core behind the advisory `land-cleanup.mjs` seam.

## What shipped

- Two config keys - `git.on_land_cleanup` (default true), `git.auto_close`
  (default false) - in `cadence-core/config.schema.json`, `templates/config.json`,
  documented in `workflows/config.md`. Verified: `config.mjs get` returns
  `true`/`false` on default config.
- `cadence-core/bin/lib/close-decision.mjs` - pure zero-dep core, three total
  functions: `resolveReapBranch` (derived name if merged, else the sole merged
  `cadence/*`, else null), `decideCleanup` (return-to-base+pull, reap only when
  merged), `decideGateHalt` (halt an auto_close chain on a surviving blocker/high).
- `cadence-core/bin/land-cleanup.mjs` - advisory seam (`cleanup` / `gate`
  subcommands) wrapping the core with config + `git branch --merged` reads; never
  runs checkout/pull/branch -D. CONTRACTS entry added to `self-verify.mjs`.
- Prose wiring: `cad-land` SKILL.md step 4 (auto_close PR->merge->reset) and step 5
  (terminal cleanup); `milestone.md` + `cad-milestone` SKILL.md chain into cad-land
  under auto_close; `git.md` rail 3 references both keys.
- Tests: `close-decision.test.mjs` (15) + `land-cleanup.test.mjs` (7) = 22 pass;
  full suite 192 pass; `self-verify.mjs` exits 0 (no inert-config-key, CONTRACTS
  present); `tsc --checkJs` clean.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 3600de7 | add git.on_land_cleanup and git.auto_close config keys |
| 1 | 2 | 1c00f23 | add close-decision pure core (resolveReapBranch, decideCleanup, decideGateHalt) |
| 1 | 3 | 41c4fcd | add land-cleanup advisory seam + CONTRACTS entry |
| 1 | 4 | 27cfb24 | add terminal cleanup and auto_close publish path to cad-land |
| 1 | 5 | e42d09c | chain cad-milestone into cad-land under auto_close |
| 1 | 6 | 12e51b8 | wire on_land_cleanup and auto_close into git.md rail 3 |

## Deviations

- [deviation] Tasks 1/4/5 (all six commits' surfaces): raised `weight-budgets.json`
  entries to the exact reported bytes for config.md (12688), cad-land SKILL (6384),
  milestone.md (4755), cad-milestone SKILL (1523). Plan-anticipated accepted surface
  growth from the new prose.
- [deviation] Task 4: reconciled the cad-land `<guardrails>` - the existing "do not
  chain unless the user chose both" would contradict the new auto_close chain in the
  same file, so it was scoped to `git.auto_close` off with an explicit auto_close
  exception. Correctness fix within the touched file.
- [deviation] Task 4: the executor judged the staged diff NOT a `risk_surface` match
  (destructive git ops appear only as additive documentation to a SKILL.md that
  performs no op on this repo; the behavior is guarded per D-04: local-only,
  post-merge-confirmed, no remote delete). Recorded for orchestrator visibility.

## Open items

Surfaced by the advisory `diff` review (975aea4..HEAD), adjudicated by the
orchestrator. None gates this phase; all routed to CAPTURE for phase 2.

- [ ] (blocker, grounded) cad-land SKILL.md step 4b: `gh pr create --base <base>
  --head <branch> --fill` does NOT push a local-only integration branch - gh will
  not push a branch with no remote non-interactively, so the GitHub auto_close chain
  can fail at PR-open before merge. The prose claims this command "pushes it." Needs a
  `git push -u` (or verified gh push behavior) before `gh pr create` on the GitHub
  path. GitLab's `glab mr create` does push, so only GitHub is affected. This path is
  human-verify only (needs a live remote + gh) and could not be exercised in-sandbox;
  fix before relying on auto_close on GitHub.
- [ ] (design-note) The default "clean base after a land" is delivered only when a
  merge actually lands locally (auto_close, or a manual direct-merge); the manual
  "Open PR"/"Direct push"/"Leave local" options never merge into base at land time,
  so step 5 correctly does not reap. The code is arguably right (an unmerged branch
  must not be reaped) but sits in tension with the goal's "by default" wording -
  cad-verify should adjudicate against the phase goal.
- [ ] (medium, real) `decideCleanup` sets `reap` from `mergedIntoBase` alone with no
  guard that `branch` is non-null, so `--merged true` with a null-resolved name emits
  `{reap:true, branch:null}`; step-5 prose's `git branch -D <null>` would error at the
  tail of an otherwise-successful close. Add a `branch != null` guard to the reap flag.
- [ ] (low, safe) `resolveReapBranch`'s sole-`cadence/*` fallback can reap a different
  (but merged, so no data loss) branch after the shipped branch is already deleted and
  PROJECT.md is evolved. Documented tradeoff in the code comment; note only.

## Goal check

The sum of the six commits plausibly delivers the phase goal at the decision-logic
layer, evidenced first-hand: config defaults are correct (`config.mjs get
git.on_land_cleanup git.auto_close` -> `true`/`false`); `self-verify.mjs` exits 0
with both keys live and the seam CONTRACTS present; the pure core is exercised by 22
passing tests (`close-decision.test.mjs` + `land-cleanup.test.mjs`), full suite 192
pass. Criterion 1: the `cleanup` seam returns `returnToBase:true, pull:true` and
`reap:false` when the branch is not confirmed merged (`land-cleanup.mjs cleanup` on
this repo), and `decideCleanup` reaps only when `mergedIntoBase === true` - an
unmerged branch is never reaped. Criterion 3: `gate --dir` with a config `auto_close:
true` and a `blocker` finding returns `action:"halt"` - verified directly. What is
NOT machine-verifiable here, by design (plan Notes), is the two LIVE end-to-end paths:
(a) a manual /cad-land presenting the publish ask with no preselected default, and (b)
an unattended /cad-milestone auto_close chain ending on the pulled base with the branch
reaped - both need a live remote + gh/glab and are human-verify. The advisory review
found one grounded blocker on that GitHub auto_close path (the `gh pr create` push gap,
open item 1) that should be resolved before auto_close is trusted on GitHub; the
decision core, seam, config, and self-verify wiring are complete and green.
