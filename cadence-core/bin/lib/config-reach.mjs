// @ts-check
// config-reach.mjs - the pure half of the config-key reach sweep (CFG-01):
// given the text of cadence-core/references/config-reach.md and the schema's
// key map, say where the two disagree. The disk half - locating the doc,
// reading it, turning issues into problems - lives in self-verify.mjs, exactly
// as lib/route-cells.mjs is split from its caller.
//
// What this proves and what it does not: it proves the reach table and
// config.schema.json agree with each other, NOT that either agrees with the
// code. A key whose real reader is narrower than both documents say is
// invisible here; that judgment is the human test stated in the reference doc.
// The value of the pair is that a NEW key cannot be added silently - the check
// fails until someone answers the reach question for it in writing.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. Every issue is
// `{code, detail}` and every detail NAMES the offending key, so the caller can
// wrap it in an envelope without knowing what any of the codes mean.
'use strict';

/** @param {any} v */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A table cell as the grammar reads it: backticks stripped, whitespace runs
 * collapsed to one space, trimmed. Both sides of every comparison below go
 * through this, so a purpose that wraps its phrase across a line break still
 * contains the reach phrase the table declares.
 * @param {any} s
 * @returns {string}
 */
export function normalize(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

/** The reach value that claims a key is honoured everywhere it can be set. */
export const UNIVERSAL = 'universal';

/** The heading the reach rows live under. */
export const ROWS_HEADING = '## Reach rows';

/**
 * @typedef {object} ReachRow
 * @property {string} key the Key cell, normalized
 * @property {string} reach the Reach cell, normalized
 * @property {string} honouredBy the Honoured by cell, normalized (never checked)
 * @property {number} line 1-based line number of the row in the source text
 */

/**
 * Parse the `## Reach rows` table.
 *
 * `rows` is `null` - never `[]` - when the heading itself is ABSENT, the same
 * distinction `parseActiveIds` keeps in lib/planning-files.mjs: a caller must
 * be able to tell "the section is missing" (one authoring fault, one message)
 * from "the section is there and declares nothing" (every schema key missing a
 * row). Collapsing the two would bury one fault under 72 copies of the other.
 *
 * The section is bounded at the next `## ` heading, like every other section
 * parser in this repo. Inside it, a body row is a line starting with `|`; the
 * header row (first cell exactly `Key`) and any delimiter row (every cell
 * `---`-shaped) declare nothing. First occurrence of a key wins.
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
  const seen = new Set();
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
    if (seen.has(cells[0])) continue; // first occurrence wins
    seen.add(cells[0]);
    rows.push({ key: cells[0], reach: cells[1], honouredBy: cells[2], line: i + 1 });
  }
  return { rows, issues };
}

/**
 * The three ways the reach table and the schema can disagree:
 *
 * - `missing-reach-row` - a schema key the table never names. This is the one
 *   that makes the sweep re-runnable: adding a key without answering the reach
 *   question fails CI.
 * - `unknown-reach-key` - a row naming a key the schema does not hold (a
 *   retired key, a typo).
 * - `unstated-reach` - a row whose reach is narrower than `universal` while the
 *   key's own `purpose` never says so. This is the defect shape the whole phase
 *   is about: the value is resolved, carried, and dropped with nothing said at
 *   the point of setting.
 * @param {any} schema the schema's `keys` object (key -> spec with `purpose`)
 * @param {any} rows the rows from parseReachTable
 * @returns {{code: string, detail: string}[]}
 */
export function reachIssues(schema, rows) {
  /** @type {{code: string, detail: string}[]} */
  const out = [];
  const keys = isObj(schema) ? Object.keys(schema) : [];
  const list = Array.isArray(rows) ? rows.filter((r) => isObj(r) && typeof r.key === 'string') : [];
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
    if (reach === UNIVERSAL) continue;
    const purpose = normalize(isObj(schema[row.key]) ? schema[row.key].purpose : '');
    if (!purpose.includes(reach)) {
      out.push({ code: 'unstated-reach',
        detail: `${row.key}: reach "${reach}" is absent from the key's purpose` });
    }
  }
  return out;
}
