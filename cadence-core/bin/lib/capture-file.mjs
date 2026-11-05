// @ts-check
// capture-file.mjs - the one owner of `.planning/CAPTURE.md` file I/O, so the bullet format is stated once
// a module, not skill prose: five bullets were lost when a model with Write/Edit appended below a heading the recall
// walk doesn't visit, and nothing could fail
// heading names live in CAPTURE_WALK_SECTIONS (planning-files.mjs) and CAPTURE_HEADINGS derives from it
// never appendFileSync at EOF: the live order ends at `## Debt markers`, outside the walk, where those bullets landed
// the lock guard can't reach a hand edit that never takes the lock; see takeLock and appendCapture
'use strict';

import { readFileSync, mkdirSync, existsSync, openSync, closeSync, statSync, unlinkSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { atomicWrite, sectionSpan, CAPTURE_WALK_SECTIONS } from './planning-files.mjs';
import { sleep } from './text-util.mjs';

/**
 * The kind a caller may ask for and the heading it lands under. Not extensible: the three names are the walk's.
 */
export const CAPTURE_HEADINGS = {
  todo: `## ${CAPTURE_WALK_SECTIONS[0]}`,
  seed: `## ${CAPTURE_WALK_SECTIONS[1]}`,
  note: `## ${CAPTURE_WALK_SECTIONS[2]}`,
};

/** The three words `--kind` admits, in the order they are reported. */
export const CAPTURE_KINDS = Object.keys(CAPTURE_HEADINGS);

/**
 * The body an absent CAPTURE.md is created with, byte for byte the three headings `cmdDebtHarvest` writes for the same
 * case. Built from the walk's list so a queue this seam creates is one the walk can read.
 */
export const EMPTY_CAPTURE = CAPTURE_WALK_SECTIONS.map((s) => `## ${s}\n\n- None.\n`).join('\n');

/**
 * Render the bullet for one capture: the three shapes `skills/cad-capture/SKILL.md` used to restate in prose, kept here
 * since two statements of one format is how writer and reader drifted.
 * The text is flattened to one line: a newline would write a second line that isn't a bullet, which the walk drops.
 * @param {string} kind @param {string} text @param {string} [phase]
 * @returns {string}
 */
function renderBullet(kind, text, phase) {
  const flat = text.replace(/\s*\r?\n\s*/g, ' ').trim();
  if (kind === 'seed') return `- ${flat}`;
  if (kind === 'note') return `- ${new Date().toISOString().slice(0, 10)} ${flat}`;
  return `- [ ] ${phase !== undefined ? `(phase ${phase}) ` : ''}${flat}`;
}

/**
 * Insert `bullet` at the end of `heading`'s section body, or append the whole section when the heading is absent. The
 * heading goes in with the bullet so the bullet stays inside the walk, unlike an EOF append under whatever is last.
 * @param {string} text @param {string} heading @param {string} bullet
 * @returns {string}
 */
function insertBullet(text, heading, bullet) {
  const lines = text.split('\n');
  const { start, end } = sectionSpan(lines, heading);
  if (start < 0) {
    const sep = text === '' || text.endsWith('\n\n') ? '' : (text.endsWith('\n') ? '\n' : '\n\n');
    return `${text}${sep}${heading}\n\n${bullet}\n`;
  }
  // back up over the blank lines before the next section so the bullet joins the list, not the gap after it
  let at = end;
  while (at > start + 1 && lines[at - 1].trim() === '') at--;
  // an empty section has no list to join, so the bullet needs the blank line after the heading like the others
  lines.splice(at, 0, ...(at === start + 1 ? ['', bullet] : [bullet]));
  return lines.join('\n');
}

/**
 * Replace `heading`'s body wholesale, or append the section when it's absent.
 * Bounded by the exported sectionSpan, not a second fence scanner: a `## ` line inside a fenced block in a bullet
 * mustn't read as a boundary. A bare findIndex for the heading was the worse half of that bug: a fenced example of
 * `## Debt markers` became the anchor and everything from there on (`## Seeds`, `## Notes`) was replaced.
 * Moved here verbatim from planning.mjs, so the harvest takes the same guard as the other writers.
 * @param {string} text @param {string} heading @param {string} body
 * @returns {string}
 */
export function replaceSection(text, heading, body) {
  const lines = text.split('\n');
  const { start, end } = sectionSpan(lines, heading);
  if (start < 0) {
    const sep = text === '' || text.endsWith('\n\n') ? '' : (text.endsWith('\n') ? '\n' : '\n\n');
    return `${text}${sep}${heading}\n\n${body}`;
  }
  const tail = lines.slice(end);
  return `${lines.slice(0, start + 1).join('\n')}\n\n${body}${tail.length ? `\n${tail.join('\n')}` : ''}`;
}

/**
 * Read a file, or null when it doesn't exist. Only ENOENT is null and everything else throws, on purpose: a catch-all
 * read an unreadable queue as absent and the caller wrote EMPTY_CAPTURE over the whole backlog under an `ok:true`.
 */
function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (e) {
    if (e && /** @type {any} */ (e).code === 'ENOENT') return null;
    throw e;
  }
}

// --- the guard -------------------------------------------------------------

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

/**
 * Append one bullet to `file` under its kind's heading. `phase` is the caller's own spelling (`requirePhaseArg().raw`),
 * so `1.10` keeps its trailing zero. An existing `- None.` placeholder stays, the walk reads past it.
 * @param {string} file @param {string} kind @param {string} text @param {string} [phase]
 * @returns {{ok: true, bullet: string, heading: string, created: boolean}
 *   | {ok: false, reason: string, detail: string}}
 */
/**
 * How many times an overwritten bullet is re-appended before the write is called lost.
 * Breaking a stale lock can't be made ownership-safe with stat, unlink and rename, so two writers can share a section.
 * The writer verifies after release and re-appends if its bullet is gone: a concurrent write can't silently lose one.
 */
const APPEND_ATTEMPTS = 4;

export function appendCapture(file, kind, text, phase) {
  const heading = CAPTURE_HEADINGS[kind];
  if (!heading) return { ok: false, reason: 'bad-kind', detail: `unknown capture kind: ${kind}` };
  const bullet = renderBullet(kind, text, phase);
  let created = false;
  for (let attempt = 1; attempt <= APPEND_ATTEMPTS; attempt++) {
    // spelled out: ReturnType<typeof withPlanningFileLock> erases the callback's return, so `value` would be unknown
    /** @type {{ok: true, value: boolean} | {ok: false, reason: string, detail: string}} */
    let guarded;
    try {
      // before the lock, which sits beside the target, and the `--cadence` queue's directory may not exist yet
      if (!existsSync(file)) mkdirSync(dirname(file), { recursive: true });
      // read inside the lock with the write, or two writers read the same bytes and the second rename erases the first
      guarded = withPlanningFileLock(file, () => {
        const existing = read(file);
        const base = existing === null ? EMPTY_CAPTURE : existing;
        atomicWrite(file, insertBullet(base, heading, bullet));
        return existing === null;
      });
    } catch (e) {
      return { ok: false, reason: 'write-failed',
        detail: `${file}: ${e && e.message ? e.message : String(e)}` };
    }
    if (guarded.ok === false) return guarded;
    if (attempt === 1) created = guarded.value;

    // confirm after release: a read-back inside the lock passes for a writer whose bullet a second writer, let in by a
    // stale break, erases a moment later. After release it measures the state the caller is told about
    const settled = read(file);
    if (settled !== null && settled.includes(bullet)) {
      return { ok: true, bullet, heading, created };
    }
  }
  return { ok: false, reason: 'write-lost',
    detail: `${file}: the bullet was overwritten by a concurrent writer on all`
      + ` ${APPEND_ATTEMPTS} attempts - nothing was captured, and the sentence is not in the queue` };
}
