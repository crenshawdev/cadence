---
phase: 1
plan: 1
requirements:
  - TRC-04
  - TRC-06
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/lib/subagent-transcript.mjs
  - cadence-core/bin/subagent-transcript.test.mjs
  - cadence-core/bin/lib/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.test.mjs
---

# Phase 1: Make the record say what happened - Plan 1

## Goal

A close lands on the dispatch it belongs to. A delayed repeat close never steals
the next dispatch of the same worker key, and the `SubagentStop` hook closes the
worker that actually stopped rather than the newest open dispatch of its role.

## Must be true when done

- Replaying `dispatch A, close A, dispatch B, A's delayed repeat, close B` for
  one worker key renders TWO brackets carrying A's and B's own figures, no
  bracket carries a negative `ms`, `unpaired` is empty, and the role's `tokens`
  equals the sum of those two brackets rather than of all three terminals.
- The ordinary two-writer case is unchanged: one dispatch, a figureless hook
  close, then the hand-written close with figures still renders ONE bracket
  carrying every figure, `dispatches: 1`, and the same result in either arrival
  order.
- A `SubagentStop` payload whose transcript shows the worker has not reached a
  terminal entry produces no event at all - nothing is appended to the record -
  while a payload whose transcript could not be read at all still closes the
  bracket it closes today.
- The event the hook writes carries the stopped worker's OWN instant as its
  `ts`, taken off that worker's transcript, so the record stores when the worker
  stopped rather than when the append happened.
- With two open dispatches of one role on the render, a payload whose `agent_id`
  belongs to the OLDER of them closes the older one, quoting its `corr`,
  `phase` and `plan` verbatim.
- `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs`
  reports `ok:true`.

## Context

CONTEXT.md's locked decisions bind this plan: D-01 (the worker key stays
`corr\0phase\0plan` and the `seenTerminals` replay guard is untouched - the fix
lives entirely in the pair branch), D-05 (the discriminator is the TIMESTAMP
relation between a terminal and the head pending dispatch), D-06 (the hook's
close must supply a `ts` or D-05's rule never fires in production), D-07 (the
stop close finds its dispatch through the payload's `agent_id`, joined through
`.planning/reads.jsonl`; the trace's `dispatch` event carries no agent id and
never can), D-08 (`closeForStop` stays PURE and receives new evidence by
injection from `cadence-core/bin/subagent-trace.mjs`, which keeps doing the disk
work) and D-09 (`stop_hook_active` is not a documented `SubagentStop` field, so
the termination gate reads the worker's own transcript through the payload's
`transcript_path`).

Out of this plan: the cache figures, both `duration_ms` readers, and every prose
surface - they are Plan 2, which runs AFTER this one and touches four of the
same files.

## Tasks

### Task 1: Stop a delayed repeat close consuming the next dispatch

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Start at `renderTrace`'s TERMINAL arm, the branch holding
  `pairedRows`, `seenTerminals` and the `pending.shift()` call. In that branch
  the FIFO `pending.shift()`
  hands a delayed repeat close the next genuinely open dispatch of the same
  worker key, which is the steal D-05 names - the tell on the record is the
  stolen row's negative `ms`. Add the timestamp discriminator: before consuming
  the head of `pending`, compare the terminal's own instant with the head
  pending entry's instant through this file's existing `millis` helper, and when
  BOTH parse, the terminal's instant is strictly earlier than the head
  dispatch's, and `pairedRows` already holds a row for this worker key, the
  terminal is a REPEAT CLOSE of that row: it takes the existing repeat arm,
  folds its figures into the row `pairedRows` holds, consumes no pending
  dispatch, opens no bracket, contributes no coordinator span, and funds nothing
  a second time. When either instant is unreadable, or `pairedRows` holds no row
  for that key, today's FIFO pairing stands unchanged - an unreadable clock must
  never silently reclassify a genuine close, which is the posture `millis`
  already states in this file. Leave the worker key and the `seenTerminals`
  replay guard exactly as they are (D-01), and do NOT widen the replay identity
  string: it keys the millisecond on purpose, and the worker-key dedup exists
  precisely because widening that identity would fold two genuine dispatches
  into one bracket.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with a new
  case that replays, on one worker key, dispatch A, close A carrying a token
  figure, dispatch B, A's delayed repeat (its `ts` equal to A's close and
  therefore earlier than B's dispatch), then close B carrying its own token
  figure: `renderTrace(...).brackets` has length 2, the two rows carry A's and
  B's own token figures, neither row's `ms` is negative, `unpaired` is empty,
  and the role's `tokens` equals the sum of those two rows. The three shipped
  dedup tests - `render: a dispatch closed by BOTH writers is exactly one
  bracket`, `render: the two closes render identically in EITHER arrival order`
  and `render: two genuine dispatches on ONE worker key are still two brackets` -
  stay green with their bodies unmodified, as does `fixture: the committed
  verbatim trace renders exactly as it did before this phase`.

### Task 2: Read the worker's own transcript for whether it finished, and when

- **Files:** cadence-core/bin/lib/subagent-transcript.mjs,
  cadence-core/bin/subagent-transcript.test.mjs
- **Action:** Both files are NEW. Add a PURE rule module - no fs, no emit, no process, no Date, the
  same posture `cadence-core/bin/lib/subagent-trace.mjs`'s header states - that
  answers, off a worker's own JSONL transcript supplied by INJECTION, whether
  that worker reached a TERMINAL entry and what instant that entry carries.
  Ground truth measured 2026-08-26 over the 227 subagent transcripts on this
  machine, at `~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`:
  every line is a JSON object carrying `type`, an ISO-8601 `timestamp` and
  `agentId`; assistant lines carry `message.stop_reason`, whose values across
  one 42-assistant worker are `null`, `tool_use` and a single trailing
  `end_turn`, and the last assistant line stopped `end_turn` in all twelve
  transcripts sampled. TERMINAL is therefore: the LAST line of `type`
  `"assistant"` carries a `message.stop_reason` that is a non-empty string other
  than `tool_use` - a `tool_use` stop means the worker is waiting on a tool
  result and a `null` stop is a partial block inside a turn, so neither is a
  worker that finished. Answer THREE states and not two, and state the reason in
  the module header: terminal, not-terminal, and UNKNOWN for a transcript that
  is absent, empty, unparseable or carries no assistant line at all. The third
  state exists so an absent transcript degrades to today's behaviour rather than
  silently deleting closes the hook writes today, which is the failure a
  two-state answer would ship the first time the host stops supplying the file.
  A truncated final line is SKIPPED rather than fatal, the posture
  `cadence-core/bin/planning/core.mjs`'s `readReadsRecords` states for the same
  append-mid-write hazard. Never throw: the only caller is a hook with no stream
  to report a fault on. Record in the header the CONTEXT flagged assumption this
  rests on - the Claude Code sub-agents documentation states the transcript
  layout is not guaranteed stable - and that an unrecognized shape answers
  UNKNOWN rather than guessing.
- **Verify:** `node --test cadence-core/bin/subagent-transcript.test.mjs` shows,
  against injected lines and no filesystem: a transcript whose last assistant
  line stops `end_turn` answers terminal and hands back that line's `timestamp`
  string byte for byte; one whose last assistant line stops `tool_use` answers
  not-terminal; one whose last assistant line stops `null` answers not-terminal;
  an empty input, an input of unparseable lines, and an input with user lines
  only each answer unknown; and a trailing truncated line does not change the
  answer the complete lines before it produced.

### Task 3: The hook writes nothing for a worker that has not stopped, and stamps the one that has

- **Files:** cadence-core/bin/lib/subagent-trace.mjs,
  cadence-core/bin/subagent-trace.mjs,
  cadence-core/bin/subagent-trace.test.mjs
- **Action:** Start at `closeForStop` and the THREE GATES header above it. Wire
  task 2's rule in by INJECTION (D-08): the disk half,
  `cadence-core/bin/subagent-trace.mjs`, resolves the payload's documented
  `transcript_path`, reads it under a stated byte ceiling and hands what it read
  to `closeForStop` as a further argument; `closeForStop` itself stays pure and
  does no I/O. The termination gate runs BEFORE the adoption gate and before the
  render is consulted - a worker that has not stopped must produce nothing
  whatever the record holds - and it answers null ONLY on not-terminal, never on
  unknown, so a payload with no `transcript_path` or an unreadable file still
  produces the close it produces today. When the evidence names the terminal
  entry's instant, the returned event carries it as `ts`, so
  `lib/trace.mjs`'s `renderEvent` stores the worker's own stop time instead of
  stamping `new Date()` at append; without it task 1's ordering rule can never
  fire in production, because a delayed hook close would be stamped after the
  next dispatch it is meant not to steal (D-06). Pick the byte ceiling from the
  measurement and state it at the read: the 227 subagent transcripts here run
  115 B to 1,720,223 B with a p90 of 1,202,173 B and parse in about 1 ms against
  the hook's 10-second `hooks/hooks.json` timeout, so a ceiling comfortably
  above the measured maximum costs nothing and bounds an unbounded read inside a
  hook; above the ceiling the answer is unknown, not a partial parse. Change no
  registration in `hooks/hooks.json` - no new event, and the existing timeout
  has two orders of magnitude of headroom. Update the shipped test `stop: the
  event carries NO figure of any kind`, which pins the event's key set at
  exactly six: `ts` is a seventh key on the transcript-backed arm, and the
  assertion that `tokens`, `turns`, `duration_ms` and `detail` are absent stays
  exactly as it is.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` shows: a
  payload whose injected transcript ends on a `tool_use` assistant entry
  produces `null` even with an open dispatch of its role on the render; a
  payload whose transcript ends on a terminal assistant entry produces an event
  whose `ts` equals that entry's `timestamp`; and a payload with no transcript
  evidence at all produces the same event it produces today, with no `ts` key
  present (checked by `in`, never against a null). All six shipped tests in that
  file still pass.

### Task 4: The stop close adopts the dispatch its agent_id belongs to

- **Files:** cadence-core/bin/lib/subagent-trace.mjs,
  cadence-core/bin/subagent-trace.mjs, cadence-core/bin/subagent-trace.test.mjs
- **Action:** Start at GATE 2 inside `closeForStop`. Replace its "adopt the NEWEST open dispatch of that role"
  with the agent-identity join D-07 names, keeping ADOPT-NEVER-DERIVE intact:
  the identity fields are still quoted verbatim off the adopted `unpaired` row
  and nothing is derived from `agent_type`. The evidence is injected by the disk
  half out of `.planning/reads.jsonl`, whose path `cadence-core/bin/lib/read-trace.mjs`
  exports as `readsPath` and whose record shape that file's `recordFromHook`
  writes; measured 2026-08-26, this repository's file holds 32,302 records of
  which 19,670 carry `agent_id`, spelled exactly as the `SubagentStop` payload
  spells it (`a1852a9b36a6c52b8`), and it reads and parses whole in 19 ms. The
  rule: take the EARLIEST `ts` among records whose `agent_id` equals the
  payload's, then among the render's `unpaired` rows of the mapped role keep
  those whose `ts` is at or before that instant and adopt the LATEST of them.
  The FALLBACK is stated rather than silent - when the payload carries no
  `agent_id`, when no read record carries it, or when no open dispatch of that
  role precedes its first read, today's newest-open adoption stands, so no close
  this hook writes today is lost. State the accepted cost in the header the way
  the current one states its own: two same-role workers dispatched in one batch
  whose first reads interleave can still cross, because the trace's `dispatch`
  event is written before the subagent exists and can never carry an agent id.
  Do NOT import `cadence-core/bin/planning/core.mjs` into the hook to reuse its
  `readReadsRecords` - that is a planning-seam function and importing it drags
  the whole seam into a hook process; the disk half does its own guarded read,
  as it already does its own `planningRoot` walk. Do not add an agent id to the
  dispatch event: D-07 forecloses it.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` shows a
  fixture with two open `cad-executor` dispatches - plan `1` at T0 and plan `2`
  at T10, the newest - plus injected read records whose earliest entry for the
  payload's `agent_id` sits at T5: the returned event quotes plan `1`'s `corr`
  and `plan`, not plan `2`'s. The same fixture with NO read evidence still
  adopts plan `2`, and the shipped self-filter, no-match, no-`agent_type` and
  unreadable-timestamp tests stay green. Then `node cadence-core/bin/test.mjs`
  is green and `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

- Plan 2 of this phase touches four of this plan's files
  (`cadence-core/bin/lib/trace.mjs`, `cadence-core/bin/trace.test.mjs`,
  `cadence-core/bin/lib/subagent-trace.mjs`, `cadence-core/bin/subagent-trace.mjs`)
  plus both files task 2 creates, so `plan-overlap` reports overlaps for this
  phase and the two plans MUST run sequentially, this one first. The split is
  the task ceiling's, not an independence claim.
- CONTEXT records that D-05's ordering rule is a no-op on today's live record -
  measured over 386 brackets and 342 worker keys, 0 negative-`ms` brackets and 0
  keys where a terminal precedes an already-seen dispatch - so task 1 is proven
  by fixture and nothing on the committed record moves.
- The `.planning/reads.jsonl` this repository carries is 6,767,339 B against
  `lib/read-trace.mjs`'s 8,388,608 B write cap. That is the same class of
  problem as GH-138 and is explicitly out of this phase; task 4 only reads the
  file.
