---
status: testing
phase: 1
fields_version: 1
started: 2026-07-30
updated: 2026-07-30
---

## Items

### 1. Fieldless checklist is a break, not a legacy exemption
expected: Running criteria-coverage on a tree holding phase 6's shipped checklist (17 items, no criterion, no origin, no fields_version) beside a CONTEXT declaring AC1-AC9 returns a `fieldless-checklist` break naming phase 6, `legacy` does not contain 6, and counts.criteria includes those 9.
criterion: AC1
status: pass
first_pass: pass

### 2. The exemption survives where it should, and phase-3 shape stays out of legacy
expected: On the same command: a fieldless checklist beside a CONTEXT declaring no AC<N> ids is still reported in `legacy` with no break; a phase-3-shaped file (fields_version marker present, 7 criterion links, 0 origin) is not in `legacy`. Both are pinned as test rows.
criterion: AC2
status: pass
first_pass: pass

### 3. criteria-coverage states the versions it ran as
expected: criteria-coverage output carries the plugin version and the UAT fields version, and a run with CADENCE_PLUGIN_MANIFEST pointed at a fixture manifest reports that fixture's version instead of the repo's.
criterion: AC3
status: pass
first_pass: pass

### 4. Merge findings envelope is persisted and stable
expected: After a `uat merge`, .planning/phases/<N>/FINDINGS.json holds the five counters plus rejected_entries and skipped_entries, and the file is byte-identical after a later `uat record` on the same phase.
criterion: AC4
status: pass
first_pass: pass

### 5. uat record --criterion repairs a dropped link
expected: `uat record --phase N --item M --result <current status> --criterion AC3` writes the link into the checklist; a value failing ^AC\d+$ is refused with a named diagnostic and nothing is written. (CONTEXT AC5's literal command omits --result, which the seam requires - see SUMMARY open items.)
criterion: AC5
status: pass
first_pass: pass

### 6. Test suite green
expected: `node --test cadence-core/bin/*.test.mjs` exits 0, including the lib/planning-files.test.mjs case that ENOENTed on the pruned phases CONTEXT.md at the phase's red baseline.
criterion: AC6
status: pass
first_pass: pass

### 7. Typecheck and self-verify clean
expected: `npx tsc -p tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports ok:true with no budget-overrun on any surface this phase edited.
criterion: AC7
status: pass
first_pass: pass

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
