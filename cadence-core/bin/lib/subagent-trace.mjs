// @ts-check
// subagent-trace.mjs - the pure rule behind the `SubagentStop` hook: given the
// host's stop payload and a rendered trace, decide which open bracket this
// stopped subagent closes, or decide nothing at all.
//
// The disk half - resolving the project from the payload's `cwd`, rendering the
// trace and appending the answer - lives in `bin/subagent-trace.mjs`, the same
// split `lib/read-trace.mjs`, `lib/reference-routers.mjs` and
// `lib/deferred-reads.mjs` already use, and it is what lets this rule be tested
// against synthetic pairs with no hook and no filesystem.
//
// WHY THE HOOK WRITES A CLOSE AT ALL. The bracket's two halves are written by
// two different prose lines: `route.mjs resolve --bracket-read` opens it at
// dispatch, and the orchestrator's hand-written `trace close` closes it after
// the return. A session that dies between them leaves a dispatch that never
// closes - the `unpaired` rows this record already carries. The host closes
// every subagent it started, so a `SubagentStop` hook is the one writer that
// cannot be skipped. The hand-written close is KEPT: it alone sees the return
// and so is the only writer that can carry the token, tool-use and wall-clock
// figures, and phase 0's `/cad-task` bracket has no subagent behind it for any
// hook to close.
//
// GATE 0, THE TERMINATION GATE (D-09), AND WHAT NOW RUNS AHEAD OF IT. The
// payload carries no field that separates a worker that FINISHED from one
// handed back mid-turn - `stop_hook_active` is documented for `Stop` and is not
// a `SubagentStop` field - so the evidence is the worker's own transcript,
// which the payload points at through `agent_transcript_path`, the field that
// event puts the WORKER's file on. It is NEVER the `transcript_path` every hook
// event carries: that one names the orchestrator's own session, and reading it
// made this gate ask whether the ORCHESTRATOR had stopped. The disk half reads
// the worker's file and INJECTS the bytes (D-08);
// `lib/subagent-transcript.mjs` holds the rule that reads them.
//
// THE SELF-FILTER RUNS FIRST NOW, not this gate. Every withholding arm below
// writes a cache-only fact, and that fact has to NAME the worker it is about:
// it carries the mapped role, and a type that maps to no role is not a Cadence
// worker at all, so nothing may be written for it whatever its transcript
// says. The reorder changes no answer, because each gate withholds the close
// independently of the others rather than by falling through the one before
// it. And the old ordering's reason still holds exactly where it was aimed: a
// worker that has not stopped produces NO CLOSE whatever the record holds, and
// the fact it does produce asserts nothing about whether the worker finished -
// only what its transcript has billed so far.
//
// The gate refuses on NOT-TERMINAL alone, never on UNKNOWN: a payload with no
// `agent_transcript_path`, a file that could not be read, an over-cap file and a
// layout that changed all arrive as `unknown` and still produce the close this
// hook produces today. Folding `unknown` into the refusal is how a host-side
// rename would delete every hook close in the record at once and silently.
//
// THREE GATES, in this order.
//
// 1. THE SELF-FILTER (D-08). The 2.1.245 `SubagentStop` runner calls the hook
//    dispatcher with no `matchQuery`, so a `matcher` in `hooks/hooks.json` is a
//    filter the host will never apply and this rule is the whole enforcement.
//    This repository's own corpus carries `general-purpose`, `Explore`, `fork`
//    and `claude-code-guide` beside the Cadence types, and none of them has a
//    dispatch event to close. `agent_type` arrives in the host's
//    `<plugin>:<agent-file-stem>` spelling, so it is mapped back through
//    `lib/read-trace.mjs`'s `roleOfAgent` - the SAME map, imported rather than
//    copied, because a second copy of it is how two readers of one record start
//    disagreeing about which bracket closed. A type that maps to no role means
//    DO NOTHING.
//
// 2. ADOPT, NEVER DERIVE (D-03). The stop payload carries no correlation id, no
//    phase, no plan and no worker key at all (D-01), so there is nothing to
//    derive one from - and deriving from `agent_type` would write
//    `role: "cadence:cad-executor-xhigh"`, a role row no
//    `workflow.max_dispatch_tokens.<role>` key can ever match. The rule picks an
//    `unpaired` dispatch of the mapped role and quotes ITS `corr`, `phase` and
//    `plan` verbatim. No matching row means DO NOTHING: the hook never invents a
//    dispatch and never opens a bracket.
//
//    WHICH open dispatch, and the answer is UNAMBIGUOUS OR NOTHING (TRC-06).
//    Adopting the NEWEST one crosses two same-role workers whenever more than
//    one is open, which is live today - `parallelization.enabled` dispatches up
//    to `max_concurrent_agents` executors at once - and TRC-06 forbids exactly
//    that adoption by name. So the rule is two questions with no clock in
//    either:
//
//      a. Does a bracket on the record already carry this payload's `agent_id`?
//         Then this worker's close is already written and there is nothing here
//         for it to close. DO NOTHING.
//      b. Is there EXACTLY ONE open dispatch of the mapped role IN THIS RUN?
//         Adopt it. Anything else - none, or two the evidence cannot separate
//         - is DO NOTHING.
//
//    SCOPED TO ONE RUN (D-03), AND THAT IS NOT THE HEURISTIC TRC-06 BANS.
//    `unpaired` accumulates for the life of the file, so without a scope every
//    dispatch of the role ever STRANDED counts as an open worker forever.
//    Measured 2026-08-26 on this repository: 11 unpaired rows survive back to
//    2026-08-09 - `cad-executor` x3, `cad-reviewer` x2,
//    `cad-assumptions-analyzer` x2, `cad-planner` x2, `cad-verifier` x1 - so a
//    `cad-executor` stop today saw at least four "open" dispatches and refused
//    UNCONDITIONALLY, rather than in the minority of genuinely concurrent
//    cases the gate was written for. So the candidate set is narrowed before
//    the count is taken: take the `corr` of the role's newest dated row and
//    keep only the rows carrying it.
//
//    Do not undo this as a clock heuristic - it is the opposite of one. TRC-06
//    forbids CHOOSING BETWEEN two open workers, and this never chooses: the
//    rule below it is unchanged, exactly one candidate is adopted and
//    none-or-many is still DO NOTHING, so two workers dispatched in one
//    message share a `corr`, both survive the scope and both are still
//    refused. What the clock does here is decide which RUN is current, and
//    that is a question about the file rather than about a worker. A row whose
//    `ts` is absent or unparseable contributes NO clock and is treated as
//    oldest - the posture every arithmetic path in this record takes for an
//    unreadable instant - and where no row of the role is dated at all the set
//    stands exactly as it did before this scope existed. Expiring, rewriting
//    or deleting an unpaired row is a different question and belongs to trace
//    rotation, not here.
//
//    The id reaches the record on the CLOSE, never the dispatch. That event is
//    written before the subagent exists, so it has no id to carry; the
//    orchestrator learns the id the moment the host returns and puts it on its
//    hand-written `trace close --agent-id`. That is the whole join, and it is
//    an equality test rather than an inference.
//
//    WHY NOT A TIMESTAMP HEURISTIC. Ordering evidence - a worker's first read
//    against the dispatch instants - cannot identify a worker, because the
//    parallel path dispatches both executors in ONE message: both dispatches
//    land before either worker reads, so every ordering rule has an
//    interleaving that crosses them. Three separate ones were tried and each
//    had a counter-example; the information is simply not in the clocks.
//
//    THE COST, stated rather than hidden. Where the hand-written close never
//    ran AND two dispatches of the role are open, this writes nothing and both
//    stay `unpaired`. That is the visible defect the whole record already
//    prefers to a confident wrong row: an `unpaired` marker is countable and a
//    crossed bracket bills one worker for another's run. In a sequential phase
//    - one open dispatch of a role at a time - nothing changes at all.
//
// 3. THE EVENTS, and nothing on any of them this hook cannot SEE. The answer is
//    a LIST (D-08), in the order the disk half must append it: empty for do
//    nothing, and one entry for every answer this rule gives today. It is
//    plural because a stop can owe the record more than one fact - a gate that
//    withholds the close still holds cache figures nothing else will ever have -
//    and a `{...}|null` contract cannot express that at all.
//
//    The unambiguous answer is a `lifecycle` `return` carrying the adopted
//    `corr`, `phase`, `plan` and `role`, plus the two cache figures where the
//    evidence supplied them. The discriminator is WHERE A FIGURE LIVES, not
//    which writer is senior:
//
//      - On the host's RETURN - `tokens`, `turns`, `duration_ms` and the
//        `detail` text. Only the orchestrator sees a return, so this event
//        carries none of them, and `lib/trace.mjs`'s token-provenance header
//        states why a fabricated figure is strictly worse than an absent one:
//        an invented number lands in `trace suggest`'s share denominator and
//        misprices every other role with it.
//      - In the worker's own TRANSCRIPT - `cache_creation_input_tokens` and
//        `cache_read_input_tokens`, summed by `lib/subagent-transcript.mjs`.
//        Those are never rendered onto a return, so no hand-written close can
//        ever carry them and no `trace close` flag could be filled (D-11).
//        This hook holds the only evidence there is, so it is the only writer
//        that can put them on the record. Each key is OMITTED when the
//        transcript reported nothing for it - the absent-not-zero rule the
//        whole record keeps.
//
//    The keys take the host's OWN spelling, so a bracket figure joins back to
//    the transcript line it was summed from with no translation table - the
//    same reason `duration_ms` took the spelling the record already used. And
//    they never reach the `roles` block's token bill: a cache figure summed
//    over turns is a different denomination from a return's final-window
//    `tokens` (D-03).
//
//    The hand-written close supplies the return's figures, and `renderTrace`'s
//    worker-key dedup folds whichever writer arrives second into the row the
//    first opened, filling only the fields that row left empty.
//
// THE CACHE-ONLY FACT, on every gate that withholds the close (D-07). All
// three refusing arms above - not-terminal, already-closed, and two open
// dispatches of one role - used to throw the worker's two cache figures away
// with the close they refused. Nothing else on the record can recover them:
// the host renders no cache figure on a return, so the transcript this hook
// holds is the only evidence there will ever be, and a stop that cannot claim
// a bracket still billed real traffic. So each of them now answers ONE event
// under `WORKER_CACHE` - never a `return`, never a `checkpoint`, never an
// `escalation` - and the termination gate is unchanged rather than relaxed.
//
// The fact carries `corr`, `phase`, `role`, `agent_id` and whichever cache keys
// the transcript supplied, plus `ts` on exactly the rule the close follows. It
// carries NO `plan`: with two open dispatches of one role there is no single
// plan to name, and one shape for the event whatever gate wrote it is worth
// more than a field that would sometimes be a guess.
//
// Its identity comes from evidence this rule can SEE, in two places and no
// others. Where a BRACKET already carries the payload's `agent_id`, `corr` and
// `phase` come off that bracket: it is the exact row the fact will fold onto,
// and it is the only evidence gate 2a has, because an already-closed dispatch
// is no longer in `unpaired` at all. Otherwise they come off the corr-scoped
// candidate set, whose rows share a `corr` by construction and carry a REAL
// phase with it - so `renderTrace`'s `--phase` filter needs no carve-out and
// two readers of one record cannot disagree about which phase this worker ran
// in (D-04).
//
// NO FACT AT ALL in three cases. When neither a bracket nor a candidate row is
// there to name, because an invented `corr` is a row no reader could join.
// When the transcript reported NEITHER figure, because absent is not zero and
// an event carrying both keys omitted states nothing (D-12). And when the
// payload carries no `agent_id`, because `corr` plus `agent_id` is the fold's
// only key (D-10) - a worker-key fallback of that shape was refuted in `v3.7.3`
// phase 1 and reverted at `4fbf7280`, and an id-less fact is a row that can
// never reach a bracket.
//
// The unambiguous terminal path is untouched and still answers its single
// `return` carrying the figures. No fact rides beside it: that would put one
// worker's traffic on the record twice.
//
// There is deliberately NO refusing envelope here. The hook emits nothing on
// any stream by contract, so there is no reader for a `reason`, and a bare
// do-nothing answer is what keeps this module outside self-verify check 22.
//
// Pure rule: no fs, no emit, no process, no clock, no randomness. `Date.parse`
// on a `ts` the RECORD supplied is the one exception and is not a clock read:
// it is a deterministic function of bytes the caller handed in, the same way
// `lib/trace.mjs`'s `millis` reads the instants it sorts by.
'use strict';

import { roleOfAgent } from './read-trace.mjs';
import { WORKER_CACHE } from './trace.mjs';
import { terminalOf, cacheOf, STOP_STATE } from './subagent-transcript.mjs';

/**
 * The payload's `agent_id`, or null when it carries none this rule can use.
 * @param {any} payload
 * @returns {string|null}
 */
function agentIdOf(payload) {
  return payload && typeof payload.agent_id === 'string' && payload.agent_id
    ? payload.agent_id : null;
}

/**
 * The bracket on the record that already carries this worker's id, or null.
 * A row here means the worker's close is written and this stop has nothing left
 * to close - AND it is the row a cache-only fact would fold onto, which is why
 * this answers the ROW rather than a boolean: gate 2a has no other evidence to
 * build the fact's identity from, because an already-closed dispatch is no
 * longer in `unpaired` at all.
 *
 * The id is on the CLOSE half, put there by the orchestrator's hand-written
 * `trace close --agent-id`, which is the only writer that ever holds it: the
 * `dispatch` event is written before the subagent exists. So a `true` here is
 * an equality test against a recorded fact, never an inference from clocks.
 *
 * A worker whose close carried no id is indistinguishable from one that never
 * closed, and that is the safe direction: it falls through to the single-open
 * test below, which refuses on any ambiguity of its own.
 *
 * SCOPED TO THE RUN IN FLIGHT, for the same reason gate 2b is (D-03). The id is
 * the host's, not Cadence's: measured 2026-08-26 over 1,333 transcripts, 7 of
 * 1,323 distinct ids appear in two or more transcripts of the SAME project. An
 * unscoped match lets one of those reuses find a bracket from a DEAD run, and
 * because gate 2a quotes its identity off the row it matched, the fact is then
 * written wearing that dead run's `corr` and `phase` - so D-10's corr-scoped
 * fold has nothing left to defend, the figures land on a bracket in another
 * phase, and a `--phase` render never shows the misplacement. Before this
 * phase the same unscoped match was a silent no-op; the WRITE is what made it
 * reachable.
 *
 * The scope is the candidate set's own `corr`, never a second notion of "now":
 * where a dispatch of this role is open, the worker stopping is in THAT run and
 * a bracket from any other one is a collision. Where no dispatch is open there
 * is no live run to steal from, the match stays unscoped, and a worker whose
 * bracket is already closed still finds it.
 *
 * @param {any} render the result of `renderTrace(...)`
 * @param {string} id
 * @param {any} corr the run in flight, or null/undefined for no scope
 * @returns {any}
 */
function closedBracket(render, id, corr) {
  const rows = render && Array.isArray(render.brackets) ? render.brackets : [];
  const scoped = corr === null || corr === undefined
    ? rows : rows.filter((row) => row && corrKey(row.corr) === corrKey(corr));
  return scoped.find((row) => row && row.agent_id === id) || null;
}

/**
 * The cache-only fact a withholding gate answers, as a one-entry list - or an
 * empty one where there is nothing this rule may state.
 *
 * @param {string|null} id the payload's `agent_id`; without it the fact has no
 *   join key and can never reach a bracket (D-10), so there is nothing to write
 * @param {string} role the MAPPED role, never the host's `agent_type`
 * @param {Record<string, number>} cache what `cacheOf` summed; EMPTY means the
 *   transcript reported neither figure, and absent is not zero (D-12)
 * @param {string|null} ts the worker's own stop instant, omitted where the
 *   evidence named none - the same rule the close's `ts` follows
 * @param {any} source the row this fact quotes `corr` and `phase` off: the
 *   bracket already carrying the id, else a candidate dispatch of the current
 *   run. Null means the rule can see no run to name and writes nothing.
 * @returns {any[]}
 */
function cacheFact(id, role, cache, ts, source) {
  if (!id || !source || !Object.keys(cache).length) return [];
  return [{
    corr: source.corr,
    phase: source.phase,
    family: 'lifecycle',
    event: WORKER_CACHE,
    role,
    agent_id: id,
    ...(ts ? { ts } : {}),
    ...cache,
  }];
}

/**
 * A `corr` as a comparison key, so `1` and `"1"` name one run. The same
 * coercion `lib/trace.mjs`'s `key()` applies to the pairing, restated in three
 * words rather than exported: the two are the same rule about the same field.
 * @param {any} v
 */
function corrKey(v) {
  return v === undefined || v === null ? '' : String(v);
}

/**
 * The rows of one run: the `corr` of the NEWEST dated row, and every row
 * carrying it. Rows arrive already filtered to one role.
 *
 * This is a scope, never a choice (D-03). It removes a DEAD run's leftovers
 * from the count - `unpaired` accumulates for the life of the file - and it
 * cannot separate two workers of one run, because they share a `corr` and both
 * survive it. An undated row contributes no clock and is treated as oldest, and
 * a set with no dated row at all is returned untouched, which is what this gate
 * counted before the scope existed.
 *
 * @param {any[]} rows
 * @returns {any[]}
 */
function currentRun(rows) {
  let newest = null;
  let corr;
  for (const row of rows) {
    if (typeof row.ts !== 'string' || !row.ts) continue;
    const t = Date.parse(row.ts);
    if (!Number.isFinite(t)) continue;
    if (newest === null || t > newest) { newest = t; corr = row.corr; }
  }
  if (newest === null) return rows;
  return rows.filter((row) => corrKey(row.corr) === corrKey(corr));
}

/**
 * The events a stopped subagent should append, in file order. EMPTY is the
 * do-nothing answer - never null, so the disk half's one loop covers both and
 * there is no second shape for a caller to test for (D-08).
 *
 * @param {any} payload the host's `SubagentStop` JSON
 * @param {any} render the result of `renderTrace(planningRoot)` - unscoped,
 *   because the payload carries no phase to scope it by (D-01)
 * @param {{transcript?: any}} [evidence] what the disk half read for this stop
 *   (D-08). `transcript` is the stopped worker's own JSONL, whole, as a string.
 *   Omitted - the shape every pre-evidence caller uses - the termination gate
 *   answers `unknown`, the cache sums answer nothing at all, and this rule
 *   proceeds exactly as it does with one.
 * @returns {{corr: any, phase: any, plan?: any, family: string, event: string, role: string, agent_id?: string, ts?: string, cache_creation_input_tokens?: number, cache_read_input_tokens?: number}[]}
 *   Either the single `return` an unambiguous terminal stop closes with, or the
 *   single `WORKER_CACHE` fact a withholding gate states instead, or nothing.
 */
export function closeForStop(payload, render, evidence) {
  const transcript = evidence && evidence.transcript;
  // GATE 1 - the self-filter, AND IT RUNS FIRST. `roleOfAgent` is null for the
  // host's own types, for `coordinator`, and for anything else that is not a
  // Cadence rung file. It moved ahead of the termination gate because every
  // withholding arm below now writes a fact carrying the MAPPED role, and a
  // type with no role is not a Cadence worker at all. No answer moved with it:
  // each gate withholds the close on its own evidence.
  const role = roleOfAgent(payload && payload.agent_type);
  if (!role) return [];

  // The evidence every arm below reads, taken ONCE. `closedBracket` is gate 2a's
  // test and the fact's identity source in the same row; `mine` is gate 2b's
  // count and the fact's identity source everywhere else.
  const id = agentIdOf(payload);
  const cache = cacheOf(transcript);
  const stopped = terminalOf(transcript);
  const rows = render && Array.isArray(render.unpaired) ? render.unpaired : [];
  // `mine` is computed FIRST because gate 2a's match now reads its `corr`: the
  // candidate set is what names the run in flight, and a bracket outside it
  // wearing this id is a reused host id rather than this worker's own close.
  const mine = currentRun(rows.filter((row) => row && row.role === role));
  const closed = id ? closedBracket(render, id, mine.length ? mine[0].corr : null) : null;
  // The one answer a withholding gate gives: the figures, and never a close.
  const withheld = () => cacheFact(id, role, cache, stopped.ts, closed || mine[0] || null);

  // GATE 0 - the termination gate. NOT-TERMINAL alone refuses the CLOSE;
  // `unknown` falls through to the behaviour this hook had before it read a
  // transcript at all. What a refusal answers is the fact: a worker handed back
  // mid-turn has still billed the cache traffic its transcript reports, and no
  // other writer will ever hold it.
  if (stopped.state === STOP_STATE.NOT_TERMINAL) return withheld();

  // GATE 2a - this worker's close may already be on the record. The hand-written
  // close carries the id; a hook stop that arrives after it has nothing left to
  // close, and falling through would land it on whatever ELSE is open - which is
  // the stolen-bracket defect, arriving after the fact instead of ahead of it.
  // The figures still land, on the very bracket the id matched.
  if (closed) return withheld();

  // GATE 2b - UNAMBIGUOUS OR NOTHING, within the CURRENT RUN. `currentRun` drops
  // a dead run's stranded rows before the count is taken (D-03) - without it,
  // every dispatch of the role ever left open counts as a live worker forever
  // and this gate refuses unconditionally. It never chooses between two workers:
  // one run's concurrent dispatches share a `corr`, so they both survive the
  // scope and are both still refused below.
  //
  // `unpaired` already carries the DISPATCH's own `role` (the field the pairing
  // computed), so this reads the render's answer rather than deriving a second
  // one. Exactly one open dispatch of the role is the only state in which this
  // rule knows whose stop it is holding: TRC-06 forbids the newest-open adoption
  // by name, and no ordering of dispatch instants can separate two workers that
  // were dispatched in one message - which is precisely what the parallel path
  // does. Refusing here still costs the record nothing but the CLOSE: the
  // figures ride the fact.
  if (mine.length !== 1) return withheld();
  const best = mine[0];

  // GATE 3 - the event. Identity quoted verbatim off the adopted row; no figure
  // the host puts on a RETURN, because this hook never sees one, and the two
  // cache figures the worker's own transcript reported, because nothing else
  // ever will. Each cache key is spread only where the sum exists, so a
  // transcript that reported neither leaves the event exactly as it was before
  // this hook read one.
  //
  // `ts` is the ONE field this rule takes off the transcript rather than off
  // the adopted row, and it is the worker's OWN stop instant. Without it
  // `renderEvent` stamps `new Date()` at append, so a hook close delayed past
  // the next dispatch of the same worker key would carry an instant LATER than
  // that dispatch - and `renderTrace`'s repeat-close discriminator, which asks
  // whether the terminal precedes the head pending dispatch, could never fire
  // in production (D-06). It is quoted byte for byte and never reparsed: an
  // instant no reader can parse contributes nothing downstream, which is the
  // posture the whole record already takes for an unreadable clock, while an
  // append time invents a figure that looks real. OMITTED, never null, when the
  // evidence names no instant - the absent-not-zero rule the bracket's own
  // `duration_ms` follows.
  return [{
    corr: best.corr,
    phase: best.phase,
    plan: best.plan,
    family: 'lifecycle',
    event: 'return',
    role,
    ...(stopped.ts ? { ts: stopped.ts } : {}),
    ...cache,
  }];
}
