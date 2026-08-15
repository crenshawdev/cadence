---
status: testing
phase: 1
fields_version: 1
started: 2026-08-15
updated: 2026-08-15
---

## Items

### 1. The gate-agreement check flags the pre-patch schema values
expected: A test in cadence-core/bin/*.test.mjs feeds the check the pre-patch values (plan: adjudicated, diff: advisory, phase_diff: advisory) and asserts a problem naming each disagreeing trigger, including phase_diff at shipped.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Frozen PRE_PATCH fixture at gate-agreement.test.mjs:42 + arms :123/:132; 28/28 pass; verbatim pre-patch failing JSON in reports/plan-1.md names plan, diff, phase_diff with two entries naming phase_diff and shipped.

### 2. self-verify is green and names the new check
expected: node cadence-core/bin/self-verify.mjs exits 0 with problems: [], and its checked list names the new check.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/self-verify.mjs -> exit 0, problems 0, checked ends with 'gate-agreement'; call site self-verify.mjs:1106 inside the route-table arm, import at :145.

### 3. An unset gate reads back as unset, a pinned gate reads back pinned
expected: With no gate set, config.mjs get review.triggers.<t>.gate returns null plus one warnings[] entry naming route.mjs resolve, for all four triggers; after config.mjs set review.triggers.diff.gate=blocking the same command returns blocking with no such warning.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live get: diff/risk_surface/phase_diff -> null + exactly one warning naming `route.mjs resolve`; plan (pinned in the global layer) -> "adjudicated" unwarned; --file probe with diff pinned to blocking -> "blocking" unwarned. config.mjs:283.

### 4. Keyless get carries no gate warning and check still refuses null
expected: config.mjs get with no key names emits no gate-related warning, and config.mjs check review.triggers.diff.gate=null returns ok:false with 'must be one of: off, advisory, blocking, adjudicated'.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Keyless get -> warnings []; check review.triggers.diff.gate=null -> ok:false, 'must be one of: off, advisory, blocking, adjudicated'.

### 5. The workaround wording is gone from the prose surfaces
expected: A repo-wide grep for the workaround wording returns nothing - neither workflows/execute.md nor workflows/plan.md states that a get of a gate returns the schema default - and references/config-catalog.md's gate row publishes no per-key scalar default.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Repo-wide grep: 22 hits, none about a gate get; execute.md and plan.md absent; config-catalog.md:62 Default cell carries no scalar gate; three DOCS-CLAIMS rows moved off accurate.

### 6. All four purposes name all three levels and match the route grid
expected: Each of the four review.triggers.*.gate purpose strings names a gate for solo, shipped and critical, each equal to route-table.json's review[level][trigger]; deleting one level clause from any of the four makes self-verify.mjs report a problem.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Parsed schema-vs-grid comparison matches cell-for-cell on all twelve; self-verify.test.mjs delete-a-clause arm files exactly one problem and passes in the suite.

### 7. The full test suite passes with nothing removed or loosened
expected: node --test cadence-core/bin/*.test.mjs passes, with no test file removed and no count-pin assertion loosened.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 1870 pass / 0 fail; 512 insertions and 0 deletions across the three touched test files.

### 8. The twelve cells are named in the phase SUMMARY
expected: SUMMARY.md names each of plan, diff, risk_surface and phase_diff at solo, shipped and critical, whether or not the cell moved (ROADMAP criterion 2).
status: pass
first_pass: pass
source: verifier
evidence: SUMMARY.md:37-42 twelve-cell table, each cell equal to route-table.json's review grid.

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
