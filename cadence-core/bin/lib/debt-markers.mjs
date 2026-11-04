// @ts-check
// the debt marker grammar, as a pure function; conventions.md states the convention and this is its one implementation
// the token, an immediate colon, a one-line description, then ` | ceiling: ...` and ` | trigger: ...`
// the colon has to follow the token immediately, so prose that names the token in backticks is never ingested as a marker
// no I/O and no throw: the caller owns the tree walk and the envelope, so this is testable without a fixture directory
'use strict';

/** The marker token. Namespaced so it cannot collide with another tool's. */
export const DEBT_TOKEN = 'CADENCE-DEBT';

// built, not written as a literal, so this file doesn't contain the sequence it recognizes
const MARKER_HEAD = `${DEBT_TOKEN}:`;

// strip the comment closer from the last field only, or a marker inside `/* ... */` carries `*/` into the trigger text
const TRAILERS = [/\s*\*\/\s*$/, /\s*-->\s*$/, /\s*}}\s*$/];

/** @param {string} s @returns {string} */
export function stripTrailer(s) {
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
 * Every marker in one file's contents, in line order. A marker missing `ceiling`
 * or `trigger` comes back with that field `null` and `malformed` naming it,
 * never dropped: an incomplete marker would turn invisible, and the corner is
 * still cut with nothing saying so.
 * @param {string} text @returns {DebtMarker[]}
 */
export function debtMarkersIn(text) {
  if (typeof text !== 'string' || !text.includes(MARKER_HEAD)) return [];
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // every occurrence on the line, each bounded by the next head: a single indexOf let a second marker's ceiling and trigger overwrite the first's, and a wrong ceiling in the queue is worse than a gap
    for (const seg of markerSegments(lines[i])) {
      const parts = seg.split('|');
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
  }
  return out;
}

/**
 * One line's marker bodies, in order: everything after each marker head up to
 * the next head, or the end of the line for the last. The head isn't spelled
 * here because the harvest walks tracked source and would ingest it as a real
 * marker. census-registry passes its own head.
 * @param {string} line @param {string} [head] @returns {string[]}
 */
export function markerSegments(line, head = MARKER_HEAD) {
  /** @type {number[]} */
  const heads = [];
  for (let at = line.indexOf(head); at >= 0;
    at = line.indexOf(head, at + head.length)) heads.push(at);
  return heads.map((at, k) => line.slice(at + head.length,
    k + 1 < heads.length ? heads[k + 1] : line.length));
}

/** A field the marker never stated, rendered so the gap is visible in the queue. */
const UNSTATED = '(unstated)';

/**
 * The `## Debt markers` section body: one bullet per marker, sorted by path then
 * line, or `- None.`. Same markers in, byte-identical body out, so the harvest
 * is idempotent, which is also why there are no timestamps or counts.
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
