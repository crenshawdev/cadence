---
status: testing
phase: 2
fields_version: 1
started: 2026-08-19
updated: 2026-08-19
---

## Items

### 1. --dir refuses empty and valueless at all six seams
expected: Each of git-publish.mjs, release-bump.mjs, land-cleanup.mjs, git-branch.mjs, worktree-base.mjs, issue-check.mjs, run with --dir '' and with a trailing valueless --dir, prints ONE JSON line {"ok":false,...} naming the flag (--dir) and exits 1. Baseline before the fix: git-publish.mjs reap --dir '' --branch nosuchbranch-xyz returned {"ok":true,"action":"already-absent"} and git-branch.mjs tags --dir '' printed this repo's 33 tags.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: All 12 arms across git-publish/release-bump/land-cleanup/git-branch/worktree-base/issue-check returned {"ok":false,"reason":"missing-flag-value","detail":"--dir"} exit 1; absent --dir still resolves to cwd (git-branch tags returned the tag list at ok:true).

### 2. Full bin test suite passes and the two-reader header is gone
expected: node --test 'cadence-core/bin/*.test.mjs' passes with zero failures, and cadence-core/bin/lib/seam-input.mjs's header no longer claims two surviving --dir contracts.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: node --test 'cadence-core/bin/*.test.mjs': tests 2321, pass 2321, fail 0. seam-input.mjs:41-45 explicitly reverses the earlier five-callers-keep-the-permissive-reader guarantee.

### 3. release-bump --date refuses every malformed spelling, CHANGELOG untouched
expected: release-bump.mjs bump --date with each of not-a-date, 2026-13-45, 2026-8-1, '' and a newline-carrying value returns {"ok":false,"action":"refuse"} with reason bad-date at exit 1, and CHANGELOG.md is byte-identical afterwards; --date 2026-08-18 still writes '## [<version>] - 2026-08-18'.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: not-a-date, 2026-13-45, 2026-8-1, '', valueless and newline all -> action:refuse reason:bad-date exit 1; CHANGELOG.md sha256 unchanged (1a96df56...); fixture run with --date 2026-08-18 wrote '## [1.1.0] - 2026-08-18'.

### 4. Malformed --date refuses even where nothing would be written
expected: Against a directory with no plugin manifest, --date not-a-date returns the date refusal, NOT {"ok":true,"action":"skip","reason":"no-plugin-manifest"}.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Empty dir + --date not-a-date -> bad-date refusal exit 1; same dir without --date still -> {"ok":true,"action":"skip","reason":"no-plugin-manifest"}.

### 5. A phase spelling that cannot round-trip is refused at both write faces
expected: seed-reqs --phase 1.10 and cursor set --phase 1.10 each return ok:false naming the spelling; --phase 2.1 and --phase 2 still succeed; phase-done --n 02 still checks its roadmap box.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: seed-reqs and cursor set both refuse 1.10 (and 1.0, 01) with bad-args naming the spelling and the rename remedy; 2 and 2.1 accepted in a fixture; phase-done --n 02 checked the fixture roadmap box at line 37.

### 6. The shared numeric readers refuse out-of-safe-range values
expected: requireInt, requireCursorNumber, normalizeNumber and scanIssueRefs each refuse 9007199254740993 and a 400-digit string, where before they returned 9007199254740992 and Infinity.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: requireInt/requireCursorNumber -> ok:false for 9007199254740993 and a 400-digit string, ok:true value 42 for '42'; scanIssueRefs -> [] for both, [42] for '#42'; normalizeNumber guarded at issue-decision.mjs:78/:81 and pinned by two named ARG-04 tests, 5/5 passing when run by name.

### 7. config.mjs reports prototype members as unknown keys
expected: config.mjs get __proto__, get constructor and get toString each return unknown-key and exit 1; get stakes __proto__ refuses rather than answering about one key of two; check '__proto__=1' no longer reports 'retired in v2.0.0: undefined'.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: get __proto__ / constructor / toString and get stakes __proto__ all -> unknown-key exit 1; check '__proto__=1' -> 'unknown key'; genuine retirement model.profile still reports 'retired in v2.0.0: use "stakes" instead ...'.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
