// @ts-check
// codemap-edges.mjs - what touches what: the callers of a symbol, found in one pass over the tracked text (D-10)
// no process is spawned here and nothing imports but node: builtins and the facts read; the text comes from whoever made the clone
// a hit is a whole word and nothing more, so a comment or another thing with the same name counts: every list is `approximate`
'use strict';

import { extname } from 'node:path';
import { rawPath, readText } from './codemap-facts.mjs';

// D-20 measured the row at 10 callers per symbol
export const CALLER_CAP = 10;
// a name defined in this many files is `main` or `run`: its callers say nothing, and the work per file would grow with the definers
const MAX_DEFINERS = 100;
// the longest symbol name the facts keep
const WORD_CAP = 200;

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.rs', '.py', '.go']);
// a heading or a JSON key is a label and not something code calls
const NOT_CALLED = new Set(['heading', 'key']);
const WORD = /[\w$]+/g;

/** @param {string} path */
const isPlanning = (path) => path.startsWith('.planning/') || path.startsWith('".planning/');
/** @param {string} path 0 for code, 1 for other text, 2 for a planning record */
const tierOf = (path) => (isPlanning(path) ? 2 : CODE_EXT.has(extname(path.replace(/"$/, '')).toLowerCase()) ? 0 : 1);

/** @param {string} text @returns {Set<string>} the distinct words, each short enough to be a symbol */
function wordsOf(text) {
  const out = new Set();
  for (const w of text.match(WORD) || []) if (w.length <= WORD_CAP) out.add(w);
  return out;
}

/**
 * Adds `callers` to every symbol that another text file holds as a whole word. One read of each file's words looked up
 * against the symbols, never a process per symbol: a search each extrapolated to 10 s on Cadence and 83 s on Baley.
 * A symbol's list is its first CALLER_CAP files, code before other text before `.planning`, each in path order,
 * because a row could otherwise fill its ten with planning records; `total` counts every one, `.planning` included.
 * @param {string} root @param {{path: string, quoted?: true, kind: string, symbols?: any[]}[]} rows in path order
 */
export function addEdges(root, rows) {
  /** @type {Map<string, {row: any, sym: any, tiers: string[][], total: number}[]>} */
  const byName = new Map();
  /** @type {Map<string, number>} */
  const definers = new Map();
  for (const row of rows) {
    for (const sym of row.symbols || []) {
      if (NOT_CALLED.has(sym.kind) || !/^[\w$]+$/.test(sym.name)) continue;
      definers.set(sym.name, (definers.get(sym.name) || 0) + 1);
      if (!byName.has(sym.name)) byName.set(sym.name, []);
      /** @type {any} */ (byName.get(sym.name)).push({ row, sym, tiers: [[], [], []], total: 0 });
    }
  }
  for (const [name, n] of definers) if (n > MAX_DEFINERS) byName.delete(name);
  if (!byName.size) return;
  for (const row of rows) {
    if (row.kind !== 'text') continue;
    const text = readText(root, rawPath(row));
    if (text === null) continue;
    const tier = tierOf(row.path);
    for (const w of wordsOf(text)) {
      for (const t of byName.get(w) || []) {
        if (t.row === row) continue;
        t.total++;
        if (t.tiers[tier].length < CALLER_CAP) t.tiers[tier].push(row.path);
      }
    }
  }
  for (const list of byName.values()) {
    for (const t of list) {
      if (!t.total) continue;
      t.sym.callers = { files: t.tiers.flat().slice(0, CALLER_CAP), total: t.total, approximate: true };
    }
  }
}
