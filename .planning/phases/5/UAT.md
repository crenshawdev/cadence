---
status: testing
phase: 5
fields_version: 1
started: 2026-07-29
updated: 2026-07-30
---

## Items

### 1. Criteria grammar reader + diagnostics
expected: An in-grammar `- [ ] AC1: text` bullet parses to {id:'AC1', text:'text'}, and every out-of-grammar row in cadence-core/references/acceptance-criteria.md returns its named diagnostic. Each grammar-table row has its own test() in planning-files.test.mjs (not one looped assertion).
criterion: AC1
origin: criterion
status: pass
first_pass: pass
source: verifier
evidence: planning-files.mjs:747-815 classifyAcceptanceCriteria, 9 codes; planning-files.test.mjs:943-1092 CRITERION_ROWS one test() per row; node --test --test-name-pattern='acceptance-criteria:' -> 26/26 pass. All nine codes in references/acceptance-criteria.md:86-96 have a row and vice versa.

### 2. Fixture FAIL names exactly the uncovered ids
expected: `planning.mjs criteria-coverage` run against /tmp/cadence-phase5-fixture/fail returns a verdict-breaking result whose `breaks` name exactly the two removed criterion ids and no others.
criterion: AC2
origin: criterion
status: pass
first_pass: pass
source: verifier
evidence: Fixture rebuilt from references/acceptance-criteria.md:195-232. fail tree: breaks=[{phase:1,id:AC4,break:uncovered},{phase:1,id:AC5,break:uncovered}], counts {criteria:7,covered:5,uncovered:2}. pass tree: no breaks key, covered:7.

### 3. Reverse direction is additive, legacy does not break
expected: Same call: a UAT item with no `criterion` is reported (untraced) without changing the verdict; an item carrying `origin: verifier` is not reported at all; a checklist where no item carries `criterion` is reported as `legacy` and produces no break.
criterion: AC3
origin: criterion
status: pass
first_pass: pass
source: verifier
evidence: Three live runs: bare extra item -> untraced:[{phase:1,item:15}] and no breaks; same item with origin:verifier -> no untraced; criterion/origin stripped -> legacy:[1], counts.criteria:0, no breaks. planning.mjs:819-854, ORIGIN_EXEMPT :780; audit.md:117-122 pins breaks as the only verdict-moving key.

### 4. criterion/origin survive the full UAT lifecycle
expected: A `criterion:` line written by `uat init` is still byte-present in UAT.md after `uat refresh` and after `uat record`; same for `origin:`, and `uat record --origin <v>` sets it after the fact.
criterion: AC4
origin: criterion
status: pass
first_pass: pass
source: verifier
evidence: Live init->refresh->record in scratch: criterion:AC1, origin:criterion, origin:verifier all byte-present after each step; record --item 3 --origin smoke added origin:smoke. UAT_FIELDS planning-files.mjs:829-830; lockstep planning.mjs:420-423; --origin :467-474. --origin bogus -> bad-args, criterion:AC-01 -> bad-payload, both before any write.

### 5. Renumber leaves criterion ids untouched
expected: `/cad-phase insert` at a position before an existing phase leaves that phase's CONTEXT `AC<N>` ids byte-identical, and a renumber test pins that non-event (failing-capable against a code mutation).
criterion: AC5
origin: criterion
status: pass
first_pass: pass
source: verifier
evidence: planning.test.mjs:2201-2225 (insert and remove) pass unmutated; verifier added the documented shiftPhaseTokens-over-CONTEXT mutation to a scratch copy and both tests failed (2/2 fail), so the byte assertion is not vacuous.

### 6. Phases 1-4 backfilled, zero breaks
expected: Every criterion-derived item in .planning/phases/{1,2,3,4}/UAT.md carries `criterion`, every item that is not carries `origin`, and `criteria-coverage` returns zero breaks across all four (counts: criteria 28, covered 28, uncovered 0).
criterion: AC6
origin: criterion
status: pass
first_pass: pass
source: verifier
evidence: parseUat walk: phases 1/2/3/4 = 14/8/7/8 items, seven criterion AC1-AC7 each, origin:verifier on the rest, zero items with both, zero with neither. criteria-coverage on the repo: each phase criteria:7 fully covered, no breaks, no untraced.

### 7. /cad-audit FAILs on the fixture
expected: Running `/cad-audit` interactively against the fixture tree issues FAIL naming the uncovered criterion ids, not PASS-with-warnings. (human-verify: needs an interactive /cad-audit run - a slash-command surface no executor can invoke. Note: the installed plugin version the check runs against must be recorded, since 1.5.0's cache has no criteria-coverage subcommand.)
criterion: AC7
origin: criterion
status: blocked
reason: The surface under test is not installed: /cad-audit resolves through ${CLAUDE_PLUGIN_ROOT} = cadence/1.5.0, whose planning.mjs and audit.md contain zero occurrences of criteria-coverage (verified by grep). A live /cad-audit run on 2026-07-29 against this repo returned the shipped four-part chain only, with no coverage arm. Machine half is proven: criteria-coverage --dir on the fail fixture returns breaks AC4+AC5, on the pass fixture no breaks, and audit counts.broken is 0 for both trees. Unblocks when v2.0.0 is installed.

### 8. Full gate green: tests, tsc, self-verify, budgets
expected: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json` both pass, and `self-verify` reports ok:true with the new subcommand and its flags present in CONTRACTS and no budget-overrun on audit.md, context.md or verify.md.
criterion: AC8
origin: criterion
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> 1002/1002 pass; npx tsc -p tsconfig.ci.json exit 0; self-verify -> ok:true, problems:[]. CONTRACTS has 'criteria-coverage': [] (self-verify.mjs:71) and --origin on uat record (:66-67); removing that line in a scratch copy produced unknown-subcommand, so non-vacuous. Budgets byte-exact: audit.md 7812/7812, context.md 16391/16391, verify.md 11784/11784.

### 9. legacy exemption premise is false - phase 3 is the counterexample
expected: planning.mjs:833 exempts a checklist with zero criterion AND zero origin, on the premise that every post-field checklist carries at least one origin. .planning/phases/3/UAT.md has 7 criterion and 0 origin, so a phase-3-shaped checklist that silently stopped emitting criterion reads as pre-field legacy and the gate stays green forever - the exact regression the subcommand exists to catch.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: Verifier built that tree (phase 3 CONTEXT + its UAT with criterion: lines removed, box checked): {ok:true, phases:[{phase:3,criteria:7,items:7}], legacy:[3], counts:{criteria:0}} - seven declared criteria, zero breaks, zero counted. False premise written into planning.mjs:821-832, references/acceptance-criteria.md:144-154, templates/UAT.md:99-101, workflows/audit.md:120-122.
reported: planning.mjs:833 exempts a checklist with zero criterion AND zero origin, on the premise that every post-field checklist carries at least one origin. .planning/phases/3/UAT.md has 7 criterion and 0 origin, so a phase-3-shaped checklist that silently stopped emitting criterion reads as pre-field legacy and the gate stays green forever - the exact regression the subcommand exists to catch.
severity: major
cause: planning.mjs:833 infers 'legacy' from the ABSENCE of two fields (withCriterion.length === 0 && withOrigin.length === 0) rather than from a positive marker of file vintage. The second conjunct was assumed implied by every post-field checklist, but uat init writes origin only when the caller supplies it, so a post-field file can carry zero origin - .planning/phases/3/UAT.md is that file, created by this same phase.
fix: fd31c04, retest

### 10. Criteria leave the coverage domain silently through undiagnosed near-misses
expected: Three paths drop declared criteria out of counts with no diagnostic and no break: a near-miss section heading, a checked phase with CONTEXT but no UAT.md, and an idded bullet misreported as criterion-unidded.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: (a) planning-files.mjs:751 admits only /^## Acceptance criteria\s*$/; '## Acceptance Criteria' and '## Acceptance criteria:' both return {criteria:null,issues:[]}. (b) checked phase, CONTEXT present, UAT absent -> {phases:[],counts:{criteria:0}} (planning.mjs:807), no missing-uat diagnostic. (c) '- [ ]  AC1: x' (two spaces), '- [ ] **AC1**: x', '- [ ] ac1: x' all report criterion-unidded though an id is present - CRITERION_BOX :800 is tested before any id gate, so the named fix is a no-op.
reported: Three paths drop declared criteria out of counts with no diagnostic and no break: a near-miss section heading, a checked phase with CONTEXT but no UAT.md, and an idded bullet misreported as criterion-unidded.
severity: major
cause: Three distinct root causes in one theme - a criterion can leave counts with no diagnostic. (a) planning-files.mjs:751 matches the section heading exactly with no near-miss arm, so a capital-C or trailing-colon typo returns criteria:null and issues:[]. (b) planning.mjs:807 keys D-10's absence exemption on file absence alone, so a pruned phase and a checked phase that never got a UAT.md are indistinguishable; no missing-uat code exists. (c) the classifier's ordered cascade tests CRITERION_BOX before any id-token gate, so a bullet WITH a malformed id falls through to criterion-unidded and the named remedy is a no-op.
fix: 34c023d + b4950d4 + bdf111b, retest

### 11. Criteria-section walk is not fence-aware
expected: classifyAcceptanceCriteria walks raw lines to the next '## ', unlike parseUat's own sectionBound (planning-files.mjs:857), so a fenced example bullet mints a phantom criterion no UAT item can cover - a false FAIL.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: classifyAcceptanceCriteria('## Acceptance criteria\n\n```markdown\n- [ ] AC9: inside a fence\n```\n') returns [{id:'AC9',text:'inside a fence'}]. It is exactly the shape references/acceptance-criteria.md:21-23 uses to illustrate the grammar.
reported: classifyAcceptanceCriteria walks raw lines to the next '## ', unlike parseUat's own sectionBound (planning-files.mjs:857), so a fenced example bullet mints a phantom criterion no UAT item can cover - a false FAIL.
severity: minor
cause: The criteria-section walk scans raw lines to the next '## ' instead of reusing the fence tracker parseUat already has at planning-files.mjs:857 (sectionBound), so a fenced illustrative bullet is read as a live criterion.
fix: 534c1a3, retest

### 12. CHANGELOG.md:84 states a number the repo contradicts
expected: 'Two of this cycle's own 122 criteria were dropped at checklist-build time' is contradicted three ways, and it shipped into a public changelog.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: references/acceptance-criteria.md:7 attributes the incident to 'the cycle before this grammar existed'; criteria-coverage reports counts.criteria 36 for this cycle (28 in phases 1-4 plus 8 in phase 5), not 122; CONTEXT D-15 records the analyzer found no committed checklist with fewer items than its phase's criteria. .planning/ROADMAP.md:92 still carries the same sentence in the phase-5 Goal though :99 was corrected under D-15.
reported: 'Two of this cycle's own 122 criteria were dropped at checklist-build time' is contradicted three ways, and it shipped into a public changelog.
severity: minor
cause: The incident count in CHANGELOG.md:84 was written from recollection rather than from criteria-coverage output; D-15 had already established the opposite in the same phase, and .planning/ROADMAP.md:92 carries the same unverified sentence though :99 was corrected.
fix: 8dc88fa, retest

### 13. Phase 5's own CONTEXT is out of the grammar it shipped
expected: A prose footer inside '## Acceptance criteria' names an AC token, so every criteria-coverage run reports a context_issues entry against phase 5 for the rest of the cycle.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: .planning/phases/5/CONTEXT.md:224 -> context_issues:[{phase:5,issues:[{line:224,code:'criterion-prose-line'}]}] on every live repo run.
reported: A prose footer inside '## Acceptance criteria' names an AC token, so every criteria-coverage run reports a context_issues entry against phase 5 for the rest of the cycle.
severity: minor
cause: A prose footer sits below the last bullet but above the next '## ' heading in .planning/phases/5/CONTEXT.md, so it is inside the criteria section by the grammar's own bounds. The classifier is behaving correctly; the file is what is out of grammar.
fix: eff5696, retest

## Summary

total: 13
passed: 12
failed: 0
pending: 0
skipped: 0
blocked: 1
reworked: 5
