// @ts-check
// planning-store.mjs - the one module every script write under `.planning` goes through
// node: builtins plus the import-free text-util.mjs leaf, on purpose: the read hook fires on every tool call and loads this, so planning-files.mjs (93 KB) can't come in
// each primitive below is a thin pass to the node:fs call, same arguments and same thrown errors, so a caller that switches sees no change
// the model keeps writing its own documents with its Write tool; this is the rule for scripts
'use strict';

import {
  appendFileSync, closeSync, copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, openSync, renameSync, rmSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs';
// the one local import: text-util.mjs has no imports and no I/O, and the helper census allows one sleep
import { sleep } from './text-util.mjs';

// atomic write: write a sibling temp file and rename over the target, so a crash never leaves a torn file
// the temp name is unique per call (`<file>.<pid>.<n>.tmp`) and derived, never random
// last-write-wins on the target: a `uat record` racing a `phase-done` loses an edit
// a symlink at the temp path is refused with a throw: a planted `ROADMAP.md.tmp` link used to write bytes anywhere
// only the temp path is guarded, a symlinked target is replaced, which heals a tree an attack already touched
// cost: a planning file symlinked into a dotfiles tree is replaced on the next write

/** Bumped on every atomicWrite call, so no two share a temp path. */
let tmpSeq = 0;

/**
 * @param {string} file
 * @param {string} text
 * @throws when the temp path is a symlink - writing would follow it out of the tree
 */
export function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.${tmpSeq++}.tmp`;
  // lstatSync so the link is classified, not its target. A stale temp from a crashed process is overwritten, no wedge
  let st = null;
  try { st = lstatSync(tmp); } catch { /* ENOENT is the ordinary case */ }
  if (st && st.isSymbolicLink()) {
    throw new Error(`atomicWrite refused: temp path is a symlink: ${tmp}`);
  }
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** Append `data` to `file`, creating it. @param {string} file @param {string | Uint8Array} data */
export function appendFile(file, data) {
  appendFileSync(file, data);
}

/** Overwrite `file` with `data`, creating it. Not atomic: a crash can leave it torn, so a caller that needs more uses atomicWrite. @param {string} file @param {string | Uint8Array} data */
export function writeFile(file, data) {
  writeFileSync(file, data);
}

/** Create `file` holding `data`, throwing EEXIST when it is already there (the `wx` flag). @param {string} file @param {string | Uint8Array} data */
export function writeFileNew(file, data) {
  writeFileSync(file, data, { flag: 'wx' });
}

/** Hard-link `existing` at `path`, throwing EEXIST when `path` is taken. @param {string} existing @param {string} path */
export function linkFile(existing, path) {
  linkSync(existing, path);
}

/** Create `dir` and any missing parents; an existing one is fine. @param {string} dir */
export function makeDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/** Move `from` to `to`, replacing a file there. Follows a symlink at `to`, so a caller guards the destination first. @param {string} from @param {string} to */
export function movePath(from, to) {
  renameSync(from, to);
}

/** Copy one file, replacing the destination. Follows links, so a caller lstats both sides first. @param {string} from @param {string} to */
export function copyFile(from, to) {
  copyFileSync(from, to);
}

/** Delete one file. @param {string} file */
export function unlinkFile(file) {
  unlinkSync(file);
}

/** Delete a directory and everything under it. @param {string} dir */
export function removeTree(dir) {
  rmSync(dir, { recursive: true });
}

// --- the lock --------------------------------------------------------------

/** Suffix of the sibling lock file. */
const LOCK_SUFFIX = '.lock';

/**
 * Total time a writer waits for a held lock before refusing. Ordinary overlap, two writers inside each other's write,
 * lets both bullets land. It's bounded because this sits in an interactive `/cad-capture` step. Two seconds leaves
 * margin for a twenty-writer burst on a busy runner.
 */
const LOCK_WAIT_MS = 2_000;

/** One poll interval, jittered up to double so writers that collided once don't re-collide in lockstep. */
const LOCK_POLL_MS = 5;

/**
 * A lock older than this belongs to a writer that died holding it, and is broken so a crashed `/cad-capture` can't
 * wedge the queue. Minutes, not seconds: the critical section is one small read and one rename, so the margin is for
 * a machine suspended mid-write.
 */
const LOCK_STALE_MS = 120_000;

/**
 * Take `lockPath` by exclusive create: the first writer wins, every later one
 * sees EEXIST and retries until the budget runs out.
 * @param {string} lockPath
 * @returns {{ok: true} | {ok: false, detail: string}}
 */
function takeLock(lockPath) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      // `wx` is the whole guard: atomic create-or-fail, the one exclusion primitive that needs no dependency
      closeSync(openSync(lockPath, 'wx'));
      return { ok: true };
    } catch (e) {
      const code = e && /** @type {any} */ (e).code;
      // anything but "somebody else holds it" is a real I/O failure and retrying can't help
      if (code !== 'EEXIST') {
        return { ok: false,
          detail: `could not create the lock ${lockPath}: ${e && e.message ? e.message : String(e)}` };
      }
    }
    // break a stale lock by claiming it first: unlinkSync after a statSync deletes whatever is there now, so a third
    // writer holding a dead lock's stat could unlink a fresh lock and walk in beside its owner. renameSync is atomic
    // and single-winner: one contender moves it aside, the losers get ENOENT. Re-stat after claiming to judge our bytes
    try {
      if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
        const claimed = `${lockPath}.break.${process.pid}.${Math.random().toString(36).slice(2)}`;
        renameSync(lockPath, claimed);
        if (Date.now() - statSync(claimed).mtimeMs > LOCK_STALE_MS) unlinkSync(claimed);
        // fresh after all, so we took a live writer's lock: put it back, unless something took the path meanwhile
        else if (!existsSync(lockPath)) renameSync(claimed, lockPath);
        else unlinkSync(claimed);
      }
    } catch { /* gone under us, so the next create is the retry */ }
    if (Date.now() >= deadline) {
      return { ok: false, detail: `another writer holds ${lockPath}` };
    }
    sleep(LOCK_POLL_MS + Math.floor(Math.random() * LOCK_POLL_MS));
  }
}

/**
 * Run `fn` holding the lock on `file`, and release it whatever happens. A throw from `fn` propagates, lock released.
 * Refusing the lock is `ok:false` with `reason` (default `'capture-locked'`), a value and not a throw: a throw inside a
 * `/cad-capture` step with no handler would lose the user's sentence behind a stack trace.
 * Not capture-specific: ARCHIVE.md needs it more, since a close removes the phase directories right after its write.
 * The guard sits above atomicWrite on purpose: that promises crash-safety, not mutual exclusion.
 * @template T
 * @param {string} file @param {() => T} fn @param {string} [reason]
 * @returns {{ok: true, value: T} | {ok: false, reason: string, detail: string}}
 */
export function withPlanningFileLock(file, fn, reason = 'capture-locked') {
  const lockPath = `${file}${LOCK_SUFFIX}`;
  const taken = takeLock(lockPath);
  if (taken.ok === false) return { ok: false, reason, detail: taken.detail };
  try {
    return { ok: true, value: fn() };
  } finally {
    // finally, so a throw in the write can't leak the lock and make the next writer wait out the staleness threshold
    try { unlinkSync(lockPath); } catch { /* already gone, a stale break took it */ }
  }
}
