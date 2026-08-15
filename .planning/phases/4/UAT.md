---
status: testing
phase: 4
fields_version: 1
started: 2026-08-15
updated: 2026-08-15
---

## Items

### 1. criteria-size counts the ceilings
expected: `criteria-size` reports a CONTEXT `## Acceptance criteria` count against 3-7 and a ROADMAP per-phase `Success criteria:` count against 2-5, admitting both heading spellings (`**Success Criteria:**` and bare `Success criteria:`); a surface that declared no criteria reports `*_found:false` with `within: null`, never a pass.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Seam run four ways: phase 4 within:true on all four bounds; phase 2 reports roadmap-criteria-too-many (6 > 5); phase 6 reports roadmap_found:false with compared:[] and within:null, never a pass; no-flag run compares nothing. Wired at context.md:353 (3-7), new-project.md:305 and adopt.md:200 (2-5). One test row per heading spelling: planning-files.test.mjs:707 and :712.

### 2. trace close replaces the restated prose
expected: `planning.mjs trace close` writes the return/checkpoint terminal, all eight prose files call it instead of a raw `trace append --event return`, and `trace.test.mjs`'s BRACKETING census reddens if a raw terminal append is put back in any of them.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: `trace close` writes event:return without --detail and event:checkpoint with it (run on a temp trace file). Zero raw `trace append --event return|checkpoint` invocations remain anywhere under cadence-core/, skills/ or agents/. BRACKETING carries all eight rows (trace.test.mjs:1100-1109) and asserts close count EQUALS dispatch count plus zero raw terminals. Mutation-proved: putting one raw terminal append back into verify-deep.md turns the file red (83 pass / 1 fail) with the census's own message.

### 3. trace render's default is bounded
expected: `trace render` default response carries no `events` array and is at least 3x smaller than 36,916 B for `--phase 3`, while still carrying every `outcome` event and one row per dispatch/return bracket - the triage-gate `rearm` lookup still finds its event in the default response. The full array is behind an explicit flag with a CONTRACTS row.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Re-measured 9,890 B default vs 36,916 B with --events = 3.73x (>= 3x). No `events` key in the default. Every outcome carried: 15 outcome-family events in the full payload, 15 rows in the default `outcomes` array, `rearm` among them; 31 bracket rows. CONTRACTS row self-verify.mjs:275 declares ['--phase','--events'] and self-verify reports 0 problems.

### 4. the two round-trips are batched and pinned
expected: `context.md` reads `memory.backend` and `planning.commit_docs` in one call, `plan.md` issues `seed-reqs` and `cursor set` in one message, and a census test asserts the per-workflow seam-invocation count for both files, reddening when a call is added back.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: context.md:85-86 is one wrapped `config.mjs get` over both keys; plan.md:358-369 issues seed-reqs and cursor set in ONE message. seam-calls.test.mjs pins context.md=6, plan.md=9 with derived (not baselined) arithmetic and a counter-not-dead test. Mutation-proved: adding a second config.mjs get to context.md reddens the row. Note for phases 5-6: ROADMAP's 'the count drops' holds for plan.md (11->9) but is FLAT for context.md (6->6), as SUMMARY discloses.

### 5. a read joins to the bracket that caused it
expected: A `reads.jsonl` record joins to its `trace.jsonl` bracket by role normalization and timestamp containment, proved on committed fixtures including the overlapping same-role case which reports `ambiguous` rather than picking a bracket. The unjoinable floor (host `fork` / `general-purpose`) is reported as a count, and `report.md`'s "no phase scoping and no flag" prose plus the `reads: []` CONTRACTS row both moved with the new flag.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Committed fixtures cadence-core/bin/fixtures/join.{reads,trace}.jsonl drive the real seam; read-trace.test.mjs:592 fixes all 8 records as a partition (joined 2, ambiguous 1, unjoined 2, floor 2, coordinator 1, unresolved 0), with the overlapping same-role case pinned to 'ambiguous' at :494-497. Live `reads --join`: joined 1391 / ambiguous 85 / unjoined 12 / floor 553. CONTRACTS row now `reads: ['--join']` (self-verify.mjs:246); report.md:22,33 carries the flag and the stale 'no phase scoping and no flag' sentence is gone from shipped prose.

### 6. the executor is handed its risk surfaces
expected: A `cad-executor` dispatch carries `route.mjs resolve`'s answered `surfaces` into the executor's prompt, the executor contract states what the executor does with them, and a test asserts this on the dispatch payload.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: execute.md:168-171 puts the resolved `surfaces` on the dispatch prompt's stable half and states the surfaces_answered:false meaning; SKILL.md:19-23 states the use and that it is not a halt condition; prose-agreement.test.mjs asserts both against the sliced execute_sequential prompt and refuses an invented category. execute-parallel.md:15 makes the parallel path inherit the same prompt.

### 7. the suite and self-verify are clean
expected: `node --test cadence-core/bin/*.test.mjs` passes, and `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`, `budget-overrun`, `unknown-flag`, or config-key failure.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node --test cadence-core/bin/*.test.mjs` exit 0, 1790 pass / 0 fail (SUMMARY's figure re-measured). `self-verify.mjs` -> ok:true, problems:[] over 21 checks. `npx tsc -p tsconfig.ci.json` silent.

### 8. criteria-size mis-counts a roadmap phase that shows a fenced criteria example
expected: behavior wrong - phaseCriteria is fence-blind, so numbered items inside a ``` block are counted as the phase's own criteria and a compliant phase is reported out of range
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fix 07ab7b9 retested. The verifier's exact repro (2-item real list + fenced 6-item example) now returns {found:true,count:2}, was 8. Nested-fence case {found:false,count:0}. Two test rows added at planning-files.test.mjs. Suite 1792 pass / 0 fail; self-verify problems []. No masked true positive: criteria-size still reports phase 2 at 6 > ceiling 5.
reported: behavior wrong - phaseCriteria is fence-blind, so numbered items inside a ``` block are counted as the phase's own criteria and a compliant phase is reported out of range
severity: minor
cause: phaseCriteria (planning-files.mjs:437) slices the phase block and counts CRITERIA_ITEM_G over the raw slice with no fenceScanner - both the CRITERIA_HEADING match and the item count are fence-blind, so a fenced criteria example inside a phase block inflates the count (and a fenced heading above a real one wins the match). Every other reader in this file already runs fenceScanner(); phase 3's D-02 scoped roadmap paths out and AC1 shipped on that exemption.
fix: 07ab7b9, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
