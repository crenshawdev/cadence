---
status: testing
phase: 1
started: 2026-07-16
updated: 2026-07-16
---

## Items

### 1. Recall ranks matching SUMMARY deviation first
expected: On a fixture with a SUMMARY deviation containing term X, `planning.mjs recall "X"` emits one JSON line, ok:true, with that deviation's snippet ranked first, carrying source and phase fields.
status: pass
first_pass: pass
source: verifier
evidence: Live: recall "zorptastic" -> ok:true, snippet ranked first with source phases/1/SUMMARY.md + phase:1; multi-doc ranks CONTEXT decision above CAPTURE todo. cmdRecall planning.mjs:505-565, dispatch :725.

### 2. Recall determinism
expected: Two consecutive identical recall runs on the same corpus produce byte-identical stdout.
status: pass
first_pass: pass
source: verifier
evidence: Live: two identical runs byte-identical. Score rounded 4dp (planning.mjs:558), no timestamp, sorted traversal (:522-524), total order from search() (bm25.mjs:86).

### 3. Empty / absent corpus is a clean success
expected: In a directory with no .planning/ or an empty corpus, recall exits 0 emitting {"ok":true,"results":[]}.
status: pass
first_pass: pass
source: verifier
evidence: Live: absent .planning and empty corpus both -> {"ok":true,"results":[]} exit 0. existsSync guard planning.mjs:521, empty return :549.

### 4. memory.backend none reports off
expected: With effective memory.backend: none, recall exits 0 emitting an explicit backend-off field and no results.
status: pass
first_pass: pass
source: verifier
evidence: Live: config {memory:{backend:none}} -> {"ok":true,"backend":"none","results":[]} exit 0. planning.mjs:512.

### 5. Schema default flipped to builtin
expected: config.schema.json lists memory.backend values ["none","builtin"] with default builtin; the engine template and this repo's .planning/config.json both read builtin.
status: pass
first_pass: pass
source: verifier
evidence: config.schema.json:34 values [none,builtin] default builtin; templates/config.json:22 and .planning/config.json:22 both read builtin.

### 6. Test suite passes including recall tests
expected: node --test over cadence-core/bin/*.test.mjs passes, including new recall tests for ranking, empty corpus, and determinism.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> pass 142 fail 0; bm25.test.mjs 6 tests, planning.test.mjs recall tests at 888/905/918/933.

### 7. self-verify clean with recall contract, prose corrected
expected: self-verify.mjs exits 0 with a recall CONTRACTS entry present, and README / config.md / cad-capture SKILL.md no longer claim only none is wired.
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs -> ok:true problems:[] exit 0; recall:[] at :49; prose grep for 'only none' empty; config.md:93, README.md:115-117, cad-capture SKILL.md all describe active builtin.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
