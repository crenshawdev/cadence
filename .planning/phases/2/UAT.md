---
status: testing
phase: 2
fields_version: 1
started: 2026-08-14
updated: 2026-08-14
---

## Items

### 1. Pre-anchor events join their phase at read time
expected: A bare-corr event written before its phase's lifecycle/phase_start renders joined to that phase's <phase>-<sha> corr, proved by a test that fails on the pre-fix reader; the committed fixture's every roles figure is byte-identical before and after the re-baseline.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: trace.test.mjs:236 (fails pre-fix: disk keeps corr '1', render shows '1-abc1234'); fixture test trace.test.mjs:1150 roles byte-identical to PLAN-1's pre-phase measurement; suite green

### 2. Wrong-role close surfaces in a mismatched render array
expected: Closing a dispatch with a terminal whose --role differs from the dispatch's renders a mismatch entry in a new top-level render array; the roles map's keys and values are unchanged, no zero-dispatch role carries a token total, and the four existing roles deep-equal tests stay green.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: trace.mjs:324/408/640, planning.mjs:1712/2773 relay; trace.test.mjs:770 pins mismatched entry, unchanged roles map, no zero-dispatch token row; billed-to-dispatcher test at :731 green

### 3. Replayed terminal funds one bracket, not two
expected: Two dispatches on one worker key, closed by one genuine return --tokens N plus a replay of that same close, render unrecorded: 1 rather than double-funding - asserted by a test that fails on the pre-fix FIFO pairing.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: trace.test.mjs:809 asserts unrecorded:1 and tokens counted once on one worker key with an identical replayed close - exactly the pre-fix FIFO double-funding path

### 4. R1 fires on the live corpus under the fire-scoped veto
expected: trace suggest run over the live corpus emits at least one R1 suggestion under the fire-scoped veto, and the demonstration (input lines and emitted suggestion) is recorded in the phase record as quoted literals or a recorded measurement - never a committed test reading the gitignored .planning/trace.jsonl.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Live `trace suggest` run emits risk_surface reviewers / review.reviewers (a config.schema.json key); R1-DEMO.md records lines+suggestion+arithmetic; regression test :169 uses string literals, never reads gitignored trace.jsonl

### 5. Both re-arm spellings parse to the base trigger
expected: parseAdjudication admits both on-disk re-arm spellings (risk_surface rearm:, risk_surface re-arm:), normalized to base trigger risk_surface with a rearm marker; the phantom-config-key schema test stays green and the two pinned-unparseable rows are re-pointed - one test row per spelling.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: trace-suggest.test.mjs:84 - both spellings parse to base trigger with rearm marker, other spaced tokens and the unadjudicated line stay null; phantom-key schema test :365 green

### 6. The reads figures reach a reader
expected: A /cad-report or /cad-suggest workflow step calls planning.mjs reads and renders topFiles, fileRedundancy and fileCalls by name.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: report.md:22 reads call, :29/:50 all three fields by name, whole-file caveat and empty-record silence stated; reachable via skills/cad-report/SKILL.md:20

### 7. Tests and self-verify pass
expected: node --test cadence-core/bin/*.test.mjs passes and node cadence-core/bin/self-verify.mjs reports no unbudgeted-surface and no budget-overrun.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 1710/1710 tests pass; self-verify ok:true, problems:[]

### 8. /cad-report names mismatched in Record health
expected: cadence-core/workflows/report.md's Record health section names the mismatched array so a wrong-role close is reported, not only rendered.
status: pass
first_pass: pass
source: verifier
evidence: report.md:49 Record health names mismatched brackets; :71-75 worker + both roles + billing rule

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
