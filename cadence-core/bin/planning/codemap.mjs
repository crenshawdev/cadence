// @ts-check
// planning/codemap.mjs - `codemap scan`: the facts layer's spine, every tracked path and its working-tree hash, no model
// --dir names the .planning directory and the project root is its parent, so a root below the repository's top level
// still lists consistent paths; the facts live in .planning/codemap/, which a nested .gitignore keeps out of every commit
'use strict';

import { lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fail, ok } from './core.mjs';
import { readFacts } from '../lib/codemap-facts.mjs';
import { ENTRY_FILE, entryFile, moduleState, partition, startsNoReader } from '../lib/codemap-partition.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { LIST_CAP } from '../lib/workflow-run.mjs';

const MAP_DIR = 'codemap';
const INDEX_FILE = 'index.json';

/**
 * The map's directory, created when it's missing. A clone can track `.planning` or `.planning/codemap` as a symlink,
 * and a write through one would land outside the repository, so anything there that isn't a real directory is refused.
 * @param {string} dir the planning directory
 * @returns {string|null} the path, or null when it can't be trusted
 */
function mapDir(dir) {
  // resolve drops a trailing slash, which would make lstat follow a link
  dir = resolve(dir);
  const real = (p) => {
    try { return lstatSync(p).isDirectory(); } catch (e) { return /** @type {any} */ (e).code === 'ENOENT' ? null : false; }
  };
  if (real(dir) === false) return null;
  const map = join(dir, MAP_DIR);
  const state = real(map);
  if (state === false) return null;
  if (state === null) mkdirSync(map, { recursive: true });
  return map;
}

// the index holds a row per tracked path and its symbols, so a big repository writes a big one; this is about where a
// JS string runs out, and a larger file is a fresh cut. An entry file is one module's, so it keeps the smaller limit
const MAX_INDEX = 512 * 1024 * 1024;
const MAX_ENTRY = 64 * 1024 * 1024;

/**
 * The stored module list, or null. The map is derived, so an absent, oversized, torn or non-regular index means a fresh cut.
 * @param {string} map
 */
function storedModules(map) {
  try {
    const file = join(map, INDEX_FILE);
    const st = lstatSync(file);
    if (!st.isFile() || st.size > MAX_INDEX) return null;
    return JSON.parse(readFileSync(file, 'utf8')).modules ?? null;
  } catch {
    return null;
  }
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

/** @param {string} dir the planning directory */
function cmdStatus(dir) {
  const root = dirname(resolve(dir));
  const map = join(dir, MAP_DIR);
  let real = false;
  try { real = lstatSync(map).isDirectory(); } catch { /* no map yet */ }
  const stored = real ? storedModules(map) : null;
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
  try {
    rows = readFacts(root, true);
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
  const { modules, oversized } = partition(rows, storedModules(map));
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const listed = modules.map((m) => ({ name: m.name, entry: entryFile(m.name), no_reader: startsNoReader(m, byPath), paths: m.paths }));
  const ignore = join(map, '.gitignore');
  // read only a regular file of exactly the 2 bytes it should hold; anything else, a link included, is replaced by the write
  let held = null;
  try {
    const st = lstatSync(ignore);
    if (st.isFile() && st.size === 2) held = readFileSync(ignore, 'utf8');
  } catch { /* absent is the first write */ }
  if (held !== '*\n') atomicWrite(ignore, '*\n');
  atomicWrite(join(map, INDEX_FILE), JSON.stringify({ version: 1, rows, modules: listed }));
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
    ...stateOf(map, modules, rows), oversized,
  });
}

/**
 * @param {string} dir the planning directory
 * @param {string} sub scan | status
 * @param {any} _opts
 */
function cmdCodemap(dir, sub, _opts) {
  if (sub === 'scan') return cmdScan(dir);
  if (sub === 'status') return cmdStatus(dir);
  return fail('usage', 'codemap <scan|status>');
}

export { cmdCodemap };
