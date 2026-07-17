---
status: testing
phase: 1
started: 2026-07-17
updated: 2026-07-17
---

## Items

### 1. git.integration_branch key: default + enum
expected: `config.mjs get git.integration_branch` returns `milestone` on a default config; a value outside {milestone,trunk} is rejected (ok:false, must be one of)
status: pass
first_pass: pass
source: verifier
evidence: config.mjs get -> git.integration_branch:milestone; check git.integration_branch=foo -> ok:false, must be one of: milestone, trunk

### 2. git.auto_branch key: default + enum
expected: `config.mjs get git.auto_branch` returns `ask` on a default config; a value outside {ask,auto,off} is rejected (ok:false, must be one of)
status: pass
first_pass: pass
source: verifier
evidence: config.mjs get -> git.auto_branch:ask; check git.auto_branch=sometimes -> ok:false, must be one of: ask, auto, off

### 3. self-verify clean with both new keys
expected: `node cadence-core/bin/self-verify.mjs` exits 0 with both new keys present - no inert-config-key problem for either
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs EXIT=0, problems:[]; catalog prose in workflows/config.md satisfies reverse inert-key check

### 4. milestone+auto on protected base creates named branch; off stays
expected: In milestone mode with auto_branch=auto and HEAD on a protected branch, the decision is create+switch to an integration branch named from the milestone version (e.g. cadence/v1.1.0-rc.2) before the first commit; with off, HEAD stays on the protected branch
status: pass
first_pass: pass
source: verifier
evidence: decideBranch auto/main -> {action:create, branch:cadence/v1.1.0-rc.2}; off/main -> {action:stay}; git.md rail 1 does git checkout -b <branch> on create

### 5. trunk mode creates no integration branch
expected: With git.integration_branch=trunk, the decision creates no integration branch (stay, branch:null); a commit on the protected base stays governed by on_protected
status: pass
first_pass: pass
source: verifier
evidence: decideBranch trunk/main -> {action:stay, branch:null, reason: trunk mode: no integration branch...}; git.md confirms git-guard.mjs unchanged

### 6. milestone mode reports integration tip as worktree fork point
expected: In milestone mode the branch-decision/seam reports the integration branch (its tip), not `main`, as the worktree fork point
status: pass
first_pass: pass
source: verifier
evidence: seam emits branch:cadence/v1.1.0-rc.2 (not main) as HEAD target; execute.md:154 merges worktree branches back into HEAD (the integration branch)

### 7. node --test passes including new config + branch-decision tests
expected: `node --test` passes across cadence-core/bin, including new tests covering both config keys and the branch-decision function
status: pass
first_pass: pass
source: verifier
evidence: full bin suite tests 170, pass 170, fail 0; named coverage: config key defaults/enum, all decideBranch cases, git-branch seam fixtures

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
