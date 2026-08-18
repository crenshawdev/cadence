---
status: testing
phase: 5
fields_version: 1
started: 2026-08-18
updated: 2026-08-18
---

## Items

### 1. trace suggest names a direction, a current value and only a read target
expected: `node cadence-core/bin/planning.mjs trace suggest --phase <N>` returns `direction` beside every non-null `action` plus `current`; `proposed` appears only where a target is READ from the resolved config layer or a ladder; a key no config layer pins returns `current` as unset naming the stakes level the record carries; a rule that cannot be priced omits `proposed` entirely rather than returning null or a derived number.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live probe with no config layer: current comes back as "unset: no config layer pins this, so the stakes level (critical) decides it" for both keys, the gate arm omits `proposed` while R3 keeps 'xhigh'; live `--phase 2` returns direction 'lower' / current 8 with no `proposed` on R4 and no direction/current/proposed on any of the 7 info receipts. planning.mjs:3045-3080 resolves, :3371 passes in, trace-suggest.mjs:139-155 lands it. Test SGT-01 at trace-suggest.test.mjs:804 passes.

### 2. the ceiling rule goes silent when its evidence does not bind
expected: `trace suggest` returns no `workflow.max_plan_tasks` suggestion when every checkpoint it counted maps to a readable plan under the resolved ceiling, and a checkpoint whose plan file cannot be read counts as UNKNOWN rather than under-ceiling; on this repo `trace suggest --phase 2` returns no ceiling suggestion.
criterion: AC2
status: skipped
first_pass: fail
source: verifier
evidence: Live `node cadence-core/bin/planning.mjs trace suggest --phase 2` returns {kind:'suggest', subject:'cad-executor', action:'workflow.max_plan_tasks', direction:'lower', current:8}. .planning/trace.jsonl holds three phase-2 cad-executor checkpoints with plan keys `1`, `1-fix`, `1-cut`; the last two are worker keys that map to no PLAN-*.md, so cadence-core/bin/planning.mjs:3008-3030 returns null for them and cadence-core/bin/lib/trace-suggest.mjs:470-474 refuses to treat UNKNOWN as under-ceiling, which is exactly what CONTEXT.md D-09 (:156-167) requires. AC2's own first half and its second half therefore contradict each other on this record. SUMMARY.md Open items records it as unmet by design.
reported: behavior wrong - only against the criterion's second clause, not against the code. The suppression rule and the UNKNOWN degradation are implemented, wired and covered by a passing named test, but the clause 'on this repo, trace suggest --phase 2 returns no ceiling suggestion' is false at HEAD and cannot be made true without violating D-09.
severity: minor
cause: Not a code defect - the criterion contradicts itself. AC2's first half requires an unreadable plan to count as UNKNOWN (D-09), and its second half asserts that on THIS repo phase 2 therefore returns no ceiling suggestion. Phase 2's record carries three cad-executor checkpoints keyed `1`, `1-fix` and `1-cut`; the last two are worker keys written by an older Cadence version and map to no PLAN-*.md, so they are UNKNOWN and the rule correctly refuses to suppress. Making the second clause true requires either treating an unreadable plan as under-ceiling (violates D-09) or rewriting historical trace lines. The rule, its UNKNOWN degradation and its suppression arm are all implemented and covered by a passing named test.
reason: The criterion contradicts itself and the code sides with D-09. AC2's rule half - suppression when every counted checkpoint maps to a readable under-ceiling plan, UNKNOWN when a plan cannot be read - is implemented, wired and covered by a passing named test. Its second clause asserts a consequence that phase 2's record does not produce, because two of its three executor checkpoints carry worker keys (`1-cut`, `1-fix`) written by an older Cadence version that map to no plan file. Making the clause true would require treating an unreadable plan as under-ceiling, which D-09 forbids. Skipped by the user's decision on 2026-08-18 with the contradiction recorded rather than engineered around.

### 3. /cad-suggest prints the tweaks in a heading of their own
expected: A live `/cad-suggest <N>` run prints a heading carrying only the tweaks - each as key, current value, proposed value or its stated absence, and the evidence behind it - with the `info` receipts under a separate heading BELOW it and no `info` entry inside the tweak block. (human-verify: needs a live /cad-suggest run)
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Live /cad-suggest 2 run this session. Output opened with the scope line (230 events, and the caveat that nothing prunes trace.jsonl so the scope admits an older cycle's phase 2), then a 'Tweaks this record supports' heading carrying exactly one NUMBERED item - cad-executor / workflow.max_plan_tasks / current 8 / direction lower / 'No target - the record cannot price one' stated in words / evidence verbatim - and no info entry inside it; then a separate 'Receipts' heading BELOW it carrying all 7 kind:info entries, one line each.

### 4. the offer's surfaces declare it: skill tools and the README sentence
expected: `skills/cad-suggest/SKILL.md` declares in `allowed-tools` every tool the offer's steps name and names no tool the frontmatter lacks; `README.md`'s retune sentence states the offer rather than claiming the command applies nothing; and no step in `cadence-core/workflows/suggest.md` writes a config key itself.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-suggest/SKILL.md grants Bash + SlashCommand, the exact two tools suggest.md:32 and :93 name; README.md:99 states the offer and the direction/target; suggest.md:99-106,141-147 keep the write inside /cad-config; self-verify.mjs exit 0 (tools, agent-skills, budgets).

### 5. /cad-suggest ends by offering to route the change
expected: A live `/cad-suggest <N>` run ends by offering to route the tweaks to `/cad-config`, naming the exact `<key>=<value>` tokens it would pass, and applies nothing until answered. (human-verify: needs a live /cad-suggest run)
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: Same live /cad-suggest 2 run: nothing in that scope carried a proposed target, so the run said there was nothing to route and asked nothing - the no-target arm, exercised live, and no config key was written. The token-naming half was verified against the seam return that feeds it rather than a rendered offer: an unscoped `trace suggest` (1066 events) prices four targets (model.effort.cad-executor=xhigh, model.effort.cad-plan-checker=high, model.effort.cad-planner=xhigh, model.effort.cad-verifier=high) and two unpriced entries that correctly carry no token.

### 6. no marker window closes on a different run's event
expected: In `trace render`, no marker window ends at an event carrying a different `corr` than the marker that opened it, and phase 2's reported residue differs from the phase-keyed figure the same command reported before this phase.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: lib/trace.mjs:462-491,616,627,698 key the accumulators on corr; trace.test.mjs:2062 falsifier passes; live phase-2 residue_ms 3,508,747 at HEAD vs 366,716,303 from a d94c79d worktree over the same record.

### 7. every surface describes the residue as one run's, not one phase's
expected: `/cad-report`'s residue lines and `.planning/DOCS-CLAIMS.md` rows REPORT-13/14/15 describe the figure the seam now computes, and no shipped surface describes the residue as spanning a phase rather than a run.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: workflows/report.md:84,140-154 and DOCS-CLAIMS rows REPORT-13/14/15 (:1092-1094) all state the corr scoping; a repo-wide residue grep finds no shipped surface still calling it a phase's.

### 8. both falsifiers were watched failing, and the tree is green with every pin re-pinned
expected: SGT-01 and MSR-04 each carry a check with a `WATCHED FAILING AT <sha>` header whose SHA is extracted per line (not counted) and resolves to a real commit preceding the fix; `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs` both exit 0 with every moved weight pin re-pinned.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: trace.test.mjs:2034 (d94c79d) and trace-suggest.test.mjs:774 (01b2ca1), each SHA extracted per line and confirmed an ancestor of its own fix commit; full suite 2165 pass / 0 fail exit 0; self-verify.mjs exit 0 with budgets checked.

### 9. Run `/cad-suggest 2` (or `/cad-suggest` with no argument) in a live session and read the output
expected: Two headed blocks: a tweak heading carrying only the `kind: suggest` entries, each numbered and stating subject, config key, current value (the unset form verbatim where it came back unset), direction with the proposed target beside it or the absence stated in words, and the evidence verbatim - with no `info` entry inside that block; then a separate receipts heading BELOW it carrying every `kind: info` entry one line each.
origin: verifier
why_human: The split is workflow prose (cadence-core/workflows/suggest.md:45-77) rendered by a model at runtime, not a seam return - no runnable probe produces the rendered output, so only a real session shows whether the two blocks come out separated and correctly ordered.
status: pass
first_pass: pass
source: model
evidence: Same live /cad-suggest 2 run. Both headed blocks came out separated and in the required order: tweaks first, receipts second. The one suggest entry stated subject, config key, current value, direction, the absence of a target IN WORDS, and its evidence verbatim; all 7 info entries sat under the receipts heading and none leaked into the tweak block.

### 10. In that same `/cad-suggest` run, read the closing turn
expected: The run ends by asking whether to route the priced tweaks to `/cad-config`, naming the exact `<key>=<value>` tokens it would pass, and stops there - nothing applied, no config file written, and a tweak with no `proposed` offered no token. On a record where nothing carries a target, it says there is nothing to route and asks nothing.
origin: verifier
why_human: Whether the run actually ends the turn on the question (the ask-user open-ended arm) rather than assuming an answer is a live-session behavior; code inspection can only confirm suggest.md:90-106 instructs it and that the frontmatter grants SlashCommand.
status: pass
first_pass: pass
source: model
evidence: Same live /cad-suggest 2 run, closing turn. The record carried no priced tweak, and the run ended by saying there was nothing to route and asking nothing - which is exactly the arm this item's expected names for that case. Nothing was applied and no config file was written.

## Summary

total: 10
passed: 9
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 1
