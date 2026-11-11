// @ts-check
// config-reach.mjs - the pure half of the reach sweep: where cadence-core/references/config-reach.md and the schema's
// key map disagree. The disk half lives in self-verify.mjs.
// It proves the table and the schema agree, not that either matches the code. What it buys is that a new key can't
// land silently, because the check fails until someone answers the reach question for it in writing.
// Pure: no fs, no emit, no process, no Date, no randomness. Every issue is `{code, detail}` and names the key.
'use strict';

import { isPlainObject } from './text-util.mjs';

/**
 * A table cell as the grammar reads it: backticks stripped, whitespace runs collapsed, trimmed. Both sides of
 * every comparison go through this, so a purpose that wraps its phrase across a line still contains the reach phrase.
 * @param {any} s
 * @returns {string}
 */
export function normalize(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

/** The reach value that claims a key is honoured everywhere it can be set. */
export const UNIVERSAL = 'universal';

/**
 * Is this Reach cell the universal sentinel? Case-insensitive and tolerant of one trailing period, since
 * `Universal` and `universal.` are the same declaration. Read strictly they fell through to the purpose test and
 * reported `unstated-reach`, which sent the author to fix the key's `purpose` instead of the cell.
 * The narrow phrase stays verbatim: the doc's rule is a literal comparison, and folding one side would break the
 * vocabulary the row and the purpose share.
 * @param {any} reach a Reach cell, already normalized or not
 */
function isUniversal(reach) {
  return normalize(reach).toLowerCase().replace(/\.$/, '') === UNIVERSAL;
}

/** The heading the reach rows live under. */
const ROWS_HEADING = '## Reach rows';

/**
 * @typedef {object} ReachRow
 * @property {string} key the Key cell, normalized
 * @property {string} reach the Reach cell, normalized
 * @property {string} honouredBy the Honoured by cell, normalized (never checked)
 * @property {number} line 1-based line number of the row in the source text
 */

/**
 * Parse the `## Reach rows` table.
 * `rows` is null, never [], when the heading is absent (parseActiveIds in lib/planning-files.mjs does the same).
 * A caller has to tell "section missing" from "section declares nothing", or one fault gets buried under a
 * missing-row issue for every schema key.
 * The section ends at the next `## ` heading. A body row starts with `|`; the header row (first cell `Key`) and
 * delimiter rows declare nothing. The first occurrence of a key wins and each later one is reported as
 * `duplicate-reach-row`, naming both lines.
 * @param {any} text
 * @returns {{rows: ReachRow[]|null, issues: {code: string, detail: string}[]}}
 */
export function parseReachTable(text) {
  /** @type {{code: string, detail: string}[]} */
  const issues = [];
  if (typeof text !== 'string') {
    return { rows: null, issues: [{ code: 'missing-reach-section', detail: `no ${ROWS_HEADING} heading` }] };
  }
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === ROWS_HEADING) { start = i + 1; break; }
  }
  if (start < 0) {
    return { rows: null, issues: [{ code: 'missing-reach-section', detail: `no ${ROWS_HEADING} heading` }] };
  }

  /** @type {ReachRow[]} */
  const rows = [];
  /** @type {Map<string, number>} key -> the 1-based line that declared it */
  const seen = new Map();
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(normalize);
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue; // delimiter
    if (cells[0] === 'Key') continue;                        // header
    if (cells.length < 3 || !cells[0] || !cells[1]) {
      issues.push({ code: 'malformed-reach-row', detail: `line ${i + 1}: ${line.trim()}` });
      continue;
    }
    // the first row still wins, but the loser is reported: narrowing a key by appending a row used to leave the
    // stale row winning with self-verify ok:true
    const first = seen.get(cells[0]);
    if (first !== undefined) {
      issues.push({ code: 'duplicate-reach-row',
        detail: `${cells[0]}: line ${i + 1} repeats the row declared on line ${first}; `
          + 'the first occurrence wins, so this row declares nothing' });
      continue;
    }
    seen.set(cells[0], i + 1);
    rows.push({ key: cells[0], reach: cells[1], honouredBy: cells[2], line: i + 1 });
  }
  return { rows, issues };
}

/**
 * The three ways the reach table and the schema can disagree:
 * - `missing-reach-row` - a schema key the table never names, so adding a key without answering the reach
 *   question fails CI.
 * - `unknown-reach-key` - a row naming a key the schema doesn't hold (a retired key, a typo).
 * - `unstated-reach` - a row narrower than `universal` while the key's own `purpose` never says so: the value is
 *   resolved, carried and dropped with nothing said where it's set.
 * @param {any} schema the schema's `keys` object (key -> spec with `purpose`)
 * @param {any} rows the rows from parseReachTable
 * @returns {{code: string, detail: string}[]}
 */
export function reachIssues(schema, rows) {
  /** @type {{code: string, detail: string}[]} */
  const out = [];
  const keys = isPlainObject(schema) ? Object.keys(schema) : [];
  const list = Array.isArray(rows) ? rows.filter((r) => isPlainObject(r) && typeof r.key === 'string') : [];
  const byKey = new Map(list.map((r) => [r.key, r]));

  for (const key of keys) {
    if (!byKey.has(key)) {
      out.push({ code: 'missing-reach-row', detail: `${key}: no row in the reach table` });
    }
  }
  for (const row of list) {
    if (!keys.includes(row.key)) {
      out.push({ code: 'unknown-reach-key', detail: `${row.key}: reach row names no schema key` });
      continue;
    }
    const reach = normalize(row.reach);
    if (isUniversal(reach)) continue;
    const purpose = normalize(isPlainObject(schema[row.key]) ? schema[row.key].purpose : '');
    if (!purpose.includes(reach)) {
      out.push({ code: 'unstated-reach',
        detail: `${row.key}: reach "${reach}" is absent from the key's purpose` });
    }
  }
  return out;
}
