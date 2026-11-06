// @ts-check
// planning/codemap.mjs - `codemap scan`: the facts layer's spine, every tracked path and its working-tree hash, no model
// --dir names the .planning directory and the project root is its parent, so a root below the repository's top level
// still lists consistent paths; the facts live in .planning/codemap/, which a nested .gitignore keeps out of every commit
'use strict';

import { lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fail, ok } from './core.mjs';
import { addEdges, stripEdges } from '../lib/codemap-edges.mjs';
import { readFacts, readNested } from '../lib/codemap-facts.mjs';
import { slice } from '../lib/codemap-slice.mjs';
import { ENTRY_FILE, entryFile, moduleState, partition, startsNoReader } from '../lib/codemap-partition.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { LIST_CAP } from '../lib/workflow-run.mjs';

const MAP_DIR = 'codemap';
const INDEX_FILE = 'index.json';

/**
 * The map's directory path, or null when it can't be trusted. A clone can track `.planning` or `.planning/codemap` as a
 * symlink, and a write through one would land outside the repository, so anything there that isn't a real directory is
 * refused. Nothing is created: the scan makes the directory once it knows it has something to write.
 * @param {string} dir the planning directory
 * @returns {string|null}
 */
function mapDir(dir) {
  // resolve drops a trailing slash, which would make lstat follow a link
  dir = resolve(dir);
  const real = (p) => {
    try { return lstatSync(p).isDirectory(); } catch (e) { return /** @type {any} */ (e).code === 'ENOENT' ? null : false; }
  };
  if (real(dir) === false) return null;
  const map = join(dir, MAP_DIR);
  return real(map) === false ? null : map;
}

// the index holds a row per tracked path and its symbols, so a big repository writes a big one. Measured on a file of
// `{},` repeated: 64 MiB parsed in 4.1 s at 2,049 MiB RSS, 128 MiB in 17.4 s at 4,044 MiB, and 256 MiB dumped core, an
// abort no catch sees. A scan never writes a larger one: it sheds the edges, then the symbols, and refuses if that is
// not enough. A larger file is a leftover or a clone's, a fresh cut for scan, and status and slice refuse it by name. An
// entry file is one module's, so it keeps the smaller limit
const MAX_INDEX = 128 * 1024 * 1024;
const MAX_ENTRY = 64 * 1024 * 1024;

/**
 * The stored index, or null. The map is derived, so an absent, oversized, torn or non-regular index means a fresh cut;
 * `tooLarge` says which of those it was, for status to name.
 * @param {string} map
 * @returns {{index: any, tooLarge: boolean}}
 */
function storedIndex(map) {
  try {
    const file = join(map, INDEX_FILE);
    const st = lstatSync(file);
    if (st.isFile() && st.size > MAX_INDEX) return { index: null, tooLarge: true };
    if (!st.isFile()) return { index: null, tooLarge: false };
    return { index: JSON.parse(readFileSync(file, 'utf8')), tooLarge: false };
  } catch {
    return { index: null, tooLarge: false };
  }
}

/** @param {string} map @returns {{modules: any, tooLarge: boolean}} the stored module list, or null */
function storedModules(map) {
  const { index, tooLarge } = storedIndex(map);
  return { modules: index?.modules ?? null, tooLarge };
}

/**
 * One module's entry file, or null when it's absent, not a regular file, too big or won't parse: all of them read as unbuilt.
 * @param {string} map @param {string} entry
 */
function readEntry(map, entry) {
  try {
    const file = join(map, entry);
    const st = lstatSync(file);
    if (!st.isFile() || st.size > MAX_ENTRY) return null;
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Each module's state and the figures a launch would be priced on. A reader opens only the regular text files at or
 * under the cap in a stale or unbuilt module, so `reader_bytes` counts those and a one-module refresh stays small.
 * @param {string} map @param {{name: string, paths: string[]}[]} modules @param {any[]} rows
 */
function stateOf(map, modules, rows) {
  const byPath = new Map(rows.map((r) => [r.path, r]));
  /** @type {Record<string, string[]>} */
  const names = { built: [], stale: [], unbuilt: [], no_reader: [] };
  let readerBytes = 0;
  for (const m of modules) {
    const state = moduleState(m, readEntry(map, entryFile(m.name)), byPath);
    names[state].push(m.name);
    if (state === 'stale' || state === 'unbuilt') {
      for (const p of m.paths) if (byPath.get(p)?.kind === 'text') readerBytes += byPath.get(p).bytes || 0;
    }
  }
  const listed = (key) => ({
    [key]: names[key].length, [`${key}_modules`]: names[key].slice(0, LIST_CAP),
    ...(names[key].length > LIST_CAP ? { [`${key}_more`]: names[key].length - LIST_CAP } : {}),
  });
  return {
    modules: modules.length, bytes: rows.reduce((n, r) => n + (r.bytes || 0), 0),
    built: names.built.length, no_reader: names.no_reader.length,
    readers: names.stale.length + names.unbuilt.length, reader_bytes: readerBytes,
    ...listed('stale'), ...listed('unbuilt'),
  };
}

/**
 * The bytes `JSON.stringify` would print for a row, summed a symbol at a time so a row of huge symbols is never one string.
 * @param {any} row @param {number} limit stop adding once past this
 */
function rowSize(row, limit) {
  const { symbols, ...rest } = row;
  if (!Array.isArray(symbols)) return Buffer.byteLength(JSON.stringify(row));
  // `"symbols":` and its brackets, with a comma before them when the row holds anything else
  let n = Buffer.byteLength(JSON.stringify(rest)) + (Object.keys(rest).length ? 1 : 0) + 10 + 2 + Math.max(0, symbols.length - 1);
  for (const s of symbols) {
    n += Buffer.byteLength(JSON.stringify(s));
    if (n > limit) break;
  }
  return n;
}

/**
 * The bytes the index would print, summed a row, a module and a path at a time, so a whole too big for a string is never built.
 * @param {{rows: any[], modules: any[], nested_paths: string[]}} index @param {number} limit stop adding once past this
 * @returns {number} the size, or something past `limit` when it's over
 */
function indexSize(index, limit) {
  const { rows, modules, nested_paths: nested, ...rest } = index;
  let n = Buffer.byteLength(JSON.stringify({ ...rest, rows: [], modules: [], nested_paths: [] }));
  try {
    for (const [items, size] of /** @type {[any[], (x: any) => number][]} */ ([
      [rows, (r) => rowSize(r, limit)], [modules, (m) => Buffer.byteLength(JSON.stringify(m))], [nested, (p) => Buffer.byteLength(JSON.stringify(p))],
    ])) {
      n += Math.max(0, items.length - 1);
      for (const x of items) {
        n += size(x);
        if (n > limit) return n;
      }
    }
  } catch {
    // a string too long to build is over any limit
    return Infinity;
  }
  return n;
}

/** @param {string} dir the planning directory */
function cmdStatus(dir) {
  const root = dirname(resolve(dir));
  const map = join(dir, MAP_DIR);
  let real = false;
  try { real = lstatSync(map).isDirectory(); } catch { /* no map yet */ }
  const { modules: stored, tooLarge } = real ? storedModules(map) : { modules: null, tooLarge: false };
  if (tooLarge) {
    return fail('index-too-large', `the code map's index at ${join(map, INDEX_FILE)} is over ${MAX_INDEX / 1024 / 1024} MiB, so status won't read it`,
      'run `planning.mjs codemap scan` to rebuild the map');
  }
  if (!Array.isArray(stored)) {
    return fail('no-index', `there is no code map at ${map}`, 'run `planning.mjs codemap scan` first to build the module list');
  }
  let rows;
  try {
    rows = readFacts(root);
  } catch {
    return fail('no-git', `${root} is not inside a git repository, so there is nothing to compare`,
      'run from the project\'s repository, or pass --dir naming its .planning directory');
  }
  // the stored list placed against the files as they are now, so a file added or removed since the scan counts and nothing is written
  const { modules } = partition(rows, stored);
  return ok({ action: 'status', ...stateOf(map, modules, rows) });
}

/** @param {string} dir the planning directory */
function cmdScan(dir) {
  const root = dirname(resolve(dir));
  let rows;
  let nested;
  try {
    rows = readFacts(root, true);
    nested = readNested(root, rows);
    addEdges(root, rows, nested);
  } catch {
    return fail('no-git', `${root} is not inside a git repository, so there is nothing to scan`,
      'run from the project\'s repository, or pass --dir naming its .planning directory');
  }
  // a tracked path under the map is one `git add` stages whatever the nested rule says, and the sweep below would delete it
  const mapRel = `${basename(resolve(dir))}/${MAP_DIR}/`;
  if (rows.some((r) => r.path.startsWith(mapRel) || r.path.startsWith(`"${mapRel}`))) {
    return fail('tracked-map', `this repository tracks files under ${mapRel}, so a scan would rewrite or delete tracked files`,
      `run \`git rm -r --cached ${mapRel.slice(0, -1)}\` and commit, then scan again; nothing was written`);
  }
  const map = mapDir(dir);
  if (!map) {
    return fail('unsafe-dir', `${join(dir, MAP_DIR)} or ${dir} exists and is not a real directory`,
      'remove it or replace it with a directory; nothing was written, because a write through a link would leave the repository');
  }
  const { modules, oversized } = partition(rows, storedModules(map).modules);
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const listed = modules.map((m) => ({ name: m.name, entry: entryFile(m.name), no_reader: startsNoReader(m, byPath), paths: m.paths }));
  // never an index over the limit: the edges go first, then the symbols, and a row left with neither says so in the marks
  /** @type {{edges_shed?: true, symbols_shed?: true}} */
  let marks = {};
  const index = () => ({ version: 1, rows, modules: listed, nested_paths: nested.paths, ...marks });
  if (indexSize(index(), MAX_INDEX) > MAX_INDEX) {
    stripEdges(rows, false);
    marks = { edges_shed: true };
    if (indexSize(index(), MAX_INDEX) > MAX_INDEX) {
      stripEdges(rows, true);
      marks = { edges_shed: true, symbols_shed: true };
      if (indexSize(index(), MAX_INDEX) > MAX_INDEX) {
        return fail('map-too-large', `the code map for ${root} is over ${MAX_INDEX / 1024 / 1024} MiB even with every edge and symbol left out`,
          'this repository is too large for a code map; nothing was written');
      }
    }
  }
  mkdirSync(map, { recursive: true });
  const ignore = join(map, '.gitignore');
  // read only a regular file of exactly the 2 bytes it should hold; anything else, a link included, is replaced by the write
  let held = null;
  try {
    const st = lstatSync(ignore);
    if (st.isFile() && st.size === 2) held = readFileSync(ignore, 'utf8');
  } catch { /* absent is the first write */ }
  if (held !== '*\n') atomicWrite(ignore, '*\n');
  atomicWrite(join(map, INDEX_FILE), JSON.stringify(index()));
  // an entry file no module names is an orphan of a re-cut or a removed module; only our own spelling is ever deleted
  const named = new Set(listed.map((m) => m.entry));
  for (const f of readdirSync(map)) {
    if (!ENTRY_FILE.test(f) || named.has(f)) continue;
    try { unlinkSync(join(map, f)); } catch { /* a directory wearing an entry's name is left as it is */ }
  }
  const count = (kind) => rows.filter((r) => r.kind === kind).length;
  return ok({
    action: 'scan', files: rows.length, text: count('text'), binary: count('binary'), over_cap: count('over_cap'),
    symlinks: count('symlink'), gitlinks: count('gitlink'), missing: count('missing'),
    ...stateOf(map, modules, rows), oversized, ...marks,
  });
}

/** @param {unknown} v a comma-separated flag @returns {string[]} its non-blank items */
const listOf = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);

/**
 * The rows asked for, and no way to ask for all of them: a call naming none of the selectors is refused.
 * @param {string} dir the planning directory @param {any} opts
 */
function cmdSlice(dir, opts) {
  const select = { files: listOf(opts.files), symbols: listOf(opts.symbols), terms: listOf(opts.terms) };
  if (!select.files.length && !select.symbols.length && !select.terms.length) {
    return fail('usage', 'codemap slice needs --files, --symbols or --terms, each a comma-separated list',
      'name what to read, such as `--files a.mjs,b.mjs`; the whole map is never printed');
  }
  const root = dirname(resolve(dir));
  const map = join(dir, MAP_DIR);
  let real = false;
  try { real = lstatSync(map).isDirectory(); } catch { /* no map yet */ }
  const { index, tooLarge } = real ? storedIndex(map) : { index: null, tooLarge: false };
  if (tooLarge) {
    return fail('index-too-large', `the code map's index at ${join(map, INDEX_FILE)} is over ${MAX_INDEX / 1024 / 1024} MiB, so slice won't read it`,
      'run `planning.mjs codemap scan` to rebuild the map');
  }
  const isObject = (/** @type {any} */ v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  // the index comes from a file a clone can supply: every row has a path, and its symbols are objects
  const wellFormed = index && Array.isArray(index.rows) && Array.isArray(index.modules)
    && index.modules.every((/** @type {any} */ m) => m && typeof m.name === 'string' && Array.isArray(m.paths))
    && index.rows.every((/** @type {any} */ r) => isObject(r) && typeof r.path === 'string'
      && (r.symbols === undefined || (Array.isArray(r.symbols) && r.symbols.every(isObject))));
  if (!wellFormed) {
    return fail('no-index', `there is no code map at ${map}`, 'run `planning.mjs codemap scan` first to build the map');
  }
  let current;
  try {
    current = readFacts(root);
  } catch {
    return fail('no-git', `${root} is not inside a git repository, so there is nothing to compare`,
      'run from the project\'s repository, or pass --dir naming its .planning directory');
  }
  // staleness is the way status takes it: the stored list placed against the files as they are now, each entry's built_from against current hashes
  const { modules } = partition(current, index.modules);
  const byPath = new Map(current.map((r) => [r.path, r]));
  /** @type {Map<string, string>} */
  const states = new Map();
  /** @type {Map<string, any>} */
  const entries = new Map();
  for (const m of modules) {
    const entry = readEntry(map, entryFile(m.name));
    const state = moduleState(m, entry, byPath);
    states.set(m.name, state);
    if (entry && (state === 'built' || state === 'stale')) entries.set(m.name, entry);
  }
  const base = `${basename(resolve(dir))}/${MAP_DIR}`;
  const marks = { ...(index.edges_shed === true ? { edges_shed: true } : {}), ...(index.symbols_shed === true ? { symbols_shed: true } : {}) };
  return ok(slice({
    rows: index.rows, modules: index.modules, states, entries, select, entryPath: (name) => `${base}/${entryFile(name)}`,
    current: new Set(current.map((r) => r.path)), marks,
  }));
}

/**
 * @param {string} dir the planning directory
 * @param {string} sub scan | status | slice
 * @param {any} opts
 */
function cmdCodemap(dir, sub, opts) {
  if (sub === 'scan') return cmdScan(dir);
  if (sub === 'status') return cmdStatus(dir);
  if (sub === 'slice') return cmdSlice(dir, opts);
  return fail('usage', 'codemap <scan|status|slice>');
}

export { cmdCodemap };
