---
status: testing
phase: 1
fields_version: 1
started: 2026-09-01
updated: 2026-09-01
---

## Items

### 1. Empty-set fallback routes to the bracketing arm
expected: Neither cadence-core/references/review-triggers.md nor review-cross-model.md sends the empty-set fallback to step 3's reviewer-selection rule; both send it to the claude-subagent arm's bracket procedure, reaching the close at review-triggers.md:143 and its failure case at :146-150.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Both copies moved. review-triggers.md:215-224 sends the empty-set fallback into the step-4 claude-subagent arm 'by RUNNING' it, and names the whole bracket procedure it inherits: append the lifecycle/dispatch, dispatch, CLOSE the moment the returned object is parsed, and take the --detail-file checkpoint arm when the dispatch failed, returned nothing or returned something unparseable. review-cross-model.md:136-144 carries the identical instruction, so D-07's second load-bearing copy is fixed too. Both explicitly deny the old routing ('Step 3's rule only says the set is never empty; the close is owed HERE'). The close is at review-triggers.md:152 and the failure case at :155-159 - AC1 quotes the pre-edit anchors :143 and :146-150, which have shifted by the phase's own edits.

### 2. A fallen-back cross-model fire still gets its return
expected: A cross-model fire whose provider fails and falls back to claude-subagent produces a lifecycle/return for that dispatch: trace render lists no entry under unpaired for it, and its token total is a number rather than unrecorded. (human-verify: needs a live provider API key and an induced provider failure)
criterion: AC2
status: skipped
reported: skip for now
reason: Needs a live provider API key and a deliberately induced provider drop-out; user deferred it.

### 3. Usage lands on the provider event, and absence omits the key
expected: review-provider.test.mjs against a fixture response carrying usage produces a provider/request event holding both the normalized input/output pair and the provider's raw usage object; the same call against a fixture with no usage produces an event holding neither key - not zero.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: node --test --test-name-pattern="CST-04" cadence-core/bin/review-provider.test.mjs -> 5 pass, 0 fail. Per-adapter fixtures (openai/gemini/deepseek, each in that provider's own spelling) assert both usage and usage_raw; the no-usage fixture asserts absence with `in` returning false rather than a zero; a fourth case proves no-output, bad-json and bad-shape each still record what they burned while http records nothing. Extraction sits in callStructured at review-provider.mjs:1350, before the three degrading exits, and the two keys are spread conditionally at :641-643.

### 4. Provider usage never reaches a roles total
expected: trace render on a phase whose only token figures come from provider usage reports cad-reviewer under roles as unrecorded, and no provider usage figure appears in any roles total.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Named test at review-provider.test.mjs:1941 passes and states AC4 positively: cad-reviewer is asserted PRESENT under roles, with no tokens key and unrecorded 1, and no wire number anywhere in the serialized block. Live confirmation: trace render --phase 1 gives roles['cad-reviewer'] = {dispatches:2, unrecorded:2} beside provider_spend.tokens 50424.

### 5. One routing resolve per review fire
expected: A phase trace containing five review fires served by a provider holds five routing/resolve events for the reviewer role.
criterion: AC5
status: skipped
reported: unevidence
reason: Unevidenceable on any existing record: the prose fix 67868b46 landed mid-run, so every phase-1 trace on disk was produced under the pre-fix reference (52 cad-reviewer resolves against 136 provider review calls overall; 2 against 6 in corr 1-ab10452a). Only a run made entirely after that commit can settle the count.

### 6. /cad-report prints a reviewer cost line
expected: /cad-report on a phase with provider reviews and zero cad-reviewer lifecycle dispatches prints a reviewer row carrying a cost figure, not an empty one. Confirm the PRINTED output in three states: recorded usage prints a cost figure; provider events with no usage key print unrecorded and never 0; a scope with no provider review call prints no line at all. (human-verify: report.md is model-executed prose - no automated command exercises the printed line, and the user deferred this to a human checkpoint)
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: All three printed states confirmed. (a) /cad-report on phase 1 printed a Cross-model reviews line carrying a cost figure: 50,424 tokens over 129 calls with 123 unrecorded, from provider_spend {calls:129, tokens:50424, unrecorded:123}, and it was printed as its own denomination beside the 22,099,581 subagent-return token line, never summed into it. The phase has 2 cad-reviewer brackets, both unrecorded, so the line was fed from provider_spend and not from a Dispatches row. (b) trace render --phase 2 gives {calls:58, unrecorded:58} and --phase 3 gives {calls:49, unrecorded:49} - no tokens key at all, so the line reads unrecorded and never 0. (c) trace render --phase 7, 8 and 9 omit the provider_spend key entirely, so no line is printed rather than an empty one.

### 7. Suite, typecheck and self-verify green with the surfaces retired
expected: node cadence-core/bin/test.mjs, npx tsc -p tsconfig.ci.json and self-verify all pass - SPEND_EXCLUDES no longer excludes cross-model provider calls and its length assertion matches, every edited reference file's weight-budgets.json row is re-pinned, and DOCS-CLAIMS.md REPORT-12 is re-adjudicated.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3698 tests / 3697 pass / 0 fail / 1 skipped; tsc -p tsconfig.ci.json exit 0; self-verify {ok:true, problems:[]}. SPEND_EXCLUDES is a frozen two-entry list (trace-suggest.mjs:132-135) with both hand-pinned length assertions at 2 (trace-suggest.test.mjs:897, prose-agreement.test.mjs:2026); no live surface still names cross-model provider calls as excluded; five weight-budgets rows re-pinned; DOCS-CLAIMS.md:1174 REPORT-12 re-adjudicated as corrected with the run-1 verdict preserved.

### 8. TRC-12 and CST-04 have no row in REQUIREMENTS.md's Traceability table
expected: missing - /cad-plan's seed-reqs step never ran for phase 1, so the section the audit seam reads and the only section cad-verify may set a Status in is empty. The phase's ROADMAP criterion is satisfied only by the `## Active` rows, which carry no Status and which /cad-audit does not read.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after f65475d9. classifyActiveSection on .planning/REQUIREMENTS.md now returns ids [TRC-12, CST-04, RSK-09, AUT-03, TRC-13] with 0 active-table-row issues. `planning.mjs seed-reqs --phase 1` -> {ok:true, seeded:[CST-04, TRC-12], skipped:[]}. The ## Traceability table now holds `| CST-04 | Phase 1 | Pending |` and `| TRC-12 | Phase 1 | Pending |`, which is the section /cad-audit reads and the only one cad-verify may set a Status in. `risk-check run --phase 1 --base HEAD~1 --head HEAD` -> matches: [], so no risk_surface fire was owed on the fix.
reported: missing - /cad-plan's seed-reqs step never ran for phase 1, so the section the audit seam reads and the only section cad-verify may set a Status in is empty. The phase's ROADMAP criterion is satisfied only by the `## Active` rows, which carry no Status and which /cad-audit does not read.
severity: minor
cause: /cad-plan's seed-reqs step was never run for phase 1. REQUIREMENTS.md's ## Traceability table still holds a header and no rows (:489-491) with the 'Empty between milestones' note at :494, while the ## Active table already names TRC-12 and CST-04 against phase 1 (:19-20). git log on .planning/REQUIREMENTS.md shows its last commit is 85ddc9c6, the milestone open - no seeding commit exists. All three PLAN files declare the ids in frontmatter, so both rows were seedable. Confirmed 2026-09-01: `planning.mjs seed-reqs` exists and takes --phase <N>; it was simply never called. The audit seam reads ## Traceability only, so /cad-audit sees zero rows for a phase that is otherwise complete.
fix: f65475d9, retest

### 9. A fallen-back cross-model fire still gets its return (AC2)
expected: Set a real provider API key, force that provider to drop out (name an unresolvable model id for its tier), fire a `blocking` trigger so the empty-set fallback runs, then `node cadence-core/bin/planning.mjs trace render --phase <N>`: the fire has no entry under `unpaired` and its bracket carries a token figure rather than `unrecorded`.
origin: verifier
why_human: Out-of-reach resource, not an unexercised probe. It needs a live provider credential and a deliberately induced provider failure against it; nothing in this tree can manufacture a real drop-out on a real key, and no fallback occurred in this phase's run to observe after the fact.
status: skipped
reported: skip for now
reason: Needs a live provider API key and a deliberately induced provider drop-out; user deferred it.

### 10. One routing resolve per review fire (AC5)
expected: On the next full run whose review fires are all provider-served, count `routing/resolve` events for the cad-reviewer role against provider review calls in `trace render --phase <N>`: five fires hold five resolves. This is a COUNT and not a join - the resolve event carries no trigger field (D-12).
origin: verifier
why_human: No probe exercised it, and none can here. The shipped prose states the rule correctly in both places a reader enters from (review-triggers.md:26-33 and review-cross-model.md:6-11), but the criterion is a count over a future run's record, and this phase's own record is a counter-example produced under the pre-fix reference: 2 resolves against 6 provider review calls under corr 1-ab10452a, with the rule landing mid-run in 67868b46. Only a run made entirely after that commit can settle it.
status: skipped
reported: unevidence
reason: Unevidenceable on any existing record: the prose fix 67868b46 landed mid-run, so every phase-1 trace on disk was produced under the pre-fix reference (52 cad-reviewer resolves against 136 provider review calls overall; 2 against 6 in corr 1-ab10452a). Only a run made entirely after that commit can settle the count.

### 11. /cad-report prints a reviewer cost line (AC6)
expected: Run `/cad-report <N>` three times and read the PRINTED output: (a) a phase with recorded provider usage prints a `Cross-model reviews` line carrying a cost figure; (b) a phase whose provider events carry no usage key prints `unrecorded` and never `0`; (c) a scope with no provider review call prints no such line at all. Re-read the figures with `trace render --phase <N>` at check time rather than trusting the ones in reports/plan-2.md, which move as the record grows.
origin: verifier
why_human: The user deferred this to a human checkpoint. Separately, report.md is model-executed prose with no executor, so no automated command exercises the printed line; the projection feeding it is verified (provider_spend answers {calls:129, tokens:50424, unrecorded:123} on this record) but the rendering of it is not.
status: pass
first_pass: pass
source: model
evidence: All three printed states confirmed. (a) /cad-report on phase 1 printed a Cross-model reviews line carrying a cost figure: 50,424 tokens over 129 calls with 123 unrecorded, from provider_spend {calls:129, tokens:50424, unrecorded:123}, and it was printed as its own denomination beside the 22,099,581 subagent-return token line, never summed into it. The phase has 2 cad-reviewer brackets, both unrecorded, so the line was fed from provider_spend and not from a Dispatches row. (b) trace render --phase 2 gives {calls:58, unrecorded:58} and --phase 3 gives {calls:49, unrecorded:49} - no tokens key at all, so the line reads unrecorded and never 0. (c) trace render --phase 7, 8 and 9 omit the provider_spend key entirely, so no line is printed rather than an empty one.

## Summary

total: 11
passed: 7
failed: 0
pending: 0
skipped: 4
blocked: 0
reworked: 1
