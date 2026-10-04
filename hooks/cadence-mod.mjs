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
// tool call (Plan 2 of phase 3). The token
// capture for figureless returns (Plan 3) lands here next.
//
// Every handler calls `next` exactly once and swallows its own errors (D-12).
//
// git-guard, read-trace and subagent-trace stay command hooks on every host, so
// this module makes no git decision and stands no hook down.

import { planningRootAsync } from '../cadence-core/bin/lib/git-segments.mjs';
import { parseCursor } from '../cadence-core/bin/lib/state-cursor.mjs';
import { bandLine, rosterReconcile, rosterStart, rosterStop } from '../cadence-core/bin/lib/band.mjs';

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

/** @param {any} on the host's hook registrar */
export function register(on) {
  // The Cadence agents running in this session (D-07). Every write is
  // `roster = transition(roster, ...)` with its await done first, so two
  // handlers interleaving never write back a stale roster.
  /** @type {readonly {id: string, role: string, rung: string}[]} */
  let roster = [];

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
    return answer;
  });

  // A `cursor set` or `renumber` is a Bash call, and they are the only STATE
  // writers, so redrawing after each tool call shows a cursor change as soon as
  // it lands. A write from outside the session shows at the next event. No timer.
  on('tool.call', async ($, e, next) => {
    const result = await next(e);
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
