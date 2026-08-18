---
status: testing
phase: 1
fields_version: 1
started: 2026-08-18
updated: 2026-08-18
---

## Items

### 1. Cut-userinfo secret no longer leaks in excerpt
expected: A response body whose URL userinfo span has its `@` outside the 4096-byte sanitize window yields an excerpt containing zero bytes of the planted secret, at both #215's parametrization and the high-magnitude case that leaked >=900 bytes before the fix.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: redact-url.mjs:104-105,127-132 adds the two end-of-input alternatives after the terminated rules; `node --test --test-name-pattern='EXP-02' cadence-core/bin/review-provider.test.mjs` passes 2/2, both asserting zero bytes of the planted value and the excerpt still capped

### 2. Provider suite passes with truncation equalities intact
expected: `node --test cadence-core/bin/review-provider.test.mjs` passes, both truncation fixtures still assert `=== MAX_HTTP_BODY_BYTES`, and the proxy-page excerpt still contains `504 Gateway Time-out`.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: review-provider.test.mjs:1451 and :1469 still assert `=== MAX_HTTP_BODY_BYTES`, :1453 still matches /504 Gateway Time-out/; the file is green inside the 2174-pass suite run

### 3. Port is not read as userinfo at end-of-input
expected: `redactUrl` returns `https://example.com:8080/path` unchanged both mid-body and at end-of-input.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: redactUrl('https://example.com:8080/path') byte-identical whole-input and mid-body; 'key=sk-live-abc123' and 'git@github.com:org/repo.git' unchanged; redact-url.test.mjs diff over ffeaa3f..c0b0d04 is additions only (0 deletions)

### 4. phase remove refuses an unreadable git state
expected: `phase remove` against a phase dir whose `.git` is unreadable fails with a reason that is not `uncommitted-work`, on both `--dry-run` and apply, and `phases/<N>/` still exists afterwards.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:4277-4287 three-state uncommittedUnder, :4388-4392 the `unreadable-git-state` refusal above the dry-run return, :4526-4534 the independent gate on the rmSync fallback; the PHS-01 family passes 3/3 with phases/3 and ROADMAP.md intact on both arms

### 5. Non-repo remove still succeeds
expected: `phase remove` in a directory that is not a git repository still succeeds and removes `phases/<N>/`; the existing renumber fixtures pass unchanged.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: planning.test.mjs:3980-3985 bare-tree arm returns ok:true with phases/3 removed; every bare-tree renumber fixture green in the full run

### 6. Both falsifiers watched failing at a real prior sha
expected: EXP-02 and PHS-01 each carry a check with a `WATCHED FAILING AT <sha>` header whose sha resolves to a real commit preceding the fix, and that check fails when re-run against that commit's tree.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: `grep -n 'WATCHED FAILING AT' cadence-core/bin/*.test.mjs` -> review-provider.test.mjs:1651 (EXP-02) and planning.test.mjs:3890 (PHS-01), both naming ae73dd6. `git log -1 ae73dd6` -> real commit 'chore: open the v3.5.4 roadmap'; `git merge-base --is-ancestor ae73dd6 534a5b3` -> YES, it precedes the fix. Re-run against that commit's tree (item 9) exits 1 for both.

### 7. Full suite and self-verify exit 0
expected: `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs` both exit 0.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> 2174 pass / 0 fail / 1 skipped, exit 0; tsc -p tsconfig.ci.json exit 0; self-verify.mjs exit 0, {"ok":true,"problems":[]}

### 8. The risk-gate round's two falsifiers have no in-file watch record
expected: behavior wrong - the watch is claimed in prose and in a commit message but is not carried where the convention (and every other falsifier in this tree) puts it, so a future reader cannot re-run it or see what it observed failing
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed at 6ff8bcb. `grep -n 'WATCHED FAILING AT' cadence-core/bin/*.test.mjs` now returns 5 headers, the new one at planning.test.mjs:4037 covering both gate falsifiers - it names ae73dd6, carries the observed failure output (`ok:true` with {"rm":"phases/3"} for each), states what the two reach that the falsifier above does not, and gives the re-watch recipe. SUMMARY.md:52's `ffeaa3f` claim corrected to the ae73dd6 actually observed; the remaining ffeaa3f at SUMMARY.md:34 is the commit RANGE and is correct. Regression check after the change: `node --test cadence-core/bin/*.test.mjs` -> 2174 pass / 0 fail / 1 skipped, exit 0; `node cadence-core/bin/self-verify.mjs` -> exit 0, {"ok":true,"problems":[]}. The blocking risk_surface gate fired on the staged diff (detector matched `destructive` on two PROSE lines) and returned zero findings from gpt-5.6-sol at effort high; persisted to .planning/phases/1/REVIEW-risk_surface-verify-7af5094.md.
reported: behavior wrong - the watch is claimed in prose and in a commit message but is not carried where the convention (and every other falsifier in this tree) puts it, so a future reader cannot re-run it or see what it observed failing
severity: minor
cause: The `WATCHED FAILING AT` header is applied by the executor per plan task, and these two falsifiers were not written by a plan task - they were written during the blocking `risk_surface` gate round (fec446e), which runs outside the plan-task loop, so no task instruction carried the convention to them. The four falsifiers that DO comply (review-provider.test.mjs:1566,1651,1755 and planning.test.mjs:3890) all came out of plan tasks. The watch itself was genuinely performed and is real: I re-ran both at ae73dd6 in a scratch worktree during this UAT and both fail there, returning `ok:true` with {"rm":"phases/3"} among the ops. So this is a missing RECORD, not a missing watch - the evidence lives only in SUMMARY.md:52 and fec446e's commit message, neither of which travels with the test file. Non-behavioral; the tests themselves are correct and green at HEAD.
fix: 6ff8bcb, retest

### 9. Re-watch both falsifiers at ae73dd6: `git worktree add --detach <tmp> ae73dd6`, copy cadence-core/bin/review-provider.test.mjs AND cadence-core/bin/review-provider.mjs into <tmp>/cadence-core/bin/, run `node --test --test-name-pattern='EXP-02' cadence-core/bin/review-provider.test.mjs` there; then in a second worktree copy only cadence-core/bin/planning.test.mjs and run `node --test --test-name-pattern='PHS-01' cadence-core/bin/planning.test.mjs`; remove both worktrees
expected: EXP-02 fails 2/2 naming ~73 and ~985 bytes of SUPERSECRET in the excerpt; PHS-01 fails showing the remove returning ok:true with {"rm":"phases/3"} and phases/3/PLAN.md gone. Both exit 1
origin: verifier
why_human: Not a limit of inspection - the headers, shas and ancestry all check out from here. The re-watch needs `git worktree add`/`remove` against the live repository, which mutates repo state my read-only verification mandate forbids; give me leave to create and remove a scratch worktree and I can execute it instead
status: pass
first_pass: pass
source: model
evidence: Executed the re-watch in two scratch worktrees at ae73dd6, both since removed (`git worktree list` shows only the main tree; `git status --porcelain` clean but for the UAT artifacts). EXP-02 (`node --test --test-name-pattern='EXP-02' cadence-core/bin/review-provider.test.mjs`, with review-provider.mjs copied in for the export only - its diff over the range is `export` + comment, no behavior change, and lib/redact-url.mjs left unpatched: 0 hits for USERINFO_CUT): exit 1, 2 failing - '73 bytes of the planted value rode the failure envelope: ... https://cad:SUPERSECRET_SSS...' and '985 bytes ...'. Matches the header's claim and SUMMARY.md's 73/985 figures exactly. PHS-01 (`node --test --test-name-pattern='PHS-01' cadence-core/bin/planning.test.mjs`, only the test file copied in): exit 1, all 3 failing, two of them showing the remove returning ok:true with {"rm":"phases/3"} among its ops.

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
