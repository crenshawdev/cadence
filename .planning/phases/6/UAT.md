---
status: testing
phase: 6
fields_version: 1
started: 2026-08-25
updated: 2026-08-25
---

## Items

### 1. Seam-invocation census is registered
expected: grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs returns at least 1, and cadence-core/bin/lib/census-registry.mjs holds a row whose holder is that file with subjects cadence-core/workflows/plan.md and cadence-core/workflows/context.md
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs = 1 (marker at :139); row at cadence-core/bin/lib/census-registry.mjs:243-260, holder cadence-core/bin/seam-calls.test.mjs, subjects exactly cadence-core/workflows/plan.md and cadence-core/workflows/context.md. Wired end to end: a scratch PLAN declaring workflows/plan.md alone drives lease-check --plan-time to ok:false census-at-risk naming seam-call-counts with its counts and asserted_by, exit 1. Row, marker and header are one commit (ac01bcc7).

### 2. No unregistered census remains
expected: The census discovery arm reports no unregistered census, and .planning/phases/2/census-replay.md carries the new row's counts
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: census-registry.test.mjs 7/7 including the live-tree discovery arm. An independent replay of censusesAtRisk over all 56 PLAN files under .planning returned 48 declaring under cadence-core/bin/, bound 24, and per-entry counts identical to .planning/phases/2/census-replay.md row for row - seam-call-counts 9 (19%), worst entry planning-detail-sites 15 (31%), five entries at 0. Corpus figures 56/48/24 match the file's Corpus table.

### 3. Pre-correction D-05 header text is gone
expected: grep -c "deliberately absent from this table" cadence-core/bin/lib/census-registry.mjs returns 0
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: grep -c "deliberately absent from this table" cadence-core/bin/lib/census-registry.mjs = 0; the rewritten paragraph at :44-53 keeps the derived-number rule without the contradicting example.

### 4. check_census prose names every refusal
expected: workflows/plan.md's check_census names both new refusal outcomes instead of claiming census-at-risk alone, and self-verify.mjs reports no weight-budget overrun for plan.md
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/plan.md:331-345 names census-at-risk, unparsed-lease and empty-lease with the frontmatter-repair remedy distinguished from adding a file. wc -c plan.md = 33749 = weight-budgets.json:71; self-verify.mjs --root . reports problems [] so no budget-overrun.

### 5. Plan-time gate refuses an unreadable lease
expected: lease-check --plan-time returns ok:false against a PLAN whose frontmatter carries a garbage line and against a PLAN whose key is misspelled filez:, each naming its own reason token, each token carrying a hint
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live: garbage frontmatter line -> ok:false reason unparsed-lease with frontmatter_issues[{line:6,code:unknown-line}] and a hint, exit 1; filez: -> ok:false reason empty-lease, declared 0, with a hint, exit 1. Arms at cadence-core/bin/planning/lease-check.mjs:302-321, both above the censusesAtRisk call at :322.

### 6. A good plan still passes
expected: A PLAN that declares files and puts no census at risk still returns ok:true from lease-check --plan-time
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live: a PLAN declaring src/a.mjs returns {"ok":true,...,"declared":1} exit 0. Test arm at planning-lease-check.test.mjs:728-743 pins ok:true on both plan numbers of a two-plan fixture.

### 7. One fixture pins both gates on both signals
expected: A single fixture directory with two PLAN files pins plan-overlap emitting frontmatter_issues and undeclared, and lease-check --plan-time refusing on the same two; removing either half fails the test
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: planning-lease-check.test.mjs:699-727 - one directory, PLAN-1.md (garbage line) and PLAN-2.md (filez:); asserts plan-overlap's frontmatter_issues ['PLAN-1.md'] and undeclared ['PLAN-2.md'], and lease-check --plan-time refusing plan 1 unparsed-lease and plan 2 empty-lease, each with a hint and exit 1. Mutation-checked on a scratch copy at /tmp/cadmut with the repo untouched: dropping either arm alone, or both, turns that named test red; restoring makes it green.

### 8. Phase 2's UAT closes
expected: planning.mjs uat status --phase 2 reports result: complete - items 9 and 10 pass on retest and item 11 is recorded from a live /cad-plan run (human-verify: needs a live /cad-plan orchestrator run)
criterion: AC5
status: skipped
first_pass: fail
source: verifier
evidence: Ground truth: `node cadence-core/bin/planning.mjs uat status --phase 2` -> {"status":"testing","counts":{"pass":10,"fail":0,"pending":1,"skipped":0,"blocked":0},"result":"partial","first_pending":{"k":11,...}}. .planning/phases/2/UAT.md items 9 and 10 are `status: pass`, `source: verifier`, evidence naming ac01bcc7 / 3bf5264e / 6db19be9 / badcb33e; item 11 is `status: pending` with its why_human intact and byte-untouched (git diff ac01bcc7~1..HEAD over that file changes only items 9 and 10 and the summary counters). Conflicting texts: .planning/ROADMAP.md:319 vs .planning/phases/6/CONTEXT.md:179-181 (AC5) and :86-96 (D-05). .planning/phases/6/PLAN.md:64-66 and .planning/phases/6/SUMMARY.md:67-71 both already state the ROADMAP wording.
reported: behavior wrong - the item's own expected text is unsatisfiable and contradicts the criterion that governs this phase. It demands `uat status --phase 2` report `result: complete` with item 11 recorded from this phase's live /cad-plan run. ROADMAP.md phase 6 criterion 5 (line 319) demands the opposite: fail:0 with items 9 and 10 pass, item 11 STAYS pending and phase 2's UAT STAYS partial, because item 11 needs a planning run that genuinely under-declares and this phase's own run declared every holder. The ROADMAP is the contract and it is also the later text - CONTEXT.md landed 2026-08-25 14:15 (eb8698b8), the ROADMAP amendment 14:35 (6010920e) - so CONTEXT.md AC5 and its D-05 are superseded, and the UAT item was generated from the stale wording. Recording item 8 a pass as written would mean recording an observation nobody made; recording it a fail would punish the phase for obeying its governing criterion. The state on the ground satisfies the governing criterion in full.
severity: minor
cause: The item's expected text was generated from a superseded criterion. .planning/phases/6/CONTEXT.md AC5 (and its D-05) demand `uat status --phase 2` report `result: complete`; .planning/ROADMAP.md:319 criterion 5 demands the opposite - fail:0 with items 9 and 10 pass, item 11 STAYS pending and phase 2 STAYS partial. Confirmed by commit timestamps: CONTEXT.md landed at eb8698b8 2026-08-25 14:15:20 -0400, the ROADMAP amendment at 6010920e 14:35:29 -0400, twenty minutes later. The ROADMAP is both the governing contract and the later text, so CONTEXT AC5/D-05 are stale. PLAN.md:64-66 and SUMMARY.md:67-71 both already carry the ROADMAP wording. Ground truth measured live: uat status --phase 2 -> pass:10, fail:0, pending:1, result partial, first_pending item 11 - which satisfies the governing criterion exactly. No code defect. The defect is the stale CONTEXT text this checklist item was worded from.
fix: 714193e5, superseded criterion corrected
reason: Superseded. This item's `expected` was worded from CONTEXT.md's AC5, which demanded `uat status --phase 2` report `result: complete`. ROADMAP.md:319 criterion 5 governs phase 6 and demands the opposite - items 9 and 10 pass, item 11 STAYS pending, phase 2 STAYS partial - and it is also the later text (ROADMAP amendment 6010920e 14:35:29, CONTEXT.md eb8698b8 14:15:20). CONTEXT.md AC5, D-05 and the scope boundary were corrected to the governing wording at 714193e5. The governing criterion is MET on the ground and was measured live: `uat status --phase 2` -> pass 10, fail 0, pending 1, result partial, first_pending item 11. `uat` has no way to amend an item's `expected`, so this item cannot record `pass` against its own stale text; it is closed skipped rather than recorded as an observation nobody made. Item 11 is answered by a later /cad-plan run that genuinely under-declares.

### 9. Whole-tree gate is green
expected: node cadence-core/bin/test.mjs runs green, npx tsc -p tsconfig.ci.json exits 0, and self-verify.mjs --root . reports problems []
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3267 pass / 0 fail; npx tsc -p tsconfig.ci.json exit 0; self-verify.mjs --root . problems [] across all 27 checks. No unreferenced debt markers on the phase's touched files.

## Summary

total: 9
passed: 8
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 1
