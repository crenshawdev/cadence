# Roadmap: Cadence v1.1.0-rc.2

## Overview

A focused lifecycle round. Give Cadence an explicit git branching model and an
optionally-autonomous close, plus the release mechanics (manifest version bump,
changelog) that the v1.1.0-rc.1 cycle shipped without. The 43-item sweep backlog
was re-triaged against `main` (35 already done); only P3 nits survive and are
deferred. Three phases, then tag `v1.1.0-rc.2`.

Phase 1 lands the two-tier branch model — a per-milestone integration branch as
the reconciliation point that parallel worktrees fork from, off `main`. Phase 2
builds on it: reset-to-base after every land, and the opt-in end-to-end close.
Phase 3 folds the release mechanics into the close so a plugin release stops
carrying a stale version. Grounded starting fact (pressure-tested): worktrees
already fork from HEAD and self-reap, so the load-bearing new work is branch
*ownership* (auto-create at cycle start), not worktree plumbing.

## Phases

- [ ] **Phase 1: Integration-branch model** - a per-milestone integration branch (parallel-worktree reconciliation point), created at cycle start; `trunk` escape hatch
- [ ] **Phase 2: Land cleanup + autonomous close** - reset-to-base + pull after land, and an opt-in end-to-end close
- [ ] **Phase 3: Release mechanics** - manifest version bump folded into the lifecycle, and a changelog convention

## Phase Details

### Phase 1: Integration-branch model
**Goal:** Cadence owns a two-tier branch model - a per-milestone integration branch (the reconciliation point parallel worktrees fork from and merge into, off `main`), created/switched at cycle start, with `trunk` as the escape hatch
**Depends on:** Nothing
**Requirements:** GIT-01
**Success Criteria:**
1. `git.integration_branch` accepts `milestone` (default) and `trunk`; `config.mjs get` returns it and self-verify knows the key
2. With `git.auto_branch: auto` on a protected base, starting a cycle creates and switches to the integration branch (named from the milestone) before the first commit; `off` stays put; `ask` prompts through the ask-user seam
3. In `milestone` mode the parallel path's worktrees fork from the integration branch tip, not `main` - verified by the fork point during a parallel run or its dry-run report
4. `trunk` mode composes with the existing protected-branch guard (commits to base under `on_protected`); no integration branch is created
5. `node --test` covers the new keys and the branch-decision logic; self-verify passes

### Phase 2: Land cleanup + autonomous close
**Goal:** A cycle returns to a clean base by default, and can optionally run the entire close end-to-end without losing the review gate
**Depends on:** Phase 1
**Requirements:** GIT-02, GIT-03
**Success Criteria:**
1. After a successful land/merge, `git.on_land_cleanup` (default on) returns to base (`main`), pulls, and reaps the merged integration branch; `off` leaves it in place
2. `git.auto_close` (default off, opt-in) makes cad-milestone/cad-land run audit → tag → PR → merge → reset with no per-step prompts
3. In `auto_close`, a blocking `pre_ship` FAIL halts the chain before merge and surfaces the findings rather than merging over them
4. With `auto_close` off (the default), cad-land still asks the publish mechanism with no preselected default - the opt-in never changes the default posture
5. Tests cover the cleanup path and the auto-close gate-halt; self-verify passes

### Phase 3: Release mechanics
**Goal:** A distributed-plugin release bumps its own manifest version and records what changed as part of the close - not by hand
**Depends on:** Phase 1
**Requirements:** REL-01, REL-02
**Success Criteria:**
1. On a project whose repo has a plugin manifest, cad-milestone/cad-land detect it and bump `.claude-plugin/plugin.json` `version` to the milestone's version, keeping any sibling manifest (marketplace.json) in sync
2. The close flow writes/updates a CHANGELOG (or release-notes file) entry for the milestone
3. The first CHANGELOG entry documents the shipped v1.1.0 scope, including the `memory.backend none → builtin` default flip
4. Cadence's own `.claude-plugin/plugin.json` is bumped to `1.1.0-rc.2` at this round's close, and `/plugin` would report it
5. The bump is idempotent (re-running the close does not double-bump); self-verify passes
