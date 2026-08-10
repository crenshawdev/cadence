---
status: testing
phase: 1
fields_version: 1
started: 2026-08-10
updated: 2026-08-10
---

## Items

### 1. Workflow step anchor pass/fail pair
expected: A register row anchored at <step name="execute_parallel"> in cadence-core/workflows/execute.md reports no problem while its Read sentence exists, and exactly one deferred-read-unread when that sentence alone is deleted from the fixture.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: regionLabels frame stack at cadence-core/bin/lib/deferred-reads.mjs:224-292; AC1 pair passes on a byte-copy of the real execute.md (deferred-reads.test.mjs:243,250).

### 2. Heading-scoped anchor pass/fail pair
expected: The same pass/fail pair holds for a heading-scoped anchor at workflows/config.md's Interactive-menu walk step 2.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Heading path at deferred-reads.mjs:258-269,281-286; AC2 pair passes on a byte-copy of the real config.md (deferred-reads.test.mjs:341,348). Live config.md:71-133 labels 'Interactive menu (no args)/Catalog'.

### 3. Contract-skill anchor pass/fail pair
expected: The same pass/fail pair holds for an anchor inside skills/cad-executor-contract/SKILL.md.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: AC3 pair plus the <worktree_mode> plain-tag pair pass on a byte-copy of the real skills/cad-executor-contract/SKILL.md (deferred-reads.test.mjs:124,133,408,415); live 151-193 labels worktree_mode.

### 4. Wrong-region Read does not satisfy an anchor
expected: A Read sentence in an unrelated numbered bullet does not satisfy an anchor in a different region of the same file, proved on a fixture with column-0 numbered items inside a named step.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Exact-label lookup at deferred-reads.mjs:383; five falsifier tests pass (deferred-reads.test.mjs:257,270,355,364,423). Label uniqueness is not enforced, but no live register row and no phase-3 target region is affected.

### 5. Include-consumer check catches the live dead include
expected: On a byte-copy of the live skills/cad-verify/SKILL.md plus cadence-core/workflows/verify.md, the check reports exactly one problem naming cadence-core/templates/UAT.md when called with an empty waiver list, and zero under the shipped one-row WAIVED; a byte-copy of cad-help reports zero.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: includeConsumerIssues at include-consumers.mjs:155-184; three AC5 tests pass on byte-copies of the live cad-verify pair and cad-help (include-consumers.test.mjs:76,88,94).

### 6. A self-naming include still reports
expected: On a fixture whose only mention of an included surface is its own @-include line, the check still reports a problem.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: @-line stripping at include-consumers.mjs:140-142; test at include-consumers.test.mjs:106 passes.

### 7. Live tree stays green and the register is untouched
expected: node cadence-core/bin/self-verify.mjs returns ok:true with problems:[] on the live tree, its checked string names the new check, and the four existing register rows are unchanged byte-for-byte with DEFERRED_READS.length === 4.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs` -> ok:true, problems:[], checked ends 'nul-bytes, include-consumers'; wiring at self-verify.mjs:126,1209,1221; register byte-identity asserted against a checked-in source literal at deferred-reads.test.mjs:89-97.

### 8. Waiver cannot outlive its include
expected: Deleting the waived @-include line while keeping the WAIVED row turns self-verify red with include-waiver-stale; a ROADMAP showing phase 2 complete while the row stands reports include-waiver-expired.
status: pass
first_pass: pass
source: verifier
evidence: Both arms at include-consumers.mjs:186-211; four lib tests plus the CLI-level stale test (self-verify.test.mjs:1933) pass; ROADMAP:76,79 carry the phase-2 coupling.

### 9. No prose surface moved and resident weight is unchanged
expected: git diff --stat 3cc4549..HEAD over skills, cadence-core/{references,templates,workflows}, agents and weight-budgets.json is empty, and node cadence-core/bin/weight.mjs resident --root . prints the same bytes it printed before the phase.
status: pass
first_pass: pass
source: verifier
evidence: git diff --exit-code over skills/references/templates/workflows/agents/weight-budgets.json exits 0; the pre-phase weight.mjs run against the live tree diffs clean against the current one.

### 10. Full test suite passes
expected: node --test cadence-core/bin/*.test.mjs reports 0 fail, and ./node_modules/.bin/tsc -p tsconfig.ci.json is clean.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> 1516/1516, 0 fail; ./node_modules/.bin/tsc -p tsconfig.ci.json clean.

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
