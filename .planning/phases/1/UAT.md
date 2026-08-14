---
status: testing
phase: 1
fields_version: 1
started: 2026-08-14
updated: 2026-08-14
---

## Items

### 1. Captured bullet is recallable same-session
expected: A bullet written through `planning.mjs capture` lands inside the recall walk and `planning.mjs recall` returns it in the same session; the pinning test FAILS when the bullet is redirected to a section outside the walk (e.g. ## Archive).
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live scratchpad round trip (capture -> recall returns the bullet with phase:2; Archive bullet not returned) plus named tests planning.test.mjs:4219/:4240 passing in the 1702-test suite run.

### 2. Phase-tag reader admits all three tagged shapes
expected: The tag reader emits phase N for `(phase N)`, `(vX.Y.Z phase N)` and `(phase N, <label>)`; `references/capture-grammar.md` lists every admitted and out-of-grammar shape, and there is one test row per listed shape.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: CAPTURE_PHASE_TAG planning-files.mjs:704; CAPTURE_TAG_ROWS 23 rows with loop at planning-files.test.mjs:1673, all passing; capture-grammar.md lists every admitted and out-of-grammar shape and names the table.

### 3. Non-phase labels survive as content
expected: A bullet whose leading parenthetical is `(cadence-wide)` or `(tooling)` is indexed with that label still in its text and no phase emitted - one test row per case.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Rows at planning-files.test.mjs:1655-1658 assert phase absent AND '(cadence-wide)'/'(tooling)' still in the indexed text; both pass.

### 4. /cad-health names out-of-walk sections with counts
expected: `planning.mjs capture-sections` (surfaced by /cad-health) names every CAPTURE.md section outside the recall walk with its bullet count (Archive 185, Debt markers 1 at baseline), and appending a bullet to an out-of-walk section raises that section's reported count on the next run.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Live run: Archive 185, Debt markers 1, in_walk:false, no allowlist in captureSections (planning-files.mjs:785); scratchpad append raised Archive 1->2 on the next run; /cad-health SKILL.md:41 wires the call.

### 5. Concurrent appends never silently lose a bullet
expected: Two writers appending concurrently to one CAPTURE.md either both land, or the loser gets a non-silent `write-lost` return; the interleaving test (20 concurrent CLI writers) passes with zero lost bullets.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: capture-file.test.mjs rows at :276/:294/:305/:319 pass (20 writers zero lost; held lock refuses non-silently, byte-identical file); write-lost return at capture-file.mjs:380 surfaced as ok:false and reported by SKILL.md:55/execute.md:387. Note: the write-lost arm specifically has no deterministic test (recorded SUMMARY open item).

### 6. Test suite and budget checks green
expected: `node --test cadence-core/bin/*.test.mjs` passes and `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface` and no `budget-overrun`.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: 1702/1702 tests pass; self-verify problems:[] - no unbudgeted-surface, no budget-overrun, no unknown-subcommand.

### 7. /cad-health prints the out-of-walk note in a real session
expected: Running /cad-health in a live session prints the capture note naming Archive and Debt markers as out-of-walk sections (human-verify: needs a real /cad-health session walk).
status: pass
first_pass: pass
source: model
evidence: Live /cad-health run in this session (2026-08-14): the report printed the capture note naming out-of-walk sections with counts - Archive 185, Debt markers 1 (in-walk Todos 192, Seeds 6, Notes 3)

### 8. Run /cad-health in this repo and confirm the report prints the capture note naming Archive and Debt markers with their counts
expected: One line per out-of-walk section (Archive 185, Debt markers 1 at current baseline; live Todos is 192) framed as a named note, present on every run
origin: verifier
why_human: UAT item 7 is marked human-verify by the phase itself: the truth is what a live /cad-health session renders from the skill prose, which is model-interpreted at session time - no repo command exercises the prose-to-output step. The seam half (capture-sections output) is already machine-proved.
status: pass
first_pass: pass
source: model
evidence: Same live /cad-health run: one line per out-of-walk section rendered from the skill prose (Archive 185, Debt markers 1; live Todos 192), duplicate of item 7

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
