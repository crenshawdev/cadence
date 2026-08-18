---
status: testing
phase: 1
fields_version: 1
started: 2026-08-18
updated: 2026-08-18
---

## Items

### 1. Resolver returns a non-empty branch list for every grammar row
expected: node -e against lib/protected-branches.mjs returns "" -> ['main','master'], " " -> ['main','master'], [""] -> ['main','master'], ["","main"] -> ['main'], [] -> [], "release" -> ['release']; no returned list contains an empty or whitespace-only entry.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live node -e over lib/protected-branches.mjs matched all six AC1 rows exactly; protected-branches.test.mjs rows (including the D-09 [] row and the #38 string row) green.

### 2. git-guard refuses a commit on main under a string "" config
expected: With git.protected_branches: "" in the repo config layer, running git-guard.mjs against a `git commit` on main refuses it.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: git-guard.test.mjs:172-189 asserts a non-null protected-branch decision naming main under "" and under [""], ask by default and deny under on_protected: refuse; file passes.

### 3. land-cleanup and issue-check emit a defined base under a string ""
expected: Under git.protected_branches: "" with no git.base_branch and no --base, land-cleanup.mjs and issue-check.mjs each emit a defined base; the string `undefined` appears in neither the `git branch --merged` nor the `git log ..HEAD` invocation.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: land-cleanup.test.mjs:122-131 asserts base === 'main'; issue-check.test.mjs:228-246 asserts referenced === [42 open, 47 closed, 99 open] with no --base and no git.base_branch; both pass.

### 4. All six scratch sites use a per-run path
expected: rg 'TMPDIR:-/tmp' cadence-core skills agents hooks shows a per-run path at all six sites of D-11; no fixed shared filename remains at any of them.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: rg 'TMPDIR:-/tmp' over cadence-core/skills/agents/hooks shows a mktemp -d template at every site line (triage-gate.md:82, progress.md:99, report.md:29, review-triggers.md:202 for both artifact and payload, task.md:126) and no fixed shared filename; the composer's payload path is now an explicit argument.

### 5. A reintroduced fixed shared path fails a deterministic named check
expected: Reintroducing a fixed shared scratch path at any one of the six sites makes a deterministic check FAIL by name; with the tree as shipped, that same check passes.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: self-verify exits 0 with scratch-path in checked and problems: []; self-verify.test.mjs check-21 rows show a reintroduced fixed shared path reaching problems with kind scratch-shared-path and the surface named, and the live tree clean of all three codes.

### 6. Every read-back refuses a truncated file by name
expected: Feeding a truncated file to each of the six read-backs produces a named refusal and a non-zero exit; none throws an unhandled parse error and none prints {} as a success. The five prose read-backs name the refusal on stderr; review-provider.mjs --payload names it in its stdout seam envelope ({"ok":false,"reason":"bad-payload"}).
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: scratch-readback.test.mjs executes the four extracted prose scripts against truncated and wrong-shaped fixtures: non-zero exit, named reason on stderr, empty stdout, with a negative control; review-provider.test.mjs:685 covers the --payload seam's bad-payload envelope.

### 7. self-verify, the full suite, and the two doc claims all agree
expected: node cadence-core/bin/self-verify.mjs and the full test suite both pass, with references/conventions.md's stated rule showing the per-run form and the .planning/DOCS-CLAIMS.md TASK-17 row matching workflows/task.md's current line.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify exit 0 / problems []; full suite 2250 tests, 2249 pass, 0 fail, 1 skipped; conventions.md:98-108 in per-run form; DOCS-CLAIMS.md TASK-17 span 125-129 matches task.md's current bullet.

### 8. A scratch file that parses to null crashes the read-backs instead of refusing by name
expected: behavior wrong - the four shipped node -e read-backs dereference the parsed value outside their try/catch, so a well-formed file holding literal `null` throws an uncaught TypeError rather than printing the promised scratch-shape refusal
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Ran the shipped triage-gate.md read-back verbatim against a file holding literal `null`: stderr `scratch-shape: <path> is not an object`, exit 1, empty stdout - the promised named refusal where it previously threw an uncaught TypeError. `node --test cadence-core/bin/scratch-readback.test.mjs` -> 16 pass 0 fail, six refusal arms across the three JSON read-backs (null parse plus non-object array element per surface) executed rather than read. `node cadence-core/bin/self-verify.mjs` -> ok:true, problems: []. Full suite `node --test cadence-core/bin/*.test.mjs` -> 2256 tests, 2255 pass, 0 fail, 1 skipped (pre-existing). Fixed in 67d4600; the blocking risk_surface gate on that staged diff FAILed with three high findings (element-level shape), all three fixed, and its one narrowed re-arm round returned findings: [].
reported: behavior wrong - the four shipped node -e read-backs dereference the parsed value outside their try/catch, so a well-formed file holding literal `null` throws an uncaught TypeError rather than printing the promised scratch-shape refusal
severity: minor
cause: The three JSON read-backs test shape BY dereferencing the parsed value, and the dereference sits after the try/catch closes: `!Array.isArray(r.outcomes)` (references/triage-gate.md:84), `["counts","roles","unpaired","capped"].filter((k)=>r[k]===undefined)` (workflows/progress.md:101), `!Array.isArray(r.brackets)` (workflows/report.md:76). JSON.parse("null") is a SUCCESSFUL parse returning null, so control leaves the catch and the shape check itself throws TypeError with no named reason. There is no site where a non-object parse result can land as scratch-shape, because the shape check is the crash. scratch-readback.test.mjs pins only object-shaped wrong files ('{"corr":"c1"}', '{}'), so no row covers it. The review-triggers.md composer reads TEXT and is not affected.
fix: 67d4600, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
