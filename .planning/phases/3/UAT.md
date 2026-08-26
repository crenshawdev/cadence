---
status: testing
phase: 3
fields_version: 1
started: 2026-08-26
updated: 2026-08-26
---

## Items

### 1. All three withholding gates state the cache fact and still write no return
expected: A render over fixtures for the not-terminal, already-closed and two-open-dispatch stops shows a worker_cache fact for each, and no `return` event for any of them; the termination gate still refuses a non-terminal stop.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: subagent-trace.mjs:365/:376/:392 each `return withheld()`; six named gate tests green; end-to-end per gate (payload piped into cadence-core/bin/subagent-trace.mjs against a temp .planning) appended exactly one worker_cache and no return, exit 0 and silent, and the terminal path still answers one return carrying the figures.

### 2. The fold joins a cache-only fact to the right bracket
expected: `trace render` puts the fact's cache figures on the bracket with the same corr and agent_id; a bracket that already carries cache figures keeps its own values; with two open dispatches of one role in one phase, the figures land on the agent_id match, not the newest bracket and not the first fact to arrive.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: trace.mjs:1067-1073 matches on `corr\0agent_id`, fills only empty keys, breaks on first match; facts are Map-keyed so the later fact wins. Six named tests green including before-the-id arrival, no-overwrite, two-workers-one-role, wrong-corr/no-id/unknown-id, and two-facts. Spot-check confirmed the same result unfiltered and under `--phase 3`, with roles byte-identical.

### 3. A stale unpaired dispatch from an earlier run no longer blocks the gate
expected: A fixture with an unpaired dispatch of the same role from an EARLIER corr plus one open dispatch in the current corr closes the current one; the same fixture on the pre-change code refuses.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `currentRun()` at subagent-trace.mjs:304-317; three named tests green; end-to-end fixture with a 2026-08-09 OLDRUN row plus a current RUN1 dispatch closed the current one, where the pre-change role-only filter sees two rows and refuses.

### 4. Every trace close prose site passes --agent-id
expected: All 11 `trace close` command sites in the prose carry `--agent-id`, and a render over a fixture shows a bracket carrying agent_id for a non-executor role.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: All 11 `trace close` command lines across cadence-core/workflows and cadence-core/references carry `--agent-id`; no command line exists elsewhere in shipped prose. seam-spawn-agent.md:150-183 states both hook writes and keeps exactly one `ONE statement` marker. Renders show cad-verifier brackets carrying agent_id.

### 5. Live stops produce brackets carrying both cache keys
expected: After a terminal stop, a not-terminal stop and a two-open pair on the live host, each produces a bracket carrying both cache keys, each equal to the sum subagent-transcript.mjs reports for that worker's own transcript; roles.tokens is byte-identical with and without a fact present. Baseline 2026-08-26: 0 of 2,363 events carry a cache key. (human-verify: needs live host SubagentStop dispatches after the change - a fixture cannot produce them)
criterion: AC5
status: fail
first_pass: fail
reported: looks like a fail to me
severity: major
cause: The SubagentStop hook fired 22s into a 378s run and summed a partial transcript. The bracket carries 52918/528568; cacheOf over the same worker's completed transcript reports 100439/2115871 - 25% of the real cache_read. D-11's fill-only-empty fold then made the partial figure permanent: the later close at 19:22:37 could not correct it. CONTEXT.md's flagged assumption 'SubagentStop fires at most once per worker' is measured FALSE by this run.
fix: routed to /cad-plan

### 6. Phase 2's prefix recovery is measured before and after
expected: The spike records the comparison for one role - before-side from cacheOf over transcripts predating 8ca0dfdc, after-side off the brackets AC5 produces - with its method and its asymmetry stated, including the case where the recovery is zero. (human-verify: depends on AC5's post-change dispatches)
criterion: AC6
status: skipped
reported: skip
reason: The after-side input is the bracket figure item 5 just failed - a partial-transcript sum biased low. Filling `### After` from it would write a known-short number into the spike. Blocked until the AC5 fix lands via /cad-plan; the before-side, method, normalisation and read-a-zero clause are already committed.

### 7. Suite, self-verify and the two censuses
expected: `node cadence-core/bin/test.mjs` green, `self-verify` reports no problems, `worker_cache` is registered in the trace producer census, and the flag census still reads 192.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3410/3410 pass; self-verify --root . `problems: []`; WORKER_CACHE in the producer census `known` list at trace.test.mjs:2136; arg-contract.test.mjs:304 still asserts 192.

### 8. A cache fact can land on a bracket from a different run when the host reuses an agent_id
expected: behavior wrong - gate 2a's `closedBracket()` matches agent_id across the WHOLE record with no corr term, and the fact then quotes that bracket's corr and phase, so the fold's corr scope has nothing left to protect
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in a3a29a8f. `node --test cadence-core/bin/subagent-trace.test.mjs` -> 33 pass 0 fail, including the new `stop: a REUSED id does not reach back into a dead run`: a bracket at corr 1-dead9999/phase 1 wearing this id no longer matches, so gate 2a does not fire and gate 2b closes the live dispatch at corr 2-abc1234/plan 2. Full suite `node cadence-core/bin/test.mjs` -> 3411 pass 0 fail (was 3410, +1 for the new test); `self-verify --root .` -> problems: []. `risk-check run --phase 3 --base HEAD~1 --head HEAD` -> matches: [], inconclusive: false, so the blocking risk_surface gate did not fire on this range.
reported: behavior wrong - gate 2a's `closedBracket()` matches agent_id across the WHOLE record with no corr term, and the fact then quotes that bracket's corr and phase, so the fold's corr scope has nothing left to protect
severity: minor
cause: `closedBracket()` at cadence-core/bin/lib/subagent-trace.mjs:250-253 matches agent_id across the whole record with no corr term, and :362 (`closed || mine[0]`) then copies that foreign bracket's corr and phase onto the fact - so D-10's corr-scoped fold has nothing left to protect, because the fact already arrived wearing the wrong corr. Pre-change the same unscoped match was a silent no-op; the write is new surface this phase added. Fix per the verifier: scope closedBracket to the run currentRun() already names for gate 2b, or correct CONTEXT.md's flagged assumption to state a cross-run collision is NOT absorbed.
fix: a3a29a8f, retest

### 9. Dispatch at least two cad-verifier workers on the live host against the merged code, then run `node cadence-core/bin/planning.mjs trace render --dir .planning --phase 3` and check that a cad-verifier bracket carries cache_read_input_tokens and cache_creation_input_tokens equal to `cacheOf` over that worker's own transcript
expected: A terminal stop, a not-terminal stop and a two-open pair each leave a bracket carrying both cache keys; roles.tokens is unchanged with and without the facts. Baseline right now: 2,387 trace lines, 0 cache keys, 0 worker_cache events, 87 phase-3 brackets with 0 carrying a figure.
origin: verifier
why_human: Out of reach, not merely unexercised. The instrument is the host firing SubagentStop after the merge; this pass already exercised the whole hook-to-disk-to-render path against temp .planning trees with piped payloads and it behaves, but only the host can emit a real agent_id and a real transcript_path, and no already-closed bracket can gain a fact retroactively.
status: fail
first_pass: fail
reported: a
severity: major
cause: Duplicate of item 5 (AC5), written by the deep pass before any live stop existed. The one live cad-verifier stop of this session falsified the equality clause: bracket 52918/528568 against cacheOf 100439/2115871 over the same worker's completed transcript, because SubagentStop fired 22s into a 378s run and D-11's fill-only-empty fold froze the partial sum. The roles.tokens clause is separately proven byte-identical (item 2 evidence). A second dispatch was declined as spend that cannot un-falsify a settled result.
fix: routed to /cad-plan, duplicate of item 5

### 10. Once those live brackets exist, fill `### After` in .planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md with the command already recorded there and state the delta against the before figures
expected: A number for cache_read and cache_creation per dispatch, the delta against 1,635,645 / 83,790, and the figure recorded even when it is zero.
origin: verifier
why_human: Depends on the live dispatches above; the before-side, both commands, the normalisation, the asymmetry and the read-a-zero clause are already written and were checked in this pass. Nothing here is a judgement call - it is a data dependency on a host event.
status: skipped
reported: next
reason: Duplicate of item 6, skipped on the same ground: the `### After` section is still the committed PENDING placeholder and its only input is the short bracket figure item 5 failed. Blocked until the AC5 fix lands via /cad-plan.

## Summary

total: 10
passed: 6
failed: 2
pending: 0
skipped: 2
blocked: 0
reworked: 3
