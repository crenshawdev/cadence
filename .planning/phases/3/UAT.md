---
status: testing
phase: 3
fields_version: 1
started: 2026-08-26
updated: 2026-08-26
---

## Items

### 1. Missing or extra planning stem fails the suite
expected: With a planning-*.test.mjs file on disk that GROUPS.planning does not name, `node cadence-core/bin/test.mjs` fails and prints the offending stem; with a stem named in GROUPS.planning that has no file on disk, it fails the same way and prints that stem. Both directions checked against a mutated tree.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Both directions exercised against a mutated isolated copy of cadence-core/bin. Extra file: 'planning-*.test.mjs on disk that GROUPS.planning does not name: planning-zz-probe'. Missing file: 'GROUPS.planning entries with no <stem>.test.mjs file in cadence-core/bin/: planning-uat'. Each names the offending stem, fail 1 both times, and the copy returned to pass 2 / fail 0 after revert. Failure reaches `node cadence-core/bin/test.mjs` because `test-groups` runs in the `other` group and test.mjs exits on the child's status. Real working tree left clean.

### 2. planning-capture-check listed under planning, 23 stems match 23 files
expected: `node cadence-core/bin/test.mjs --list` shows planning-capture-check under the planning group rather than other, and the planning group's planning-* stems number the same 23 as the planning-*.test.mjs files on disk.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: `--list` prints planning-capture-check under `planning (27)`, absent from `other`. Set diff on the live tree: 23 planning-* stems in the group, 23 planning-*.test.mjs files on disk, zero on either side of the difference.

### 3. Registry row for the stem census exists and the registry test passes
expected: cadence-core/bin/lib/census-registry.mjs holds a row whose holder is cadence-core/bin/test-groups.test.mjs and whose subjects is exactly ['cadence-core/bin/test.mjs']; `grep -c 'CADENCE-CENSUS' cadence-core/bin/test-groups.test.mjs` returns at least 1, and `node cadence-core/bin/census-registry.test.mjs` passes.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: census-registry.mjs:277-298 - holder 'cadence-core/bin/test-groups.test.mjs', subjects ['cadence-core/bin/test.mjs'] exactly. grep -c CADENCE-CENSUS on the holder = 1 (test-groups.test.mjs:91). `node cadence-core/bin/census-registry.test.mjs` exits 0.

### 4. CADENCE-CENSUS prose home in conventions.md
expected: conventions.md's '## Deliberate shortcuts' section describes the CADENCE-CENSUS fields, states that a marked site with no registry row fails the suite, and cites cadence-core/bin/lib/census-registry.mjs as the carrier of the rest; `grep -c 'CADENCE-CENSUS:' cadence-core/references/conventions.md` returns 0.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: conventions.md:60-84 within `## Deliberate shortcuts`: field grammar, the reddening rule for a marked site no row names, and the pointer to cadence-core/bin/lib/census-registry.mjs for the rest. `grep -c 'CADENCE-CENSUS:'` = 0; only the backticked mention at :62.

### 5. No budget overrun and the conventions.md budget is exact
expected: `node cadence-core/bin/self-verify.mjs` reports no budget-overrun, and weight-budgets.json's entry for cadence-core/references/conventions.md equals that file's `wc -c`.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: self-verify: problems []. weight-budgets.json:30 = 16941; `wc -c` = 16941.

### 6. seam-calls header names the archived plan, census figures unchanged
expected: cadence-core/bin/seam-calls.test.mjs's header names v3.3.0 phase 4's PLAN-2 task 6 as the source of the 5-for-context.md figure it argues against, and the census marker at :139 still asserts 14 for workflows/plan.md and 6 for workflows/context.md.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: seam-calls.test.mjs:48-49 names v3.3.0 phase 4's PLAN-2 task 6 at .planning/_archive-v3.3.0/4/PLAN-2.md, and that file's :225 is that task. Marker text still asserts 14 and 6 (grep count 1); it now sits at :140 rather than :139 purely because the header grew one line - figures untouched.

### 7. Full suite green
expected: `node cadence-core/bin/test.mjs` runs to completion with fail 0.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/test.mjs` exit 0, tests 3323, pass 3323, fail 0.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
