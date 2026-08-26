# Phase 1: Make the record say what happened - Context

Gathered: 2026-08-26
Feeds: /cad-plan 1

## Scope boundary

In: the three figures the rest of this cycle argues from - the repeat-close
pairing (TRC-04), the stop close's worker identity (TRC-06), a reader for the
worker's own `duration_ms` (MSR-05), and cache figures on a bracket (TRC-05).
Out: the cost itself. `workflow.max_plan_tasks`, the declared-bytes bound
(BUD-03) and the risk-routing floor (RSK-05) are phase 2; the shared rung
prefix (RNG-03) is phase 2 and consumes this phase's cache figures rather than
landing with them. `trace.jsonl` rotation is out - GH-138 owns it.
Deferred: none. The `stop_hook_active` gate was not deferred but re-aimed: the
field is not documented for `SubagentStop`, so AC3 tests the worker's own
transcript instead of the missing field.
Plan shape: multiple plans - AC1-AC4 are one seam (`lib/trace.mjs` plus
`lib/subagent-trace.mjs`), AC5-AC6 are two readers and a new writer.

## Durable decisions

- D-01 (bracket identity): the worker key stays `corr\0phase\0plan` and the
  `seenTerminals` replay guard is untouched; the repeat fix lives entirely in
  the pair branch. Evidence: `cadence-core/bin/lib/trace.mjs:614-638`,
  `cadence-core/bin/lib/read-trace.mjs:442-443` (`joinReads` keys on the same
  triple), `cadence-core/bin/trace.test.mjs:1595-1612`, v3.7.2 phase 2 D-04.
- D-02 (denomination): `coordinator.wall_ms`, `bracket_ms` and `residue_ms`
  stay denominated in the dispatch-to-close span and are NOT re-based on
  `duration_ms`; the worker figure sits beside them. Evidence:
  `cadence-core/bin/lib/trace.mjs:769`, `:934-967`,
  `cadence-core/bin/lib/trace-suggest.mjs:567-595`. Measured 2026-08-26: only
  6 of 386 live brackets carry `duration_ms`, so re-basing would make 380 of
  them contribute zero worker time and fire R6 on every run.
- D-03 (cache denomination): cache figures land on the BRACKET row and are
  never folded into the `roles` block's `tokens`. Evidence:
  `cadence-core/bin/lib/trace.mjs:777-798` vs `:906-918`,
  `cadence-core/workflows/report.md:151-153` (forbids a second differently
  denominated window number), `cadence-core/bin/planning/trace.mjs:940-964`
  (the six `workflow.max_dispatch_tokens` ceilings compare `brackets[].tokens`).
- D-04 (absent, not zero): "unrecorded" for the wall clock stays the ABSENT
  `duration_ms` key - no `duration_unrecorded` counter, no null. Evidence:
  `cadence-core/references/seam-spawn-agent.md:63-69`,
  `cadence-core/bin/lib/trace.mjs:342-350`,
  `cadence-core/bin/trace.test.mjs:1568-1576`.

## Decisions

- D-05 (repeat close): the steal is `pending.shift()` at
  `cadence-core/bin/lib/trace.mjs:752` consuming dispatch B for a terminal
  belonging to A; the discriminator is the TIMESTAMP relation - a terminal
  whose `ts` precedes the head pending dispatch's `ts` is a repeat close of
  `pairedRows`. Evidence: `:713`, `:751-760`, `:767-799`, `:846-867`.
  Reproduced 2026-08-26 on the six-line fixture: brackets `[1000, 9999]`,
  `roles.tokens` 13221, and the tell is the stolen row's `ms: -240000`.
- D-06 (hook clock): `closeForStop` or its disk half supplies a `ts` for the
  stopped worker rather than letting the renderer stamp append time, or D-05's
  ordering rule never fires in production. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:113-121` (returns no `ts`),
  `cadence-core/bin/lib/trace.mjs:246` (stamps `new Date()`),
  `cadence-core/bin/subagent-trace.test.mjs:52` pins the event's key set.
- D-07 (worker identity): the stop close finds its dispatch through the
  payload's `agent_id`, joined to an open dispatch via `.planning/reads.jsonl`.
  The trace's own `dispatch` event carries no agent id and never can - it is
  written before the subagent exists. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:46-51` (names `agent_id` as the
  fixing field), `cadence-core/bin/lib/read-trace.mjs:226-228`, `:456-509`.
  [corrected by plan-1 deviation: the `dispatch` half indeed cannot carry an
  agent id, but the CLOSE can - the orchestrator learns it on the return - so
  the join is an equality test on the bracket and the `reads.jsonl` join is
  deleted, no timestamp ordering being able to separate two workers dispatched
  in one message]
- D-08 (pure rule): `closeForStop` stays pure and receives new evidence by
  INJECTION from `cadence-core/bin/subagent-trace.mjs`, which keeps doing the
  disk work; AC2 and AC3 run on injected records, not a filesystem. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:66`,
  `cadence-core/bin/subagent-trace.test.mjs:1-17`.
- D-09 (termination gate): `stop_hook_active` is NOT a documented
  `SubagentStop` field, so AC3 gates on the worker's own transcript reaching a
  terminal entry, reached through the payload's documented `transcript_path`.
  Evidence: the field appears nowhere in the tree; `hooks/hooks.json` registers
  only `PreToolUse`, `PostToolUse` and `SubagentStop`; Claude Code hooks
  documentation confirms `transcript_path` on `SubagentStop` and points it at
  the subagent's own file. Restored to scope 2026-08-26 on a Codex review
  rating the premature close HIGH.
- D-10 (duration's reader): `cadence-core/workflows/report.md:85` composes a
  FIXED tuple - `[b.role, b.plan, b.event, b.ms, b.tokens, b.turns]` - so that
  tuple must grow `duration_ms` or AC5 fails with every test green. The render
  envelope already ships `brackets`, so `renderTrace` needs no change.
  Evidence: `cadence-core/bin/planning/trace.mjs:795`, `:907-909`,
  `cadence-core/bin/lib/trace.mjs:797`, `:832`,
  `cadence-core/workflows/report.md:108`, `:119-121`.
- D-11 (cache source): cache figures cannot be hand-copied off a subagent
  return the way tokens, turns and duration are - the host renders three
  figures and no more. The writer reads the `SubagentStop` payload's
  `transcript_path`. Evidence:
  `cadence-core/references/seam-spawn-agent.md:44-58`;
  `.planning/REQUIREMENTS.md:184` (CST-03 records 117,646 recorded against
  2,738,992 actual for `cad-executor`, a 23x gap); measured 2026-08-26, all 10
  most recently modified of 225 subagent transcripts carry both
  `usage.cache_creation_input_tokens` and `usage.cache_read_input_tokens` on
  every `message.usage`.
- D-12 (census pin): any new flag on a `trace <sub>` grammar row moves the flag
  census off 190 and the marker is re-pinned in the same change. Evidence:
  `cadence-core/bin/lib/arg-contract.mjs:875-885`,
  `cadence-core/bin/arg-contract.test.mjs:303-304`.
- D-13 (prose pins): corrections to the close-half rule stay inside the single
  `**The bracket rides the resolve.**` paragraph, and any edited prose file's
  byte budget is re-measured. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:1362-1386`,
  `cadence-core/bin/weight-budgets.json:49`, `:80`, `:120`.
- D-14 (trace cap): the 1 MiB write cap is accepted as-is; growing close events
  with new keys is in scope, rotation is not. Evidence:
  `cadence-core/bin/lib/trace.mjs:93`, `:279-284`; measured 2026-08-26 the live
  file is 555,235 B, 53% of the cap. Filed as GH-138.

## Acceptance criteria

- [ ] AC1: Replaying `dispatch A, close A, dispatch B, A's delayed repeat,
      close B` for one worker key renders two brackets carrying A's and B's OWN
      figures, and `roles.tokens` equals the sum of those two brackets, not of
      all three terminals.
- [ ] AC2: With two open dispatches of one role, a `SubagentStop` payload
      closes the dispatch whose `agent_id` matches rather than the newest one,
      demonstrated against a fixture holding both.
- [ ] AC3: A `SubagentStop` payload whose `transcript_path` shows the worker
      has not reached a terminal entry writes no `return` at all.
- [ ] AC4: The ordinary two-writer case is unchanged - one dispatch, a
      figureless hook close, then the hand-written close with figures renders
      one bracket and `dispatches: 1`.
- [ ] AC5: `/cad-report` and `/cad-suggest` each print a figure sourced from a
      bracket's `duration_ms`, labelled distinctly from the bracket's `ms`, and
      print `unrecorded` rather than `0` when the close carried no wall clock.
- [ ] AC6: A bracket close records cache figures and `trace render` reports
      them; a close carrying none omits the keys rather than writing zeros, and
      `roles.tokens` is unchanged by their presence.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green and `self-verify` reports
      no problems.

## Flagged assumptions

- The subagent transcript's LINE FORMAT carries `usage.cache_*` on assistant
  messages - Likely; measured on 10 of 225 files here, but the Claude Code docs
  describe those fields only as statusline `current_usage` and OTel output and
  do not state they appear in the transcript. If wrong: D-11's writer reads
  nothing, silently by the hook's own contract, and no bracket ever gains a
  cache key while the tests pass on injected fixtures.
- The subagent transcript LAYOUT is not a stable contract - Confident; the
  Claude Code sub-agents documentation states there is no guarantee the
  structure will not change. Mitigated rather than solved: D-11 reads the
  payload's `transcript_path` instead of reconstructing the path, so only the
  file's internal format is exposed, not its location.
- D-05's ordering rule is a no-op on today's record - Confident; measured
  2026-08-26 over the live `trace.jsonl` (555,235 B, 386 brackets, 342 worker
  keys): 0 negative-`ms` brackets and 0 worker keys where a terminal's `ts`
  precedes an already-seen dispatch's `ts`. The defect is real on the retry
  path and currently costs nothing, so AC1 is proven by fixture only.
- How `cache_read_input_tokens` should be summed across a worker's turns -
  Unclear; each assistant message reports its own request's cache read, so
  summing counts one cached prefix once per turn. Whether the figure is the
  sum, the max, or the first-turn creation figure is a billing-semantics
  question the codebase cannot settle. Left to the planner, who must state
  which it chose in the plan.
