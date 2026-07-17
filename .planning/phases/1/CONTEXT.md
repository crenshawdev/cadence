# Phase 1: Integration-branch model - Context

Gathered: 2026-07-17
Feeds: /cad-plan 1

## Scope boundary

In: Two new config keys (`git.integration_branch`, `git.auto_branch`); rail-1
composition in `references/git.md` that creates/switches to a version-named
per-milestone integration branch at cycle start; `trunk` mode as pure
composition with the existing protected-branch guard; a testable pure
branch-decision function (config + current branch -> create / stay / ask); tests
for both keys and the decision function; the prose mentions self-verify needs.
Out: Land cleanup / reset-to-base and autonomous close (Phase 2); release
mechanics - version bump, changelog (Phase 3); any worktree plumbing change
(the parallel path already forks from HEAD and self-reaps); a version field on
the STATE cursor (naming derives from prose instead).
Deferred: None.
Plan shape: one plan.

## Decisions

- D-01 (Config surface): Add `git.integration_branch` (enum `["milestone","trunk"]`, default `milestone`) and `git.auto_branch` (enum `["ask","auto","off"]`, default `ask`) as schema-only keys. Evidence: `cadence-core/config.schema.json` (`git.on_protected` enum shape to copy), `cadence-core/templates/config.json` `git` block, `cadence-core/bin/config.mjs` (schema-driven `checkValue`/`get`, no code change).
- D-02 (Self-verify): Each new key gets one live prose mention (`cadence-core/workflows/config.md` `git.*` catalog and/or `references/git.md`) to satisfy the reverse `inert-config-key` check; the `config.mjs` CONTRACTS entry is unchanged (keys are data, not subcommands/flags). Evidence: `cadence-core/bin/self-verify.mjs` inert-config-key check; `config.md` git catalog rows.
- D-03 (Ownership locus): The integration-branch create/switch logic composes into `references/git.md` rail 1 (the shared "before the FIRST commit" guard), not a single workflow, so "before the first commit" holds regardless of which workflow starts the cycle. Evidence: `references/git.md` rail 1; `workflows/execute.md`, `plan.md`, `new-project.md`, `task.md` all invoke rail 1.
- D-04 (auto_branch behavior): `ask` (default) prompts once per cycle via the ask-user seam before creating; `auto` creates/switches silently; `off` stays put. Creation is lazy/once-per-cycle, inferred from HEAD being on a protected base (once switched off it, later phases pass silently). Evidence: `references/seams.md` ask-user seam; `references/git.md` rail 1; `bin/planning.mjs` `cmdCursorSet` (cursor tracks no cycle/branch event).
- D-05 (Branch naming): Version-derived - parse the milestone-of-record from `PROJECT.md ### Active` (fallback: the `ROADMAP.md` title line), producing a name like `cadence/v1.1.0-rc.2`. Deterministic and works in `auto` mode with no prompt. Evidence: `.planning/PROJECT.md` `### Active`; `.planning/ROADMAP.md` title.
- D-06 (Worktree fork-point): No worktree plumbing change. The parallel path already creates worktree branches that fork from HEAD and are reaped after merge, so switching HEAD to the integration branch satisfies "worktrees fork from the integration tip" for free. Evidence: `workflows/execute.md` `execute_parallel` (branches `cadence/phase-<N>-plan-<k>`, no explicit base, merged + reaped).
- D-07 (trunk composition): `trunk` mode creates no integration branch; commits land on the base governed by the existing `git.on_protected` (including `allow`), enforced unchanged by `bin/git-guard.mjs`. Evidence: `bin/git-guard.mjs` on_protected/protected_branches handling.
- D-08 (base_branch unchanged): `git.base_branch` stays the landing/guard base (`main`), distinct from the integration branch; it is not repurposed as the worktree fork point. Evidence: `references/git.md` base-integrity check; prior round design.
- D-09 (Test seam): The branch decision is implemented as a testable pure function (config + current branch -> create / stay / ask), separate from the advisory `bin/git-guard.mjs` hook (which only advises and cannot run `checkout -b`); covered by `node --test` like existing config/git-guard tests. Exact module location is the planner's call. Evidence: `bin/git-guard.mjs` (advisory hook); `bin/config.test.mjs`, `bin/git-guard.test.mjs` patterns.

## Acceptance criteria

- [ ] `config.mjs get git.integration_branch` returns `milestone` on a default config, and `config.mjs validate` rejects a value outside `{milestone,trunk}`
- [ ] `config.mjs get git.auto_branch` returns `ask` on a default config, and values outside `{ask,auto,off}` are rejected
- [ ] `node cadence-core/bin/self-verify.mjs` exits 0 with both new keys present (no `inert-config-key` problem)
- [ ] With `git.auto_branch=auto` and HEAD on a protected branch, starting a phase creates and switches to an integration branch named from the milestone version (e.g. `cadence/v1.1.0-rc.2`) before the first commit; with `off`, HEAD stays on the protected branch
- [ ] With `git.integration_branch=trunk`, no integration branch is created and a commit on the protected base is governed by `on_protected`
- [ ] In `milestone` mode, the branch-decision / worktree-base resolution reports the integration branch tip (not `main`) as the worktree fork point
- [ ] `node --test` passes, including new tests for both config keys and the branch-decision function

## Flagged assumptions

- Branch-decision function module location is the planner's call - extend `git-guard.mjs` with an advisory helper, or add a new small lib module imported by both the workflow-facing seam and the test (D-09).
- Version-derived naming reads the milestone from prose (`PROJECT.md`/`ROADMAP.md`); if that version is not kept current, the branch is misnamed - Likely, low consequence (a wrong branch name, not wrong behavior).
