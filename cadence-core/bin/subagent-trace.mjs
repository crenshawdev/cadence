// @ts-check
// subagent-trace.mjs - the SubagentStop hook that CLOSES the bracket the
// orchestrator opened, so a bracket survives the session that opened it.
//
// The disk half of lib/subagent-trace.mjs: resolve the Cadence project from the
// hook's cwd, render the trace, hand both to the rule, append whatever it
// answers. The rule - the self-filter, which open dispatch a stop adopts, and
// what the event may carry - lives in the lib and is tested there without a
// hook, the same split lib/read-trace.mjs and lib/deferred-reads.mjs use.
//
// Contract: stdin carries the hook JSON; this hook emits NOTHING on any stream
// and exits 0 unconditionally, and every failure is silent. SubagentStop runs
// after the subagent has already returned, so there is no decision left to
// influence - but a nonzero exit or stray stdout from a hook is fed back to the
// model as feedback, so a recorder that spoke would be editing the conversation
// it exists to measure. That is read-trace.mjs's contract exactly, and it is
// inherited rather than restated in its own words on purpose.
//
// The trace is rendered with NO phase scope: the stop payload carries no phase
// to scope it by (D-01), and the rule needs every open dispatch in the record to
// pick the one this worker belongs to. `appendEvent` honours a caller-supplied `corr`,
// which is what lets the answer join the ADOPTED bracket instead of re-deriving
// an id off disk - the derivation reads `.planning/STATE.md`-era anchors and
// would key this close to whatever phase the tree looks like now.
//
// TWO THINGS THE REGISTRATION SAYS that hooks.json cannot carry a comment for.
// It declares NO `matcher` (D-08): the 2.1.245 `Stop`/`SubagentStop` runner
// calls the hook dispatcher with no `matchQuery` at all, so a declared matcher
// is a filter the host will never apply, and lib/subagent-trace.mjs's
// self-filter is the whole enforcement. And its `timeout` is 10 seconds rather
// than the PostToolUse recorder's 5, because that recorder appends one line and
// parses nothing while this one parses the WHOLE trace: measured 23 ms against a
// 1,040,275-byte, 4,510-line `trace.jsonl` (2026-08-25, warm), so 10 s is two
// orders of magnitude of headroom on a file the 1 MiB cap already bounds.
//
// The hand-written `trace close` is KEPT beside this, and is not a duplicate to
// prune: it alone sees the return, so it alone carries the token, tool-use and
// wall-clock figures, and /cad-task's phase-0 bracket has no subagent behind it
// for any hook to close. `renderTrace`'s worker-key dedup folds whichever of the
// two writers arrives second into the row the first opened.
'use strict';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { renderTrace, appendEvent } from './lib/trace.mjs';
import { closeForStop } from './lib/subagent-trace.mjs';

// The ceiling on the ONE unbounded read this hook does. The stopped worker's
// transcript is a file the host grows for as long as the worker runs, so it has
// no natural bound and a hook is the worst place to discover that. Measured
// 2026-08-26 over the 1,289 subagent transcripts on this machine: 115 B to
// 2,608,524 B, p90 1,127,531 B, p99 1,789,123 B, and a whole-file parse takes
// about 1 ms against the 10-second timeout `hooks/hooks.json` gives this hook.
// 8 MiB is 3.2x the measured maximum, so the ceiling costs nothing today and
// still refuses a pathological file rather than reading it; it is the same
// figure `lib/read-trace.mjs` puts on `reads.jsonl`, restated here rather than
// imported because the two bound different files for different reasons.
// Above the ceiling the answer is UNKNOWN - nothing is read and nothing is
// partially parsed - and the rule's unknown arm writes the close it writes
// today rather than suppressing it.
const MAX_TRANSCRIPT_BYTES = 8388608;

// Walk up from the hook's cwd, stopping at the repo root: a session opened in a
// subdirectory still bills the project. The same rule and the same reason as
// read-trace.mjs and git-guard.mjs, which each carry their own copy - a hook
// script's whole disk half is this walk plus one call, and the three copies are
// the shape this tree already chose for it.
function planningRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.planning'))) return join(dir, '.planning');
    if (existsSync(join(dir, '.git'))) return null; // repo root, not Cadence
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// The stopped worker's own transcript, or null for "nothing to read". The path
// is the payload's `agent_transcript_path` - the field the `SubagentStop` event
// puts the WORKER's own file on - and never the `transcript_path` that every
// hook event carries, which names the SESSION's transcript: the ORCHESTRATOR's
// own conversation, a different actor entirely. Measured 2026-08-26 against the
// installed 2.1.246 binary, a `SubagentStop` payload is the common hook input
// plus `stop_hook_active`, `agent_id`, `agent_transcript_path`, `agent_type` and
// an optional `last_assistant_message`, and the host derives
// `agent_transcript_path` from the agent id.
//
// READING THE SESSION FILE CORRUPTED ALL THREE ANSWERS this hook takes off a
// transcript, which is the whole of the short figure on the record. `terminalOf`
// read the ORCHESTRATOR's `end_turn` and called the worker finished; both cache
// sums were the orchestrator's traffic rather than the worker's; and the `ts`
// that reached the record was the orchestrator's last assistant timestamp, which
// is why a 378-second run rendered as a 22-second one. Measured 2026-08-26 on
// this repository's own record: `.planning/trace.jsonl`'s only cache-bearing
// event carries 52,918 / 528,568, exactly `cacheOf` over the orchestrator's
// session file truncated at that event's own `ts`, while the worker's own file
// sums 100,439 / 2,115,871.
//
// NO FALLBACK to `transcript_path` when the worker's field is absent. The
// session transcript is evidence about a DIFFERENT ACTOR, so an absent field
// means NO evidence rather than second-best evidence: `readTranscript` states
// that as null, which `cacheOf` answers `{}` and `terminalOf` answers `unknown`
// - the behaviour this hook had before it read any transcript at all.
//
// The path is used AS GIVEN: it is not reconstructed out of a session id and a
// project slug, so what this hook is exposed to is the file's internal format
// alone and never its location, which is the one part of an explicitly unstable
// layout that can be avoided.
//
// Nothing this file contains reaches any stream or any other process. The rule
// reads it for three answers - did the worker stop, when, and how much cache
// traffic it billed - and what leaves is the terminal entry's timestamp, which
// `JSON.stringify` escapes on its way onto the record, plus two sums that are
// NUMBERS by construction: `lib/subagent-transcript.mjs` adds a `usage` field
// only where it is already a finite number, so no byte of transcript text can
// ride out on them. Every failure is null, which the rule reads as UNKNOWN and
// treats as today's behaviour.
function readTranscript(p) {
  if (typeof p !== 'string' || !p) return null;
  try {
    if (statSync(p).size > MAX_TRANSCRIPT_BYTES) return null;
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const cwd = String(input?.cwd || process.cwd());
  const root = planningRoot(cwd);
  if (root) {
    const evidence = { transcript: readTranscript(input?.agent_transcript_path) };
    // A LIST, appended in the order the rule gave it (D-08). One stop can owe
    // the record more than one event - a gate that withholds the close still
    // holds cache figures nothing else will ever have - and the empty list is
    // the do-nothing answer, so there is no null arm to test for. The
    // `Array.isArray` guard is not defensive style: a non-array answer inside a
    // hook contractually forbidden to speak on any stream must write nothing
    // rather than throw, and the `catch` below is silent by design.
    const events = closeForStop(input, renderTrace(root), evidence);
    if (Array.isArray(events)) for (const event of events) appendEvent(root, event);
  }
} catch {
  // Every failure is silent by contract: a broken recorder must never disturb
  // normal work, and there is no stream it may report on.
}
process.exit(0);
