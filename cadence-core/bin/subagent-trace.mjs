// @ts-check
// the SubagentStop hook: closes the bracket the orchestrator opened, so it outlives the session that opened it
// the disk half of lib/subagent-trace.mjs, which holds the rule
// it prints nothing and always exits 0, since a nonzero exit or stray stdout goes back to the model as feedback
// hooks.json can't carry comments: no `matcher` because the host never applies one to SubagentStop, and a 10 second
// timeout, not PostToolUse's 5, since this one parses the whole trace
// the hand-written `trace close` stays: only it sees the return's figures, and /cad-task has no subagent to close
'use strict';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { planningRoot } from './lib/git-segments.mjs';
import { roleOfAgent } from './lib/rung-agent.mjs';

// a hook is the worst place to find out a transcript is huge; 8 MiB is about 3x the biggest seen
const MAX_TRANSCRIPT_BYTES = 8388608;

// the stopped worker's own transcript, or null; the rule reads every failure here as unknown
function readTranscript(p) {
  // `agent_transcript_path`, never `transcript_path`: that one is the orchestrator's session, not the worker's
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
    // a bad answer can't throw in a hook; appendEvent keeps each event's corr, so it joins the adopted bracket
    if (Array.isArray(events)) for (const event of events) appendEvent(root, event);
  }
} catch {
  // silent by contract: a broken recorder must never disturb normal work, and there's no stream it may report on
}
process.exit(0);
