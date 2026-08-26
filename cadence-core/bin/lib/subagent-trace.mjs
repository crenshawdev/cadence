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
// GATE 0, AND IT RUNS AHEAD OF EVERYTHING. THE TERMINATION GATE (D-09). The
// payload carries no field that separates a worker that FINISHED from one
// handed back mid-turn - `stop_hook_active` is documented for `Stop` and is not
// a `SubagentStop` field - so the evidence is the worker's own transcript,
// which the payload points at through its documented `transcript_path`. The
// disk half reads it and INJECTS the bytes (D-08); `lib/subagent-transcript.mjs`
// holds the rule that reads them.
//
// It runs before the render is even consulted, because a worker that has not
// stopped must produce nothing whatever the record holds. And it refuses on
// NOT-TERMINAL alone, never on UNKNOWN: a payload with no `transcript_path`, a
// file that could not be read, an over-cap file and a layout that changed all
// arrive as `unknown` and still produce the close this hook produces today.
// Folding `unknown` into the refusal is how a host-side rename would delete
// every hook close in the record at once and silently.
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
//    WHICH open dispatch is the agent-identity join (D-07). Adopting the NEWEST
//    one crosses two same-role workers whenever more than one is open, which is
//    live today - `parallelization.enabled` dispatches up to
//    `max_concurrent_agents` executors at once - and the stop payload's
//    `agent_id` is the only field that can tell them apart. The trace's own
//    `dispatch` event cannot carry it and never can: that event is written
//    BEFORE the subagent exists, so the id does not yet have a value. The join
//    is therefore through a record written from inside the worker -
//    `.planning/reads.jsonl`, whose rows `lib/read-trace.mjs`'s `recordFromHook`
//    stamps with the same `agent_id` spelling the stop payload uses.
//
//    The rule: take the EARLIEST `ts` among read records carrying the payload's
//    `agent_id` - the first thing that worker did - then among the open
//    dispatches of its role keep the ones at or before that instant and adopt
//    the LATEST of them. A worker's first read cannot precede its own dispatch,
//    so a dispatch opened after it belongs to somebody else.
//
//    The FALLBACK is stated rather than silent: when the payload carries no
//    `agent_id`, when no read record carries it, or when no open dispatch of
//    that role precedes its first read, the newest-open adoption above stands
//    unchanged. No close this hook writes today is lost to a missing join.
//
//    The accepted cost, stated rather than worked around: two same-role workers
//    dispatched in one batch whose first reads interleave can still cross, since
//    the ordering evidence is the reads rather than the dispatches themselves.
//    Both brackets still pair and both roles still bill correctly; only the plan
//    numbers can cross, and only in that narrower case.
//
// 3. THE EVENT, and NOTHING else on it. A `lifecycle` `return` carrying the
//    adopted `corr`, `phase`, `plan` and `role`. No `tokens`, no `turns`, no
//    `duration_ms`, no `detail`: the payload carries none of them, and
//    `lib/trace.mjs`'s token-provenance header states why a fabricated figure
//    is strictly worse than an absent one - an invented number lands in `trace
//    suggest`'s share denominator and misprices every other role with it. The
//    hand-written close supplies the figures, and `renderTrace`'s worker-key
//    dedup folds whichever writer arrives second into the row the first opened.
//
// There is deliberately NO refusing envelope here. The hook emits nothing on
// any stream by contract, so there is no reader for a `reason`, and a bare
// do-nothing answer is what keeps this module outside self-verify check 22.
//
// Pure rule: no fs, no emit, no process, no Date, no randomness.
'use strict';

import { roleOfAgent } from './read-trace.mjs';
import { terminalOf, STOP_STATE } from './subagent-transcript.mjs';

/**
 * A timestamp as milliseconds, or null when there is nothing to read. Same
 * posture `lib/trace.mjs` takes: an unparseable `ts` contributes NOTHING to the
 * comparison rather than putting a NaN into it, because every NaN comparison is
 * false and the newest row would silently become the first one tested.
 * @param {any} v
 * @returns {number|null}
 */
function millis(v) {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/**
 * The newest open dispatch among rows already filtered to one role - the
 * adoption this rule has always made, and now the fallback the identity join
 * lands on whenever it has nothing to go on.
 * @param {any[]} rows
 * @returns {any|null}
 */
function newestOpen(rows) {
  let best = null;
  let bestT = -Infinity;
  for (const row of rows) {
    const t = millis(row.ts);
    // An unreadable `ts` sorts BELOW every readable one and never displaces a
    // row whose clock could be read. `>=` breaks a tie - and the all-unreadable
    // case - toward the row written LAST, because the record is append-ordered
    // and later-written is the best available reading of "newest" when the
    // clock cannot answer.
    const at = t === null ? -Infinity : t;
    if (best === null || at >= bestT) { best = row; bestT = at; }
  }
  return best;
}

/**
 * The join's third answer: the evidence positively places this worker's own
 * dispatch OUTSIDE the open set, so there is nothing here for it to close. It
 * is a sentinel and not `null` because the two mean opposite things to the
 * caller - `null` is "cannot say, fall back", and falling back is precisely
 * what writes a closed worker's terminal onto a live dispatch's bracket.
 */
const NO_OPEN_DISPATCH = Object.freeze({ noOpenDispatch: true });

/**
 * The first `.planning/reads.jsonl` instant recorded for every agent id in the
 * evidence, as a Map of id -> milliseconds. A record written from INSIDE a
 * worker is the only place an agent id and a clock appear together, which is
 * why the trace's own `dispatch` event can never supply this.
 *
 * A row whose `ts` cannot be read contributes nothing rather than sorting low:
 * this whole join is an ordering claim, and a row with no readable clock
 * supports no ordering claim at all.
 *
 * @param {any[]} records
 * @returns {Map<string, number>}
 */
function firstReadByAgent(records) {
  const first = new Map();
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    const id = typeof r.agent_id === 'string' && r.agent_id ? r.agent_id : null;
    if (!id) continue;
    const t = millis(r.ts);
    if (t === null) continue;
    const prior = first.get(id);
    if (prior === undefined || t < prior) first.set(id, t);
  }
  return first;
}

/**
 * The open dispatch the payload's `agent_id` belongs to (GATE 2's join, D-07).
 *
 * THREE answers, not two, and the third is what stops a worker that has
 * already been closed from taking a live dispatch's bracket:
 * - a ROW - this worker's own open dispatch, adopt it;
 * - `NO_OPEN_DISPATCH` - the evidence positively says this worker has no open
 *   dispatch, so the caller must emit NOTHING rather than fall back;
 * - `null` - the evidence cannot say, so the caller falls back to `newestOpen`,
 *   which is exactly what this rule did before it read an id at all.
 *
 * TWO readings of the same evidence, in order: a RANK when the peer set lines
 * up one for one with the open dispatches, and the CAUSAL FLOOR - the latest
 * dispatch at or before this worker's first read - whenever it does not. The
 * floor alone was the rule until it was found to cross brackets on exactly the
 * case this hook exists for: dispatch A, dispatch B a moment later, then A's
 * first read, which lands AFTER B's dispatch, so A adopted B's row. The body
 * below states what each reading rests on and why the count test bounds the
 * rank.
 *
 * An agent whose first read PRECEDES the oldest open dispatch was dispatched
 * before it too, so its own dispatch is already paired and off this list. That
 * is the `NO_OPEN_DISPATCH` evidence.
 *
 * @param {any} payload the stop payload
 * @param {{reads?: any}|undefined} evidence
 * @param {any[]} rows open dispatches already filtered to the mapped role
 * @returns {any|null}
 */
function adoptByAgentId(payload, evidence, rows) {
  const id = payload && typeof payload.agent_id === 'string' && payload.agent_id
    ? payload.agent_id : null;
  if (!id) return null;
  const records = evidence && Array.isArray(evidence.reads) ? evidence.reads : [];

  const first = firstReadByAgent(records);
  const mine = first.get(id);
  if (mine === undefined) return null;

  // Open dispatches whose clock can be read, oldest first. An unreadable `ts`
  // is SKIPPED rather than fatal: the join is an ordering claim and that row
  // supports none, but it stays eligible in the `newestOpen` fallback, which is
  // what an all-unreadable render resolves through.
  const dated = rows
    .map((row) => ({ row, t: millis(row.ts) }))
    .filter((d) => d.t !== null)
    .sort((a, b) => a.t - b.t);
  if (dated.length === 0) return null;

  const oldest = dated[0].t;
  // Positive evidence: this worker was already reading before the oldest still-
  // open dispatch was made. Its own dispatch is therefore older than every row
  // here and is already paired, so there is nothing open for it to close.
  if (mine < oldest) return NO_OPEN_DISPATCH;

  // THE CAUSAL FLOOR, and the answer whenever ranking cannot be trusted: a
  // dispatch made after this worker was already reading cannot be the one that
  // started it, so the latest dispatch at or before its first read is the best
  // single-worker reading of the evidence.
  let floor = null;
  for (const d of dated) {
    if (d.t > mine) break;
    floor = d.row;
  }

  // RANK, when - and only when - the peer set lines up with the open dispatches
  // one for one. A worker cannot read before it was dispatched, so dispatches
  // ordered by `ts` and their workers ordered by first read are the SAME
  // sequence, and the i-th dispatch is the i-th worker's. That is what the
  // causal floor alone cannot get right: dispatch A, dispatch B a moment later,
  // then A's first read - which lands after B's dispatch, so the floor picks B
  // and the two brackets cross. Ranking is indifferent to how late a first read
  // arrives; it needs only the two orders to agree.
  //
  // The count test is what keeps it honest. `reads.jsonl` is append-ordered
  // across every worker in the session, including workers whose dispatch has
  // already been paired off, so a peer set larger than the open set means some
  // peer is not one of these dispatches and every rank below it is shifted by
  // one. Unequal counts fall back to the floor rather than guessing which peer
  // to drop.
  const peers = [...first.entries()]
    .filter(([, t]) => t >= oldest)
    .sort((a, b) => a[1] - b[1]);
  if (peers.length === dated.length) {
    const rank = peers.findIndex(([peerId]) => peerId === id);
    const picked = rank >= 0 ? dated[rank] : null;
    // The floor still binds the ranked answer: a rank that lands on a dispatch
    // made after this worker was reading is a rank the evidence contradicts.
    if (picked && picked.t <= mine) return picked.row;
  }
  return floor;
}

/**
 * The close event a stopped subagent should append, or null for do-nothing.
 *
 * @param {any} payload the host's `SubagentStop` JSON
 * @param {any} render the result of `renderTrace(planningRoot)` - unscoped,
 *   because the payload carries no phase to scope it by (D-01)
 * @param {{transcript?: any, reads?: any}} [evidence] what the disk half read
 *   for this stop (D-08). `transcript` is the stopped worker's own JSONL, whole,
 *   as a string; `reads` are the parsed `.planning/reads.jsonl` records the
 *   agent-identity join needs. Omitted - the shape every pre-evidence caller
 *   uses - the termination gate answers `unknown` and the adoption falls back to
 *   the newest open dispatch, which is exactly what this rule did before.
 * @returns {{corr: any, phase: any, plan: any, family: string, event: string, role: string, ts?: string}|null}
 */
export function closeForStop(payload, render, evidence) {
  // GATE 0 - the termination gate. NOT-TERMINAL alone refuses; `unknown` falls
  // through to the behaviour this hook had before it read a transcript at all.
  const stopped = terminalOf(evidence && evidence.transcript);
  if (stopped.state === STOP_STATE.NOT_TERMINAL) return null;

  // GATE 1 - the self-filter. `roleOfAgent` is null for the host's own types,
  // for `coordinator`, and for anything else that is not a Cadence rung file.
  const role = roleOfAgent(payload && payload.agent_type);
  if (!role) return null;

  // GATE 2 - adopt an open dispatch of that role. `unpaired` already carries the
  // DISPATCH's own `role` (the field the pairing computed), so this reads the
  // render's answer rather than deriving a second one.
  const rows = render && Array.isArray(render.unpaired) ? render.unpaired : [];
  const mine = rows.filter((row) => row && row.role === role);
  // The identity join first, the newest-open fallback second - but the join now
  // has a third answer that must NOT reach the fallback. `NO_OPEN_DISPATCH` is
  // positive evidence that this worker's own dispatch is already paired, and
  // falling back there is what let a delayed hook close land on the NEXT
  // dispatch of the same role: the close carries no transcript instant on the
  // degraded path, so `renderTrace`'s repeat-close discriminator - which asks
  // whether the terminal precedes the head pending dispatch - could not catch
  // it downstream either (D-06). One of the two guards has to hold, and this is
  // the one that still holds when the transcript is unreadable.
  const adopted = adoptByAgentId(payload, evidence, mine);
  if (adopted === NO_OPEN_DISPATCH) return null;
  const best = adopted || newestOpen(mine);
  if (!best) return null;

  // GATE 3 - the event. Identity quoted verbatim off the adopted row; no figure
  // of any kind, because the payload carries none.
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
  return {
    corr: best.corr,
    phase: best.phase,
    plan: best.plan,
    family: 'lifecycle',
    event: 'return',
    role,
    ...(stopped.ts ? { ts: stopped.ts } : {}),
  };
}
