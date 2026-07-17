---
status: testing
phase: 2
started: 2026-07-17
updated: 2026-07-17
---

## Items

### 1. Config defaults and boolean validation
expected: config.mjs get git.on_land_cleanup returns true and git.auto_close returns false on a default config; each rejects a non-boolean value
status: pass
first_pass: pass
source: verifier
evidence: config.mjs get -> {git.on_land_cleanup:true, git.auto_close:false}; check git.on_land_cleanup=yes and git.auto_close=maybe both return {ok:false, expected true or false}

### 2. self-verify passes with both new keys
expected: node cadence-core/bin/self-verify.mjs exits 0 with git.on_land_cleanup and git.auto_close present (no inert-config-key problem)
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs -> {ok:true, problems:[]} exit 0; CONTRACTS entry land-cleanup.mjs at self-verify.mjs:66-70; config.md:92-93 dotted-token rows satisfy inert-config-key

### 3. Cleanup decision function
expected: the cleanup decision returns return-to-base + pull + reap when on_land_cleanup=true and the integration branch is merged into base; returns leave-in-place when off; and never reaps when the branch is not merged into base
status: pass
first_pass: pass
source: verifier
evidence: close-decision.mjs:51-62; seam --merged true -> reap:true,returnToBase:true,pull:true; --merged false -> reap:false,action:cleanup; on_land_cleanup:false -> action:skip

### 4. Gate-halt decision function
expected: under auto_close=true the gate halts before merge and returns the findings when a surviving blocker/high pre_ship finding is present (regardless of configured gate mode), and proceeds when none is present
status: pass
first_pass: pass
source: verifier
evidence: close-decision.mjs:77-88; seam auto_close=true+blocker->halt w/finding, +high->halt, +medium->proceed, auto_close=false+blocker->proceed; 15+7 tests pass

### 5. cad-land publish ask has no preselected default
expected: with auto_close=false (default), a /cad-land run presents the publish mechanism with no preselected default (human-verify: needs live cad-land run)
status: pass
first_pass: pass
fix: live-verified 2026-07-17: /cad-land on dev plugin presented the step-4a publish ask (push/PR/tag/leave-local) with no preselected default; user freely chose Open PR
reason: Marketplace-installed plugin is a stale 1.0.0 copy, not symlinked to this dev repo; the running /cad-land is old prose, so the phase-2 no-default posture can't be live-exercised here. Wiring confirmed present in local source (cad-land/SKILL.md:49-63) and unchanged by phase 2 per D-08. Needs the plugin reinstalled from this branch to verify.

### 6. cad-milestone auto_close full chain
expected: a /cad-milestone run with auto_close=true runs audit -> tag -> PR -> merge -> reset with no per-step prompts, and afterward HEAD is on base, pulled, with the integration branch reaped (human-verify: needs live remote + gh/glab merge)
status: blocked
reason: Deferred by /cad-verify 2 (2026-07-17, user decision): the auto_close full milestone chain cuts a real tag + merge, so verifying it and running it for real are the same act - it will be exercised when /cad-milestone runs the actual v1.1.0 auto_close close. Precondition now cleared (dev plugin installed from this branch); still needs a live remote + real merge. Not run now: phase 3 (release mechanics) precedes the cut and more work is queued.

### 7. Test suite passes
expected: node --test passes across cadence-core/bin, including new tests for the cleanup path and the auto-close gate-halt
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> tests 192 / pass 192 / fail 0

### 8. decideCleanup reaps a null branch (missing branch != null guard)
expected: decideCleanup sets reap from mergedIntoBase===true alone with no guard that branch is non-null (close-decision.mjs:57). Machine-reproduced: land-cleanup.mjs cleanup --merged true with an unresolvable branch emits {reap:true, branch:null}. On the GitHub auto_close path this is the normal case: gh pr merge --delete-branch removes the local integration branch before step 5, git branch --merged no longer lists it, resolveReapBranch returns null, and forced --merged true yields reap:true,branch:null; cad-land SKILL.md:98-101 then runs git branch -D <null> which errors at the tail of an otherwise-successful close.
status: pass
first_pass: fail
source: verifier
evidence: close-decision.mjs:57 (const reap = mergedIntoBase === true; no branch check); land-cleanup.mjs:84-87; SKILL.md:98-101
reported: decideCleanup sets reap from mergedIntoBase===true alone with no guard that branch is non-null (close-decision.mjs:57). Machine-reproduced: land-cleanup.mjs cleanup --merged true with an unresolvable branch emits {reap:true, branch:null}. On the GitHub auto_close path this is the normal case: gh pr merge --delete-branch removes the local integration branch before step 5, git branch --merged no longer lists it, resolveReapBranch returns null, and forced --merged true yields reap:true,branch:null; cad-land SKILL.md:98-101 then runs git branch -D <null> which errors at the tail of an otherwise-successful close.
severity: major
cause: close-decision.mjs:57 sets reap from mergedIntoBase===true alone with no guard that branch is non-null. Machine-reproduced: land-cleanup.mjs cleanup --merged true with an unresolvable branch emits {reap:true,branch:null}, and cad-land SKILL.md:98-101 would run git branch -D <null>. Fix: gate the reap flag on branch != null in decideCleanup; add a test for --merged true + null branch -> reap:false.
fix: 6d415fd, retest

### 9. gh pr create does not push a local-only integration branch (GitHub auto_close)
expected: cad-land SKILL.md:70-74 claims opening the PR pushes it, but gh pr create --base <base> --head <branch> --fill will not push a branch with no remote non-interactively, so the GitHub auto_close chain can fail at PR-open before merge. GitLab glab mr create does push, so only the GitHub path is affected.
status: pass
first_pass: fail
source: verifier
evidence: SKILL.md:69-75 (prose asserts gh/glab create pushes it); SUMMARY.md:66-73
reported: cad-land SKILL.md:70-74 claims opening the PR pushes it, but gh pr create --base <base> --head <branch> --fill will not push a branch with no remote non-interactively, so the GitHub auto_close chain can fail at PR-open before merge. GitLab glab mr create does push, so only the GitHub path is affected.
severity: major
cause: cad-land SKILL.md:70-74 claims gh pr create --head pushes a local-only branch, but gh will not push a branch with no remote non-interactively, so the GitHub auto_close chain can fail at PR-open. Fix: add git push -u origin <branch> before gh pr create on the GitHub path. GitLab glab mr create already pushes.
fix: closed by git-publish seam (fab6a64..24b58c6); isPlainPush deleted, prose corrected, 217 tests green, self-verify ok

## Summary

total: 9
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 1
reworked: 2
