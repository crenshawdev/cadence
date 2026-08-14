// @ts-check
// capture-file.mjs - the ONE owner of `.planning/CAPTURE.md` file I/O. Every
// product writer of that file (`/cad-capture`, `/cad-execute`'s open-items
// append, `debt-harvest`) reaches the bytes through here, so the bullet format
// is stated once and no surface can name its own heading.
//
// WHY a module and not skill prose. Five filed bullets were lost because the
// writer was a model holding `Write`/`Edit` over the file: it appended below a
// heading the recall walk does not visit, and nothing could fail. A prose
// writer also has no test to redden. So the write is code, and the heading is
// not a parameter.
//
// THE THREE HEADINGS ARE ONE FACT WITH TWO IMPLEMENTATIONS. `CAPTURE_HEADINGS`
// below and the `['Todos', 'Seeds', 'Notes']` list inside `parseCaptureSnippets`
// in lib/planning-files.mjs (the recall walk) must name the same three sections:
// this module is the WRITE side of the walk that module READS. They are not
// unified into one export because the dependency would be circular - this file
// imports `sectionSpan` and `atomicWrite` from planning-files.mjs. If the walk
// there ever gains or drops a section, this map moves with it, and
// capture-file.test.mjs's per-kind rows plus planning.test.mjs's capture->recall
// round trip are what catch the drift.
//
// WHY the kind-to-heading map is FIXED here rather than validated at the entry.
// The structural cause of the lost bullets is that a writer COULD name a
// heading outside the walk. A validated `--section` flag closes that by
// checking; an absent flag closes it by construction, and only the second one
// survives the next caller who has a reason.
//
// WHY never `appendFileSync` at EOF (CONTEXT D-09). CAPTURE.md is sectioned
// markdown whose live heading order ends at `## Debt markers` - outside the
// walk - so an EOF append lands exactly where the lost bullets landed. The
// section is located with the EXPORTED `sectionSpan`, which is bounded at both
// ends and fence-aware; a bare heading scan was already the destructive half of
// a fixed bug (see `replaceSection`'s comment in planning.mjs), and the whole
// file is then written with `atomicWrite`.
//
// WHY `atomicWrite` is not touched (CONTEXT D-08). Its stated contract is
// crash-safety, not mutual exclusion, and 17 call sites across 4 files inherit
// anything added inside it. The guard is built ABOVE it, in this file: a
// sibling lock file taken with an exclusive create, around the WHOLE
// read-modify-write. `atomicWrite` alone leaves two writers last-write-wins on
// the target - its own D-05 block says so - which is a silently lost bullet,
// the same failure this module exists to close.
//
// A WRITER THAT CANNOT TAKE THE LOCK RETURNS A REASON, IT DOES NOT THROW. This
// settles the assumption CONTEXT flagged, and the trade-off is real either way.
// A throw would match `atomicWrite`'s own convention, but it would surface
// inside a `/cad-capture` step whose prose has no handler, so the user's
// sentence would be lost with a stack trace instead of a retry - the same lost
// update, now noisy. A returned reason matches `appendEvent` in lib/trace.mjs
// and `cmdDebtHarvest`'s existing `fail('write-failed')`, and it is only
// non-silent because the CALLING PROSE reports it: `/cad-capture` shows the
// user the reason and their sentence, and `/cad-execute` reports it in one
// line. A caller that swallows the reason is the bug, and it is a prose fix.
//
// THE LOCK PATH IS A WORKING-TREE FILE. `<CAPTURE.md>.lock`, a sibling so the
// exclusive create is on the same filesystem as the target. It is unlinked on
// every exit path (a `finally`), and a crashed writer's lock is broken by
// mtime age rather than left to wedge the queue forever. `/cad-capture` step 4
// stages ONLY `CAPTURE.md`, so a transient lock is never committed.
//
// WHAT THE GUARD DOES NOT REACH: a hand edit or a foreign script writing
// CAPTURE.md never takes the lock, so it can still clobber a bullet. That is
// the honest gap, and it is not closable by a lock nobody else honours.
'use strict';

import { readFileSync, mkdirSync, existsSync, openSync, closeSync, statSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { atomicWrite, sectionSpan } from './planning-files.mjs';

/**
 * The kind a caller may ask for, and the heading it lands under. Not
 * extensible on purpose - see the header.
 */
export const CAPTURE_HEADINGS = {
  todo: '## Todos',
  seed: '## Seeds',
  note: '## Notes',
};

/** The three words `--kind` admits, in the order they are reported. */
export const CAPTURE_KINDS = Object.keys(CAPTURE_HEADINGS);

/**
 * The body an absent CAPTURE.md is created with - byte-for-byte the three
 * headings `cmdDebtHarvest` writes for that same case, so a queue created by
 * either writer is the one `/cad-capture` expects.
 */
export const EMPTY_CAPTURE = '## Todos\n\n- None.\n\n## Seeds\n\n- None.\n\n## Notes\n\n- None.\n';

/**
 * Render the bullet for one capture. The shapes are exactly the three
 * `skills/cad-capture/SKILL.md` used to restate in prose; they live here now
 * because two statements of one format is how the writer and the reader drifted
 * apart in the first place.
 *
 * The text is flattened to one line: a newline inside it would write a second
 * line that is not a bullet, which the walk drops silently - this phase's
 * headline bug arriving through the front door.
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
 * Insert `bullet` at the END of `heading`'s section body, or append the whole
 * section when the heading is absent.
 *
 * Absent-heading arm: the heading is written WITH the bullet, so the bullet is
 * still inside the walk - which is what separates this from the EOF append D-09
 * refuses, where the bullet would land under whatever heading happened to be
 * last.
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
  // Back up over the blank lines that separate this section from the next, so
  // the bullet joins the section's own list rather than the gap after it.
  let at = end;
  while (at > start + 1 && lines[at - 1].trim() === '') at--;
  // An EMPTY section has no list to join: the bullet needs the blank line after
  // the heading that every other section already has.
  lines.splice(at, 0, ...(at === start + 1 ? ['', bullet] : [bullet]));
  return lines.join('\n');
}

/**
 * Replace `heading`'s body wholesale, or append the section when it is absent.
 *
 * Bounded at BOTH ends by the EXPORTED `sectionSpan` rather than a second fence
 * scanner (D-12): a `## ` line inside a fenced block in someone's `## Todos`
 * bullet must not be read as the section boundary - nor as the section's START.
 * Finding the heading with a bare `findIndex` was the second half of that same
 * bug and the more destructive one: a fenced example of `## Debt markers` in an
 * earlier section became the rewrite's anchor, and everything from inside that
 * code block onward - `## Seeds`, `## Notes`, their bullets - was replaced by
 * the new body.
 *
 * Moved here verbatim from planning.mjs, where it was `cmdDebtHarvest`'s
 * private helper: this module owns CAPTURE.md's bytes, and the harvest is one
 * of the three writers that has to take the same guard as the rest.
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

/** Read a file or return null - an absent queue is data, never a crash. */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

// --- the guard -------------------------------------------------------------

/** Suffix of the sibling lock file. */
const LOCK_SUFFIX = '.lock';

/**
 * Total time a writer waits for a held lock before refusing.
 *
 * What it buys: an ORDINARY overlap - two writers arriving inside each other's
 * write - lets BOTH bullets land instead of one refusing. What bounds it: this
 * seam sits inside an interactive `/cad-capture` step, so a lock that is really
 * held has to be refused in well under a second rather than hang the command.
 */
const LOCK_WAIT_MS = 500;

/**
 * One poll interval, jittered up to double. The jitter is what stops N writers
 * that collided once from re-colliding in lockstep every interval after.
 */
const LOCK_POLL_MS = 5;

/**
 * A lock file older than this belongs to a writer that DIED holding it, and is
 * broken. What it buys: a crashed `/cad-capture` cannot wedge the queue
 * forever. Why it is minutes and not seconds: the whole critical section is one
 * small read and one rename, so a live holder is never near this - the margin
 * is against a machine suspended mid-write, not against a slow write.
 */
const LOCK_STALE_MS = 120_000;

/** Sleep synchronously, zero-dep: the seam is a one-shot process, not a server. */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

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
      // `wx` is the whole guard: an atomic create-or-fail, which is the one
      // mutual-exclusion primitive available on every filesystem Cadence ships
      // to without a dependency.
      closeSync(openSync(lockPath, 'wx'));
      return { ok: true };
    } catch (e) {
      const code = e && /** @type {any} */ (e).code;
      // Anything that is not "somebody else holds it" is a real I/O failure -
      // an unwritable directory, a missing parent - and retrying cannot help.
      if (code !== 'EEXIST') {
        return { ok: false,
          detail: `could not create the lock ${lockPath}: ${e && e.message ? e.message : String(e)}` };
      }
    }
    try {
      if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) unlinkSync(lockPath);
    } catch { /* it vanished under us - the next create IS the retry */ }
    if (Date.now() >= deadline) {
      return { ok: false, detail: `another writer holds ${lockPath}` };
    }
    sleep(LOCK_POLL_MS + Math.floor(Math.random() * LOCK_POLL_MS));
  }
}

/**
 * Run `fn` holding the lock on `file`, and release it whatever happens.
 *
 * A throw from `fn` PROPAGATES (the lock is still released): the caller owns
 * how a write failure is reported, and this function's own failure arm is the
 * lock alone. Refusing the lock is `ok:false` with `reason: 'capture-locked'`.
 * @template T
 * @param {string} file @param {() => T} fn
 * @returns {{ok: true, value: T} | {ok: false, reason: string, detail: string}}
 */
export function withCaptureLock(file, fn) {
  const lockPath = `${file}${LOCK_SUFFIX}`;
  const taken = takeLock(lockPath);
  if (taken.ok === false) return { ok: false, reason: 'capture-locked', detail: taken.detail };
  try {
    return { ok: true, value: fn() };
  } finally {
    // `finally`, so a throw inside the write cannot leak the lock and leave the
    // next writer waiting out the full staleness threshold.
    try { unlinkSync(lockPath); } catch { /* already gone - a stale break took it */ }
  }
}

/**
 * Append one bullet to `file` under its kind's heading.
 *
 * `kind` and `text` are already validated by the caller; `phase` is the
 * caller's OWN spelling of the phase number (`requirePhaseArg().raw`), so
 * `--phase 1.10` tags `(phase 1.10)` rather than a normalized `1.1`.
 *
 * An existing `- None.` placeholder is left where it is: removing it is a
 * different change with its own blast radius, and the walk reads past it.
 * @param {string} file @param {string} kind @param {string} text @param {string} [phase]
 * @returns {{ok: true, bullet: string, heading: string, created: boolean}
 *   | {ok: false, reason: string, detail: string}}
 */
export function appendCapture(file, kind, text, phase) {
  const heading = CAPTURE_HEADINGS[kind];
  if (!heading) return { ok: false, reason: 'bad-kind', detail: `unknown capture kind: ${kind}` };
  const bullet = renderBullet(kind, text, phase);
  // Spelled out rather than `ReturnType<typeof withCaptureLock>`: that helper is
  // generic in what its callback returns, and ReturnType erases the argument,
  // so the `value` half would come back `unknown`. Here the callback returns
  // "the file did not exist".
  /** @type {{ok: true, value: boolean} | {ok: false, reason: string, detail: string}} */
  let guarded;
  try {
    // Before the lock, because the LOCK is a sibling of the target: the
    // `--cadence` queue lives in a directory that may not exist yet
    // (`~/.claude/cadence/`), and both the lock's exclusive create and
    // `atomicWrite`'s sibling-temp rename need the parent to be there.
    if (!existsSync(file)) mkdirSync(dirname(file), { recursive: true });
    // The READ is inside the lock with the write. Reading outside it is exactly
    // the lost update: two writers each read the same bytes, each append their
    // own bullet, and the second rename erases the first one's.
    guarded = withCaptureLock(file, () => {
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
  return { ok: true, bullet, heading, created: guarded.value };
}
