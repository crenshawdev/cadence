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
// Four contracts, each load-bearing:
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
//     What an append costs, and what is paid for it: `appendFileSync` FOLLOWS a
//     symlink, so a planted `.planning/trace.jsonl` link would redirect every
//     event a run writes out of the tree. So the path is `lstat`ed ahead of the
//     size stat and a link is REFUSED - `{written:false, reason:'symlinked-trace'}`,
//     appending nothing. It is a reason and not a throw because of the contract
//     directly below: a record of a decision may not be able to change the
//     decision. An ABSENT file is still the ordinary first write.
//
//   NEVER throws, never speaks. `appendEvent` puts every fs call in its own try
//     and returns `{written:false, reason}` on any failure. Its callers'
//     envelopes must not move by a byte because a trace could not be written -
//     a record of a decision may not be able to change the decision.
//
//   TOKEN PROVENANCE. This is stated here ONCE, for every closing bracket in
//     the plugin, because it is the same fact at all six prose sites and those
//     sites are eager context while `cadence-core/bin/` is weighed by nothing.
//     The prose keeps only the three rules the model applies at runtime; the
//     provenance and the evidence behind it live here.
//
//     A closing event's `--tokens` figure is read off the HOST's subagent return
//     metadata at the moment the worker returns. Cadence adds no hook, no seam
//     and no capture mechanism to obtain it - if the host does not surface a
//     number on that return, there is nowhere else to get one.
//
//     So the flag is OMITTED when the return carries no figure. An absent total
//     means "no dispatch of this role reported one", and `--tokens 0` would
//     claim a dispatch that cost nothing.
//
//     A missing figure is ROUTINE, not evidence of a skipped bracket. Measured
//     on this repo: every PLUGIN agent's return carried one -
//     `cad-assumptions-analyzer` 186,577, `cad-planner` 146,405, `cad-executor`
//     154,523, `cad-plan-checker` 47,717, `cad-verifier` 78,034 - while a
//     BUILT-IN agent type, `Explore`, returned none at all. So `unrecorded` in
//     `trace render` reads as "this worker's return carried no number", never as
//     "this bracket never fired": `unrecorded` can only be nonzero where a
//     dispatch was counted, and the dispatch COUNT beside it records that the
//     dispatch half was WRITTEN.
//
//     Read the three states apart, because only two of them are visible at all.
//     A dispatch written and never closed is `unpaired`. A dispatch written,
//     closed, and carrying no number is `unrecorded`. A bracket for which no
//     event was appended AT ALL appears NOWHERE - not in `roles`, not in
//     `unpaired` - which is exactly why the append is not optional and why the
//     census in trace.test.mjs binds these lines per file.
//
//     Never substitute an estimate, a token count from a different worker, or a
//     figure the host did not report. A fabricated number is worse than an
//     absent one: `unrecorded` is readable as an absence, a wrong total is not.
'use strict';

import {
  appendFileSync, closeSync, lstatSync, openSync, readFileSync, readSync, statSync,
} from 'node:fs';
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

// The four lifecycle names below are EXPORTED so the producer census in
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

/**
 * The lifecycle event the COORDINATOR writes at the start of a workflow step it
 * can name. It is a fifth lifecycle NAME, not a fifth family: `FAMILIES` is
 * validated at the seam while `renderTrace`'s `counts` is a fixed four-key
 * literal, so a fifth family would write fine and count nowhere.
 *
 * It opens nothing, closes nothing and pairs with nothing - the same shape
 * `ANCHOR` already has. It carries the step's name and its timestamp and
 * NOTHING else: never `--role`, because per-role accounting bills the worker
 * that a DISPATCH opened and an empty-string role would render a nameless
 * worker row; and never `--tokens`, because a token figure is read off a
 * SUBAGENT's return metadata and the coordinator has no such return to read (see
 * TOKEN PROVENANCE above - a fabricated figure is worse than an absent one).
 *
 * What the coordinator cost is therefore DERIVED, never reported: the residue
 * of a step's wall span after the paired bracket spans inside it are subtracted.
 * A marker carrying its own elapsed field would give one quantity two sources,
 * and they disagree the first time a bracket is left unpaired.
 */
export const COORDINATOR = 'coordinator';

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
 * cannot be written must leave its caller's envelope byte-identical. A trace
 * path that is a SYMLINK is refused with `reason:'symlinked-trace'` and nothing
 * is appended - the append would otherwise follow it out of the tree.
 * @param {string} planningRoot
 * @param {any} event `{phase, family, event, ...fields}`
 * @returns {{written: boolean, reason?: string, corr?: string}}
 */
export function appendEvent(planningRoot, event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { written: false, reason: 'bad-event' };
  }
  const file = tracePath(planningRoot);

  // `lstatSync`, so the LINK is classified rather than whatever it points at -
  // `appendFileSync` and the size `statSync` below both follow one. Ahead of the
  // size stat, because a redirected trace must be refused whatever its size.
  try {
    if (lstatSync(file).isSymbolicLink()) return { written: false, reason: 'symlinked-trace' };
  } catch { /* ENOENT is the ordinary first write; the size stat below reports the rest */ }

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
 * @property {{routing: number, provider: number, lifecycle: number, outcome: number}} counts
 * @property {number} malformed lines that did not parse as JSON
 * @property {Record<string, {dispatches: number, tokens?: number, unrecorded?: number}>} roles
 *   what each role COST, keyed by the lifecycle events' `role` field
 * @property {Record<string, any>[]} events
 * @property {{corr: any, phase: any, plan: any, ts: any}[]} unpaired dispatches with no terminal event
 * @property {{corr: any, phase: any, plan: any, ts: any, event: any, dispatched: string, closed: string}[]} mismatched
 *   paired brackets whose terminal named a role its dispatch did not
 * @property {CoordinatorResidue} [coordinator] present ONLY when the scoped events
 *   carry at least one usable COORDINATOR marker, so a trace written before that
 *   marker existed renders byte-identically to the way it always did
 */

/**
 * A timestamp as milliseconds, or null when there is nothing to read. Every
 * arithmetic path below goes through this: an event whose `ts` is absent,
 * non-string or unparseable contributes NOTHING rather than putting a NaN into
 * a total, because one NaN poisons every sum it reaches and the render would
 * report `null` for a residue the rest of the record could still describe.
 * @param {any} v
 * @returns {number|null}
 */
function millis(v) {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * The union of a set of half-open intervals, merged and in order.
 *
 * Merging BEFORE subtraction is what stops two workers running at once from
 * subtracting the same wall time twice - the parallel execute path dispatches a
 * worker per plan, so overlapping brackets are the normal case there, and
 * summing their lengths would drive a real coordinator gap to zero.
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
 *
 * The `coordinator` block is the one part of the shape that is CONDITIONAL: it
 * appears only where a COORDINATOR marker did, so every trace written before
 * that marker existed renders exactly as it always did.
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
    mismatched: [],
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

  // Coordinator-residue accumulators, keyed by PHASE and never by `corr`. One
  // phase can still hold more than one id - a RE-RUN starts a new one, and a
  // phase whose anchor is missing entirely (a head-truncated read) keeps the
  // bare form the pre-anchor repair above could not resolve - so a corr-keyed
  // rollup would split ONE coordinator's record into two and report its time
  // twice. `last` is the phase's newest timestamp across every family,
  // because the final marker's window has no next marker to close it and the
  // phase's own last event is the only honest end for it.
  /** @type {Map<string, {phase: any, markers: {step: any, ts: any, t: number}[], spans: {a: number, b: number}[], last: number}>} */
  const coord = new Map();
  /** @param {any} p */
  const coordRow = (p) => {
    const k = key(p);
    let row = coord.get(k);
    if (!row) { row = { phase: p, markers: [], spans: [], last: -Infinity }; coord.set(k, row); }
    return row;
  };

  try {
    out.capped = statSync(file).size >= MAX_TRACE_BYTES;
  } catch { /* absent or unreadable - handled by the read below */ }

  const lines = readLines(planningRoot);
  if (lines === null) return out;

  // PASS 1 - parse, scope, count. The accounting is a SECOND pass over the same
  // parsed objects because the repair between them needs to see events that come
  // AFTER the one being repaired; splitting the passes keeps that to one
  // `JSON.parse` per line rather than reading the file twice.
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { out.malformed++; continue; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) { out.malformed++; continue; }
    if (wanted !== null && key(e.phase) !== wanted) continue;
    out.events.push(e);
    if (Object.prototype.hasOwnProperty.call(out.counts, e.family)) out.counts[e.family]++;
  }

  // PASS 2 - the PRE-ANCHOR repair, at READ time only (D-01). /cad-plan's
  // resolves are written before /cad-execute writes the phase's anchor, so those
  // events took the bare `<phase>` form while everything after the anchor took
  // `<phase>-<sha>`: one phase, two ids, and the join the record exists for
  // breaks exactly where a phase begins. Here a bare-form event is attributed to
  // the FIRST `lifecycle/phase_start` of its OWN phase at or after its position,
  // and that repaired id is what the rendered event carries, what the worker key
  // pairs on, and what an `unpaired` row names.
  //
  // FORWARD, and that is the opposite direction from `correlationId`, which
  // scans BACKWARD for the newest anchor. Both are right for their side: a
  // WRITER has no later lines to look at and must not join a re-run to the run
  // before it, while a READER holds the whole file and can see the anchor the
  // event was waiting for. Hence the walk below runs from the end, carrying the
  // next anchor per phase back over the events that precede it.
  //
  // Nothing is written back - `appendEvent` still stores what it derived at
  // write time, so the file stays append-only and every event already on disk
  // joins without being rewritten. An event with NO later anchor for its phase
  // keeps the bare form, which is also what a head-truncated read over
  // `MAX_TRACE_BYTES` leaves behind.
  /** @type {Map<string, string>} phase -> the id of the next anchor at or after here */
  const nextAnchor = new Map();
  for (let i = out.events.length - 1; i >= 0; i--) {
    const e = out.events[i];
    const p = key(e.phase);
    if (e.family === 'lifecycle' && e.event === ANCHOR) {
      // An anchor with no sha derives the bare form itself, so it still SHADOWS
      // any later anchor: the first anchor ahead is the one that answers, or a
      // re-run's id would reach back over the run before it.
      nextAnchor.set(p, typeof e.sha === 'string' && e.sha ? `${p}-${e.sha}` : p);
    } else if (typeof e.corr === 'string' && e.corr === p && nextAnchor.has(p)) {
      e.corr = /** @type {string} */ (nextAnchor.get(p));
    }
  }

  // Each pending entry carries the two accounting fields beyond the identity
  // `unpaired` renders: `role` so a terminal bills the half that OPENED the
  // worker, and `funded` so one dispatch can be funded exactly once.
  /** @type {Map<string, {corr: any, phase: any, plan: any, ts: any, role: string, funded: boolean}[]>} */
  const open = new Map();
  for (const e of out.events) {
    // Every family feeds the phase's end-of-record mark, not the lifecycle one
    // alone: the coordinator's last step is still running while the routing and
    // outcome events it produced are being written, so an end taken from
    // lifecycle events only would stop the clock early.
    const t = millis(e.ts);
    if (t !== null) {
      const row = coordRow(e.phase);
      if (t > row.last) row.last = t;
    }

    if (e.family !== 'lifecycle') continue;

    // The marker is collected HERE rather than in the per-role chain below, so
    // that chain keeps billing only the workers a DISPATCH opened: a coordinator
    // event carries no `--role` at all (D-07), and a branch that keyed the empty
    // string would render a nameless worker row through `workflows/progress.md`.
    if (e.event === COORDINATOR) {
      if (t !== null) coordRow(e.phase).markers.push({ step: e.step, ts: e.ts, t });
      continue;
    }

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

    const worker = `${key(e.corr)}\0${key(e.phase)}\0${key(e.plan)}`;
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
      // A bracket contributes its span to the residue only once it has PAIRED,
      // which is why the span is taken here and not from the dispatch half: an
      // unpaired dispatch (the fixture's 13:51:44 `cad-reviewer` is one) has no
      // known end, and inventing one - the phase's last event, say - would
      // subtract a worker's whole tail from the coordinator's bill and hide the
      // gap the marker exists to show.
      if (matched) {
        const a = millis(matched.ts);
        if (a !== null && t !== null && t > a) coordRow(e.phase).spans.push({ a, b: t });
        // REPORTED, never billed. The accounting below is unchanged - the
        // dispatch is still the authority for whose bill this is - but a
        // bracket whose two halves name two different roles is a prose defect
        // at one of the two sites, and absorbing it silently is how it survives
        // four milestones. A terminal carrying NO role at all is not a mismatch:
        // an omitted flag is already visible as an unkeyed row, and calling it
        // one would raise a false alarm on every historical bracket (measured
        // 2026-08-14: 0 mismatches across 88 live paired brackets).
        // The identity fields are the TERMINAL's, as `ts` and `event` are - it
        // is the event being reported, and its `phase` may be spelled `1` where
        // the dispatch spelled it `"1"`, which `key()` already folds together.
        const closed = key(e.role);
        if (closed && closed !== matched.role) {
          out.mismatched.push({
            corr: e.corr, phase: e.phase, plan: e.plan, ts: e.ts, event: e.event,
            dispatched: matched.role, closed,
          });
        }
      }
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

  // The coordinator's own time, computed ONCE here rather than by each reader.
  // `/cad-report` and `trace suggest` both read this block, so the two cannot
  // report different numbers for the same run - the arithmetic is D-01's, and
  // the only thing that changed is that it lives in one place.
  //
  // A step's window runs from its marker to the NEXT marker in the same phase,
  // and the last marker's window ends at that phase's last event. Inside the
  // window, the merged bracket spans are clipped to it and subtracted; what
  // survives is what the coordinator was doing while no worker was running.
  // Floored at zero because a window can be shorter than the brackets clipped
  // into it once a bracket straddles two markers, and a negative residue would
  // read as the coordinator having given time back.
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
      stepRows.push({ phase: row.phase, step: m.step, ts: m.ts, t: m.t, residue_ms: residue });
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
