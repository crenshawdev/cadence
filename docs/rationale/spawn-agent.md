# Why the spawn-agent seam is shaped this way

Companion to `cadence-core/references/seam-spawn-agent.md`. **Not read at
runtime** - no workflow, skill or agent loads this file, and it is outside every
budgeted prose surface.

Read it before EDITING that seam's turn bound, its bracket rule or the
`workflow.max_dispatch_tokens` defaults.

## The window ceiling and the standing exposure

- A window CEILING that is READ, never applied. Six
  `workflow.max_dispatch_tokens` keys - one per dispatched role but
  `cad-mapper`, which has none - say how large
  a dispatch's context window may get before the record calls it a finding, and
  `cadence-core/bin/planning.mjs` compares them against the record AFTER the
  fact. The budgeted quantity is the `tokens` on a `brackets[]` row of the
  rendered `.planning/records/trace.jsonl`: the terminal lifecycle event's figure, read
  as a FINAL-WINDOW PROXY rather than as a sum across the dispatch's turns,
  because that is the one window-shaped number the host hands back on a return
  and Cadence records no other and captures none for itself. This adds no second
  bound to the seam's turn bound: `maxTurns: 200` is still the only bound the
  seam has, because a ceiling read after the return is not a bound at dispatch
  time. Nothing can resize or cancel a dispatch already running - the same
  sentence that got the wall-clock key deleted in v2.7.0 - so a crossing is a
  REPORT and never a refusal, and the run it describes has already completed by
  the time anything reads it.
- THE STANDING EXPOSURE the ceiling above rests on, stated once because nothing
  in Cadence can fix it. Cadence reads THREE figures off a subagent return, and
  every one of them is copied by hand out of the host's own rendering of `Done
  (N tool uses - X tokens - Ys)`. There is no API handing them over.
  - The TOKEN count. It funds the per-role accounting in the rendered record's
    `roles` block and is the quantity the six `workflow.max_dispatch_tokens`
    ceilings above are compared against, so a change in how it prints empties
    both at once.
  - The TOOL-USE count, copied onto the close as `--turns`. A run's price is
    turns times window, so the token half alone can say what a worker returned
    and never what it cost to get there.
  - The DURATION, copied onto the close as `--duration-ms`. It is the only
    figure for how long the WORKER ran: the `ms` on a `brackets[]` row is
    dispatch-to-close wall clock and includes the orchestrator's own time
    between the two writes.
  Anthropic can change that rendering in any release, with no deprecation
  window and no version the seam can test for. `cadence-core/bin/weight-budgets.json`
  is the half of the same picture that does NOT depend on the host - it bounds
  the bytes Cadence puts INTO a dispatch, which is why a byte budget and a
  token ceiling are two controls and not one restated.
  THE MITIGATION IS ALREADY IN FORCE and is not work this states as owed: a
  return carrying no figure OMITS the flag rather than sending `0`, and the
  renderer keeps `unrecorded` distinct from a recorded zero (`turns_unrecorded`
  for the tool-use half, an absent `duration_ms` key for the wall clock). So a
  rendering change degrades the record to "this run was not measured" -
  visible, countable, and never a fabricated zero that reads as a measurement.
- Where those numbers come from. Each default is that role's 75th-percentile
  terminal `tokens` figure on this repo's own record, rounded UP to the next
  25,000, measured 2026-08-17 over every `return` and `checkpoint` event
  carrying a numeric `tokens`: `cad-planner` 200000 (n=28, p75 188,135, max
  247,585), `cad-executor` 200000 (n=72, p75 182,631, max 275,285),
  `cad-verifier` 100000 (n=24, p75 82,633, max 131,728), `cad-reviewer` 150000
  (n=2, p75 125,100), `cad-plan-checker` 75000 (n=5, p75 64,203, max 88,078),
  `cad-assumptions-analyzer` 150000 (n=25, p75 145,054, max 188,149). That rule
  fires on 26 of the record's 156 tokens-bearing terminals and on none of its
  middle, which is what keeps a crossing worth reading rather than half of every
  run. The numbers are config keys rather than a manifest pinned beside the
  check because the quantity is per-PROJECT: a repository whose files are twice
  this one's size needs different ones, and re-pinning is not a plugin release.

## Who writes a close

The caller is no longer the only WRITER of a close, and is still the only one
that can carry the three figures the seam's bracket rule names: the host's `SubagentStop` hook
(`cadence-core/bin/subagent-trace.mjs`) now makes TWO different writes, and
they carry different identity. When it CLOSES - a session that died between
the two halves, a return nobody billed - it adopts the open bracket the
caller's `trace close` line never reached and carries THAT bracket's identity plus the stopped
worker's OWN `agent_id`, so a bracket the hook closed is joinable rather than
a dead end. When it CANNOT claim
a close - a worker that had not stopped when the host fired, a worker whose
bracket the caller had already closed, a worker whose role has two open
dispatches the evidence cannot separate - it writes a bracketless lifecycle
fact instead, `worker_cache`, claiming no bracket and carrying the stopped
worker's OWN `agent_id` alongside the `corr` and `phase` every lifecycle event
carries. The name stays `worker_cache` while its meaning widens - from the two
cache figures to what the hook read off the worker's own transcript, the
`effort` it ran at and the `rung` it was dispatched under included - because a
rename orphans every fact already written, here and on every other project's
record. BOTH writes now carry the same four values: the cache figures
`cache_creation_input_tokens` and `cache_read_input_tokens`, `effort`, the level
that worker's own transcript says the host actually served it, and `rung`, the
one it was DISPATCHED under. The pair is the point - the record states what a
rung was routed at beside what it ran at, so a reader can see them disagree, and
on Claude Code 2.1.258 they do: a `max` dispatch with extended thinking off runs
at `high` and nothing announces it. `effort` and `rung` are OMITTED together
where the transcript reported no effort, the same absent-is-not-zero rule
`--agent-id` follows in the seam's bracket rule. The three the transcript answers - both cache
figures and `effort` - come off the stopped WORKER's own transcript, which the
stop payload names on `agent_transcript_path` - never the `transcript_path`
every hook event carries, which names the caller's own SESSION and is a
different actor's traffic entirely. `rung` is the one value off the payload and
it is `agent_type`'s stem through the one rung table, never the payload's own
`effort`, which carries the CONFIGURED level and cannot see that downgrade. That fact is
joined to a bracket at render time on `corr` plus `agent_id` - which is
exactly why `--agent-id` rides the caller's own close line: without it there, no
bracket in the record carries the id the fact would need to join against,
and the same flag on every close that reads a subagent return gives the fact
somewhere to land. The split is WHERE A FIGURE LIVES: `--tokens`,
`--turns` and `--duration-ms` are rendered on a return only the caller sees,
and the cache figures are rendered on no return at all, which is why they have
no flag on the close line and why the hook is their only possible writer. They ride the
`brackets[]` row and never the `roles` token bill. So the caller keeps writing its close line. It is a permanent FALLBACK rather than a
duplicate to prune: `/cad-task`'s phase-0 bracket has no subagent behind it for
any hook to close, and a hook-only design goes silently quiet on a host rename.
Two closes of one dispatch render as ONE bracket in either arrival order -
`cadence-core/bin/lib/trace.mjs`'s worker-key dedup folds whichever arrived second into the row
the first opened, filling only the fields that row left empty - except the two
cache figures, where the LARGER read wins, because they have one writer and two
values for one worker are two reads of a transcript that only grows.
