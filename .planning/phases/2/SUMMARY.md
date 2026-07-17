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

## Gap-closure (plan 2): GitHub auto_close push seam (2026-07-17)

Closes the blocking open item above (the GitHub `gh pr create` push gap, UAT
item 9). Delivered as a dedicated `git-publish` subprocess seam that git-guard's
Bash hook never sees, while git-guard itself now carries NO push exemption and
asks unconditionally on every Bash `git push` (the rejected "exempt a push inside
git-guard" approach was NOT taken). Plan: `.planning/phases/2/PLAN-gaps.md`.

### What shipped
- `cadence-core/bin/lib/publish-decision.mjs` - pure, total `decidePublish(...)`:
  7 refuse gates (first-failing-wins); the branch is interpolated only into the
  single `refs/heads/<b>:refs/heads/<b>` refspec token; `SAFE_BRANCH`/`REMOTE_NAME`
  reject a leading dash, `:`, whitespace, and any path/URL; the publish argv
  carries a `--` end-of-options separator
  (`['push','--set-upstream','--',remote,refspec]`).
- `cadence-core/bin/git-publish.mjs` - the one I/O seam that actually runs the
  push, `execFileSync('git', ['-C', dir, ...argv])` argv-only (never a shell
  string); reads `git.auto_close` from the REPO config layer only (D-08),
  `protected_branches` from the merged config.
- `git-guard.mjs` - `isPlainPush` and all command-string push parsing DELETED
  (`grep -c isPlainPush cadence-core/bin/git-guard.mjs` = 0); the push rail is now
  an unconditional `ask` moved above the config read.
- self-verify CONTRACTS registers `git-publish.mjs publish`; cad-land SKILL.md
  step 4b + git.md rail 3 rewritten to the seam truth (no false "gh pr create
  pushes it"); cad-land weight budget rebudgeted 6384 -> 7476.

### Commits (plan 2)

| Task | Commit | Description |
|---|---|---|
| 1 | fab6a64 | feat(2-2): decidePublish pure decision fn (+ risk-review fix) |
| 2 | 4bb28d0 | feat(2-2): git-publish I/O seam + bare-origin tests |
| 3 | 6c4aa2c | feat(2-2): register git-publish in self-verify CONTRACTS |
| 4 | 2003066 | refactor(2-2): delete git-guard isPlainPush, restore uncond ask |
| 5 | e83a032 | docs(2-2): correct cad-land + git.md prose to the seam truth |
| 6 | 24b58c6 | chore(2-2): rebudget cad-land SKILL.md after step-4b rewrite |
| 7 | (none)  | full green gate - already green after task 6, no commit |

### Deviations
- The blocking `risk_surface` review (fired by cad-execute, high effort,
  adjudicated by the orchestrator) caught a leading-dash option-injection gap:
  `REMOTE_NAME = /^[A-Za-z0-9._-]+$/` admitted `--mirror`/`-o`/`--force` (its
  trailing `-` is a literal class member) and, with no `--` separator, git parsed
  such a remote as an option. Reproduced against live git, then fixed inside Task
  1's commit: anchored the regex to `/^[A-Za-z0-9][A-Za-z0-9._-]*$/` AND added the
  `--` end-of-options separator, with a `bad-remote` regression test. Re-verified
  green.
- The advisory `diff` review was treated as subsumed by that high-effort
  adjudicated `risk_surface` review over the identical diff (non-gating); no
  second near-identical reviewer was spawned.

### Open-items status after this execution
- [closed] Blocker - GitHub push gap (UAT item 9): closed by the seam above.
- [already closed] `decideCleanup` null-branch guard: fixed earlier in 6d415fd.
- [remaining] design-note ("clean base by default" tension on the non-merge
  publish paths): adjudicated as-designed by /cad-verify 2; no change.
- [remaining] low (`resolveReapBranch` sole-`cadence/*` fallback): documented
  tradeoff in the code comment; note only.

### Goal check (item 9)
The GitHub arm of GIT-03 is closed at the seam / guard / prose layers, evidenced
first-hand: `grep -c isPlainPush cadence-core/bin/git-guard.mjs` = 0; the
git-publish seam's bare-origin test lands `refs/heads/cadence/v1.1.0-rc.2` in the
origin only under repo `auto_close:true` and refuses (pushing nothing) on
auto_close-off / protected / unconfigured-remote / detached-HEAD / global-only;
every Bash `git push` still returns `permissionDecision:'ask'` (git-guard.test.mjs
"every push still asks" regression). Full suite 217 pass / 0 fail, self-verify
`ok:true, problems:[]`, `tsc --checkJs` clean. Unchanged from the original SUMMARY
by design: the two LIVE end-to-end paths (real remote + `gh` running the
unattended PR-open/merge) remain human-verify (UAT items 5/6).
