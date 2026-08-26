---
phase: 3
plan: 3
requirements:
  - TRC-07
files:
  - cadence-core/bin/subagent-trace.mjs
  - cadence-core/bin/lib/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.test.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/bin/weight-budgets.json
  - .planning/ROADMAP.md
  - .planning/phases/3/CONTEXT.md
  - .planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md
---

# Phase 3: Make the cache figures reach the record - Plan 3

## Goal

The two prompt-cache figures on a bracket are the STOPPED WORKER's, equal to the
sum `cadence-core/bin/lib/subagent-transcript.mjs` reports over that worker's own
transcript - not the orchestrator's session traffic, and not a first read frozen
in place. Plans 1 and 2 built the whole path from gate to bracket and it works;
this plan fixes the evidence that path is fed, so AC5 and AC6 can be measured
instead of failing on a number about the wrong worker.

## Must be true when done

- The figures on a bracket come from the stopped worker's OWN transcript. The
  hook reads the field the host puts the worker's file on, and a payload that
  names no worker file supplies NO evidence rather than the session's.
- A bracket this hook closed carries the worker's host id, so it can be joined
  to at all - and a stop that arrives after its own bracket is closed states its
  figures against THAT bracket instead of adopting a stranded dispatch from a
  run that ended days ago.
- Where one worker's figures reach its bracket more than once, the bracket ends
  up carrying the LARGER read - the more complete one - whoever wrote it, and
  rendering the same file twice gives the same bracket both times.
- The `roles` block is still byte-identical with and without every cache fact in
  the file, and the termination gate still refuses a non-terminal stop rather
  than being relaxed to let one through.
- The written record says which file the hook reads and what the host's stop
  payload actually carries: `cadence-core/references/seam-spawn-agent.md` and
  `.planning/phases/3/CONTEXT.md` no longer rest on the falsified premise that
  the payload's `transcript_path` names the worker's own transcript.
- `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md` states phase 2's
  prefix recovery for `cad-verifier` with an after figure taken off brackets
  written once this plan is live, the delta against the committed before figure,
  and the number recorded even when it is zero.
- `node cadence-core/bin/test.mjs` is green,
  `node cadence-core/bin/self-verify.mjs --root .` reports `problems: []`, the
  flag census still reads 192 and the trace producer census still names exactly
  the five lifecycle event names it names today - this plan introduces none.

## Context

What plans 1 and 2 shipped is not re-planned: `worker_cache`, the three
withholding gates, the post-pass fold, `currentRun`, the plural `closeForStop`
answer and `--agent-id` on all eleven prose sites all stay. CONTEXT.md's D-02,
D-05, D-07, D-08, D-09, D-10, D-12, D-13, D-15 and D-16 bind this plan unchanged;
D-11 (fill-only-empty) is revisited by task 4 on the dispatch's own instruction
and its supersession is recorded rather than silent. Out of scope: `trace.jsonl`
rotation (phase 4), the termination gate's own rule (unchanged, not relaxed), the
sum-vs-max denomination (D-06, shipped), and any new event name, flag or host
hook registration - `hooks/hooks.json` is not edited.

## Tasks

### Task 1: Read the stopped worker's own transcript, not the session's

- **Files:** cadence-core/bin/subagent-trace.mjs (the `readTranscript` call
  inside the `try` block and the module header paragraph above `readTranscript`
  that states what is read and why the path is used as given)
- **Action:** The hook reads `input?.transcript_path`, which is the base field
  EVERY hook event carries and which names the SESSION's transcript - the
  orchestrator's own conversation - not the stopped worker's. The host's
  `SubagentStop` payload carries the worker's file separately. Read that field
  (`agent_transcript_path`) instead. Measured 2026-08-26 against the installed
  2.1.246 binary, the `SubagentStop` hook input is the common input plus
  `stop_hook_active`, `agent_id`, `agent_transcript_path`, `agent_type` and an
  optional `last_assistant_message`, and `agent_transcript_path` is derived by
  the host from the agent id. Measured the same day on this repository's own
  record, this is the whole of AC5's failure: `.planning/trace.jsonl`'s ONLY
  cache-bearing event carries 52,918 / 528,568, which is exactly `cacheOf` over
  `<projects>/-code-cadence/fcd9b475-c978-461d-8856-5ab98daecd62.jsonl` - the
  ORCHESTRATOR's session transcript - truncated at that event's own `ts`, while
  the stopped worker's own file, `.../fcd9b475-.../subagents/agent-a208c6e596ba361db.jsonl`,
  sums 100,439 / 2,115,871. That event's `ts`, `2026-08-26T19:16:18.866Z`, is the
  ORCHESTRATOR's last assistant timestamp, which is also the whole of the
  "fired 22 s into a 378 s run" reading in UAT item 5: the hook ran at the
  worker's real stop and stamped the event with an instant read out of the wrong
  file. Do NOT fall back to `transcript_path` when the worker's field is absent:
  the session transcript is evidence about a different actor, so an absent field
  means NO evidence, which `readTranscript` already expresses as null and which
  `cacheOf` and `terminalOf` already answer as `{}` and `unknown` - the behaviour
  this hook had before it read any transcript at all. Everything else about the
  read is unchanged and must stay: the path is used AS GIVEN and never
  reconstructed from a session id and a project slug, the 8 MiB ceiling stands,
  every failure is silent, nothing reaches any stream and the exit is 0. Rewrite
  the header paragraph to name the field and to say why the session transcript is
  the wrong file for all three answers this hook takes off a transcript - it made
  `terminalOf` read the ORCHESTRATOR's `end_turn` and call the worker finished,
  and it made both cache sums the orchestrator's traffic to that instant.
- **Verify:** Build a temp `.planning` holding one open `cad-verifier` dispatch
  plus two transcript files: a "session" file whose assistant entries bill one
  pair of cache figures and end on a terminal `stop_reason`, and an "agent" file
  billing a different, larger pair and ending on a `null` `stop_reason`. Piping a
  `SubagentStop` payload naming that `cwd`, a `cadence:cad-verifier` agent type,
  an `agent_id`, the session file as `transcript_path` and the agent file as
  `agent_transcript_path` into `node cadence-core/bin/subagent-trace.mjs` appends
  exactly one line, that line is a `worker_cache` fact carrying the AGENT file's
  two figures and neither of the session file's, and no `return` is appended -
  where today's code appends a `return` carrying the SESSION file's figures. The
  same payload with `agent_transcript_path` removed appends exactly one `return`
  carrying neither cache key. The process prints nothing on either stream and
  exits 0 in both runs. `node cadence-core/bin/test.mjs` is green.

### Task 2: The hook's own close carries the worker's id

- **Files:** cadence-core/bin/lib/subagent-trace.mjs (the terminal `return`
  `closeForStop` answers at GATE 3 plus the header's GATE 3 paragraph),
  cadence-core/bin/subagent-trace.test.mjs
- **Action:** The unambiguous terminal path answers a `return` carrying `corr`,
  `phase`, `plan`, `role`, `ts` and the two cache figures, and never the
  payload's `agent_id` - although `agentIdOf` has already read it and the
  cache-only fact beside it carries it. So a bracket THIS writer closed carries
  no id, and three things follow: the post-pass fold plan 1 built can never reach
  such a bracket, `closedBracket` cannot recognise the worker if it stops again,
  and AC4's eleven-site `--agent-id` spread only ever helps the brackets the
  ORCHESTRATOR closed. Put the payload's `agent_id` on that event, OMITTED when
  the payload carries none - the omit-never-null rule `ts` already follows two
  lines above it. This is evidence the rule can SEE, the same field on the same
  payload the fact already quotes, not a derivation or a fallback, so nothing
  about TRC-06's "unambiguous or nothing" changes. The repeat-close arm in
  `cadence-core/bin/lib/trace.mjs` already folds `agent_id` fill-only-empty, so a
  hand-written close carrying the same id afterwards changes nothing on the row.
  Two existing cases assert the terminal event's EXACT key set - the one pinning
  that the hook invents no figure and the one pinning the two cache figures - and
  both pass a payload that carries an id; extend their key lists rather than
  weakening them, because what they exist to pin is that no `tokens`, `turns`,
  `duration_ms` or `detail` is invented, and an id the payload supplied is
  neither invented nor a figure.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` is green
  with a case pinning `agent_id` on the terminal return for a payload that
  carries one and pinning its ABSENCE from the returned event for a payload that
  does not. End to end: a temp `.planning` with one open dispatch, a payload
  carrying an `agent_id` and an agent transcript whose last assistant entry
  carries a terminal `stop_reason`, piped into
  `node cadence-core/bin/subagent-trace.mjs`, then
  `node cadence-core/bin/planning.mjs trace render --dir <that .planning>` shows
  one bracket carrying that `agent_id` - where today's code renders that bracket
  with no id at all. `node cadence-core/bin/test.mjs` is green.

### Task 3: A stop whose bracket is already closed stops adopting a dead run

- **Files:** cadence-core/bin/lib/subagent-trace.mjs (`currentRun` plus
  `closedBracket` plus the evidence block above GATE 0 that wires them together
  plus the header's THREE GATES section),
  cadence-core/bin/subagent-trace.test.mjs
- **Action:** The run in flight is named off the role's `unpaired` rows alone,
  and the bracket match is then scoped to `mine.length ? mine[0].corr : null`.
  That is right while the worker's dispatch is still open and wrong the moment it
  is not: once something has closed it, the role's only surviving `unpaired` rows
  are a dead run's leftovers, `currentRun` names THAT run current, and gate 2b -
  seeing exactly one candidate - adopts it and writes a `return` into a bracket
  from another phase. This is not hypothetical for the role AC5 and AC6 measure:
  the live record carries a `cad-verifier` `unpaired` row at corr `3-23fb76d`
  dated 2026-08-21, and it is exactly the row a second `cad-verifier` stop would
  adopt today. Name the run in flight ONCE, before either gate reads it, off the
  newest dated evidence that could be about THIS worker: the role's `unpaired`
  rows through their `ts`, and any bracket in `render.brackets` carrying this
  payload's `agent_id` through its `end` where that parses and its `ts`
  otherwise. `currentRun` already implements the shape - newest dated row wins,
  keep every row carrying its `corr` - so extend which rows it chooses the newest
  from rather than adding a second notion of "now" beside it. The run's `corr`
  becomes a value the rule computes once rather than one read back off `mine[0]`,
  because the run can now be named by a bracket while no `unpaired` row of the
  role survives the scope, and both gate 2b's candidate set and `closedBracket`'s
  match read that one value. Nothing else moves: an undated row still
  contributes no clock and is treated as oldest, a set with nothing dated
  anywhere still stands exactly as it does today with the match unscoped, gate
  2b's rule is still exactly one candidate or nothing, and `withheld`'s source is
  still the matched bracket else the first candidate. Write into the comment why
  a bracket wearing this payload's id is evidence about the RUN and not a choice
  between workers - it is an equality test on this worker's own recorded id, and
  TRC-06 forbids choosing between two workers, which this still never does.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` is green
  with a new case whose render carries an `unpaired` row of the role under an
  OLDER `corr` at an older `ts` plus a bracket under the CURRENT `corr` carrying
  the payload's `agent_id` at a newer `end`, and whose evidence bills cache
  traffic: the answer is exactly one event, it is the `worker_cache` fact, it
  carries the BRACKET's `corr` and `phase`, and no event in the answer is a
  `return` - where the same fixture on today's code answers a `return` adopting
  the stale row. The existing cases `stop: a REUSED id does not reach back into a
  dead run`, `stop: a worker already closed by the orchestrator writes NOTHING`,
  `stop: a stranded dispatch from an EARLIER run no longer blocks this one` and
  `stop: with no readable instant anywhere, the whole set stands` are green
  unchanged. `node cadence-core/bin/test.mjs` is green.

### Task 4: The larger cache read wins, and the first one stops being final

- **Files:** cadence-core/bin/lib/trace.mjs (the `cacheFacts` collection plus the
  repeat-close arm's `CACHE_KEYS` loop plus the post-pass fold plus the
  `brackets` entry of the `TraceRender` typedef),
  cadence-core/bin/trace.test.mjs
- **Action:** Three places decide what a bracket's two cache keys end up as, and
  all three keep the FIRST value that arrives: the `cacheFacts` map keyed
  `corr\0agent_id`, the repeat-close arm's fill-only-empty loop over
  `CACHE_KEYS`, and the post-pass fold's copy of that same clause. Fill-only-empty
  is right for `tokens`, `turns`, `duration_ms` and `agent_id`, where two
  DIFFERENT writers each hold part of the truth and the one that had the figure
  read it off the return. It is wrong for these two keys, because they have
  exactly ONE writer - the hook, summing the worker's own transcript - so there
  is no second writer for the rule to protect, and two values for one worker are
  two reads of one file that only grows. Make the larger value win for
  `CACHE_KEYS` in all three places, per key and independently, so a shorter read
  can never freeze a bracket and re-rendering the same file is idempotent. This
  is the monotonic posture this same function already takes for `end` and `ms`
  four clauses above the repeat-close cache loop, and the argument is the same
  one: a rule that keeps whichever value landed first understates a quantity that
  only grows. Say in the comment what a larger value means (a more complete read
  of the same transcript, never a second worker's traffic added on) and what the
  rule refuses to do (sum two reads, which would double-bill every turn both
  covered). Nothing else moves: the fold still matches on `corr` AND `agent_id`,
  still stops at the first matching bracket, still touches no `roleTotals`, no
  `out.roles`, no `seenTerminals` and no `pairedRows`, and a fact naming no
  bracket is still not an error. Update the `brackets` typedef line that
  describes where these two keys come from. The case named `render: a fact never
  overwrites a figure the close already carried` pins the rule this task
  supersedes for these two keys and must be rewritten to pin the new one rather
  than deleted - keep its second half, which proves the two keys answer
  independently, and record in its comment that AC2's no-overwrite clause is
  superseded here and why.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` is green with cases
  proving each of: a bracket whose close carried a SMALLER value for one cache
  key takes the fact's larger value while a close carrying a LARGER value keeps
  its own; a close carrying one key and not the other still takes the other off
  the fact; two facts for one `(corr, agent_id)` leave the LARGER of the two on
  the bracket whichever order they were appended in; two closes of one worker key
  each carrying cache figures leave the larger on the row; rendering one fixture
  twice produces byte-identical `brackets`; and - through the existing `folded`
  helper, which asserts it on every case - `roles` is byte-identical with and
  without every `worker_cache` line. `node cadence-core/bin/test.mjs` is green
  and `node cadence-core/bin/self-verify.mjs --root .` reports `problems: []`.

### Task 5: The record states which file the hook reads

- **Files:** cadence-core/references/seam-spawn-agent.md (the hook sentences
  inside the paragraph opening `**The bracket rides the resolve.**`),
  cadence-core/bin/weight-budgets.json,
  .planning/phases/3/CONTEXT.md (the `## Flagged assumptions` section and D-11),
  .planning/ROADMAP.md (phase 3's success criterion 2 only)
- **Action:** Two claims in the shipped record are now false and one is newly
  true. In the seam: the paragraph says the hook's CLOSE "carries THAT bracket's
  identity", which after task 2 is only half of what it carries - state that the
  close now also carries the stopped worker's own `agent_id`, so a bracket this
  hook closed is joinable rather than a dead end; and state that both of the
  hook's writes sum the figures off the worker's OWN transcript, which the stop
  payload names separately from the session transcript every hook event carries.
  Keep the edit inside that one paragraph: `cadence-core/bin/prose-agreement.test.mjs`
  reads it from its bolded opening to the first blank line and asserts three
  `--turns` clauses verbatim plus exactly one `ONE statement` marker in the whole
  file, and that test file is deliberately NOT in this plan's lease - a rewrite
  that would need to change it is the wrong rewrite. Re-measure the file: it sits
  at EXACTLY its 24,748-byte ceiling in `weight-budgets.json`, so any growth
  needs the ceiling moved to the new measured size in the same commit or
  `self-verify` reports a `budget-overrun`. In CONTEXT.md, correct the flagged
  assumption `SubagentStop fires at most once per worker` in place, keeping the
  original text and appending a dated measured correction: what was actually
  falsified on 2026-08-26 is the premise inherited from `v3.7.3` phase 1 D-09
  and D-11, that the payload's `transcript_path` names the worker's own file -
  the installed 2.1.246 host puts the worker's file on `agent_transcript_path`
  and `transcript_path` on the SESSION, which is where the record's one
  cache-bearing figure came from; the one live stop of that day fired once, at
  the worker's real stop, so the once-per-worker assumption is not falsified but
  is not settled either, because an async agent re-entered with a follow-up
  message stops again, and task 4 is what makes a second stop CORRECT the record
  rather than be dropped. Annotate D-11 in place on the same dated line: it is
  superseded for the two cache keys only, with AC2's "not overwritten" clause
  superseded with it, and the reason is that those keys have one writer while
  every other key the clause governs has two. Record one more measured fact the
  next reader needs: over 1,309 subagent transcripts, 31 of the 32 written
  2026-08-26 answer NOT-TERMINAL against 1,071 terminal across the whole corpus,
  so on this host version the withholding path is the ordinary path and AC5's
  terminal-stop arm is provable from fixtures rather than from a live dispatch.
  Then AMEND ROADMAP success criterion 2, which is the one criterion this plan
  makes false as written and the only one it touches. Its clause `and never
  overwrites a bracket that already carries figures` is true of every key the
  fold governs EXCEPT the two cache keys, whose rule task 4 changes. Rewrite that
  clause in place to state both halves - the fold still never overwrites a
  bracket's `tokens`, `turns`, `duration_ms` or `agent_id`, and for
  `cache_read_input_tokens` and `cache_creation_input_tokens` the LARGER value
  wins, because those two keys have exactly one writer and two values for one
  worker are two reads of a file that only grows. Leave AC1 and AC3 through AC7
  untouched. This is the amendment the `plan` review's surviving blocker asked
  for and John chose on 2026-08-26: a criterion the code contradicts is a
  checklist an audit disagrees with, so the criterion moves in the SAME COMMIT as
  the code that moves it, and the CONTEXT annotation above records why rather
  than standing in for it.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` is green,
  `node cadence-core/bin/self-verify.mjs --root .` reports `problems: []` with no
  `budget-overrun`, `node cadence-core/bin/test.mjs` is green, and
  `grep -c 'ONE statement' cadence-core/references/seam-spawn-agent.md` prints 1.
  Reading `.planning/phases/3/CONTEXT.md` shows the flagged assumption and D-11
  each carrying a dated correction naming `agent_transcript_path`. Phase 3's
  success criterion 2 in `.planning/ROADMAP.md` no longer contains the bare
  string `never overwrites a bracket that already carries figures`, names both
  cache keys and the larger-wins rule, and criteria 1 and 3 through 7 are
  byte-identical to their committed text (`git diff .planning/ROADMAP.md` touches
  that one criterion and nothing else).

### Task 6: Record what phase 2's shared prefix recovered, after side

- **Files:** .planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md
- **Action:** The spike's `### After` section is a committed PENDING placeholder
  and its `### The two sides, and the asymmetry between them` section describes
  an instrument that has since been corrected. Update the method first, which is
  work that does not wait on any dispatch: state that the after-side figure and
  the before-side figure are now the same arithmetic over the same kind of file -
  `cacheOf` over the worker's own transcript - and that what the after-side
  additionally proves is that the RECORD carried it, which is the only thing this
  phase exists to fix and the reason reading both sides from transcripts was
  rejected. State that the before-side figures (1,635,645 and 83,790 per
  dispatch, n=33) are unchanged and are not re-measured. Then fill `### After`
  with the two per-dispatch figures the after command already recorded there
  produces, the delta against the before side, and the dispatch count behind it.
  Record the figure even when it is zero and keep the committed reading of a zero
  as an answer rather than a failure. Add one sentence naming which stops the
  after-side brackets came from: on the current host version nearly every worker
  transcript ends non-terminal, so the figures ride `worker_cache` facts folded
  onto brackets the orchestrator closed, not hook-written closes.
- **Verify:** human-verify, and it is the same live instrument AC5 needs. After
  this plan's tasks are merged and `cad-verifier` has been dispatched at least
  twice in the MAIN tree, `node cadence-core/bin/planning.mjs trace render --dir .planning`
  shows at least one `cad-verifier` bracket carrying both
  `cache_read_input_tokens` and `cache_creation_input_tokens`, and each equals
  `cacheOf` over that worker's own `subagents/agent-<agent_id>.jsonl` file - the
  file the payload's `agent_transcript_path` names - rather than over any session
  transcript. The spike's `### After` section then reads with two numbers, a
  delta and a dispatch count instead of the word PENDING. Baseline to compare
  against, measured 2026-08-26: 406 brackets, 1 carrying a cache figure, and that
  one carrying the orchestrator's traffic rather than the worker's.

## Notes

- **Plan shape.** ONE plan, where CONTEXT.md's `Plan shape` directive named
  multiple. That directive shaped PLAN-1 and PLAN-2, which are executed and on
  disk. The gap work does split cleanly by FILE - tasks 1-4 touch only
  `cadence-core/bin/**` and tasks 5-6 only prose, the spike and the phase
  CONTEXT - but it does not split by ORDER: task 5 states in the shipped record
  what task 1 makes true, and task 6's whole input is brackets that cannot exist
  until tasks 1-4 are merged and a worker has stopped against them. Cross-slice
  ordering fails the independence test, so it is one plan. This plan shares
  declared paths with both PLAN-1 and PLAN-2 and is SEQUENTIAL after them.
- **What UAT item 5 got right and what it got wrong.** It is right that the
  bracket's figure is short and that the record made a partial number permanent.
  Its stated cause - the hook fired 22 s into a 378 s run and D-11 froze a
  partial transcript sum - is not what the record shows. The hook ran at the
  worker's real stop, just ahead of the hand-written close at 19:22:37, and read
  the ORCHESTRATOR's transcript; the 19:16:18.866 instant it wrote is the
  orchestrator's own last assistant timestamp, which is why the run looked
  22 seconds long. D-11 never ran on that bracket at all: the figures arrived on
  the hook's own `return` at pairing time and no second fact was ever written.
  Task 1 is the cause; task 4 changes D-11 anyway, because the case it does
  govern - a worker that stops twice - is real and its current answer is wrong.
- **The line between fixture and live.** Tasks 1 through 4 are falsifiable
  without a host: every gate, the file selection, the id on the close, the run
  scope and the fold are provable by piping a payload into
  `cadence-core/bin/subagent-trace.mjs` against a temp `.planning` and rendering
  it. What no fixture can produce is a real `agent_transcript_path` and a real
  `agent_id` from the host, which is AC5, and the brackets AC6's after-side reads
  off. Task 6 alone is human-verify, and it carries both. AC5's terminal-stop arm
  is fixture-only on the installed host version for the measured reason in task
  5's Action: 31 of the 32 subagent transcripts written 2026-08-26 answer
  NOT-TERMINAL, so a live terminal stop is not something a dispatch can be relied
  on to produce.
- **Flagged assumption, restated after measurement.** The host guarantees
  `agent_id` uniqueness - still unclear, still absorbed by D-10's `corr` scope,
  and a collision WITHIN one `corr` would still land a fact on the wrong bracket.
  Task 3 widens what the `corr` scope is derived from and does not change that
  exposure.
- **What the `plan` review changed.** The blocking cross-model fire on
  2026-08-26 raised four findings; two were refuted against the code
  (`subagent-trace.mjs:393` refuses only `NOT_TERMINAL`, so task 1's
  absent-field arm does append its `return`; and task 3's Verify already names
  `subagent-trace.test.mjs:333`, which IS the AC3 fixture). One survived: task 4
  contradicts ROADMAP success criterion 2. John chose to amend the criterion, so
  task 5 now carries that edit and `.planning/ROADMAP.md` is in this plan's
  lease. One was downgraded to an open item: task 6's live check does not pin
  AC5's two-open-dispatch pair, which stays unpinned live and is recorded in
  `.planning/CAPTURE.md` rather than pretended closed here.
- **Cost this plan accepts, stated rather than discovered later.** With task 1 in
  place the termination gate refuses nearly every live stop on host 2.1.246,
  because a finished worker's transcript ends on a `null` `stop_reason`. The hook
  therefore stops writing closes on this host and writes facts instead. That is
  the gate behaving as designed on correct evidence rather than a regression:
  the closes it writes today are authorised by the ORCHESTRATOR's `end_turn`,
  which is not evidence about the worker at all. The hand-written `trace close`
  remains the writer that closes the bracket, which is what it was already doing
  on every dispatch in the record.
