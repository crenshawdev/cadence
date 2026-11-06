// @ts-check
// codemap-entry.mjs - what a reader returns for one module, and the judge `codemap write` holds it to (D-17)
// pure: no fs, no git, no env; the entry and the facts go in, a verdict and the entry as it will be stored come out
// ENTRY_SCHEMA is a plain object so workflows/code-map.js can spell the same thing out (a script can't import), and a test
// holds the two equal. Every string and list is bounded: 148 modules at Baley's size must fit the 8 MiB run file, so an
// entry's worst case stays under 52 KiB. These are character bounds, so escape-heavy text can pass them and still make the
// run too large, which the seam answers when it reads the file
// free text is never scanned; only a structured path or a (path, symbol) pair is checked against the facts
'use strict';

import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { isTestPath } from './codemap-edges.mjs';

const str = (/** @type {number} */ maxLength) => ({ type: 'string', minLength: 1, maxLength });
// a symbol is optional: evidence can be a path alone
const where = {
  type: 'object', additionalProperties: false, required: ['path'],
  properties: { path: str(300), symbol: str(120) },
};

export const ENTRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['purpose', 'invariants', 'change_together', 'pinned_by'],
  properties: {
    purpose: str(800),
    invariants: {
      type: 'array', maxItems: 10,
      items: {
        type: 'object', additionalProperties: false, required: ['claim', 'evidence'],
        properties: { claim: str(400), evidence: { type: 'array', minItems: 1, maxItems: 3, items: where } },
      },
    },
    change_together: {
      type: 'array', maxItems: 12,
      items: {
        type: 'object', additionalProperties: false, required: ['path', 'why'],
        properties: { path: str(300), why: str(300) },
      },
    },
    pinned_by: {
      type: 'array', maxItems: 10,
      items: {
        type: 'object', additionalProperties: false, required: ['behavior', 'tests'],
        properties: { behavior: str(300), tests: { type: 'array', maxItems: 4, items: where } },
      },
    },
  },
};

/**
 * The first way `value` breaks `schema`, or null. Only the keywords ENTRY_SCHEMA uses.
 * @param {any} schema @param {any} value @param {string} at
 * @returns {string|null}
 */
function problem(schema, value, at) {
  if (schema.type === 'string') {
    if (typeof value !== 'string') return `${at} is not text`;
    if (value.length < schema.minLength) return `${at} is empty`;
    return value.length > schema.maxLength ? `${at} is over ${schema.maxLength} characters` : null;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `${at} is not a list`;
    if (value.length > schema.maxItems) return `${at} holds more than ${schema.maxItems} items`;
    if (value.length < (schema.minItems || 0)) return `${at} holds fewer than ${schema.minItems} items`;
    for (let i = 0; i < value.length; i++) {
      const p = problem(schema.items, value[i], `${at}[${i}]`);
      if (p) return p;
    }
    return null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return `${at} is not an object`;
  for (const k of Object.keys(value)) if (!(k in schema.properties)) return `${at} carries an unknown key: ${k}`;
  for (const k of schema.required) if (!(k in value)) return `${at} lacks ${k}`;
  for (const k of Object.keys(value)) {
    const p = problem(schema.properties[k], value[k], `${at}.${k}`);
    if (p) return p;
  }
  return null;
}

/**
 * Whether an entry has the shape the schema states.
 * @param {unknown} entry @returns {string|null} what is wrong, or null
 */
export function shapeProblem(entry) {
  return problem(ENTRY_SCHEMA, entry, 'entry');
}

/**
 * A path as the map stores it: root-relative with forward slashes. A reader is handed absolute paths, so one under the
 * root is converted, and one outside it, a `..` climb or a NUL byte is refused.
 * @param {string} root @param {unknown} p
 * @returns {string|null}
 */
export function relPath(root, p) {
  if (typeof p !== 'string' || !p || p.includes('\0')) return null;
  const rel = isAbsolute(p) ? relative(root, resolve(p)).split(sep).join('/') : posix.normalize(p);
  if (!rel || rel === '.' || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) return null;
  return rel;
}

/**
 * @typedef {object} Facts
 * @property {string} root the absolute project root
 * @property {Set<string>} module the module's own paths
 * @property {Set<string>} tracked every tracked path
 * @property {Set<string>} nested every path in the nested tests clone, spelled root-relative
 * @property {Map<string, Set<string>>} symbols the names each tracked text file declares
 */

/**
 * Judge one entry against the facts. Every structured path must be tracked or in the nested tests clone, every
 * (path, symbol) pair must be held, invariant evidence stays inside the module with tests excepted, and a change-together
 * path may be anywhere. The clone's files carry no symbols, so a pair naming one is refused: it is cited by path alone.
 * @param {unknown} entry @param {Facts} facts
 * @returns {{ok: true, entry: any} | {ok: false, why: string}}
 */
export function judgeEntry(entry, facts) {
  const shape = shapeProblem(entry);
  if (shape) return { ok: false, why: shape };
  const e = /** @type {any} */ (entry);
  /** @type {string|null} */
  let bad = null;
  /** @param {{path: string, symbol?: string}} row @param {string} at @param {boolean} inside */
  const check = (row, at, inside) => {
    if (bad) return row;
    const rel = relPath(facts.root, row.path);
    if (rel === null) { bad = `${at} names ${JSON.stringify(row.path)}, which is not a path under the project root`; return row; }
    if (!facts.tracked.has(rel) && !facts.nested.has(rel)) { bad = `${at} names ${JSON.stringify(rel)}, which is not a tracked path`; return row; }
    if (inside && !facts.module.has(rel) && !isTestPath(rel)) { bad = `${at} names ${JSON.stringify(rel)}, which is outside this module and is not a test`; return row; }
    if (row.symbol !== undefined && !facts.symbols.get(rel)?.has(row.symbol)) {
      bad = `${at} names ${JSON.stringify(row.symbol)} in ${JSON.stringify(rel)}, which the facts do not hold there`;
    }
    return { ...row, path: rel };
  };
  const invariants = e.invariants.map((/** @type {any} */ inv, /** @type {number} */ i) => ({
    ...inv, evidence: inv.evidence.map((/** @type {any} */ ev, /** @type {number} */ j) => check(ev, `invariants[${i}].evidence[${j}]`, true)),
  }));
  const changeTogether = e.change_together.map((/** @type {any} */ c, /** @type {number} */ i) => check(c, `change_together[${i}]`, false));
  const pinnedBy = e.pinned_by.map((/** @type {any} */ p, /** @type {number} */ i) => ({
    ...p, tests: p.tests.map((/** @type {any} */ t, /** @type {number} */ j) => check(t, `pinned_by[${i}].tests[${j}]`, false)),
  }));
  if (bad) return { ok: false, why: bad };
  return { ok: true, entry: { purpose: e.purpose, invariants, change_together: changeTogether, pinned_by: pinnedBy } };
}
