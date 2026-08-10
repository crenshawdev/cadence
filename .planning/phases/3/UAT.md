---
status: testing
phase: 3
fields_version: 1
started: 2026-08-10
updated: 2026-08-10
---

## Items

### 1. Green at every commit, not just the last
expected: self-verify returns ok:true problems:[] and the full test suite passes at each of the seven phase commits (6c021c6, e469382, 78ab7dc, 1416d6a, 4c384cf, d914c6b, 7a82c25), checked out one at a time - not only at HEAD.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: Throwaway worktree checked out at each of the 7 commits: self-verify ok:true problems:0 at all seven; node --test cadence-core/bin/*.test.mjs -> pass 1517/1518/1520/1521/1522/1523/1524, fail 0 at 6c021c6/e469382/78ab7dc/1416d6a/4c384cf/d914c6b/7a82c25 respectively.

### 2. /cad-config eager at or below 12,800 B with the catalog moved out
expected: weight.mjs resident prints /cad-config eagerBytes <= 12800; workflows/config.md holds no knob catalog table and no Type-key legend; references/config-catalog.md holds both; the 'never hand-validate against this table; call the seam' rule is still in config.md.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: weight.mjs resident: /cad-config eagerBytes 12770 (<= 12800). grep -c '^| `' workflows/config.md -> 0 and no Type-key legend; references/config-catalog.md -> 39 catalog rows plus the legend at :9. The hand-validate rule survives at workflows/config.md:71.

### 3. Six moves landed and the three eager holdouts stayed
expected: plan.md's BLOCKER revision, execute.md's execute_parallel body and cad-executor-contract's <worktree_mode> each live in their own reference; choose_path and handle_checkpoint are still inline in execute.md; context.md's output template is templates/CONTEXT.md; references/recall.md is read from context.md and debug.md while plan.md's two recall gates stay inline; trace.test.mjs's BRACKETING lists plan.md at 2, references/plan-revision.md at 2, execute.md unchanged at 1.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: All six references/templates exist on disk. execute.md:<step name=execute_parallel> is now a 6-line Read of references/execute-parallel.md; cad-executor-contract:151-153 Reads references/worktree-executor.md; context.md:293 Reads templates/CONTEXT.md; plan.md:266 Reads references/plan-revision.md. choose_path (execute.md:103) and handle_checkpoint (:271) are still inline steps. grep -rln 'references/recall.md' cadence-core/workflows/ -> debug.md and context.md only; plan.md keeps 5 memory.backend gate mentions inline. trace.test.mjs:728-735 BRACKETING: plan.md 2, references/plan-revision.md 2, execute.md 1.

### 4. Eleven register rows, each new one falsifiable
expected: DEFERRED_READS.length === 11; for each of the 7 new rows, deleting its Read sentence alone from a fixture yields exactly one deferred-read-unread naming that row; the live tree reports zero.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: DEFERRED_READS.length = 11 (4 shipped + 7 new, enumerated with their file/anchor). Live tree: self-verify problems filtered on /deferred/ -> []. deferred-reads.test.mjs:574 assertPromotedRow asserts BOTH halves per row - clean with the sentence, exactly one CODES.unread naming that file and anchor without it - and is called for all seven new rows at :586,590,597,601,607,614,621. node --test deferred-reads.test.mjs -> pass 31 fail 0.

### 5. Every new Read sentence states its bytes and consult sites, and CI notices when it lies
expected: Each new Read sentence carries the reference's measured byte count and its consult-site count; mutating any one of those figures to disagree with weight-budgets.json makes prose-agreement.test.mjs fail.
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: All 7 new Read sentences state bytes + consult-site count: config.md:54 (8,393 B), context.md:91 and :294, debug.md:90, plan.md:267, execute.md:327, cad-executor-contract:154. Falsified in a throwaway worktree at 7a82c25: 8,393->8,394 in config.md gives 'states 8,394 B for references/config-catalog.md, measured 8,393 B' (fail 1); reverted, then 1,392->1,393 in context.md gives the same shape for templates/CONTEXT.md (fail 1). CAVEAT recorded as a phase-3 open item: the coverage arm matches the word 'site' but never parses the COUNT, so a wrong consult-site number would pass.

### 6. Budget rows match disk and no config key is orphaned
expected: Every new reference and the new template has a weight-budgets.json row equal to its on-disk bytes; risk.override.<surface> and the three review.triggers.<t>.* keys are named in references/config-catalog.md; self-verify reports no config-key issue.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: All six new surfaces have a weight-budgets.json row equal to their on-disk bytes (config-catalog 8393, execute-parallel 4060, plan-revision 4360, recall 2169, worktree-executor 3038, templates/CONTEXT.md 1392 - each compared against fs.statSync). risk.override.<surface> at config-catalog.md:52 and the three review.triggers.<t>.{gate,tier,effort} rows at :63-65. self-verify problems filtered on /config|key|orphan|inert/ -> [].

### 7. /cad-config reads the catalog at walk step 2
expected: The catalog is read at the Interactive-menu walk, not carried from turn one. (human-verify: needs a live /cad-* run) Steps: 1. cd /data/code/cadence and reinstall the plugin from this branch, then /clear. 2. Run: /cad-config 3. Choose the interactive menu (no args) and page to walk step 2. 4. Expect: a Read of cadence-core/references/config-catalog.md appears in the transcript AT step 2 and nowhere earlier, and the knob descriptions it prints match that file.
criterion: AC7
status: skipped
reason: Needs the plugin reinstalled from this branch to observe the Read at its step; user declined to override the live Cadence install. Carried to CAPTURE for post-merge verification. Same disposition as phase 2's two human-verify items.

### 8. /cad-plan reads plan-revision.md only on the BLOCKER arm
expected: references/plan-revision.md is read when the checker returns a BLOCKER, and not read at all on a clean plan. (human-verify: needs a live /cad-* run) Steps: 1. cd /data/code/cadence, set workflow.plan_check true for this test: node cadence-core/bin/config.mjs set workflow.plan_check=true 2. Run /cad-plan on a throwaway phase whose plan the checker PASSES. 3. Expect: no Read of cadence-core/references/plan-revision.md anywhere in the transcript. 4. Run /cad-plan on a phase whose checker returns ## ISSUES FOUND with a BLOCKER. 5. Expect: a Read of cadence-core/references/plan-revision.md at the check_gate step, before the revision dispatch. 6. Restore: node cadence-core/bin/config.mjs set workflow.plan_check=false
criterion: AC7
status: skipped
reason: Needs the plugin reinstalled from this branch to observe the Read at its step; user declined to override the live Cadence install. Carried to CAPTURE for post-merge verification. Same disposition as phase 2's two human-verify items.

### 9. /cad-execute reads the parallel body only on the opt-in path, and the worktree rules only in worktree mode
expected: references/execute-parallel.md is read at execute_parallel and not on a sequential run; references/worktree-executor.md is read by an executor dispatched into a worktree and not by a sequential one. (human-verify: needs a live /cad-* run) Steps: 1. cd /data/code/cadence and run /cad-execute on a single-plan phase (sequential). 2. Expect: no Read of cadence-core/references/execute-parallel.md and no Read of cadence-core/references/worktree-executor.md in either the orchestrator or the executor transcript. 3. Run /cad-execute on a phase with 2+ non-overlapping plans, with parallelization.enabled true and the host's worktree.baseRef set to "head". 4. Expect: a Read of cadence-core/references/execute-parallel.md at choose_path's hand-off, and each worktree executor reading cadence-core/references/worktree-executor.md before its first commit.
criterion: AC7
status: skipped
reason: Needs the plugin reinstalled from this branch to observe the Read at its step; user declined to override the live Cadence install. Carried to CAPTURE for post-merge verification. Same disposition as phase 2's two human-verify items.

### 10. /cad-context reads the template at write_context and recall at analyze
expected: cadence-core/templates/CONTEXT.md is read at write_context and references/recall.md at analyze - each at its own step, neither on turn one. (human-verify: needs a live /cad-* run) Steps: 1. cd /data/code/cadence, confirm memory.backend is builtin: node cadence-core/bin/config.mjs get memory.backend 2. Run /cad-context on a throwaway phase. 3. Expect: a Read of cadence-core/references/recall.md at the analyze step, before the recall call. 4. Expect: a Read of cadence-core/templates/CONTEXT.md at write_context, and the CONTEXT.md it writes matching that template's shape. 5. Expect: neither file read on turn one.
criterion: AC7
status: skipped
reason: Needs the plugin reinstalled from this branch to observe the Read at its step; user declined to override the live Cadence install. Carried to CAPTURE for post-merge verification. Same disposition as phase 2's two human-verify items.

### 11. /cad-debug reads recall.md at Hypothesize
expected: references/recall.md is read at the Hypothesize step of a debug session, not on turn one. (human-verify: needs a live /cad-* run) Steps: 1. cd /data/code/cadence and run: /cad-debug on any small reproducible bug. 2. Advance to the Hypothesize step. 3. Expect: a Read of cadence-core/references/recall.md at that step, and the recalled results rendered in the shape that file defines. 4. Expect: no Read of it before Hypothesize.
criterion: AC7
status: skipped
reason: Needs the plugin reinstalled from this branch to observe the Read at its step; user declined to override the live Cadence install. Carried to CAPTURE for post-merge verification. Same disposition as phase 2's two human-verify items.

## Summary

total: 11
passed: 6
failed: 0
pending: 0
skipped: 5
blocked: 0
reworked: 0
