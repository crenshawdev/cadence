---
status: testing
phase: 2
fields_version: 1
started: 2026-08-26
updated: 2026-08-26
---

## Items

### 1. Rung bodies are byte-identical within a role
expected: For each of the six roles, every one of its rung files carries the same post-frontmatter body byte for byte - one distinct body per role across all 19 agent files.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Hashed post-frontmatter bytes of all 19 agents/*.md: 6 roles, 6 distinct bodies, one per role (executor 2 files, planner 3, reviewer 4, verifier 4, plan-checker 4, assumptions-analyzer 2). No 'Your rung is' or 'and your rung' anywhere under agents/, and no stale rung prose on any shipped surface repo-wide.

### 2. A one-byte divergence in a rung body is caught
expected: Changing a single rung file's body by one byte (a re-wrapped line break, same length) makes self-verify report ok:false with exactly one rung-prefix-split problem naming that file and its role; restoring the file returns ok:true.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live probe on a full copy of the tree: baseline self-verify ok:true problems:[]; re-wrapping one line break in agents/cad-executor-xhigh.md (387 B unchanged) gives ok:false with exactly one rung-prefix-split naming that file and cad-executor; restoring returns ok:true problems:[]. Rule lives in lib/rung-agent.mjs (rungPrefixIssues), wired as check 7d in self-verify.mjs and named rung-prefix in `checked`.

### 3. Routing is unmoved across all 18 cells
expected: route.mjs resolve returns the same agent, model and effort it did before the phase for all 18 (level, role) cells, and a test pins them so a future change fails.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: route.mjs, route-table.json, route.test.mjs, config.json and the RUNG_FILES table are all untouched by 167272d5..8ca0dfdc; route.test.mjs:79-131 pins all 18 cells as hand-written data with model, effort, agent and retry agent, and passes 160/160 at HEAD. Live resolve returns agent/model/effort per role.

### 4. The plan checker learns its rung from the dispatch prompt
expected: skills/cad-plan-checker-contract/SKILL.md no longer tells the agent that its agent file names its rung, and both dispatch sites (workflows/plan.md check_gate and references/plan-revision.md step 2) pass the rung in the prompt instead.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: SKILL.md:20 'Your dispatch prompt names your rung'; grep for 'agent file names your rung' empty; BLOCKER vs WARNING instruction and the four-rung vocabulary retained. plan.md:400 (check_gate, below the resolve at :381) and plan-revision.md:44-45 (step 2 re-dispatch) each carry a Rung line sourced from that dispatch's own resolved `effort`, with no rung name in the prose. No third dispatch site exists.

### 5. The suite is green and self-verify is clean
expected: node cadence-core/bin/test.mjs reports zero failures and node cadence-core/bin/self-verify.mjs reports problems: [].
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs -> tests 3391 / pass 3391 / fail 0. node cadence-core/bin/self-verify.mjs --root . -> ok true, problems [].

## Summary

total: 5
passed: 5
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
