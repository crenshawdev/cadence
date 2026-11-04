// @ts-check
// trace.mjs - the one writer and reader of `.planning/trace.jsonl`, the record of what a run did.
// The correlation id is derived from what's on disk, never minted: producers are one-shot processes with no
// shared state.
// Writes append, because a read-modify-write would lose events under parallel dispatch.
// It never throws or speaks on a stream, since a record of a decision can't change the decision.
// Token provenance: `--tokens` is whatever the host's return reported. Omit it when there's no figure, since 0
// claims a free dispatch.
// A missing figure is routine (built-in agents like `Explore` return none), so `unrecorded` means no number
// came back.
// Never estimate a figure or borrow another worker's: an absent number reads as absent, a wrong one doesn't.
'use strict';

import {
  appendFileSync, closeSync, existsSync, linkSync, lstatSync, openSync, readFileSync,
  readSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { sleep } from './text-util.mjs';

export const TRACE_FILE = 'trace.jsonl';

/** Fixed on purpose: a second rotation evicts it, so disk stays at twice `MAX_TRACE_BYTES`. Nothing reads it. */
export const ROTATED_TRACE_FILE = 'trace.1.jsonl';

/**
 * Derived from `ROTATED_TRACE_FILE`, with the `trace.` prefix `siblings()` in the trace tests filters on.
 * A separate file because the claim is a hard link, so the record's own mtime moves on every append.
 */
export const ROTATION_CLAIM_FILE = `${ROTATED_TRACE_FILE}.claim`;

/** At or over this, `renderTrace` reports `capped` so a full record isn't read as a complete one. */
export const MAX_TRACE_BYTES = 1048576;

/** A family outside this list is refused at the seam. */
export const FAMILIES = ['routing', 'provider', 'lifecycle', 'outcome'];

// exported so the trace tests' producer census reads the real vocabulary, not a copy that can go stale

export const DISPATCH = 'dispatch';

/** All three close a worker, or every escalated worker strands in `unpaired[]`. */
export const TERMINAL = ['return', 'checkpoint', 'escalation'];

export const ANCHOR = 'phase_start';

/** Only the hook can sum these, from the worker's transcript, so there's no `trace close` flag for them. */
const CACHE_KEYS = ['cache_creation_input_tokens', 'cache_read_input_tokens'];

/**
 * The larger value wins, per key: one writer (the hook) and a transcript that only grows, so the first read is
 * partial.
 * Never sum two reads, that double-bills the turns they share.
 * @param {Record<string, any>} into the row or map entry holding the figure
 * @param {Record<string, number>} from the figures that just arrived
 * @param {string} k
 * @returns {boolean}
 */
function moreComplete(into, from, k) {
  return k in from && (!(k in into) || from[k] > into[k]);
}

/**
 * Written by the coordinator at the start of a step. A lifecycle name, not a fifth family: `counts` is a fixed
 * four-key literal.
 * No `--role` or `--tokens` (a nameless worker row, and no return to read), so its cost is derived from the
 * step's wall span.
 */
export const COORDINATOR = 'coordinator';

/**
 * Carries a stopped worker's cache figures when no close can: `SubagentStop` withholds its `return` in three
 * cases.
 * Never add it to `TERMINAL`, it would open and close a bracket for a worker that never returned.
 */
export const WORKER_CACHE = 'worker_cache';

/** Written through 3.8 by the old module, kept so older traces still render. Never in `TERMINAL`. */
export const STEP_WINDOW = 'step_window';

/**
 * The last line of the record a rotation creates, so a reader can say a cut happened instead of inferring it.
 * It takes the carried anchor's `corr` and `phase`, so it files under the run that was cut. Never in
 * `TERMINAL`.
 */
export const ROTATION = 'record_rotated';

/** @param {string} planningRoot */
export function tracePath(planningRoot) {
  return join(planningRoot, TRACE_FILE);
}

/**
 * Derived from `ROTATED_TRACE_FILE` so the `.gitignore` rule names what the writer makes.
 * @param {string} planningRoot
 */
export function rotatedTracePath(planningRoot) {
  return join(planningRoot, ROTATED_TRACE_FILE);
}

/**
 * Same as `rotatedTracePath`, for the claim sidecar.
 * @param {string} planningRoot
 */
export function rotationClaimPath(planningRoot) {
  return join(planningRoot, ROTATION_CLAIM_FILE);
}

/**
 * `1` and `"1"` are the same worker, and a role-named one keys like a plan number.
 * @param {any} v
 */
function key(v) {
  return v === undefined || v === null ? '' : String(v);
}

/**
 * Every line of the trace file, or null when it can't be read. Absence is data here.
 * Capped at `MAX_TRACE_BYTES` because a synchronous read of a huge file would hang `/cad-progress --trace`.
 * It reads the head, not the tail: a cut head loses whole brackets, a cut tail only leaves the newest unpaired.
 * @param {string} planningRoot
 * @returns {string[]|null}
 */
function readLines(planningRoot) {
  const file = tracePath(planningRoot);
  try {
    if (statSync(file).size <= MAX_TRACE_BYTES) {
      return readFileSync(file, 'utf8').split('\n');
    }
  } catch {
    return null;
  }
  // over the cap: read the head and drop the last element, a partial line or an empty string
  try {
    const buf = Buffer.alloc(MAX_TRACE_BYTES);
    const fd = openSync(file, 'r');
    let read = 0;
    try { read = readSync(fd, buf, 0, MAX_TRACE_BYTES, 0); } finally { closeSync(fd); }
    const lines = buf.subarray(0, read).toString('utf8').split('\n');
    lines.pop();
    return lines;
  } catch {
    return null;
  }
}

/**
 * The per-phase correlation id, derived and never stored.
 * `ownSha` lets the anchor event derive its own id, or the first `phase_start` gets the bare form and the rest
 * the sha form.
 * @param {string} planningRoot
 * @param {any} phase
 * @param {string} [ownSha] the sha of the anchor event being written right now
 * @returns {string}
 */
export function correlationId(planningRoot, phase, ownSha) {
  const p = key(phase);
  if (typeof ownSha === 'string' && ownSha) return `${p}-${ownSha}`;
  const lines = readLines(planningRoot);
  if (lines === null) return p;
  // from the end: the newest anchor wins, so a re-run of a phase gets a new id
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
    if (e.family !== 'lifecycle' || e.event !== ANCHOR) continue;
    if (key(e.phase) !== p) continue;
    return typeof e.sha === 'string' && e.sha ? `${p}-${e.sha}` : p;
  }
  return p;
}

/**
 * One event, in the fixed key order `{corr, phase, ts, family, event, ...}`.
 * @param {string} planningRoot
 * @param {any} event
 * @returns {Record<string, any>}
 */
function renderEvent(planningRoot, event) {
  const { phase, family, event: name, corr, ts, ...rest } = event;
  const isAnchor = family === 'lifecycle' && name === ANCHOR;
  return {
    corr: typeof corr === 'string' && corr
      ? corr
      : correlationId(planningRoot, phase, isAnchor ? rest.sha : undefined),
    phase,
    ts: typeof ts === 'string' && ts ? ts : new Date().toISOString(),
    family,
    event: name,
    ...rest,
  };
}

/**
 * The marker a cut would write, and where the carried tail begins.
 * One builder for `freshRecord` and the size arm in `appendEvent`, so the reserve can't drift from what gets
 * written.
 * `carried_bytes` seals the generation: `rotateTrace` uses it to find bytes a late writer left in the old
 * inode.
 * @param {string} text the whole record a cut would carry away
 * @returns {{lines: string[], at: number, corr: string, marker: string}} `at` is the anchor line's index, or `-1` with no anchor (no tail).
 */
function rotationMarker(text) {
  const lines = text.split('\n');
  let at = -1;
  let anchorCorr = '';
  /** @type {any} */
  let anchorPhase;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
    if (e.family !== 'lifecycle' || e.event !== ANCHOR) continue;
    at = i;
    // the id the run was already writing, read off the anchor; re-deriving would answer about the post-cut file
    anchorCorr = typeof e.corr === 'string' && e.corr ? e.corr : key(e.phase);
    anchorPhase = e.phase;
    break;
  }
  // same key order as `renderEvent`; `phase` is undefined with no anchor and drops out of the JSON
  const marker = `${JSON.stringify({
    corr: anchorCorr,
    phase: anchorPhase,
    ts: new Date().toISOString(),
    family: 'lifecycle',
    event: ROTATION,
    file: ROTATED_TRACE_FILE,
    carried_bytes: Buffer.byteLength(text),
  })}\n`;
  return { lines, at, corr: anchorCorr, marker };
}

/**
 * The body of a rotation's fresh record: the newest `phase_start` line and everything after it, then the
 * marker.
 * Carrying the anchor matters: without it the run in flight derives `<phase>` while its dispatch half has
 * `<phase>-<sha>`, lookups miss, and the one-re-arm cap fails open.
 * Over the bound it drops post-anchor lines oldest-first, only ones under another `corr`; a line under the
 * anchor's own id is half a bracket.
 * If even that doesn't fit the tail is carried anyway. Refusing brings back write-death, and the next append
 * just rotates again.
 * @param {string} text the whole record being carried away
 * @param {number} reserve bytes the fresh file owes beyond this content
 * @returns {string}
 */
function freshRecord(text, reserve) {
  const { lines, at, corr: anchorCorr, marker } = rotationMarker(text);
  if (at < 0) return marker;
  const owed = reserve + Buffer.byteLength(marker);

  /** @type {{text: string, bytes: number, mine: boolean, dropped: boolean}[]} */
  const kept = [];
  let total = 0;
  for (let i = at; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // a line with no readable `corr` pairs with nothing, so dropping it can't change a bracket count
    let mine = true;
    if (i > at) {
      mine = false;
      try {
        const e = JSON.parse(line);
        mine = !!e && typeof e === 'object' && !Array.isArray(e) && key(e.corr) === anchorCorr;
      } catch { /* not this run's */ }
    }
    const bytes = Buffer.byteLength(line) + 1;
    kept.push({ text: line, bytes, mine, dropped: false });
    total += bytes;
  }

  for (let i = 1; i < kept.length && total + owed >= MAX_TRACE_BYTES; i++) {
    if (kept[i].mine) continue;
    kept[i].dropped = true;
    total -= kept[i].bytes;
  }
  const survivors = kept.filter((l) => !l.dropped).map((l) => l.text);
  return survivors.length ? `${survivors.join('\n')}\n${marker}` : marker;
}

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
 * `rotationInFlight`, only the sidecar's age differs.
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
 * Claim the record, swap in a fresh one carrying the run in flight, and hand the old one to
 * `ROTATED_TRACE_FILE`.
 * No lock: the `SubagentStop` hook writes through here and may not speak on the path a lock refusal would use.
 * The claim is `linkSync`, not `renameSync`: a rename silently replaces a finished rotation's generation,
 * `linkSync` fails `EEXIST`.
 * Never a read-modify-write: the fresh file is renamed in whole, so the live path is never absent.
 * @param {string} planningRoot
 * @param {number} reserve bytes the fresh file owes beyond the carried tail
 * Exported so a test can reach the losing arm, which `appendEvent` can't (it re-stats).
 * @returns {{rotated: boolean, reason?: string, shortfall?: number|null}}
 * `reason` only where the rotation failed outright; losing the claim is `{rotated:false}`. `shortfall` is the
 * bytes of the destroyed generation the rescue couldn't carry, `null` when unknown.
 */
export function rotateTrace(planningRoot, reserve) {
  const file = tracePath(planningRoot);
  const sibling = rotatedTracePath(planningRoot);
  const priv = `${process.pid}.${Math.random().toString(36).slice(2)}`;
  /** @type {string|null} */
  let temp = null;
  /** @type {string|null} */
  let evicted = null;
  // only for a leftover generation; an abandoned claim is the live inode, so rescuing it would re-append the
  // record to itself
  /** @type {string|null} */
  let leftover = null;
  const claim = rotationClaimPath(planningRoot);
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
  /** Only for arms that know the claim is ours to date; `mine` is what the confirm compares against. */
  const publish = () => {
    if (!pending) return;
    try { renameSync(pending, claim); dated = claim; mine = statSync(claim).mtimeMs; }
    catch { mine = null; /* fail live: no stamp reads as a live claim */ }
    pending = null;
  };
  try {
    let claimed = false;
    for (let attempt = 0; attempt < 2 && !claimed; attempt++) {
      // read the age before publishing: every publish overwrites the only evidence a killed claimant left
      let wasStale = false;
      try {
        wasStale = claimAbandoned(claim);
        // stamp private, publish only when the claim is ours. It has to exist before `linkSync`, or a third
        // process reads the dead claimant's age on our live claim and evicts it.
        // Writing straight to `claim` was the other bug: every losing append refreshed someone else's claim, so
        // an abandoned one never aged out.
        // Naming the stamp with `priv` fixes it, losers unlink a file nobody else sees. Only the link winner
        // and the evictor publish.
        // Plain overwrite, not `wx`: the retry after an eviction reuses `priv` and would throw on our own
        // leftover.
        // A failed sidecar write is swallowed: no sidecar reads as live, and throwing would send an unwritable
        // root down the no-hard-links fallback.
        pending = `${claim}.${priv}`;
        try { writeFileSync(pending, `${new Date().toISOString()}\n`); }
        catch { pending = null; /* fail live: no sidecar reads as a live claim */ }
        linkSync(file, sibling);
        claimed = true;
        held = true;
        // ours now, so publish the stamp. A third writer evicting on the stale age in the gap is caught by its
        // own confirm
        publish();
      } catch (e) {
        const code = e && /** @type {any} */ (e).code;
        if (code === 'ENOENT') return { rotated: false };
        if (code !== 'EEXIST') {
          // no hard links here, so fall back to the replacing rename and accept its window (the link is what closes it)
          try { renameSync(file, sibling); claimed = true; } catch { return { rotated: false }; }
          break;
        }
        // someone else holds the claim. Wait for their swap, because until then our append would land in the
        // old inode's sibling.
        // Not a lock: it acquires nothing and always proceeds when the budget runs out, far under the hook's 10
        // second timeout.
        // Unless the claim was abandoned: a killed claimant never runs its `finally`, so every append would pay
        // the full wait forever.
        // Shortening the wait doesn't help, only a completed rotation ends the state. The sidecar's age is
        // consulted only here.
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
        // evicting a leftover generation is the one destructive act here, so re-stat first and never rotate a
        // file we didn't see over the trigger.
        // Otherwise B (stale stat) carries away the fresh live file A just wrote and destroys A's generation.
        // `EEXIST` can't see it.
        let now = null;
        try { now = statSync(file).size; } catch { return { rotated: false }; }
        if (now + reserve < MAX_TRACE_BYTES) return { rotated: false };
        // publish here and nowhere else: we're evicting the claim this stamp dates, and the confirm reads this mtime
        publish();
        // evict single-winner: one contender renames it to a private path and the rest get `ENOENT`
        const path = `${sibling}.evict.${priv}`;
        try { renameSync(sibling, path); } catch { return { rotated: false }; }
        evicted = path;
        if (!abandoned) leftover = path;
        // confirm after claiming, on both eviction arms, before anything is read or written: a writer that
        // linked since the discriminator ran has its live claim renamed away, and breaking that costs the whole
        // record.
        // The leftover arm needs it too, its discriminator ran before the rename.
        // Put the sibling back only if nothing took the path meanwhile, and clear `evicted` so the release
        // can't delete a restored claim.
        let refreshed = false;
        try { refreshed = mine === null || statSync(claim).mtimeMs !== mine; } catch { refreshed = true; }
        if (refreshed) {
          try {
            if (!existsSync(sibling)) renameSync(path, sibling);
            else unlinkSync(path);
          } catch { /* it vanished under us, nothing to restore */ }
          evicted = null;
          leftover = null;
          return { rotated: false };
        }
      }
    }
    if (!claimed) return { rotated: false };

    // read after the claim: only then do we own the bytes we're judging
    let carried;
    try { carried = readFileSync(sibling, 'utf8'); } catch { carried = ''; }
    let seen = Buffer.byteLength(carried);

    temp = `${file}.rotate.${priv}`;
    writeFileSync(temp, freshRecord(carried, reserve), { flag: 'wx' });
    renameSync(temp, file);
    temp = null;
    held = false;

    // close the window: appends that landed in what is now the sibling between the claim and the swap are read
    // back into the fresh record.
    // A refused writer mustn't also lose its event, and a duplicate in a file nothing reads is free. Whole
    // lines only, bounded.
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
      try { appendFileSync(file, whole); } catch { break; }
      seen += whole.length;
    }

    // the second window, which the loop above can't reach: an append that lands in the old inode after rotation
    // 1 stopped carrying back lives only in the generation, and rotation 2 evicts it. So the writer about to
    // destroy a leftover generation finishes the carry-back.
    // It starts at the newest marker's `carried_bytes`. No seal (a generation from before the field) means no
    // rescue and `shortfall: null`, since guessing an offset risks re-appending a whole generation.
    // Unlike the loop above it skips lines already here: a duplicate in the live record changes what
    // `renderTrace` counts.
    // A failed rescue never throws or decides whether the rotation rotated, but it's stated: every failure arm
    // reports `shortfall`, `null` for an unknown amount.
    /** @type {number|null|undefined} */
    let shortfall;
    if (leftover) {
      /** @type {number|null} the offset rotation 1 sealed its generation at */
      let sealed = null;
      const prior = carried.split('\n');
      for (let i = prior.length - 1; i >= 0; i--) {
        const line = prior[i].trim();
        if (!line) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
        if (e.family !== 'lifecycle' || e.event !== ROTATION) continue;
        // newest marker decides; a non-numeric or negative seal is no seal, so a hand-edited line can't aim a read
        if (typeof e.carried_bytes === 'number' && Number.isFinite(e.carried_bytes)
          && e.carried_bytes >= 0) sealed = e.carried_bytes;
        break;
      }
      if (sealed !== null) {
        /** @type {number|null} */
        let beyond = null;
        try { beyond = Math.max(0, statSync(leftover).size - sealed); } catch { beyond = null; }
        if (beyond === null) shortfall = null;
        else if (beyond > 0) {
          let done = false;
          try {
            const buf = Buffer.alloc(beyond);
            const fd = openSync(leftover, 'r');
            let read = 0;
            try { read = readSync(fd, buf, 0, buf.length, sealed); } finally { closeSync(fd); }
            const delta = buf.subarray(0, read);
            const cut = delta.lastIndexOf(0x0a);
            if (cut >= 0) {
              const already = new Set(prior);
              const rescue = delta.subarray(0, cut + 1).toString('utf8')
                .split('\n').filter((l) => l && !already.has(l));
              if (rescue.length) appendFileSync(file, `${rescue.join('\n')}\n`);
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
    if (temp) { try { unlinkSync(temp); } catch { /* already gone */ } }
    if (held) { try { unlinkSync(sibling); } catch { /* already released */ } }
    // guarded by `held` like the release above: `held` goes false at the swap while we're still carrying back,
    // so an unconditional unlink would delete a second process's fresh sidecar.
    // A completed rotation leaves its sidecar behind on purpose; it's inert, the next claimant overwrites it,
    // and `.gitignore` keeps it out of commits.
    if (held && dated) { try { unlinkSync(dated); } catch { /* already released */ } }
    // a stamp this call never published is at a path only we can see. Always drop it, a losing append mustn't
    // refresh the shared sidecar
    if (pending) { try { unlinkSync(pending); } catch { /* already gone */ } }
    if (evicted) { try { unlinkSync(evicted); } catch { /* already gone */ } }
  }
}

/**
 * Append one event. Never throws or writes to a stream: a trace that can't be written must leave its caller's
 * envelope byte-identical.
 * A symlinked trace is refused with `reason:'symlinked-trace'`, the append would follow it out of the tree.
 * Size isn't a refusal: at `MAX_TRACE_BYTES` the record rotates and the append lands. What's left is
 * `oversized-event` (a single line that reaches the bound alone) and a failed rotation's code.
 * @param {string} planningRoot
 * @param {any} event `{phase, family, event, ...fields}`
 * @returns {{written: boolean, reason?: string, corr?: string}}
 */
export function appendEvent(planningRoot, event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { written: false, reason: 'bad-event' };
  }
  const file = tracePath(planningRoot);

  // `lstat` classifies the link itself, ahead of the size stat: a redirected trace is refused at any size
  try {
    if (lstatSync(file).isSymbolicLink()) return { written: false, reason: 'symlinked-trace' };
  } catch { /* ENOENT is the first write; the size stat reports the rest */ }

  // rendered first: the size arm fires when the file plus this line would reach the bound
  let line;
  let corr;
  try {
    const rendered = renderEvent(planningRoot, event);
    corr = rendered.corr;
    line = `${JSON.stringify(rendered)}\n`;
  } catch (e) {
    return { written: false, reason: (e && e.code) || 'unrenderable-event' };
  }
  const pending = Buffer.byteLength(line);

  // the bound is enforced before the write, and rotates instead of refusing: a record at the bound used to
  // refuse every writer forever.
  // Rotation lives here and nowhere else, since every writer reaches the record through this function.
  let size = null;
  try {
    size = statSync(file).size;
  } catch (e) {
    const code = e && e.code;
    if (code !== 'ENOENT') return { written: false, reason: code || 'stat-failed' };
  }
  if (size !== null && size + pending >= MAX_TRACE_BYTES) {
    // reserve the marker, not just the pending line: an event that fit alone but not beside the marker rotated
    // and landed a record over its bound.
    // Measured, never a constant: the marker embeds the anchor's `corr` and `phase`, and `phase` arrives
    // unvalidated.
    // Size arm only, the ordinary append must not gain a read.
    // A line that reaches the bound alone is refused, not rotated: rotating would throw the record away for an
    // event that still wouldn't fit.
    let owed = 0;
    try { owed = Buffer.byteLength(rotationMarker(readFileSync(file, 'utf8')).marker); }
    catch { /* unreadable here means the rotation will fail on its own */ }
    if (pending + owed >= MAX_TRACE_BYTES) return { written: false, reason: 'oversized-event' };
    const rot = rotateTrace(planningRoot, pending);
    // losing the claim isn't a failure, someone else made the room; only a failed rotation carries a reason
    if (rot.reason) return { written: false, reason: rot.reason };
  }

  try {
    appendFileSync(file, line);
  } catch (e) {
    return { written: false, reason: (e && e.code) || 'append-failed' };
  }
  return { written: true, corr };
}

/**
 * @typedef {object} CoordinatorResidue
 * @property {number} wall_ms the summed span of every step window
 * @property {number} bracket_ms how much of that span a worker bracket held
 * @property {number} residue_ms what is left: the coordinator's own time
 * @property {{phase: any, step: any, ts: any, residue_ms: number}[]} steps
 *   one row per marker, in time order
 */

/**
 * @typedef {object} TraceRender
 * @property {string} file the trace file's path
 * @property {string|null} corr the phase's derived id, or null with no `--phase`
 * @property {boolean} capped true when the file is at or over MAX_TRACE_BYTES
 * @property {{file: string, ts: any}} [rotated] present only where the record carries a rotation marker, so an unrotated record renders unchanged. It describes the record, not the `--phase` scope.
 * @property {{routing: number, provider: number, lifecycle: number, outcome: number}} counts
 * @property {number} malformed lines that did not parse as JSON
 * @property {Record<string, {dispatches: number, tokens?: number, turns?: number, unrecorded?: number, turns_unrecorded?: number}>} roles what each role's returns reported; `tokens` pairs with `unrecorded` and `turns` with `turns_unrecorded`, on separate counters.
 * @property {Record<string, any>[]} events
 * @property {{corr: any, phase: any, plan: any, role: string, event: any, ts: any, end: any, ms: number|null, tokens: number|null, turns?: number, duration_ms?: number, cache_creation_input_tokens?: number, cache_read_input_tokens?: number, agent_id?: string, effort?: string, rung?: string}[]} brackets every dispatch that paired, one row each, in terminal order. Exposed so callers don't re-derive the pairing and disagree.
 *   `ms` is dispatch-to-close wall clock; `duration_ms` is what the host reported for the worker's own run.
 *   Cache figures come from the hook (on the close or a `WORKER_CACHE` fact), the larger read wins, and they
 *   never reach `roles`.
 *   `effort` is what the worker's transcript says it ran at, `rung` what it was dispatched under. A `max`
 *   dispatch can run at `high` unannounced.
 *   On a `routing/resolve` event `effort` is the routed rung instead. Optional keys are omitted when absent so
 *   older records render unchanged.
 * @property {{corr: any, phase: any, plan: any, ts: any, role: string}[]} unpaired dispatches with no terminal; `role` is the dispatch's, and no `--role` keys the empty string so a forgotten flag stays visible
 * @property {{corr: any, phase: any, plan: any, ts: any, event: any, dispatched: string, closed: string}[]} mismatched paired brackets whose terminal named a role its dispatch did not
 * @property {CoordinatorResidue} [coordinator] present only when the scoped events carry a usable COORDINATOR marker
 */

/**
 * A timestamp as milliseconds, or null. An unreadable `ts` contributes nothing, since one NaN poisons every sum
 * it reaches.
 * @param {any} v
 * @returns {number|null}
 */
function millis(v) {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * Merged and in order. Merge before subtracting, or overlapping workers (normal on the parallel path) subtract
 * the same wall time twice.
 * @param {{a: number, b: number}[]} spans
 * @returns {{a: number, b: number}[]}
 */
function mergeSpans(spans) {
  const sorted = spans.slice().sort((x, y) => x.a - y.a);
  /** @type {{a: number, b: number}[]} */
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.a <= last.b) { if (s.b > last.b) last.b = s.b; } else out.push({ a: s.a, b: s.b });
  }
  return out;
}

/**
 * Read the trace in line order, group by family, and pair every worker bracket.
 * A dispatch is closed by the oldest later `return`, `checkpoint` or `escalation` with the same `(corr, phase,
 * plan)`. `plan` is the worker key, a plan number or a role name.
 * `corr` is in the key because a re-run starts a new id; without it the second run's terminal would close the
 * first run's stranded dispatch.
 * An absent file renders empty, never an error. `coordinator` is present only with a marker.
 * @param {string} planningRoot
 * @param {any} [phase] restrict to one phase
 * @returns {TraceRender}
 */
export function renderTrace(planningRoot, phase) {
  const file = tracePath(planningRoot);
  const wanted = phase === undefined || phase === null ? null : key(phase);
  /** @type {TraceRender} */
  const out = {
    file,
    // refined from the phase's newest anchor in pass 1; an unreadable record keeps the bare phase key
    corr: wanted,
    capped: false,
    counts: { routing: 0, provider: 0, lifecycle: 0, outcome: 0 },
    malformed: 0,
    roles: {},
    events: [],
    brackets: [],
    unpaired: [],
    mismatched: [],
  };

  // per-role accumulators beside `out.roles`: `recorded` only goes out as its complement, `unrecorded`.
  // `figures` alone gates the total, since gating on `recorded` would drop an unmatched terminal's real number.
  // Turns get their own triple: tokens and turns arrive independently and one counter would blur which one was
  // missing.
  /** @type {Map<string, {dispatches: number, tokens: number, recorded: number, figures: number, turns: number, turnsRecorded: number, turnsFigures: number}>} */
  const roleTotals = new Map();
  /** @param {string} k */
  const roleRow = (k) => {
    let row = roleTotals.get(k);
    if (!row) {
      row = {
        dispatches: 0, tokens: 0, recorded: 0, figures: 0,
        turns: 0, turnsRecorded: 0, turnsFigures: 0,
      };
      roleTotals.set(k, row);
    }
    return row;
  };

  // keyed by `corr`, never phase: a phase number isn't a run, and a phase-keyed rollup bills the gap between
  // two sessions as coordinator time.
  // `last` is the newest timestamp of any family under this `corr`, the only honest end for the final window. A
  // marker that is its run's last event gets a zero-length one.
  // No `corr` keys the empty string, like a missing `plan` does for the worker key.
  /** @type {Map<string, {markers: {phase: any, step: any, ts: any, t: number}[], spans: {a: number, b: number}[], last: number}>} */
  const coord = new Map();
  /** @param {any} c */
  const coordRow = (c) => {
    const k = key(c);
    let row = coord.get(k);
    if (!row) { row = { markers: [], spans: [], last: -Infinity }; coord.set(k, row); }
    return row;
  };

  try {
    out.capped = statSync(file).size >= MAX_TRACE_BYTES;
  } catch { /* absent or unreadable, the read below handles it */ }

  const lines = readLines(planningRoot);
  if (lines === null) return out;

  /** @type {any} the newest rotation marker in the record, or null for never */
  let rotated = null;
  /** @type {any} the requested phase's newest anchor, or null for none */
  let anchor = null;

  // pass 1: parse, scope, count. Accounting is pass 2 because the repair between them has to see later events
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { out.malformed++; continue; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) { out.malformed++; continue; }
    // before the phase filter: a rotation cut every phase's events, so this describes the record, like `capped`
    if (e.family === 'lifecycle' && e.event === ROTATION) rotated = e;
    if (wanted !== null && key(e.phase) !== wanted) continue;
    if (e.family === 'lifecycle' && e.event === ANCHOR) anchor = e;
    out.events.push(e);
    if (Object.prototype.hasOwnProperty.call(out.counts, e.family)) out.counts[e.family]++;
  }

  // named as this reader reaches the sibling, not as the marker spells it: a hand-edited `file` could say anything
  if (anchor && typeof anchor.sha === 'string' && anchor.sha) out.corr = `${wanted}-${anchor.sha}`;

  if (rotated) out.rotated = { file: rotatedTracePath(planningRoot), ts: rotated.ts };

  // pass 2: repair pre-anchor events at read time only. /cad-plan writes resolves before /cad-execute writes
  // the anchor, so one phase carries two ids.
  // A bare event goes to the first `phase_start` of its phase at or after it, forward where `correlationId`
  // scans back: a reader has the whole file, a writer doesn't.
  // Nothing is written back, so the file stays append-only. An event following a bare anchor keeps its id, or
  // the next run's terminal could fund a dispatch it never made (`anchoredBare`).
  /** @type {boolean[]} */
  const anchoredBare = new Array(out.events.length).fill(false);
  {
    /** @type {Map<string, boolean>} phase -> the most recent preceding anchor is bare */
    const lastAnchorBare = new Map();
    for (let i = 0; i < out.events.length; i++) {
      const e = out.events[i];
      const p = key(e.phase);
      if (e.family === 'lifecycle' && e.event === ANCHOR) {
        lastAnchorBare.set(p, !(typeof e.sha === 'string' && e.sha));
      } else if (lastAnchorBare.get(p)) {
        anchoredBare[i] = true;
      }
    }
  }
  /** @type {Map<string, string>} phase -> the id of the next anchor at or after here */
  const nextAnchor = new Map();
  for (let i = out.events.length - 1; i >= 0; i--) {
    const e = out.events[i];
    const p = key(e.phase);
    if (e.family === 'lifecycle' && e.event === ANCHOR) {
      // a sha-less anchor derives the bare form, so it still shadows later anchors for the events before it
      nextAnchor.set(p, typeof e.sha === 'string' && e.sha ? `${p}-${e.sha}` : p);
    } else if (!anchoredBare[i] && typeof e.corr === 'string' && e.corr === p && nextAnchor.has(p)) {
      e.corr = /** @type {string} */ (nextAnchor.get(p));
    }
  }

  // each pending entry carries `role` (a terminal bills the half that opened the worker) and `funded` (funded once)
  /** @type {Map<string, {corr: any, phase: any, plan: any, ts: any, role: string, funded: boolean, tokens: number|null, turnsFunded: boolean, turns: number|null}[]>} */
  const open = new Map();

  // every terminal's full identity, so a second copy funds nothing. With two dispatches open on one key the
  // FIFO `shift()` would hand a replay the second one.
  // Accepted cost: two distinct closes sharing key, event, role, tokens and millisecond look like a replay. The
  // exact fix is a per-dispatch id, a writer-contract change.
  // Terminals only, a duplicated dispatch inflates a count rather than funding a bracket.
  /** @type {Set<string>} */
  const seenTerminals = new Set();

  // the dedup, a different rule from the replay guard. The hook and a hand-written `trace close` can both close
  // one bracket, in either order, and never agree to the millisecond.
  // The first terminal to find a pending dispatch pairs and owns the row; a later one finding none is a repeat
  // close and only fills empty fields.
  // A terminal that never had a dispatch at all still bills its own role and opens no bracket.
  /** @type {Map<string, {row: any, entry: any}>} worker key -> the row it opened */
  const pairedRows = new Map();

  // cache-only facts, folded after the loop. Keyed `corr\0agent_id`, both terms: host ids repeat across
  // transcripts of one project.
  // Larger read wins per key. A transcript only grows, so ordering by size instead of arrival keeps a re-render
  // idempotent; summing would double-bill.
  // The two strings ride the same map and resolve fill-only-empty, since a rung name doesn't grow.
  /** @type {Map<string, Record<string, any>>} */
  const cacheFacts = new Map();
  // step-window facts, same key. The later line wins: a window doesn't grow like a cache sum
  /** @type {Map<string, number>} */
  const stepFacts = new Map();
  for (const e of out.events) {
    // every family feeds the run's end mark, or the clock stops early while routing and outcome events land
    const t = millis(e.ts);
    if (t !== null) {
      const row = coordRow(e.corr);
      if (t > row.last) row.last = t;
    }

    if (e.family !== 'lifecycle') continue;

    // kept out of the per-role chain: no `--role` here would render a nameless worker row
    if (e.event === COORDINATOR) {
      if (t !== null) coordRow(e.corr).markers.push({ phase: e.phase, step: e.step, ts: e.ts, t });
      continue;
    }

    // per-role accounting rides the pairing, not each event's `role`: the two halves are written separately and
    // can disagree. The dispatch opened the worker, so it's the authority.
    // No `--role` keys the empty string so a forgotten flag stays visible. A non-numeric `tokens` from a
    // hand-edited line contributes nothing.
    const tokens = typeof e.tokens === 'number' && Number.isFinite(e.tokens) ? e.tokens : null;
    // same guard for `turns`, same reason
    const turns = typeof e.turns === 'number' && Number.isFinite(e.turns) ? e.turns : null;
    // and for the host's wall clock: `"duration_ms": "1m 23s"` must not be concatenated onto a number callers sum
    const duration = typeof e.duration_ms === 'number' && Number.isFinite(e.duration_ms)
      ? e.duration_ms : null;
    // and the cache figures, collected as only the keys that passed so omit-when-absent is a spread
    /** @type {Record<string, number>} */
    const cache = {};
    for (const k of CACHE_KEYS) {
      if (typeof e[k] === 'number' && Number.isFinite(e[k])) cache[k] = e[k];
    }

    // the two strings the hook writes: what the transcript says it ran at, and the rung it was dispatched
    // under. Anything but a non-empty string contributes nothing.
    // Not checked against the rung enum: that's what a user may ask for, this is what the host served, and a
    // renamed host rung is the signal.
    const effort = typeof e.effort === 'string' && e.effort ? e.effort : null;
    const rung = typeof e.rung === 'string' && e.rung ? e.rung : null;

    // the cache-only fact, folded after the loop: the host fires `SubagentStop` when the worker stops, the
    // orchestrator writes the `--agent-id` close later, so the fact usually arrives first.
    // A fact with no id can never reach a bracket, and one reporting nothing has nothing to give. An effort
    // counts as something, or the one observation of a silent downgrade gets dropped.
    if (e.event === WORKER_CACHE) {
      if (typeof e.agent_id === 'string' && e.agent_id
        && (CACHE_KEYS.some((k) => k in cache) || effort !== null || rung !== null)) {
        const pair = `${key(e.corr)}\0${e.agent_id}`;
        const prior = cacheFacts.get(pair);
        if (!prior) {
          cacheFacts.set(pair, {
            ...cache,
            ...(effort !== null ? { effort } : {}),
            ...(rung !== null ? { rung } : {}),
          });
        } else {
          for (const k of CACHE_KEYS) if (moreComplete(prior, cache, k)) prior[k] = cache[k];
          // fill-only-empty for the two strings, not the larger-wins the figures use
          if (!('effort' in prior) && effort !== null) prior.effort = effort;
          if (!('rung' in prior) && rung !== null) prior.rung = rung;
        }
      }
      continue;
    }

    // the step-window fact, folded after the loop for the same reason. Only traces from before 3.9.0 hold one
    if (e.event === STEP_WINDOW) {
      if (typeof e.agent_id === 'string' && e.agent_id
        && Number.isInteger(e.tokens) && e.tokens >= 0) {
        stepFacts.set(`${key(e.corr)}\0${e.agent_id}`, e.tokens);
      }
      continue;
    }

    const worker = `${key(e.corr)}\0${key(e.phase)}\0${key(e.plan)}`;
    if (e.event === DISPATCH) {
      const role = key(e.role);
      const row = roleRow(role);
      row.dispatches++;
      // a figure on the open half is unusual but counted, and it marks this dispatch funded
      const entry = {
        corr: e.corr, phase: e.phase, plan: e.plan, ts: e.ts, role,
        funded: false, tokens: null, turnsFunded: false, turns: null,
      };
      if (tokens !== null) { row.tokens += tokens; row.recorded++; row.figures++; entry.funded = true; entry.tokens = tokens; }
      // funded separately from the token half, so a dispatch funded by tokens can still record its turns
      if (turns !== null) {
        row.turns += turns; row.turnsRecorded++; row.turnsFigures++;
        entry.turnsFunded = true; entry.turns = turns;
      }
      const pending = open.get(worker) || [];
      pending.push(entry);
      open.set(worker, pending);
    } else if (TERMINAL.includes(e.event)) {
      // a byte-identical repeat of a terminal is a replay: it pairs with nothing and funds nothing, though it
      // stays in `out.events` and `counts`.
      // A close differing only in `role` isn't a replay, it shows in `mismatched`. Closes differing in turns
      // are two closes.
      const identity = `${worker}\0${e.event}\0${key(e.role)}\0${key(e.ts)}\0${tokens === null ? '' : tokens}\0${turns === null ? '' : turns}`;
      if (seenTerminals.has(identity)) continue;
      seenTerminals.add(identity);

      const pending = open.get(worker);
      // the delayed repeat: a close that lands after the next dispatch of its key would be handed that dispatch
      // by FIFO (the steal), and its tell is a negative `ms`.
      // Reachable because the hook fires when the host decides, so a retried plan can see the first attempt's
      // close land after the second attempt's dispatch. The stolen row is funded, so the role is billed three
      // times.
      // Narrow on purpose: both clocks parse, the terminal is strictly earlier than the head dispatch, and
      // `pairedRows` has a row. Otherwise FIFO stands, an unreadable clock never reclassifies a close.
      const head = pending && pending.length ? pending[0] : null;
      const headT = head ? millis(head.ts) : null;
      const delayedRepeat = head !== null && t !== null && headT !== null
        && t < headT && pairedRows.has(worker);
      let matched = head && !delayedRepeat ? pending.shift() : null;
      // a repeat close: nothing open on this key but it already opened a row, so this is the second writer on
      // the same bracket.
      // It adopts that entry so `funded` and `turnsFunded` bill the dispatch once.
      const repeat = matched ? null : pairedRows.get(worker);
      if (repeat) matched = repeat.entry;
      // a bracket adds to the residue only once paired: an unpaired dispatch has no known end, and inventing
      // one hides the gap
      if (matched && !repeat) {
        const a = millis(matched.ts);
        if (a !== null && t !== null && t > a) coordRow(e.corr).spans.push({ a, b: t });
        // bracket row: `ms` is null, not 0, when a timestamp is unreadable; `tokens` prefers the terminal's figure
        const bracketRow = {
          corr: e.corr, phase: e.phase, plan: e.plan, role: matched.role,
          event: e.event, ts: matched.ts, end: e.ts,
          ms: a !== null && t !== null ? t - a : null,
          tokens: tokens !== null ? tokens : matched.tokens,
          // `turns` is omitted, not null: a null would add a new key to every bracket of every older trace
          ...(turns !== null || matched.turns !== null
            ? { turns: turns !== null ? turns : matched.turns }
            : {}),
          // omitted likewise, from the terminal alone (`--duration-ms` is only on the close). Not derived: `ms`
          // measures the step
          ...(duration !== null ? { duration_ms: duration } : {}),
          // cache figures: omitted likewise, from the terminal alone, and they ride this row and go nowhere else
          ...cache,
          // what it ran at and was dispatched under, from the terminal alone, omitted independently so older
          // records render unchanged
          ...(effort !== null ? { effort } : {}),
          ...(rung !== null ? { rung } : {}),
          // the worker's host id, from the terminal alone; the hook reads it to spot an already-closed bracket
          ...(e.agent_id ? { agent_id: e.agent_id } : {}),
        };
        out.brackets.push(bracketRow);
        // the row this key owns now, so a second close folds in; a later real pairing overwrites it
        pairedRows.set(worker, { row: bracketRow, entry: matched });
        // reported, never billed: the dispatch stays the authority, but two halves naming different roles is a
        // prose defect worth surfacing.
        // A terminal with no role isn't a mismatch, that would false-alarm on every historical bracket.
        const closed = key(e.role);
        if (closed && closed !== matched.role) {
          out.mismatched.push({
            corr: e.corr, phase: e.phase, plan: e.plan, ts: e.ts, event: e.event,
            dispatched: matched.role, closed,
          });
        }
      } else if (repeat) {
        // the fold: each figure fills a field the row left empty and never overwrites the first writer's
        const b = repeat.row;
        if (b.tokens === null && tokens !== null) b.tokens = tokens;
        if (!('turns' in b) && turns !== null) b.turns = turns;
        if (!('duration_ms' in b) && duration !== null) b.duration_ms = duration;
        // larger read wins for the cache figures alone (see `moreComplete`): the hook is their only writer, so
        // two values are two reads of one growing transcript
        for (const k of CACHE_KEYS) if (moreComplete(b, cache, k)) b[k] = cache[k];
        // back to fill-only-empty for the strings: `moreComplete` compares with `>`, meaningless for an enum,
        // and a rung doesn't grow
        if (!('effort' in b) && effort !== null) b.effort = effort;
        if (!('rung' in b) && rung !== null) b.rung = rung;
        // identity folds fill-only-empty too: the hook's close usually opens the row, so an id on the
        // hand-written close would otherwise be dropped
        if (!('agent_id' in b) && e.agent_id) b.agent_id = e.agent_id;
        // the span isn't fill-only-empty, since `end` is never empty and that would freeze it at the first
        // close. `ms` is dispatch-to-close, so the later close ends it.
        // Monotonic: a delayed repeat close mustn't shrink a span that already closed later.
        const a2 = millis(repeat.entry.ts);
        if (t !== null && (millis(b.end) === null || t > millis(b.end))) {
          b.end = e.ts;
          b.ms = a2 !== null ? t - a2 : null;
          // the coordinator span extends with it, or `residue_ms` bills the coordinator for time a worker held
          if (a2 !== null && t > a2) coordRow(e.corr).spans.push({ a: a2, b: t });
        }
        // upgrade one way only: a figureless writer that ran first would otherwise turn every checkpoint into a
        // clean `return`
        if (b.event === 'return' && e.event !== 'return') b.event = e.event;
        // no `mismatched` row, that's the pairing's to report
      }
      if (tokens !== null) {
        // bill the dispatch's role. An unmatched terminal falls back to its own, but funds no dispatch so
        // `unrecorded` can't go negative.
        const row = roleRow(matched ? matched.role : key(e.role));
        row.tokens += tokens;
        row.figures++;
        // `recorded` counts funded dispatches, not token-bearing events, or a replay could hide an unrecorded worker
        if (matched && !matched.funded) { row.recorded++; matched.funded = true; }
      }
      if (turns !== null) {
        // same authority and fallback as the token half
        const row = roleRow(matched ? matched.role : key(e.role));
        row.turns += turns;
        row.turnsFigures++;
        if (matched && !matched.turnsFunded) { row.turnsRecorded++; matched.turnsFunded = true; }
      }
    }
  }
  // the post-pass fold. Every bracket is built by now, so a fact that arrived first still finds the row its
  // `agent_id` names.
  // Row only, not `roleTotals`, `seenTerminals` or `pairedRows`: a cache sum isn't denominated like a return's
  // tokens, and `roles` stays byte-identical with or without facts.
  // Two brackets sharing an `agent_id` under one `corr` get only the first, or one worker's traffic bills
  // twice.
  // Each field folds by the rule it uses on a repeat close, so the two can't drift: cache figures take the
  // larger read, the strings fill only empty.
  for (const [pair, fact] of cacheFacts) {
    for (const b of out.brackets) {
      if (!b.agent_id || `${key(b.corr)}\0${b.agent_id}` !== pair) continue;
      for (const k of CACHE_KEYS) if (moreComplete(b, fact, k)) b[k] = fact[k];
      if (!('effort' in b) && 'effort' in fact) b.effort = fact.effort;
      if (!('rung' in b) && 'rung' in fact) b.rung = fact.rung;
      break;
    }
  }

  // the step-window fold: the first bracket under that `corr` and `agent_id` with a null `tokens` gets the
  // figure, a return's own always wins.
  // Row only, so a figureless return stays out of the spend.
  for (const [pair, tokens] of stepFacts) {
    const b = out.brackets.find((r) => r.agent_id && r.tokens === null
      && `${key(r.corr)}\0${r.agent_id}` === pair);
    if (b) b.tokens = tokens;
  }

  for (const pending of open.values()) {
    for (const p of pending) {
      out.unpaired.push({ corr: p.corr, phase: p.phase, plan: p.plan, ts: p.ts, role: p.role });
    }
  }

  // the token total is omitted when nothing was recorded, so a role never shows a zero it didn't spend.
  // `unrecorded` is omitted at zero.
  // Built with `Object.fromEntries`: role names come from the file, and assigning `__proto__` hits the
  // prototype setter and erases the row. `Object.create(null)` would change the prototype callers expect.
  // Both turn keys are gated on `turnsFigures`, unlike the token pair: a `turns_unrecorded` on every role would
  // add a key to every older trace, and the verbatim fixture pins `roles` byte-for-byte.
  /** @type {[string, {dispatches: number, tokens?: number, turns?: number, unrecorded?: number, turns_unrecorded?: number}][]} */
  const rows = [];
  for (const [role, row] of roleTotals) {
    const unrecorded = Math.max(0, row.dispatches - row.recorded);
    const turnsUnrecorded = Math.max(0, row.dispatches - row.turnsRecorded);
    rows.push([role, {
      dispatches: row.dispatches,
      ...(row.figures ? { tokens: row.tokens } : {}),
      ...(row.turnsFigures ? { turns: row.turns } : {}),
      ...(unrecorded ? { unrecorded } : {}),
      ...(row.turnsFigures && turnsUnrecorded ? { turns_unrecorded: turnsUnrecorded } : {}),
    }]);
  }
  out.roles = Object.fromEntries(rows);

  // the coordinator's time is computed once so `/cad-report` and `trace suggest` can't report different numbers
  // for one run.
  // A step's window runs from its marker to the next one in the same run, the last ending at that run's own
  // last event, never at a later run sharing the phase number.
  // Bracket spans clipped to the window are subtracted. Floored at zero: a bracket straddling two markers can
  // exceed a window.
  /** @type {{phase: any, step: any, ts: any, t: number, residue_ms: number}[]} */
  const stepRows = [];
  let wallMs = 0;
  let bracketMs = 0;
  let residueMs = 0;
  for (const row of coord.values()) {
    if (!row.markers.length) continue;
    row.markers.sort((x, y) => x.t - y.t);
    const merged = mergeSpans(row.spans);
    for (let i = 0; i < row.markers.length; i++) {
      const m = row.markers[i];
      const end = i + 1 < row.markers.length ? row.markers[i + 1].t : row.last;
      const wall = Math.max(0, end - m.t);
      let bracket = 0;
      for (const s of merged) {
        const lo = Math.max(s.a, m.t);
        const hi = Math.min(s.b, m.t + wall);
        if (hi > lo) bracket += hi - lo;
      }
      const residue = Math.max(0, wall - bracket);
      stepRows.push({ phase: m.phase, step: m.step, ts: m.ts, t: m.t, residue_ms: residue });
      wallMs += wall;
      bracketMs += bracket;
      residueMs += residue;
    }
  }
  if (stepRows.length) {
    stepRows.sort((x, y) => x.t - y.t);
    out.coordinator = {
      wall_ms: wallMs,
      bracket_ms: bracketMs,
      residue_ms: residueMs,
      steps: stepRows.map(({ phase: p, step, ts, residue_ms }) => ({ phase: p, step, ts, residue_ms })),
    };
  }
  return out;
}
