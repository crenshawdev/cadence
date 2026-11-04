// @ts-check
// capture-file.mjs - the one owner of `.planning/CAPTURE.md` file I/O. Every writer (`/cad-capture`, `/cad-execute`'s
// open-items append, `debt-harvest`) goes through here, so the bullet format is stated once and no surface names its own heading
// a module and not skill prose: five filed bullets were lost because the writer was a model holding Write/Edit, which appended
// below a heading the recall walk doesn't visit, and nothing could fail. Code can have a test, and the heading isn't a parameter
// the heading names live in CAPTURE_WALK_SECTIONS (planning-files.mjs) and CAPTURE_HEADINGS derives from it: this is the write
// side of that walk, and a fact written down twice is the only way the two disagree again
// never appendFileSync at EOF, the live heading order ends at `## Debt markers`, outside the walk, which is exactly where the lost
// bullets landed. The section is found with sectionSpan and the whole file goes out through atomicWrite
// the guard (lock, retry) is explained at takeLock and appendCapture, and it can't reach a hand edit or foreign script that never takes the lock
'use strict';

import { readFileSync, mkdirSync, existsSync, openSync, closeSync, statSync, unlinkSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { atomicWrite, sectionSpan, CAPTURE_WALK_SECTIONS } from './planning-files.mjs';
import { sleep } from './text-util.mjs';

/**
 * The kind a caller may ask for and the heading it lands under. Not extensible on purpose, and the three names are the walk's, by position.
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
 * Render the bullet for one capture. These are the three shapes `skills/cad-capture/SKILL.md` used to restate in prose,
 * kept here since two statements of one format is how writer and reader drifted.
 * The text is flattened to one line: a newline inside it would write a second line that isn't a bullet, which the walk drops silently.
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
 * Insert `bullet` at the end of `heading`'s section body, or append the whole section when the heading is absent. The heading
 * goes in with the bullet so the bullet is still inside the walk, which separates this from an EOF append landing under whatever heading is last.
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
  // back up over the blank lines separating this section from the next, so the bullet joins the section's list and not the gap after it
  let at = end;
  while (at > start + 1 && lines[at - 1].trim() === '') at--;
  // an empty section has no list to join, so the bullet needs the blank line after the heading that every other section has
  lines.splice(at, 0, ...(at === start + 1 ? ['', bullet] : [bullet]));
  return lines.join('\n');
}

/**
 * Replace `heading`'s body wholesale, or append the section when it's absent.
 * Bounded at both ends by the exported sectionSpan, not a second fence scanner: a `## ` line inside a fenced block in someone's
 * `## Todos` bullet mustn't read as the section boundary or its start. Finding the heading with a bare findIndex was the more
 * destructive half of that bug: a fenced example of `## Debt markers` in an earlier section became the anchor, and everything
 * from inside that code block onward (`## Seeds`, `## Notes`, their bullets) was replaced by the new body.
 * Moved here verbatim from planning.mjs, where it was cmdDebtHarvest's private helper. This module owns CAPTURE.md's bytes, so
 * the harvest has to take the same guard as the other writers.
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
 * Read a file, or null when it doesn't exist. Only ENOENT is null and every other error throws, which is the point: a catch-all
 * read an unreadable but present queue as an absent one, and the caller then wrote EMPTY_CAPTURE over it, destroying the whole backlog under an `ok:true` envelope.
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
 * Total time a writer waits for a held lock before refusing. An ordinary overlap, two writers arriving inside each other's write,
 * lets both bullets land instead of one refusing. It's bounded because this sits in an interactive `/cad-capture` step and a really
 * held lock has to be refused promptly. Two seconds leaves margin for a twenty-writer burst on a busy runner.
 */
const LOCK_WAIT_MS = 2_000;

/** One poll interval, jittered up to double so writers that collided once don't re-collide in lockstep. */
const LOCK_POLL_MS = 5;

/**
 * A lock older than this belongs to a writer that died holding it, and is broken, so a crashed `/cad-capture` can't wedge the queue
 * forever. Minutes and not seconds because the critical section is one small read and one rename: a live holder is never near this,
 * the margin is for a machine suspended mid-write.
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
      // `wx` is the whole guard, an atomic create-or-fail and the one mutual-exclusion primitive on every filesystem Cadence ships to without a dependency
      closeSync(openSync(lockPath, 'wx'));
      return { ok: true };
    } catch (e) {
      const code = e && /** @type {any} */ (e).code;
      // anything but "somebody else holds it" is a real I/O failure (unwritable directory, missing parent) and retrying can't help
      if (code !== 'EEXIST') {
        return { ok: false,
          detail: `could not create the lock ${lockPath}: ${e && e.message ? e.message : String(e)}` };
      }
    }
    // breaking a stale lock claims it first. unlinkSync on a path we only statSynced deletes whatever is there now: a holder dies,
    // a second writer breaks its lock and takes a fresh one, and a third still holding the dead lock's stat unlinks that fresh lock
    // and walks into the section beside its owner. renameSync is atomic and single-winner, so exactly one contender moves the stale
    // lock to a private path and the losers get ENOENT. Re-stat after the claim, because only then do we own the bytes we're judging
    try {
      if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
        const claimed = `${lockPath}.break.${process.pid}.${Math.random().toString(36).slice(2)}`;
        renameSync(lockPath, claimed);
        if (Date.now() - statSync(claimed).mtimeMs > LOCK_STALE_MS) unlinkSync(claimed);
        // fresh after all, so we claimed a live writer's lock. Put it back only if nothing took the path meanwhile, a plain rename would clobber a fourth writer's lock
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
 * Run `fn` holding the lock on `file`, and release it whatever happens. A throw from `fn` propagates with the lock
 * still released, the caller owns how a write failure is reported. Refusing the lock is `ok:false` with `reason`
 * (default `'capture-locked'`), a returned value and not a throw: a throw would surface inside a `/cad-capture`
 * step whose prose has no handler and lose the user's sentence behind a stack trace. A caller that swallows it is the bug.
 * The lock isn't capture-specific. ARCHIVE.md needs the same guarantee for a worse consequence: a close removes the
 * phase directories right after its write, so a clobbered residue has no live source to recover from.
 * The guard sits above atomicWrite on purpose: that promises crash-safety, not mutual exclusion, and 17 call sites
 * inherit anything added inside it.
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
 * Append one bullet to `file` under its kind's heading. `kind` and `text` are validated by the caller, and `phase` is the caller's
 * own spelling (`requirePhaseArg().raw`), so a phase like `1.10` keeps its trailing zero instead of becoming `1.1`.
 * An existing `- None.` placeholder stays: removing it is a different change with its own blast radius, and the walk reads past it.
 * @param {string} file @param {string} kind @param {string} text @param {string} [phase]
 * @returns {{ok: true, bullet: string, heading: string, created: boolean}
 *   | {ok: false, reason: string, detail: string}}
 */
/**
 * How many times a bullet that was overwritten is re-appended before the write is called lost.
 * Why a retry exists: `wx` gives mutual exclusion, but breaking a stale lock can't be made ownership-safe with stat, unlink and
 * rename alone, there's no compare-and-swap on a filesystem this module may assume. A contender holding a dead lock's stat can move
 * a live successor's lock aside and two writers end up in the section together. The self-heal stays (a crashed `/cad-capture`
 * mustn't wedge the queue), so the guarantee moves onto the writer: verify after releasing, and if our bullet is gone, append it
 * again onto whatever won. The promise was never a perfect lock, it's that a concurrent write can't silently lose an append.
 */
const APPEND_ATTEMPTS = 4;

export function appendCapture(file, kind, text, phase) {
  const heading = CAPTURE_HEADINGS[kind];
  if (!heading) return { ok: false, reason: 'bad-kind', detail: `unknown capture kind: ${kind}` };
  const bullet = renderBullet(kind, text, phase);
  let created = false;
  for (let attempt = 1; attempt <= APPEND_ATTEMPTS; attempt++) {
    // spelled out rather than ReturnType<typeof withPlanningFileLock>: the helper is generic in its callback's return and
    // ReturnType erases the argument, so `value` would come back unknown
    /** @type {{ok: true, value: boolean} | {ok: false, reason: string, detail: string}} */
    let guarded;
    try {
      // before the lock, since the lock is a sibling of the target and the `--cadence` queue's directory may not exist yet
      if (!existsSync(file)) mkdirSync(dirname(file), { recursive: true });
      // the read is inside the lock with the write, or two writers read the same bytes, each append, and the second rename erases the first's
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

    // confirm after the lock is released: a read-back inside it passes for a writer whose bullet a second writer, let in by a
    // stale break, erases a moment later. It proves "we won at this instant", and after release measures the state the caller is told about
    const settled = read(file);
    if (settled !== null && settled.includes(bullet)) {
      return { ok: true, bullet, heading, created };
    }
  }
  return { ok: false, reason: 'write-lost',
    detail: `${file}: the bullet was overwritten by a concurrent writer on all`
      + ` ${APPEND_ATTEMPTS} attempts - nothing was captured, and the sentence is not in the queue` };
}
