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
  const status = rest(text, /^Status:([^\r\n]*)/m);
  const next = rest(text, /^Next:([^\r\n]*)/m);
  const updated = m(/^Updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!phase || !status || !next || !updated) return null;
  return {
    phase: Number(phase[1]), total: Number(phase[2]), name: phase[3],
    status, next, updated: updated[1],
  };
}

/**
 * The rest of a `Key:` line, trimmed, or null when the line is missing or
 * holds nothing. Greedy to the end of the line and then `trim()`, never a lazy
 * capture before `\s*$`: that one backtracks in quadratic time on a long run of
 * inner spaces, and the band parses STATE.md inside the host's hooks worker on
 * every draw.
 *
 * The capture stops at `\r` or `\n` only, never at `.`'s edge: `.` and a
 * multiline `$` also stop at U+2028 and U+2029, which `cursor set` accepts in a
 * value, so a value led by one would trim to nothing. `trim()` drops them from
 * either end, as the `\s*` of the parser before this one did.
 * @param {string} text
 * @param {RegExp} re one capture: everything after the colon
 */
function rest(text, re) {
  const r = text.match(re);
  const value = r ? r[1].trim() : '';
  return value === '' ? null : value;
}
