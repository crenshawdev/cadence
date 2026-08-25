---
status: testing
phase: 4
fields_version: 1
started: 2026-08-25
updated: 2026-08-25
---

## Items

### 1. A zero-padded phase directory is reported as grammar drift, and a legal one is not
expected: With phases/1.01, phases/1.00 and phases/2.0 on disk, `planning.mjs status` reports a phase-dir-grammar drift entry naming each, and names the legal directory it collides with when one is present. phases/1.1, phases/1.10 and phases/8 stay legal and produce no entry.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: Scratch tree phases/{1.00,1.01,2.0,1.1,1.10,8}; `planning.mjs status` -> exactly two phase-dir-grammar entries: [1.00,1.01] detail names phases/1.1, phases/1.10 as the phases they collide with, and [2.0] alone (no phases/2 on that tree). No entry names 1.1, 1.10 or 8.

### 2. The phase-directory grammar is stated once, in roadmap-phases.md
expected: cadence-core/references/roadmap-phases.md states the grammar including that 2.0 is not a legal spelling of phase 2; conventions.md no longer states it; a grep of the retired sentence across skills/, cadence-core/workflows/ and cadence-core/references/ returns exactly one hit, in roadmap-phases.md.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: grep -rn "no zero-padding" skills/ cadence-core/workflows/ cadence-core/references/ -> 1 hit, roadmap-phases.md:86. grep -rn "bare integer" -> 1 hit, roadmap-phases.md:84. grep -c "`2.0` is NOT a legal spelling" roadmap-phases.md -> 1. grep -c "no zero-padding|bare integer" conventions.md -> 0.

### 3. A padded directory beside its legal twin yields ONE phase-dir entry and no recall snippet
expected: On a tree holding both phases/8 and phases/08, `planning.mjs status` emits exactly ONE phase-dir drift entry carrying phase: 8, and `planning.mjs recall` returns no snippet sourced from phases/08/.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Scratch tree phases/8 + phases/08 with a SUMMARY under 08; `status` -> phase-dir entries: 1, phase: [8], dir: [8]. `recall zarquon` -> results sources [].

### 4. Every path-resolving --phase command refuses a colliding spelling and resolves a non-colliding one
expected: Against a tree holding phases/1.1/, `--phase 1.10` returns ok:false with a bad-args reason naming both fixes. Against a tree holding phases/1.10/ and no phases/1.1/, the same command resolves and acts on phases/1.10/.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: All 8 path-resolving faces (criteria-size, plan-size, plan-overlap, cite-count, lease-check, uat, deferred-carry, deferred-list) with --phase 1.10: against a tree holding phases/1.1/ each returns ok:false reason bad-args with a detail naming both fixes (retype the flag / rename the directory). Against a tree holding only phases/1.10/ none is blocked by spelling - cite-count and lease-check refuse for missing --payload/--plan in the synthetic fixture, which is past the spelling gate.

### 5. The two identity-WRITING faces refuse a lossy spelling whatever is on disk, and capture stays exempt
expected: `cursor set --phase 1.10` and `seed-reqs --phase 1.10` each return ok:false naming both fixes regardless of what is on disk, and `capture --phase 1.10` still writes the tag (phase 1.10).
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: cursor set --phase 1.10 and seed-reqs --phase 1.10 each return ok:false bad-args naming both fixes on BOTH trees (phases/1.1 present, and an empty phases/). capture --phase 1.10 --kind todo writes the tag (phase 1.10) on both trees - the D-08 exemption holds.

### 6. An unguarded path-resolving callsite fails the suite naming itself
expected: Adding a requirePhaseArg callsite that resolves a phases/<N>/ path without the tree-aware check fails `node cadence-core/bin/test.mjs` with a message naming that file and line. With the census row registered, planning-lease-check.test.mjs's half-the-plans rail still passes.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: Inserted an unguarded `requirePhaseArg(opts, "plan-size")` callsite resolving join(dir, phases, probe.raw) in cmdPlanSize. node --test phase-spelling.test.mjs -> FAIL naming [plan-size.mjs:67 (cmdPlanSize #2)] with the add-a-row remedy. Reverted; git diff --quiet clean. planning-lease-check.test.mjs half-the-plans replay rail: 29 pass 0 fail.

### 7. The whole-tree gate is green
expected: `node cadence-core/bin/test.mjs` runs green, `npx tsc -p tsconfig.ci.json` exits 0, and `cadence-core/bin/self-verify.mjs` reports problems [] - including the re-pinned weight-budgets.json entries.
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: node cadence-core/bin/test.mjs -> tests 3265, pass 3265, fail 0, exit 0. npx tsc -p tsconfig.ci.json exit 0. self-verify.mjs --root . -> ok true, problems []. weight-budgets.json re-pinned in 2 commits of this range (7fd1c28c, 0cbfe379).

### 8. Two legal names that parse to one number are reported as their own drift kind
expected: On a tree holding both phases/1.1 and phases/1.10, `planning.mjs status` emits a phase-dir-collision entry naming both, each phase-dir entry carries the directory name in dir, and neither name is reported as grammar drift.
status: pass
first_pass: pass
source: model
evidence: Scratch tree phases/1.1 + phases/1.10; `status` -> two phase-dir entries carrying dir 1.1 and 1.10, plus one phase-dir-collision entry entries [1.1,1.10] phase 1.1 detail "are different phases that both parse to 1.1". grammarDrift empty - neither legal name is reported as grammar drift.

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
