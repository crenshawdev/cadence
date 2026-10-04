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
