// @ts-check
// cadence-mod.mjs - the Cadence module: the in-process half of the plugin, for
// hosts that load mods. hooks/hooks.json names it under `modules`, beside the
// command hooks. A host without mods ignores that key and keeps the hooks.
//
// It stays thin on purpose. A hooks module may import only relative files and
// `claude-code`: no `node:` module, no Node globals. So every rule it applies
// lives in a dependency-free file under ../cadence-core/bin/lib/, where CI's
// typecheck and test.mjs cover it and the command hooks can share it (the
// `.planning/` walk in lib/git-segments.mjs is the first). This file only wires
// those rules to host events and does its I/O through `$`.
//
// What it does: the band above the prompt, naming the running Cadence agents
// it tracks from subagent start and stop, and redrawn on those and on every
// tool call (Plan 2 of phase 3).
//
// And token capture (Plan 3, D-10/D-11). It keeps each subagent's last
// `turn.step` window, never `turn.complete`'s sum. When a Cadence subagent
// stops it writes that window as one `step_window` fact through `planning.mjs
// trace append`. A subagent's own `trace close` gains the `--agent-id` the host
// sees, so an advisory reviewer's bracket and its fact join. The trace reader
// folds the fact only into a bracket whose return carried no figure, so a
// return's own figure always wins. A write that fails is silent: a record may
// not change a decision.
//
// Every handler calls `next` exactly once and swallows its own errors (D-12).
//
// git-guard, read-trace and subagent-trace stay command hooks on every host, so
// this module makes no git decision and stands no hook down.

import { planningRootAsync } from '../cadence-core/bin/lib/git-segments.mjs';
import { parseCursor } from '../cadence-core/bin/lib/state-cursor.mjs';
import { bandLine, rosterReconcile, rosterStart, rosterStop } from '../cadence-core/bin/lib/band.mjs';
import { roleOfAgent } from '../cadence-core/bin/lib/rung-agent.mjs';
import { closePhase, stepWindow, stepWindowArgv, withAgentId } from '../cadence-core/bin/lib/token-capture.mjs';

/** `dir/name`, without doubling the separator at a filesystem root. */
const at = (/** @type {string} */ dir, /** @type {string} */ name) =>
  (/[\\/]$/.test(dir) ? dir + name : `${dir}/${name}`);

/**
 * Ask the host to draw the band again (D-08). The draw re-reads STATE.md, so
 * this is all a refresh needs. A throw here never reaches the event's answer.
 * @param {any} $
 */
function redraw($) {
  try {
    $.ui.invalidate('ui.render');
  } catch {
    // the next event tries again
  }
}

/**
 * Write a stopped Cadence subagent's last step window (D-10), then forget
 * the agent. The phase is the one its close named, else the cursor's. The
 * project is the walk from the stop's own `cwd`, the field subagent-trace
 * walks from, so the fact lands in the trace.jsonl the close lands in.
 * @param {any} $
 * @param {any} e the `classic.SubagentStop` input
 * @param {Map<string, number>} windows each subagent's latest step window
 * @param {Map<string, string>} phases the phase each subagent's close named
 */
async function capture($, e, windows, phases) {
  let id;
  try {
    id = e.agent_id;
    if (typeof id !== 'string') return;
    const tokens = windows.get(id);
    if (tokens === undefined || roleOfAgent(e.agent_type) === null) return;
    const start = typeof e.cwd === 'string' && e.cwd ? e.cwd : await $.session.cwd();
    const root = await planningRootAsync(start, (dir, name) => $.fs.exists(at(dir, name)));
    if (root === null) return;
    let phase = phases.get(id) ?? null;
    if (phase === null) {
      const cursor = parseCursor(await $.fs.read(at(root, '.planning/STATE.md')));
      if (cursor) phase = String(cursor.phase);
    }
    if (phase === null) return;
    await $.process.run(stepWindowArgv($.plugin.root, phase, id, tokens), { cwd: root, timeoutMs: 10000 });
  } catch {
    // no record this time; the bracket stays figureless
  } finally {
    windows.delete(id);
    phases.delete(id);
  }
}

/** @param {any} on the host's hook registrar */
export function register(on) {
  // The Cadence agents running in this session (D-07). Every write is
  // `roster = transition(roster, ...)` with its await done first, so two
  // handlers interleaving never write back a stale roster.
  /** @type {readonly {id: string, role: string, rung: string}[]} */
  let roster = [];
  // The phase each subagent's own `trace close` named, by agent id.
  /** @type {Map<string, string>} */
  const phases = new Map();
  // Each subagent's latest step window, by agent id.
  /** @type {Map<string, number>} */
  const windows = new Map();

  // Pass-through: `e` goes down unchanged (D-12 leaves Phase 6 its effort
  // override here). A subagent's step that reports usage replaces its window,
  // so the last step wins.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e);
    try {
      const w = typeof e.agentId === 'string' ? stepWindow(result && result.usage) : null;
      if (w !== null) windows.set(e.agentId, w);
    } catch {
      // a step we could not read prices nothing
    }
    return result;
  });

  on('classic.SubagentStart', async ($, e, next) => {
    const answer = await next(e);
    try {
      const session = await $.session.id();
      roster = rosterStart(roster, e, session);
    } catch {
      // the next draw's reconcile adds what this missed
    }
    redraw($);
    return answer;
  });

  on('classic.SubagentStop', async ($, e, next) => {
    const answer = await next(e);
    try {
      roster = rosterStop(roster, e.agent_id);
    } catch {
      // the next draw's reconcile drops what this missed
    }
    redraw($);
    await capture($, e, windows, phases);
    return answer;
  });

  // A `cursor set` or `renumber` is a Bash call, and they are the only STATE
  // writers, so redrawing after each tool call shows a cursor change as soon as
  // it lands. A write from outside the session shows at the next event. No timer.
  //
  // A subagent's own `planning.mjs trace close` gains `--agent-id` here (D-11),
  // and its `--phase` is kept for that agent's step-window fact. Anything that
  // goes wrong before `next` sends the event exactly as the subagent wrote it.
  on('tool.call', async ($, e, next) => {
    let sent = e;
    try {
      if (e.tool === 'Bash' && typeof e.agentId === 'string') {
        const command = e.command;
        const rewritten = withAgentId(command, e.agentId);
        const phase = closePhase(command);
        if (phase !== null) phases.set(e.agentId, phase);
        if (rewritten !== null) sent = { ...e, command: rewritten };
      }
    } catch {
      sent = e;
    }
    const result = await next(sent);
    redraw($);
    return result;
  });

  // The band. AbovePrompt holds one tree, so the band goes in a column above
  // whatever the mods beneath drew, never in place of it. No band while a
  // survey holds the row, or outside a Cadence project (D-06).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const drawn = await next(e);
    try {
      if (e.props.hasSurvey) return drawn;
      const root = await planningRootAsync(await $.session.cwd(), (dir, name) => $.fs.exists(at(dir, name)));
      if (root === null) return drawn;
      let cursor = null;
      try {
        cursor = parseCursor(await $.fs.read(at(root, '.planning/STATE.md')));
      } catch {
        // unreadable is the same as absent: the /cad-progress line
      }
      try {
        const list = await $.agent.list();
        roster = rosterReconcile(roster, list);
      } catch {
        // no list: draw the roster the start and stop events built
      }
      const { Box, Text } = $.ui.resolve(e);
      const band = Text({ wrap: 'truncate-end', children: bandLine(cursor, roster, e.props.bodyColumns) });
      return Box({ flexDirection: 'column', children: [band, drawn] });
    } catch {
      return drawn;
    }
  });
}
