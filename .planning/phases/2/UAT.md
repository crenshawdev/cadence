---
status: testing
phase: 2
fields_version: 1
started: 2026-08-09
updated: 2026-08-09
---

## Items

### 1. Human-check bar stated in verify.md
expected: cadence-core/workflows/verify.md states explicitly that an item is human-verify only when the model cannot execute it (irreversible against real data, or outside its reach: credentials, GUI, hardware, another machine)
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/verify.md:141-146 states the bar with all four exclusions verbatim (irreversible against real data; credentials, GUI, hardware, another machine). Note the separate gap filed against the bar's OPERATIONAL predicate - the stated sentence is correct, the short-circuit below it is not.

### 2. Two-pass walk asks about only the un-executable item
expected: With the plugin reinstalled from this branch, running /cad-verify over a scratch phase of 9 read-only-command items + 1 destructive item ends the turn asking about exactly 1 item, with a 9-row executed-and-cited results table above it, and grep -c '^source: model' on that UAT.md returns 9 (model-executed rows are distinguishable from user answers and verifier results)
criterion: AC2
status: skipped
reason: needs the plugin reinstalled from cadence/v2.6.0; walk prose resolves through ${CLAUDE_PLUGIN_ROOT}

### 3. risk_surface re-arm is bounded
expected: The one-re-arm cap is stated in one place every fire site shares and actually reaches the risk_surface trigger; the re-arm terminates and exceeding it surfaces a named reason instead of another round
criterion: AC3
status: pass
first_pass: fail
source: verifier
evidence: User ran the confirmation command: 5/5 risk_surface fire sites (execute.md, task.md, debug.md, verify.md, git-guard.md) name triage-gate.md, each with the ONE-round cap and a RE-READ; review-triggers.md step 6 is a read imperative (1e3e2c9)
reported: unwired - the cap text is real and terminal, but no risk_surface fire site is instructed to load the file that holds it, and execute.md's fire site restates the blocking consequence inline without it
severity: major
cause: The cap text in references/triage-gate.md:14-32 is correct and terminal, but no risk_surface fire site loads it: task.md:74, debug.md:110 and git-guard.md:121-122 point only at review-triggers.md, whose step 6 delegates with no read imperative, and execute.md:282-289 restates the blocking arm inline with no cap while :267-269 steers the reader away. Every RE-READ of triage-gate.md is scoped to a non-risk_surface arm.
fix: 1e3e2c9, retest

### 4. maxTurns spike recorded a verdict before value shipped
expected: .planning/spikes/maxturns-cap-behaviour/SPIKE.md records what a maxTurns-capped run actually returns with a validated/invalidated/inconclusive verdict, and its criteria commit precedes the commit that shipped the value
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: .planning/spikes/maxturns-cap-behaviour/SPIKE.md:3, :43-45, :153 (VERDICT: validated), :155; commit order 3d82fa5 (criteria) -> 90c4c44 (close) -> e8b949b (the maxTurns: 400 value).

### 5. Every dispatched agent carries a runaway-loop bound
expected: All 19 agents/*.md carry maxTurns in frontmatter, and the one dispatch path without a frontmatter bound (new-project.md's research step) is named in the phase record with its reason
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: `grep -c '^maxTurns:' agents/*.md` -> 1 on each of 19 files; the uncovered new-project.md research dispatch is named in that workflow's own prose with its reason and its wall-clock bound (workflow.subagent_timeout).

### 6. /cad-audit FAILs on an already-published planning-doc version
expected: The audit gate FAILs when the planning docs name a version the project has already published, proved by a fixture; it does not fail when the version is tagged and the manifest already carries it, and an untagged version that merely sorts below the newest tag is not drift
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:998-1008 emits version_drift from real tags; six named fixtures pass (planning.test.mjs:2044, :2052, :2062, :2071, :2085, :2096 including the #87 v2.4.0 pin); audit.md:104-111, :144, :152-170 make it verdict-moving with the three non-drift states stated. The exemption predicate's false-positive window is filed as its own gap rather than against this item.

### 7. Test suite and self-verify green with budgets regenerated
expected: node --test cadence-core/bin/*.test.mjs passes and self-verify passes, with cadence-core/bin/weight-budgets.json regenerated so no budget-overrun fires
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> 1367 pass 0 fail; node cadence-core/bin/self-verify.mjs -> {"ok":true,"problems":[]} with the budgets arm checked; tree clean.

### 8. The walk's human-check bar admits model-executable items via why_human
expected: behavior wrong - verify.md's short-circuit treats why_human as proof an item is human-only, but the verifier contract writes why_human for every UNCERTAIN truth, including truths a model can settle by running a named test
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: verify.md:148-165 - only the CONTEXT-time (human-verify: needs <tool/service>) suffix is already-judged; a why_human item has its reason read and the bar re-applied, routing to pass 2 only on irreversibility or an out-of-reach resource. cad-verifier-contract/SKILL.md:194 states the same predicate from the writing side (676cb29)
reported: behavior wrong - verify.md's short-circuit treats why_human as proof an item is human-only, but the verifier contract writes why_human for every UNCERTAIN truth, including truths a model can settle by running a named test
severity: major
cause: verify.md:147-153 treats a why_human item as already judged and skips pass 1, but cad-verifier-contract/SKILL.md:194 and :86-90 write why_human for every UNCERTAIN truth, including a truth whose only defect is that no probe ran. The union is strictly larger than 'the model cannot execute it', so model-executable items still route to the one-at-a-time ask - the defect FRI-01 targets.
fix: 676cb29, retest

### 9. version_drift's interrupted-close exemption fires on a sanctioned close
expected: behavior wrong - the exemption is 'every phase derives complete', which is narrower than the state audit.md declares exempt, and its stated remedy is unreachable for a phase holding a blocked UAT item
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: User ran node --test planning.test.mjs branch-decision.test.mjs -> 293 pass 0 fail, including 'a phase whose checklist holds only a blocked item does not hold the cycle open' and its still-answerable complement (b3a9346)
reported: behavior wrong - the exemption is 'every phase derives complete', which is narrower than the state audit.md declares exempt, and its stated remedy is unreachable for a phase holding a blocked UAT item
severity: minor
cause: planning.mjs:1007-1008 exempts only when EVERY phase derives complete (SUMMARY + uatComplete), narrower than the state audit.md:159-161 declares exempt: milestone.md:82-83 sanctions closing with rolled-over work, and planning-files.mjs:1097-1099 makes uatComplete false for any blocked item while verify.md:158 makes blocked terminal, so audit.md:110-111's remedy is unreachable for such a phase.
fix: b3a9346, retest

### 10. version_drift's comparand is a first-version-token scan of free prose
expected: behavior wrong under a benign edit - activeVersion() returns the first version token anywhere in the PROJECT.md ### Active body, so an Active section that names the predecessor before the current milestone reports the predecessor and hard-FAILs the ship gate on correct docs
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: Same run: the four activeVersion fixtures pass, including 'the line-anchored declaration wins over a predecessor named first' (af370e4)
reported: behavior wrong under a benign edit - activeVersion() returns the first version token anywhere in the PROJECT.md ### Active body, so an Active section that names the predecessor before the current milestone reports the predecessor and hard-FAILs the ship gate on correct docs
severity: minor
cause: branch-decision.mjs:57-68 returns the FIRST version token in the PROJECT.md ### Active body, feeding planning.mjs:998. An Active section naming the predecessor before the current milestone reports the predecessor and hard-FAILs the ship gate on correct docs; this repo's PROJECT.md:103-104 is one clause reorder from that state and v2.5.0 is tagged.
fix: af370e4, retest

### 11. Reinstall the plugin from cadence/v2.6.0, build a scratch phase with 9 read-only-command UAT items + 1 destructive item, and run /cad-verify <N>
expected: The turn ends asking about exactly 1 item, a 9-row executed-and-cited results table is printed above the ask, and `grep -c '^source: model' .planning/phases/<N>/UAT.md` returns 9. Steps: 1) reinstall the plugin from this branch; 2) create the scratch phase and its UAT.md; 3) run `/cad-verify <N>`; 4) run `grep -c '^source: model' .planning/phases/<N>/UAT.md` and expect `9`.
origin: verifier
status: skipped
reason: same check as item 2 (verifier-appended duplicate); needs the plugin reinstalled from cadence/v2.6.0

### 12. With the plugin reinstalled, run /cad-audit against a checkout whose PROJECT.md ### Active names an already-tagged version
expected: The gate reports FAIL and names the doc version, the tag spelling that carries it, and the cycle state - not a PASS-with-warnings. Steps: 1) reinstall the plugin from this branch; 2) point a scratch checkout's PROJECT.md ### Active at a version the repo already tags; 3) run `/cad-audit`; 4) expect a FAIL verdict citing version_drift.
origin: verifier
status: skipped
reason: needs the plugin reinstalled from cadence/v2.6.0; /cad-audit resolves its seam through ${CLAUDE_PLUGIN_ROOT} (D-17)

## Summary

total: 12
passed: 9
failed: 0
pending: 0
skipped: 3
blocked: 0
reworked: 4
