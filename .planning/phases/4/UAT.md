---
status: testing
phase: 4
fields_version: 1
started: 2026-08-22
updated: 2026-08-22
---

## Items

### 1. trace suggest opens .planning/reads.jsonl and produces an over-threshold entry on this repo's own record
expected: `node cadence-core/bin/planning.mjs trace suggest` returns an entry whose subject is `cad-executor` carrying its in-dispatch re-read ratio, drawn from the live reads record and not from trace.jsonl alone.
status: pass
first_pass: pass
source: verifier
evidence: Live `trace suggest` returns the cad-executor info entry at 3.64 over 79 dispatches, fed by readReadsRecords -> joinReads -> inDispatchReads at planning.mjs:3784; the no-reads and stripped-files fixtures yield no entry, so the record is genuinely the source.

### 2. The threshold is per role, not one global ratio
expected: `cad-executor` (3.64) and `cad-verifier` (2.05) can produce the entry; `cad-planner` (1.88), `cad-assumptions-analyzer` (1.78) and `cad-reviewer` (1.74) cannot, whatever ratio the record shows. A test pins both arms.
status: pass
first_pass: pass
source: verifier
evidence: Frozen IN_DISPATCH_FLOORS (cad-executor 3.00, cad-verifier 2.00) gates by role; live run is silent for cad-planner 1.86, cad-assumptions-analyzer 1.78, cad-reviewer 1.66, and the test pins silence for those roles even at ratio 5.0.

### 3. The entry names the worst FILE and its count, not just the ratio
expected: The entry reads in the form "read `<path>` N times" - on this repository, `cadence-core/bin/planning.mjs` 29 times inside one dispatch.
status: pass
first_pass: pass
source: verifier
evidence: Live: 'read `cadence-core/bin/planning.mjs` 29 times (phase 5, plan 2)'; fixture test pins the same form at 7 times.

### 4. A null ratio produces no entry and is never rendered as zero
expected: A record with no file-carrying reads makes `trace suggest` emit nothing, and /cad-report's reading rule covers the live `calls > 0` case with a null ratio by saying nothing about it. Tests pin the null arm is not printed as 0.
status: pass
first_pass: pass
source: verifier
evidence: ratio is null (never 0) when summed distinct is 0; R7 skips it; tests assert no '0 opens per distinct file' anywhere, and report.md's third disposition for `calls > 0` with a null ratio is pinned by prose-agreement.test.mjs.

### 5. The entry states its own coverage and scope
expected: The evidence string itself names the file-carrying share of the joined reads it was computed over, and states that nothing prunes `.planning/reads.jsonl` at a close so an unscoped run spans every milestone in the file.
status: pass
first_pass: pass
source: verifier
evidence: 'Computed over 64% of the joined reads in scope, the share that recorded file paths' plus the unpruned-record SCOPE sentence, both inside the evidence string and both separately asserted.

### 6. coordinator reads are excluded with the reason stated in the output
expected: The entry names the count of excluded `coordinator` reads and says they carry no dispatch bracket by construction, so their re-reading cannot be attributed - stated in the output, not silently dropped.
status: pass
first_pass: pass
source: verifier
evidence: 'Excludes 4,503 coordinator read(s) carrying files: the main thread has no dispatch bracket by construction...' matching inDispatch.coordinatorFiles on `reads --join`.

### 7. The entry names NO config key and says so explicitly
expected: The entry states in words that no key in `config.schema.json` governs in-dispatch re-reading and names the discipline remedy instead; a test fails if it ever points at a key.
status: pass
first_pass: pass
source: verifier
evidence: action: null plus the 'No key in `config.schema.json` governs in-dispatch re-reading' sentence and the discipline remedy; SC7 pin test fails if a key is ever named.

### 8. One implementation behind both prose faces
expected: /cad-report's reading line and `trace suggest`'s entry come from the same per-role fold on the `reads --join` envelope; neither prose surface recomputes it.
status: pass
first_pass: pass
source: verifier
evidence: inDispatchReads has exactly two production callers (planning.mjs:3195 and :3784); report.md reads the inDispatch keys off `reads --join` and suggest.md relays the seam, both pinned by anchor-sliced prose-agreement arms.

### 9. reads --join carries inDispatch without disturbing its other arms
expected: `planning.mjs reads --join` returns an `inDispatch` key; the no-flag envelope and the `no reads recorded yet` arm are unchanged, asserted by test.
status: pass
first_pass: pass
source: verifier
evidence: Live envelopes differ only by the inDispatch key; tests assert its absence from the no-flag envelope and from the 'no reads recorded yet' arm, and the unreadable-file arm still returns ok:false read-failed while trace suggest warns.

### 10. The spike's throwaway measurement code is retired
expected: `.planning/spikes/read-set-redundancy/` holds `SPIKE.md` alone - both `measure*.mjs` deleted - and nothing in the tree references them.
status: pass
first_pass: pass
source: verifier
evidence: .planning/spikes/read-set-redundancy/ holds SPIKE.md alone; no code reference to measure.mjs or measure2.mjs remains anywhere in the tree.

### 11. self-verify is clean
expected: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array.
status: pass
first_pass: pass
source: verifier
evidence: ok:true with problems:[] over 24 checks, budgets included.

## Summary

total: 11
passed: 11
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
