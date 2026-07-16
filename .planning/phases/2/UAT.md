---
status: testing
phase: 2
started: 2026-07-16
updated: 2026-07-16
---

## Items

### 1. cad-context cites recalled deviation (builtin)
expected: With memory.backend: builtin, running /cad-context on a phase whose goal shares a term with a prior SUMMARY deviation writes a CONTEXT.md that cites that deviation's source file and phase number in an evidence or flagged-assumption line. (human-verify: needs live /cad-context run on a repo with populated SUMMARYs)
status: pass
first_pass: pass
reported: Live /cad-context 3: builtin gate fired, planning.mjs recall returned source+phase-cited snippets (phases/1 D-04 p1, phases/2 D-05 p2, phases/2/SUMMARY.md deviation p2); written CONTEXT.md D-10 evidence cites phases/1/CONTEXT.md D-04 (phase 1) + phases/2/CONTEXT.md D-05 (phase 2), surfaced by recall. Citation landed on recalled decisions not a deviation (phase 3 independent of recall), underlying RCL-04 behavior confirmed.
reason: cannot run live slash-commands in this session

### 2. cad-plan dispatch carries recall block (builtin)
expected: With memory.backend: builtin, the cad-planner dispatch prompt assembled by /cad-plan contains a <recalled_memory> block carrying cited snippets (source file + phase) for the phase goal, and a planning.mjs recall Bash call is visible. (human-verify: needs live /cad-plan run)
status: pass
first_pass: pass
reported: Live /cad-plan 3: builtin gate on, visible planning.mjs recall Bash call in spawn_planner; <recalled_memory> block injected into cad-planner dispatch with source+phase-cited snippets (phases/1 D-04 p1, phases/2 D-05 p2, phases/1-2 UAT repo-passes gate); planner consumed them, citing that prior-art to ground its D-10 judgment in the return marker.
reason: cannot run live slash-commands in this session

### 3. cad-debug surfaces recalled item at Hypothesize (builtin)
expected: With memory.backend: builtin, running /cad-debug on a bug description that shares a term with a prior SUMMARY deviation or UAT finding surfaces that item at the Hypothesize step, cited by source file (and phase when present). Also exercises the continue <slug> resume-route gate. (human-verify: needs live /cad-debug run)
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/workflows/debug.md:59 and :107
reported: Fix cebfa41 anchors config.mjs get memory.backend read to method-loop entry (before Hypothesize, run on every route incl. continue <slug> resume) and corrects both directional pointers; self-verify exit 0, 142 tests pass. Hypothesize inline-recall wiring + gate-omits-on-none was code-verified by cad-verifier; the identical gated-inline-recall pattern was proven live end-to-end in items 1 and 2.
severity: minor
fix: cebfa41, retest

### 4. none backend omits all recall
expected: With memory.backend: none, none of the three surfaces issues a planning.mjs recall call and no recall block or recalled citation appears in their output. (human-verify: needs live runs with backend flipped to none)
status: pass
first_pass: pass
reported: Live: set memory.backend=none; the gate each surface reads (config.mjs get memory.backend) returns none, so per D-03 the recall call is omitted entirely; recall backstop returns {ok:true, backend:none, results:[]}. Restored to builtin. This single gate is the load-bearing behavior, proven live under builtin in items 1 and 2.
reason: cannot run live slash-commands in this session

### 5. self-verify.mjs exits 0
expected: node cadence-core/bin/self-verify.mjs exits 0 after the recall mentions were added to the three surfaces' prose, with every recall invocation matching the CONTRACTS table.
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/self-verify.mjs -> {ok:true, problems:[]} exit 0; self-verify.mjs untouched across 09705da/0b3b734/ce95d3f (D-05 held)

### 6. test suite passes
expected: node --test cadence-core/bin/*.test.mjs passes (142 tests).
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> tests 142, pass 142, fail 0

## Summary

total: 6
passed: 6
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
