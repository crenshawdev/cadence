// @ts-check
// the SubagentStop hook: closes the bracket the orchestrator opened, so it outlives the session that opened it
// the disk half of lib/subagent-trace.mjs, which holds the rule
// it prints nothing and always exits 0, since a nonzero exit or stray stdout is fed back to the model as feedback
// hooks.json can't carry comments: no `matcher` is declared because the host never applies one to SubagentStop, and the
// timeout is 10 seconds, not the PostToolUse recorder's 5, since this one parses the whole trace
// the hand-written `trace close` stays: only it sees the return's figures, and a /cad-task bracket has no subagent to close
'use strict';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { planningRoot } from './lib/git-segments.mjs';
import { roleOfAgent } from './lib/rung-agent.mjs';

// a transcript grows as long as the worker runs and a hook is the worst place to find that out; 8 MiB is about 3x the biggest seen
const MAX_TRANSCRIPT_BYTES = 8388608;

// the stopped worker's own transcript, or null; the rule reads every failure here as unknown
function readTranscript(p) {
  // `agent_transcript_path`, never `transcript_path`, which is the orchestrator's session: its end_turn, cache sums and ts aren't the worker's
  if (typeof p !== 'string' || !p) return null;
  try {
    // over the cap the answer is unknown, so the rule writes the close it wrote before transcripts were read
    if (statSync(p).size > MAX_TRANSCRIPT_BYTES) return null;
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const cwd = String(input?.cwd || process.cwd());
  // walk up so a session opened in a subdirectory still bills the project
  const project = planningRoot(cwd, (dir, name) => existsSync(join(dir, name)));
  const root = project === null ? null : join(project, '.planning');
  // anything that isn't a Cadence role is turned away before the transcript is read or the trace modules load
  if (root && roleOfAgent(input?.agent_type)) {
    const { renderTrace, appendEvent } = await import('./lib/trace.mjs');
    const { closeForStop } = await import('./lib/subagent-trace.mjs');
    const evidence = { transcript: readTranscript(input?.agent_transcript_path) };
    // no phase scope: the payload carries none, and the rule needs every open dispatch to pick this worker's
    const events = closeForStop(input, renderTrace(root), evidence);
    // a hook that must not speak can't throw on a bad answer; appendEvent keeps each event's corr, so it joins the adopted bracket
    if (Array.isArray(events)) for (const event of events) appendEvent(root, event);
  }
} catch {
  // silent by contract: a broken recorder must never disturb normal work, and there's no stream it may report on
}
process.exit(0);
