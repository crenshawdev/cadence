// @ts-check
// the pure rule behind the SubagentStop hook: which open bracket this stopped subagent closes, if any
// bin/subagent-trace.mjs is the disk half, so this stays testable on synthetic pairs with no hook or filesystem
// a session that dies between a bracket's two writes leaves a dispatch that never closes, and the host stops every
// subagent, so this is the writer that can't be skipped
// the hand-written `trace close` stays: only it sees the return's token, turn and wall-clock figures
// pure: no fs, no emit, no clock; Date.parse on a ts the record supplied reads bytes, not a clock
'use strict';

import { roleOfAgent, rungOfAgent } from './rung-agent.mjs';
import { WORKER_CACHE } from './trace.mjs';
import { terminalOf, cacheOf, effortOf, transcriptEntries, STOP_STATE } from './subagent-transcript.mjs';

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
 * The bracket already carrying this worker's id, or null. It answers the row, not a boolean, because a cache-only
 * fact folds onto it.
 * Only the hand-written `trace close --agent-id` writes the id, so a close without one looks like a worker that
 * never closed, which is the safe direction.
 * Scoped to the run in flight: the host reuses ids across a project's transcripts, and unscoped, a reused id finds
 * a dead run's bracket and the fact lands wearing that run's corr and phase.
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
 * The cache-only fact a withholding gate answers, as a one-entry list, or an empty one where there's nothing this
 * rule may state.
 * @param {string|null} id the payload's `agent_id`; without it the fact has no join key
 * @param {string} role the mapped role, never the host's `agent_type`
 * @param {Record<string, number>} cache what `cacheOf` summed; empty means unreported, not zero
 * @param {string|null} ts the worker's own stop instant, omitted where the evidence named none
 * @param {any} source the row this fact takes `corr` and `phase` from; null means no run to name, so nothing is written
 * @param {{effort?: string, rung?: string}} ran the transcript's effort and the dispatched rung, empty without one
 * @returns {any[]}
 */
function cacheFact(id, role, cache, ts, source, ran) {
  // an effort alone is worth writing: asking for a cache figure used to drop the one sighting of a silent downgrade
  // corr plus agent_id is the fold's only key, so without an id and a source there is nowhere for the fact to land
  if (!id || !source || !(Object.keys(cache).length || Object.keys(ran).length)) return [];
  return [{
    corr: source.corr,
    phase: source.phase,
    family: 'lifecycle',
    event: WORKER_CACHE,
    role,
    agent_id: id,
    ...(ts ? { ts } : {}),
    ...cache,
    ...ran,
  }];
}

/**
 * A `corr` as a comparison key, so `1` and `"1"` name one run. Same coercion as `key` in `lib/trace.mjs`,
 * restated rather than exported.
 * @param {any} v
 */
function corrKey(v) {
  return v === undefined || v === null ? '' : String(v);
}

/**
 * An instant as a number, or null when unparseable, so it contributes nothing instead of being coerced to 0.
 * @param {any} v
 * @returns {number|null}
 */
function instant(v) {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * The clock a bracket carrying this payload's `agent_id` offers: its `end` where that parses, else its `ts`.
 * `end` goes first because this stop is arriving after the close.
 * These rows are evidence about the run, never candidates to adopt.
 * @param {any} render the result of `renderTrace(...)`
 * @param {string|null} id
 * @returns {{corr: any, ts: any}[]}
 */
function bracketClocks(render, id) {
  if (!id) return [];
  const rows = render && Array.isArray(render.brackets) ? render.brackets : [];
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || row.agent_id !== id) continue;
    out.push({ corr: row.corr, ts: instant(row.end) !== null ? row.end : row.ts });
  }
  return out;
}

/**
 * The run in flight: the `corr` of the newest dated evidence that could be about this worker, and the candidate
 * rows carrying it.
 * A scope, not a choice: it drops a dead run's leftovers (`unpaired` never shrinks) but can't separate two workers
 * of one run, since they share a `corr`.
 * Brackets are in the clock because once something closed this worker's dispatch, the role's surviving `unpaired`
 * rows are a dead run's, and gate 2b would write a `return` into another phase's bracket. Rows come before clocks
 * so an unpaired dispatch wins an exact tie.
 * @param {any[]} rows the role's `unpaired` rows - the candidate set
 * @param {{corr: any, ts: any}[]} clocks dated evidence that names a run but can never be adopted
 * @returns {{corr: any, rows: any[]}} `corr` is null when nothing was dated
 */
function currentRun(rows, clocks) {
  let newest = null;
  let corr = null;
  for (const row of [...rows, ...clocks]) {
    const t = instant(row.ts);
    if (t === null) continue;
    if (newest === null || t > newest) { newest = t; corr = row.corr; }
  }
  if (newest === null) return { corr: null, rows };
  return { corr, rows: rows.filter((row) => corrKey(row.corr) === corrKey(corr)) };
}

/**
 * The events a stopped subagent should append, in file order. Empty is the do-nothing answer, never null, so the
 * disk half's one loop covers both.
 * @param {any} payload the host's `SubagentStop` JSON
 * @param {any} render the result of `renderTrace(planningRoot)`, unscoped because the payload carries no phase
 * @param {{transcript?: any}} [evidence] the worker's own JSONL as a string; without it the gate answers `unknown`
 * @returns {{corr: any, phase: any, plan?: any, family: string, event: string, role: string, agent_id?: string, ts?: string, cache_creation_input_tokens?: number, cache_read_input_tokens?: number, effort?: string, rung?: string}[]}
 * Either the single `return` an unambiguous terminal stop closes with, or the single `WORKER_CACHE` fact a
 * withholding gate states instead, or nothing. `effort` and `rung` ride both and are omitted together when the
 * transcript named no effort.
 */
export function closeForStop(payload, render, evidence) {
  const transcript = evidence && evidence.transcript;
  // gate 1, the self-filter, is the whole enforcement: the host never applies a hooks.json matcher
  const role = roleOfAgent(payload && payload.agent_type);
  if (!role) return [];

  // taken once for every arm: closedBracket is gate 2a's test and the fact's identity source, mine is gate 2b's count
  const id = agentIdOf(payload);
  const entries = transcriptEntries(transcript);
  const cache = cacheOf(entries);
  const stopped = terminalOf(entries);
  // effort comes from the worker's own transcript, never the payload: that reports the configured level
  // (`max` on a run whose transcript recorded `high`), the very downgrade this pair exposes
  const effort = effortOf(entries);
  // both keys or neither; gate 1 already refused every type with no rung file, so a role means a rung
  const ran = effort ? { effort, rung: rungOfAgent(payload && payload.agent_type) } : {};
  const rows = render && Array.isArray(render.unpaired) ? render.unpaired : [];
  // named once so gates 2a and 2b share one notion of now; a bracket can name it when no unpaired row of the role
  // survives, which is where a stop arriving after its own close sits
  const run = currentRun(
    rows.filter((row) => row && row.role === role),
    bracketClocks(render, id),
  );
  const mine = run.rows;
  const closed = id ? closedBracket(render, id, run.corr) : null;
  // what every withholding gate answers: the figures, never a close
  const withheld = () => cacheFact(id, role, cache, stopped.ts, closed || mine[0] || null, ran);

  // gate 0: only not-terminal refuses the close. unknown falls through to the behaviour from before transcripts were
  // read, since folding it in would let one host-side rename delete every hook close, silently.
  // a refusal still answers the fact: a worker handed back mid-turn billed real cache traffic nothing else holds
  if (stopped.state === STOP_STATE.NOT_TERMINAL) return withheld();

  // gate 2a: a stop after the hand-written close has nothing left to close; falling through would hit another open row
  if (closed) return withheld();

  // gate 2b: exactly one open dispatch in the current run, or nothing. Two workers dispatched in one message share a
  // clock, so adopting the newest would cross them; currentRun drops a dead run's rows, or this would refuse forever
  if (mine.length !== 1) return withheld();
  const best = mine[0];

  // gate 3: identity quoted off the adopted row, no return figures (the hook never sees any), and the cache sums
  return [{
    corr: best.corr,
    phase: best.phase,
    plan: best.plan,
    family: 'lifecycle',
    event: 'return',
    role,
    // without it the post-pass fold can't reach this bracket, and closedBracket won't recognise a repeat stop
    ...(id ? { agent_id: id } : {}),
    // the worker's own stop instant, as is: renderEvent would stamp the append time, and a close delayed past the next
    // dispatch of the same key would carry a later instant, so renderTrace's repeat-close check could never fire
    ...(stopped.ts ? { ts: stopped.ts } : {}),
    ...cache,
    ...ran,
  }];
}
