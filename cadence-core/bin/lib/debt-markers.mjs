// @ts-check
// debt-markers.mjs - the `CADENCE-DEBT` marker grammar, as a pure function.
//
// The convention is stated in cadence-core/references/conventions.md and this
// file is its single implementation: the token followed IMMEDIATELY by a colon,
// then the one-line description, then ` | ceiling: <what it does not handle> `
// and ` | trigger: <what should prompt revisiting it> `.
//
// Pure by design, the same split lib/risk-surfaces.mjs carries against
// lib/phase-plans.mjs: no I/O, no throw, no stream of its own. The caller owns
// the tree walk, the file reads and the envelope; this owns the grammar and the
// rendering, so both are testable without a fixture directory.
//
// The token must be followed immediately by a colon, which is what keeps
// documentation ABOUT the convention from being ingested as a marker: prose
// naming the token in backticks (`REQUIREMENTS.md`, this phase's CONTEXT,
// conventions.md's own section) is not a marker and never becomes one.
'use strict';

/** The marker token. Namespaced so it cannot collide with another tool's. */
export const DEBT_TOKEN = 'CADENCE-DEBT';

// Built rather than written as a literal so this file does not itself contain
// the token-followed-by-a-colon sequence it recognizes.
const MARKER_HEAD = `${DEBT_TOKEN}:`;

// Trailing comment closers, stripped from the LAST field only: a marker in a
// `/* ... */` or `<!-- ... -->` comment would otherwise carry `*/` into the
// trigger text and put it in the queue that way.
const TRAILERS = [/\s*\*\/\s*$/, /\s*-->\s*$/, /\s*}}\s*$/];

/** @param {string} s */
function stripTrailer(s) {
  let out = s;
  for (const re of TRAILERS) out = out.replace(re, '');
  return out.trim();
}

/**
 * @typedef {object} DebtMarker
 * @property {number} line 1-based line number within the file
 * @property {string} text the one-line description of what was cut
 * @property {string|null} ceiling what the shortcut does not handle
 * @property {string|null} trigger what should prompt revisiting it
 * @property {string[]} [malformed] the REQUIRED field names that are missing
 */

/**
 * Every marker in one file's contents, in line order.
 *
 * A marker missing `ceiling` or `trigger` is returned with that field `null` and
 * `malformed` naming it - NEVER dropped. Dropping it would make an incomplete
 * marker invisible, which is strictly worse than a marker: the corner is still
 * cut and now nothing says so.
 * @param {string} text @returns {DebtMarker[]}
 */
export function debtMarkersIn(text) {
  if (typeof text !== 'string' || !text.includes(MARKER_HEAD)) return [];
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].indexOf(MARKER_HEAD);
    if (at < 0) continue;
    const parts = lines[i].slice(at + MARKER_HEAD.length).split('|');
    let ceiling = null;
    let trigger = null;
    for (let j = 1; j < parts.length; j++) {
      const field = parts[j].trim();
      const c = field.match(/^ceiling\s*:\s*([\s\S]*)$/i);
      if (c) { ceiling = stripTrailer(c[1]); continue; }
      const t = field.match(/^trigger\s*:\s*([\s\S]*)$/i);
      if (t) { trigger = stripTrailer(t[1]); }
    }
    const malformed = [];
    if (ceiling === null || ceiling === '') malformed.push('ceiling');
    if (trigger === null || trigger === '') malformed.push('trigger');
    out.push({
      line: i + 1,
      text: parts.length > 1 ? parts[0].trim() : stripTrailer(parts[0]),
      ceiling: ceiling === '' ? null : ceiling,
      trigger: trigger === '' ? null : trigger,
      ...(malformed.length ? { malformed } : {}),
    });
  }
  return out;
}

/** A field the marker never stated, rendered so the gap is visible in the queue. */
const UNSTATED = '(unstated)';

/**
 * The `## Debt markers` section BODY - one bullet per marker, sorted by path
 * then line, and `- None.` when there are none.
 *
 * Deterministic: same markers in, byte-identical body out, which is what makes
 * the harvest idempotent. No timestamps and no counts in the body for the same
 * reason.
 * @param {Array<DebtMarker & {path: string}>} entries
 * @returns {string}
 */
export function renderDebtSection(entries) {
  if (!Array.isArray(entries) || !entries.length) return '- None.\n';
  const sorted = entries.slice().sort((a, b) => (a.path === b.path
    ? a.line - b.line
    : (a.path < b.path ? -1 : 1)));
  return `${sorted.map((e) => `- \`${e.path}:${e.line}\` ${e.text}`
    + ` - ceiling: ${e.ceiling || UNSTATED}`
    + ` - trigger: ${e.trigger || UNSTATED}`).join('\n')}\n`;
}
