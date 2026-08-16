---
status: testing
phase: 2
fields_version: 1
started: 2026-08-16
updated: 2026-08-16
---

## Items

### 1. A directory lease overlaps a file and a nested directory the other plan declares
expected: On a two-plan fixture where plan 1 declares files: [src/] and plan 2 declares files: [src/auth.js], `plan-overlap --phase <N>` returns a non-empty overlaps, and that entry's files carries `src/` and `src/auth.js` as two separate strings. Same for `src/` against `src/auth/`.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/bin/planning.test.mjs:3981-3999, both cases green; both spellings asserted present with files.length 2; value traced from the frontmatter declaration through covers/intersects (lib/lease-grammar.mjs:63,76) to overlaps[].files at planning.mjs:1881-1888.

### 2. Both consumers reach containment through the shared module, with no local idiom
expected: plan-overlap and lease-check each reach containment through the exported predicate in cadence-core/bin/lib/, and neither function body contains a local `.includes(`- or `.startsWith(`-based comparison over declared paths.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:164 import; :1883 intersects, :2341 covers; grep for 'files.includes(x)' and 'prefixes.some' prints nothing; no includes/startsWith containment left in either function body (the only hits in range are the NUL-byte parser and cmdDetectCommands:2397).

### 3. The census test reddens on a pasted-back containment body
expected: A census test in the helper-census.test.mjs shape goes red when the containment idiom is pasted anywhere under cadence-core/bin/, test files included.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: helper-census.test.mjs:101-110,121-125; live paste-back probe in a temp checkout of 13b49c0 exits 1 naming lib/census-probe.mjs and lib/lease-grammar.mjs.

### 4. The grammar is documented and its budget re-pinned in the same commit
expected: cadence-core/references/plan-frontmatter.md documents the trailing-slash directory-prefix form and states that `src/auth` does not license `src/authority.js`; weight-budgets.json carries the raised budget for that file in the same commit; `self-verify.mjs` reports no budget problem.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: plan-frontmatter.md:150-197 and :239; weight-budgets.json:36 = 17312 = weight.mjs's reported bytes; both in 71d544d; self-verify exit 0, problems: [].

### 5. ./a.txt and src//a.txt refused through both declaration doors
expected: A plan declaring `./a.txt` or `src//a.txt` is refused with a named diagnostic through BOTH the frontmatter files: list and a `- **Files:**` task line. The diagnostic appears in plan-overlap's frontmatter_issues and the path reaches neither reader.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: lease-grammar.mjs:104 isRefusedSpelling, called on both arms in lib/planning-files.mjs including the task arm's raw twin; full 2x2 seam matrix plus the repeated-declaration line-number case green in planning.test.mjs; lease-check case shows './a.txt' licenses nothing.

### 6. Unambiguous declarations unchanged, and a fileless plan still refused
expected: For declarations that were already unambiguous, lease-check returns the same verdict and the same staged and declared counts as before the phase, and a plan declaring no files is still refused.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: planning.test.mjs diff is 144 insertions / 0 deletions, so all shipped lease-check cases are unedited and green; new staged:2/declared:2 and empty-files undeclared-files cases pass.

### 7. The watched FAIL at the tests-only commit is exactly two cases
expected: Run at the commit where the two failing-capable tests land but the fix does not, `node --test cadence-core/bin/planning.test.mjs` fails on exactly those two cases and no others. The phase SUMMARY records that SHA and the two case names.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: At 328ce76 (archived to a scratch dir): exit 1, fail 2, both failures the two named plan-overlap cases; git show --stat 328ce76 lists only planning.test.mjs; SUMMARY.md:74-76 records the SHA and identifies both cases.

### 8. Full suite and self-verify both green at the phase tip
expected: `node --test 'cadence-core/bin/*.test.mjs'` and `node cadence-core/bin/self-verify.mjs` both exit 0.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 2012/2012 tests pass; self-verify exit 0 with problems: [].

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
