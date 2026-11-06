// @ts-check
// codemap-facts.mjs - the facts layer's read: every tracked path, its working-tree hash, and what kind of file it is
// no model anywhere, and nothing here imports but node: builtins; the tracked paths and contents come from whoever made the clone
// the hash is the WORKING-TREE hash (D-05): `git ls-files -s` still prints the old hash after an unstaged edit, so every
// tracked regular file is hashed on its raw bytes each read; `git diff-files` is never called, because it runs a clean
// filter named in the repo's config on a file whose timestamp is as new as the index. A file under a filter hashes its raw bytes
'use strict';

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readlinkSync } from 'node:fs';
import { symbolsFor } from './codemap-symbols.mjs';

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

/**
 * The raw bytes of a row's path, the inverse of `spellPath`: a quoted spelling is C-unquoted, a plain one is its UTF-8.
 * @param {{path: string, quoted?: true}} row
 * @returns {Buffer}
 */
export function rawPath(row) {
  if (!row.quoted) return Buffer.from(row.path, 'utf8');
  const inner = row.path.slice(1, -1);
  const out = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c !== '\\') { out.push(inner.charCodeAt(i)); continue; }
    const oct = /^[0-7]{3}$/.test(inner.slice(i + 1, i + 4)) ? inner.slice(i + 1, i + 4) : null;
    if (oct) { out.push(parseInt(oct, 8)); i += 3; } else out.push(inner.charCodeAt(++i));
  }
  return Buffer.from(out);
}

/** @param {string} root @param {string[]} args @param {Buffer} [input] @returns {Buffer} */
function git(root, args, input) {
  return execFileSync('git', [...GIT, '-C', root, ...args],
    { maxBuffer: MAX_BUFFER, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'ignore'], ...(input ? { input } : {}) });
}

/**
 * The text of a tracked regular file under `root`, or null: absent, not a regular file, over the cap, binary, or
 * unreadable. The same lstat and open rules as the scan's own read, so a second pass over a file is as safe as the first.
 * @param {string} root @param {Buffer} raw the path's bytes
 * @returns {string|null}
 */
export function readText(root, raw) {
  const file = Buffer.concat([Buffer.from(root), Buffer.from('/'), raw]);
  try {
    const st = lstatSync(file);
    if (!st.isFile() || st.size > OVER_CAP) return null;
    const k = probe(file, st.size, true);
    return k && k.kind === 'text' ? /** @type {string} */ (k.text) : null;
  } catch {
    return null;
  }
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
 * Every tracked path once, from `ls-files -s -z`. An unmerged path lists under stages 1 to 3; it keeps its first
 * entry, and the worktree decides its hash.
 * @param {string} root
 * @returns {{raw: Buffer, mode: string, hash: string}[]}
 */
function readIndex(root) {
  const seen = new Map();
  for (const rec of nulFields(git(root, ['ls-files', '-s', '-z']))) {
    const tab = rec.indexOf(9);
    if (tab === -1) continue;
    const [mode, hash] = rec.subarray(0, tab).toString('latin1').split(' ');
    const raw = rec.subarray(tab + 1);
    const key = raw.toString('latin1');
    if (!seen.has(key)) seen.set(key, { raw, mode, hash });
  }
  return [...seen.values()];
}

/**
 * `git hash-object` over regular files, on their raw bytes: `--no-filters` because a clone's config can name a clean
 * filter and a read must not run one, so a file under a filter hashes its raw bytes. Paths go in absolute, since
 * `--stdin-paths` resolves a relative one against the top level, which is wrong for a root below it. One batch. Git
 * stops at the first path it can't read, after printing the hashes before it, so those are kept, that path is left
 * null and the batch resumes after it: one unreadable file costs one extra process, never one per file.
 * @param {string} root @param {Buffer[]} paths @returns {(string|null)[]}
 */
function hashFiles(root, paths) {
  /** @type {(string|null)[]} */
  const hashes = paths.map(() => null);
  const base = Buffer.concat([Buffer.from(root), Buffer.from('/')]);
  const args = ['hash-object', '--no-filters', '--stdin-paths'];
  for (let from = 0; from < paths.length;) {
    const batch = paths.slice(from);
    const input = Buffer.from(`${batch.map((p) => quotePath(Buffer.concat([base, p]))).join('\n')}\n`, 'latin1');
    let out;
    try { out = git(root, args, input); } catch (e) { out = /** @type {any} */ (e).stdout || Buffer.alloc(0); }
    // only whole lines count; the piece after the last newline is empty or cut off
    const got = out.toString('latin1').split('\n').slice(0, -1).slice(0, batch.length);
    got.forEach((h, k) => { if (/^[0-9a-f]{40,64}$/.test(h)) hashes[from + k] = h; });
    from += got.length < batch.length ? got.length + 1 : got.length;
  }
  return hashes;
}

/**
 * The blob hash of a symlink's link text, in process: `blob <length>\0` then the bytes, SHA-1 or SHA-256 to match the index.
 * @param {Buffer} text @param {number} hashLength the index hash's length in characters
 */
function hashLink(text, hashLength) {
  return createHash(hashLength === 64 ? 'sha256' : 'sha1').update(`blob ${text.length}\0`).update(text).digest('hex');
}

/**
 * Whether a regular file within the cap is text. It's opened only here, only after an lstat said regular, and
 * without following a link or blocking on a pipe that replaced it since.
 * @param {Buffer} file @param {number} size
 * @param {boolean} whole read the whole file, for the symbols of a text one
 * @returns {{kind: 'text'|'binary', text?: string}|null} null when it couldn't be opened as a regular file
 */
function probe(file, size, whole) {
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(fd).isFile()) return null;
    const buf = Buffer.alloc(whole ? Math.min(size, OVER_CAP) : Math.min(size, PROBE));
    const n = readSync(fd, buf, 0, buf.length, 0);
    if (buf.subarray(0, Math.min(n, PROBE)).includes(0)) return { kind: 'binary' };
    return whole ? { kind: 'text', text: buf.subarray(0, n).toString('utf8') } : { kind: 'text' };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * The scan's rows: one per tracked path, in path order. `kind` is text, binary, over_cap, symlink, gitlink, other or
 * missing; `hash` is null for a path with nothing to hash, which a staleness check reads as changed.
 * `withSymbols` reads each text file whole for the names it declares; a staleness check wants hashes only and leaves it off.
 * Throws when `root` isn't inside a git repository.
 * @param {string} root @param {boolean} [withSymbols]
 * @returns {{path: string, quoted?: true, kind: string, hash: string|null, bytes: number|null, symbols?: any[]}[]}
 */
export function readFacts(root, withSymbols = false) {
  const entries = readIndex(root);
  const base = Buffer.concat([Buffer.from(root), Buffer.from('/')]);
  /** @type {number[]} */
  const toHash = [];
  const rows = entries.map((e, i) => {
    const { path, quoted } = spellPath(e.raw);
    const row = { path, ...(quoted ? { quoted: /** @type {true} */ (true) } : {}), kind: 'other', hash: /** @type {string|null} */ (e.hash), bytes: /** @type {number|null} */ (null) };
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
      row.hash = hashLink(text, e.hash.length);
      return row;
    }
    if (!st.isFile()) { row.hash = null; return row; }
    row.bytes = st.size;
    toHash.push(i);
    row.hash = null;
    if (st.size > OVER_CAP) { row.kind = 'over_cap'; return row; }
    const k = probe(file, st.size, withSymbols);
    row.kind = k ? k.kind : 'other';
    if (k && k.text !== undefined) {
      // a quoted spelling would hide the extension behind its closing quote, so the extension is read from the raw bytes
      const symbols = symbolsFor(quoted ? e.raw.toString('latin1') : path, k.text);
      if (symbols.length) /** @type {any} */ (row).symbols = symbols;
    }
    return row;
  });
  const done = hashFiles(root, toHash.map((i) => entries[i].raw));
  toHash.forEach((i, n) => { rows[i].hash = done[n]; });
  return rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
