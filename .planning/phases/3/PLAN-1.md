---
phase: 3
plan: 1
requirements:
  - TRC-07
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/lib/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.test.mjs
  - .planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md
---

# Phase 3: Make the cache figures reach the record - Plan 1

## Goal

The two prompt-cache figures reach the bracket for every worker that STOPPED,
not only the ones the `SubagentStop` hook could both identify and call terminal.
This plan is the hook-and-renderer half: a cache-only lifecycle fact written on
all three withholding gates, a render-time fold that joins it to its bracket, a
gate whose candidate set stops counting a dead run's leftovers, and the
prefix-recovery measurement that becomes possible once figures land.

## Must be true when done

- A `SubagentStop` the termination gate refuses, one the already-closed gate
  refuses, and one the two-open-dispatch gate refuses each still put the stopped
  worker's two cache figures on the record, and each still write no `return`.
- `trace render` shows those figures on the bracket for the SAME worker, matched
  by `corr` and `agent_id` together; a bracket whose close already carried
  figures keeps the ones it has; and with two open dispatches of one role in one
  phase run, the figures land on the bracket whose `agent_id` matches rather
  than on the newest bracket or on whichever fact arrived first.
- A stop whose role has one open dispatch in the current run plus older stranded
  dispatches of the same role closes the current one. Today that same record
  makes the gate refuse.
- A stop whose transcript reported neither figure adds nothing at all - no
  event, no key set to zero - and a render's `roles` block is byte-identical
  whether or not any cache fact is present in the file.
- `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md` states, for one
  named role, what phase 2's shared rung prefix recovered: a before figure, an
  after figure, the command behind each, why the two sides are not the same
  instrument, and the number even when it is zero.
- `node cadence-core/bin/test.mjs` is green, `node cadence-core/bin/self-verify.mjs --root .`
  reports `problems: []`, and the new lifecycle event name is one of the names
  the trace producer census accepts.

## Context

CONTEXT.md D-02 (a new lifecycle NAME, never a TERMINAL and never a family),
D-07 (all three gates, not two), D-08 (plural return, evidence by injection),
D-09 (a post-pass fold, because the fact ordinarily arrives before the id it
joins on), D-10 (`corr` AND `agent_id`), D-11 (reuse the fill-only-empty
clause), D-12 (absent, never zero), D-03 (gate 2b scoped to the current `corr`),
D-04 (a real `phase`, no `--phase` carve-out), D-05 (never folded into
`roles.tokens`), D-15 (the trace producer census, not `hook-events.mjs`) and
D-16 (the AC6 measurement's two sides) bind this plan. The event name this plan
introduces is `worker_cache`; Plan 2's prose uses that spelling.
Out of scope here: every prose surface and `cadence-core/bin/weight-budgets.json`,
which are Plan 2's; `trace.jsonl` rotation, which is phase 4; and re-opening the
sum-vs-max cache denomination, which shipped code already answers.

## Tasks

### Task 1: Give the record a fifth lifecycle NAME that funds nothing

- **Files:** cadence-core/bin/lib/trace.mjs (the exported vocabulary beside
  `COORDINATOR`, `CACHE_KEYS`, and `renderTrace`'s lifecycle branch),
  cadence-core/bin/trace.test.mjs (the `known` list in the producer-census test,
  and the import block it reads the vocabulary from)
- **Action:** Export a new lifecycle event name `worker_cache` from
  `cadence-core/bin/lib/trace.mjs`, as a constant beside `COORDINATOR` and with
  a doc comment of its own, and add it to the `known` array the producer census
  in `cadence-core/bin/trace.test.mjs` builds from `ANCHOR`, `DISPATCH`,
  `TERMINAL` and `COORDINATOR`, so that census keeps reading the renderer's real
  vocabulary rather than a copy of it (D-15). It is a fifth NAME and not a fifth
  FAMILY for the reason `COORDINATOR`'s own doc comment already states -
  `FAMILIES` is validated at the seam while `renderTrace`'s `counts` is a fixed
  four-key literal, so a fifth family would write fine and count nowhere - and
  it must NOT join `TERMINAL`: a name in that array re-enters `seenTerminals`,
  the FIFO `pending.shift()` and the `funded`/`turnsFunded` accounting, which
  would open a bracket for a worker that never returned. In `renderTrace` the
  new name must fall through both the `DISPATCH` branch and the
  `TERMINAL.includes(e.event)` branch untouched, so it creates no `roleRow`, no
  bracket and no `unpaired` row; the only things it moves are `counts.lifecycle`
  and the per-`corr` `last` instant that every family already feeds. Do not add
  a row to `cadence-core/bin/lib/hook-events.mjs`: that module's comparison is
  over host hook NAMES, this phase registers no host hook, and `hooks/hooks.json`
  already registers `SubagentStop` - a row there would be the dead row its own
  "ONE DIRECTION ONLY" note says is deliberately unchecked (D-15). Say in the
  constant's doc comment what the name exists for, so the next reader does not
  have to infer it from the hook: a stop that cannot claim a close still holds
  cache figures no other writer will ever have.
- **Verify:** Running `node --input-type=module -e "import {WORKER_CACHE} from './cadence-core/bin/lib/trace.mjs'; console.log(WORKER_CACHE)"`
  from the repo root prints `worker_cache`. A fixture trace holding one
  `lifecycle/dispatch`, no close, and one `lifecycle/worker_cache` event
  carrying both cache keys renders with `counts.lifecycle` equal to 2,
  `brackets` empty, `unpaired` holding exactly the one dispatch, and
  `JSON.stringify(render.roles)` identical to the same fixture with the
  `worker_cache` line deleted. `node cadence-core/bin/test.mjs planning` is
  green.

### Task 2: Fold a cache-only fact onto its bracket in a post-pass

- **Files:** cadence-core/bin/lib/trace.mjs (`renderTrace` and the `brackets`
  entry of the `TraceRender` typedef), cadence-core/bin/trace.test.mjs
- **Action:** Collect every `worker_cache` event during `renderTrace`'s existing
  forward pass - that pass already builds the guarded `cache` object for every
  lifecycle event it sees, so reuse it rather than re-reading `e[k]` with a
  second set of guards - and, AFTER the event loop, fold each collected fact
  onto the bracket it names. The fold cannot ride the forward pass (D-09): the
  fact ordinarily arrives BEFORE the `agent_id` it joins on, because the host
  fires `SubagentStop` when the worker stops and the orchestrator writes its
  `--agent-id` close only after processing the return, and the whole existing
  fold runs inside the `TERMINAL.includes(e.event)` branch. Match a fact to a
  bracket on `corr` AND `agent_id` together, never on `agent_id` alone (D-10):
  `alreadyClosed` in `cadence-core/bin/lib/subagent-trace.mjs` does the unscoped
  test today, and measured 2026-08-26 over 1,333 transcripts, 7 of 1,323
  distinct ids appear in two or more transcripts of the same project. Compare
  `corr` through the module's existing `key()` helper, the same way the pairing
  already folds `1` and `"1"` together. Apply exactly the fill-only-empty clause
  the repeat-close arm already uses for these two keys and add no second
  overwrite rule (D-11), so a bracket whose close already carried figures keeps
  them. A fact with no `agent_id`, and a fact whose pair names no bracket,
  change nothing and are not errors. Two facts naming one `(corr, agent_id)`
  pair is a live shape rather than a hypothetical, and the record cannot add
  them: a transcript only grows, so the later fact is a re-sum of the same file
  and a superset of the earlier one, and summing them would double-bill every
  turn both reads covered. Keep the LAST fact for a pair and drop the earlier
  ones BEFORE the fill-only-empty clause runs, so the record carries the more
  complete read rather than freezing on the shorter one, and state that choice
  in the comment - CONTEXT.md flags it as the planner's to make. Where two
  brackets in one `corr` carry one `agent_id`, fold onto the first and stop, so
  one worker's traffic is never copied onto two rows. Nothing in this pass may
  touch `roleTotals`, `roleRow`, `out.roles`, `seenTerminals` or `pairedRows`:
  the figures ride the bracket and are never folded into the roles bill (D-05),
  because a cache read summed over turns is a different denomination from a
  return's final-window `tokens`. Extend the `brackets` entry of the
  `TraceRender` typedef to say these two keys can now also arrive from a
  cache-only fact rather than only from a close.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` is green with new
  cases proving each of: a dispatch, a figureless hook `return`, a hand-written
  `return` carrying `agent_id`, then a `worker_cache` event with the same `corr`
  and `agent_id` leaves ONE bracket carrying both cache keys; the same fixture
  with the fact appended BEFORE the close that carries the id gives the same
  bracket; a bracket whose close already carried `cache_read_input_tokens` is
  unchanged by a fact naming it; two dispatches of one role in one phase closed
  under two different agent ids plus one fact give the keys only to the bracket
  whose `agent_id` matches; a fact whose `corr` differs from a bracket carrying
  the same `agent_id` lands nowhere; two facts for one pair leave the LATER
  sums on the bracket; and `JSON.stringify(render.roles)` is identical with and
  without every `worker_cache` line in each fixture above.

### Task 3: `closeForStop` answers a LIST, and the disk half writes each event

- **Files:** cadence-core/bin/lib/subagent-trace.mjs (`closeForStop` and its
  JSDoc), cadence-core/bin/subagent-trace.mjs (the `if (event) appendEvent(...)`
  call), cadence-core/bin/subagent-trace.test.mjs
- **Action:** Today `closeForStop` is documented and written as `{...}|null` and
  the disk half appends it with a single `if (event) appendEvent(root, event)`,
  so a stop that must put more than one event on the record cannot be expressed
  at all (D-08). Change the contract to an ARRAY of events - empty for
  do-nothing, one entry for every answer the rule gives today - and update the
  `@returns` annotation and the header's GATE 3 paragraph to describe a list.
  Replace the disk half's single append with a loop that appends each event in
  file order, guarded so a non-array answer writes nothing rather than throwing
  inside a hook that is contractually forbidden to speak on any stream. This
  task changes no decision the rule makes: every path that answers `null` today
  answers an empty array, and the `return` event is unchanged in every field.
  Update every assertion in `cadence-core/bin/subagent-trace.test.mjs` to read
  the list, keeping each case's existing intent rather than rewriting what it
  proves. Leave the hook's silence contract intact - no new stream write, no
  nonzero exit, every failure still silent.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` is green
  with every case reading an array, including the do-nothing cases asserting
  length 0. End to end: with a temporary directory holding a `.planning/` and a
  `trace.jsonl` carrying one open `cad-verifier` dispatch, piping a
  `SubagentStop` payload naming that `cwd` and `agent_type` into
  `node cadence-core/bin/subagent-trace.mjs` appends exactly one line, that line
  is a `lifecycle/return`, and the process prints nothing on stdout or stderr
  and exits 0.

### Task 4: Scope gate 2b's candidate set to the current run

- **Files:** cadence-core/bin/lib/subagent-trace.mjs (GATE 2b's
  `render.unpaired` filter and the header's THREE GATES section),
  cadence-core/bin/subagent-trace.test.mjs
- **Action:** GATE 2b filters `render.unpaired` on `row.role` with no `corr`
  term, and the render it reads is unscoped by construction, so every dispatch
  of that role ever stranded in the file counts as an open worker forever.
  Measured 2026-08-26 on this repository: 11 unpaired rows survive back to
  2026-08-09 - `cad-executor` x3, `cad-reviewer` x2, `cad-assumptions-analyzer`
  x2, `cad-planner` x2, `cad-verifier` x1 - so a `cad-executor` stop today sees
  at least four "open" dispatches and refuses unconditionally rather than in the
  5.4% of concurrent cases TRC-07 estimated, and `cad-verifier`'s stale row is
  one the hook would mis-attribute to rather than abstain from. Narrow the
  candidate set to ONE run before the count is taken (D-03): among the role's
  `unpaired` rows, take the `corr` of the row with the newest parseable `ts` and
  keep only the rows carrying that `corr`. A row whose `ts` is absent or
  unparseable contributes no clock and is treated as oldest, which is the
  posture every other arithmetic path in this record already takes for an
  unreadable instant; where no row of the role has a parseable `ts`, the whole
  set stands exactly as it does today. GATE 2b's own rule does not move: exactly
  one candidate is adopted and none-or-many is still DO NOTHING, because TRC-06
  forbids the newest-open adoption by name and no ordering of dispatch instants
  can separate two workers dispatched in one message. Write into the comment why
  scoping to a RUN is not the heuristic TRC-06 bans - it never chooses between
  two workers, it stops a dead run's leftovers from voting - so the next reader
  does not undo it as one. Do NOT expire, rewrite or delete unpaired rows: that
  overlaps the rotation question phase 4 owns.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` is green
  with a case whose render carries a `cad-verifier` `unpaired` row under an
  older `corr` and an older `ts` plus one under the current `corr` at a newer
  `ts`: the answer is a close adopting the CURRENT `corr`'s row, and the same
  fixture answered nothing before this task. Two rows under the current `corr`
  still answer no close. A fixture where none of the role's rows carries a
  parseable `ts` answers exactly what it answers today.

### Task 5: Write the cache-only fact on all three withholding gates

- **Files:** cadence-core/bin/lib/subagent-trace.mjs (the module header's GATE 0
  paragraph, `closeForStop`'s gate 0 / `alreadyClosed` / `mine.length !== 1`
  arms, and the `cacheOf` spread), cadence-core/bin/subagent-trace.test.mjs
- **Action:** All three paths that withhold a close today throw the two cache
  figures away with it: gate 0 (`STOP_STATE.NOT_TERMINAL`), gate 2a
  (`alreadyClosed`) and gate 2b (`mine.length !== 1`) each return before the
  `...cacheOf(transcript)` spread (D-07). Make each of them answer a single
  cache-only fact instead of nothing, while still writing NO `return` - the
  termination gate is unchanged, not relaxed. The fact is a `lifecycle` event
  under the name task 1 exported, carrying `corr`, `phase`, `role`, `agent_id`
  and whichever of the two cache keys `cacheOf` supplied, plus `ts` on exactly
  the rule the `return` arm already follows (the transcript's terminal instant
  where it named one, the key omitted otherwise). It carries no `plan`: with two
  open dispatches of one role there is no single plan to name, and one shape for
  the event whatever gate wrote it is worth more than a field that would
  sometimes be a guess. Build its identity from evidence the rule can SEE. When
  the payload's `agent_id` matches a bracket in `render.brackets`, take `corr`
  and `phase` off THAT bracket: it is the exact row the fact will fold onto, and
  it is the only evidence gate 2a has, because an already-closed dispatch is no
  longer in `unpaired` at all. Otherwise take them off task 4's corr-scoped
  candidate set, whose rows share a `corr` by construction and a real `phase`
  with it, so `renderTrace`'s `--phase` filter needs no carve-out and two
  readers of one record cannot disagree (D-04). Write NO fact at all when there
  is neither a matching bracket nor a candidate row, when `cacheOf` supplied
  neither key (D-12 - absent rather than zero, and never an event carrying
  both keys omitted), or when the payload carries no `agent_id`: `corr` plus
  `agent_id` is the fold's only key (D-10), a worker-key fallback was refuted in
  `v3.7.3` phase 1 and reverted at `4fbf7280`, and an id-less fact is a row that
  can never reach a bracket. The self-filter has to run before the termination
  gate now, because the fact needs the mapped role; that reorder changes no
  answer, since each gate independently withholds the `return`, and the header's
  "GATE 0, AND IT RUNS AHEAD OF EVERYTHING" paragraph must be rewritten to say
  what runs first now and why the old ordering's reason still holds for the
  close. The unambiguous terminal path is untouched and still answers its single
  `return` carrying the figures; do not add a fact beside it, which would put
  one worker's traffic on the record twice.
- **Verify:** `node --test cadence-core/bin/subagent-trace.test.mjs` is green
  with, for each of the three gates separately, a case asserting the answer is
  exactly one event, that its `event` is the new name, that it carries both
  cache keys, the payload's `agent_id`, and a `corr` and `phase` taken from the
  render, and that no event in the answer is a `return`, `checkpoint` or
  `escalation`. Plus: a not-terminal stop whose transcript reported no cache
  traffic answers an empty list; a stop carrying no `agent_id` answers an empty
  list at all three gates; and a terminal unambiguous stop still answers exactly
  one `return` carrying the figures and no fact. End to end, ONCE PER GATE and
  not once for the phase - AC1 asks for both halves "in a single render", so a
  gate proved only at `closeForStop`'s return value is a gate whose fact could
  still derive an unusable `corr` or `phase`, be phase-filtered out, or fail to
  fold, and pass anyway. For each of the three gates build a temporary
  `.planning/` holding a `cad-verifier` dispatch, arranged so that gate is the
  one that fires - already-closed adds a close carrying `--agent-id`;
  not-terminal uses a transcript whose last message is not terminal;
  two-open-dispatch adds a second dispatch of the same role under the same
  `corr` - then pipe the matching `SubagentStop` payload into
  `node cadence-core/bin/subagent-trace.mjs` and assert it appends exactly one
  `worker_cache` line and no `return`. Then run
  `node cadence-core/bin/planning.mjs trace render --dir <that .planning>` on
  each and assert the fact reached a bracket: for already-closed, that bracket
  carries both cache keys; for two-open, the bracket whose `agent_id` matches
  the payload carries them and its sibling does not; for not-terminal, where no
  close exists yet, append the matching `return` carrying the same `--agent-id`
  and re-render, and that bracket then carries both keys - which is the ordinary
  arrival order the hook fires in and the one D-09's post-pass exists for. In
  all three, `JSON.stringify(render.roles)` is identical to the same fixture
  rendered with the `worker_cache` line deleted, and every render is run BOTH
  unfiltered and with `--phase` naming the fixture's phase, with the same
  bracket carrying the same keys either way (D-04).

### Task 6: Record what phase 2's shared prefix recovered

- **Files:** .planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md
- **Action:** Add a dated post-ship section to the spike RNG-03 already uses as
  its evidence home - chosen over a phase-local file because the prefix-cache
  question has one home and `.planning/REQUIREMENTS.md` already cites spikes as
  durable evidence - recording phase 2's prefix recovery for ONE role. The role
  is `cad-verifier`, carried forward from `.planning/phases/2/CONTEXT.md` D-06:
  it runs in the MAIN tree, so its hook write lands in this repository's
  `.planning/trace.jsonl` rather than in a worktree's discarded one; it has four
  rungs; and its contract is not the one phase 2 rewrote, so neither side is
  contaminated by that edit. D-06 marked the choice RE-DECIDE only because
  `cad-verifier` holds one of the 11 stale unpaired rows, and task 4 is what
  removes that objection. The before-side is `cacheOf`
  (`cadence-core/bin/lib/subagent-transcript.mjs`) summed over that role's
  subagent transcripts under the host's own project directory, all 598 of which
  predate phase 2's ship commit `8ca0dfdc` (measured 2026-08-26); the after-side
  is `cache_read_input_tokens` and `cache_creation_input_tokens` on that role's
  BRACKETS in `.planning/trace.jsonl` once this phase is live. Record the exact
  command behind each side, the per-dispatch normalisation that makes them
  comparable at all (a total over a dispatch count, since the two sides cannot
  hold the same number of dispatches), and the ASYMMETRY as part of the method
  rather than as a footnote: only the after-side exercises the code this phase
  writes, and a before-side BRACKET cannot be produced at all, because 0 of
  2,363 trace events carried a cache key on 2026-08-26 (D-16). State that
  reading both sides from transcripts was rejected, because that comparison
  would pass even if every gate still withheld and so proves nothing about the
  record this phase exists to fix. Record the figure even when it is zero and
  say what a zero means: the host may key its prompt cache per agent definition,
  in which case a byte-identical rung body recovers nothing and RNG-03 closes on
  a measured negative. Add no script under `cadence-core/bin/`: a new bin
  surface drags a CONTRACTS row into the flag census D-13 pins at 192, and this
  is a recipe rather than a shipped tool.
- **Verify:** human-verify - the instrument this needs is a live host firing
  `SubagentStop` after the change, which no fixture can produce. Once this phase
  is live and `cad-verifier` has been dispatched at least twice, run
  `node cadence-core/bin/planning.mjs trace render --dir .planning` and observe
  at least one `cad-verifier` bracket carrying `cache_read_input_tokens`; the
  spike's new section then reads with a before figure, an after figure, the
  command behind each, the asymmetry stated in its method, and a delta that is a
  number rather than a promise.

## Notes

- **Plan shape deviation.** CONTEXT.md's `Plan shape` directive puts D-14's
  seam-spawn-agent paragraph with this hook-and-renderer slice and only its byte
  re-measures with the prose slice. Both halves of D-14 need
  `cadence-core/bin/weight-budgets.json`, and every prose surface in this phase
  currently sits at EXACTLY its ceiling, so splitting D-14 across two plans
  would put one manifest in both `files:` leases. File independence is the hard
  constraint, so the whole of D-14 rides Plan 2 with the rest of the prose and
  this plan touches no prose surface at all.
- **Flagged assumption - `SubagentStop` fires at most once per worker.** Task 2
  answers it explicitly rather than letting the fill-only-empty rule decide
  silently: two facts for one `(corr, agent_id)` are two reads of one growing
  file, so the LAST one is kept and the earlier ones dropped. If the host ever
  produces genuinely disjoint partial sums, this understates rather than
  double-bills, which is the direction this record already prefers.
- **Flagged assumption - the host guarantees `agent_id` uniqueness.** D-10's
  `corr` scope is what absorbs a collision across sessions. A collision WITHIN
  one `corr` would still land a fact on the wrong bracket, and only the host's
  own contract can settle it.
- **Reach of the id-less rule.** A `SubagentStop` payload carrying no `agent_id`
  writes no fact, by D-10 and D-01. If the host turns out to omit the id often,
  the coverage this phase buys is smaller than the gate analysis suggests, and
  that shows up as brackets still carrying no cache key after the change - which
  AC5's live check is what would reveal.
