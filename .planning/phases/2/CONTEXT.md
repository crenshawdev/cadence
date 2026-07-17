# Phase 2: Land cleanup + autonomous close - Context

Gathered: 2026-07-17
Feeds: /cad-plan 2

## Scope boundary

In: Two new config keys (`git.on_land_cleanup` bool default true,
`git.auto_close` bool default false); a return-to-base + pull + reap terminal
step appended to cad-land; an opt-in autonomous close where `auto_close` makes
cad-milestone chain into `/cad-land` (audit -> tag -> PR -> merge -> reset) with
no per-step prompts, landing the integration branch via host-CLI PR/MR merge;
an auto_close gate-halt that stops before merge on a surviving blocker/high
`pre_ship` finding; a pure `node --test`-covered decision function for the
cleanup and gate-halt logic; the prose mentions self-verify needs.
Out: Release mechanics - manifest version bump, changelog (Phase 3); any
worktree plumbing change (the parallel path already forks from HEAD and
self-reaps); repurposing `git.base_branch` (it stays the landing/guard base).
Deferred: None.
Plan shape: one plan.

## Decisions

- D-01 (Config surface): Add `git.on_land_cleanup` (bool, default `true`) and
  `git.auto_close` (bool, default `false`) as schema-only keys - entry in
  `config.schema.json` `keys.git.*`, field in `templates/config.json` git block,
  catalog row + live prose mention; no `config.mjs` code change (plain bools,
  schema-driven validation). Evidence: `cadence-core/config.schema.json`
  (`git.create_tag` bool shape to copy), `cadence-core/templates/config.json`
  git block, `cadence-core/workflows/config.md` git catalog, Phase 1 D-01/D-02.
- D-02 (Self-verify): Each new key gets one live prose mention (`config.md` git
  catalog and cad-land / `references/git.md` publish prose) to satisfy the
  reverse `inert-config-key` check; the `config.mjs` CONTRACTS entry is
  unchanged (keys are data, not subcommands). Evidence:
  `cadence-core/bin/self-verify.mjs` inert-config-key check.
- D-03 (Cleanup placement, GIT-02): The return-to-base + pull + reap step is a
  NEW terminal step appended to `skills/cad-land/SKILL.md` (cad-land has no
  separate workflow file); it runs only after a merge actually landed on this
  machine, not after "open PR / leave local." Evidence:
  `skills/cad-land/SKILL.md` (inline process, no post-land step today);
  `.planning/REQUIREMENTS.md` GIT-02 ("after a successful land/merge").
- D-04 (Cleanup base + reap target): "Base" reuses cad-land's existing
  resolution order (`$ARGUMENTS` -> `git.base_branch` -> first resolving
  `protected_branches` entry), NOT the integration branch. The branch reaped is
  the version-derived integration branch (`cadence/<version>` from
  `integrationBranchName`), reaped locally only after `git branch --merged
  <base>` confirms it is merged; no remote-tracking delete (would trip the push
  guard). Evidence: `skills/cad-land/SKILL.md` step 1 base resolution;
  `cadence-core/bin/lib/branch-decision.mjs` `integrationBranchName`; Phase 1
  D-08.
- D-05 (Cleanup is unguarded new git): The reap/reset introduces
  branch-deletion + checkout that no existing seam guards or performs -
  `git-guard.mjs` intercepts only push/commit, `git-branch.mjs` only decides,
  execute.md reaps worktree branches (`cadence/phase-<N>-plan-<k>`), not the
  integration branch. Cleanup is new raw-git prose (gated by the D-04 merged
  check), independent of worktree plumbing. Evidence:
  `cadence-core/bin/git-guard.mjs`, `cadence-core/bin/git-branch.mjs`,
  `cadence-core/workflows/execute.md` `execute_parallel` reap.
- D-06 (Autonomous close chain, GIT-03): `git.auto_close` on makes cad-milestone
  run audit -> tag, then chain into `/cad-land` via SlashCommand, which runs
  PR -> merge -> reset with no per-step prompts (one command, end-to-end). The
  final "reset" is the D-03/GIT-02 `on_land_cleanup` return-to-base. Evidence:
  `skills/cad-milestone/SKILL.md` (declares `SlashCommand`);
  `skills/cad-land/SKILL.md` (does not); `cadence-core/workflows/milestone.md`
  step 7 ("publishing the tag is /cad-land").
- D-07 (Merge mechanism): Under `auto_close`, the integration branch lands on
  base via host-CLI PR/MR merge (`gh pr merge` / `glab mr merge`,
  delete-branch), a NEW action beyond today's `create`-only step. PR-merge keeps
  the merge on the platform and sidesteps `git-guard.mjs`'s push-to-protected
  `ask` prompt, matching the criterion's literal "PR -> merge." Evidence:
  `skills/cad-land/SKILL.md` step 4 (`gh pr create` / `glab mr create` only);
  `cadence-core/bin/git-guard.mjs` (push -> ask).
- D-08 (No-default posture preserved): `auto_close` off (default) leaves
  cad-land's publish ask a deliberate no-preselected-default choice; the opt-in
  skips that ask entirely when on and never installs a default into the off-path
  ask. Evidence: `cadence-core/references/seams.md` no-default rule;
  `skills/cad-land/SKILL.md` guardrails.
- D-09 (pre_ship gate-halt): Under `auto_close`, a surviving blocker/high
  `pre_ship` finding is a hard halt before merge - regardless of the configured
  gate mode (even the default `adjudicated`) - surfacing findings instead of
  merging over them. Evidence: `cadence-core/references/review-triggers.md` §6
  (blocking vs adjudicated); `cadence-core/templates/config.json` `pre_ship.gate`
  default; ROADMAP criterion 3.
- D-10 (Test seam): The cleanup and gate-halt logic is backed by a pure
  `node --test`-covered decision function (mirrors Phase 1's `decideBranch`) -
  decides from config + state whether to clean up, which base, whether to reap,
  whether the gate halts - while the live git reap/merge stay in prose or a thin
  seam wrapper. A newly-named subcommand gains a `self-verify.mjs` CONTRACTS
  entry. Evidence: Phase 1 D-09; `cadence-core/bin/lib/branch-decision.mjs`;
  `cadence-core/bin/self-verify.mjs` CONTRACTS.

## Acceptance criteria

- [ ] `config.mjs get git.on_land_cleanup` returns `true` and `git.auto_close`
      returns `false` on a default config; each rejects a non-boolean value
- [ ] `node cadence-core/bin/self-verify.mjs` exits 0 with both new keys present
      (no `inert-config-key` problem)
- [ ] The cleanup decision function returns return-to-base + pull + reap when
      `on_land_cleanup=true` and the integration branch is merged into base;
      returns leave-in-place when `off`; and never reaps when the integration
      branch is not merged into base
- [ ] The gate-halt decision function, under `auto_close=true`, halts before
      merge and returns the findings when a surviving blocker/high `pre_ship`
      finding is present (regardless of configured gate mode), and proceeds when
      none is present
- [ ] With `auto_close=false` (default), a `/cad-land` run presents the publish
      mechanism with no preselected default (human-verify: needs live cad-land run)
- [ ] A `/cad-milestone` run with `auto_close=true` runs audit -> tag -> PR ->
      merge -> reset with no per-step prompts, and afterward HEAD is on base,
      pulled, with the integration branch reaped (human-verify: needs live
      remote + gh/glab merge)
- [ ] `node --test` passes across `cadence-core/bin`, including new tests for the
      cleanup path and the auto-close gate-halt

## Flagged assumptions

- Exact module location of the pure decision function is the planner's call -
  extend `bin/lib/branch-decision.mjs` / `bin/git-branch.mjs`, or add a new
  `bin/land-cleanup.mjs` seam with its own CONTRACTS entry and test (D-10).
- The `gh pr merge` / `glab mr merge` contract is unverified in-repo (only the
  `create` variants are used today): merge strategy flag, `--delete-branch`
  behavior, and how each reports a CI/mergeability or protected-branch rejection
  determine whether the unattended merge succeeds - Unclear; if wrong, the
  auto_close merge step stalls or errors mid-chain (needs research at plan time).
- Reap re-derives the integration name from PROJECT.md, so the open Phase-1
  null-version bug (no version derivable -> `branch:null`) also leaves a
  version-less project with nothing to reap by name - Likely, low consequence
  here (version resolves to `cadence/v1.1.0-rc.2`); a `git branch --merged`
  match on `cadence/*` is the robustness fallback if the planner wants it.
