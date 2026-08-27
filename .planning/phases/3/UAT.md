---
status: testing
phase: 3
fields_version: 1
started: 2026-08-27
updated: 2026-08-27
---

## Items

### 1. Destructive text inside an excluded artifact reads as a completed clear
expected: `risk-check run` over a range whose only destructive text sits inside one of the four excluded `.planning/phases/` artifacts answers `matches: []` for the destructive category, with `checked: true` and `empty: false` - a clear, not an unread range.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: risk-diff.test.mjs:412-445 asserts matches:[], checked:true, inconclusive:false, empty:false on the envelope and matches:[]/empty:false on the single risk_check trace record; the fixture's second non-risky file is what makes empty:false a clear rather than an unread range. The row fails against a tree with the pathspec spread removed.

### 2. Detection survives the exclusion
expected: The same destructive text in a `.mjs` file in the same range still trips the destructive category, proved by a test that FAILS against the pre-fix tree and passes after.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: risk-diff.test.mjs:447-471 asserts the exact match [{category:'destructive', signal:'changed line: a destructive git command'}]. Independently reproduced the pre-fix failure: with only `...REVIEWER_TEXT_PATHSPECS` removed the row fails, actual signal 'changed line: an `rm -rf`' from the withheld record. lib/risk-diff.mjs unchanged in all four phase commits, so no signal left the table.

### 3. The excluded set is named once and bounded
expected: The four excluded paths are named in one place in the source, and a test asserts each of the four is excluded and that a fifth `.planning/phases/` file (a PLAN.md) is NOT.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: One frozen exported constant at planning/risk-check.mjs:95-100, no second spelling anywhere (grep for 'top,exclude'). Four per-artifact rows on real filenames pass, the PLAN.md boundary row asserts ['destructive'] still trips, and the iterating row is driven by the imported constant with a derived count. Deleting one entry reddens exactly that artifact's row; adding a fifth keeps the suite green with the loop running five times.

### 4. The real range that was overridden now comes back clean
expected: `risk-check run --base f70a0443 --head cf2571b8` reports no destructive match.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: risk-check run --base f70a0443 --head cf2571b8 --surfaces destructive returned checked:true, matches:[], inconclusive:false, empty:false on live history.

### 5. Suite and self-verify are green
expected: `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs` reports `ok:true`.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs: 3483 tests, 3483 pass, 0 fail (one run, no flake observed). node cadence-core/bin/self-verify.mjs: ok:true, problems:[], no budget-overrun for risk-surface.md (file 10768 bytes, budget 10768).

## Summary

total: 5
passed: 5
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
