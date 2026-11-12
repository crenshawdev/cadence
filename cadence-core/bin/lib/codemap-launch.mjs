// @ts-check
// codemap-launch.mjs - what a code map launch is given: a launch file the main session retypes into `args`, and one item file per module
// the launch file holds no more than a name, the hashes pinned now and the item's path: it is retyped by a model, and the lists
// below measured about 87 KB on Cadence and 319 KB on Baley against 28,410 B and 69,590 B for `built_from` alone
// a reader holds no Bash (D-03), so the item file hands it every path to open, the tests that pin the module and the symbols it may cite
// the diff is produced only where every changed path's old blob still resolves (D-14): `cat-file` reads, nothing is stored
// `hash-object` is never run with -w, and git runs with -c core.fsmonitor=false as everywhere else in the facts layer
'use strict';

import { spawnSync } from 'node:child_process';
import { lstatSync, realpathSync, rmSync } from 'node:fs';
import { isAbsolute, join, posix, sep } from 'node:path';
import { isTestPath } from './codemap-edges.mjs';
import { SYMBOL_MAX } from './codemap-entry.mjs';
import { entryFile } from './codemap-partition.mjs';
import { atomicWrite } from './planning-store.mjs';
import { localGitEnv } from './publish-authorization.mjs';
import { LIST_CAP } from './workflow-run.mjs';

export const LAUNCH_FILE = 'launch.json';
const GIT = ['-c', 'core.fsmonitor=false'];
// a blob name from a file a clone can supply: only a full hex object name ever reaches git
const OBJECT_NAME = /^[0-9a-f]{40,64}$/;
const MAX_DIFF = 16 * 1024 * 1024;
// a missing object is asked for by a read: with a promisor remote configured git would lazy-fetch it, running core.sshCommand
// or reaching the network, and could store the blob
const ENV = { ...process.env, GIT_NO_LAZY_FETCH: '1' };

/** @param {string} name a module's name @returns {{item: string, old: string, diff: string}} scratch names derived the way the entry's is, never from the name's characters */
export function scratchNames(name) {
  const stem = entryFile(name).slice(0, -'.json'.length);
  return { item: `${stem}.item.json`, old: `${stem}.old.json`, diff: `${stem}.diff` };
}

/**
 * The text of each old blob in one `cat-file --batch` call, or null where a name no longer resolves, isn't a blob (a commit or a tree is no blob) or is over MAX_DIFF.
 * Each body is cut by the size in its header and the next header is read after it, never searched for, because a blob can hold anything.
 * @param {string} root @param {unknown[]} hashes @returns {(Buffer|null)[]}
 */
function oldBlobs(root, hashes) {
  /** @type {(Buffer|null)[]} */
  const out = hashes.map(() => null);
  const asked = hashes.flatMap((h, i) => (typeof h === 'string' && OBJECT_NAME.test(h) ? [i] : []));
  if (!asked.length) return out;
  // any one null sends the whole module to a full read, so a stream past the bound for every name at once can be refused whole
  const r = spawnSync('git', [...GIT, '-C', root, 'cat-file', '--batch'],
    { maxBuffer: asked.length * (MAX_DIFF + 256), env: ENV, input: `${asked.map((i) => hashes[i]).join('\n')}\n` });
  if (r.status !== 0 || !Buffer.isBuffer(r.stdout)) return out;
  const buf = r.stdout;
  let at = 0;
  for (const i of asked) {
    const eol = buf.indexOf(10, at);
    if (eol === -1) return hashes.map(() => null);
    const [, type, size] = buf.toString('latin1', at, eol).split(' ');
    at = eol + 1;
    // a `<name> missing` header has no size and no body
    if (size === undefined) continue;
    const n = Number(size);
    if (!Number.isSafeInteger(n) || at + n + 1 > buf.length) return hashes.map(() => null);
    if (type === 'blob' && n <= MAX_DIFF) out[i] = buf.subarray(at, at + n);
    at += n + 1;
  }
  return out;
}

/**
 * A name from a stored file as root-relative, normalized, or null when it is absolute, empty, holds a NUL or a backslash, or climbs out of the root.
 * @param {unknown} p @returns {string|null}
 */
function rootRel(p) {
  if (typeof p !== 'string' || !p || p.includes('\0') || p.includes('\\') || isAbsolute(p)) return null;
  const n = posix.normalize(p);
  return n === '.' || n === '..' || n.startsWith('../') ? null : n;
}

/**
 * Whether a stored test path is safe to hand a reader to open now: a test file by name with no `.git` segment, root-relative, no climb, a regular file by `lstat`, and
 * its directory resolving inside the root. A symlink, a missing file and a path in a stored file that lies are dropped.
 * @param {string} realRoot @param {string} root @param {string} n a normalized root-relative path
 */
function openable(realRoot, root, n) {
  if (!isTestPath(n) || n.split('/').includes('.git')) return false;
  try {
    if (!lstatSync(join(root, n)).isFile()) return false;
    const dir = realpathSync(join(root, posix.dirname(n)));
    return dir === realRoot || dir.startsWith(realRoot + sep);
  } catch { return false; }
}

/** @type {NodeJS.ProcessEnv|undefined} */
let noRepo;
// no GIT_DIR that exists, no config layer read: git finds no repository, so no filter can be named, whichever .gitattributes it sees
// ENV never changes, so it's built on the first diff and every later one reuses it
const noRepoEnv = () => (noRepo ??= { ...localGitEnv(ENV), GIT_DIR: '/dev/null/cad-no-git-dir', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_ATTR_NOSYSTEM: '1' });

/**
 * The hunks of a diff between an old blob and the file as it is now, working-tree edits included. `--no-index` reads the
 * blob from stdin and the file from disk, so nothing is stored and the index is not asked. Git's own header names a
 * temporary side, so it's replaced by the path. Git runs from `outDir` with no repository and no config layer to read.
 * @param {string} root @param {string} outDir @param {string} rel @param {Buffer} blob
 * @returns {string|null}
 */
function diffOf(root, outDir, rel, blob) {
  const env = noRepoEnv();
  const r = spawnSync('git', [...GIT, '-c', 'core.attributesFile=', 'diff', '--no-index', '--no-color', '--no-ext-diff', '--no-textconv', '--', '-', join(root, rel)],
    { cwd: outDir, input: blob, maxBuffer: MAX_DIFF, env });

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
  // an added path is offered to be opened, so only one in `read` is named; a symlink or binary added is in built_from alone
  const added = m.paths.filter((p) => !Object.prototype.hasOwnProperty.call(from, p) && read.has(p));
  // a removed name is a key of the stored entry, never opened: it stays root-relative, and one that climbs out of the root is dropped
  const removed = Object.keys(from).filter((p) => !held.has(p)).map(rootRel).filter((p) => p !== null);
  const oldEntry = join(outDir, names.old);
  atomicWrite(oldEntry, JSON.stringify(entry));
  const refresh = { old_entry: oldEntry, changed: changed.map(abs), added: added.map(abs), removed };
  const blobs = oldBlobs(root, changed.map((p) => from[p]));
  const diffFile = join(outDir, names.diff);
  if (blobs.some((b) => b === null)) {
    rmSync(diffFile, { force: true });
    return { ...refresh, refresh: 'whole' };
  }
  const parts = changed.map((p, i) => (read.has(p) ? diffOf(root, outDir, p, /** @type {Buffer} */ (blobs[i])) : ''));
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
  // the stored index is a file a clone can supply, so each test path it names is checked against the disk once
  const realRoot = realpathSync(root);
  /** @type {Map<string, boolean>} */
  const safe = new Map();
  const items = modules.map((m) => {
    const names = scratchNames(m.name);
    // a path whose hash is null has nothing to pin; it keeps the module stale until it is a file again
    const builtFrom = Object.fromEntries(m.paths.filter((p) => byPath.get(p)?.hash).map((p) => [p, byPath.get(p).hash]));
    // symlinks, gitlinks, binaries and over-cap files are pinned and never opened: a tracked symlink can point outside the repository
    // a quoted spelling is git's escape of a name, not a path that exists, so it is pinned and never opened
    const read = m.paths.filter((p) => byPath.get(p)?.kind === 'text' && !p.startsWith('"'));
    for (const p of read) readerBytes += byPath.get(p).bytes || 0;
    /** @type {Map<string, number>} */
    const pins = new Map();
    for (const p of m.paths) {
      const row = stored.get(p);
      if (!row) continue;
      for (const list of [row.pinned_by, ...(row.symbols || []).map((/** @type {any} */ s) => s.pinned_by)]) {
        for (const t of Array.isArray(list?.files) ? list.files : []) {
          const n = rootRel(t);
          if (n === null || n.startsWith('"')) continue;
          if (!safe.has(n)) safe.set(n, openable(realRoot, root, n));
          if (safe.get(n)) pins.set(n, (pins.get(n) || 0) + 1);
        }
      }
    }
    const tests = [...pins].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([t]) => abs(t));
    /** @type {Record<string, string[]>} */
    const symbols = {};
    for (const p of read) {
      // the schema bounds a symbol, so a longer name is not offered: a reader that cited it would have its module refused
      const declared = [...new Set((byPath.get(p).symbols || []).map((/** @type {any} */ s) => s.name))].filter((n) => typeof n === 'string' && n.length <= SYMBOL_MAX);
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
