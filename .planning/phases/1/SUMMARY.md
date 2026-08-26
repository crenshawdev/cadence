---
phase: 1
status: complete
completed: 2026-08-26
---

# Phase 1: Make the record say what happened - Summary

A bracket now names the worker it belongs to rather than inferring one from clocks, carries the two prompt-cache figures that live only in the worker's transcript, and the worker's own `duration_ms` has two readers - and the cache figure was measured wrong by 1.91x before this phase ended.

## What shipped

- The repeat-close discriminator, so a delayed close cannot consume the next dispatch of the same worker key - `cadence-core/bin/lib/trace.mjs`
- `lib/subagent-transcript.mjs` - a pure rule for whether a worker's transcript says it finished, when it stopped, and what cache traffic it billed
- The `SubagentStop` termination gate: a worker that has not stopped produces no event at all - `cadence-core/bin/lib/subagent-trace.mjs`
- Worker identity on the record instead of in a heuristic: `trace close --agent-id`, carried onto the bracket row, read by the hook as an equality test - `cadence-core/bin/planning/trace.mjs`, `lib/arg-contract.mjs`, `lib/trace.mjs`
- Cache figures on the bracket row, kept out of the `roles` token bill - `cadence-core/bin/lib/trace.mjs`
- `/cad-report`'s `worker minutes` beside `step minutes`, and `/cad-suggest`'s R8 receipt in the worker's own clock - `cadence-core/bin/lib/trace-suggest.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | d14cbf47 | A delayed repeat close stops stealing the next dispatch |
| 1 | 2 | 3d2e82ae | A pure rule for whether a worker's transcript says it finished |
| 1 | 3 | d0b6b0bc | The stop hook writes nothing for a worker that has not stopped |
| 1 | 4 | cad5cffd | The stop close adopts the dispatch its `agent_id` belongs to |
| 1 | gate | 4fbf7280 | First attempt at the identity join (superseded, see Deviations) |
| 1 | gate | 426163a0 | The stop close is bound by agent id, not inferred from clocks |
| 2 | 1 | 46f26326 | Sum the worker's cache traffic off its own transcript |
| 2 | 2 | dbbaab8a | The stop hook records the cache traffic only it can see |
| 2 | 3 | 5f6c5d84 | The bracket row records cache traffic and the roles bill does not |
| 2 | 4 | 1050790d | The stop hook carries the figures the return never renders |
| 2 | 5 | 374ecadd | `/cad-report` prints the worker's own clock beside the step's |
| 2 | 6 | 8c80abe3 | `/cad-suggest` prints a receipt in the worker's own clock |
| 2 | gate | 4a1af326 | One message is billed once, however many lines it occupies |
| - | - | 3555931b | The stop hook carries none of the RETURN's figures (doc correction) |

## Deviations

- [deviation, plan 1 gate] The `risk_surface` review refuted plan 1's identity join as shipped in `cad5cffd`: `adoptByAgentId` picked the latest dispatch at or before the worker's first read, which crosses two workers on the parallel path, where both executors are dispatched in one message and both dispatch events land before either worker reads. A first repair (`4fbf7280`) was itself refuted on the narrowed round - it fell back to the same heuristic whenever an already-closed worker appeared in `reads.jsonl`, and it silently dropped legitimate closes when an open dispatch had an unreadable `ts`. It was reverted. The design changed instead of the heuristic: `426163a0` puts the host's own worker id on the CLOSE, where the orchestrator alone can supply it, and the hook became an equality test plus a single-open-dispatch check. This deleted `adoptByAgentId`, the newest-open fallback, and the whole `reads.jsonl` read the hook did on every stop (6.7 MB on this repository).
- [deviation, plan 1 CONTEXT] D-07 specified the join through `.planning/reads.jsonl` on the reasoning that the `dispatch` event can never carry an `agent_id`. That premise is true and the conclusion drawn from it was not: the CLOSE can carry it. See the CONTEXT annotation.
- [deviation, plan 2 task 6] The task's Verify asserts `arg-contract.test.mjs` still counts 190 flag entries; it reads 191 as of `426163a0`, which added the `trace close --agent-id` row and re-pinned the census marker under D-12. This task added no flag, so the count is unchanged by it and the test is green at 191.

## Open items

- `cacheOf` ignores an entry whose `message.id` is missing, counting it rather than folding it. Correct for the shape measured, but a host that stops writing ids would silently return to per-line billing with no test failing.
- The transcript read checks only `statSync().size`, never `isFile()`. A character device or FIFO at `transcript_path` would block or exhaust memory in the hook. Needs a hostile path from the host process, which is why it was adjudicated medium rather than high.
- The stop payload's `agent_id` is never compared against the `agentId` inside the transcript the termination gate reads. A payload pairing one worker's id with another's transcript would let the wrong terminal authorise a close. No realistic producer - the host composes both fields in one payload - so adjudicated low.
- The blocking re-arm cap is counted per `(trigger, corr)` with no plan term, so plan 1's narrowed round spent plan 2's. Plan 2's blocker was fixed and tested but could not be re-reviewed. The cap is meant to bound one fire's fix loop; keyed per run it disarms every later plan's gate in the same phase.
- `risk-check status` takes one `--base/--head` pair but reports every plan in the run against it, so the plan not being asked about always reads `unfired` and the envelope answers `ok:false`. Each plan answers `recorded` when queried with its own range.
- The last-assistant `stop_reason` is not always `end_turn`: measured over 303 subagent transcripts, 48 (16%) answer NOT-TERMINAL and so get no hook close. Accepted cost, stated in `lib/subagent-transcript.mjs`'s header, and it degrades to the visible `unpaired` rather than to a wrong row.
- The host labels the subagent id internal and instructs against surfacing it in replies. The design writes it to `.planning/trace.jsonl`, which is a local record rather than a reply, but no dispatch in this phase passed `--agent-id` for that reason - so the identity join is shipped and not yet exercised in this repository's own record.

## Goal check

The phase goal was that the three figures the rest of the cycle argues from be correct, consumable and complete. Two of the three are demonstrably there. A repeat close no longer steals the next dispatch's bracket: the discriminator landed in `d14cbf47` and the stronger guarantee landed in `426163a0`, where the hook refuses rather than guesses - `subagent-trace.test.mjs` is 17 of 17 with a regression test for the exact stolen-bracket ordering. The worker's own duration has two readers, `/cad-report`'s `worker minutes` column (`374ecadd`) and `/cad-suggest`'s R8 (`8c80abe3`), each naming the two clocks apart and printing `unrecorded` rather than `0`.

The third, TRC-05's cache figures, is the one worth reading closely. They are recorded (`46f26326`, `dbbaab8a`, `5f6c5d84`) - and the blocking review found the summation was billing one message once per content block, which this file's own header had documented as the host's line shape all along. Measured over 199 real subagent transcripts on this machine, the shipped figure was 1,119,841,751 cache-read tokens against a true 585,293,789: 1.91x, on the single number the requirement exists to make measurable. `4a1af326` folds by `message.id` and the guard now requires a non-negative safe integer. So the figure is correct as of this phase, but it was wrong for six commits, and nothing in the plan would have caught it - it took the gate.

What is NOT proven here: no dispatch in this phase passed `--agent-id`, so the identity join is exercised by tests and by a scratch smoke, never yet by this repository's own record. Phase 2 or verification should confirm a real parallel run produces two brackets with two ids. `node cadence-core/bin/test.mjs` is 3357 pass / 0 fail / 1 skipped (pre-existing) and `self-verify` returns `ok:true` with no problems.
