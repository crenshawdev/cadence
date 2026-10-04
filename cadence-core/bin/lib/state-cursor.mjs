// @ts-check
// state-cursor.mjs - the grammar of STATE.md's four-line cursor, read side.
//
// It lives apart from lib/planning-files.mjs so the Cadence module
// (hooks/cadence-mod.mjs) can load it: a hooks module may import only relative
// files and `claude-code`, and planning-files imports `node:fs`. The band reads
// STATE.md through `$.fs.read` and parses it here, with the same parser
// `planning.mjs cursor get` uses (phase 3, D-05).
//
// planning-files re-exports `parseCursor`, so the seam and its tests still
// import it from there. The writer (`renderCursor`) and the status vocabulary
// (`CURSOR_STATUSES`) stay there with the code that writes the file.
//
// Imports nothing and touches no Node global.
'use strict';

/**
 * Parse the canonical 4-line cursor. Returns null when any line is missing
 * or malformed - callers degrade, never guess.
 * @param {string} text
 */
export function parseCursor(text) {
  const m = (re) => { const r = text.match(re); return r ? r : null; };
  const phase = m(/^Phase:\s*(\d+(?:\.\d+)?)\s+of\s+(\d+)\s+\((.+)\)\s*$/m);
  const status = m(/^Status:\s*(.+?)\s*$/m);
  const next = m(/^Next:\s*(.+?)\s*$/m);
  const updated = m(/^Updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!phase || !status || !next || !updated) return null;
  return {
    phase: Number(phase[1]), total: Number(phase[2]), name: phase[3],
    status: status[1], next: next[1], updated: updated[1],
  };
}
