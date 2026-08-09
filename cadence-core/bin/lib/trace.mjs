// @ts-check
// trace.mjs - the ONE writer and the ONE reader of `.planning/trace.jsonl`,
// the joined record of what a run actually did: routing decisions, provider
// calls, worker lifecycle brackets and gate outcomes, all under one per-phase
// correlation id so the four families can be read as a single story.
//
// Not a pure lib (it does guarded I/O), the same split lib/phase-plans.mjs
// carries: the callers own their envelopes, this file owns the file format and
// never speaks on any stream of its own.
//
// Three contracts, each load-bearing:
//
//   DERIVED id (D-06). `correlationId` computes `<phase>-<sha>` from data
//     already on disk - the phase number and the phase's PHASE_START sha,
//     carried by the newest `lifecycle/phase_start` line for that phase - and
//     NEVER mints-and-stores one. Every producer (route.mjs, review-provider.mjs,
//     a `trace append` from prose) is a fresh one-shot process with no shared
//     state, so a minted id would differ between two concurrent producers in the
//     same phase and the trace would join nothing on exactly the parallel path
//     it exists to explain. With no anchor the id is `<phase>` alone, which
//     still joins within a phase but not across re-runs.
//
//   APPEND, not atomic write (D-07). Writes go through `appendFileSync`, never
//     lib/planning-files.mjs's `atomicWrite` - that one is write-tmp-plus-rename
//     with no append mode, so a read-modify-write would lose events under
//     batched parallel dispatch. The size bound is enforced at WRITE time (stat
//     first, append nothing at or over the cap) for the same reason: there is no
//     whole-file rewrite to trim from.
//
//   NEVER throws, never speaks. `appendEvent` puts every fs call in its own try
//     and returns `{written:false, reason}` on any failure. Its callers'
//     envelopes must not move by a byte because a trace could not be written -
//     a record of a decision may not be able to change the decision.
'use strict';

import { appendFileSync, closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The trace file's name inside a planning root. */
export const TRACE_FILE = 'trace.jsonl';

/**
 * The write-time size bound. At or over it nothing more is appended and
 * `renderTrace` reports `capped`, so an incomplete record is never read as a
 * complete one.
 */
export const MAX_TRACE_BYTES = 1048576;

/** The four event families. A family outside this list is refused by the seam. */
export const FAMILIES = ['routing', 'provider', 'lifecycle', 'outcome'];

// The three lifecycle names below are EXPORTED so the producer census in
// trace.test.mjs reads the renderer's real vocabulary rather than a copy of it:
// a test holding its own list would go green on the day a prose surface and the
// renderer stopped agreeing, which is the whole failure it exists to catch.

/** The lifecycle event that OPENS a worker bracket. */
export const DISPATCH = 'dispatch';

/**
 * The lifecycle events that CLOSE one. All three are terminal for a worker:
 * a renderer pairing only `return` and `checkpoint` would strand every
 * escalated worker in `unpaired[]`.
 */
export const TERMINAL = ['return', 'checkpoint', 'escalation'];

/** The lifecycle event that ANCHORS a phase's correlation id. */
export const ANCHOR = 'phase_start';

/** @param {string} planningRoot */
export function tracePath(planningRoot) {
  return join(planningRoot, TRACE_FILE);
}

/**
 * A phase or worker key as a string, so `1` and `"1"` are the same worker and a
 * role-named worker (`cad-verifier`) keys the same way a plan number does.
 * @param {any} v
 */
function key(v) {
  return v === undefined || v === null ? '' : String(v);
}

/**
 * Every line of the trace file, or null when it cannot be read (absent,
 * unreadable, a planning root that is not a directory). Absence is data here.
 *
 * BOUNDED at `MAX_TRACE_BYTES`, the same ceiling the writer enforces. The write
 * bound alone does not protect this side: `appendEvent` stats BEFORE it writes,
 * so the last event admitted can carry the file past the cap, and a trace that
 * was corrupted, hand-edited, or written by a producer outside this seam has no
 * bound at all. Reading it whole is a synchronous `readFileSync` + `split` +
 * `JSON.parse` per line inside the host process, so an oversized file turns
 * `/cad-progress --trace` - a read-only status command - into a hang.
 *
 * Over the cap it reads the FIRST `MAX_TRACE_BYTES` and drops the trailing
 * partial line. The head, not the tail: `correlationId` scans for a phase's
 * anchor and the renderer pairs dispatch/terminal brackets, so a truncated head
 * loses whole brackets while a truncated tail only leaves the newest ones
 * unpaired - which `unpaired[]` already reports. `renderTrace` independently
 * stats the file and reports `capped: true` here, so a partial read is never
 * presented as a complete record.
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
  // Over the cap: read the head only, then drop the last element, which is
  // either a partial line or (on an exact byte boundary) an empty string.
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
 * The per-phase correlation id, DERIVED and never stored.
 *
 * `ownSha` is how the ANCHOR event derives its own id: the first
 * `lifecycle/phase_start` line of a phase has no prior anchor to scan, so
 * without this it would take the phase-only form while every event after it took
 * the derived form - splitting the lifecycle family across two ids and making
 * "all four families under one correlation id" unreachable by construction. It
 * is the same derivation from the same datum (the PHASE_START sha), applied one
 * line earlier, so it mints nothing.
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
  // From the END: the NEWEST anchor for this phase wins, so a re-run of a phase
  // starts a new id rather than joining the previous run's events.
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
 * Append one event. NEVER throws, never writes to stdout or stderr: a trace that
 * cannot be written must leave its caller's envelope byte-identical.
 * @param {string} planningRoot
 * @param {any} event `{phase, family, event, ...fields}`
 * @returns {{written: boolean, reason?: string, corr?: string}}
 */
export function appendEvent(planningRoot, event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { written: false, reason: 'bad-event' };
  }
  const file = tracePath(planningRoot);

  // The bound, enforced BEFORE the write (D-07): there is no whole-file rewrite
  // to trim from, so the only place to stop is in front of the append. An
  // absent file is the ordinary first write; any other stat failure is the
  // reason this append did not happen.
  try {
    if (statSync(file).size >= MAX_TRACE_BYTES) return { written: false, reason: 'size-cap' };
  } catch (e) {
    const code = e && e.code;
    if (code !== 'ENOENT') return { written: false, reason: code || 'stat-failed' };
  }

  let line;
  let corr;
  try {
    const rendered = renderEvent(planningRoot, event);
    corr = rendered.corr;
    line = `${JSON.stringify(rendered)}\n`;
  } catch (e) {
    return { written: false, reason: (e && e.code) || 'unrenderable-event' };
  }

  try {
    appendFileSync(file, line);
  } catch (e) {
    return { written: false, reason: (e && e.code) || 'append-failed' };
  }
  return { written: true, corr };
}

/**
 * @typedef {object} TraceRender
 * @property {string} file the trace file's path
 * @property {string|null} corr the phase's derived id, or null with no `--phase`
 * @property {boolean} capped true when the file is at or over MAX_TRACE_BYTES
 * @property {{routing: number, provider: number, lifecycle: number, outcome: number}} counts
 * @property {number} malformed lines that did not parse as JSON
 * @property {Record<string, {dispatches: number, tokens?: number, unrecorded?: number}>} roles
 *   what each role COST, keyed by the lifecycle events' `role` field
 * @property {Record<string, any>[]} events
 * @property {{corr: any, phase: any, plan: any, ts: any}[]} unpaired dispatches with no terminal event
 */

/**
 * Read the trace in line order, group by family, and pair every worker bracket.
 *
 * Pairing: a `lifecycle/dispatch` with a given `(corr, phase, plan)` is closed
 * by a LATER `return`, `checkpoint` or `escalation` with the same
 * `(corr, phase, plan)`, oldest dispatch first. `plan` is the WORKER key - a
 * plan number on either execute path, a role name for a role-dispatched worker -
 * so one rule covers every bracketed worker rather than leaving role dispatches
 * keyed on `undefined` and pairing with each other.
 *
 * `corr` is part of the key because a RE-RUN of a phase starts a new id (the
 * header's first contract), and without it the second run's terminal event
 * closes the first run's stranded dispatch: the record would report a clean
 * bracket for a worker that never came back, and strand the healthy one in its
 * place. Each pending entry therefore carries its own `corr`, so an `unpaired`
 * line says WHICH run stranded the worker. An event with no `corr` keys on the
 * empty string, exactly as `plan` already does.
 *
 * An absent file is an empty render, never an error: the same
 * never-blocks-the-spine contract `recall` follows.
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
    corr: wanted === null ? null : correlationId(planningRoot, phase),
    capped: false,
    counts: { routing: 0, provider: 0, lifecycle: 0, outcome: 0 },
    malformed: 0,
    roles: {},
    events: [],
    unpaired: [],
  };

  // Per-role accumulators, kept beside `out.roles` rather than in it: `recorded`
  // is how many of a role's dispatches came back with a figure, which the
  // emitted shape carries only as its complement (`unrecorded`), so it must not
  // leak into the rendered object.
  // `figures` is a SEPARATE count from `recorded`: it is how many token values
  // landed on this role at all, and it alone decides whether a total is
  // emitted. Gating the total on `recorded` instead would silently drop the
  // figure carried by an UNMATCHED terminal - a real number, on an event that
  // funds no dispatch.
  /** @type {Map<string, {dispatches: number, tokens: number, recorded: number, figures: number}>} */
  const roleTotals = new Map();
  /** @param {string} k */
  const roleRow = (k) => {
    let row = roleTotals.get(k);
    if (!row) { row = { dispatches: 0, tokens: 0, recorded: 0, figures: 0 }; roleTotals.set(k, row); }
    return row;
  };

  try {
    out.capped = statSync(file).size >= MAX_TRACE_BYTES;
  } catch { /* absent or unreadable - handled by the read below */ }

  const lines = readLines(planningRoot);
  if (lines === null) return out;

  // Each pending entry carries the two accounting fields beyond the identity
  // `unpaired` renders: `role` so a terminal bills the half that OPENED the
  // worker, and `funded` so one dispatch can be funded exactly once.
  /** @type {Map<string, {corr: any, phase: any, plan: any, ts: any, role: string, funded: boolean}[]>} */
  const open = new Map();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { out.malformed++; continue; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) { out.malformed++; continue; }
    if (wanted !== null && key(e.phase) !== wanted) continue;
    out.events.push(e);
    if (Object.prototype.hasOwnProperty.call(out.counts, e.family)) out.counts[e.family]++;
    if (e.family !== 'lifecycle') continue;

    // Per-role accounting rides the PAIRING below, not each event's own `role`.
    // A bracket's two halves are written by two separate prose lines, so
    // nothing stops them disagreeing - and billing each half to whatever it
    // happens to name produces the worst available answer: the role that really
    // ran reads as unmeasured while a role that never dispatched carries its
    // bill. The DISPATCH is the authority, because it is the half that opened
    // the worker.
    //
    // A bracket that omitted `--role` still keys the empty string exactly as
    // `plan` already does, so a forgotten flag stays VISIBLE as an unkeyed row
    // instead of vanishing from the totals. A non-numeric `tokens` on a
    // hand-edited or foreign-producer line contributes NOTHING and is never
    // string-concatenated onto the total.
    const tokens = typeof e.tokens === 'number' && Number.isFinite(e.tokens) ? e.tokens : null;

    const worker = `${key(e.corr)} ${key(e.phase)} ${key(e.plan)}`;
    if (e.event === DISPATCH) {
      const role = key(e.role);
      const row = roleRow(role);
      row.dispatches++;
      // A figure on the OPEN half is unusual - prose writes it at the close -
      // but it is counted rather than dropped, and it marks THIS dispatch
      // funded so its own terminal cannot fund it a second time.
      const entry = { corr: e.corr, phase: e.phase, plan: e.plan, ts: e.ts, role, funded: false };
      if (tokens !== null) { row.tokens += tokens; row.recorded++; row.figures++; entry.funded = true; }
      const pending = open.get(worker) || [];
      pending.push(entry);
      open.set(worker, pending);
    } else if (TERMINAL.includes(e.event)) {
      const pending = open.get(worker);
      const matched = pending && pending.length ? pending.shift() : null;
      if (tokens !== null) {
        // Bill the DISPATCH's role. An unmatched terminal has no dispatch to
        // speak for it, so it falls back to its own `role`: its tokens show,
        // but it funds no dispatch and so cannot drive `unrecorded` negative.
        const row = roleRow(matched ? matched.role : key(e.role));
        row.tokens += tokens;
        row.figures++;
        // `recorded` counts funded DISPATCHES, never token-bearing EVENTS. A
        // replayed or duplicated terminal adds its figure but must not mark a
        // second dispatch funded, which is how a genuinely unrecorded worker
        // would otherwise vanish from the `unrecorded` count.
        if (matched && !matched.funded) { row.recorded++; matched.funded = true; }
      }
    }
  }
  // `unpaired` carries the bracket's identity only - the accounting fields
  // added above are internal and never reach the rendered shape.
  for (const pending of open.values()) {
    for (const p of pending) out.unpaired.push({ corr: p.corr, phase: p.phase, plan: p.plan, ts: p.ts });
  }

  // The token total is OMITTED when nothing was recorded, so a role with no
  // figure never shows a zero it would be read as having spent; `unrecorded` is
  // a dispatch COUNT, omitted at zero, never the string `unrecorded` sitting in
  // a numeric field. The internal `recorded` counter is dropped here.
  //
  // Built through `Object.fromEntries` rather than by assigning `out.roles[k]`.
  // Role names come out of the trace file, and plain assignment of the key
  // `__proto__` hits the prototype setter instead of creating an own property:
  // the row silently does not exist, `Object.keys` comes back short, and the
  // seam's omit-when-empty gate can drop the WHOLE roles block - one hostile
  // role name erasing every other role's accounting. `fromEntries` defines own
  // properties, and unlike `Object.create(null)` it leaves the ordinary
  // prototype every caller (and every deep-equal assertion) already expects.
  /** @type {[string, {dispatches: number, tokens?: number, unrecorded?: number}][]} */
  const rows = [];
  for (const [role, row] of roleTotals) {
    const unrecorded = Math.max(0, row.dispatches - row.recorded);
    rows.push([role, {
      dispatches: row.dispatches,
      ...(row.figures ? { tokens: row.tokens } : {}),
      ...(unrecorded ? { unrecorded } : {}),
    }]);
  }
  out.roles = Object.fromEntries(rows);
  return out;
}
