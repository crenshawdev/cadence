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
//    `workflow.max_dispatch_tokens.<role>` key can ever match. Instead the rule
//    takes the NEWEST `unpaired` dispatch whose `role` is the mapped role and
//    quotes ITS `corr`, `phase` and `plan` verbatim. No matching row means DO
//    NOTHING: the hook never invents a dispatch and never opens a bracket.
//
//    The accepted cost, stated rather than worked around: two workers of one
//    role running concurrently on the parallel `/cad-execute` path can have
//    their closes attributed to each other's worker key. Both brackets still
//    pair and both roles still bill correctly; only the plan numbers can cross.
//    The payload's `agent_id` is the field that would fix it, and joining it
//    needs a START-half hook, which D-02 refuses on measured grounds.
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
 * The close event a stopped subagent should append, or null for do-nothing.
 *
 * @param {any} payload the host's `SubagentStop` JSON
 * @param {any} render the result of `renderTrace(planningRoot)` - unscoped,
 *   because the payload carries no phase to scope it by (D-01)
 * @param {{transcript?: any}} [evidence] what the disk half read for this stop
 *   (D-08). `transcript` is the stopped worker's own JSONL, whole, as a string.
 *   Omitted - the shape every pre-transcript caller uses - the termination gate
 *   answers `unknown` and this rule is exactly what it was.
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

  // GATE 2 - adopt the newest open dispatch of that role. `unpaired` already
  // carries the DISPATCH's own `role` (the field the pairing computed), so this
  // reads the render's answer rather than deriving a second one.
  const rows = render && Array.isArray(render.unpaired) ? render.unpaired : [];
  let best = null;
  let bestT = -Infinity;
  for (const row of rows) {
    if (!row || row.role !== role) continue;
    const t = millis(row.ts);
    // An unreadable `ts` sorts BELOW every readable one and never displaces a
    // row whose clock could be read. `>=` breaks a tie - and the all-unreadable
    // case - toward the row written LAST, because the record is append-ordered
    // and later-written is the best available reading of "newest" when the
    // clock cannot answer.
    const at = t === null ? -Infinity : t;
    if (best === null || at >= bestT) { best = row; bestT = at; }
  }
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
