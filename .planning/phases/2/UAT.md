---
status: testing
phase: 2
fields_version: 1
started: 2026-09-05
updated: 2026-09-05
---

## Items

### 1. Roles block decides model, effort and rung file
expected: A config naming only roles.cad-planner.model and roles.cad-planner.effort makes `node cadence-core/bin/route.mjs resolve --role cad-planner` return that model and that effort, and `agent` names that role's rung file for that effort.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live resolve on a roles-only scratch config returned model=haiku, effort=low, agent=cad-planner-low, model_source=roles.cad-planner.model, pinned=false; cad-planner-low is RUNG_FILES['cad-planner'].low (cadence-core/bin/lib/rung-agent.mjs:39). Read path traced: route.mjs:364-367 -> :280 -> :375-378 -> :1030 -> :1047 (rung) and :1407 (model). Named tests pass.

### 2. Stakes-only config unchanged across all eighteen cells
expected: A config carrying only `stakes` and no `roles` block resolves identically to HEAD across all eighteen cells, checked against the hand-written CELLS fixture in cadence-core/bin/route.test.mjs.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Pre-phase route.mjs (git archive of e4ec3976) vs current, 18 cells x 2 attempts = 36 envelopes, identical after dropping the new model_source key; 0 differing. Negative control with a roles block set differs as expected. 18 `stakes-only fallback` cases pass, each asserting the fixture file itself parses with no `roles` key (route.test.mjs:153).

### 3. Unknown model warns and stands
expected: A roles.<role>.model outside the four aliases resolves with ok: true, carries the routed cell's model in the envelope, and adds a warnings[] entry naming the rejected string.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live: roles.cad-verifier.model='gpt-5-turbo' -> ok:true, model=opus (cell), model_source=cell, warning names the rejected string. With model.overrides.cad-verifier='opus' also set, still model_source=cell and pinned=false - route.mjs:1410-1430 makes the pin branch unreachable once the roles key is present.

### 4. Roles block beats the older effort key, and says so
expected: A config setting both roles.cad-planner.effort and model.effort.cad-planner resolves to the roles value and emits a warnings[] entry naming which key won.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Live: roles.cad-planner.effort=max with model.effort.cad-planner=low -> effort=max, agent=cad-planner-max, warning 'roles.cad-planner.effort="max" (config) wins over model.effort.cad-planner="low" ... the roles block decides'. The deciding key is interpolated into all four rung arms and both retry reasons (route.mjs:1052-1054, :1069, :1072, :1094, :1107, :1161, :1171).

### 5. A raised risk floor clamps the roles effort
expected: With a raised risk floor, a roles.<role>.effort below the floored rung does not apply and `reason` names the raise.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Live scratch repo with a secrets-carrying declared file: roles.cad-plan-checker.effort=low resolved at stakes=shipped, effort=medium, with reason 'roles.cad-plan-checker.effort="low" does not apply: src/load.mjs touches secrets, and the raised shipped/cad-plan-checker cell's "medium" rung is the floor'. Clamp still gated on floor.raised (route.mjs:1090).

### 6. All twelve keys are reachable and self-verify is clean
expected: `node cadence-core/bin/config.mjs get` and `set` succeed for all twelve roles-block keys, and `node cadence-core/bin/self-verify.mjs` reports ok: true with no missing-reach-row, no inert-config-key and no unknown-config-key.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: config.mjs keys lists 12 roles.* keys; one get returns all twelve as null; one set writes all twelve; a bad rung is refused naming the role's set. self-verify.mjs -> ok:true, 0 problems, config-reach and effort-enums in the checked list. Drift guard proved live against the shipped schema: [] clean, and effort-enum-drift / unknown-effort-role / missing-effort-key each fire on the roles spelling when the schema is mutated in memory.

### 7. The block carries exactly model and effort
expected: `node cadence-core/bin/config.mjs validate` reports `unknown key` for roles.<role>.retry.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: config.mjs validate on a config with roles.cad-planner.retry -> ok:false, errors [{key: roles.cad-planner.retry, error: unknown key}], with the sibling model and effort leaves validating clean in the same call.

### 8. model_source names the key that decided
expected: Every resolve envelope carries a model_source field naming where the model came from - roles.<role>.model, model.overrides.<role>, or cell.
status: pass
first_pass: pass
source: verifier
evidence: All three values observed live in one run (cell / model.overrides.cad-verifier / roles.cad-executor.model), plus cell on a rejected roles string. Unconditional on the single ok:true exit at route.mjs:1501; the two ok:false exits (:936, :1008) carry no model either. pinned stays false on roles-decided dispatches, so the seam's pin-announcement rule (seam-spawn-agent.md:327-333) is unchanged.

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
