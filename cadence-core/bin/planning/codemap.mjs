// @ts-check
// planning/codemap.mjs - `codemap scan`: the facts layer's spine, every tracked path and its working-tree hash, no model
// --dir names the .planning directory and the project root is its parent, so a root below the repository's top level
// still lists consistent paths; the facts live in .planning/codemap/, which a nested .gitignore keeps out of every commit
'use strict';

import { lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { emit } from '../lib/seam-io.mjs';
import { fail, ok } from './core.mjs';
import { judgeEntry } from '../lib/codemap-entry.mjs';
import { addEdges, stripEdges } from '../lib/codemap-edges.mjs';
import { readFacts, readNested } from '../lib/codemap-facts.mjs';
import { writeLaunch } from '../lib/codemap-launch.mjs';
import { slice } from '../lib/codemap-slice.mjs';
import { ENTRY_FILE, entryFile, moduleState, partition, startsNoReader } from '../lib/codemap-partition.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { LIST_CAP, MAX_RUN_BYTES, agentBrackets, agentRows, noticeBracket, parseCompleted } from '../lib/workflow-run.mjs';
import { isPlainObject } from '../lib/text-util.mjs';
import { noticeTotals, readCapped, writeBrackets } from './workflow-run.mjs';

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

/**
 * @param {string} dir the planning directory
 * @param {any} opts `--out-dir` names an existing directory where the launch file and an item file per module are written
 */
function cmdStatus(dir, opts) {
  const root = dirname(resolve(dir));
  const map = join(dir, MAP_DIR);
  /** @type {string|null} */
  let outDir = null;
  if (opts['out-dir'] !== undefined) {
    outDir = resolve(String(opts['out-dir']));
    let st = null;
    try { st = lstatSync(outDir); } catch { /* refused below */ }
    if (!st || !st.isDirectory()) {
      return fail('bad-args', `--out-dir ${outDir} is not a directory`, 'make the scratch directory first and pass it - nothing was written');
    }
  }
  let real = false;
  try { real = lstatSync(map).isDirectory(); } catch { /* no map yet */ }
  const { index, tooLarge } = real ? storedIndex(map) : { index: null, tooLarge: false };
  const stored = index?.modules ?? null;
  if (tooLarge) {
    return fail('index-too-large', `the code map's index at ${join(map, INDEX_FILE)} is over ${MAX_INDEX / 1024 / 1024} MiB, so status won't read it`,
      'run `planning.mjs codemap scan` to rebuild the map');
  }
  if (!Array.isArray(stored)) {
    return fail('no-index', `there is no code map at ${map}`, 'run `planning.mjs codemap scan` first to build the module list');
  }
  let rows;
  try {
    rows = readFacts(root, outDir !== null);
  } catch {
    return fail('no-git', `${root} is not inside a git repository, so there is nothing to compare`,
      'run from the project\'s repository, or pass --dir naming its .planning directory');
  }
  // the stored list placed against the files as they are now, so a file added or removed since the scan counts and nothing is written
  const { modules } = partition(rows, stored);
  const state = stateOf(map, modules, rows);
  if (outDir === null) return ok({ action: 'status', ...state });
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const toRead = [];
  for (const m of modules) {
    const entry = readEntry(map, entryFile(m.name));
    const s = moduleState(m, entry, byPath);
    if (s === 'stale' || s === 'unbuilt') toRead.push({ ...m, entry: s === 'stale' ? entry : null });
  }
  const launch = writeLaunch({ root, outDir, modules: toRead, rows, indexRows: Array.isArray(index?.rows) ? index.rows : [] });
  return ok({ action: 'status', ...state, launch });
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

// text from a run file shown in an answer, cut so a hostile name can't fill it
const SHOWN = 200;
/** @param {unknown} v */
const shown = (v) => {
  // stringifying a hostile value can itself throw (a list nested deep enough), so this one never does
  try { return (typeof v === 'string' ? v : JSON.stringify(v) ?? 'undefined').slice(0, SHOWN); } catch { return '(a value that could not be shown)'; }
};
// a hash a clone's file may name: a full hex object name and nothing else
const OBJECT_NAME = /^[0-9a-f]{40,64}$/;

/** @param {Record<string, unknown>} a @param {Record<string, unknown>} b whether both name the same paths with the same hashes */
function sameHashes(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && b[k] === a[k]);
}

/**
 * A list's count, its first LIST_CAP items and the count of the rest.
 * @param {string} key @param {any[]} list
 */
const capped = (key, list) => ({
  [key]: list.length, [`${key}_modules`]: list.slice(0, LIST_CAP),
  ...(list.length > LIST_CAP ? { [`${key}_more`]: list.length - LIST_CAP } : {}),
});

/**
 * `codemap write`: a finished code map run, read from the host's run file, becomes the map's entries. The run is billed
 * before anything is judged (D-16), under phase 0 with no `--phase` flag, because an agent that spent tokens on a killed
 * or refused run is still billed. Each module is then judged on its own against a fresh scan (D-17): a good one is
 * written with the `built_from` the run returned, so an edit during the run leaves it stale (D-14), and a refused one is named
 * with its old entry untouched. A module's name from the run file only selects a module the facts hold; the file it
 * writes is derived from the stored name by hash and never from the run's text.
 * @param {string} dir the planning directory @param {any} opts
 */
function cmdWrite(dir, opts) {
  if (typeof opts['run-file'] !== 'string' || !opts['run-file'].trim()) {
    return fail('bad-args', 'codemap write needs --run-file <value>', 'pass the host\'s run file and re-run - nothing was billed or written');
  }
  const noticed = noticeTotals(opts, 'codemap write');
  if (!noticed.ok) return fail('bad-args', noticed.detail, 'copy the notice\'s figure as a plain number - nothing was written');
  const runPath = opts['run-file'];
  const root = dirname(resolve(dir));
  const runRead = readCapped(runPath, MAX_RUN_BYTES);
  /** @type {any} */
  let file = null;
  if (runRead.text !== null) { try { file = JSON.parse(runRead.text); } catch { /* the bracket falls back below */ } }
  const runId = isPlainObject(file) && typeof file.runId === 'string' && file.runId ? file.runId : basename(runPath, '.json');
  const at = { phase: '0', runId, payloadRef: `${basename(resolve(dir))}/${MAP_DIR}/${INDEX_FILE}` };
  const fromFile = agentRows(file).length > 0;
  const why = runRead.text === null ? `the run file ${runRead.why}` : (file === null ? 'the run file is not JSON' : 'the run file holds no agent rows');
  const brackets = {
    source: fromFile ? 'run-file' : 'notice-totals',
    ...writeBrackets(dir, '0', runId, fromFile ? agentBrackets(file, at) : [noticeBracket({ ...at, why, totals: noticed.totals, role: 'cad-mapper' })]),
  };
  /** Every answer from here on says what was billed. @param {string} reason @param {string} [detail] @param {string} [hint] */
  const refuse = (reason, detail, hint) => emit({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}), brackets });

  if (runRead.text === null) {
    return refuse(runRead.tooLarge ? 'run-too-large' : 'run-unreadable', `the run file ${runRead.why}`,
      'no entry was written - the notice\'s totals were billed as one bracket');
  }
  const parsed = parseCompleted(runRead.text);
  if (!parsed.ok) return refuse(/** @type {string} */ (parsed.reason), parsed.detail, 'no entry was written - a run that did not complete is not a map. Its agents were billed');
  const result = parsed.run.result;
  if (!isPlainObject(result) || !Array.isArray(result.modules)) {
    return refuse('run-bad-result', 'the result is not the code map\'s: it has no modules list', 'no entry was written. Its agents were billed');
  }

  const map = mapDir(dir);
  if (!map) {
    return refuse('unsafe-dir', `${join(dir, MAP_DIR)} or ${dir} exists and is not a real directory`, 'nothing was written, because a write through a link would leave the repository');
  }
  const { index } = storedIndex(map);
  if (!index || !Array.isArray(index.modules)) {
    return refuse('no-index', `there is no code map at ${map}`, 'run `planning.mjs codemap scan` first; no entry was written');
  }
  let rows;
  let nested;
  try {
    rows = readFacts(root, true);
    nested = readNested(root, rows);
  } catch {
    return refuse('no-git', `${root} is not inside a git repository, so there is nothing to judge against`, 'no entry was written');
  }
  const { modules } = partition(rows, index.modules);
  const byName = new Map(modules.map((m) => [m.name, m]));
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const tracked = new Set(byPath.keys());
  const nestedPaths = new Set(nested.paths);
  /** @type {Map<string, Set<string>>} */
  const symbols = new Map(rows.filter((r) => r.symbols).map((r) => [r.path, new Set(r.symbols.map((/** @type {any} */ s) => s.name))]));

  // the main session retypes the launch file into `args`, so a mistyped hash or a dropped module would otherwise go unnoticed
  /** @type {Map<string, {built_from: any, item: unknown}>|null} */
  let launch = null;
  let launchCheck = 'not-given';
  if (opts['launch-file'] !== undefined) {
    const r = readCapped(String(opts['launch-file']), MAX_RUN_BYTES);
    /** @type {any} */
    let l = null;
    try { l = r.text === null ? null : JSON.parse(r.text); } catch { /* judged below */ }
    if (isPlainObject(l) && Array.isArray(l.items) && l.items.every((/** @type {any} */ i) => isPlainObject(i) && typeof i.name === 'string' && isPlainObject(i.built_from))) {
      launch = new Map(l.items.map((/** @type {any} */ i) => [i.name, { built_from: i.built_from, item: i.item }]));
      launchCheck = 'ran';
    } else {
      launchCheck = 'not-run';
    }
  }

  const written = [];
  /** @type {{name: string, why: string}[]} */
  const refused = [];
  const dead = [];
  const seen = new Set();
  for (const row of result.modules) {
    // one module's row never takes down the others: anything thrown while handling it refuses that row and the loop goes on
    try {
      if (!isPlainObject(row) || typeof row.name !== 'string') { refused.push({ name: shown(isPlainObject(row) ? row.name : row), why: 'a module row without a name' }); continue; }
      const name = row.name;
      /** @param {string} reason */
      const no = (reason) => { refused.push({ name: shown(name), why: reason.slice(0, 2 * SHOWN) }); };
      if (seen.has(name)) { no('listed twice, so only the first was judged'); continue; }
      seen.add(name);
      const m = byName.get(name);
      if (!m) { no('not a module the facts hold'); continue; }
      if (startsNoReader(m, byPath)) { no('a module that starts no reader'); continue; }
      const given = launch ? launch.get(name) : null;
      const pinned = given ? given.built_from : null;
      if (launch && !given) { no('the launch file does not name this module'); continue; }
      if (row.entry === null) { dead.push(name); continue; }
      const from = row.built_from;
      if (!isPlainObject(from) || !Object.values(from).every((h) => typeof h === 'string' && OBJECT_NAME.test(h))) {
        no('built_from is not a map of paths to hashes'); continue;
      }
      if (given && (typeof row.item !== 'string' || row.item !== given.item)) { no('item differs from the launch file\'s or is missing, so the reader may have opened the wrong file'); continue; }
      if (pinned && !sameHashes(from, pinned)) { no('built_from differs from the launch file\'s, so a hash or a path was changed on the way'); continue; }
      const verdict = judgeEntry(row.entry, { root, module: new Set(m.paths), tracked, nested: nestedPaths, symbols });
      if (!verdict.ok) { no(verdict.why); continue; }
      atomicWrite(join(map, entryFile(m.name)), JSON.stringify({ built_from: from, ...verdict.entry }));
      written.push(name);
    } catch (e) {
      refused.push({ name: shown(isPlainObject(row) ? row.name : row), why: `could not be judged: ${shown(e instanceof Error ? e.message : e)}` });
    }
  }
  const missing = launch ? [...launch.keys()].filter((n) => !seen.has(n)) : [];
  return ok({
    action: 'write', launch_check: launchCheck,
    ...(launchCheck === 'not-run' ? { launch_note: 'the launch file could not be read as a launch file, so built_from was not compared with it' } : {}),
    ...capped('written', written), ...capped('refused', refused), ...capped('dead', dead), ...capped('missing', missing.map(shown)), brackets,
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
 * @param {string} sub scan | status | slice | write
 * @param {any} opts
 */
function cmdCodemap(dir, sub, opts) {
  if (sub === 'scan') return cmdScan(dir);
  if (sub === 'status') return cmdStatus(dir, opts);
  if (sub === 'write') return cmdWrite(dir, opts);
  if (sub === 'slice') return cmdSlice(dir, opts);
  return fail('usage', 'codemap <scan|status|slice|write>');
}

export { cmdCodemap };
