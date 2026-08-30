---
status: testing
phase: 5
fields_version: 1
started: 2026-08-30
updated: 2026-08-30
---

## Items

### 1. A racing writer's event survives a second rotation
expected: The new contended-second-rotation row in cadence-core/bin/trace.test.mjs and its twin in cadence-core/bin/read-trace.test.mjs both pass: the racing writer's event is in exactly one of the live record or the rotated sibling, never in neither.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Pre-phase library reproduces the loss (trace row: AssertionError 'the racing writer's event is in NEITHER file'; reads probe: live=0 sibling=0). Shipped: trace.test.mjs:636 and read-trace.test.mjs:236 both pass, reads probe gives live=1 sibling=0 - exactly one copy, in the file readers read.

### 2. A near-bound event never leaves the fresh record over its bound
expected: With a pending event of MAX_TRACE_BYTES - 8 bytes (and MAX_READS_BYTES - 8 for reads), the live record's size after the rotation's first write is at or below its bound. Pre-fix it was 105 B and 74 B over.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: MAX-8 pending line through the real appenders: pre-fix 246 B over MAX_TRACE_BYTES and 74 B over MAX_READS_BYTES; shipped refuses with oversized-event / oversized-record, record byte-identical at MAX-1 and nothing rotated. The 'does fit beside the marker' rows still pass, so the reserve did not over-tighten.

### 3. A writer that claims during a leftover eviction keeps its event
expected: A writer that claims the live file after a leftover-generation eviction has already started still finds its event in the live record afterward. One test row per record covers this arm.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Undatable-sidecar fixture on both records: pre-fix the trace row fails with 'the generation was destroyed by an eviction that could not confirm its claim' and the reads probe reports generation-intact=false; shipped keeps the generation, lands the writer's own event in the live record, and leaves no .evict temp.

### 4. Both seams still report the rotation and never bill the reads marker
expected: After a second rotation, `node cadence-core/bin/planning.mjs reads` and `node cadence-core/bin/planning.mjs trace suggest` each still report the rotation on their own key, and the reads marker appears in none of calls, byAgent, or the unresolved/coordinator split.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Real CLI on a doubly-rotated root: `planning.mjs reads` reports rotated.file=reads.1.jsonl with calls 1, byAgent [[coordinator,1]], and `reads --join` unresolved 0 / coordinator 1; `planning.mjs trace suggest` reports rotated.file=trace.1.jsonl. No carried_bytes in any envelope.

### 5. The whole suite and self-verify are green
expected: `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs` reports ok:true.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: test.mjs exit 0 with tests 3638 / pass 3638 / fail 0; self-verify.mjs {"ok":true,"problems":[]}. cadence-core working tree clean.

### 6. A generation whose marker carries no seal is destroyed with nothing stated
expected: behavior wrong - the goal's second clause ('or the shortfall is stated') does not hold on the no-seal arm. Where the leftover generation was sealed by pre-phase code (a v3.7.7 marker has no carried_bytes) or by a corrupt marker line, no rescue runs, the generation is unlinked, and the rotation returns a clean {rotated: true}. Measured: a racing record in that generation ends up in NEITHER file with no shortfall reported.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 9ab6e8a0 (`else shortfall = null;` at lib/trace.mjs and lib/read-trace.mjs, on the arm that had no else). Retest: `node --test cadence-core/bin/read-trace.test.mjs cadence-core/bin/trace.test.mjs | grep -i 'NO seal'` -> both new rows pass ('a generation whose marker carries NO seal states an UNKNOWN shortfall, not silence'; 'rotateTrace: a generation whose marker carries NO seal states an UNKNOWN shortfall'). Reproduction-proved: with the two `else` clauses stripped and nothing else changed, both rows FAIL with `AssertionError: the generation was destroyed with nothing stated at all / false !== true`. Whole suite after the fix: `node cadence-core/bin/test.mjs` tests 3640 / pass 3640 / fail 0 (was 3638, +2 new rows); `node cadence-core/bin/self-verify.mjs` {"ok":true,"problems":[]}; `npx tsc -p tsconfig.ci.json` exit 0. Blocking risk_surface review fired on the staged diff (openai/gpt-5.6-terra, balanced, effort medium): findings [].
reported: behavior wrong - the goal's second clause ('or the shortfall is stated') does not hold on the no-seal arm. Where the leftover generation was sealed by pre-phase code (a v3.7.7 marker has no carried_bytes) or by a corrupt marker line, no rescue runs, the generation is unlinked, and the rotation returns a clean {rotated: true}. Measured: a racing record in that generation ends up in NEITHER file with no shortfall reported.
severity: minor
cause: Both no-seal arms are an `if` with no `else`. `cadence-core/bin/lib/trace.mjs:1027` (`if (sealed !== null) {`) and `cadence-core/bin/lib/read-trace.mjs:869` (`if (at !== null) {`) leave `shortfall` at `undefined` when the leftover generation's marker carries no readable `carried_bytes`, so the shared return `shortfall === undefined ? { rotated: true } : ...` (trace.mjs:1056, read-trace.mjs:898) emits a clean `{rotated: true}`. Every other failure arm inside those blocks does state a value, including `shortfall = null` where even the stat fails, so the no-seal arm is the one path that says nothing. The generation is unlinked regardless, so a racing record in it is lost with no field a reader could learn the shortfall from. Fix: add the missing `else shortfall = null;` to both, matching the already-documented meaning of null ('cut by an unknown amount'), plus one test row per record asserting `shortfall === null` for a marker with no `carried_bytes`.
fix: 9ab6e8a0, retest

## Summary

total: 6
passed: 6
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
