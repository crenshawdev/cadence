// @ts-check
// token-capture.mjs - the rules the Cadence module (hooks/cadence-mod.mjs) uses
// to price a subagent dispatch whose return carried no token figure (phase 3,
// PNL-06, D-10).
//
// It lives apart from lib/trace.mjs so the module can load it: a hooks module
// may import only relative files and `claude-code`, and lib/trace.mjs imports
// `node:fs`. lib/trace.mjs imports the event name from here and re-exports it,
// so the name has one definition.
//
// Imports nothing and touches no Node global.
'use strict';

/**
 * The lifecycle event the Cadence module writes when a Cadence subagent stops:
 * the host's own usage for that subagent's LAST `turn.step`, keyed by `corr`
 * and `agent_id`. `renderTrace`'s post-pass folds it into the bracket that
 * names the same pair, and only into one whose return carried no figure. A
 * return's own `tokens` always wins, whichever line landed first.
 *
 * It is a lifecycle NAME and not a fifth family, for the reason `COORDINATOR`
 * states in lib/trace.mjs: `FAMILIES` is validated at the seam while
 * `renderTrace`'s `counts` is a fixed four-key literal, so a new family would
 * write fine and count nowhere.
 *
 * It must NEVER join `TERMINAL`, for the reason `WORKER_CACHE` states: a name
 * in that array re-enters the pairing and the `funded` accounting, and would
 * open and close a bracket for a worker that never returned.
 *
 * Its `tokens` is ONE step's window, `input + cache_read + cache_creation +
 * output`, the same denomination as a return's `tokens`, which is a
 * final-window figure. It never carries `turn.complete`'s usage, which is the
 * SUM of every step in the turn (`.planning/spikes/mod-runtime-facts/SPIKE.md`,
 * criterion 5): a sum of windows counts one cached prefix once per step and is
 * denominated in nothing a bracket holds.
 */
export const STEP_WINDOW = 'step_window';

// --- the advisory reviewer's own close gains its id (D-11) ------------------
//
// An advisory reviewer closes its own bracket from a persistence tail, and a
// subagent never sees its own id, so that close carries no `--agent-id` and the
// step-window fact had nothing to join. The host does see the id, on the
// subagent's `tool.call`, so the module appends it there.
//
// The rewrite answers for ONE simple `planning.mjs trace close` command and
// nothing else. In a compound line an appended flag could land on another
// command, so any `;`, `&`, `|`, newline, backtick, `$(`, `#` or trailing `\`
// answers nothing. A command git-guard acts on has a `git` segment and is never
// a bare `planning.mjs` call, so the rewrite cannot touch one.

/** A host agent id, as `tool.call` carries it. */
const AGENT_ID = /^[A-Za-z0-9_-]+$/;
/** Anything that makes a command line more than one simple command. */
const COMPOUND = /[;&|\r\n`#]|\$\(|\\\s*$/;
/** `node <…/planning.mjs> trace close`, the path quoted or bare. */
const TRACE_CLOSE = /^\s*node\s+(?:"[^"]*planning\.mjs"|'[^']*planning\.mjs'|\S*planning\.mjs)\s+trace\s+close(?=\s|$)/;
const HAS_AGENT_ID = /(?:^|\s)--agent-id(?=[=\s]|$)/;
const PHASE = /(?:^|\s)--phase(?:=|\s+)(["']?)(\d+(?:\.\d+)?)\1(?=\s|$)/;

/** @param {unknown} command */
function isTraceClose(command) {
  return typeof command === 'string' && !COMPOUND.test(command) && TRACE_CLOSE.test(command);
}

/**
 * The command with ` --agent-id <agentId>` appended, or null when the rewrite
 * does not apply: a bad id, a compound line, anything but `trace close`, or a
 * close that already names an id.
 * @param {unknown} command the Bash call's `command`
 * @param {unknown} agentId the call's `agentId`
 * @returns {string | null}
 */
export function withAgentId(command, agentId) {
  if (typeof agentId !== 'string' || !AGENT_ID.test(agentId)) return null;
  if (!isTraceClose(command) || HAS_AGENT_ID.test(/** @type {string} */ (command))) return null;
  return `${command} --agent-id ${agentId}`;
}

/**
 * The `--phase` of a simple `planning.mjs trace close` command, as written
 * (`3`, `2.1`), or null. The module keeps it per agent so the step-window fact
 * files under the phase the close named.
 * @param {unknown} command
 * @returns {string | null}
 */
export function closePhase(command) {
  if (!isTraceClose(command)) return null;
  const m = /** @type {string} */ (command).match(PHASE);
  return m ? m[2] : null;
}
