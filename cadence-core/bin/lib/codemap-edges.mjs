// @ts-check
// codemap-edges.mjs - what touches what: the callers of a symbol, the imports of a file and the tests that pin them, from one pass over the text (D-10)
// no process is spawned here and nothing imports but node: builtins and the facts read; the text comes from whoever made the clone
// a hit is a whole word and nothing more, so a comment or another thing with the same name counts: every list is `approximate`
'use strict';

import { extname, posix } from 'node:path';
import { rawPath, readText } from './codemap-facts.mjs';

// D-20 measured the row at 10 callers per symbol, and a pinned_by list keeps the same ten
export const CALLER_CAP = 10;
// a name or a stem held by more files than this is `main` or `index`: its edges say nothing, and the work per file would grow with the holders
const MAX_DEFINERS = 100;
// the longest symbol name the facts keep
const WORD_CAP = 200;

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.rs', '.py', '.go']);
// a heading or a JSON key is a label and not something code calls
const NOT_CALLED = new Set(['heading', 'key']);
const WORD = /[\w$]+/g;
// a file stem keeps its hyphens: `workflow-run` is the measured case
const STEM_WORD = /[\w-]+/g;
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
 * @param {string} from the importing file @param {string} spec @param {Set<string>} tracked
 * @returns {string|null}
 */
function resolveRelative(from, spec, tracked) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const base = posix.normalize(posix.join(posix.dirname(from), spec));
  if (base.startsWith('../')) return null;
  const ext = extname(base);
  const tries = [base, ...TRY_EXT.map((e) => base + e), ...(TS_FOR[ext] || []).map((e) => base.slice(0, -ext.length) + e),
    ...TRY_EXT.map((e) => `${base}/index${e}`)];
  return tries.find((t) => tracked.has(t)) ?? null;
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
/** @param {{files: string[], total: number}} t @param {string} path */
function add(t, path) {
  t.total++;
  if (t.files.length < CALLER_CAP) t.files.push(path);
}
/** @param {{files: string[], total: number}} t */
const listOf = (t) => ({ files: t.files, total: t.total, approximate: true });

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
 * @param {string} root
 * @param {{path: string, quoted?: true, kind: string, symbols?: any[]}[]} rows in path order
 * @param {{files: {path: string, text: string}[]}} [nested] the nested clone's readable text, root-relative
 */
export function addEdges(root, rows, nested = { files: [] }) {
  /** @type {Map<string, {row: any, sym: any, callers: ReturnType<typeof tally>[], pins: ReturnType<typeof tally>}[]>} */
  const byName = new Map();
  /** @type {Map<string, number>} */
  const definers = new Map();
  for (const row of rows) {
    for (const sym of row.symbols || []) {
      if (NOT_CALLED.has(sym.kind) || !/^[\w$]+$/.test(sym.name)) continue;
      definers.set(sym.name, (definers.get(sym.name) || 0) + 1);
      if (!byName.has(sym.name)) byName.set(sym.name, []);
      /** @type {any} */ (byName.get(sym.name)).push({ row, sym, callers: [tally(), tally(), tally()], pins: tally() });
    }
  }
  for (const [name, n] of definers) if (n > MAX_DEFINERS) byName.delete(name);
  /** every file a test can pin, by stem; a test file is what pins, so it has no entry */
  /** @type {Map<string, {row: any, pins: ReturnType<typeof tally>}>} */
  const pinnable = new Map();
  /** @type {Map<string, {row: any, pins: ReturnType<typeof tally>}[]>} */
  const stems = new Map();
  for (const row of rows) {
    const stem = stemOf(row.path);
    if (isTestPath(row.path) || !stem) continue;
    const e = { row, pins: tally() };
    pinnable.set(row.path, e);
    if (!stems.has(stem)) stems.set(stem, []);
    /** @type {any} */ (stems.get(stem)).push(e);
  }
  for (const [stem, list] of stems) if (list.length > MAX_DEFINERS) stems.delete(stem);

  /** @param {string} path @param {string} text */
  const pin = (path, text) => {
    for (const w of wordsOf(text)) for (const t of byName.get(w) || []) if (t.row.path !== path) add(t.pins, path);
    if (stems.size) for (const w of stemWordsOf(text)) for (const e of stems.get(w) || []) add(e.pins, path);
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
      for (const t of byName.get(w) || []) if (t.row !== row) add(t.callers[tier], row.path);
    }
  }
  for (const f of nested.files) pin(f.path, f.text);

  for (const list of byName.values()) {
    for (const t of list) {
      const total = t.callers[0].total + t.callers[1].total + t.callers[2].total;
      if (total) t.sym.callers = { files: t.callers.flatMap((c) => c.files).slice(0, CALLER_CAP), total, approximate: true };
      if (t.pins.total) t.sym.pinned_by = listOf(t.pins);
    }
  }
  for (const e of pinnable.values()) if (e.pins.total) e.row.pinned_by = listOf(e.pins);
}
