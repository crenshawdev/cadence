---
status: testing
phase: 2
fields_version: 1
started: 2026-07-30
updated: 2026-07-30
---

## Items

### 1. Every adjudicated firing site reaches the triage gate
expected: review-triggers.md § 6 adjudicated arm presents survivors as a NUMBERED list with NONE first and the default, and ends the turn on the question. All four sites reach it: /cad-land publish decision, /cad-verify fix routing, /cad-plan plan-review application, /cad-execute diff site. No site's prose still acts on a survivor unconditionally. plan.md and verify.md carry an explicit re-read of § 6 Consequence since neither preloads the file.
criterion: AC1
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/references/review-triggers.md:147-149 reads 'Under git.auto_close: true it does not prompt: triage is NONE by construction, and land-cleanup.mjs gate's blocker/high halt the only consequence' inside the arm that workflows/plan.md:230-232, workflows/verify.md:186-188 and workflows/execute.md:151-153 explicitly instruct the model to RE-READ before presenting. git.auto_close is repo-wide with reach universal (config-reach.md:118). In a repo that opts in, a /cad-plan or /cad-execute adjudicated gate reads 'do not prompt, triage is NONE' and silently discards grounded survivors, while land-cleanup.mjs gate exists nowhere outside /cad-land. CONTEXT D-04 scoped the carve-out to the unattended close; the shipped prose does not.
reported: grep -c '§ 6 Consequence' returns plan.md:1 verify.md:1 execute.md:3 cad-land:1; review-triggers.md:145 carries the pre_ship-scoped carve-out
severity: major
cause: review-triggers.md:147 places the git.auto_close no-prompt sentence in the shared adjudicated arm rather than the pre_ship/cad-land arm D-04 scoped it to; plan.md, verify.md and execute.md all re-read that arm. Secondary: verify.md:183's 'When that fire() is adjudicated' condition has no resolvable trigger name.
fix: c0f517d, retest

### 2. /cad-land states the git.auto_close carve-out
expected: skills/cad-land/SKILL.md step 3 says that under git.auto_close: true the triage gate does not prompt and triage is NONE by construction, and that the unattended close still halts only through land-cleanup.mjs gate's existing blocker/high halt.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-land/SKILL.md:60-68 ('the triage gate does not prompt at all - the unattended close's triage is NONE by construction') + the land-cleanup.mjs gate stdin call; guardrail at :150; the halt it names is real and unchanged - cadence-core/bin/lib/close-decision.mjs:83-95 halts only on a surviving blocker/high under autoClose === true

### 3. Reviewer contract keeps anti-inflation, loses anti-padding; neighbours untouched
expected: skills/cad-reviewer-contract/SKILL.md contains 'No severity inflation' and no clause telling the reviewer to withhold low-severity or style findings. skills/cad-plan-checker-contract/SKILL.md and every agents/cad-reviewer*.md are byte-identical to their pre-phase state.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-reviewer-contract/SKILL.md:67 is now '- No severity inflation.'; grep -rn 'padding|pad the report|style nit' over the contract + METHOD.md returns nothing (only cad-plan-checker-contract/SKILL.md:37, deliberately kept). sha256 of all four agents/cad-reviewer*.md and cad-plan-checker-contract/SKILL.md identical pre-phase vs HEAD

### 4. The reviewer set is one batch, no hedge
expected: review-triggers.md step 4 issues the whole reviewer set in ONE message, with no 'for each' and no 'where the host allows', citing seams.md Concurrent dispatch; step 3 says one route resolve serves the set; and workflows/decision-review.md no longer quotes the removed phrase. Nothing in cadence-core/, skills/ or agents/ still quotes it.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: review-triggers.md:69-71 ('Issue the resolved set in ONE message (seams.md Concurrent dispatch); serialize only when one dispatch consumes another's output'); one route resolve for the set at :68; workflows/decision-review.md:69-70 cites 'review-triggers.md step 4's one-message batch'; workflows/execute.md:186-188 converted from 'one dispatch per message, in the background'. grep -rn 'where the host allows' cadence-core/ skills/ agents/ hits only .mjs check fixtures/doc comments - no prose surface

### 5. self-verify names an unbatched concurrent dispatch
expected: node cadence-core/bin/self-verify.mjs reports a named problem (unbatched-dispatch) when a file under cadence-core/workflows/ or cadence-core/references/ states a concurrent multi-dispatch without the one-message phrasing - proven by a fixture that trips it and a fixture that does not - and reports no such problem on this repo.
criterion: AC5
status: pass
first_pass: fail
source: verifier
evidence: dispatch-phrasing.mjs:136 (if (!LOOP_HEAD.test(b.text) && !HOST_HEDGE.test(b.text)) continue;) with LOOP_HEAD at :54 carrying no each / per message. Ran the shipped lib: dispatchPhrasingIssues('Dispatch each reviewer concurrently.') -> [], and '...concurrently, one dispatch per message, in the background.' -> []. Second path, :137 tests BATCHED against the whole collapsed block: '- Dispatch the reviewer set in one message. Then dispatch a verifier per doc, in parallel where the host allows.' -> []. AC5 says the check fires on 'a multi-dispatch instruction without the mandated one-message phrasing'; the implementation is narrower. METHOD.md:557-562 describes the narrow rule accurately, so only the acceptance criterion overstates.
reported: The check requires a loop head or host hedge on top of the concurrency claim, so a plain unbatched concurrent dispatch is not named, and one compliant sentence silences the rest of its block.
severity: minor
cause: dispatch-phrasing.mjs:136 requires LOOP_HEAD or HOST_HEDGE in addition to the concurrency claim, and :137 tests BATCHED per block rather than per sentence. Implementation matches the PLAN's task-6 spec; AC5's wording is broader than the rule that was specified.
fix: 7f01a58 8ad5759 5d1ad4e 11c2bd8 e9b05d4 21ad206, retest

### 6. The seam refuses an over-cap payload on both paid commands
expected: review-provider.mjs refuses an over-cap payload on BOTH review and consult with {ok:false, reason:'over-cap'} and issues no HTTPS request; the cap is the single key review.max_prompt_tokens measured in chars/4 estimated tokens; node cadence-core/bin/config.mjs get review.max_prompt_tokens returns 120000.
criterion: AC6
status: pass
first_pass: fail
source: verifier
evidence: review-provider.mjs:569 / :586 check truthiness only, while estimatePromptTokens (:244) filters typeof p === 'string'; assertUnderCap (:255-260) is the only guard before callStructured, and request() serializes whatever it gets with JSON.stringify(body) (:266) with no type guard. Measured: estimatePromptTokens('inst', {blob:'x'.repeat(480008)}) -> 1. Proved end-to-end offline in a network namespace (unshare -rn, no egress), same 480KB payload, only the JSON type differing - string artifact -> {ok:false, reason:'over-cap'}; object artifact -> {ok:false, reason:'transport'}, i.e. the request was constructed and attempted. Same for consult. review-provider.test.mjs:121 pins the non-string filter as intended, so no test covers the bypass. Defeats AC6's 'issuing no HTTPS request'.
reported: 480KB object artifact returns {ok:false,reason:'bad-payload'} instantly; no transport, no http - the request is never built
severity: major
cause: review-provider.mjs:569/:586 accept a non-string instruction/artifact/situation on a truthiness check, and estimatePromptTokens:244 filters typeof p === 'string', so a non-string payload measures ~0 tokens, clears assertUnderCap, and is serialized into the request by JSON.stringify at :266.
fix: 308049b, retest

### 7. CI is green across all three commands
expected: node --test cadence-core/bin/*.test.mjs exits 0, npx tsc -p tsconfig.ci.json exits 0, and node cadence-core/bin/self-verify.mjs reports ok:true with problems: [] - no budget-overrun on any surface this phase edited.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> pass 1112 / fail 0, exit 0; npx tsc -p tsconfig.ci.json exit 0; node cadence-core/bin/self-verify.mjs -> {"ok":true,"checked":"...,dispatch-phrasing","problems":[]} exit 0. Budgets regenerated to measured bytes, no budget-overrun. wc -c review-triggers.md = 12871, inside D-21's 12900

### 8. The public account of adjudication is accurate
expected: METHOD.md's list of gates that end at the triage gate contradicts METHOD.md's own gate table and omits the one gate that is adjudicated by default.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: METHOD.md:345-347 names 'the diff review in /cad-execute' as one of 'Four gates end this way', but METHOD.md:272 states diff is advisory at shipped and config.schema.json:74 defaults review.triggers.diff.gate to advisory; workflows/execute.md:148-150 is careful to condition on 'When review.triggers.diff.gate resolves it to adjudicated instead'. phase_diff, which IS adjudicated at critical (review-triggers.md:167) and IS wired to the gate (execute.md:210-214), is omitted.
reported: METHOD.md:345-351 now separates the three gates that triage as shipped from the two that triage wherever their gate resolves adjudicated; 'Four gates end this way' returns 0 hits
severity: minor
cause: METHOD.md:345-347's enumeration was written from the PLAN's 'four sites' framing rather than from the shipped gate defaults; diff is advisory by default and phase_diff, adjudicated at critical, was omitted.
fix: defe6d3, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 4
