// @ts-check
// trace.mjs - the one writer and reader of `.planning/records/trace.jsonl`, the record of what a run did.
// The correlation id is derived from disk, never minted: producers are one-shot processes with no state.
// Writes append, because a read-modify-write would lose events under parallel dispatch.
// It never throws or speaks on a stream, since a record of a decision can't change the decision.
// `--tokens` is what the host reported; omit it with no figure, since 0 claims a free dispatch (`unrecorded`).
// Never estimate a figure or borrow another worker's: an absent number reads as absent, a wrong one doesn't.
'use strict';

import {
  closeSync, lstatSync, openSync, readFileSync, readSync, statSync,
} from 'node:fs';
import { appendFile, recordsPath } from './planning-store.mjs';
import { ROTATION_EVENT, rotateJsonl } from './jsonl-rotation.mjs';
import { recordsReady } from './project-state.mjs';

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
 * Fold what one line reports into a row or fact that may already hold some of it. The cache figures take the larger
 * read; the two strings fill only an empty slot, since `moreComplete` compares with `>`, meaningless for an enum,
 * and a rung doesn't grow.
 * The fact map, a repeat close and the post-pass all fold through here, so the rule can't drift between them.
 * @param {Record<string, any>} into
 * @param {Record<string, any>} from the figure keys and `effort` / `rung` the line carried, each only when present
 */
function foldFigures(into, from) {
  for (const k of CACHE_KEYS) if (moreComplete(into, from, k)) into[k] = from[k];
  for (const k of ['effort', 'rung']) if (!(k in into) && k in from) into[k] = from[k];
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
export const ROTATION = ROTATION_EVENT;

/**
 * A lifecycle event with no `phase` that marks a cycle boundary: a phase-scoped read and `correlationId` both start
 * after the newest one, so this cycle's phase 1 isn't summed with the last cycle's. A record without one reads as
 * one span.
 */
export const CYCLE = 'cycle_boundary';

/** @param {string} planningRoot */
export function tracePath(planningRoot) {
  return recordsPath(planningRoot, TRACE_FILE);
}

/**
 * Derived from `ROTATED_TRACE_FILE` so the `.gitignore` rule names what the writer makes.
 * @param {string} planningRoot
 */
export function rotatedTracePath(planningRoot) {
  return recordsPath(planningRoot, ROTATED_TRACE_FILE);
}

/**
 * Same as `rotatedTracePath`, for the claim sidecar.
 * @param {string} planningRoot
 */
export function rotationClaimPath(planningRoot) {
  return recordsPath(planningRoot, ROTATION_CLAIM_FILE);
}

/**
 * `1` and `"1"` are the same worker, and a role-named one keys like a plan number.
 * @param {any} v
 */
export function key(v) {
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
 * The newest `lifecycle` event called `name` that `want` accepts, and its line index, or null. Walks backwards, a line
 * that isn't a JSON object is skipped. A `lifecycle` event called `stop` ends the walk with null.
 * @param {string[]} lines
 * @param {string} name
 * @param {(e: any) => boolean} [want]
 * @param {string} [stop]
 * @returns {{e: any, at: number}|null}
 */
function newestLifecycle(lines, name, want, stop) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
    if (stop !== undefined && e.family === 'lifecycle' && e.event === stop) return null;
    if (e.family !== 'lifecycle' || e.event !== name) continue;
    if (want && !want(e)) continue;
    return { e, at: i };
  }
  return null;
}

/**
 * True when the record's newest `CYCLE` marker has no event carrying a `phase` after it, so a cycle-opening add
 * needs no second one. Phase-less lines after it, a close's `/cad-suggest` say, don't move the boundary.
 * An unreadable record or one with no marker answers false.
 * @param {string} planningRoot
 * @returns {boolean}
 */
export function cycleBoundaryIsNewest(planningRoot) {
  const lines = readLines(planningRoot);
  if (lines === null) return false;
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
    if (e.family === 'lifecycle' && e.event === CYCLE) return true;
    if (key(e.phase) !== '') return false;
  }
  return false;
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
  // the newest anchor wins, so a re-run of a phase gets a new id; an anchor behind a cycle marker is the last
  // cycle's, and readEvents drops it at the same line (D-22), or the re-arm cap misses the rearm it just wrote
  const found = newestLifecycle(lines, ANCHOR, (e) => key(e.phase) === p, CYCLE);
  return found && typeof found.e.sha === 'string' && found.e.sha ? `${p}-${found.e.sha}` : p;
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
 * @returns {{lines: string[], at: number, corr: string, marker: string}} `at` is the anchor's index, `-1` with none
 */
function rotationMarker(text) {
  const lines = text.split('\n');
  const found = newestLifecycle(lines, ANCHOR);
  const at = found ? found.at : -1;
  // the id the run was already writing, read off the anchor; re-deriving would answer about the post-cut file
  const anchorCorr = !found ? '' : typeof found.e.corr === 'string' && found.e.corr ? found.e.corr : key(found.e.phase);
  const anchorPhase = found ? found.e.phase : undefined;
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

/**
 * The offset the newest rotation marker in `text` sealed its generation at, or null for no seal.
 * Newest marker decides; a non-numeric or negative seal is no seal, so a hand-edited line can't aim a read.
 * @param {string} text
 * @returns {number|null}
 */
function sealedAt(text) {
  const found = newestLifecycle(text.split('\n'), ROTATION);
  const at = found && found.e.carried_bytes;
  return typeof at === 'number' && Number.isFinite(at) && at >= 0 ? at : null;
}

/**
 * Claim the record, swap in a fresh one carrying the run in flight, and hand the old one to `ROTATED_TRACE_FILE`.
 * @param {string} planningRoot
 * @param {number} reserve bytes the fresh file owes beyond the carried tail
 * Exported so a test can reach the losing arm, which `appendEvent` can't (it re-stats).
 * @returns {{rotated: boolean, reason?: string, shortfall?: number|null}}
 * `reason` only where the rotation failed outright; losing the claim is `{rotated:false}`. `shortfall` is the
 * bytes the rescue couldn't carry from the destroyed generation, `null` when unknown.
 */
export function rotateTrace(planningRoot, reserve) {
  return rotateJsonl({
    file: tracePath(planningRoot), sibling: rotatedTracePath(planningRoot), claim: rotationClaimPath(planningRoot),
    max: MAX_TRACE_BYTES, carry: true, renameFallback: true,
    fresh: ({ carried, reserve: owed }) => freshRecord(carried, owed),
    sealOf: (_sibling, carried) => sealedAt(carried),
  }, reserve);
}

/**
 * Append one event. Never throws or writes to a stream: a trace that can't be written must leave its caller's
 * envelope byte-identical.
 * A symlinked trace is refused with `reason:'symlinked-trace'`, the append would follow it out of the tree; a symlinked
 * records folder with `reason:'symlinked-records'`, it would carry the record out the same way.
 * A planning directory with no valid state file is `reason:'no-valid-state'`, and nothing is written there: a hook
 * or route.mjs can't convert a project, and a log landing in `records/` first would block the main session's conversion.
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
  // unconverted or damaged is hands off until the main session stamps it; a link is refused before anything joins it
  const records = recordsReady(planningRoot);
  if (records.ok === false) return { written: false, reason: records.reason };
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
    appendFile(file, line);
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
 * @property {{file: string, ts: any}} [rotated] present only with a rotation marker; the record's, not `--phase`'s
 * @property {{routing: number, provider: number, lifecycle: number, outcome: number}} counts
 * @property {number} malformed lines that did not parse as JSON
 * @property {Record<string, {dispatches: number, tokens?: number, turns?: number, unrecorded?: number, turns_unrecorded?: number}>} roles what each role's returns reported; `tokens` pairs with `unrecorded` and `turns` with `turns_unrecorded`, on separate counters.
 * @property {Record<string, any>[]} events
 * @property {{corr: any, phase: any, plan: any, role: string, event: any, ts: any, end: any, ms: number|null, tokens: number|null, turns?: number, duration_ms?: number, cache_creation_input_tokens?: number, cache_read_input_tokens?: number, agent_id?: string, effort?: string, rung?: string}[]} brackets every dispatch that paired, one row each, in terminal order. Exposed so callers don't re-derive the pairing and disagree.
 *   `ms` is dispatch-to-close wall clock; `duration_ms` is what the host reported for the worker's own run.
 *   Cache figures come from the hook, the larger read wins, and they never reach `roles`.
 *   `effort` is what the worker's transcript says it ran at, `rung` what it was dispatched under (a `max` dispatch
 *   can run at `high` unannounced). On a `routing/resolve` event `effort` is the routed rung instead.
 * @property {{corr: any, phase: any, plan: any, ts: any, role: string}[]} unpaired
 *   dispatches with no terminal; no `--role` keys the empty string, so a forgotten flag stays visible
 * @property {{corr: any, phase: any, plan: any, ts: any, event: any, dispatched: string, closed: string}[]} mismatched
 *   paired brackets whose terminal named a role its dispatch did not
 * @property {CoordinatorResidue} [coordinator] present only when the scoped events carry a usable COORDINATOR marker
 */

/**
 * A timestamp as milliseconds, or null. An unreadable `ts` contributes nothing, since one NaN poisons every sum
 * it reaches.
 * @param {any} v
 * @returns {number|null}
 */
export function millis(v) {
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
 * @param {string} file @param {string|null} wanted
 * @returns {TraceRender}
 */
function emptyRender(file, wanted) {
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
  return out;
}

/** @param {Map<string, any>} roleTotals @param {string} k */
function roleRow(roleTotals, k) {
  let row = roleTotals.get(k);
  if (!row) {
    row = {
      dispatches: 0, tokens: 0, recorded: 0, figures: 0,
      turns: 0, turnsRecorded: 0, turnsFigures: 0,
    };
    roleTotals.set(k, row);
  }
  return row;
}

/** @param {Map<string, any>} coord @param {any} c */
function coordRow(coord, c) {
  const k = key(c);
  let row = coord.get(k);
  if (!row) { row = { markers: [], spans: [], last: -Infinity }; coord.set(k, row); }
  return row;
}

// the accumulators the account pass fills: per-role totals, the coordinator's runs, and the worker bookkeeping
/** @param {TraceRender} out */
function newAccounting(out) {
  // per-role accumulators beside `out.roles`: `recorded` only goes out as its complement, `unrecorded`.
  // `figures` alone gates the total, since gating on `recorded` would drop an unmatched terminal's real number.
  // Turns get their own triple: tokens and turns arrive independently and one counter would blur which one was
  // missing.
  /** @type {Map<string, {dispatches: number, tokens: number, recorded: number, figures: number, turns: number, turnsRecorded: number, turnsFigures: number}>} */
  const roleTotals = new Map();

  // keyed by `corr`, never phase: a phase number isn't a run, and a phase-keyed rollup bills the gap between
  // two sessions as coordinator time.
  // `last` is the newest timestamp of any family under this `corr`, the only honest end for the final window. A
  // marker that is its run's last event gets a zero-length one.
  // No `corr` keys the empty string, like a missing `plan` does for the worker key.
  /** @type {Map<string, {markers: {phase: any, step: any, ts: any, t: number}[], spans: {a: number, b: number}[], last: number}>} */
  const coord = new Map();

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
  return { out, roleTotals, coord, open, seenTerminals, pairedRows, cacheFacts, stepFacts };
}

/** @typedef {ReturnType<typeof newAccounting>} Accounting */

// pass 1: the record's lines, parsed, scoped to the phase and counted; false when there is no record to read
/** @param {string} planningRoot @param {string|null} wanted @param {TraceRender} out */
function readEvents(planningRoot, wanted, out) {
  try {
    out.capped = statSync(out.file).size >= MAX_TRACE_BYTES;
  } catch { /* absent or unreadable, the read below handles it */ }

  const lines = readLines(planningRoot);
  if (lines === null) return false;

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
    // also before it, and only with a phase: a cycle boundary drops what the phase gathered so far, anchor included,
    // while an unscoped read keeps the whole record and counts the marker like any lifecycle line
    if (wanted !== null && e.family === 'lifecycle' && e.event === CYCLE) {
      out.events = [];
      for (const f of FAMILIES) out.counts[f] = 0;
      anchor = null;
      continue;
    }
    if (wanted !== null && key(e.phase) !== wanted) continue;
    if (e.family === 'lifecycle' && e.event === ANCHOR) anchor = e;
    out.events.push(e);
    if (Object.prototype.hasOwnProperty.call(out.counts, e.family)) out.counts[e.family]++;
  }

  // named as this reader reaches the sibling, not as the marker spells it: a hand-edited `file` could say anything
  if (anchor && typeof anchor.sha === 'string' && anchor.sha) out.corr = `${wanted}-${anchor.sha}`;

  if (rotated) out.rotated = { file: rotatedTracePath(planningRoot), ts: rotated.ts };
  return true;
}

// pass 2: repair pre-anchor events at read time only. /cad-plan writes resolves before /cad-execute writes
// the anchor, so one phase carries two ids.
// A bare event goes to the first `phase_start` of its phase at or after it, forward where `correlationId`
// scans back: a reader has the whole file, a writer doesn't.
// Nothing is written back, so the file stays append-only. An event following a bare anchor keeps its id, or
// the next run's terminal could fund a dispatch it never made (`anchoredBare`).
/** @param {TraceRender} out */
function repairCorr(out) {
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
}

// what one line reports, each figure only when it is a finite number or a non-empty string
/** @param {any} e */
function figuresOf(e) {
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
  // what this line reports in the shape `foldFigures` takes: only the keys that passed, so omit-when-absent is a spread
  const figures = {
    ...cache,
    ...(effort !== null ? { effort } : {}),
    ...(rung !== null ? { rung } : {}),
  };
  return { tokens, turns, duration, cache, effort, rung, figures };
}

// the cache-only fact, folded after the loop: the host fires `SubagentStop` when the worker stops, the
// orchestrator writes the `--agent-id` close later, so the fact usually arrives first.
// A fact with no id can never reach a bracket, and one reporting nothing has nothing to give. An effort
// counts as something, or the one observation of a silent downgrade gets dropped.
function noteCacheFact(acc, e, fig) {
  const { cacheFacts } = acc;
  const { cache, effort, rung, figures } = fig;
  if (typeof e.agent_id === 'string' && e.agent_id
    && (CACHE_KEYS.some((k) => k in cache) || effort !== null || rung !== null)) {
    const pair = `${key(e.corr)}\0${e.agent_id}`;
    const prior = cacheFacts.get(pair);
    if (prior) foldFigures(prior, figures);
    else cacheFacts.set(pair, figures);
  }
}

// the step-window fact, folded after the loop for the same reason. Only traces from before 3.9.0 hold one
function noteStepFact(acc, e) {
  const { stepFacts } = acc;
  if (typeof e.agent_id === 'string' && e.agent_id
    && Number.isInteger(e.tokens) && e.tokens >= 0) {
    stepFacts.set(`${key(e.corr)}\0${e.agent_id}`, e.tokens);
  }
}

function openDispatch(acc, e, worker, fig) {
  const { roleTotals, open } = acc;
  const { tokens, turns } = fig;
  const role = key(e.role);
  const row = roleRow(roleTotals, role);
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
}

// a bracket adds to the residue only once paired: an unpaired dispatch has no known end, and inventing
// one hides the gap
function pairBracket(acc, e, worker, matched, t, fig) {
  const { out, coord, pairedRows } = acc;
  const { tokens, turns, duration, figures } = fig;
  const a = millis(matched.ts);
  if (a !== null && t !== null && t > a) coordRow(coord, e.corr).spans.push({ a, b: t });
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
    // cache figures, then what it ran at and was dispatched under: omitted likewise and independently, from the
    // terminal alone, so older records render unchanged. They ride this row and go nowhere else
    ...figures,
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
}

function foldRepeatClose(acc, e, repeat, t, fig) {
  const { coord } = acc;
  const { tokens, turns, duration, figures } = fig;
  // the fold: each figure fills a field the row left empty and never overwrites the first writer's
  const b = repeat.row;
  if (b.tokens === null && tokens !== null) b.tokens = tokens;
  if (!('turns' in b) && turns !== null) b.turns = turns;
  if (!('duration_ms' in b) && duration !== null) b.duration_ms = duration;
  // the cache figures take the larger read: the hook is their only writer, so two values are two reads of
  // one growing transcript. The strings fill only empty
  foldFigures(b, figures);
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
    if (a2 !== null && t > a2) coordRow(coord, e.corr).spans.push({ a: a2, b: t });
  }
  // upgrade one way only: a figureless writer that ran first would otherwise turn every checkpoint into a
  // clean `return`
  if (b.event === 'return' && e.event !== 'return') b.event = e.event;
  // no `mismatched` row, that's the pairing's to report
}

function billTerminal(acc, e, matched, fig) {
  const { roleTotals } = acc;
  const { tokens, turns } = fig;
  if (tokens !== null) {
    // bill the dispatch's role. An unmatched terminal falls back to its own, but funds no dispatch so
    // `unrecorded` can't go negative.
    const row = roleRow(roleTotals, matched ? matched.role : key(e.role));
    row.tokens += tokens;
    row.figures++;
    // `recorded` counts funded dispatches, not token-bearing events, or a replay could hide an unrecorded worker
    if (matched && !matched.funded) { row.recorded++; matched.funded = true; }
  }
  if (turns !== null) {
    // same authority and fallback as the token half
    const row = roleRow(roleTotals, matched ? matched.role : key(e.role));
    row.turns += turns;
    row.turnsFigures++;
    if (matched && !matched.turnsFunded) { row.turnsRecorded++; matched.turnsFunded = true; }
  }
}

function closeTerminal(acc, e, worker, t, fig) {
  const { open, seenTerminals, pairedRows } = acc;
  const { tokens, turns } = fig;
  // a byte-identical repeat of a terminal is a replay: it pairs with nothing and funds nothing, though it
  // stays in `out.events` and `counts`.
  // A close differing only in `role` isn't a replay, it shows in `mismatched`. Closes differing in turns
  // are two closes.
  const identity = `${worker}\0${e.event}\0${key(e.role)}\0${key(e.ts)}\0${tokens === null ? '' : tokens}\0${turns === null ? '' : turns}`;
  if (seenTerminals.has(identity)) return;
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
  if (matched && !repeat) pairBracket(acc, e, worker, matched, t, fig);
  else if (repeat) foldRepeatClose(acc, e, repeat, t, fig);
  billTerminal(acc, e, matched, fig);
}

// one event through the account pass: the run's clock, then the coordinator, a fact, a dispatch or a terminal
function accountEvent(acc, e) {
  const { coord } = acc;
  // every family feeds the run's end mark, or the clock stops early while routing and outcome events land
  const t = millis(e.ts);
  if (t !== null) {
    const row = coordRow(coord, e.corr);
    if (t > row.last) row.last = t;
  }

  if (e.family !== 'lifecycle') return;

  // kept out of the per-role chain: no `--role` here would render a nameless worker row
  if (e.event === COORDINATOR) {
    if (t !== null) coordRow(coord, e.corr).markers.push({ phase: e.phase, step: e.step, ts: e.ts, t });
    return;
  }

  // per-role accounting rides the pairing, not each event's `role`: the two halves are written separately and
  // can disagree. The dispatch opened the worker, so it's the authority.
  // No `--role` keys the empty string so a forgotten flag stays visible. A non-numeric `tokens` from a
  // hand-edited line contributes nothing.
  const fig = figuresOf(e);

  if (e.event === WORKER_CACHE) {
    noteCacheFact(acc, e, fig);
    return;
  }

  if (e.event === STEP_WINDOW) {
    noteStepFact(acc, e);
    return;
  }

  const worker = `${key(e.corr)}\0${key(e.phase)}\0${key(e.plan)}`;
  if (e.event === DISPATCH) {
    openDispatch(acc, e, worker, fig);
  } else if (TERMINAL.includes(e.event)) {
    closeTerminal(acc, e, worker, t, fig);
  }
}

// the post-pass fold. Every bracket is built by now, so a fact that arrived first still finds the row its
// `agent_id` names.
// Row only, not `roleTotals`, `seenTerminals` or `pairedRows`: a cache sum isn't denominated like a return's
// tokens, and `roles` stays byte-identical with or without facts.
// Two brackets sharing an `agent_id` under one `corr` get only the first, or one worker's traffic bills
// twice.
// Folded by `foldFigures`, the rule a repeat close uses too.
function foldPostPass(acc) {
  const { out, cacheFacts, stepFacts } = acc;
  for (const [pair, fact] of cacheFacts) {
    const b = out.brackets.find((r) => r.agent_id && `${key(r.corr)}\0${r.agent_id}` === pair);
    if (b) foldFigures(b, fact);
  }

  // the step-window fold: the first bracket under that `corr` and `agent_id` with a null `tokens` gets the
  // figure, a return's own always wins.
  // Row only, so a figureless return stays out of the spend.
  for (const [pair, tokens] of stepFacts) {
    const b = out.brackets.find((r) => r.agent_id && r.tokens === null
      && `${key(r.corr)}\0${r.agent_id}` === pair);
    if (b) b.tokens = tokens;
  }
}

function listUnpaired(acc) {
  const { out, open } = acc;
  for (const pending of open.values()) {
    for (const p of pending) {
      out.unpaired.push({ corr: p.corr, phase: p.phase, plan: p.plan, ts: p.ts, role: p.role });
    }
  }
}

// the token total is omitted when nothing was recorded, so a role never shows a zero it didn't spend.
// `unrecorded` is omitted at zero.
// Built with `Object.fromEntries`: role names come from the file, and assigning `__proto__` hits the
// prototype setter and erases the row. `Object.create(null)` would change the prototype callers expect.
// Both turn keys are gated on `turnsFigures`, unlike the token pair: a `turns_unrecorded` on every role would
// add a key to every older trace, and the verbatim fixture pins `roles` byte-for-byte.
function roleRows(roleTotals) {
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
  return Object.fromEntries(rows);
}

// the coordinator's time is computed once so `/cad-report` and `trace suggest` can't report different numbers
// for one run.
// A step's window runs from its marker to the next one in the same run, the last ending at that run's own
// last event, never at a later run sharing the phase number.
// Bracket spans clipped to the window are subtracted. Floored at zero: a bracket straddling two markers can
// exceed a window.
function coordinatorOf(coord) {
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
  if (!stepRows.length) return null;
  stepRows.sort((x, y) => x.t - y.t);
  return {
    wall_ms: wallMs,
    bracket_ms: bracketMs,
    residue_ms: residueMs,
    steps: stepRows.map(({ phase: p, step, ts, residue_ms }) => ({ phase: p, step, ts, residue_ms })),
  };
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
  const out = emptyRender(file, wanted);
  if (!readEvents(planningRoot, wanted, out)) return out;
  repairCorr(out);

  const acc = newAccounting(out);
  for (const e of out.events) accountEvent(acc, e);
  foldPostPass(acc);
  listUnpaired(acc);
  out.roles = roleRows(acc.roleTotals);
  const coordinator = coordinatorOf(acc.coord);
  if (coordinator) out.coordinator = coordinator;
  return out;
}
