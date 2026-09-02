# Phase 3: The record states the effort that actually ran - Context

Gathered: 2026-09-02
Feeds: /cad-plan 3

## Scope boundary

In: OQ-2 answered and written down as a spike record before code; a reader
for the effort the host records on a worker's own transcript; the
`SubagentStop` hook carrying that value on every event it writes (the `return`
it can close and the `worker_cache` fact it writes when it cannot) beside the
rung it dispatched; the post-pass fold landing both on the `brackets[]` row;
`/cad-report` printing routed beside ran and stating a disagreement on the row;
the prose, budget rows, DOCS-CLAIMS anchors and tests that move with it; the
`TRC-13` row corrected to name the transcript and traced to this phase.
Out: what to DO about a mismatch (warn, refuse, re-dispatch) - recording it
honestly is the whole phase. Reading `effort` off the hook PAYLOAD - measured
2026-09-02 as the CONFIGURED level, `{"level":"max"}`, on a run whose transcript
records `high`. Validating the host's effort string against Cadence's rung
enum. Repairing the termination gate (below).
Deferred: The hook's `return` path is dead on the installed host - from
2026-08-27 onward 0 of 152 worker transcripts carry a non-null, non-`tool_use`
`stop_reason`, so `terminalOf` answers NOT_TERMINAL on every stop and every
bracket since has been closed by the orchestrator's line alone (114
`worker_cache` facts against 2 hook-written returns on this record). Yet a
2026-09-02 probe worker with no tools wrote `stop_reason: end_turn`. Whether
that is a host change for tool-using workers or a Cadence rule to rewrite is a
separate investigation with its own capture, not this phase.
Plan shape: multiple plans - three natural slices: spike + reader + hook
write; fold + render + report column; prose + budgets + claims + requirement
row.

## Durable decisions

- D-01 (Source of the observed effort): The effort a dispatch RAN at is read
  off the WORKER's own transcript (`agent_transcript_path`) - the top-level
  `effort` string on each `type:"assistant"` line - and never off the hook
  payload, not even as a fallback. Measured 2026-09-02 on Claude Code 2.1.258
  with Opus 5: a headless `--effort max` session with `MAX_THINKING_TOKENS=0`
  records `"effort":"high"` on its assistant line and `"max"` with thinking
  on; a `max`-declared subagent under the same two conditions records `high`
  and `max` on ITS transcript; the Stop and `SubagentStop` payloads carried
  `"effort":{"level":"max"}` in all four runs. The downgrade the 2.1.251
  changelog names ("effort is now sent as `high` in that case") is real and
  silent, and the payload cannot see it. This contradicts `GH-226`,
  `REQUIREMENTS.md:21` (TRC-13) and `ROADMAP.md:170-176`, which all name the
  payload; the transcript is the source and those three are corrected, not
  followed. Evidence: `cadence-core/bin/subagent-trace.mjs` ("NO FALLBACK to
  `transcript_path`"), the upstream CHANGELOG 2.1.251 entry, the four probe
  transcripts and hook dumps (spike record, AC1). If wrong: the record writes
  a routed/ran MATCH on exactly the downgraded runs this phase exists to
  expose.
- D-02 (Which events carry it): The observed effort rides EVERY write the
  hook makes - the `return` when it can close, and the `worker_cache` fact
  when it cannot - and reaches the `brackets[]` row through the same post-pass
  fold that lands the cache keys. On this record 114 facts stand against 2
  hook-written returns (both 2026-08-26), and 108 of the 114 precede the
  hand-written close in file order and by `ts`; putting effort on `return`
  alone records it on zero live dispatches. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:466-497` (every withholding arm),
  `:313-325` (`cacheFact`), `cadence-core/bin/lib/trace.mjs:1704-1712`,
  `:1960-1984` (the fold on `corr` + `agent_id`). If wrong: criterion AC2 is
  met by a test and by nothing on any live record.
- D-03 (The routed side): The rung a bracket is compared AGAINST is the rung
  of the agent file the host says it ran - the `SubagentStop` payload's
  `agent_type` stem mapped back through `RUNG_FILES` - recorded on the same
  hook event beside the observed effort. The default `trace render` envelope
  carries no routing event, so `/cad-report` has no other source; the
  dispatched file's rung is what the host was asked to run and equals the
  routed rung whenever the orchestrator obeyed the resolve, and it joins to
  nothing because it arrives on the same payload. Rejected: putting `plan` on
  `routing/resolve` and joining in the renderer (contradicts phase 1 D-12,
  and a resolve fires on arms with no dispatch); a per-role resolve list
  paired by attempt (a heuristic join TRC-06 refuses). Evidence:
  `cadence-core/bin/planning/trace.mjs:1244-1258`,
  `cadence-core/workflows/report.md:114`,
  `cadence-core/bin/route.mjs:873-880`, `:1350-1364`,
  `cadence-core/bin/lib/read-trace.mjs:1108-1112`,
  `cadence-core/bin/self-verify.mjs:969-983` (check 7b: a rung file's
  `effort:` equals the map's rung). If wrong: the report can state what ran
  and has nothing recorded to state it against.
- D-04 (Verbatim, and absent omits): The host's effort string is recorded
  verbatim in its own spelling with no validation against Cadence's rung
  enum; anything not a non-empty string is absent, and absent OMITS the key
  on the event (phase 1 D-11) - `unrecorded` is something the reader prints,
  never something the record stores. Corpus 2026-09-02: 5,701 of 5,701 recent
  assistant lines carry a top-level string, 0 under `message`; the whole
  368-file corpus carries only `high`, `medium`, `xhigh`; 6 of 368 transcripts
  carry no `effort` at all, so the absent arm is real. Evidence:
  `cadence-core/bin/lib/subagent-transcript.mjs:133-140`,
  `cadence-core/config.schema.json:19-23` (the enum is a CONFIG rule),
  `cadence-core/bin/lib/trace-suggest.mjs:408`,
  `cadence-core/bin/lib/trace.mjs:1991-1993`. If wrong: a renamed host rung
  vanishes as `unrecorded` at exactly the moment it is the signal, or a
  literal `"unrecorded"` lands beside real rungs.
- D-05 (The fact keeps its name): `worker_cache` stays `worker_cache`; its
  documented meaning widens from "the two cache figures" to "what the hook
  read off the worker's own transcript". Rejected: a second fact name
  (`worker_effort`) - two events per stop and a second fold to keep in
  agreement with the first. Evidence: `cadence-core/bin/lib/trace.mjs:229-256`,
  `cadence-core/references/seam-spawn-agent.md:170-176`, `CHANGELOG.md:316-317`
  (the name is shipped prose). If wrong: a rename orphans the 114 facts on
  this record and every fact on every other project's record.

## Decisions

- D-06 (Reader placement): The reader is a third pure function in
  `lib/subagent-transcript.mjs` beside `cacheOf` and `terminalOf`, walking the
  same injected bytes through the existing `assistantEntries` generator; the
  disk half in `bin/subagent-trace.mjs` passes what it already passes.
  Evidence: `cadence-core/bin/lib/subagent-transcript.mjs:82-84`, `:102-123`.
- D-07 (One value per worker): The reader answers a string only when every
  assistant line agrees and absent when they disagree. 0 of 368 transcripts
  mix values. Rejected: last line only; first line only. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:74-86` (TRC-06's "unambiguous or
  nothing").
- D-08 (Effort is a figure): The fact's "nothing to give" test counts effort
  as a figure - a transcript reporting an effort but neither cache key still
  writes the fact. Rejected: keep the cache-only gate (every measured
  assistant line carries `usage`, so the loss is theoretical today).
  Evidence: `cadence-core/bin/lib/subagent-trace.mjs:313-314`, `:215-218`,
  `cadence-core/bin/subagent-trace.test.mjs:631-640`.
- D-09 (Render placement): `effort` and the dispatched rung land on the
  `brackets[]` row, omitted when absent (the `turns`/`duration_ms`/`agent_id`
  rule), and never enter `roles` - an enum has nothing to sum. Evidence:
  `cadence-core/bin/lib/trace.mjs:1820-1842`, `:1244-1290`, `:1991-2012`,
  `cadence-core/bin/trace.test.mjs:3485-3510` (the verbatim fixture pin).
- D-10 (Fold rule): Fill-only-empty (the `agent_id` clause), not the
  larger-wins clause the cache keys use. Rejected: last-writer-wins. Evidence:
  `cadence-core/bin/lib/trace.mjs:1868-1892`.
- D-11 (Report surface): The `/cad-report` Dispatches table gains a ran column
  beside `rung`, prints `unrecorded` where the row carries none, and states a
  disagreement ON the row that disagrees - no separate summary line. Whether
  this is a new surface owing its own test (phase 1 D-15) or a column on the
  existing per-bracket surface is the planner's to name. Rejected: a "Record
  health" count line. Evidence: `cadence-core/workflows/report.md:114`,
  `:125-137`, `.planning/phases/1/CONTEXT.md:149-156`.
- D-12 (Prose and budgets): Every line calling the hook's close "figureless"
  or saying it "carries none of the RETURN's figures" moves, and the three
  budget rows re-pin: `seam-spawn-agent.md` (25,299 B), `execute.md`
  (35,680 B), `report.md` (23,755 B). Evidence:
  `cadence-core/references/seam-spawn-agent.md:162-181`,
  `cadence-core/workflows/execute.md:281-284`, `:600-606`,
  `docs/rationale/execute.md:114`, `cadence-core/bin/weight-budgets.json:49,71,120`,
  `cadence-core/bin/self-verify.mjs:784-821`.
- D-13 (Claims): DOCS-CLAIMS anchors that shift re-pin and no new row is
  added (phase 2 D-14). At risk: REPORT-05/10/12-15 on `report.md`, and
  CONTEXT-09 through CONTEXT-13 on `lib/trace.mjs:58-73`. Evidence:
  `.planning/DOCS-CLAIMS.md:804-808`, `:1167-1177`.
- D-14 (No `--effort` on `trace close`): The hook is the only writer, on the
  cache-figure pattern; the orchestrator's close line copies the four fields
  the host prints and no workflow line shows an effort there, so no
  arg-contract row and no self-verify flag-table change (phase 2 D-15 does
  not fire). Rejected: a flag the orchestrator copies off the return - one
  typo is a false mismatch on the record. Evidence:
  `cadence-core/workflows/execute.md:261`,
  `cadence-core/references/seam-spawn-agent.md:162-164`,
  `cadence-core/bin/lib/subagent-trace.mjs:160-176`.
- D-15 (Tests): `subagent-transcript.test.mjs` gains the reader; the exact
  key-set pins in `subagent-trace.test.mjs` stay green as written (their
  fixtures carry no `effort`, absent means omitted) and gain effort-bearing
  cases; the fact-fold tests in `trace.test.mjs` gain the effort fold; the
  verbatim fixture pin proves an old record renders unchanged. Evidence:
  `cadence-core/bin/subagent-trace.test.mjs:37-43`, `:65-98`, `:429-451`,
  `:501-512`, `:594-618`, `cadence-core/bin/trace.test.mjs:4204-4340`.
- D-16 (Requirement and evidence): `TRC-13`'s text is corrected to name the
  worker transcript rather than the payload; the OQ-2 evidence is written as
  a spike record under `.planning/spikes/` (Question / decision that hinges on
  it / verdict) before code; the Traceability row `TRC-13 | Phase 3` comes
  from `/cad-plan seed-reqs`, never by hand. Rejected: evidence in this file
  only. Evidence: `.planning/REQUIREMENTS.md:21`, `:488-500`,
  `.planning/ROADMAP.md:170-176`, `:183-184`,
  `.planning/spikes/maxturns-cap-behaviour/SPIKE.md:1-25`.
- D-17 (Hook registration unchanged): `hooks/hooks.json` names the script
  path, so the edited hook is live at the next subagent stop in the same
  session and can be UAT'd without a restart. Evidence:
  `hooks/hooks.json:27-33`, `cadence-core/bin/lib/hook-events.mjs:60-78`.
- D-18 (Termination gate is out): The dead `return` path is recorded as a
  capture and not repaired here; the phase records effort honestly on
  whatever the hook writes today. Evidence: `ROADMAP.md:178-180`,
  `cadence-core/bin/lib/subagent-transcript.mjs:42-52`, `:213-214`.

## Acceptance criteria

- [ ] AC1: A spike record under `.planning/spikes/` states the OQ-2
      observation - host 2.1.258, transcript `high` with thinking off and
      `max` with it on for both a session and a `max`-declared subagent,
      payload `{"level":"max"}` in all four - and its commit precedes every
      code commit of the phase in `git log`.
- [ ] AC2: After a subagent stop whose worker transcript carries `effort` on
      its assistant lines, `trace render --phase 3` shows that string
      verbatim as `effort` on the matching `brackets[]` row beside the
      dispatched rung, whether the hook wrote a `return` or only a
      `worker_cache` fact.
- [ ] AC3: A worker transcript with no `effort` on any assistant line
      produces a hook event with no `effort` key and a bracket row without
      it, and `fixtures/verbatim.trace.jsonl` renders byte-identical to its
      pinned output.
- [ ] AC4: `/cad-report` on a phase whose bracket ran at a different effort
      than its dispatched rung prints the disagreement on that Dispatches
      row; a bracket with no observed effort prints `unrecorded` on that row
      and is never shown as agreeing.
- [ ] AC5: `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json`
      and self-verify all pass, including the three re-pinned budget rows
      and the DOCS-CLAIMS anchors.
- [ ] AC6: REQUIREMENTS `TRC-13` names the worker transcript as the source
      and no longer names the payload, and the Traceability table carries a
      `TRC-13 | Phase 3` row.

## Flagged assumptions

- Every Cadence worker transcript since host 2.1.246 carries `stop_reason:
  null` on every assistant line because the host stopped writing it for
  tool-using workers, not because Cadence reads the wrong line - Likely; a
  2026-09-02 probe worker with `tools: []` wrote `end_turn`, and the upstream
  changelog names no transcript-format change. If wrong: the deferred
  termination-gate capture is a Cadence rule to rewrite rather than a host
  change to wait out; nothing in this phase turns on it.
- A `max` rung has never run on this record (0 of 855 resolves, 0 of 368
  transcripts), so the first live routed/ran disagreement will come from a
  user whose thinking is off, not from this repository - Likely. If wrong:
  nothing observable; AC2 and AC4 are proved by fixtures either way.
