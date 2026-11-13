// @ts-check
// jsonl-rotation.mjs - the claim, evict, confirm, swap, release and rescue that trace.jsonl and reads.jsonl share.
// Each log passes in what differs: its paths, its bound, its fresh record and how it reads a seal.
// Imports neither log, so both can import it. No lock: a hook can't speak on the path a refusal would use.
'use strict';

import {
  closeSync, existsSync, openSync, readFileSync, readSync, statSync,
} from 'node:fs';
import { sleep } from './text-util.mjs';
import { appendFile, linkFile, movePath, unlinkFile, writeFile, writeFileNew } from './planning-store.mjs';

/** The event both logs name their rotation marker with. One spelling, so the two markers can't drift. */
export const ROTATION_EVENT = 'record_rotated';

/** A ceiling in ms, not a deadline. It only matters when the winner died holding the claim. */
const ROTATE_WAIT_MS = 250;

/**
 * How old a claim's sidecar must be before the claim reads as abandoned. A constant, not a config key.
 * About 4,600x the slowest rotation measured, so a live claim never gets near it. It also caps the degraded
 * cost: roughly 252 ms an append until the claim ages out.
 */
const CLAIM_STALE_MS = 30_000;

/**
 * Is the sibling a rotation in flight (same inode as the live path) or a leftover generation?
 * Evicting a live claim loses a writer its swap; calling a stale generation live means the record never rotates
 * again.
 * Unknowable reads as in flight, the answer that never evicts. It costs a deferred rotation; the append still
 * lands.
 * @param {string} file @param {string} sibling
 */
function rotationInFlight(file, sibling) {
  try {
    const a = statSync(file);
    const b = statSync(sibling);
    if (!a.ino || !b.ino) return true;
    return a.ino === b.ino && a.dev === b.dev;
  } catch {
    return true;
  }
}

/**
 * Has the in-flight claim been abandoned by a killed process? A live claim and a dead one look the same to
 * `rotationInFlight` (the claim is a hard link, so appends keep bumping the inode's times), only the sidecar's age
 * differs.
 * Unknowable reads as live: a wrong "live" costs one deferred rotation, a wrong "abandoned" costs the whole
 * record.
 * @param {string} claim
 */
function claimAbandoned(claim) {
  try {
    return Date.now() - statSync(claim).mtimeMs > CLAIM_STALE_MS;
  } catch {
    return false;
  }
}

/**
 * What one log tells the rotation about itself.
 * @typedef {object} RotationSpec
 * @property {string} file the live record
 * @property {string} sibling the one generation kept beside it; the hard link is the claim
 * @property {string} claim the sidecar whose mtime dates the claim
 * @property {number} max the record's byte bound
 * @property {boolean} carry the trace's way: read the generation after the claim, carry back appends that landed
 *   before the swap, and skip rescued lines the record holds. False is the reads way: a bare marker sealed with
 *   the size at the claim, and the raw delta rescued.
 * @property {boolean} renameFallback with no hard links, take the replacing rename and its window, not a refusal
 * @property {(from: {carried: string|null, sealed: number|null, reserve: number}) => string} fresh the fresh record
 * @property {(sibling: string, carried: string|null) => number|null} sealOf the offset the earlier cut sealed its
 *   generation at, or null: a guessed offset re-appends a whole generation
 */

/**
 * Claim the record, swap in a fresh one and hand the old one to `spec.sibling`.
 * The claim is `linkSync`, not `renameSync`: a rename silently replaces a finished rotation's generation.
 * @param {RotationSpec} spec
 * @param {number} reserve bytes the fresh file owes beyond what it carries
 * @returns {{rotated: boolean, reason?: string, shortfall?: number|null}}
 * `reason` only where the rotation failed outright; losing the claim is `{rotated:false}`. `shortfall` is the
 * bytes the rescue couldn't carry from the destroyed generation, `null` when unknown.
 */
export function rotateJsonl(spec, reserve) {
  const { file, sibling, claim, max } = spec;
  const priv = `${process.pid}.${Math.random().toString(36).slice(2)}`;
  /** @type {string|null} */
  let temp = null;
  /** @type {string|null} */
  let evicted = null;
  // only for a leftover generation; an abandoned claim is the live inode, so rescuing it would re-append the
  // record to itself
  /** @type {string|null} */
  let leftover = null;
  /** @type {string|null} */
  let dated = null;
  // the mtime we stamped on the sidecar, so the confirm can tell our write from another claimant's refresh
  /** @type {number|null} */
  let mine = null;
  // held from the link until the swap; every failure arm must release it or the record never rotates again
  let held = false;
  // our stamp at its private path until the link says the claim is ours; cleared once renamed in
  /** @type {string|null} */
  let pending = null;
  // the live record's size at the claim, null when unreadable
  /** @type {number|null} */
  let sealed = null;
  /** Only for arms that know the claim is ours to date; `mine` is what the confirm compares against. */
  const publish = () => {
    if (!pending) return;
    try { movePath(pending, claim); dated = claim; mine = statSync(claim).mtimeMs; }
    catch { mine = null; /* fail live: no stamp reads as a live claim */ }
    pending = null;
  };
  try {
    let claimed = false;
    // two attempts, never a loop: claim, or evict one leftover generation (or abandoned claim) and claim once more
    for (let attempt = 0; attempt < 2 && !claimed; attempt++) {
      // read the age before publishing: every publish overwrites the only evidence a killed claimant left
      let wasStale = false;
      try {
        wasStale = claimAbandoned(claim);
        // stamp private before `linkSync`, or a third process evicts our live claim on the dead claimant's age;
        // publish only when the claim is ours. Writing straight to `claim` let every losing append refresh someone
        // else's, so an abandoned one never aged out.
        // plain overwrite, not `wx`: the retry after an eviction reuses `priv`
        // a failed write is swallowed: no sidecar reads as live, and throwing would send an unwritable root down
        // the no-hard-links fallback
        pending = `${claim}.${priv}`;
        try { writeFile(pending, `${new Date().toISOString()}\n`); }
        catch { pending = null; /* fail live: no sidecar reads as a live claim */ }
        // seal before the link, or a late writer's bytes fold into carried_bytes and never get rescued
        try { sealed = statSync(file).size; } catch { sealed = null; }
        linkFile(file, sibling);
        claimed = true;
        held = true;
        // ours now, so publish the stamp. A third writer evicting on the stale age in the gap is caught by its
        // own confirm
        publish();
      } catch (e) {
        const code = e && /** @type {any} */ (e).code;
        // nothing to rotate; the caller's append creates the file
        if (code === 'ENOENT') return { rotated: false };
        if (code !== 'EEXIST') {
          if (!spec.renameFallback) return { rotated: false, reason: code || 'claim-failed' };
          // no hard links here, so fall back to the replacing rename and accept its window (the link is what closes it)
          try { movePath(file, sibling); claimed = true; } catch { return { rotated: false }; }
          break;
        }
        // someone else holds the claim. Wait for their swap, or our append lands in the old inode's sibling.
        // Not a lock: it acquires nothing and always proceeds when the budget runs out, far under the hook's
        // timeout.
        // Unless the claim was abandoned: a killed claimant never runs its `finally`, so every append would pay
        // the full wait forever, and only a completed rotation ends that.
        let abandoned = false;
        if (attempt > 0 || rotationInFlight(file, sibling)) {
          abandoned = attempt === 0 && wasStale;
          if (!abandoned) {
            for (let waited = 0; waited < ROTATE_WAIT_MS && rotationInFlight(file, sibling); waited++) {
              sleep(1);
            }
            return { rotated: false };
          }
        }
        // evicting a leftover generation is the one destructive act here, so re-stat first: a stale stat carries
        // away the fresh live file another writer just made and destroys its generation. `EEXIST` can't see it.
        let now = null;
        try { now = statSync(file).size; } catch { return { rotated: false }; }
        if (now + reserve < max) return { rotated: false };
        // publish here and nowhere else: we're evicting the claim this stamp dates, and the confirm reads this mtime
        publish();
        // evict single-winner: one contender renames it to a private path and the rest get `ENOENT`
        const path = `${sibling}.evict.${priv}`;
        try { movePath(sibling, path); } catch { return { rotated: false }; }
        evicted = path;
        if (!abandoned) leftover = path;
        // confirm after claiming, on both eviction arms, before anything is read or written: a writer that
        // linked since the discriminator ran has its live claim renamed away, and breaking that costs the whole
        // record.
        // Put the sibling back only if nothing took the path meanwhile, and clear `evicted` so the release
        // can't delete a restored claim.
        let refreshed = false;
        try { refreshed = mine === null || statSync(claim).mtimeMs !== mine; } catch { refreshed = true; }
        if (refreshed) {
          try {
            if (!existsSync(sibling)) movePath(path, sibling);
            else unlinkFile(path);
          } catch { /* it vanished under us, nothing to restore */ }
          evicted = null;
          leftover = null;
          return { rotated: false };
        }
      }
    }
    if (!claimed) return { rotated: false };

    // read after the claim: only then do we own the bytes we're judging
    /** @type {string|null} */
    let carried = null;
    if (spec.carry) {
      try { carried = readFileSync(sibling, 'utf8'); } catch { carried = ''; }
    }
    // the fresh record goes to a private path (exclusive create) and is renamed over the live one
    temp = `${file}.rotate.${priv}`;
    writeFileNew(temp, spec.fresh({ carried, sealed, reserve }));
    movePath(temp, file);
    temp = null;
    held = false;

    // close the window: appends that landed in what is now the sibling between the claim and the swap are read
    // back into the fresh record. A refused writer mustn't also lose its event. Whole lines only, bounded.
    if (carried !== null) {
      let seen = Buffer.byteLength(carried);
      for (let pass = 0; pass < 4; pass++) {
        let grown = 0;
        try { grown = statSync(sibling).size; } catch { break; }
        if (grown <= seen) break;
        /** @type {Buffer} */
        let delta;
        try {
          const buf = Buffer.alloc(grown - seen);
          const fd = openSync(sibling, 'r');
          let read = 0;
          try { read = readSync(fd, buf, 0, buf.length, seen); } finally { closeSync(fd); }
          delta = buf.subarray(0, read);
        } catch { break; }
        const cut = delta.lastIndexOf(0x0a);
        if (cut < 0) break;
        const whole = delta.subarray(0, cut + 1);
        try { appendFile(file, whole); } catch { break; }
        seen += whole.length;
      }
    }

    // rescue: an append landing in the old inode after the earlier cut stopped carrying back lives only in that
    // generation, and evicting it loses them, so the evictor finishes the job from the earlier cut's seal
    // no seal, no rescue, `shortfall: null`: re-appending a whole generation is worse than losing it
    // a carrying log skips lines already here, or a render would count a duplicate; whole lines only, so a torn
    // tail is dropped
    // a failed rescue never throws or decides whether the rotation rotated, but every failure arm reports `shortfall`
    /** @type {number|null|undefined} */
    let shortfall;
    if (leftover) {
      const at = spec.sealOf(sibling, carried);
      if (at !== null) {
        /** @type {number|null} */
        let beyond = null;
        try { beyond = Math.max(0, statSync(leftover).size - at); } catch { beyond = null; }
        if (beyond === null) shortfall = null;
        else if (beyond > 0) {
          let done = false;
          try {
            const buf = Buffer.alloc(beyond);
            const fd = openSync(leftover, 'r');
            let read = 0;
            try { read = readSync(fd, buf, 0, buf.length, at); } finally { closeSync(fd); }
            const delta = buf.subarray(0, read);
            const cut = delta.lastIndexOf(0x0a);
            if (cut >= 0) {
              const whole = delta.subarray(0, cut + 1);
              if (carried === null) appendFile(file, whole);
              else {
                const already = new Set(carried.split('\n'));
                const rescue = whole.toString('utf8').split('\n').filter((l) => l && !already.has(l));
                if (rescue.length) appendFile(file, `${rescue.join('\n')}\n`);
              }
              done = true;
            }
          } catch { /* stated on `shortfall`, never thrown and never a `reason` */ }
          if (!done) shortfall = beyond;
        }
      } else shortfall = null;
    }
    // rescued lines that leave the record over the bound are carried anyway; the next append rotates again
    return shortfall === undefined ? { rotated: true } : { rotated: true, shortfall };
  } catch (e) {
    return { rotated: false, reason: (e && /** @type {any} */ (e).code) || 'rotate-failed' };
  } finally {
    // leave nothing behind on any arm
    if (temp) { try { unlinkFile(temp); } catch { /* already gone */ } }
    if (held) { try { unlinkFile(sibling); } catch { /* already released */ } }
    // guarded by `held`: it goes false at the swap, and unlinking later would delete the next claimant's sidecar.
    // A completed rotation leaves its sidecar behind on purpose; it's inert and `.gitignore` keeps it out of commits.
    if (held && dated) { try { unlinkFile(dated); } catch { /* already released */ } }
    // a stamp this call never published is at a path only we can see. Always drop it, a losing append mustn't
    // refresh the shared sidecar
    if (pending) { try { unlinkFile(pending); } catch { /* already gone */ } }
    if (evicted) { try { unlinkFile(evicted); } catch { /* already gone */ } }
  }
}
