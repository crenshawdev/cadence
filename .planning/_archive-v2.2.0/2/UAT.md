---
status: testing
phase: 2
fields_version: 1
started: 2026-08-03
updated: 2026-08-03
---

## Items

### 1. The destructive rail (SCOPE CUT, not built)
expected: AC1 specifies a destructive rail firing on 10 shapes behind git.on_destructive. That rail was CUT by your decision on 2026-08-03 - deleted rather than built - so this criterion has nothing to test and should be skipped deliberately, not passed. Confirm the cut landed: 1. cd /data/code/cadence 2. Run: node cadence-core/bin/config.mjs get git.on_destructive 3. Expect: ok:false, with git.on_destructive named as an unknown key. 4. Run: printf '%s' '{"tool_input":{"command":"git reset --hard"},"cwd":"/data/code/cadence"}' | node cadence-core/bin/git-guard.mjs 5. Expect: no output at all (the guard is silent on destructive commands by design now).
criterion: AC1
status: skipped
reason: Scope cut by user decision 2026-08-03: the destructive rail was deleted rather than built, so AC1 has nothing to test. Cut confirmed live - config.mjs get git.on_destructive returns ok:false unknown-key, and the guard is silent on git reset --hard.

### 2. The guard stays silent on non-publishing git and on searches
expected: Eight shapes that destroy nothing or run nothing must produce NO decision. 1. cd /data/code/cadence 2. Run this exactly: for c in 'git checkout -b feat' 'git checkout main' 'git restore --staged .' 'git branch -d x' 'git clean -n' 'git stash push -m wip' 'rg -n "git push" .' 'git commit -m "fix the push rail"'; do printf '%s' "{\"tool_input\":{\"command\":\"$(printf '%s' "$c" | sed 's/"/\\\\"/g')\"},\"cwd\":\"/data/code/cadence\"}" | node cadence-core/bin/git-guard.mjs; done 3. Expect: completely empty output - eight silent shapes, no JSON printed.
criterion: AC2
status: pass
first_pass: pass

### 3. The parser files are gone and nothing names them
expected: Both modules and both test files deleted, with no dangling references in code. 1. cd /data/code/cadence 2. Run: git ls-files | grep -c 'shell-tokens\|destructive-git' 3. Expect: 0 4. Run: grep -rn 'shell-tokens\|destructive-git\|gitSubcommands\|destructiveInvocation' cadence-core/ 5. Expect: no output (exit 1, no matches).
criterion: AC3
status: pass
first_pass: pass

### 4. git.md's rail-3 grammar is gone and the CHANGELOG states the cost
expected: The evasion grammar and out-of-grammar table are removed, rails 1-4 keep their numbers, and the CHANGELOG names the shapes that go silent in the same subsection as the removal. 1. cd /data/code/cadence 2. Run: grep -c 'Out of grammar (rail 3)' cadence-core/references/git.md 3. Expect: 0 4. Run: grep -n '^## [0-9]' cadence-core/references/git.md 5. Expect: four headings numbered 1, 2, 3, 4 in order (no rail 5). 6. Run: sed -n '/## \[Unreleased\]/,/## \[2.0.0\]/p' CHANGELOG.md | grep -c 'bash -c' 7. Expect: 1 or more. NOTE: AC3 also asks for 'the destructive rail documented as rail 5'. That clause died with the scope cut - there is no rail 5.
criterion: AC3
origin: verifier
status: pass
first_pass: pass

### 5. The protected-branch deny still works, and only for real commits
expected: The guard's ONLY deny surface, unchanged in reach. 1. cd /data/code/cadence 2. Run: node --test cadence-core/bin/git-guard.test.mjs 2>&1 | grep -E 'refuse denies|read-only search is silent' 3. Expect: two lines, both starting with a check mark (pass). 4. Run: printf '%s' '{"tool_input":{"command":"git push origin main"},"cwd":"/data/code/cadence"}' | node cadence-core/bin/git-guard.mjs 5. Expect: JSON with "permissionDecision":"ask" - an ask, never a deny.
criterion: AC4
origin: verifier
status: pass
first_pass: pass

### 6. TOK-01 reads as superseded and the four public docs are corrected
expected: TOK-01's Shipped rows say superseded on both halves, and README/INTERNALS/DESIGN/METHOD no longer claim reach this phase removed. 1. cd /data/code/cadence 2. Run: grep -n 'TOK-01' .planning/PROJECT.md .planning/REQUIREMENTS.md 3. Expect: both lines contain the word 'SUPERSEDED' or 'Superseded'. 4. Run: grep -c 'reads shell quoting properly enough' README.md 5. Expect: 0 6. Run: grep -c 'cannot' METHOD.md | head -1; grep -n 'v2.2.0' DESIGN.md INTERNALS.md 7. Expect: DESIGN.md and INTERNALS.md each show at least one v2.2.0 line carrying the reversal.
criterion: AC5
origin: verifier
status: pass
first_pass: pass

### 7. cad-land's branch reap runs through the git-publish seam
expected: KNOWN OPEN - reported here rather than hidden. The git-publish.mjs reap subcommand shipped (commit 1fcf51e), but cad-land's prose was never rewired to call it. 1. cd /data/code/cadence 2. Run: grep -n 'git branch -D' skills/cad-land/SKILL.md 3. Expect per AC6: no output. ACTUAL: line 130 still instructs a Bash `git branch -D <decision.branch>`. 4. Run: node cadence-core/bin/self-verify.mjs 5. Expect: ok:true (the seam itself is wired and contract-checked; only the prose lags). Answer with what you see - this one is expected to FAIL.
criterion: AC6
origin: verifier
status: pass
first_pass: fail
reported: skills/cad-land/SKILL.md:130 still instructs a Bash `git branch -D <decision.branch>`; the git-publish.mjs reap subcommand shipped at 1fcf51e but cad-land's prose was never rewired to call it.
severity: major
cause: Phase-2 task 7 landed the seam (decideReap + git-publish.mjs reap + self-verify contract) but the paired prose edit in skills/cad-land/SKILL.md was task 8, which never ran - execution halted after the third blocking risk_surface FAIL.
fix: 9a3f244, retest

### 8. Tests, typecheck and self-verify all clean
expected: The three gates, run exactly as CI runs them. 1. cd /data/code/cadence 2. Run: node --test cadence-core/bin/*.test.mjs 3. Expect: 'pass 1027', 'fail 0' 4. Run: npx tsc -p tsconfig.ci.json 5. Expect: exits 0 with no diagnostics printed. 6. Run: node cadence-core/bin/self-verify.mjs 7. Expect: {"ok":true,...,"problems":[]}
criterion: AC7
origin: verifier
status: pass
first_pass: pass

## Summary

total: 8
passed: 7
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 1
