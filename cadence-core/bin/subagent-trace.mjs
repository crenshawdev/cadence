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
// pick the newest of its role. `appendEvent` honours a caller-supplied `corr`,
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

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { renderTrace, appendEvent } from './lib/trace.mjs';
import { closeForStop } from './lib/subagent-trace.mjs';

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

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const cwd = String(input?.cwd || process.cwd());
  const root = planningRoot(cwd);
  if (root) {
    const event = closeForStop(input, renderTrace(root));
    if (event) appendEvent(root, event);
  }
} catch {
  // Every failure is silent by contract: a broken recorder must never disturb
  // normal work, and there is no stream it may report on.
}
process.exit(0);
