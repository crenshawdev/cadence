// @ts-check
// codemap-launch.mjs - what a code map launch is given: a launch file the main session retypes into `args`, and one item file per module
// the launch file holds no more than a name, the hashes pinned now and the item's path: it is retyped by a model, and the lists
// below measured about 87 KB on Cadence and 319 KB on Baley against 28,410 B and 69,590 B for `built_from` alone
// a reader holds no Bash (D-03), so the item file hands it every path to open, the tests that pin the module and the symbols it may cite
// the diff is produced only where every changed path's old blob still resolves (D-14): `cat-file` reads, nothing is stored
// `hash-object` is never run with -w, and git runs with -c core.fsmonitor=false as everywhere else in the facts layer
'use strict';

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { entryFile } from './codemap-partition.mjs';
import { atomicWrite } from './planning-files.mjs';
import { LIST_CAP } from './workflow-run.mjs';

export const LAUNCH_FILE = 'launch.json';
const GIT = ['-c', 'core.fsmonitor=false'];
// a blob name from a file a clone can supply: only a full hex object name ever reaches git
const OBJECT_NAME = /^[0-9a-f]{40,64}$/;
const MAX_DIFF = 16 * 1024 * 1024;

/** @param {string} name a module's name @returns {{item: string, old: string, diff: string}} scratch names derived the way the entry's is, never from the name's characters */
export function scratchNames(name) {
  const stem = entryFile(name).slice(0, -'.json'.length);
  return { item: `${stem}.item.json`, old: `${stem}.old.json`, diff: `${stem}.diff` };
}

/** @param {string} root @param {string[]} args @param {string} [input] */
function git(root, args, input) {
  return spawnSync('git', [...GIT, '-C', root, ...args], { maxBuffer: MAX_DIFF, ...(input !== undefined ? { input } : {}) });
}

/**
 * The text of an old blob, or null when it no longer resolves. Whether it's a blob is asked first, so a name that is a commit or a tree is no blob.
 * @param {string} root @param {unknown} hash @returns {Buffer|null}
 */
function oldBlob(root, hash) {
  if (typeof hash !== 'string' || !OBJECT_NAME.test(hash)) return null;
  const kind = git(root, ['cat-file', '-t', hash]);
  if (kind.status !== 0 || String(kind.stdout).trim() !== 'blob') return null;
  const blob = git(root, ['cat-file', 'blob', hash]);
  return blob.status === 0 ? blob.stdout : null;
}

/**
 * The hunks of a diff between an old blob and the file as it is now, working-tree edits included. `--no-index` reads the
 * blob from stdin and the file from disk, so nothing is stored and the index is not asked. Git's own header names a
 * temporary side, so it's replaced by the path.
 * @param {string} root @param {string} rel @param {Buffer} blob
 * @returns {string|null}
 */
function diffOf(root, rel, blob) {
  const r = spawnSync('git', [...GIT, '-C', root, 'diff', '--no-index', '--no-color', '--no-ext-diff', '--no-textconv', '--', '-', join(root, rel)],
    { input: blob, maxBuffer: MAX_DIFF });
  // 1 is "they differ", which is the answer; anything else is a diff that didn't happen
  if (r.status !== 0 && r.status !== 1) return null;
  const lines = String(r.stdout).split('\n');
  const at = lines.findIndex((l) => l.startsWith('@@'));
  return `### ${rel}\n${at === -1 ? '(no text hunks: the file or its old form is binary)\n' : `${lines.slice(at).join('\n').replace(/\n*$/, '\n')}`}`;
}

/**
 * The refresh half of an item: the paths the old entry's hashes and the current ones disagree on, and a diff of them where
 * every changed path's old blob still resolves. A path outside `read` is named as changed and never diffed; with any old
 * blob gone there is no diff, which tells the reader to read the whole module.
 * @param {string} root @param {string} outDir @param {{name: string, paths: string[]}} m
 * @param {any} entry the old entry @param {Map<string, any>} byPath the current facts @param {Set<string>} read
 * @param {{item: string, old: string, diff: string}} names
 */
function refreshOf(root, outDir, m, entry, byPath, read, names) {
  const from = entry && typeof entry.built_from === 'object' && entry.built_from && !Array.isArray(entry.built_from) ? entry.built_from : {};
  const abs = (/** @type {string} */ p) => join(root, p);
  const held = new Set(m.paths);
  const changed = m.paths.filter((p) => Object.prototype.hasOwnProperty.call(from, p) && from[p] !== byPath.get(p)?.hash);
  const added = m.paths.filter((p) => !Object.prototype.hasOwnProperty.call(from, p));
  const removed = Object.keys(from).filter((p) => !held.has(p));
  const oldEntry = join(outDir, names.old);
  atomicWrite(oldEntry, JSON.stringify(entry));
  const refresh = { old_entry: oldEntry, changed: changed.map(abs), added: added.map(abs), removed: removed.map(abs) };
  const blobs = changed.map((p) => oldBlob(root, from[p]));
  const diffFile = join(outDir, names.diff);
  if (blobs.some((b) => b === null)) {
    rmSync(diffFile, { force: true });
    return { ...refresh, refresh: 'whole' };
  }
  const parts = changed.map((p, i) => (read.has(p) ? diffOf(root, p, /** @type {Buffer} */ (blobs[i])) : ''));
  if (parts.some((d) => d === null)) {
    rmSync(diffFile, { force: true });
    return { ...refresh, refresh: 'whole' };
  }
  const body = parts.join('');
  atomicWrite(diffFile, body || '(no text file you can open changed; see changed, added and removed)\n');
  return { ...refresh, refresh: 'diff', diff: diffFile };
}

/**
 * Write the launch file and an item file per module.
 * @param {object} a
 * @param {string} a.root the absolute project root
 * @param {string} a.outDir an existing directory
 * @param {{name: string, paths: string[], entry: any}[]} a.modules the stale and unbuilt ones, the entry being the old one or null
 * @param {any[]} a.rows the current facts, symbols included
 * @param {any[]} a.indexRows the stored index's rows, which hold `pinned_by`
 * @returns {{file: string, items: number, bytes: number, reader_bytes: number}}
 */
export function writeLaunch({ root, outDir, modules, rows, indexRows }) {
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const stored = new Map(indexRows.map((r) => [r.path, r]));
  const abs = (/** @type {string} */ p) => join(root, p);
  let readerBytes = 0;
  const items = modules.map((m) => {
    const names = scratchNames(m.name);
    // a path whose hash is null has nothing to pin; it keeps the module stale until it is a file again
    const builtFrom = Object.fromEntries(m.paths.filter((p) => byPath.get(p)?.hash).map((p) => [p, byPath.get(p).hash]));
    // symlinks, gitlinks, binaries and over-cap files are pinned and never opened: a tracked symlink can point outside the repository
    const read = m.paths.filter((p) => byPath.get(p)?.kind === 'text');
    for (const p of read) readerBytes += byPath.get(p).bytes || 0;
    /** @type {Map<string, number>} */
    const pins = new Map();
    for (const p of m.paths) {
      const row = stored.get(p);
      if (!row) continue;
      for (const list of [row.pinned_by, ...(row.symbols || []).map((/** @type {any} */ s) => s.pinned_by)]) {
        for (const t of Array.isArray(list?.files) ? list.files : []) if (typeof t === 'string' && !t.startsWith('"')) pins.set(t, (pins.get(t) || 0) + 1);
      }
    }
    const tests = [...pins].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([t]) => abs(t));
    /** @type {Record<string, string[]>} */
    const symbols = {};
    for (const p of read) {
      const declared = [...new Set((byPath.get(p).symbols || []).map((/** @type {any} */ s) => s.name))];
      if (declared.length) symbols[abs(p)] = declared;
    }
    const itemFile = join(outDir, names.item);
    const item = {
      name: m.name, built_from: builtFrom, read: read.map(abs),
      tests: tests.slice(0, LIST_CAP), ...(tests.length > LIST_CAP ? { tests_more: tests.length - LIST_CAP } : {}),
      symbols,
      ...(m.entry ? refreshOf(root, outDir, m, m.entry, byPath, new Set(read), names) : {}),
    };
    if (!m.entry) { rmSync(join(outDir, names.old), { force: true }); rmSync(join(outDir, names.diff), { force: true }); }
    atomicWrite(itemFile, `${JSON.stringify(item, null, 2)}\n`);
    return { name: m.name, built_from: builtFrom, item: itemFile };
  });
  const file = join(outDir, LAUNCH_FILE);
  const text = JSON.stringify({ root, items });
  atomicWrite(file, text);
  return { file, items: items.length, bytes: Buffer.byteLength(text), reader_bytes: readerBytes };
}
