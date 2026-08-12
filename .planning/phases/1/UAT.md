---
status: testing
phase: 1
fields_version: 1
started: 2026-08-12
updated: 2026-08-12
---

## Items

### 1. Old traces are unchanged in both readers
expected: `trace render` and `trace suggest` run against the committed verbatim phase-1 fixture report the same counts, roles, unpaired and suggestion list they report today - a trace written before this phase is unchanged in both readers.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: `trace render`/`trace suggest` against cadence-core/bin/fixtures/verbatim.trace.jsonl: counts {routing:8,provider:0,lifecycle:18,outcome:2}, 5 role rows, no `coordinator` key, and the same two info suggestions (cad-executor 44%, risk_surface). Pinned as literals; trace.test.mjs + trace-suggest.test.mjs green.

### 2. Markers render in events[] and carry no tokens
expected: For a trace carrying coordinator markers, `trace render` lists them in events[] under the lifecycle family, each naming the step it marks, and no marker anywhere in the tree carries a `tokens` field.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Three appended markers render under family 'lifecycle' with event 'coordinator' and their `step` name; no rendered event carries `tokens`. Collected at cadence-core/bin/lib/trace.mjs:462-465; prose census pins no-tokens/no-role/non-empty-step at cadence-core/bin/trace.test.mjs:908-917.

### 3. /cad-report record-health line reports the residue
expected: `/cad-report`'s record-health line reports the coordinator-side residue for a phase whose trace carries markers, and omits the residue for a phase whose trace has none. (human-verify: needs a walked `/cad-report` run)
criterion: AC3
status: skipped
reason: not walkable until v3.1.0 ships as an installed plugin - the deliverable is workflow prose (report.md residue line / context.md spend_gate) absent from the installed 3.0.0 plugin; deferred to release UAT

### 4. trace suggest returns a coordinator-spend suggestion
expected: `trace suggest` returns a coordinator-spend suggestion for a trace whose markers put the residue above its floor, and `suggestFromRender(render([]))` still deep-equals `[]`.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: On a constructed 70-min-residue trace, suggest returns `{kind:'info',subject:'coordinator',evidence:'coordinator time between worker brackets: 70 min (88% of wall time), most of it at `load_priors` (30 min)'}`, read off the render block (trace-suggest.mjs:188-224); a 44-ms trace returns none; `suggestFromRender(render([]))` deep-equals `[]` (trace-suggest.test.mjs:136).

### 5. Skip arm writes CONTEXT.md with no analyzer in the trace
expected: For a phase where the spend gate is answered "skip", `.planning/phases/<N>/CONTEXT.md` exists and `.planning/trace.jsonl` contains neither a `lifecycle/dispatch` nor a `routing/resolve` event for `cad-assumptions-analyzer` at that phase.
criterion: AC5
status: skipped
reason: not walkable until v3.1.0 ships as an installed plugin - the deliverable is workflow prose (report.md residue line / context.md spend_gate) absent from the installed 3.0.0 plugin; deferred to release UAT

### 6. Spend gate on verbatim phase 2 recommends dispatch
expected: Walked against verbatim phase 2's roadmap entry and its phase-1 SUMMARY deviations, the spend gate presents six named surfaces as its evidence and its recommended option is dispatch, not skip. (human-verify: needs a walked `/cad-context` run)
criterion: AC6
status: skipped
reason: not walkable until v3.1.0 ships as an installed plugin - the deliverable is workflow prose (report.md residue line / context.md spend_gate) absent from the installed 3.0.0 plugin; deferred to release UAT

### 7. self-verify and trace tests green, census admits the new name
expected: `node cadence-core/bin/self-verify.mjs` and `node --test cadence-core/bin/trace.test.mjs` are both green, with no `unknown-flag`, no `budget-overrun`, and the producer census admitting the new lifecycle name.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs` -> ok:true, problems:[]. `node --test` over trace/trace-suggest/prose-agreement/deferred-reads -> 114 pass, 0 fail, census test included. `--step` present in the flag-lint table (self-verify.mjs:211-215); four weight-budgets rows re-pinned.

### 8. trace append --step refuses bare/blank and --tokens/--role
expected: `trace append --step` with no value or a blank value is refused as `bad-args`, and `--step` alongside `--tokens` or `--role` is refused too, so a coordinator marker can never carry a figure the coordinator cannot know.
status: pass
first_pass: fail
source: model
evidence: Item's second clause was itself the overclaim, corrected in a672ff5. Delivered behavior verified: bare/blank --step refused (planning.mjs:2325-2328); the no-tokens/no-role rule is enforced by the prose census at trace.test.mjs:908-917, which asserts every written --event coordinator line carries no tokens, no role and a non-empty step. `node --test cadence-core/bin/trace.test.mjs` -> 59 pass, 0 fail. Runtime refusal deliberately absent per PLAN-1.md:89 so the append seam stays event-agnostic.
reported: behavior wrong - only half the item is delivered. Bare and blank `--step` are refused as `bad-args`, but `--step` alongside `--tokens` or `--role` is accepted and written. SUMMARY.md:13 and its Goal check (SUMMARY.md:62) both state the marker is 'refused alongside `--tokens`/`--role`' at the seam; the seam does no such refusal.
severity: major
cause: Not a code gap - a SUMMARY overclaim. PLAN-1.md:89 specifies the no-role/no-tokens rule is held 'by prose and by the census assertion below rather than by a runtime refusal', and planning.mjs:2331-2336 implements exactly that, deliberately keeping the seam event-agnostic so return/checkpoint/escalation store tokens identically. The bare/blank refusal (planning.mjs:2325-2328) is the only one ever specified. SUMMARY.md:13 and its Goal check at :62 both assert a runtime refusal alongside --tokens/--role that was never planned and must not exist. The defect is the two SUMMARY sentences.
fix: a672ff5, retest

### 9. spend_gate sits between load_priors and analyze
expected: `cadence-core/workflows/context.md` has a `<step name="spend_gate">` block between `load_priors` and `analyze` - ahead of the `route.mjs resolve` that brackets the analyzer - and moving it below `analyze` fails `prose-agreement.test.mjs`.
status: pass
first_pass: pass
source: verifier
evidence: context.md load_priors:57 / spend_gate:86 / analyze:155, --bracket-read at 163-165. Test falsified live on a scratch copy: moving the block below `analyze` fails prose-agreement.test.mjs with 'context.md opens the spend_gate step BELOW <step name="analyze">'.

### 10. Walk `/cad-report <N>` on a phase whose trace carries coordinator markers, then on a phase whose trace predates this phase
expected: The `Record health:` line names a coordinator residue in minutes plus the step carrying the most of it on the first; on the second it mentions no residue at all.
origin: verifier
why_human: The record-health line is prose composed by the coordinator at run time from the render block (D-05, report.md:45-59) - there is no seam that emits it, so no command available here produces the line. It requires a live `/cad-report` slash-command run in an installed Cadence session, which is outside this agent's reach.
status: skipped
reason: not walkable until v3.1.0 ships as an installed plugin - the deliverable is workflow prose (report.md residue line / context.md spend_gate) absent from the installed 3.0.0 plugin; deferred to release UAT

### 11. Walk `/cad-context <N>` on a small phase and answer the Analyzer question "Skip it"
expected: `.planning/phases/<N>/CONTEXT.md` is written anyway, and `planning.mjs trace render --phase <N>` shows no `lifecycle/dispatch` and no `routing/resolve` naming `cad-assumptions-analyzer` for that phase.
origin: verifier
why_human: The gate is an interactive ask-user question inside a slash-command workflow; the skip arm's outcome only exists once a human answers it in a live session. No fixture exercises it (D-13 records the skip arm ships with no positive evidence), and this agent cannot run the workflow or answer its prompt.
status: skipped
reason: not walkable until v3.1.0 ships as an installed plugin - the deliverable is workflow prose (report.md residue line / context.md spend_gate) absent from the installed 3.0.0 plugin; deferred to release UAT

### 12. Walk `/cad-context 2` in /data/code/verbatim and read the Analyzer question's annotation
expected: The annotation presents six named surfaces as its evidence, and the recommended (first) option is "Dispatch it", not "Skip it".
origin: verifier
why_human: Both the surface count and the recommendation are the coordinator's judgment at run time (D-11: no score, no threshold, nothing computed), so no code path determines them and no probe can observe them without a live `/cad-context` run.
status: skipped
reason: not walkable until v3.1.0 ships as an installed plugin - the deliverable is workflow prose (report.md residue line / context.md spend_gate) absent from the installed 3.0.0 plugin; deferred to release UAT

## Summary

total: 12
passed: 6
failed: 0
pending: 0
skipped: 6
blocked: 0
reworked: 1
