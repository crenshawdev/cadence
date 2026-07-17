---
phase: 1
status: complete
completed: 2026-07-16
---

# Phase 1: Integration-branch model - Summary

A two-tier branch model owned by config: `git.integration_branch` (milestone|trunk) and `git.auto_branch` (ask|auto|off) drive a pure `decideBranch` function and a `git-branch.mjs decide` advisory seam, composed into `references/git.md` rail 1 so every cycle-start workflow creates/switches to a per-milestone integration branch (e.g. `cadence/v1.1.0-rc.2`) before the first commit.

## What shipped

- Two config enum keys - `git.integration_branch` (default `milestone`) and `git.auto_branch` (default `ask`) - schema-only, with template + catalog prose and tests - `cadence-core/config.schema.json`, `templates/config.json`, `workflows/config.md`
- Pure decision core - `integrationBranchName(projectText, roadmapText)` derives `cadence/<version>` from `PROJECT.md ### Active` (ROADMAP-title fallback, `null` when absent); `decideBranch({...})` returns `create | stay | ask` totally (unknown inputs -> stay) - `cadence-core/bin/lib/branch-decision.mjs`
- Advisory seam - `git-branch.mjs decide` reads effective config + PROJECT/ROADMAP, emits one JSON line `{ok, action, branch, mode, currentBranch, reason}`; never runs `checkout -b` itself - `cadence-core/bin/git-branch.mjs`
- Self-verify contract entry for the new seam - `cadence-core/bin/self-verify.mjs`
- Rail 1 Integration-branch subsection: `decide` -> act on `action` (create/ask/stay), milestone vs trunk composition, D-06/D-08 notes - `cadence-core/references/git.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 00c9da0 | Add `git.integration_branch` + `git.auto_branch` config keys (schema/template/catalog/tests) |
| 1 | 2 | ee615e4 | Pure `branch-decision.mjs` module: `integrationBranchName` + `decideBranch` + unit tests |
| 1 | 3 | 3bf4ac3 | `git-branch.mjs` decide seam with self-verify CONTRACTS entry and seam test |
| 1 | 4 | cc527eb | Compose integration-branch create/switch into `references/git.md` rail 1 |

## Deviations

- [deviation] Task 1 (00c9da0): the two new `config.md` catalog rows pushed that file 468B over its context-weight budget (self-verify budget-overrun, a blocking check). Bumped `weight-budgets.json` config.md budget 11789 -> 12257B - intentional accepted surface growth, exactly what the manifest's own comment prescribes.
- [deviation] Task 4 (cc527eb): `self-verify.test.mjs` has a `<t>`-placeholder fixture hardcoding the full schema-key list; the two new git keys tripped its reverse `inert-config-key` assertion. Added both keys to that fixture's git line (in scope - the schema change caused it).

## Open items

- [advisory-review, high] `decideBranch` in `milestone`+`auto` (and `ask`) on a protected base returns `{action:'create', branch:null}` when no version is derivable (absent from both `PROJECT.md ### Active` and the ROADMAP title). Rail 1's prose `create -> git checkout -b <branch>` has no null guard, so a version-less project on `main` with `auto_branch:auto` would attempt an unnamed checkout (error, or a branch literally named `null`). The design note's promise that a null name "lets the caller surface a naming problem" is unrealized. Not triggered in this repo (version resolves to `cadence/v1.1.0-rc.2`); it bites only a project with no version token anywhere. Fix: have `decideBranch` downgrade `create`/`ask` -> a naming-problem signal (or `ask`) when `integrationName` is null, and/or add an explicit null-branch guard to rail 1. Reproduced: `decideBranch({mode:'milestone',autoBranch:'auto',currentBranch:'main',protectedBranches:['main','master'],integrationName:null})` -> `{"action":"create","branch":null,...}`.

## Goal check

The four commits plausibly deliver the phase goal. The two config keys resolve to their defaults and reject out-of-enum values (`config.mjs get git.integration_branch git.auto_branch` -> `milestone`/`ask`; `check git.auto_branch=sometimes` -> `ok:false, must be one of: ask, auto, off`), and `self-verify.mjs` exits 0 with no `inert-config-key` for either (verified: exit 0). The decision logic is a total pure function - `decideBranch` (branch-decision.mjs) maps `trunk->stay`, `milestone`+protected+{auto->create, off->stay, ask->ask}, `milestone`+non-protected->stay, unknown->stay - exercised by `branch-decision.test.mjs` and end-to-end through the `git-branch.mjs decide` seam; `node --test` across config/branch-decision/git-branch reports fail 0. Rail 1 of `references/git.md` now invokes `git-branch.mjs decide` and names all three `auto_branch` behaviors plus the `trunk` composition, so cycle-start workflows inherit the create/switch (D-03/D-06). The one honest gap is the null-version edge case recorded above: the create path advises a null branch name rather than surfacing a naming problem - real but out of the happy path for this repo, routed to the open items and CAPTURE rather than silently fixed under an advisory review.
