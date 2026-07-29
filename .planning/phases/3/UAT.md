---
status: testing
phase: 3
started: 2026-07-29
updated: 2026-07-29
---

## Items

### 1. The four-knob bundle for all 18 cells
expected: `node cadence-core/bin/route.mjs resolve --role <role>` returns model, effort, review and verify for all 18 (level, role) pairs, and cadence-core/bin/route.test.mjs carries one row per pair with literal expected values rather than values derived from the table under test
status: pass
first_pass: pass
source: verifier
evidence: Hermetic 36-resolution sweep (18 cells x attempts 1,2) matched CONTEXT.md:154-195 and route-table.json:15-52 with 0 mismatches; route.test.mjs:79-100 is a hand-typed CELLS array (comment :74-78 states it is never read from route-table.json), :106-121 builds one node:test case per cell (18 'cell <level>/<role>' lines). Mutation proof: setting cells.shipped[cad-verifier].effort=high turned the run red, restoring returned tests 52 / pass 52 / fail 0.

### 2. Retry rungs, held rungs, and escalate_to gone
expected: With --attempt 2 each cell resolves to the retry rung its grid row names and returns that rung's agent file; where retry equals the starting rung (level 3 analyzer and executor) the reason string says the rung was held; and escalate_to appears in no shipped .json, .mjs or .md - modulo the DESIGN.md history exception the SUMMARY flags for judgement
status: pass
first_pass: fail
reported: reword
severity: minor
cause: AC2 read literally fails: the retired vocabulary survives in DESIGN.md's superseded-decision record (6 lines, 2 in the 2026-07-28 bullets and 4 in the new 2026-07-29 marker). No live code, data, workflow, reference, agent or skill file matches; DESIGN.md ships, so the grep is not clean. Retry-rung and held-rung clauses both verified.
fix: 7674f4e, retest

### 3. 19 agent rung files, each budgeted and effort-matched
expected: agents/ holds the 19 files the grids name, each file's frontmatter effort equals the rung in its name, each has a weight-budgets.json entry, and `node cadence-core/bin/self-verify.mjs` names the cell when a grid names a rung with no file
status: pass
first_pass: pass
source: verifier
evidence: ls agents/ = 19 files; routableAgents = 19 stems with named-but-absent [] and on-disk-unreached []; all 19 frontmatter effort values equal the rung lib/rung-agent.mjs:36-68 assigns (incl. cad-assumptions-analyzer=xhigh, cad-plan-checker=low); all 19 weight-budgets.json entries exact-fit. Failing-capable proved twice on a git archive copy: deleting agents/cad-planner-max.md -> 'missing-rung-agent | critical/cad-planner: agents/cad-planner-max.md absent'; cells.solo[cad-executor].retry=max -> 'missing-rung-agent | solo/cad-executor: retry rung "max" maps to no agent file'.

### 4. self-verify fails on the four bad-value classes, naming the cell
expected: `node cadence-core/bin/self-verify.mjs` reports ok:false naming the offending cell for a model outside model_aliases, a rung outside rung_order, a gate outside off|advisory|blocking|adjudicated, and a trigger name config.schema.json does not define
status: pass
first_pass: pass
source: verifier
evidence: On a git archive copy (baseline ok:true, problems []): unknown-model | shipped/cad-planner: model "gpt-5" is not in model_aliases; unknown-rung | critical/cad-verifier: effort rung "turbo" is not in rung_order; unknown-gate | shipped/diff: gate "maybe" is not one of [off, advisory, blocking, adjudicated]; unknown-trigger | solo/security_scan: not a trigger config.schema.json defines. Each restored to ok:true. Rules at lib/route-cells.mjs:140-190, vocabulary from the schema at self-verify.mjs:589-595.

### 5. Model pins, no fable in cells, executor model from its own cells
expected: model.overrides.<role> replaces a cell's model and leaves its effort unchanged; no cell at any level holds fable; and cad-executor's model comes from its own cells (sonnet / opus / opus) rather than from a tier lookup
status: pass
first_pass: pass
source: verifier
evidence: Pin sweep (model.overrides.cad-planner=fable): solo/shipped/critical all returned model fable with effort and agent identical to the unpinned sweep (high/cad-planner, high/cad-planner, xhigh/cad-planner-xhigh), pinned:true. Routed vocabulary across all 18 cells = ['opus','sonnet']; fable cells [] and haiku cells [] while model_aliases still carries all four. Unpinned cad-executor = sonnet/opus/opus read at route.mjs:195 from cell.model; route-table.json:13 roles is a bare name array with no per-role model or tier. Pinned by route.test.mjs:132-158.

### 6. Config gate wins over the level gate, with a named warning
expected: A config whose review.triggers.<t>.gate disagrees with the level's gate resolves to the CONFIG value and emits one warning naming the trigger, the config value and the level value
status: pass
first_pass: pass
source: verifier
evidence: solo + diff:blocking -> review.diff="blocking", warnings = ["review.triggers.diff.gate=\"blocking\" (config) wins over the solo level gate \"off\""], exactly one entry naming all three, every other trigger still from the level. Agreement case (shipped + diff:advisory) -> warnings undefined. Two disagreements -> exactly two warnings, one each. route.mjs:178-187; pinned by route.test.mjs:193-216.

### 7. Green tree: tests, types, self-verify
expected: `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports ok:true with no budget overage and no unknown-config-key
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> exit 0, tests 852 / pass 852 / fail 0. npx tsc -p tsconfig.ci.json -> exit 0. node cadence-core/bin/self-verify.mjs -> {"ok":true,...,"problems":[]} with routing-cells in checked, so no budget overage and no unknown-config-key.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
