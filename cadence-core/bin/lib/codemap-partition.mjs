// @ts-check
// codemap-partition.mjs - the module list: every tracked path in exactly one module, cut once and reused
// pure, no I/O, nothing imported; the facts layer's rows go in and a module list comes out
// bytes alone never move a file (D-07): a later scan keeps the stored list, drops what's gone and places only what's new
'use strict';

import { createHash } from 'node:crypto';

// D-08: the ceiling is 128 KiB with no config key. It gives 39 modules on Cadence, 48 on Terminus, 148 on Baley and 31
// on codediver. 64 KiB nearly doubles the readers for the same bytes, and at 256 KiB one reader holds about 64,000 tokens
// of source before its first thought, re-sent on every later turn. The re-cut measurement is lowest or tied here too.
export const CEILING = 128 * 1024;

const PLANNING = '.planning/';
// a module holding a file in the new file's own directory beats any ancestor match, however deep
const OWN_DIR = 1e9;

/** @typedef {{path: string, kind: string, bytes: number|null}} Row */
/** @typedef {{name: string, paths: string[]}} Module */

/** @param {string} p */
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
/** @param {string} p */
const isPlanning = (p) => p.startsWith(PLANNING);
/** @param {Module} m */
const planningModule = (m) => m.paths.every(isPlanning);
/** @param {string} a @param {string} b */
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A directory's tree: its direct files and its sub-directories, each with the bytes beneath it.
 * @param {Row[]} rows
 */
function treeOf(rows) {
  const root = { files: /** @type {Row[]} */ ([]), dirs: new Map(), bytes: 0 };
  for (const r of rows) {
    const parts = r.path.split('/');
    let node = root;
    node.bytes += r.bytes || 0;
    for (const part of parts.slice(0, -1)) {
      if (!node.dirs.has(part)) node.dirs.set(part, { files: [], dirs: new Map(), bytes: 0 });
      node = node.dirs.get(part);
      node.bytes += r.bytes || 0;
    }
    node.files.push(r);
  }
  return root;
}

/** @param {any} node @returns {string[]} */
function pathsUnder(node) {
  return [...node.files.map((/** @type {Row} */ f) => f.path), ...[...node.dirs.values()].flatMap(pathsUnder)];
}

/**
 * The cut. A directory at or under the ceiling is one module. A directory over it is walked in sorted order: its
 * direct files and its whole sub-directories at or under the ceiling pack together up to the ceiling, a sub-directory
 * over it recurses, and a single file over it is a module of its own.
 * @param {any} node @param {number} ceiling @param {string[][]} out
 */
function cutDir(node, ceiling, out) {
  if (node.bytes <= ceiling) { out.push(pathsUnder(node)); return; }
  const items = [
    ...node.files.map((/** @type {Row} */ f) => ({ name: f.path, bytes: f.bytes || 0, file: f, dir: null })),
    ...[...node.dirs.entries()].map(([name, d]) => ({ name, bytes: d.bytes, file: null, dir: d })),
  ].sort((a, b) => byText(a.name, b.name));
  let bin = /** @type {string[]} */ ([]);
  let binBytes = 0;
  for (const it of items) {
    if (it.bytes > ceiling) {
      if (it.dir) cutDir(it.dir, ceiling, out);
      else out.push([it.file.path]);
      continue;
    }
    if (bin.length && binBytes + it.bytes > ceiling) { out.push(bin); bin = []; binBytes = 0; }
    bin.push(...(it.dir ? pathsUnder(it.dir) : [it.file.path]));
    binBytes += it.bytes;
  }
  if (bin.length) out.push(bin);
}

/** @param {string[]} paths the deepest directory they all sit under, '' for the root */
function commonDir(paths) {
  let common = dirOf(paths[0]).split('/').filter(Boolean);
  for (const p of paths.slice(1)) {
    const d = dirOf(p).split('/').filter(Boolean);
    let i = 0;
    while (i < common.length && i < d.length && common[i] === d[i]) i++;
    common = common.slice(0, i);
  }
  return common.join('/');
}

/**
 * A module's name comes from its paths: their common directory, or `.` for the root. A name already taken gets the
 * first path appended, and a name taken even then gets a number.
 * @param {string[]} paths sorted @param {Set<string>} taken
 */
function nameFor(paths, taken) {
  const dir = commonDir(paths) || '.';
  let name = dir;
  if (taken.has(name)) name = `${dir} ${paths[0]}`;
  for (let n = 2; taken.has(name); n++) name = `${dir} ${paths[0]} #${n}`;
  taken.add(name);
  return name;
}

/**
 * The entry file's name under `.planning/codemap/`, derived from the module's name by hash and never from its
 * characters, so it can't equal `index.json` or `.gitignore` and can't leave the directory whatever a path holds.
 * @param {string} name
 */
export function entryFile(name) {
  return `m-${createHash('sha256').update(name).digest('hex').slice(0, 32)}.json`;
}

/** The only names a scan may delete from the map directory. */
export const ENTRY_FILE = /^m-[0-9a-f]{32}\.json$/;

/**
 * A fresh cut: `.planning` paths are cut apart from the rest, since they never share a module with code.
 * @param {Row[]} rows @param {number} ceiling
 * @returns {Module[]}
 */
export function cut(rows, ceiling = CEILING) {
  /** @type {string[][]} */
  const groups = [];
  cutDir(treeOf(rows.filter((r) => !isPlanning(r.path))), ceiling, groups);
  cutDir(treeOf(rows.filter((r) => isPlanning(r.path))), ceiling, groups);
  const sorted = groups.filter((g) => g.length).map((g) => g.sort(byText))
    .sort((a, b) => byText(commonDir(a), commonDir(b)) || byText(a[0], b[0]));
  const taken = new Set();
  return sorted.map((paths) => ({ name: nameFor(paths, taken), paths }));
}

/**
 * Whether a stored module list can be trusted: well-shaped, unique names, no path in two modules.
 * @param {any} list @returns {list is Module[]}
 */
function usable(list) {
  if (!Array.isArray(list)) return false;
  const names = new Set();
  const paths = new Set();
  for (const m of list) {
    if (!m || typeof m.name !== 'string' || !Array.isArray(m.paths) || names.has(m.name)) return false;
    names.add(m.name);
    for (const p of m.paths) {
      if (typeof p !== 'string' || paths.has(p)) return false;
      paths.add(p);
    }
  }
  return true;
}

/**
 * How deep a directory the new file's directory shares with the module, or -1 when the module holds nothing near it.
 * @param {Module} m @param {string} dir
 */
function shared(m, dir) {
  const want = dir.split('/').filter(Boolean);
  let best = 0;
  let own = false;
  for (const p of m.paths) {
    const have = dirOf(p).split('/').filter(Boolean);
    let i = 0;
    while (i < want.length && i < have.length && want[i] === have[i]) i++;
    if (i > best) best = i;
    if (dirOf(p) === dir) own = true;
  }
  return own ? OWN_DIR : best;
}

/**
 * The module list for these rows. With a stored list it's reused: a removed file leaves its module, a module left
 * empty goes, and a new file joins the module holding a file in its own directory, otherwise the module sharing its
 * deepest ancestor directory, ties to the first name in sorted order. A new file over the ceiling stands alone, and
 * the join skips any module the file would take past twice the ceiling, starting a new module when none is left.
 * No existing file ever moves. `.planning` files join only `.planning` modules and code files never join those.
 * An unusable or absent list is a fresh cut, since the map is derived.
 * @param {Row[]} rows @param {any} stored the index's module list, or anything
 * @param {number} [ceiling]
 * @returns {{modules: Module[], oversized: string[]}}
 */
export function partition(rows, stored, ceiling = CEILING) {
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const size = (/** @type {Module} */ m) => m.paths.reduce((n, p) => n + (byPath.get(p)?.bytes || 0), 0);
  let modules;
  if (usable(stored) && stored.length) {
    modules = stored
      .map((m) => ({ name: m.name, paths: m.paths.filter((p) => byPath.has(p)) }))
      .filter((m) => m.paths.length);
    const held = new Set(modules.flatMap((m) => m.paths));
    const taken = new Set(modules.map((m) => m.name));
    for (const r of rows.filter((x) => !held.has(x.path)).sort((a, b) => byText(a.path, b.path))) {
      const bytes = r.bytes || 0;
      const planning = isPlanning(r.path);
      const dir = dirOf(r.path);
      const fits = modules
        .filter((m) => planningModule(m) === planning)
        .filter((m) => bytes <= ceiling && size(m) + bytes <= 2 * ceiling)
        .map((m) => ({ m, depth: shared(m, dir) }))
        .sort((a, b) => b.depth - a.depth || byText(a.m.name, b.m.name));
      if (fits.length) fits[0].m.paths.push(r.path);
      else modules.push({ name: nameFor([r.path], taken), paths: [r.path] });
    }
    for (const m of modules) m.paths.sort(byText);
    modules.sort((a, b) => byText(a.name, b.name));
  } else {
    modules = cut(rows, ceiling);
  }
  // only edits to existing files grow a module past the limit; one file past it is a module the cut already chose
  const oversized = modules.filter((m) => m.paths.length > 1 && size(m) > 2 * ceiling).map((m) => m.name);
  return { modules, oversized };
}

/**
 * A module starts no reader when it holds no text a reader could open: all `.planning`, or no text file in it.
 * @param {Module} m @param {Map<string, Row>} byPath
 */
export function startsNoReader(m, byPath) {
  return planningModule(m) || !m.paths.some((p) => byPath.get(p)?.kind === 'text');
}

/**
 * A module's state against its entry, by the hashes the entry was built from and never by the previous scan (D-06).
 * No reader beats everything. No entry, or one without a `built_from` map, is unbuilt, which is not stale. Any path
 * whose hash differs, any path only on one side, and any tracked path with no hash makes a built module stale.
 * @param {Module & {no_reader?: boolean}} m @param {any} entry the parsed entry file, or null
 * @param {Map<string, Row & {hash?: string|null}>} byPath the current facts
 * @returns {'no_reader'|'unbuilt'|'stale'|'built'}
 */
export function moduleState(m, entry, byPath) {
  if (startsNoReader(m, byPath)) return 'no_reader';
  const from = entry && typeof entry === 'object' ? entry.built_from : null;
  if (!from || typeof from !== 'object' || Array.isArray(from)) return 'unbuilt';
  const built = Object.keys(from);
  if (built.length !== m.paths.length) return 'stale';
  for (const p of m.paths) {
    const hash = byPath.get(p)?.hash;
    if (!hash || !Object.prototype.hasOwnProperty.call(from, p) || from[p] !== hash) return 'stale';
  }
  return 'built';
}
