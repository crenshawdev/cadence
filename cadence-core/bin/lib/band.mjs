// @ts-check
// band.mjs - the one line the Cadence module (hooks/cadence-mod.mjs) draws
// above the prompt: phase, status, the running Cadence agents, next command.
//
// No imports beyond lib/, no Node globals: a hooks module may load nothing
// else. The module does the I/O and hands this the parsed cursor.
//
// Once the session has a cache break (lib/cache-meter.mjs), the count follows
// the status, so it is seen before the running list or next is.
//
// The line never wraps and never runs past the width it is given. Too long,
// the running list shrinks to its first agent plus a count, then the end of
// the line is cut with an ellipsis.
//
// The running list is a roster: a plain array of `{id, role, rung}`, oldest
// first, moved only by the three pure transitions below (D-07). The module
// holds the current value and swaps in what each transition returns. A start
// or stop event can be missed (a subagent spawned before the module loaded, a
// stop the host never delivered), so the module reconciles against
// `$.agent.list()` before each draw. Role and rung come from RUNG_FILES through
// `roleOfAgent` and `rungOfAgent`, never from a `-<rung>` suffix.
'use strict';

import { breaksText } from './cache-meter.mjs';
import { roleOfAgent, rungOfAgent } from './rung-agent.mjs';

/** The line when STATE.md is missing or does not parse (phase 3, D-06). */
export const NO_CURSOR_LINE = 'Cadence · no readable cursor · run /cad-progress';

/**
 * The status the band and the pane draw: `executing` while a Cadence executor
 * runs on a `planned` phase, the status as given otherwise. Display only: no
 * cursor or derived status is ever `executing`, since a value outside
 * planning.mjs's AGREE map reads as drift. An executor `/cad-task --plan`
 * dispatches shows the same way, because the roster cannot tell them apart.
 * @param {string} status
 * @param {readonly {role: string}[]} running
 * @returns {string}
 */
export function shownStatus(status, running) {
  return status === 'planned' && running.some((a) => a.role === 'cad-executor') ? 'executing' : status;
}

/**
 * @param {{phase: number, total: number, status: string, next: string} | null} cursor
 * @param {readonly {role: string, rung: string}[]} running
 * @param {number} width cells the line may take
 * @param {number} [breaks] the session's cache breaks
 * @returns {string}
 */
export function bandLine(cursor, running, width, breaks = 0) {
  const flag = breaks > 0 ? ` · ${breaksText(breaks)}` : '';
  if (!cursor) return fit(NO_CURSOR_LINE + flag, width);
  const head = `Cadence · Phase ${cursor.phase} of ${cursor.total} · ${visible(shownStatus(cursor.status, running))}${flag}`;
  const tail = ` · next ${visible(cursor.next)}`;
  const names = running.map((a) => `${a.role} (${a.rung})`);
  let line = head + (names.length ? ` · running ${names.join(', ')}` : '') + tail;
  if (names.length > 1 && cells(line) > width) {
    line = `${head} · running ${names[0]} +${names.length - 1}${tail}`;
  }
  return fit(line, width);
}

/**
 * STATE.md text with every control character shown as `?`. The host refuses a
 * whole AbovePrompt tree when any text child holds one (C0, DEL, C1, and so
 * tab, CR and LF too), which would wipe out every other mod's drawing beside
 * the band. `cursor get` still answers the text as written.
 * @param {string} s
 */
function visible(s) {
  return String(s).replace(/[\x00-\x1f\x7f-\x9f]/g, '?');
}

/** @param {string} s */
function cells(s) {
  return Array.from(s).length;
}

/**
 * Cut at the width, ending in `…`. Counted by code point, so a cut never
 * splits a surrogate pair.
 * @param {string} line
 * @param {number} width
 */
function fit(line, width) {
  const chars = Array.from(line);
  if (chars.length <= width) return line;
  if (!(width >= 1)) return '';
  return chars.slice(0, width - 1).join('') + '…';
}

/**
 * @typedef {{id: string, role: string, rung: string}} RosterEntry
 * @typedef {readonly RosterEntry[]} Roster
 */

/**
 * The entry a Cadence agent type gets, or null for any type RUNG_FILES does not
 * file (the host's own `general-purpose`, `Explore`, a fork).
 * @param {unknown} id
 * @param {unknown} type
 * @returns {RosterEntry | null}
 */
function entry(id, type) {
  const role = roleOfAgent(type);
  const rung = rungOfAgent(type);
  if (typeof id !== 'string' || id === '' || role === null || rung === null) return null;
  return { id, role, rung };
}

/**
 * A `classic.SubagentStart` input joins the roster when it is a Cadence agent
 * of THIS session. Anything else answers the roster unchanged.
 * @param {Roster} roster
 * @param {{session_id?: unknown, agent_id?: unknown, agent_type?: unknown}} start
 * @param {string} sessionId this session's id, `$.session.id()`
 * @returns {Roster}
 */
export function rosterStart(roster, start, sessionId) {
  if (!start || start.session_id !== sessionId) return roster;
  const added = entry(start.agent_id, start.agent_type);
  if (added === null || roster.some((a) => a.id === added.id)) return roster;
  return [...roster, added];
}

/**
 * A `classic.SubagentStop` drops the agent with that id, if the roster holds it.
 * @param {Roster} roster
 * @param {unknown} agentId
 * @returns {Roster}
 */
export function rosterStop(roster, agentId) {
  return roster.some((a) => a.id === agentId) ? roster.filter((a) => a.id !== agentId) : roster;
}

/**
 * The roster `$.agent.list()` says is true: exactly the Cadence agents it shows
 * `running`. Ones the roster already held keep their place; ones it missed join
 * at the end, in the list's order. The list holds this session's agents only,
 * so no session check is needed here.
 * @param {Roster} roster
 * @param {unknown} list `$.agent.list()`'s answer: `{id, type, status}` entries
 * @returns {Roster}
 */
export function rosterReconcile(roster, list) {
  if (!Array.isArray(list)) return roster;
  /** @type {Map<string, RosterEntry>} */
  const running = new Map();
  for (const a of list) {
    if (!a || a.status !== 'running') continue;
    const found = entry(a.id, a.type);
    if (found !== null) running.set(found.id, found);
  }
  const kept = roster.filter((a) => running.has(a.id));
  const held = new Set(kept.map((a) => a.id));
  return [...kept, ...[...running.values()].filter((a) => !held.has(a.id))];
}
