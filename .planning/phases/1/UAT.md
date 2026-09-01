---
status: testing
phase: 1
fields_version: 1
started: 2026-09-01
updated: 2026-09-01
---

## Items

### 1. Phase-sized /cad-task stops without a branch question
expected: In cadence-core/workflows/task.md the scope step opens before git_guard, and the guard is scoped to the inline and planned arms - so a description that classifies as phase-sized reaches its stop with no protected-branch or integration-branch prompt.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: task.md orders scope :21 < git_guard :60 < bracket :71, one git_guard step only, and its body scopes itself to 'Inline and planned scope only', naming the too-big arm as reaching no commit. PHS-03 prose tests (prose-agreement.test.mjs:3519) pass by name.

### 2. Treeless phase-sized arm names the two starting doors
expected: task.md's '- **Too big**' arm branches on planning.mjs status: on no-planning-dir it names /cad-adopt and /cad-new-project, and does not offer /cad-phase add.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: task.md:41-53 is the `no-planning-dir` branch: it forbids `total + 1`, names /cad-adopt and /cad-new-project, and never /cad-phase add. The seam really answers that reason - status --dir on a missing .planning returns {"ok":false,"reason":"no-planning-dir"} (status.mjs:131). prose-agreement.test.mjs:3545 slices that branch alone and passes.

### 3. /cad-plan --gaps writes the next free plan number
expected: plan-gaps.md writes PLAN-2.md on a phase that already has PLAN.md, leaving PLAN.md and its report byte-identical.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Executed on a scratch fixture (.planning/phases/1/ holding PLAN.md + reports/plan-1.md reading PLAN COMPLETE). Applied plan-gaps.md step 3 verbatim: `ls .planning/phases/1/PLAN*.md` -> PLAN.md alone, next free number 2, wrote PLAN-2.md. sha256 of PLAN.md (642dd0e9...) and reports/plan-1.md (cf88d81f...) identical before and after. `planning.mjs replay-check --phase 1` on the fixture returned dispatch_set:["PLAN-2.md"] with PLAN.md complete:true - so the new plan is the one the seam dispatches and the existing plan is not re-run. The instruction that produces this filename is carried at plan-gaps.md:17-40, plan.md:185 and cad-planner-contract/SKILL.md:192 (verifier-confirmed); what the fixture executed is the rule those state, not a live planner dispatch.

### 4. An unexecuted gap plan beside a SUMMARY routes to /cad-execute
expected: progress.md's route table sends an executed phase whose outstanding set names plans to /cad-execute {N}, and a fixture test pins that case.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: progress.md:196 routes an executed phase whose `outstanding` names plans to /cad-execute {N}; planning-status.test.mjs:472 pins the SUMMARY + PLAN.md + PLAN-2.md fixture at status 'executed' with outstanding [{phase:1,plans:['PLAN-2.md']}], and prose-agreement.test.mjs:1540 pins the row. Both pass by name.

### 5. An empty outstanding set still routes to /cad-verify
expected: An executed phase with outstanding [] routes to /cad-verify {N} - the new row narrows the executed row rather than inverting it.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: The outstanding row at progress.md:196 is conditional and the unchanged /cad-verify row sits directly below at :197; prose-agreement.test.mjs:1562-1576 asserts it narrows rather than replaces. Live status on this repo: phase 1 'executed' with outstanding [], which reaches the /cad-verify row.

### 6. status carries outstanding on every call
expected: planning.mjs status always emits the outstanding key, [] rather than absent when nothing is outstanding, and CURSOR_STATUSES gained no new value.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: status.mjs:308-318 spreads `outstanding` into the file's only ok() emission; live call prints []; planning-status.test.mjs:490-493 pins presence in the empty state and :496 pins deep-equality with replay-check's dispatch_set off the shared core.mjs:357 reader. CURSOR_STATUSES unchanged (empty git diff on planning-files.mjs) and newly pinned at planning-files.test.mjs:2456.

### 7. Auto-resume claims restated and budgets clean
expected: The five auto-resume sites describe an offer rather than an automatic resume, DOCS-CLAIMS.md's README-32 row carries the corrected line and verdict, and node cadence-core/bin/self-verify.mjs reports no budget-overrun.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: All five sites read as an offer and the auto-resume grep over README.md, skills, cadence-core and DOCS-CLAIMS.md exits 1 with no output; DOCS-CLAIMS.md:551 carries line 49, the rewritten claim, verdict stale and the corrected- resolution; self-verify returns problems:[] and each re-pinned budget equals wc -c exactly.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
