---
status: testing
phase: 3
started: 2026-07-16
updated: 2026-07-16
---

## Items

### 1. weight.mjs deterministic surface report
expected: node cadence-core/bin/weight.mjs emits one-line JSON listing every agents/*.md, skills/*/SKILL.md, and cadence-core/workflows/*.md surface with a byte count and an estimated-token count each; running it twice on the same tree produces byte-identical stdout.
status: pass
first_pass: pass
source: verifier
evidence: diff of two runs = IDENTICAL; wc -l = 1 line; ok:true checked:surface-weight count 49 (7 agents+22 skills+20 workflows), each entry has string surface + numeric bytes + numeric estTokens (e.g. agents/cad-assumptions-analyzer.md bytes 4224 estTokens 1056). weight.mjs:26 + lib/surface-weight.mjs:75-83 (sorted traversal, fixed key order)

### 2. Budget overrun blocks self-verify
expected: Adding prose that pushes a surface past its declared budget makes node cadence-core/bin/self-verify.mjs exit 1, with output naming that surface and the overage amount.
status: pass
first_pass: pass
source: verifier
evidence: Fixture agent 528B vs budget 10B -> {kind:budget-overrun,file:agents/big.md,detail:'528B exceeds budget 10B by 518B'}, exit 1. self-verify.mjs:209-223

### 3. Undeclared tool blocks self-verify
expected: Adding a backtick-quoted tool name to an agent's prose that is absent from that agent's frontmatter tools: list makes node cadence-core/bin/self-verify.mjs exit 1, with output naming the agent and the tool.
status: pass
first_pass: pass
source: verifier
evidence: Fixture agent tools: Read with `Bash` and 'the Grep tool' -> {kind:undeclared-tool,file:agents/big.md,detail:'Bash not in tools:'} and same for Grep, exit 1; both D-06 detection forms fire. self-verify.mjs:225-264

### 4. Unmodified tree passes
expected: On the unmodified tree, node --test cadence-core/bin/*.test.mjs passes and node cadence-core/bin/self-verify.mjs exits 0 (current surfaces fit initial budgets; no undeclared-tool false positives).
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> tests 153/pass 153/fail 0; self-verify real tree -> {ok:true,checked:'config-keys, invocations, paths, budgets, tools',problems:[]} exit 0

## Summary

total: 4
passed: 4
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
