// @ts-check
// the grammar of STATE.md's cursor, read side: four required lines plus an optional `Plan:` line
// split from planning-files so the 3.9.0-removed module could load it without `node:fs`; moving it back gains nothing
// callers take `parseCursor` from here; the writer stays in planning-files
// imports nothing and touches no Node global
'use strict';

/**
 * Parse the canonical cursor: the four required lines plus an optional
 * `Plan: K of J (<plan name>)` line. Returns null when any required line is
 * missing or malformed, so callers degrade and never guess.
 *
 * The optional line adds a `plan` field `{k, j, name?}`, with `name` absent for
 * the nameless `Plan: K of J`; without it the six original fields come back and
 * no `plan` key. A `Plan:` line outside that grammar is ignored, since nothing
 * gates on it and /cad-health checks its shape. The match is anchored and
 * linear because `cursor get` parses on every read.
 * @param {string} text
 * @returns {{phase:number,total:number,name:string,status:string,next:string,
 *   updated:string,plan?:{k:number,j:number,name?:string}}|null}
 */
export function parseCursor(text) {
  const phase = text.match(/^Phase:\s*(\d+(?:\.\d+)?)\s+of\s+(\d+)\s+\((.+)\)\s*$/m);
  const status = rest(text, /^Status:([^\r\n]*)/m);
  const next = rest(text, /^Next:([^\r\n]*)/m);
  const updated = text.match(/^Updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!phase || !status || !next || !updated) return null;
  const cursor = {
    phase: Number(phase[1]), total: Number(phase[2]), name: phase[3],
    status, next, updated: updated[1],
  };
  const plan = text.match(/^Plan:[ \t]*(\d+)[ \t]+of[ \t]+(\d+)(?:[ \t]+\((.+)\))?[ \t]*$/m);
  if (!plan) return cursor;
  const name = plan[3] === undefined ? '' : plan[3].trim();
  return { ...cursor, plan: { k: Number(plan[1]), j: Number(plan[2]), ...(name ? { name } : {}) } };
}

/**
 * The rest of a `Key:` line, trimmed, or null when the line is missing or holds
 * nothing. Greedy to the end of the line and then `trim()`, never a lazy capture
 * before `\s*$`, which backtracks in quadratic time on a long run of inner
 * spaces.
 *
 * The capture stops at `\r` or `\n` only: `.` and a multiline `$` also stop at
 * U+2028 and U+2029, which `cursor set` accepts in a value, so a value led by
 * one would trim to nothing. `trim()` drops them from either end.
 * @param {string} text
 * @param {RegExp} re one capture: everything after the colon
 */
function rest(text, re) {
  const r = text.match(re);
  const value = r ? r[1].trim() : '';
  return value === '' ? null : value;
}
