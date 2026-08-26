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
 * @property {Record<string, {dispatches: number, tokens?: number, turns?: number, unrecorded?: number, turns_unrecorded?: number}>} roles
 *   what each role's returns REPORTED, keyed by the lifecycle events' `role`
 *   field. Two independent figures with two independent counters: `tokens` with
 *   `unrecorded` (dispatches whose return carried no token figure) and `turns`
 *   with `turns_unrecorded` (dispatches whose return carried no tool-call
 *   count). Collapsing the two counters would make a dispatch that reported
 *   tokens but no turns indistinguishable from the reverse. Each figure and its
 *   counter appear only where at least one figure of that kind landed on the
 *   role, so a record written before either flag existed renders unchanged.
 * @property {Record<string, any>[]} events
 * @property {{corr: any, phase: any, plan: any, role: string, event: any, ts: any, end: any, ms: number|null, tokens: number|null, turns?: number, duration_ms?: number}[]} brackets
 *   every dispatch that PAIRED, one row each, in the order its terminal was
 *   read. The pairing was already computed here for the accounting; exposing it
 *   is what lets a caller print per-worker rows without re-deriving `open` and
 *   `seenTerminals` for itself - and re-deriving them is how two readers of one
 *   record start disagreeing about which bracket closed. `role` is the
 *   DISPATCH's, the same authority `roles` bills on; `event` is the terminal's,
 *   so a `checkpoint` row is distinguishable from a `return` one.
 *
 *   TWO ELAPSED FIGURES, and they measure different things. `ms` is
 *   DISPATCH-TO-CLOSE wall clock, derived here off the two timestamps, so it
 *   includes whatever the orchestrator did between writing the two halves.
 *   `duration_ms` is what the HOST reported for the worker's own run, copied
 *   onto the close by `--duration-ms` and never computed. A reader pricing a
 *   worker wants `duration_ms`; a reader asking how long a step held the run
 *   wants `ms`.
 *
 *   `turns` and `duration_ms` are the OPTIONAL keys: `ms` and `tokens` are on
 *   every row (null where they could not be computed), while a bracket whose
 *   close carried no tool-call count has no `turns` key and one whose close
 *   carried no wall clock has no `duration_ms` key at all - so a record written
 *   before either flag existed renders byte-identically.
 *
 *   ONE ROW PER DISPATCH, not per close. Two writers close one bracket - the
 *   host's `SubagentStop` hook and the orchestrator's own `trace close` - and
 *   whichever arrives second folds its figures into the row the first opened.
 *   Two genuine dispatches on one worker key, each with its own close, are
 *   still two rows: what is collapsed is a repeat CLOSE, never a repeat
 *   DISPATCH.
 * @property {{corr: any, phase: any, plan: any, ts: any, role: string}[]} unpaired
 *   dispatches with no terminal event. `role` is the DISPATCH's own, the same
 *   value `brackets[]` exposes and `roles` bills on, so a reader can say WHICH
 *   KIND of worker is still open without re-deriving the pairing - and
 *   re-deriving `open` and `seenTerminals` in a second reader is how two
 *   readers of one record start disagreeing about which bracket closed. A
 *   dispatch written with no `--role` keys the empty string here exactly as it
 *   does in `roles`, so a forgotten flag stays visible instead of vanishing.
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
    brackets: [],
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
  //
  // TURNS get their OWN `turns`/`turnsRecorded`/`turnsFigures` triple rather
  // than sharing the token ones (D-03). The two figures are read off the same
  // subagent return but arrive independently - a host can surface one and not
  // the other, and a close site can carry one flag and drop the other - so a
  // single `recorded` counter would make a dispatch that reported tokens but no
  // turns indistinguishable from the reverse, and `unrecorded` would stop
  // meaning "no token figure was reported" without one test going red.
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

  // Coordinator-residue accumulators, keyed by `corr` and never by PHASE
  // (phase 5 D-01). A phase NUMBER is not a run: every re-run and every later
  // milestone that reaches the same number files under it, so a phase-keyed
  // rollup pairs one run's last marker with a DIFFERENT run's last event and
  // bills the clock between two sessions as coordinator time. Measured on this
  // repository 2026-08-17, phase "2" holds 9 distinct `corr` ids spanning
  // 2026-08-08 to 2026-08-17, and its 4,677-minute `commit` window was opened
  // at 2026-08-13T20:30:13.500Z by `2-6790224`, a run whose OWN last event is
  // 25 seconds later at 20:30:38. Keying on `corr` closes that window where its
  // run closed.
  //
  // This REVERSES the choice this block shipped with, which rolled a phase's
  // ids up together so a re-run - or a phase whose anchor is missing entirely,
  // where a head-truncated read leaves the bare form behind - could not split
  // ONE coordinator's record in two and report its time twice. The PASS-2
  // pre-anchor repair above now joins a phase's pre-anchor events to the anchor
  // that follows them, which is most of that case; where it does not, two ids
  // really are two runs, and reporting them apart is the answer rather than the
  // defect.
  //
  // `last` is therefore the newest timestamp across every family carrying THIS
  // `corr`, because the final marker's window has no next marker to close it
  // and its own run's last event is the only honest end for it. A marker that
  // IS its run's last event closes at itself and contributes a ZERO-length
  // window: the record holds no evidence the coordinator kept working after its
  // own last act, and inventing an end is the class of guess this key exists to
  // remove. An event carrying no `corr` at all keys the empty string, exactly
  // as the worker key already does with a missing `plan` - one rule, no second
  // case. The `phase` a `steps[]` row reports comes from the MARKER's own
  // event, since the accumulator key is no longer a phase.
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
  // A bare event whose most recent PRECEDING anchor is itself bare (a no-sha
  // phase_start) already carries that run's id exactly as the writer derived
  // it - repairing it forward would hand a previous run's events to the run
  // after it, and the next run's terminal could then pair with and fund a
  // dispatch that run never made. The forward scan marks those events so the
  // backward walk leaves them alone; only an event with no preceding anchor
  // for its phase, or one following a sha'd anchor whose derived id it does
  // not carry, is genuinely pre-anchor.
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
      // An anchor with no sha derives the bare form itself, so it still SHADOWS
      // any later anchor for the events BEFORE it; the events after it are the
      // `anchoredBare` set the forward scan already fenced off.
      nextAnchor.set(p, typeof e.sha === 'string' && e.sha ? `${p}-${e.sha}` : p);
    } else if (!anchoredBare[i] && typeof e.corr === 'string' && e.corr === p && nextAnchor.has(p)) {
      e.corr = /** @type {string} */ (nextAnchor.get(p));
    }
  }

  // Each pending entry carries the two accounting fields beyond the identity
  // `unpaired` renders: `role` so a terminal bills the half that OPENED the
  // worker, and `funded` so one dispatch can be funded exactly once.
  /** @type {Map<string, {corr: any, phase: any, plan: any, ts: any, role: string, funded: boolean, tokens: number|null, turnsFunded: boolean, turns: number|null}[]>} */
  const open = new Map();

  // Every terminal's full identity, so the SECOND copy of one funds nothing. A
  // replayed close - a re-run of a prose step, a copy-pasted append - is
  // indistinguishable from a genuine one at the pairing rule, and with two
  // dispatches open on ONE worker key the `funded` flag below cannot help: the
  // FIFO `pending.shift()` hands the replay a second, genuinely open dispatch
  // and marks THAT one funded, so a worker whose return carried no figure
  // silently disappears out of `unrecorded` and the run reads as fully
  // measured.
  //
  // The accepted cost, stated: two genuinely distinct closes that share worker
  // key, event name, role, token figure AND millisecond are indistinguishable
  // from a replay here, and the second is dropped. The exact alternative is a
  // per-dispatch id the close quotes back, which is a WRITER-contract change
  // across all six prose close sites - the same six a `trace close` subcommand
  // is scheduled to absorb, so it is that seam's to make, not this reader's.
  //
  // The TWO-WRITER hazard this guard could not answer - a hook close and a
  // hand-written close of one dispatch, which never share a millisecond - is
  // answered by the worker-key dedup below rather than by widening this
  // identity. Widening it would have to drop the millisecond, and then two
  // genuine dispatches on one worker key with equal figures would fold into
  // one bracket.
  //
  // TERMINALS only. A duplicated DISPATCH is a different hazard (it inflates a
  // count rather than funding a bracket) and is deliberately not folded in here.
  /** @type {Set<string>} */
  const seenTerminals = new Set();

  // THE DEDUP, and it is a different rule from the replay guard above.
  //
  // Two writers now close one bracket: the host's `SubagentStop` hook and the
  // orchestrator's own hand-written `trace close`, kept as the fallback for the
  // dispatches no subagent stands behind. Neither may assume it ran first, and
  // the guard above cannot fold them - it keys on the MILLISECOND, and two
  // independent writers never agree to the millisecond, so the FIFO
  // `pending.shift()` below would hand the second close a different open
  // dispatch: one bracket becomes two, a genuinely open worker vanishes out of
  // `unpaired`, and the role is billed for a dispatch that never happened.
  //
  // The rule, and it holds in EITHER arrival order: the first terminal to find
  // a pending dispatch for a worker key PAIRS and owns the row's identity. A
  // later terminal for that same key that finds NO pending dispatch is a REPEAT
  // CLOSE of that row - it adds no bracket and no `unpaired` row, its figures
  // fill fields the row left empty, and it funds nothing the row was already
  // funded for.
  //
  // A terminal that never had a pending dispatch AT ALL is a different input
  // and keeps today's behaviour: a close whose dispatch fell outside the
  // `--phase` filter or above the read cap still bills its own role and opens
  // no bracket. Collapsing the two would drop figures the record keeps.
  /** @type {Map<string, {row: any, entry: any}>} worker key -> the row it opened */
  const pairedRows = new Map();
  for (const e of out.events) {
    // Every family feeds the RUN's end-of-record mark, not the lifecycle one
    // alone: the coordinator's last step is still running while the routing and
    // outcome events it produced are being written, so an end taken from
    // lifecycle events only would stop the clock early.
    const t = millis(e.ts);
    if (t !== null) {
      const row = coordRow(e.corr);
      if (t > row.last) row.last = t;
    }

    if (e.family !== 'lifecycle') continue;

    // The marker is collected HERE rather than in the per-role chain below, so
    // that chain keeps billing only the workers a DISPATCH opened: a coordinator
    // event carries no `--role` at all (D-07), and a branch that keyed the empty
    // string would render a nameless worker row through `workflows/progress.md`.
    if (e.event === COORDINATOR) {
      if (t !== null) coordRow(e.corr).markers.push({ phase: e.phase, step: e.step, ts: e.ts, t });
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
    // The same guard, for the same reason: a non-numeric or non-finite `turns`
    // on a hand-edited or foreign-producer line contributes NOTHING and is
    // never string-concatenated onto a total.
    const turns = typeof e.turns === 'number' && Number.isFinite(e.turns) ? e.turns : null;
    // And again for the wall clock the host reported. Guarded identically
    // because the hazard is identical: a hand-edited or foreign-producer line
    // carrying `"duration_ms": "1m 23s"` must contribute NOTHING rather than be
    // string-concatenated onto a numeric field a caller sums.
    const duration = typeof e.duration_ms === 'number' && Number.isFinite(e.duration_ms)
      ? e.duration_ms : null;

    const worker = `${key(e.corr)}\0${key(e.phase)}\0${key(e.plan)}`;
    if (e.event === DISPATCH) {
      const role = key(e.role);
      const row = roleRow(role);
      row.dispatches++;
      // A figure on the OPEN half is unusual - prose writes it at the close -
      // but it is counted rather than dropped, and it marks THIS dispatch
      // funded so its own terminal cannot fund it a second time.
      const entry = {
        corr: e.corr, phase: e.phase, plan: e.plan, ts: e.ts, role,
        funded: false, tokens: null, turnsFunded: false, turns: null,
      };
      if (tokens !== null) { row.tokens += tokens; row.recorded++; row.figures++; entry.funded = true; entry.tokens = tokens; }
      // Funded SEPARATELY from the token half: a dispatch already marked funded
      // by a token figure must still be able to have its turn count recorded,
      // and neither flag may let one dispatch be counted twice on its own side.
      if (turns !== null) {
        row.turns += turns; row.turnsRecorded++; row.turnsFigures++;
        entry.turnsFunded = true; entry.turns = turns;
      }
      const pending = open.get(worker) || [];
      pending.push(entry);
      open.set(worker, pending);
    } else if (TERMINAL.includes(e.event)) {
      // A byte-identical repeat of an earlier terminal is a REPLAY: it pairs
      // with nothing, funds nothing, adds no tokens and opens no coordinator
      // span. It still sits in `out.events` and in `counts`, because the render
      // reports the file rather than editing it. A second close differing only
      // in `role` is NOT a replay - it pairs normally and surfaces in
      // `mismatched` above, and a real replay carries the same role, so
      // discriminating on role costs this rule nothing.
      // The turn figure discriminates a replay exactly as the token figure
      // does: two closes differing only in their turn count are two closes, not
      // one replay, and folding them would drop a real figure off the record.
      const identity = `${worker}\0${e.event}\0${key(e.role)}\0${key(e.ts)}\0${tokens === null ? '' : tokens}\0${turns === null ? '' : turns}`;
      if (seenTerminals.has(identity)) continue;
      seenTerminals.add(identity);

      const pending = open.get(worker);
      // THE DELAYED REPEAT (D-05). A close that arrives after the NEXT dispatch
      // of the same worker key is handed that dispatch by the FIFO
      // `pending.shift()` below - the STEAL, whose tell on the record is the
      // stolen row's NEGATIVE `ms`, because the row's start is the later
      // dispatch's `ts` while its end is the earlier close's. It is reachable
      // whenever a writer is delayed past the retry that follows it: the host's
      // `SubagentStop` hook fires when the host decides, not when the
      // orchestrator reaches its close step, so a retried plan can see the
      // first attempt's hook close land after the second attempt's dispatch.
      // The cost of the steal is not one wrong row: the row it opens is funded,
      // so the role is billed for all three terminals and the retry's own
      // figures land on a bracket that never happened.
      //
      // The discriminator is the TIMESTAMP relation, and it is deliberately
      // narrow. A terminal is a repeat close of a row this key ALREADY opened,
      // never a pairing, only when all three hold: both clocks parse, the
      // terminal's instant is strictly EARLIER than the head pending dispatch's,
      // and `pairedRows` holds a row for this worker key. Miss any one and
      // today's FIFO pairing stands unchanged - an unreadable clock must never
      // silently reclassify a genuine close, which is the posture `millis`
      // states at the top of this file, and with no row on the key there is
      // nothing for a repeat to fold into.
      //
      // The worker key and the `seenTerminals` replay identity are UNTOUCHED
      // (D-01). Widening that identity is the alternative this rule replaces,
      // and it stays refused for the reason stated above it: dropping the
      // millisecond folds two GENUINE dispatches on one key into one bracket.
      const head = pending && pending.length ? pending[0] : null;
      const headT = head ? millis(head.ts) : null;
      const delayedRepeat = head !== null && t !== null && headT !== null
        && t < headT && pairedRows.has(worker);
      let matched = head && !delayedRepeat ? pending.shift() : null;
      // A REPEAT CLOSE: nothing left open on this worker key, but a row this
      // key already opened is on the record, so this is the second writer
      // closing the same bracket rather than a stray terminal. It adopts the
      // first writer's pending entry, which is what makes the `funded` and
      // `turnsFunded` flags below bill the dispatch exactly once whichever
      // writer arrived first.
      const repeat = matched ? null : pairedRows.get(worker);
      if (repeat) matched = repeat.entry;
      // A bracket contributes its span to the residue only once it has PAIRED,
      // which is why the span is taken here and not from the dispatch half: an
      // unpaired dispatch (the fixture's 13:51:44 `cad-reviewer` is one) has no
      // known end, and inventing one - the phase's last event, say - would
      // subtract a worker's whole tail from the coordinator's bill and hide the
      // gap the marker exists to show.
      if (matched && !repeat) {
        const a = millis(matched.ts);
        if (a !== null && t !== null && t > a) coordRow(e.corr).spans.push({ a, b: t });
        // The bracket ROW, taken here because this is the one place the two
        // halves are both in hand. `ms` is null rather than 0 when either
        // timestamp is unreadable: a duration of zero and a duration nobody
        // could compute are different answers, the same posture the token
        // figure already takes. `tokens` prefers the terminal's figure and
        // falls back to one the dispatch half carried, which is exactly what
        // the per-role accounting below bills.
        const bracketRow = {
          corr: e.corr, phase: e.phase, plan: e.plan, role: matched.role,
          event: e.event, ts: matched.ts, end: e.ts,
          ms: a !== null && t !== null ? t - a : null,
          tokens: tokens !== null ? tokens : matched.tokens,
          // `turns` is the one bracket field that is OMITTED rather than null
          // when no figure exists. `ms` and `tokens` predate the flag and a
          // reader already expects those keys on every row, but a `turns: null`
          // would put a NEW key on every bracket of every trace written before
          // the flag - the exact opposite of the omit-not-zero rule at the
          // writer, and it would contradict the role row one clause below,
          // which emits no turn key at all where nothing landed.
          ...(turns !== null || matched.turns !== null
            ? { turns: turns !== null ? turns : matched.turns }
            : {}),
          // OMITTED for the reason `turns` is, and taken off the TERMINAL
          // alone: `--duration-ms` is declared on the close row only, so a
          // dispatch half has no wall clock to fall back to. It is NOT derived
          // from the two timestamps - `ms` one clause above already is that
          // quantity, and it measures the step rather than the worker.
          ...(duration !== null ? { duration_ms: duration } : {}),
          // The worker's host id, off the TERMINAL alone - the dispatch half
          // never has one. OMITTED when neither writer carried it, the same
          // rule `turns` and `duration_ms` follow, so a record written before
          // the flag grows no new key. `lib/subagent-trace.mjs` reads this to
          // recognise a worker whose bracket is already closed.
          ...(e.agent_id ? { agent_id: e.agent_id } : {}),
        };
        out.brackets.push(bracketRow);
        // The row this worker key now owns, so a SECOND close of it folds in
        // here instead of opening a row of its own. Overwritten by a later
        // genuine pairing on the same key, which is what keeps a real
        // dispatch/close/dispatch/close sequence two brackets: the dedup
        // collapses a repeat CLOSE, never a repeat DISPATCH.
        pairedRows.set(worker, { row: bracketRow, entry: matched });
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
      } else if (repeat) {
        // The FOLD. Each figure fills a field the row left empty and never
        // overwrites one the first writer already supplied: the two closes are
        // describing one dispatch, and the writer that had a figure is the one
        // that read it off the return.
        const b = repeat.row;
        if (b.tokens === null && tokens !== null) b.tokens = tokens;
        if (!('turns' in b) && turns !== null) b.turns = turns;
        if (!('duration_ms' in b) && duration !== null) b.duration_ms = duration;
        // The arm upgrades in ONE direction and never back. A figureless writer
        // that happened to run first would otherwise turn every checkpoint into
        // a clean `return` - billing a worker that came back unusable as a
        // clean close, the one arm this record exists to keep separate (the
        // TERMINAL contract at the top of this file). `e.event` is already
        // known to be a terminal, so "not `return`" is exactly "`checkpoint` or
        // `escalation`" without re-enumerating them.
        if (b.event === 'return' && e.event !== 'return') b.event = e.event;
        // No `mismatched` row and no coordinator span: both are the PAIRING's
        // to report, and today a terminal with nothing pending contributes
        // neither. A repeat close reporting a second span would subtract one
        // worker's time from the coordinator's bill twice.
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
      if (turns !== null) {
        // Bills the DISPATCH's role, on the same authority and with the same
        // unmatched-terminal fallback the token half states directly above:
        // the dispatch is the half that opened the worker.
        const row = roleRow(matched ? matched.role : key(e.role));
        row.turns += turns;
        row.turnsFigures++;
        if (matched && !matched.turnsFunded) { row.turnsRecorded++; matched.turnsFunded = true; }
      }
    }
  }
  // `unpaired` carries the bracket's identity plus the `role` the DISPATCH was
  // opened under - a field the pairing already computed rather than a second
  // answer derived here. The remaining accounting fields (`funded`,
  // `turnsFunded` and the two figures) stay internal and never reach the
  // rendered shape.
  for (const pending of open.values()) {
    for (const p of pending) {
      out.unpaired.push({ corr: p.corr, phase: p.phase, plan: p.plan, ts: p.ts, role: p.role });
    }
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
  //
  // BOTH turn keys are gated on `turnsFigures`, which is where they part from
  // the token pair: `unrecorded` is emitted whenever it is nonzero, but a
  // `turns_unrecorded` on the same footing would put a new key on every role of
  // every trace written before the flag existed - the committed
  // `fixtures/verbatim.trace.jsonl` carries no turn field on any of its 52
  // lines, and its rendered `roles` is pinned byte-for-byte as the proof this
  // change is invisible on an old record (D-12). So a role that reported no
  // turns at all is ABSENT from the turn accounting rather than reported as
  // wholly unrecorded, and `turns_unrecorded` reads as "of the dispatches this
  // role did report turns for, N reported none".
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

  // The coordinator's own time, computed ONCE here rather than by each reader.
  // `/cad-report` and `trace suggest` both read this block, so the two cannot
  // report different numbers for the same run - the arithmetic is D-01's, and
  // the only thing that changed is that it lives in one place.
  //
  // A step's window runs from its marker to the NEXT marker in the same RUN,
  // and the last marker's window ends at that run's own last event - never at a
  // later run that happens to share the phase number (D-01). Inside the
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
