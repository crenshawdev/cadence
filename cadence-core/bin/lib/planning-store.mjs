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
import { join } from 'node:path';
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

// --- the records folder -----------------------------------------------------
// what scripts keep lives under `.planning/records/`; what a person reads stays at the top of `.planning/`
// this module is the only place that spells the folder's name, every other script asks it for a path

/** The folder name, used at the top of `.planning/` and (Plan 4) in each phase. */
const RECORDS_DIR = 'records';

/**
 * The top-level records directory of a planning root.
 * @param {string} planningRoot
 */
export function recordsDir(planningRoot) {
  return join(planningRoot, RECORDS_DIR);
}

/**
 * A path inside the top-level records directory.
 * @param {string} planningRoot
 * @param {...string} parts
 */
export function recordsPath(planningRoot, ...parts) {
  return join(planningRoot, RECORDS_DIR, ...parts);
}

/**
 * What the records folder's own `.gitignore` holds. The rules sit beside the logs, so they move with them and edit
 * nothing outside `.planning/`. One rule per thing a log can leave: the live record, its generation, the claim sidecar
 * and its dated forms (a pid and a random suffix, so patterns), and the read record's two rotation temps.
 * The base names are spelled in lib/trace.mjs and lib/read-trace.mjs, which this module can't import (builtins only,
 * the read hook loads it), so planning-trace-ignore.test.mjs derives every name from those constants and asks git.
 * `risk-carry/` is ignored because carried risk rulings are transient and never staged; the ledgers, the state file,
 * the carried deferred queue and the code map are committed, so nothing here names them.
 */
const RECORDS_IGNORE = [
  "# Cadence's local diagnostics: the run record, the read record, their rotated generations, claim files and",
  '# killed-mid-rotation temps. One machine\'s events, never committed.',
  '/trace.jsonl',
  '/trace.1.jsonl',
  '/trace.1.jsonl.claim',
  '/trace.1.jsonl.claim.*',
  '/reads.jsonl',
  '/reads.1.jsonl',
  '/reads.1.jsonl.claim',
  '/reads.1.jsonl.claim.*',
  '/reads.jsonl.rotate.*',
  '/reads.1.jsonl.evict.*',
  '',
  '# Carried risk rulings are transient and never staged',
  '/risk-carry/',
  '',
].join('\n');

/**
 * The three ledgers a person can read and git carries: the milestone residue, the findings filed to the tracker and
 * the findings declined. Each lock file stays a sibling of its ledger, so it moves with it.
 * @param {string} planningRoot
 */
export function archivePath(planningRoot) {
  return recordsPath(planningRoot, 'ARCHIVE.md');
}

/** @param {string} planningRoot */
export function filedPath(planningRoot) {
  return recordsPath(planningRoot, 'FILED.md');
}

/** @param {string} planningRoot */
export function declinedPath(planningRoot) {
  return recordsPath(planningRoot, 'DECLINED.md');
}

/**
 * The three folders under the records directory that hold what scripts carry: the deferred review queue a milestone
 * close moves out of the phase directories, the carried risk rulings, and the code map.
 * @param {string} planningRoot
 */
export function deferredDir(planningRoot) {
  return recordsPath(planningRoot, 'deferred');
}

/** @param {string} planningRoot */
export function riskCarryDir(planningRoot) {
  return recordsPath(planningRoot, 'risk-carry');
}

/** @param {string} planningRoot */
export function codemapDir(planningRoot) {
  return recordsPath(planningRoot, 'codemap');
}

// --- a phase's records folder -----------------------------------------------
// the same folder name sits inside each phase; the functions take the phase DIRECTORY, so `phases/<N>/` and an archived
// `_archive-<label>/<N>/` resolve alike. Nothing here creates a directory: the caller makes one when it first writes

/**
 * A phase's records directory: where its executor reports, review, adjudication and deferred files, and findings go.
 * @param {string} phaseDir
 */
export function phaseRecordsDir(phaseDir) {
  return join(phaseDir, RECORDS_DIR);
}

/**
 * Make a phase's records directory, for a writer about to put a file there. A link or a file where the folder belongs
 * is a throw, since a write through a link would leave the planning tree.
 * @param {string} phaseDir
 * @returns {string} the records directory
 */
export function ensurePhaseRecordsDir(phaseDir) {
  const dir = phaseRecordsDir(phaseDir);
  let st = null;
  try { st = lstatSync(dir); } catch { /* not made yet */ }
  if (st && !st.isDirectory()) throw new Error(`${dir} is not a real directory, so nothing is written there`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The executor reports directory inside a phase's records. @param {string} phaseDir */
export function phaseReportsDir(phaseDir) {
  return join(phaseRecordsDir(phaseDir), 'reports');
}

/** The area reserved for the review redesign's files; the names inside it are not decided yet. @param {string} phaseDir */
export function phaseReviewsDir(phaseDir) {
  return join(phaseRecordsDir(phaseDir), 'reviews');
}

/** The area reserved for the structured returns; the names inside it are not decided yet. @param {string} phaseDir */
export function phaseReturnsDir(phaseDir) {
  return join(phaseRecordsDir(phaseDir), 'returns');
}

/**
 * One path component for an area, refused when it could leave the area. The result is handed to a write, so a bad
 * name is a throw and not a value to check.
 * @param {string} name
 */
function areaName(name) {
  if (typeof name !== 'string' || name === '' || name === '.' || name === '..' || /[/\\\0]/.test(name)) {
    throw new Error(`records: ${JSON.stringify(name)} is not a file name inside a records area`);
  }
  return name;
}

/** The path of a named review record inside a phase's reviews area. @param {string} phaseDir @param {string} name */
export function phaseReviewPath(phaseDir, name) {
  return join(phaseReviewsDir(phaseDir), areaName(name));
}

/** The path of a named structured return inside a phase's returns area. @param {string} phaseDir @param {string} name */
export function phaseReturnPath(phaseDir, name) {
  return join(phaseReturnsDir(phaseDir), areaName(name));
}

/**
 * Write the records folder's `.gitignore` unless one is already there. An existing file is left byte-identical,
 * hand-edited or not. Returns whether this call created it.
 * @param {string} planningRoot
 * @returns {boolean}
 */
export function ensureRecordsIgnore(planningRoot) {
  try {
    writeFileSync(recordsPath(planningRoot, '.gitignore'), RECORDS_IGNORE, { flag: 'wx' });
    return true;
  } catch {
    // EEXIST is the ordinary case; any other failure leaves the folder unignored for `trace ignore` to report
    return false;
  }
}

/**
 * Make sure the records directory is there and is a real directory, writing its `.gitignore` when this call creates
 * it. A link here would carry every log, ledger and
 * carried queue out of the tree, so it is refused the way a symlinked file is. A planning root that is itself absent
 * stays an error (`ENOENT`): this creates the folder, never the project.
 * @param {string} planningRoot
 * @returns {{ok: true} | {ok: false, reason: string}} `reason` is `symlinked-records` or the fs error code
 */
export function ensureRecordsDir(planningRoot) {
  const dir = recordsDir(planningRoot);
  let st = null;
  try { st = lstatSync(dir); } catch { /* ENOENT is the first write */ }
  if (st) {
    if (st.isSymbolicLink()) return { ok: false, reason: 'symlinked-records' };
    return st.isDirectory() ? { ok: true } : { ok: false, reason: 'ENOTDIR' };
  }
  try {
    mkdirSync(dir);
  } catch (e) {
    const code = e && /** @type {any} */ (e).code;
    // a concurrent first writer made it between our lstat and our mkdir, and its call writes the ignore file
    if (code === 'EEXIST') return { ok: true };
    return { ok: false, reason: code || 'mkdir-failed' };
  }
  // the folder is born with its ignore file, so no log can land in it unignored
  ensureRecordsIgnore(planningRoot);
  return { ok: true };
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
