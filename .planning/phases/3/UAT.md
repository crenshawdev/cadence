---
status: testing
phase: 3
fields_version: 1
started: 2026-09-02
updated: 2026-09-02
---

## Items

### 1. Spike record answers OQ-2 before any code
expected: `.planning/spikes/host-effort-downgrade/SPIKE.md` states the host 2.1.258 observation - transcript `high` with thinking off, `max` with it on, for both a session and a max-declared subagent, payload `{"level":"max"}` in all four - and its commit precedes every code commit of the phase in `git log`.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: SPIKE.md carries the four-run 2.1.258 table (transcript high/max/high/max, payload {"level":"max"} in all four) plus the corpus figures behind the absent arm; `git log --name-only 00d4cf02..dd6f79e1` puts its commit 3927ef1d first of 11, touching that file alone.

### 2. A bracket row carries the effort the worker ran at
expected: After a subagent stop whose worker transcript carries `effort` on its assistant lines, `trace render --phase 3` shows that string verbatim as `effort` on the matching `brackets[]` row beside the dispatched rung - whether the hook wrote a `return` or only a `worker_cache` fact.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: `trace render --phase 3` shows rung+effort verbatim on the four current-run rows (xhigh/xhigh, high/high), landed by the worker_cache FACT route (.planning/trace.jsonl:3262, :3285 carry the pair; the returns beside them do not). The RETURN route proved live in a scratch project: the hook wrote {"event":"return",...,"effort":"high","rung":"high"} while the payload said {"level":"max"}. 19 effort-named tests pass across the three test files.

### 3. No effort means no key, and the pinned record is byte-identical
expected: A worker transcript with no `effort` on any assistant line produces a hook event with no `effort` key and a bracket row without it, and `fixtures/verbatim.trace.jsonl` renders byte-identical to its pinned output.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: A no-effort transcript through the real hook wrote an event with neither `effort` nor `rung`, and the rendered bracket had `'effort' in row === false`. renderTrace over fixtures/verbatim.trace.jsonl gives sha256 e9588bcb6a9ab0b7c1d7ce0cd864446ea75506d51c0294acc2162483cbcf3a40 under both 00d4cf02 (git archive) and HEAD - identical, 8 brackets, 0 with effort or rung.

### 4. /cad-report names a routed/ran disagreement on the row
expected: `/cad-report` on a phase whose bracket ran at a different effort than its dispatched rung prints the disagreement on that Dispatches row; a bracket with no observed effort prints `unrecorded` on that row and is never shown as agreeing.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: Executed by the coordinator (the `why_human` named the SUBAGENT's reach, not the model's). `trace render --phase 3` gives 108 brackets: the 5 rows of corr 3-00d4cf02 carry rung|ran pairs xhigh|xhigh (x3, plans 1/2/2), high|high (plan 3) and xhigh|xhigh (cad-verifier), and 103 rows carry no `effort` key and compose as `unrecorded` under ran, never as agreeing. Disagreement minted through the real hook in a scratch project: two open cad-verifier dispatches + agent_type cadence:cad-verifier-max + a transcript reporting `high` wrote {"event":"worker_cache",...,"effort":"high","rung":"max"}; with a hand-written close on agent_id W9 the bracket renders {rung:max, effort:high} and the composed Dispatches row states `<- ran high, dispatched max: DISAGREEMENT` ON that row, with no summary or count line (report.md:111 shape, :139-155 TWO EFFORTS rule).

### 5. Suite, typecheck and self-verify all pass
expected: `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and self-verify all pass, including the three re-pinned budget rows and the DOCS-CLAIMS anchors.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3747 pass / 0 fail exit 0; `npx tsc -p tsconfig.ci.json` exit 0; self-verify {"ok":true,...,"problems":[]}. Budget rows 26346/35735/25361 equal `wc -c` on the three files. The four re-pinned REPORT-* anchors read true at report.md:170-176, :233-244, :234-235, :245-247.

### 6. TRC-13 names the worker transcript and traces to phase 3
expected: REQUIREMENTS `TRC-13` names the worker transcript as the source and no longer names the payload, and the Traceability table carries a `TRC-13 | Phase 3` row.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: REQUIREMENTS.md:21 names `agent_transcript_path` and says `never off the hook input`; the removed text (git show dd6f79e1) was the payload wording. Traceability row `| TRC-13 | Phase 3 | Pending |` at :494, the only Phase 3 row.

### 7. ROADMAP Phase 3 success criteria still name the hook payload the spike corrected
expected: behavior wrong (documentation) - the phase's contract text contradicts what shipped. dd6f79e1 corrected the ROADMAP narrative and TRC-13 but not the Success criteria bullets, so two of the five still describe the payload-sourced design that .planning/spikes/host-effort-downgrade/SPIKE.md explicitly ruled out.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after 5e8decda. The two bullets at .planning/ROADMAP.md:190-196 now read `A lifecycle event carries the effort the worker's OWN transcript says it ran at - on BOTH hook writes ... beside the rung that worker was dispatched under` and `A dispatch whose worker transcript reported no effort is recorded as unrecorded - the key omitted, never a match`. `grep -E 'hook input|host reported|routing/resolve'` over the whole Success criteria block returns nothing, so no bullet contradicts the narrative at :172-180 or TRC-13. risk_surface detection on HEAD~1..HEAD: {checked:true, matches:[], empty:false} - the gate ran and raised nothing. Suite green (0 fail, 29.6s), `npx tsc -p tsconfig.ci.json` exit 0, self-verify problems: [].
reported: behavior wrong (documentation) - the phase's contract text contradicts what shipped. dd6f79e1 corrected the ROADMAP narrative and TRC-13 but not the Success criteria bullets, so two of the five still describe the payload-sourced design that .planning/spikes/host-effort-downgrade/SPIKE.md explicitly ruled out.
severity: minor
cause: dd6f79e1 (`TRC-13` and the roadmap name the worker transcript) rewrote the ROADMAP's Phase 3 NARRATIVE paragraph at :172-180 and the REQUIREMENTS row, but not the `**Success criteria**` bullet list at :186-195, which is a separate block ~10 lines below and was not in the commit's edit set. Bullets 2 and 3 therefore still carry the pre-spike, payload-sourced wording (`the effort the host reported for that dispatch, beside the routed effort already on routing/resolve`; `a dispatch whose hook input carried no effort`) that D-01 and D-03 rule out by name and that the paragraph directly above now contradicts. Documentation only - no shipped behavior is wrong.
fix: 5e8decda, retest

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
