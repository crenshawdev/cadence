// @ts-check
// codemap-facts.mjs - the facts layer's read: every tracked path, its working-tree hash, and what kind of file it is
// no model anywhere, and nothing here imports but node: builtins; the tracked paths and contents come from whoever made the clone
// the hash is the WORKING-TREE hash (D-05): `git ls-files -s` still prints the old hash after an unstaged edit
'use strict';

import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readlinkSync } from 'node:fs';

// the over-cap line: a file bigger than this is opened by nobody, its hash and byte count are all we keep
export const OVER_CAP = 1024 * 1024;
// a NUL inside this many leading bytes makes a file binary
const PROBE = 8192;
// -c core.fsmonitor=false on every call: a clone's config can name a hook program there, and a read must not run one
const GIT = ['-c', 'core.fsmonitor=false'];
const MAX_BUFFER = 1 << 30;

/**
 * Git's C-quoted spelling of raw path bytes, quotes included. It round-trips, and `git hash-object --stdin-paths`
 * unquotes it, so a path with a newline in it can still be sent on one line.
 * @param {Buffer} raw
 */
export function quotePath(raw) {
  let s = '';
  for (const b of raw) {
    if (b === 0x22 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += `\\${b.toString(8).padStart(3, '0')}`;
  }
  return `"${s}"`;
}

/**
 * The row's spelling of a path: the path itself when it's valid UTF-8, else the quoted form. A valid path that starts
 * with a quote is quoted too, so a plain spelling never starts with one and two paths never share a spelling.
 * @param {Buffer} raw
 * @returns {{path: string, quoted: boolean}}
 */
export function spellPath(raw) {
  const s = raw.toString('utf8');
  if (Buffer.from(s, 'utf8').equals(raw) && !s.startsWith('"')) return { path: s, quoted: false };
  return { path: quotePath(raw), quoted: true };
}

/** @param {string} root @param {string[]} args @param {Buffer} [input] @returns {Buffer} */
function git(root, args, input) {
  return execFileSync('git', [...GIT, '-C', root, ...args],
    { maxBuffer: MAX_BUFFER, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'ignore'], ...(input ? { input } : {}) });
}

/** @param {Buffer} buf @returns {Buffer[]} the NUL-terminated fields */
function nulFields(buf) {
  const out = [];
  for (let start = 0; start < buf.length;) {
    let i = buf.indexOf(0, start);
    if (i === -1) i = buf.length;
    out.push(buf.subarray(start, i));
    start = i + 1;
  }
  return out;
}

/**
 * Every tracked path once, from `ls-files -s -z`. An unmerged path lists under stages 1 to 3; it keeps one entry,
 * marked unmerged, and the worktree decides its hash.
 * @param {string} root
 * @returns {{raw: Buffer, mode: string, hash: string, unmerged: boolean}[]}
 */
function readIndex(root) {
  const seen = new Map();
  for (const rec of nulFields(git(root, ['ls-files', '-s', '-z']))) {
    const tab = rec.indexOf(9);
    if (tab === -1) continue;
    const [mode, hash, stage] = rec.subarray(0, tab).toString('latin1').split(' ');
    const raw = rec.subarray(tab + 1);
    const key = raw.toString('latin1');
    const prior = seen.get(key);
    if (prior) { if (stage !== '0') prior.unmerged = true; continue; }
    seen.set(key, { raw, mode, hash, unmerged: stage !== '0' });
  }
  return [...seen.values()];
}

/**
 * `git hash-object` over regular files, filters applied the way the index hash was made. One batch, and one call
 * per path when the batch fails, so a file that vanished between the lstat and here costs only its own hash.
 * @param {string} root @param {Buffer[]} paths @returns {(string|null)[]}
 */
function hashFiles(root, paths) {
  if (paths.length === 0) return [];
  const lines = (list) => Buffer.from(`${list.map((p) => quotePath(p)).join('\n')}\n`, 'latin1');
  try {
    const out = git(root, ['hash-object', '--stdin-paths'], lines(paths)).toString('latin1').split('\n');
    if (out.length === paths.length + 1) return out.slice(0, -1);
  } catch { /* fall through to one at a time */ }
  return paths.map((p) => {
    try { return git(root, ['hash-object', '--stdin-paths'], lines([p])).toString('latin1').trim() || null; } catch { return null; }
  });
}

/** @param {string} root @param {Buffer} text @returns {string|null} the blob hash of these exact bytes */
function hashBytes(root, text) {
  try { return git(root, ['hash-object', '--stdin'], text).toString('latin1').trim() || null; } catch { return null; }
}

/**
 * Whether a regular file within the cap is text. It's opened only here, only after an lstat said regular, and
 * without following a link or blocking on a pipe that replaced it since.
 * @param {Buffer} file @param {number} size
 * @returns {'text'|'binary'|null} null when it couldn't be opened as a regular file
 */
function probe(file, size) {
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(fd).isFile()) return null;
    const head = Buffer.alloc(Math.min(size, PROBE));
    const n = readSync(fd, head, 0, head.length, 0);
    return head.subarray(0, n).includes(0) ? 'binary' : 'text';
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * The scan's rows: one per tracked path, in path order. `kind` is text, binary, over_cap, symlink, gitlink, other or
 * missing; `hash` is null for a path with nothing to hash, which a staleness check reads as changed.
 * Throws when `root` isn't inside a git repository.
 * @param {string} root
 * @returns {{path: string, quoted?: true, kind: string, hash: string|null, bytes: number|null}[]}
 */
export function readFacts(root) {
  const entries = readIndex(root);
  const dirty = new Set(nulFields(git(root, ['diff-files', '--name-only', '-z', '--relative']))
    .map((r) => r.toString('latin1')));
  const base = Buffer.concat([Buffer.from(root), Buffer.from('/')]);
  /** @type {number[]} */
  const toHash = [];
  const rows = entries.map((e, i) => {
    const { path, quoted } = spellPath(e.raw);
    const row = { path, ...(quoted ? { quoted: /** @type {true} */ (true) } : {}), kind: 'other', hash: /** @type {string|null} */ (e.hash), bytes: /** @type {number|null} */ (null) };
    const isDirty = e.unmerged || dirty.has(e.raw.toString('latin1'));
    // a gitlink's worktree path is a directory in another repository; its index hash is the only hash it has
    if (e.mode === '160000') { row.kind = 'gitlink'; row.bytes = 0; return row; }
    const file = Buffer.concat([base, e.raw]);
    let st;
    try { st = lstatSync(file); } catch { row.kind = 'missing'; row.hash = null; return row; }
    if (st.isSymbolicLink()) {
      row.kind = 'symlink';
      // the link's own text and never what it points at
      const text = readlinkSync(file, 'buffer');
      row.bytes = text.length;
      if (isDirty) row.hash = hashBytes(root, text);
      return row;
    }
    if (!st.isFile()) { row.hash = null; return row; }
    row.bytes = st.size;
    if (isDirty) { toHash.push(i); row.hash = null; }
    if (st.size > OVER_CAP) { row.kind = 'over_cap'; return row; }
    const k = probe(file, st.size);
    row.kind = k || 'other';
    return row;
  });
  const done = hashFiles(root, toHash.map((i) => entries[i].raw));
  toHash.forEach((i, n) => { rows[i].hash = done[n]; });
  return rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
