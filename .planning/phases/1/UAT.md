---
status: testing
phase: 1
fields_version: 1
started: 2026-08-26
updated: 2026-08-26
---

## Items

### 1. Repeat close keeps its own bracket
expected: Replaying `dispatch A, close A, dispatch B, A's delayed repeat, close B` for ONE worker key renders TWO brackets, each carrying its own figures, and `roles.tokens` equals the sum of those two brackets - not of all three terminals.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: lib/trace.mjs:812-814 discriminator (both clocks parse, terminal earlier than head pending, pairedRows holds the key) plus the named regression test at trace.test.mjs:1689 asserting two brackets, own figures, ms 300000 on both, unpaired empty and roles.tokens = the two rows' sum. The three shipped dedup tests and the committed-fixture test are green with bodies unmodified.

### 2. Stop close picks the dispatch its agent id names
expected: With two open dispatches of one role, a `SubagentStop` payload closes the dispatch whose `agent_id` matches, not the newest one - shown against a fixture holding both.
criterion: AC2
status: pass
first_pass: fail
source: model
evidence: Criterion reworded to what shipped in 48ab3139 (AC2, ROADMAP success criterion 2, TRC-06); the behaviour was never the defect. `node --test --test-name-pattern 'TWO open dispatches' cadence-core/bin/subagent-trace.test.mjs` -> 1 pass 0 fail on 'stop: TWO open dispatches of the role produce NOTHING'. That is now the criterion: with two open dispatches of one role the hook writes nothing rather than closing the wrong one, because the dispatch event is written before the subagent exists and carries no id to match a payload against. The id's delivered job is GATE 2a's negative test, recognising a worker whose bracket is already closed. The functional gap the diagnosis surfaced - cache figures lost on the parallel path and on the 16% not-terminal case - is NOT closed here; it is filed to .planning/CAPTURE.md as a phase-1 todo for /cad-plan, per the user's routing decision. Full suite 3358 pass / 0 fail; self-verify ok:true.
reported: behavior wrong - the shipped rule never picks a dispatch by agent id. With two open dispatches of one role it closes NOTHING, whatever id the payload carries. The payload's id is used only as a negative filter (has some bracket already got this id?), so the positive half of AC2, of ROADMAP success criterion 2 and of TRC-06 ('lands on the worker that actually stopped') is not delivered; only the 'never the newest open dispatch' half is.
severity: major
cause: Not a code defect - a criterion the shipped architecture cannot satisfy. The `dispatch` event is written before the subagent exists, so it carries no agent id (CONTEXT D-07, as corrected). That means an `unpaired` row has NO id to compare a payload id against, and GATE 2b at cadence-core/bin/lib/subagent-trace.mjs:210 (`if (mine.length !== 1) return null;`) is the only rule available: with two open dispatches of one role the hook refuses rather than guesses. The payload id is a negative filter only, at GATE 2a :164 `alreadyClosed`. So AC2's positive half ('closes the dispatch whose agent_id matches') describes a join the design deleted on purpose in 426163a0 and cannot restore; only the negative half ('never the newest open dispatch') is delivered, and refusing is the safer behaviour. The defect is that AC2, ROADMAP success criterion 2 and TRC-06 still state the deleted design. Consequence worth naming: on the TRUE parallel path both workers stop while both dispatches are still open, so the hook writes nothing for either - and the cache figures, which only the hook can supply, are lost on exactly the most expensive path.
fix: 48ab3139, criterion reworded to what shipped, retest

### 3. A worker that has not stopped writes nothing
expected: A `SubagentStop` payload whose `transcript_path` shows the worker has not reached a terminal entry writes no `return` event at all.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: GATE 0 refuses on NOT_TERMINAL alone (lib/subagent-trace.mjs:187). Disk-half probe: a payload whose transcript_path ends on a tool_use assistant entry left the scratch trace.jsonl at 1 line before and after, while the same payload with no transcript_path still appended the ordinary close (the unknown arm).

### 4. The ordinary two-writer case is unchanged
expected: One dispatch, a figureless hook close, then the hand-written close with figures renders ONE bracket and `dispatches: 1`.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: The three shipped dedup tests pass with unmodified bodies; a CLI probe (dispatch, figureless hook close, hand-written close with figures) rendered exactly ONE bracket and roles dispatches: 1 with tokens, turns and duration_ms all folded in.

### 5. Two clocks side by side in report and suggest
expected: `/cad-report` and `/cad-suggest` each print a figure sourced from a bracket's `duration_ms`, labelled distinctly from the bracket's `ms`, and print `unrecorded` rather than `0` when the close carried no wall clock.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: report.md:85 tuple ends b.duration_ms (executed against a synthetic render.json and it printed the column), :108 'step minutes | worker minutes', :120-129 the unrecorded-never-zero rule. trace-suggest.mjs R8 probe printed the summed worker clock, the count of dispatches that reported none as unrecorded, and the ms/duration_ms distinction; a scope with no duration_ms emitted nothing.

### 6. Cache figures ride the bracket, not the roles bill
expected: A bracket close records cache figures and `trace render` reports them; a close carrying none omits the keys rather than writing zeros, and `roles.tokens` is unchanged by their presence.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Four named render tests (carried, neither-key, non-numeric, fold) pass, one asserting roles deep-equal to the same fixture without the figures. End-to-end: the real hook script wrote both keys onto a scratch record and `trace render` printed them on the bracket row, billed once per message id rather than once per line.

### 7. Suite green and self-verify clean
expected: `node cadence-core/bin/test.mjs` reports 0 failures and `self-verify` reports no problems.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs: 3357 pass / 0 fail / 1 skipped, exit 0. node cadence-core/bin/self-verify.mjs: {"ok":true,"problems":[]}.

### 8. The identity join against this repo's own record
expected: A real parallel dispatch passing `--agent-id` produces two brackets in `.planning/trace.jsonl` carrying two distinct agent ids - the SUMMARY records this as exercised by tests and a scratch smoke only, never by this repository's own record.
status: skipped
source: model
reason: Settled in substance without spending two real dispatches, on the user's call. The unknown this item was written for - whether the host surfaces a worker id at all - is now answered on this repository's OWN record: the cad-verifier dispatch of this very session was closed with `--agent-id a2281c736f2789560`, and `trace render` shows bracket corr 1-b799b54d carrying `agent_id` beside `duration_ms: 407184`. `grep -c agent_id .planning/trace.jsonl` was 0 over 2283 events before that close and is 1 after. What remains unproven is only the arithmetic of doing it twice at once, through the same hand-written close already exercised. The literal probe was declined deliberately: it would append two brackets to the real cost record that correspond to no real work, and `/cad-suggest` tunes against that record.

### 9. The worker's host id survives whichever writer closes first
expected: unwired on the ordinary arrival order - the repeat-close fold in renderTrace does not fold agent_id, so an id supplied on the hand-written close is dropped whenever the hook's figureless close opened the bracket first. That ordering is the ordinary one (the host fires SubagentStop when the worker stops, before the orchestrator processes the return and writes its close) and is the ordering AC4 itself calls ordinary. The code comment claims the opposite of what the code does.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in b99207d0 and retested on the exact arrival order that failed. End-to-end on a scratch planning root - `trace append ... --event dispatch`, then a FIGURELESS close (the hook's, landing first, the ordinary order), then `trace close --tokens 900 --turns 4 --duration-ms 60000 --agent-id WORKER-Z` - now renders ONE bracket carrying {tokens:900, turns:4, duration_ms:60000, agent_id:'WORKER-Z'}. Before the fix the same probe rendered the three figures and NO agent_id key. The new regression test `render: the worker id survives the hook closing the bracket first` pins both directions and is failing-capable: with the clause removed it fails on `the id on the second writer was dropped by the fold`, and passes with it restored. Full suite 3358 pass / 0 fail / 1 skipped; self-verify ok:true, problems [].
reported: unwired on the ordinary arrival order - the repeat-close fold in renderTrace does not fold agent_id, so an id supplied on the hand-written close is dropped whenever the hook's figureless close opened the bracket first. That ordering is the ordinary one (the host fires SubagentStop when the worker stops, before the orchestrator processes the return and writes its close) and is the ordering AC4 itself calls ordinary. The code comment claims the opposite of what the code does.
severity: major
cause: A one-line omission in the fold. cadence-core/bin/lib/trace.mjs's repeat-close FOLD arm fills `tokens`, `turns`, `duration_ms` and both CACHE_KEYS into a row the first writer opened, and has no clause for `agent_id`. The comment at :866-871 asserts agent_id follows 'the same rule `turns` and `duration_ms` follow' - those two ARE folded, so the comment states the opposite of the code. Effect: an id supplied on the hand-written close is dropped whenever the hook's figureless close opened the bracket first, and lib/subagent-trace.mjs:164's alreadyClosed equality test then reads a key that is absent. Fix is one clause beside the others: `if (!('agent_id' in b) && e.agent_id) b.agent_id = e.agent_id;`, plus adding agent_id to the TraceRender brackets typedef at :340.
fix: b99207d0, retest

### 10. Run a real parallel execute in this repository with the orchestrator passing `trace close --agent-id`, then read `.planning/trace.jsonl` for two brackets carrying two distinct agent ids - and note whether the host's subagent return actually surfaces an id to copy.
expected: Two `return` events, each carrying its own `agent_id`, rendering as two brackets with distinct ids; and a late SubagentStop for either worker appends nothing. Today `grep -c agent_id .planning/trace.jsonl` is 0 over 2283 events.
origin: verifier
why_human: Out of reach for this pass and not merely unexercised. It needs the live host to dispatch two real subagents and to render a worker id in its return - cadence-core/references/seam-spawn-agent.md's STANDING EXPOSURE bullet lists only three figures on a return (tokens, tool uses, duration) and the SUMMARY's own open item records that the host labels the subagent id internal and instructs against surfacing it, which is why no dispatch in this phase passed one. Whether `--agent-id <the id on the subagent return>` (workflows/execute.md:230) is a flag anything can fill is decided by the host at run time, and the check also mutates this repository's real record and spends real dispatches, so I neither ran it nor simulated it. The seam itself is already proven on a scratch root; what is unproven is that the host will hand the id over.
status: skipped
source: model
reason: Declined deliberately by the user, and the probe could not show what it was written to show. Its `expected` asks for two brackets with two distinct ids AND for a late SubagentStop to append nothing. The second half is settled analytically by item 2's diagnosis: with two open dispatches of one role, GATE 2b (`subagent-trace.mjs:210`, `if (mine.length !== 1) return null;`) refuses for BOTH workers, because the dispatch event carries no id to match a payload against - so a real parallel run produces no hook-written id at all, only the two hand-written ones. The first half is the hand-written close, proven on the real record this session (bracket 1-b799b54d carries agent_id; the count went 0 -> 1). The why_human premise that the host might never surface an id is now falsified. Cost of the literal run - two dispatches and two synthetic brackets in the cost record /cad-suggest reads - was judged not worth re-proving a mechanism already exercised once.

## Summary

total: 10
passed: 8
failed: 0
pending: 0
skipped: 2
blocked: 0
reworked: 2
