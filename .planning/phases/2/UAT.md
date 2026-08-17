---
status: testing
phase: 2
fields_version: 1
started: 2026-08-17
updated: 2026-08-17
---

## Items

### 1. trace close persists the turn count and the render reports turns per dispatch and per role
expected: `planning.mjs trace render --phase 2` reports a turns figure per bracket and per role, not tokens alone
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:2975-2998,3145-3149 and lib/trace.mjs:620-738; live `trace render --phase 2` gives cad-executor turns 204 = 127 + 77, the phase's two executor closes

### 2. A close with no turn figure renders under its own unrecorded counter, never as 0
expected: A role whose closes carried no turn figure shows turns_unrecorded rather than `turns: 0`, and a dispatch reporting tokens-but-no-turns stays distinguishable from turns-but-no-tokens
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: lib/trace.mjs:762-786 gates both turn keys on turnsFigures; live render shows cad-planner with tokens and no turn key, cad-executor with turns 204 and turns_unrecorded 17; named test 'render: reporting tokens without turns is a different row from the reverse' passes

### 3. A malformed --turns value is refused wholesale with nothing appended
expected: `trace close --turns -1`, a non-integer, and the bare flag each exit non-zero and append no line to trace.jsonl
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:2990-2996; -1, abc, 1.5 and the bare flag each exit 1 in a scratch .planning dir with trace.jsonl left at 0 lines, while --turns 0 records a real 0

### 4. Neither /cad-report nor /cad-suggest presents worker-return tokens as the run's cost
expected: The seam emits what the figure excludes (orchestrator turns, cross-model provider calls, figureless returns); both readers relay it unchanged, /cad-suggest gains no flag and recomputes nothing
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: lib/trace-suggest.mjs:75-79 frozen SPEND_EXCLUDES read by both R5's evidence string (:332) and prose-agreement.test.mjs:1073-1120 against report.md:51,64-79; suggest.md byte-unchanged, still 'Add no flag of any kind' and 'Relay the figures UNCHANGED'

### 5. The gap is printed as its terms against a named external comparator, with no stored multiplier
expected: report.md names burnrate and prints dispatches, turns, the per-dispatch window figure and the unmeasured count; `grep -rn` over cadence-core/ finds no stored multiplier or ratio constant
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: report.md:52,80-94 prints dispatches, turns with turns_unrecorded, the per-dispatch window figure stated as a proxy and the unmeasured count, naming burnrate as a tool the user runs; grep over cadence-core/ finds no ratio or multiplier constant

### 6. /cad-progress --trace and DOCS-CLAIMS PROGRESS-28 no longer claim the record has one corr
expected: The cost sentence in progress.md and row PROGRESS-28 are corrected, so a render on this repo returning more than one corr contradicts no shipped prose
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: progress.md:99-107 states the filter reads phase alone and never corr; DOCS-CLAIMS.md:1346 PROGRESS-28 rewritten and marked corrected - 059493f; no shipped prose anywhere claims a single corr

### 7. Each requirement half has a check watched failing at a named SHA
expected: Both MSR-01 and MSR-02 checks carry a header comment naming the SHA they were watched failing at, and running that check against that SHA exits non-zero
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Replayed both SHAs from `git archive` into scratch trees: trace.test.mjs exits 1 at 97eaf03 (11 fails incl. the MSR-01 falsifier), trace-suggest.test.mjs and prose-agreement.test.mjs each exit 1 at 4b1d659 on their MSR-02 checks

### 8. The full suite and self-verify both exit 0 with pins updated
expected: `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs` both exit 0, with weight-budgets.json re-pinned and the 'trace close' contract row updated
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: suite 2083 pass / 0 fail exit 0; self-verify --root . problems: [] exit 0; tsc -p tsconfig.ci.json exit 0; weight-budgets.json re-pinned on all ten touched surfaces; self-verify.mjs:343-352 carries --turns on the 'trace close' row

### 9. DOCS-CLAIMS row PROGRESS-14 still records the falsified one-corr claim as accurate
expected: behavior wrong - a ledger row left asserting, and marking accurate, the exact claim PROGRESS-28 was corrected for in this phase
origin: verifier
status: pass
first_pass: fail
source: model
evidence: grep -n '^| PROGRESS-1[34] ' .planning/DOCS-CLAIMS.md -> :893 PROGRESS-13 re-anchored 93 -> 96 (the render command's real line), :894 PROGRESS-14 now reads 'Four family counts routing, provider, lifecycle, outcome printed over the events the phase filter admitted' at anchor 99-101 with resolution 'corrected - 059493f'. grep -c 'under one `corr`' .planning/DOCS-CLAIMS.md -> 0, so no ledger row asserts the falsified claim. sed -n '99,101p' cadence-core/workflows/progress.md matches the new anchor verbatim. self-verify --root . -> problems: [] exit 0. risk-check run --base HEAD~1 --head HEAD -> matches: [], inconclusive: false. Fixed in 9b96b08.
reported: behavior wrong - a ledger row left asserting, and marking accurate, the exact claim PROGRESS-28 was corrected for in this phase
severity: minor
cause: D-13 enumerated the ledger rows to move BY NAME (REPORT-05, REPORT-10/11/12, SUGGEST-07/08, PROGRESS-15/28/29), so plan 2 task 6's sweep worked from that list rather than from every row anchored into the region of progress.md the phase rewrote. PROGRESS-14 sits two rows above PROGRESS-15 in the same table and was falsified by the same D-08 measurement that falsified PROGRESS-28: it asserts the four family counts sit 'under one corr' while the live sentence it cites (progress.md:99-101) now says the filter reads phase alone and never corr, so those counts can span several runs. Its anchor 95 also drifted off the counts sentence onto the code fence. Shipped prose and AC5 are unaffected - the defect is confined to the planning ledger.
fix: 9aecf9e, retest

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
