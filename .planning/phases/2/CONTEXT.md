# Phase 2: Make the cache figures reach the record - Context

Gathered: 2026-08-26
Feeds: /cad-plan 2

## Scope boundary

In: TRC-07 - the two prompt-cache figures reach the bracket for every worker
that STOPPED, not only the ones the `SubagentStop` hook could both identify and
call terminal. That means a new cache-only lifecycle fact written on all three
withholding gates, a render-time fold joining it to its bracket, `--agent-id`
spread to every `trace close` prose site so a non-executor bracket is joinable
at all, and gate 2b's candidate set scoped to the current `corr`.
Out: the cost itself - the declared-bytes bound (BUD-03), the risk-routing
floor (RSK-05) and the shared rung prefix (RNG-03) are phase 3; the coverage
and detector gaps (COV-02) are phase 4. `trace.jsonl` rotation stays out -
GH-138 owns it, and D-14 accepted the 1 MiB cap for this cycle. Re-opening
phase 1's cache denomination (sum vs max vs first-turn) is out: shipped code
already answers it and D-06 records where.
Deferred: none.
Plan shape: multiple plans - the hook-and-renderer seam (AC1-AC4, AC6, AC7)
splits from the nine-site `--agent-id` spread and its D-13 byte re-measures
(AC5), the same way phase 1 split its two seams.

## Durable decisions

- D-01 (join key): every one of the nine `trace close` prose sites passes
  `--agent-id`, not just the executor's. Evidence: `cadence-core/workflows/execute.md:230`
  is today's only one; the other eight are `cadence-core/workflows/context.md:190`,
  `plan.md:254`, `plan.md:448`, `task.md:219`, `verify-deep.md:19`,
  `decision-review.md:63`, `minimalism-review.md:90`,
  `cadence-core/references/plan-revision.md:23,:52`, `references/review-triggers.md:143`.
  Measured 2026-08-26 on this repository's record: 1 of 391 brackets carries
  `agent_id` and 0 carry either cache key, so an `agent_id`-only join would
  deliver for `cad-executor` and orphan every other role's fact. The rejected
  alternative was a worker-key fallback when the bracket carries no id - phase
  1 already refuted a heuristic of that shape (`4fbf7280`, reverted).
- D-02 (fact event name): the cache-only fact is a NEW `lifecycle` event name,
  neither one of the three `TERMINAL` names nor `dispatch`. Evidence:
  `cadence-core/bin/lib/trace.mjs:104,:111,:145` (the exported vocabulary),
  `:699-708` and `:767` (an unrecognised lifecycle name falls through both
  branches and does nothing), `:96` + `:468` (`counts` is keyed by FAMILY, so a
  fifth NAME counts correctly where a fifth FAMILY would not). Spelling it
  `return` would re-enter `seenTerminals`, `pending.shift()` and the
  `funded`/`turnsFunded` accounting, opening a bracket for a worker that never
  returned - AC1 and AC6 fail together.
- D-03 (gate 2b scope): the candidate set gate 2b counts is scoped to the
  current `corr`, not to the role alone. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs` filters `render.unpaired` on
  `row.role` with no `corr` term; `cadence-core/bin/subagent-trace.mjs:109`
  calls `renderTrace(root)` unscoped; `cadence-core/bin/lib/trace.mjs:986-990`
  accumulates `unpaired` for the life of the file, and `:988` shows each row
  already carries `corr`, `phase`, `plan`, `ts` and `role`. Measured
  2026-08-26 over 2,288 events: 11 unpaired rows survive back to 2026-08-09 -
  `cad-executor` x3, `cad-reviewer` x2, `cad-assumptions-analyzer` x2,
  `cad-planner` x2, `cad-verifier` x1 - so a `cad-executor` stop today sees at
  least four "open" dispatches and refuses unconditionally, not in TRC-07's
  stated 5.4% of cases. Widening this to expire unpaired rows outright was
  rejected: it overlaps GH-138's rotation question that phase 1 held out.
- D-04 (phase key): the fact carries a REAL `phase`, read off its candidate
  dispatches, and `renderTrace`'s `--phase` filter gets no carve-out. Evidence:
  `cadence-core/bin/lib/trace.mjs:566` drops any event whose phase misses the
  filter, before any fold can see it; `cadence-core/workflows/progress.md:109`
  and `cadence-core/references/triage-gate.md:143` both pass `--phase`, so a
  carve-out is what would make two readers of one record disagree. Two open
  dispatches of one role in one phase run share a phase, and under D-03 the
  candidate set no longer spans phases, so the hook can always name one.
- D-05 (cache denomination, carried from phase 1 D-03): the figures land on the
  BRACKET row and are never folded into the `roles` block's `tokens`. The new
  arm satisfies this by staying out of the `tokens`/`turns` blocks entirely,
  not by zeroing anything. Evidence: `cadence-core/bin/lib/trace.mjs:957-978`
  (the only two writers of `row.tokens`/`row.turns`), `:1016-1029` (the emitted
  `roles` shape has no cache key), `:357-366`,
  `cadence-core/workflows/report.md:151-153`.
- D-06 (billing semantics, phase 1's open question, now closed): the figure is
  the SUM across a worker's assistant messages, deduplicated by `message.id`,
  each field guarded as a non-negative safe integer. Max and first-turn were
  both considered and rejected in the module's own header. Evidence:
  `cadence-core/bin/lib/subagent-transcript.mjs:141-181`, header `:54-71`
  (1,119,841,751 per-line vs 585,293,789 per-message). Phase 2 does not
  re-litigate this: doing so would change every figure phase 1 recorded and
  strand AC6's baseline.

## Decisions

- D-07 (three gates, not two): all three withholding paths route to the fact.
  Beyond the termination gate and the two-open-dispatch gate TRC-07 names,
  `alreadyClosed` (gate 2a) also returns `null` and loses both figures whenever
  the orchestrator's hand-written close landed first. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs` - gate 0
  (`STOP_STATE.NOT_TERMINAL`), gate 2a (`if (id && alreadyClosed(render, id))`)
  and gate 2b (`if (mine.length !== 1)`) each return before the
  `...cacheOf(transcript)` spread.
- D-08 (plural return): `closeForStop`'s return shape becomes plural and the
  disk half writes each event. Today the JSDoc says `{...}|null` and
  `cadence-core/bin/subagent-trace.mjs:108-110` writes it with a single
  `if (event) appendEvent(...)`, so a terminal stop that must write both a
  `return` and a fact cannot be expressed. D-08 of phase 1 still holds:
  `closeForStop` stays pure and takes its evidence by injection.
- D-09 (post-pass fold): the join cannot ride `renderTrace`'s existing forward
  pass. The fact ordinarily arrives BEFORE the `agent_id` it joins on, because
  the host fires `SubagentStop` before the orchestrator processes the return -
  `cadence-core/bin/lib/trace.mjs:911-918` states exactly that in its own
  words, and the whole fold at `:898-918` runs only inside the
  `TERMINAL.includes(e.event)` branch. A post-pass over collected facts is
  forced.
- D-10 (join scope): the fold matches on `corr` AND `agent_id`, never a
  whole-record `agent_id` equality. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs`'s `alreadyClosed` does the unscoped
  `rows.some(...)` today; measured 2026-08-26 over 1,333 transcripts, 1,323
  distinct ids and 7 appearing in two or more transcripts of the SAME project
  (e.g. `ac43b0a1648f589f8` in two `-code-cadence` sessions).
- D-11 (fill-only-empty): the fold reuses the existing clause rather than
  adding a second overwrite rule. Evidence:
  `cadence-core/bin/lib/trace.mjs:904-918`, specifically `:910` -
  `for (const k of CACHE_KEYS) if (!(k in b) && k in cache) b[k] = cache[k];`
  where `turns`, `duration_ms` and `agent_id` already follow the same rule.
- D-12 (absent, not zero, carried from phase 1 D-04): a stop whose transcript
  reported neither figure writes NO fact at all - not an event with both keys
  omitted, not one with zeros. Evidence:
  `cadence-core/bin/lib/subagent-transcript.mjs:141-181` (`cacheOf` returns
  `{}`), `cadence-core/bin/subagent-trace.test.mjs:321` pins both keys off.
- D-13 (census stays 191): the flag census does NOT move. D-01 spreads an
  existing flag across prose sites rather than adding one, and phase 1's D-11
  forbids a `trace close` flag for figures only a transcript can fill - the
  hook writes through `appendEvent` directly, never the CLI grammar. Evidence:
  `cadence-core/bin/subagent-trace.mjs:108-110`,
  `cadence-core/bin/lib/arg-contract.mjs:875-890`,
  `cadence-core/bin/arg-contract.test.mjs:303-304`,
  `cadence-core/bin/lib/trace.mjs:116-124` ("There is deliberately no
  `trace close` flag for either").
- D-14 (prose pins): `cadence-core/references/seam-spawn-agent.md:160-172`
  states the hook "carries IDENTITY plus the two cache figures", which stops
  being true once the figures can ride an identity-less fact; that paragraph
  changes, and every prose file D-01 edits has its byte budget re-measured per
  phase 1's D-13. Evidence: `cadence-core/workflows/execute.md:244`,
  `cadence-core/bin/prose-agreement.test.mjs:1362-1386`,
  `cadence-core/bin/weight-budgets.json`.
- D-15 (registration surface): the new event name registers in the trace
  PRODUCER census, which asserts producers speak the renderer's exported
  vocabulary, not in `self-verify`'s hook-events check. Evidence:
  `cadence-core/bin/lib/hook-events.mjs:60-76`, `:120-135` (the comparison is
  over `Object.keys(hooks)` - host hook names, nothing about trace events);
  `cadence-core/bin/trace.test.mjs:2089`. This phase registers no new HOST
  hook, so a `HOOK_EVENTS` row would be a dead row the module's own "ONE
  DIRECTION ONLY" note says is deliberately unchecked.

## Acceptance criteria

- [ ] AC1: All three withholding gates record the worker's cache figures and
      still write no `return` - not-terminal, already-closed, and
      two-open-dispatch - demonstrated against fixtures asserting both halves
      in a single render. Phase 1's termination gate is unchanged, not relaxed.
- [ ] AC2: `trace render` folds a cache-only fact onto the bracket for the same
      worker, joined by `corr` and `agent_id`; a bracket that already carries
      cache figures is not overwritten.
- [ ] AC3: With two open dispatches of one role in one phase run, the figures
      reach the bracket whose `agent_id` matches - not the newest, and not the
      first fact to arrive.
- [ ] AC4: A fixture holding an unpaired dispatch of the same role from an
      EARLIER `corr` plus one open dispatch in the current `corr` closes the
      current one; the same fixture refuses today.
- [ ] AC5: All nine `trace close` prose sites pass `--agent-id`, and a render
      over a fixture shows a bracket carrying `agent_id` for a non-executor
      role.
- [ ] AC6: For dispatches run after the change - at least one terminal stop,
      one not-terminal stop, and one two-open pair - every resulting bracket
      carries both cache keys, and each equals the sum
      `cadence-core/bin/lib/subagent-transcript.mjs` reports for that worker's
      own transcript; `roles.tokens` is byte-identical with and without any
      fact present. Baseline 2026-08-26: 0 of 391 brackets carry a cache key,
      and 34 of 198 in-repo transcripts (16.8%, 204,116,763 of 1,212,872,399
      cache-read tokens) are not-terminal.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green, `self-verify` reports no
      problems, the new event name is registered in the trace producer census
      (`cadence-core/bin/trace.test.mjs:2089`), and the flag census still reads
      191.

## Flagged assumptions

- The host guarantees `agent_id` uniqueness - Unclear; measured 2026-08-26 over
  1,333 transcripts, 7 of 1,323 distinct ids appear in two or more transcripts
  of the same project, which may be resumed sessions reusing an id. Only the
  host's own contract settles it. If wrong: D-10's `corr` scope is what absorbs
  it, which is why the join is scoped rather than global; a collision WITHIN one
  `corr` would still land a fact on the wrong bracket.
- `SubagentStop` fires at most once per worker - Unclear; the codebase has no
  evidence either way, and a mid-turn hand-back followed by a real stop would
  produce two facts for one `agent_id`. If wrong: the planner must decide
  whether the second fact is a duplicate to drop or a genuine partial sum to
  add, and D-11's fill-only-empty rule silently picks "drop" without saying so.
- AC6 cannot approach 100% of the transcript corpus, by construction - Confident;
  7.3% of that corpus belongs to agent types `roleOfAgent` refuses by design
  (`general-purpose` 289,749,214, `Explore` 94,083,235, plus `workflow-subagent`,
  `claude-code-guide` and `Plan`), and transcripts do not outlive the record -
  198 in-repo transcripts against 391 brackets. A fact is written at stop time,
  so no already-closed bracket can ever gain one. If wrong in the other
  direction: AC6 gets rewritten as an unreachable percentage and the self-filter
  gets widened to hit it, putting `general-purpose` and `Explore` workers onto
  Cadence role rows.
