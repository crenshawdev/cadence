// @ts-check
// state-cursor.mjs - the grammar of STATE.md's cursor, read side: four required
// lines plus an optional `Plan:` line.
//
// It was split out of lib/planning-files.mjs so the Cadence module, which
// 3.9.0 removed, could load it without `node:fs` (phase 3, D-05). It stays
// apart because nothing gains from moving it back.
//
// planning-files re-exports `parseCursor`, so the seam and its tests still
// import it from there. The writer (`renderCursor`) and the status vocabulary
// (`CURSOR_STATUSES`) stay there with the code that writes the file.
//
// Imports nothing and touches no Node global.
'use strict';

/**
 * Parse the canonical cursor: the four required lines plus an optional
 * `Plan: K of J (<plan name>)` line. Returns null when any required line is
 * missing or malformed - callers degrade, never guess.
 *
 * The optional line adds one `plan` field `{k, j, name?}` (`name` absent for the
 * nameless `Plan: K of J`). A cursor without it returns exactly the six fields
 * 3.9.3 returned, no `plan` key at all. A `Plan:` line outside that grammar is
 * ignored rather than refused: nothing gates on it, and /cad-health checks its
 * shape. The match is anchored and linear, since `cursor get` parses on every read.
 * @param {string} text
 * @returns {{phase:number,total:number,name:string,status:string,next:string,
 *   updated:string,plan?:{k:number,j:number,name?:string}}|null}
 */
export function parseCursor(text) {
  const m = (re) => { const r = text.match(re); return r ? r : null; };
  const phase = m(/^Phase:\s*(\d+(?:\.\d+)?)\s+of\s+(\d+)\s+\((.+)\)\s*$/m);
  const status = rest(text, /^Status:([^\r\n]*)/m);
  const next = rest(text, /^Next:([^\r\n]*)/m);
  const updated = m(/^Updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!phase || !status || !next || !updated) return null;
  const cursor = {
    phase: Number(phase[1]), total: Number(phase[2]), name: phase[3],
    status, next, updated: updated[1],
  };
  const plan = m(/^Plan:[ \t]*(\d+)[ \t]+of[ \t]+(\d+)(?:[ \t]+\((.+)\))?[ \t]*$/m);
  if (!plan) return cursor;
  const name = plan[3] === undefined ? '' : plan[3].trim();
  return { ...cursor, plan: { k: Number(plan[1]), j: Number(plan[2]), ...(name ? { name } : {}) } };
}

/**
 * The rest of a `Key:` line, trimmed, or null when the line is missing or
 * holds nothing. Greedy to the end of the line and then `trim()`, never a lazy
 * capture before `\s*$`: that one backtracks in quadratic time on a long run of
 * inner spaces, and `planning.mjs cursor get` parses STATE.md on every read.
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
