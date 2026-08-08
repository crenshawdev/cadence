---
status: testing
phase: 2
fields_version: 1
started: 2026-08-08
updated: 2026-08-08
---

## Items

### 1. weight.mjs resident composes command and role bytes
expected: `node cadence-core/bin/weight.mjs resident --command cad-land` returns eagerBytes and reachableBytes, and `--role cad-executor` returns dispatch bytes (agent file + preloaded contract skills). Both equal a hand `wc -c` sum over the same file lists the envelope names.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: cad-land eager 17934 = 11488+6446 and reachable 59304 = the six listed files, hand-summed with wc -c; cad-executor 13049 = 424+12625 and 13036 = 411+12625. 20/20 in cadence-core/bin/weight.test.mjs pass.

### 2. weight.mjs is contracted in self-verify
expected: `self-verify` returns ok:true with a CONTRACTS entry for weight.mjs; deleting that entry makes self-verify REPORT it rather than passing silently.
criterion: AC2
status: pass
first_pass: fail
source: verifier
evidence: Deleting the weight.mjs CONTRACTS row now returns ok:false with uncontracted-script naming cadence-core/bin/weight.mjs; restoring it returns ok:true. Fixed by 3b7c3c4 (check 14).
reported: behavior wrong - the criterion's second clause does not hold: deleting the CONTRACTS entry does NOT make self-verify report it. self-verify.mjs:469-470 skips any script absent from CONTRACTS (`if (!contract) continue`), so removing the entry returns ok:true with zero problems.
severity: major
cause: self-verify.mjs:469-470 does 'if (!contract) continue', so a script absent from CONTRACTS opts OUT of check 2 rather than being reported. Nothing asserts that every script under cadence-core/bin carries a row, so deleting weight.mjs's row is a silent opt-out, not a problem.
fix: 3b7c3c4, retest

### 3. cad-land eager bytes fall below the workhorse mean
expected: `weight.mjs resident --command cad-land` reports eagerBytes strictly below the mean of cad-execute, cad-plan and cad-verify eager bytes (17,934 vs 20,530.33), with both the before (32,676) and after numbers committed in MEASUREMENTS.md.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: 17934 < 20530.33; mean recomputed from hand-summed 25017/16438/20136. Before 32676 reproduced by running the seam from a git archive of 01d220a; both numbers committed at MEASUREMENTS.md:44 and :131.

### 4. cad-plan-review eager bytes drop by the full include
expected: `weight.mjs resident --command cad-plan-review` reports an eager drop of at least 15,134 B against the recorded before (17,511 -> 2,353, a 15,158 B drop).
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: 17511 (2377 at 01d220a + 15134) -> 2353 live = -15158, at or above the 15134 B review-triggers.md include (wc -c confirms 15134). No @-include line remains in the skill.

### 5. A de-preloaded reference cannot lose its Read
expected: self-verify check 13 reports zero de-preloaded references missing a Read instruction, and self-verify returns ok:true. Deleting a Read sentence for a registered row makes it report deferred-read-unread.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: self-verify ok:true with deferred-reads among 18 checks, zero problems; on a throwaway copy, replacing cad-land step 3's 'Read' with 'Consult' fires deferred-read-unread '0 of 1'. See gap on step-scoping for the limit of this guarantee.

### 6. MEASUREMENTS.md records before and after and reproduces
expected: .planning/phases/2/MEASUREMENTS.md holds before and after eager AND reachable bytes for cad-land, cad-plan-review, cad-execute, cad-plan and cad-verify, plus dispatch bytes per role, with the zero-resident references marked. Re-running the command it records reproduces the after bytes EXACTLY.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: All 23 command rows and 19 agent rows of both the Before and After tables diffed programmatically against live runs (After at HEAD, Before from a git archive of 01d220a): zero mismatches. Zero-resident 26095 B over three files matches the seam's own zeroResident output.

### 7. Roadmap and requirements read the re-scoped scope
expected: ROADMAP phase 2's success criteria and REQUIREMENTS' CTX-01 row read the re-scoped scope, CTX-02 sits outside ### Active carrying its deferral reason, and `/cad-audit` reports zero unserved Active requirements.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: ROADMAP.md:99-111 re-scoped with D-01/02/03/06 cited; REQUIREMENTS.md:58 CTX-01 re-scoped; CTX-02 at :153 under ## Deferred with its reason; planning.mjs audit ok:true, CTX-01 served by phases/2/PLAN.md, and each of the nine unpicked ids has a ROADMAP phase.

### 8. The break-even rule states its size term
expected: cadence-core/references/seams.md's deferral rule names a size term, names `weight.mjs resident` as the decider, names references/git-guard.md as the multi-step case that stays eager, and scopes the inline bytes-and-count requirement to deferrals made from that sentence forward.
status: pass
first_pass: pass
source: verifier
evidence: seams.md:229-243 carries all four required clauses: the size term, weight.mjs resident as the decider, git-guard.md as the multi-step stays-eager case, and the inline bytes-and-count requirement scoped to deferrals made from that sentence forward.

### 9. Check 13 counts Read sentences file-wide, so a step's own Read can be deleted while the check stays green
expected: behavior wrong - AC5 requires the Read to be present 'at the step that needs' the reference, and lib/deferred-reads.mjs:24-33 claims the sentence unit protects 'each arm's own sentence', but the counting at :145-146 is over the whole file with no step or arm scoping.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: check 13 returns [] on the live tree; the reproduced relocation (step 4(b) Read deleted, equivalent sentence moved into <guardrails>, file-wide count unchanged) now returns deferred-read-unread naming 4(b), 1 of 2 anchors satisfied. Fixed by 6a84f32.
reported: behavior wrong - AC5 requires the Read to be present 'at the step that needs' the reference, and lib/deferred-reads.mjs:24-33 claims the sentence unit protects 'each arm's own sentence', but the counting at :145-146 is over the whole file with no step or arm scoping.
severity: major
cause: lib/deferred-reads.mjs:145-146 counts qualifying Read sentences across the WHOLE file with no step or arm scoping, while the module header at :24-33 claims the sentence unit protects 'each arm's own sentence'. Any compensating sentence anywhere in the file keeps found === read_paragraphs, so a step's real Read can be deleted and check 13 stays green.
fix: 6a84f32, retest

### 10. weight.mjs falls back to its own tree on a valueless --root
expected: behavior wrong - a caller passing an unset variable gets the Cadence repo's numbers with ok:true instead of an error.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: weight.mjs --root with no value returns {ok:false,reason:missing-flag-value,detail:--root}; an absent --root still defaults. Fixed by dec9960, 5 tests.
reported: behavior wrong - a caller passing an unset variable gets the Cadence repo's numbers with ok:true instead of an error.
severity: minor
cause: weight.mjs:39 'flagValue(argv,"--root") || join(HERE,"..","..")' cannot distinguish an ABSENT --root from one present with an empty value, so both take the plugin-tree fallback. Pre-292b599 the valueless form returned ok:false/internal.
fix: dec9960, retest

### 11. MEASUREMENTS.md cites evidence that does not reproduce (`orphans` null)
expected: behavior wrong (documentation) - the recorded audit evidence names a key the envelope never emits.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: MEASUREMENTS.md:254-257 now states NO orphans key at all and cites planning.mjs:934; live audit hasOwnProperty('orphans') is false. Fixed by 71ba0ff.
reported: behavior wrong (documentation) - the recorded audit evidence names a key the envelope never emits.
severity: cosmetic
cause: planning.mjs:934 spreads the 'orphans' key only when non-empty, so a clean audit envelope OMITS it. MEASUREMENTS.md records the evidence as 'orphans null', which the envelope never emits.
fix: 71ba0ff, retest

## Summary

total: 11
passed: 11
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 4
