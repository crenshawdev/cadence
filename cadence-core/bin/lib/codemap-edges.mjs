// @ts-check
// codemap-edges.mjs - what touches what: the callers of a symbol, the imports of a file and the tests that pin them, from one pass over the text (D-10)
// no process is spawned here and nothing imports but node: builtins and the facts read; the text comes from whoever made the clone
// a hit is a whole word and nothing more, so a comment or another thing with the same name counts: every list is `approximate`
'use strict';

import { extname, posix } from 'node:path';
import { rawPath, readText } from './codemap-facts.mjs';

// D-20 measured the row at 10 callers per symbol, and a pinned_by list keeps the same ten
export const CALLER_CAP = 10;
// a name or a stem held by more files than this is `main` or `index`: it gets one shared tally for all its holders, because a tally
// each would make the work per file grow with the holders. Holders count by distinct file, never by symbol row
const MAX_DEFINERS = 100;
// the longest symbol name the facts keep
const WORD_CAP = 200;

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.rs', '.py', '.go']);
// a heading or a JSON key is a label and not something code calls
const NOT_CALLED = new Set(['heading', 'key']);
// letters, numbers and marks of any script, so `fooébar` is one word and `données` can be a stem
const WORD = /[\p{L}\p{N}\p{M}_$]+/gu;
const WORD_NAME = /^[\p{L}\p{N}\p{M}_$]+$/u;
// a file stem keeps its hyphens: `workflow-run` is the measured case
const STEM_WORD = /[\p{L}\p{N}\p{M}_-]+/gu;
const TEST_DIRS = new Set(['tests', 'test', '__tests__', 'spec']);

const JS_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts']);
// a line past this column is not read for an import, and one file keeps this many
const LINE_CAP = 2000;
const MAX_IMPORTS = 200;
// what a relative specifier may have left off, and the TypeScript spelling that stands behind a `.js` one
const TRY_EXT = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.json'];
const TS_FOR = { '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };

/** @param {string} path */
const isPlanning = (path) => path.startsWith('.planning/') || path.startsWith('".planning/');
/** @param {string} path 0 for code, 1 for other text, 2 for a planning record */
const tierOf = (path) => (isPlanning(path) ? 2 : CODE_EXT.has(extname(path.replace(/"$/, '')).toLowerCase()) ? 0 : 1);

// every pattern below runs on one line of at most LINE_CAP columns and has no quantifier inside another or two adjacent
// ones over the same characters, so a long run of whitespace costs a line's length and no more
const JS_FROM = /^\s*(?:import|export)\b[^'"]*?\bfrom\s*(['"])([^'"]*)\1/;
const JS_CLOSE = /^\s*\}\s*from\s*(['"])([^'"]*)\1/;
const JS_SIDE = /^\s*import\s*(['"])([^'"]*)\1/;
const JS_CALL = /\b(?:require|import)\s*\(\s*(['"])([^'"]*)\1/g;
const RUST_USE = /^\s*(?:pub(?:\([^)]*\))?\s+)?use\s+([\w:]+)/;
const PY_FROM = /^\s*from\s+([\w.]+)\s+import\b/;
const PY_IMPORT = /^\s*import\s+/;
const GO_ONE = /^\s*import\s+(?:[\w.]+\s+)?"([^"]*)"/;
const GO_OPEN = /^\s*import\s*\(/;
const GO_SPEC = /^\s*(?:[\w.]+\s+)?"([^"]*)"/;

/**
 * The specifiers a file names, as written, in line order.
 * @param {string} ext @param {string} text @returns {string[]}
 */
function specifiers(ext, text) {
  /** @type {string[]} */
  const out = [];
  let block = false;
  for (const whole of text.split('\n')) {
    if (out.length >= MAX_IMPORTS) break;
    const line = whole.length > LINE_CAP ? whole.slice(0, LINE_CAP) : whole;
    if (JS_EXT.has(ext)) {
      const m = JS_FROM.exec(line) || JS_CLOSE.exec(line) || JS_SIDE.exec(line);
      if (m) out.push(m[2]);
      else for (const c of line.matchAll(JS_CALL)) out.push(c[2]);
    } else if (ext === '.rs') {
      const m = RUST_USE.exec(line);
      if (m) { let end = m[1].length; while (end > 0 && m[1][end - 1] === ':') end--; out.push(m[1].slice(0, end)); }
    } else if (ext === '.py') {
      const m = PY_FROM.exec(line);
      if (m) { out.push(m[1]); continue; }
      const i = PY_IMPORT.exec(line);
      if (i) for (const part of line.slice(i[0].length).split('#')[0].split(',')) { const mod = part.trim().split(/\s/)[0]; if (/^[\w.]+$/.test(mod)) out.push(mod); }
    } else if (ext === '.go') {
      if (block) {
        if (line.trimStart().startsWith(')')) { block = false; continue; }
        const m = GO_SPEC.exec(line);
        if (m) out.push(m[1]);
      } else if (GO_OPEN.test(line)) block = true;
      else { const m = GO_ONE.exec(line); if (m) out.push(m[1]); }
    }
  }
  return out;
}

/**
 * A relative JS or TS specifier's tracked path, or null: as written, then with an extension, then as a directory's index.
 * `.`, `..` and a specifier ending in `/` name a directory and only try its index.
 * @param {string} from the importing file, as its row spells it @param {string} spec @param {Set<string>} tracked
 * @returns {string|null} the tracked spelling
 */
function resolveRelative(from, spec, tracked) {
  if (spec !== '.' && spec !== '..' && !spec.startsWith('./') && !spec.startsWith('../')) return null;
  const dirForm = spec === '.' || spec === '..' || spec.endsWith('/');
  // a quoted row is its escaped text between quotes, and the directory comes from the text, not from the quote on its front
  const plain = from.startsWith('"') ? from.slice(1, -1) : from;
  let base = posix.normalize(posix.join(posix.dirname(plain), spec));
  if (base === '..' || base.startsWith('../')) return null;
  if (base.endsWith('/')) base = base.slice(0, -1);
  const dir = base === '.' ? '' : `${base}/`;
  const index = TRY_EXT.map((e) => `${dir}index${e}`);
  const ext = extname(base);
  const tries = dirForm || base === '.' ? index : [base, ...TRY_EXT.map((e) => base + e),
    ...(TS_FOR[ext] || []).map((e) => base.slice(0, -ext.length) + e), ...index];
  for (const t of tries) {
    if (tracked.has(t)) return t;
    // a tracked path that is quoted holds the same escaped text inside quotes
    if (tracked.has(`"${t}"`)) return `"${t}"`;
  }
  return null;
}

/**
 * A file's imports, each one `{path}` where a relative JS or TS specifier lands on a tracked file and `{text}` as written otherwise.
 * @param {string} path @param {string} text @param {Set<string>} tracked
 * @returns {({path: string}|{text: string})[]}
 */
function importsOf(path, text, tracked) {
  const ext = extname(path.replace(/"$/, '')).toLowerCase();
  const seen = new Set();
  /** @type {({path: string}|{text: string})[]} */
  const out = [];
  for (const spec of specifiers(ext, text)) {
    const hit = JS_EXT.has(ext) ? resolveRelative(path, spec, tracked) : null;
    const key = hit ?? `\0${spec}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit ? { path: hit } : { text: spec });
  }
  return out;
}

/** @param {string} text @returns {Set<string>} the distinct words, each short enough to be a symbol */
function wordsOf(text) {
  const out = new Set();
  for (const w of text.match(WORD) || []) if (w.length <= WORD_CAP) out.add(w);
  return out;
}

/**
 * Whether a path is a test file (D-11), the one list `cadence-core/bin` has: a directory named `tests`, `test`,
 * `__tests__` or `spec` anywhere above it, or a name of the form `*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py` or `*_test.py`.
 * @param {string} path a row's spelling, quoted or not
 */
export function isTestPath(path) {
  const plain = path.startsWith('"') ? path.slice(1, -1) : path;
  const parts = plain.split('/');
  const name = /** @type {string} */ (parts.pop());
  if (parts.some((d) => TEST_DIRS.has(d))) return true;
  return name.includes('.test.') || name.includes('.spec.') || name.endsWith('_test.go')
    || (name.startsWith('test_') && name.endsWith('.py')) || name.endsWith('_test.py');
}

/** @param {string} path the part of the name before its first dot, or '' for a dotfile */
function stemOf(path) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.indexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

/** @param {string} text @returns {Set<string>} the distinct hyphen-joined words, edge hyphens trimmed */
function stemWordsOf(text) {
  const out = new Set();
  for (const w of text.match(STEM_WORD) || []) {
    let a = 0;
    let b = w.length;
    while (a < b && w[a] === '-') a++;
    while (b > a && w[b - 1] === '-') b--;
    if (b > a && b - a <= WORD_CAP) out.add(w.slice(a, b));
  }
  return out;
}

const tally = () => ({ files: /** @type {string[]} */ ([]), total: 0 });
/** @typedef {ReturnType<typeof tally>} Tally */
/** @param {Tally} t @param {string} path */
function add(t, path) {
  t.total++;
  if (t.files.length < CALLER_CAP) t.files.push(path);
}
/** @param {Tally} t */
const listOf = (t) => ({ files: t.files, total: t.total, approximate: true });

/**
 * A shared tally's list for one holder: the holder's own file is no caller or pin of itself, so it comes out of the copy
 * and off the count. The tally counted it only if `counted`, which the pass sets when it took that file for that list: a file
 * it couldn't read, a word over WORD_CAP and a name the text doesn't hold leave it false, and a total never goes below zero.
 * @param {string[]} files @param {number} total @param {string} own @param {boolean} counted
 */
function withoutOwn(files, total, own, counted) {
  return { files: files.filter((p) => p !== own), total: Math.max(0, counted ? total - 1 : total), approximate: true };
}

/**
 * Adds to the rows, from one read of each text file's words looked up against the symbols and never a process per
 * symbol (a search each extrapolated to 10 s on Cadence and 83 s on Baley):
 * - `imports` on each text file that names any;
 * - `callers` on each symbol another non-test text file holds as a whole word: its first CALLER_CAP files, code before
 *   other text before `.planning`, each in path order, because a row could otherwise fill its ten with planning
 *   records; `total` counts every one, `.planning` included;
 * - `pinned_by` on each non-test file whose stem a test names and each symbol a test holds as a whole word, in the
 *   order the tests were read: tracked tests in path order, then the nested clone's. A test is never a caller. A Rust
 *   file holding `#[cfg(test)]` is in its own `pinned_by`.
 * A name or stem held by more than MAX_DEFINERS files keeps one tally for all its holders, each of which gets that list
 * without its own file, so the work per file stays flat.
 * @param {string} root
 * @param {{path: string, quoted?: true, kind: string, symbols?: any[]}[]} rows in path order
 * @param {{files: {path: string, dir: string, raw: Buffer}[]}} [nested] the nested clone's files, root-relative paths
 */
export function addEdges(root, rows, nested = { files: [] }) {
  /** @typedef {{row: any, syms: any[], callers?: Tally[], pins?: Tally, ownCaller?: true, ownPin?: true}} Holder */
  /** @type {Map<string, {holders: Holder[], shared?: {callers: Tally[], pins: Tally, byPath: Map<string, Holder>}}>} */
  const byName = new Map();
  for (const row of rows) {
    for (const sym of row.symbols || []) {
      if (NOT_CALLED.has(sym.kind) || !WORD_NAME.test(sym.name)) continue;
      let g = byName.get(sym.name);
      if (!g) byName.set(sym.name, g = { holders: [] });
      const last = g.holders[g.holders.length - 1];
      if (last && last.row === row) last.syms.push(sym);
      else g.holders.push({ row, syms: [sym] });
    }
  }
  for (const g of byName.values()) {
    if (g.holders.length > MAX_DEFINERS) g.shared = { callers: [tally(), tally(), tally()], pins: tally(), byPath: new Map(g.holders.map((h) => [h.row.path, h])) };
    else for (const h of g.holders) { h.callers = [tally(), tally(), tally()]; h.pins = tally(); }
  }
  /** every file a test can pin, by stem; a test file is what pins, so it has no entry */
  /** @type {Map<string, {row: any, pins: Tally}>} */
  const pinnable = new Map();
  /** @type {Map<string, {list: {row: any, pins: Tally}[], shared?: Tally}>} */
  const stems = new Map();
  for (const row of rows) {
    const stem = stemOf(row.path);
    if (isTestPath(row.path) || !stem) continue;
    const e = { row, pins: tally() };
    pinnable.set(row.path, e);
    let g = stems.get(stem);
    if (!g) stems.set(stem, g = { list: [] });
    g.list.push(e);
  }
  // a shared stem's tally counts tests; the entry's own keeps a Rust file's pin on itself
  for (const g of stems.values()) if (g.list.length > MAX_DEFINERS) g.shared = tally();

  /** @param {string} path @param {string} text */
  const pin = (path, text) => {
    for (const w of wordsOf(text)) {
      const g = byName.get(w);
      if (!g) continue;
      if (g.shared) {
        add(g.shared.pins, path);
        const own = g.shared.byPath.get(path);
        if (own) own.ownPin = true;
      } else for (const h of g.holders) if (h.row.path !== path) add(/** @type {Tally} */ (h.pins), path);
    }
    if (stems.size) {
      for (const w of stemWordsOf(text)) {
        const g = stems.get(w);
        if (!g) continue;
        if (g.shared) add(g.shared, path);
        else for (const e of g.list) add(e.pins, path);
      }
    }
  };

  const tracked = new Set(rows.map((r) => r.path));
  for (const row of rows) {
    if (row.kind !== 'text') continue;
    const text = readText(root, rawPath(row));
    if (text === null) continue;
    const imports = importsOf(row.path, text, tracked);
    if (imports.length) /** @type {any} */ (row).imports = { items: imports, approximate: true };
    if (isTestPath(row.path)) { pin(row.path, text); continue; }
    const self = pinnable.get(row.path);
    if (self && row.path.endsWith('.rs') && text.includes('#[cfg(test)]')) add(self.pins, row.path);
    if (!byName.size) continue;
    const tier = tierOf(row.path);
    for (const w of wordsOf(text)) {
      const g = byName.get(w);
      if (!g) continue;
      if (g.shared) {
        add(g.shared.callers[tier], row.path);
        const own = g.shared.byPath.get(row.path);
        if (own) own.ownCaller = true;
      } else for (const h of g.holders) if (h.row !== row) add(/** @type {Tally[]} */ (h.callers)[tier], row.path);
    }
  }
  // one file at a time, like the outer ones: the clone's text is never all in memory
  for (const f of nested.files) {
    const text = readText(f.dir, f.raw);
    if (text !== null) pin(f.path, text);
  }

  for (const g of byName.values()) {
    const sh = g.shared;
    const all = sh ? sh.callers.flatMap((c) => c.files).slice(0, CALLER_CAP) : [];
    const allTotal = sh ? sh.callers[0].total + sh.callers[1].total + sh.callers[2].total : 0;
    for (const h of g.holders) {
      let callers;
      let pins;
      if (sh) {
        callers = withoutOwn(all, allTotal, h.row.path, h.ownCaller === true);
        pins = withoutOwn(sh.pins.files, sh.pins.total, h.row.path, h.ownPin === true);
      } else {
        const cs = /** @type {Tally[]} */ (h.callers);
        callers = { files: cs.flatMap((c) => c.files).slice(0, CALLER_CAP), total: cs[0].total + cs[1].total + cs[2].total, approximate: true };
        pins = listOf(/** @type {Tally} */ (h.pins));
      }
      for (const sym of h.syms) {
        if (callers.total) sym.callers = callers;
        if (pins.total) sym.pinned_by = pins;
      }
    }
  }
  for (const g of stems.values()) {
    for (const e of g.list) {
      if (!g.shared) { if (e.pins.total) e.row.pinned_by = listOf(e.pins); continue; }
      const files = g.shared.files.slice();
      if (e.pins.total && files.length < CALLER_CAP) files.push(e.row.path);
      const total = g.shared.total + e.pins.total;
      if (total) e.row.pinned_by = { files, total, approximate: true };
    }
  }
}

/**
 * Takes the edges out of the rows, for an index that would otherwise be too big: every row's `imports` and `pinned_by`
 * and every symbol's `callers` and `pinned_by`, and with `symbols` the symbols too.
 * @param {{imports?: any, pinned_by?: any, symbols?: any[]}[]} rows changed in place @param {boolean} symbols
 */
export function stripEdges(rows, symbols) {
  for (const row of rows) {
    delete row.imports;
    delete row.pinned_by;
    if (symbols) delete row.symbols;
    else for (const sym of row.symbols || []) { delete sym.callers; delete sym.pinned_by; }
  }
}
