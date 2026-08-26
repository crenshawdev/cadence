# Phase 3: Make the cache figures reach the record - Context

Gathered: 2026-08-26
Feeds: /cad-plan 3

## Scope boundary

In: TRC-07 - the two prompt-cache figures reach the bracket for every worker
that STOPPED, not only the ones the `SubagentStop` hook could both identify and
call terminal. That means a new cache-only lifecycle fact written on all three
withholding gates, a render-time fold joining it to its bracket, `--agent-id`
spread to every `trace close` prose site so a non-executor bracket is joinable
at all, gate 2b's candidate set scoped to the current `corr`, and the
before/after prefix-recovery measurement RNG-03 could not make.
Out: `trace.jsonl` rotation - that is phase 4 (TRC-08), and D-14 of the
2026-08-26 gathering accepted the 1 MiB cap for the phases before it. The
declared-bytes bound (BUD-03), the risk-routing floor (RSK-05) and the shared
rung prefix (RNG-03) are phases 1 and 2 and have SHIPPED. The coverage gap
(COV-02) stays deferred. Re-opening the cache denomination question (sum vs max
vs first-turn) is out: shipped code already answers it and D-06 records where.
Deferred: none.
Plan shape: multiple plans - the hook-and-renderer seam (AC1-AC3, AC5-AC7)
splits from the nine-site `--agent-id` prose spread and its D-14 byte
re-measures (AC4), the same way phase 1 split its two seams.

## Durable decisions

- D-01 (join key): every one of the eleven `trace close` prose sites passes
  `--agent-id`, not just the executor's. Evidence:
  `cadence-core/workflows/execute.md:210` is today's only one; the other ten
  are `cadence-core/workflows/context.md`, `plan.md` (two sites), `task.md`,
  `verify-deep.md`, `decision-review.md`, `minimalism-review.md`,
  `cadence-core/references/plan-revision.md` (two sites) and
  `references/review-triggers.md`. Measured 2026-08-26 on this repository's
  record: 7 of 2,363 events carry `agent_id` and 0 carry either cache key, so
  an `agent_id`-only join would deliver for `cad-executor` and orphan every
  other role's fact. The rejected alternative was a worker-key fallback when
  the bracket carries no id - phase 1 of `v3.7.3` already refuted a heuristic
  of that shape (`4fbf7280`, reverted).
- D-02 (fact event name): the cache-only fact is a NEW `lifecycle` event name,
  neither one of the three `TERMINAL` names nor `dispatch`. Evidence:
  `cadence-core/bin/lib/trace.mjs` - the exported vocabulary, the branch where
  an unrecognised lifecycle name falls through and does nothing, and `counts`
  being keyed by FAMILY, so a fifth NAME counts correctly where a fifth FAMILY
  would not. Spelling it `return` would re-enter `seenTerminals`,
  `pending.shift()` and the `funded`/`turnsFunded` accounting, opening a
  bracket for a worker that never returned - AC1 and AC5 fail together.
- D-03 (gate 2b scope): the candidate set gate 2b counts is scoped to the
  current `corr`, not to the role alone. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs` filters `render.unpaired` on
  `row.role` with no `corr` term; `cadence-core/bin/subagent-trace.mjs` calls
  `renderTrace(root)` unscoped; `cadence-core/bin/lib/trace.mjs` accumulates
  `unpaired` for the life of the file, and each row already carries `corr`,
  `phase`, `plan`, `ts` and `role`. Measured 2026-08-26: 11 unpaired rows
  survive back to 2026-08-09 - `cad-executor` x3, `cad-reviewer` x2,
  `cad-assumptions-analyzer` x2, `cad-planner` x2, `cad-verifier` x1 - so a
  `cad-executor` stop today sees at least four "open" dispatches and refuses
  unconditionally, not in TRC-07's stated 5.4% of cases. Widening this to
  expire unpaired rows outright was rejected: it overlaps the rotation question
  phase 4 owns.
- D-04 (phase key): the fact carries a REAL `phase`, read off its candidate
  dispatches, and `renderTrace`'s `--phase` filter gets no carve-out. Evidence:
  `cadence-core/bin/lib/trace.mjs` drops any event whose phase misses the
  filter, before any fold can see it; `cadence-core/workflows/progress.md` and
  `cadence-core/references/triage-gate.md` both pass `--phase`, so a carve-out
  is what would make two readers of one record disagree. Two open dispatches of
  one role in one phase run share a phase, and under D-03 the candidate set no
  longer spans phases, so the hook can always name one.
- D-05 (cache denomination, carried from `v3.7.3` phase 1 D-03): the figures
  land on the BRACKET row and are never folded into the `roles` block's
  `tokens`. The new arm satisfies this by staying out of the `tokens`/`turns`
  blocks entirely, not by zeroing anything. Evidence:
  `cadence-core/bin/lib/trace.mjs` (the only two writers of
  `row.tokens`/`row.turns`; the emitted `roles` shape has no cache key),
  `cadence-core/workflows/report.md`.
- D-06 (billing semantics): the figure is the SUM across a worker's assistant
  messages, deduplicated by `message.id`, each field guarded as a non-negative
  safe integer. Max and first-turn were both considered and rejected in the
  module's own header. Evidence:
  `cadence-core/bin/lib/subagent-transcript.mjs:141` (`cacheOf`) and its header
  (1,119,841,751 per-line vs 585,293,789 per-message). This phase does not
  re-litigate it: doing so would change every figure `v3.7.3` phase 1 recorded
  and strand AC6's baseline.
- D-16 (AC6 measurement source): the prefix-recovery comparison reads its
  before-side from `cacheOf` over transcripts predating phase 2's ship commit
  `8ca0dfdc`, and its after-side off brackets written once this phase lands.
  The asymmetry is recorded as part of the method, not hidden. Evidence: 598
  transcripts under the host's project directory, all predating `8ca0dfdc`
  (2026-08-26); 0 of 2,363 trace events carry `cache_read`, so a before-side
  BRACKET cannot be produced at all. Reading both sides from transcripts was
  rejected: that comparison would pass even if every gate still withheld, and
  so proves nothing about the record this phase exists to fix.

## Decisions

- D-07 (three gates, not two): all three withholding paths route to the fact.
  Beyond the termination gate and the two-open-dispatch gate TRC-07 names,
  `alreadyClosed` (gate 2a) also returns `null` and loses both figures whenever
  the orchestrator's hand-written close landed first. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:187` (gate 0,
  `STOP_STATE.NOT_TERMINAL`), `:199` (gate 2a, `alreadyClosed`) and `:210`
  (gate 2b, `mine.length !== 1`) each return before the `...cacheOf(transcript)`
  spread at `:240`.
- D-08 (plural return): `closeForStop`'s return shape becomes plural and the
  disk half writes each event. Today the JSDoc says `{...}|null` and
  `cadence-core/bin/subagent-trace.mjs` writes it with a single
  `if (event) appendEvent(...)`, so a terminal stop that must write both a
  `return` and a fact cannot be expressed. `closeForStop` stays pure and takes
  its evidence by injection.
- D-09 (post-pass fold): the join cannot ride `renderTrace`'s existing forward
  pass. The fact ordinarily arrives BEFORE the `agent_id` it joins on, because
  the host fires `SubagentStop` before the orchestrator processes the return -
  `cadence-core/bin/lib/trace.mjs` states exactly that in its own words, and
  the whole existing fold runs only inside the `TERMINAL.includes(e.event)`
  branch. A post-pass over collected facts is forced.
- D-10 (join scope): the fold matches on `corr` AND `agent_id`, never a
  whole-record `agent_id` equality. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs`'s `alreadyClosed` does the unscoped
  `rows.some(...)` today; measured 2026-08-26 over 1,333 transcripts, 1,323
  distinct ids with 7 appearing in two or more transcripts of the SAME project
  (e.g. `ac43b0a1648f589f8` in two `-code-cadence` sessions).
- D-11 (fill-only-empty): the fold reuses the existing clause rather than
  adding a second overwrite rule - `for (const k of CACHE_KEYS) if (!(k in b)
  && k in cache) b[k] = cache[k];` where `turns`, `duration_ms` and `agent_id`
  already follow the same rule. Evidence: `cadence-core/bin/lib/trace.mjs`.
  SUPERSEDED 2026-08-26 for the two CACHE keys only, and AC2's "a bracket that
  already carries cache figures is not overwritten" clause is superseded with
  it: for `cache_creation_input_tokens` and `cache_read_input_tokens` the
  LARGER value wins, per key and independently, at all three folding sites.
  The reason is the writer count. `turns`, `duration_ms` and `agent_id` each
  have TWO writers holding part of the truth, so the first value to arrive is
  the authoritative one; these two keys have exactly ONE writer - the
  `SubagentStop` hook summing the worker's own transcript - so two values for
  one worker are two reads of a file that only grows, and keeping the first
  froze a partial sum onto the record permanently. Summing them is refused: it
  would double-bill every turn both reads covered. `.planning/ROADMAP.md`'s
  phase 3 success criterion 2 was amended in the same commit as the code.
- D-12 (absent, not zero): a stop whose transcript reported neither figure
  writes NO fact at all - not an event with both keys omitted, not one with
  zeros. Evidence: `cadence-core/bin/lib/subagent-transcript.mjs:141`
  (`cacheOf` returns `{}`), `cadence-core/bin/subagent-trace.test.mjs:321`
  pins both keys off.
- D-13 (flag census does not move): D-01 spreads an EXISTING flag across prose
  sites rather than adding one, and the hook writes through `appendEvent`
  directly, never the CLI grammar, so there is deliberately no `trace close`
  flag for figures only a transcript can fill. The census constant is 192, not
  the 191 the 2026-08-26 gathering recorded - phase 1 of this cycle added
  `plan-size --max-bytes`. Evidence:
  `cadence-core/bin/arg-contract.test.mjs:303-304`,
  `cadence-core/bin/subagent-trace.mjs`, `cadence-core/bin/lib/trace.mjs`.
- D-14 (prose pins): `cadence-core/references/seam-spawn-agent.md:155` states
  the hook carries identity plus the two cache figures, which stops being true
  once the figures can ride an identity-less fact; that paragraph changes, and
  every prose file D-01 edits has its byte budget re-measured. Evidence:
  `cadence-core/workflows/execute.md:215`,
  `cadence-core/bin/prose-agreement.test.mjs`,
  `cadence-core/bin/weight-budgets.json`.
- D-15 (registration surface): the new event name registers in the trace
  PRODUCER census, which asserts producers speak the renderer's exported
  vocabulary, not in `self-verify`'s hook-events check. Evidence:
  `cadence-core/bin/lib/hook-events.mjs` (the comparison is over
  `Object.keys(hooks)` - host hook names, nothing about trace events);
  `cadence-core/bin/trace.test.mjs:2089`. This phase registers no new HOST hook
  - `hooks/hooks.json:27` already registers `SubagentStop` and is not edited -
  so a `HOOK_EVENTS` row would be a dead row the module's own "ONE DIRECTION
  ONLY" note says is deliberately unchecked.

## Acceptance criteria

- [ ] AC1: All three withholding gates record the worker's cache figures and
      still write no `return` - not-terminal, already-closed, and
      two-open-dispatch - demonstrated against fixtures asserting both halves
      in a single render. The termination gate is unchanged, not relaxed.
- [ ] AC2: `trace render` folds a cache-only fact onto the bracket for the same
      worker, joined by `corr` and `agent_id`; a bracket that already carries
      cache figures is not overwritten; and with two open dispatches of one
      role in one phase run, the figures reach the bracket whose `agent_id`
      matches - not the newest, and not the first fact to arrive.
- [ ] AC3: A fixture holding an unpaired dispatch of the same role from an
      EARLIER `corr` plus one open dispatch in the current `corr` closes the
      current one; the same fixture refuses today.
- [ ] AC4: All eleven `trace close` prose sites pass `--agent-id`, and a render
      over a fixture shows a bracket carrying `agent_id` for a non-executor
      role.
- [ ] AC5: After the change, a terminal stop, a not-terminal stop and a
      two-open pair each produce a bracket carrying both cache keys, each equal
      to the sum `cadence-core/bin/lib/subagent-transcript.mjs` reports for that
      worker's own transcript; `roles.tokens` is byte-identical with and without
      any fact present. Baseline 2026-08-26: 0 of 2,363 events carry a cache
      key. (human-verify: needs live host SubagentStop dispatches after the
      change - a fixture cannot produce them)
- [ ] AC6: Phase 2's prefix recovery is compared for one role, before-side from
      `cacheOf` over transcripts predating `8ca0dfdc` and after-side off the
      brackets AC5 produces, recorded with its method and its asymmetry,
      including the case where the recovery is zero. (human-verify: depends on
      AC5's post-change dispatches)
- [ ] AC7: `node cadence-core/bin/test.mjs` is green (3391 tests at gather
      time), `self-verify` reports no problems, the new event name is
      registered in the trace producer census
      (`cadence-core/bin/trace.test.mjs:2089`), and the flag census still reads
      192.

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

  MEASURED CORRECTION, 2026-08-26. What was actually falsified is not this
  assumption but the premise underneath it, inherited from `v3.7.3` phase 1's
  D-09 and D-11: that the stop payload's `transcript_path` names the WORKER's
  own file. It does not. On the installed host 2.1.246 the `SubagentStop`
  payload is the common hook input plus `stop_hook_active`, `agent_id`,
  `agent_transcript_path`, `agent_type` and an optional
  `last_assistant_message`; `agent_transcript_path` is the worker's file and
  `transcript_path` is the SESSION's - the orchestrator's own conversation.
  That is where the record's single cache-bearing figure came from: 52,918 /
  528,568, exactly `cacheOf` over the orchestrator's session file truncated at
  that event's own `ts`, while the stopped worker's own file sums 100,439 /
  2,115,871.

  The once-per-worker assumption itself is NOT falsified and is NOT settled.
  The one live stop of that day fired once, at the worker's real stop. But an
  async agent re-entered with a follow-up message stops again, so a second fact
  for one `agent_id` remains reachable - and the larger-wins rule recorded
  against D-11 above is what makes that second stop CORRECT the record rather
  than be dropped.

  One more measured fact the next reader needs, re-measured 2026-08-26 against
  this repository's own host: over 1,310 subagent transcripts, 33 of the 34
  written that day answer NOT-TERMINAL, against 1,071 terminal across the whole
  corpus. On this host version the withholding path is the ORDINARY path, so
  AC5's terminal-stop arm is provable from fixtures rather than from a live
  dispatch.
- AC5 cannot approach 100% of the transcript corpus, by construction -
  Confident; 7.3% of that corpus belongs to agent types `roleOfAgent` refuses by
  design (`general-purpose`, `Explore`, `workflow-subagent`,
  `claude-code-guide`, `Plan`), and transcripts do not outlive the record. A
  fact is written at stop time, so no already-closed bracket can ever gain one.
  If wrong in the other direction: AC5 gets rewritten as an unreachable
  percentage and the self-filter gets widened to hit it, putting
  `general-purpose` and `Explore` workers onto Cadence role rows.
- AC6's before-side and after-side are not the same instrument - Confident and
  accepted (D-16); a transcript sum and a bracket figure are the same
  denomination by D-06, but only the after-side exercises the code this phase
  writes. If wrong: the recovery number is right and the proof that the RECORD
  carries it rests on AC5 alone, which is where that proof belongs anyway.
