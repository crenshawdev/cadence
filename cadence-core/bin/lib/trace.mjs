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
  appendFileSync, closeSync, existsSync, linkSync, lstatSync, openSync, readFileSync,
  readSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/** The trace file's name inside a planning root. */
export const TRACE_FILE = 'trace.jsonl';

/**
 * The rotated generation's spelling, stated ONCE here so the writer, the
 * reader, this repository's `.gitignore` rule and every test read the same
 * name and cannot drift apart.
 *
 * Suffix BEFORE the extension, the shape `lib/report-rotation.mjs` already uses
 * for `plan-<k>.<n>.md`, and it keeps `.jsonl` so the sibling is still
 * recognisably the record rather than an opaque backup.
 *
 * The path is FIXED, and that fixity is how exactly ONE generation is kept
 * (D-05): a second rotation EVICTS the first rather than minting a
 * `trace.2.jsonl` beside it, so the pair on disk is bounded at twice
 * `MAX_TRACE_BYTES` with no retention key to tune. That is the same posture the
 * bound itself takes one clause below - a constant beside the code that
 * enforces it, like `MAX_READS_BYTES` in lib/read-trace.mjs and
 * `MAX_TRANSCRIPT_BYTES` in bin/subagent-trace.mjs.
 *
 * NOTHING READS IT. It holds the generations of runs that have already ended,
 * kept so a rotation stays recoverable by hand; every reader in the tree still
 * reads `TRACE_FILE` alone, and `renderTrace` reports that a rotation happened
 * rather than joining the two files back together.
 */
export const ROTATED_TRACE_FILE = 'trace.1.jsonl';

/**
 * The claim SIDECAR's spelling, stated ONCE here for the same reason the
 * rotated generation's is: the writer, the staleness reader, this repository's
 * `.gitignore` rule and every test read the name from this one place and cannot
 * drift apart. DERIVED from `ROTATED_TRACE_FILE` rather than respelled, so the
 * two names cannot come apart either, and it keeps the record's own `trace.`
 * prefix because `siblings()` in `trace.test.mjs` filters on exactly that - a
 * name outside the prefix would silently stop a leaked sidecar reddening the
 * six-writer race row.
 *
 * WHY A SEPARATE FILE AT ALL (TRC-09, D-01). A claim abandoned by a killed
 * process is indistinguishable from a live one on every property the claim
 * itself carries: the claim IS a hard link, so the sibling and the live record
 * are one inode until the swap, and every `appendFileSync` into the record
 * bumps that shared inode's `mtime` and `ctime` (measured 2026-08-27, a
 * sidecar-less claim's age reads 0.86-0.88 ms on every append into an ABANDONED
 * state). `birthtime` is no better - it dates the current generation, not the
 * claim. Only a file written beside the claim can carry the claim's own age.
 *
 * Its CONTENT is diagnostic only. The single property any arm in this module
 * takes off it is its `mtime`; nothing here reads or parses its bytes, and it
 * carries no pid, because D-01 rejected `process.kill(pid, 0)` liveness - no
 * precedent anywhere in `bin/lib/*.mjs`, and it degrades on a foreign host and
 * on a network `.planning` root.
 */
export const ROTATION_CLAIM_FILE = `${ROTATED_TRACE_FILE}.claim`;

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
 * The two cache figures a close may carry, in the host's own spelling. They
 * reach the record from ONE writer and cannot reach it from any other: the
 * host renders `tokens`, `turns` and a duration on a subagent return and no
 * cache figure at all, so only the `SubagentStop` hook - which holds the
 * worker's own transcript - can sum them (`lib/subagent-transcript.mjs`).
 * There is deliberately no `trace close` flag for either.
 */
const CACHE_KEYS = ['cache_creation_input_tokens', 'cache_read_input_tokens'];

/**
 * Whether `from`'s figure for `k` is a MORE COMPLETE read than what `into`
 * already holds - the rule all three cache-folding sites in this file share.
 *
 * THE LARGER VALUE WINS, per key and independently, and that is deliberately
 * NOT the fill-only-empty rule `tokens`, `turns`, `duration_ms` and `agent_id`
 * follow one clause away. Those four have TWO writers each holding part of the
 * truth, and the writer that had the figure is the one that read it off the
 * return, so the first value to arrive is the authoritative one. These two keys
 * have exactly ONE writer - the `SubagentStop` hook, summing the worker's own
 * transcript - so there is no second writer for that rule to protect, and two
 * values for one worker are two reads of a file that only GROWS. Keeping
 * whichever landed first freezes a partial sum onto the record permanently.
 *
 * A larger value therefore means a more complete read of the same transcript.
 * It never means a second worker's traffic added on: the pair is already scoped
 * to one `corr` and one `agent_id`. And the rule deliberately refuses to SUM
 * two reads, which would double-bill every turn both of them covered.
 *
 * This is the monotonic posture the repeat-close arm already takes for `end`
 * and `ms`, on the same argument: a rule that keeps whichever value landed
 * first understates a quantity that only grows.
 *
 * @param {Record<string, any>} into the row or map entry holding the figure
 * @param {Record<string, number>} from the figures that just arrived
 * @param {string} k
 * @returns {boolean}
 */
function moreComplete(into, from, k) {
  return k in from && (!(k in into) || from[k] > into[k]);
}

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

/**
 * The lifecycle event a stopped worker's CACHE FIGURES ride when no close can
 * carry them. `SubagentStop` withholds its `return` on three separate gates -
 * the worker did not terminate, its bracket is already closed, or two
 * dispatches of its role are open and the evidence cannot separate them - and
 * every one of those paths used to throw the two cache sums away with the
 * close. Nothing else on the record ever holds them: the host renders no cache
 * figure on a return, so the hook that reads the worker's own transcript is the
 * only writer there is. This name is what lets that hook state the figures
 * WITHOUT stating a close.
 *
 * It is a fifth lifecycle NAME and not a fifth family, for the reason
 * `COORDINATOR` states one clause above: `FAMILIES` is validated at the seam
 * while `renderTrace`'s `counts` is a fixed four-key literal, so a fifth family
 * would write fine and count nowhere.
 *
 * It must NEVER join `TERMINAL`. A name in that array re-enters `seenTerminals`,
 * the FIFO `pending.shift()` and the `funded`/`turnsFunded` accounting, which
 * would open and close a bracket for a worker that never returned - the exact
 * defect the three gates exist to prevent. So it falls through both the
 * `DISPATCH` branch and the `TERMINAL` branch untouched: it creates no bracket,
 * no `unpaired` row and no role row, and the only things it moves are
 * `counts.lifecycle` and the per-`corr` `last` instant every family feeds.
 * `renderTrace`'s post-pass is what joins it to the bracket it names.
 */
export const WORKER_CACHE = 'worker_cache';

/**
 * The lifecycle event a ROTATION writes as the last line of the record it
 * created, so a reader can say that the cut happened rather than infer it from
 * events that are no longer there.
 *
 * It is another lifecycle NAME and not a fifth FAMILY, for the reason
 * `COORDINATOR` states two clauses above: `FAMILIES` is validated at the seam
 * while `renderTrace`'s `counts` is a fixed four-key literal, so a new family
 * would write fine and count nowhere. And it must NEVER join `TERMINAL`, for
 * the reason `WORKER_CACHE` states: a name in that array re-enters the pairing
 * and would open and close a bracket for a worker that never ran.
 *
 * It carries the rotated sibling's name and the instant, and it takes the
 * `corr` and `phase` of the ANCHOR carried above it - the run in flight - so it
 * files under the run whose record was cut rather than minting an id of its
 * own. Where the record held no anchor to carry, it files under no phase at
 * all, which is exactly what a rotation of a record with no run in it did.
 *
 * It is INERT in the renderer by design (D-08): it opens nothing, closes
 * nothing and pairs with nothing, and it reaches none of the four shipped prose
 * readers, whose default response carries brackets plus `outcome` events only.
 * That is why the signal a reader acts on is the `rotated` field on the render
 * ENVELOPE, which this event is only the evidence for.
 */
export const ROTATION = 'record_rotated';

/** @param {string} planningRoot */
export function tracePath(planningRoot) {
  return join(planningRoot, TRACE_FILE);
}

/**
 * Where the rotated generation lives. Derived from `ROTATED_TRACE_FILE` so a
 * caller that has to name the file - the `.gitignore` rule `trace ignore`
 * writes is the only one - names what the writer actually produces.
 * @param {string} planningRoot
 */
export function rotatedTracePath(planningRoot) {
  return join(planningRoot, ROTATED_TRACE_FILE);
}

/**
 * Where the claim sidecar lives. Derived from `ROTATION_CLAIM_FILE` the way the
 * line above derives the generation's path, so a test or a `.gitignore` rule
 * that has to name the file names what the writer actually produces.
 * @param {string} planningRoot
 */
export function rotationClaimPath(planningRoot) {
  return join(planningRoot, ROTATION_CLAIM_FILE);
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
 * bound alone does not protect this side: the writer now ROTATES at that bound
 * rather than refusing, and a fresh record whose carried tail could not be
 * trimmed under it (the degenerate arm `freshRecord` states) is over the cap by
 * construction, while a trace that was corrupted, hand-edited, or written by a
 * producer outside this seam has no bound at all. Reading it whole is a
 * synchronous `readFileSync` + `split` +
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
 * The rotation marker a cut of THIS record would write, and where the tail that
 * cut would carry begins.
 *
 * ONE SPELLING, TWO CALLERS. `freshRecord` writes this line into the fresh
 * record; `appendEvent`'s size arm measures it to decide whether the pending
 * event has room to sit beside it. Building it in one place is what stops the
 * reserve from drifting away from the line the rotation actually writes - a
 * reserve short by one byte is exactly the defect the reserve exists to close.
 *
 * It is written as part of the rotation's own fresh-file write rather than
 * through `appendEvent`, which would re-enter the size arm that called it.
 *
 * The marker takes the `corr` and `phase` of the newest ANCHOR in the record -
 * the run in flight - so it files under the run whose record was cut. That is
 * also why its size cannot be a constant: `phase` reaches the record
 * caller-supplied and unvalidated, so only measuring answers.
 *
 * `carried_bytes` SEALS THE GENERATION, and it is not telemetry. It is the byte
 * length of `text` at the instant the claim read it - how much of the file this
 * cut carried away and therefore accounted for. Its ONE consumer is the
 * leftover-generation eviction in `rotateTrace`: a writer that appended into the
 * old inode after this cut's carry-back loop ended left its bytes only in the
 * generation, and the next rotation is about to destroy that generation. The
 * sealed number is what tells that writer where this cut stopped accounting, so
 * it can finish the carry-back over the bytes past it rather than guess an
 * offset or re-append a whole generation. It must therefore be the SEALED size
 * and never an estimate.
 * @param {string} text the whole record a cut would carry away
 * @returns {{lines: string[], at: number, corr: string, marker: string}} `at` is
 *   the index of the anchor line in `lines`, or `-1` where the record holds no
 *   anchor at all - in which case there is no tail and the marker is the whole
 *   fresh record.
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
    // The id the run in flight is ALREADY writing, read off the anchor rather
    // than re-derived: `renderEvent` stored it there at write time, and a
    // re-derivation here would answer about the file after the cut.
    anchorCorr = typeof e.corr === 'string' && e.corr ? e.corr : key(e.phase);
    anchorPhase = e.phase;
    break;
  }
  // The same fixed key order `renderEvent` writes, so the marker is an ordinary
  // line of the record rather than a differently shaped one. `phase` is
  // `undefined` where no anchor was carried and drops out of the JSON entirely.
  // `carried_bytes` rides after `file`, as an ordinary trailing field of that
  // fixed order - `renderTrace`'s `rotated` derivation takes `file` and `ts`
  // only, so it reaches no envelope.
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
 * The whole body of the record a rotation writes: the NEWEST
 * `lifecycle/phase_start` line and every line after it, then the rotation
 * marker. Where the record holds no anchor at all, the marker alone.
 *
 * WHY A TAIL AND NOT A WHOLE-FILE RENAME (D-01). `correlationId` scans BACKWARD
 * from the end for that anchor and returns the bare `<phase>` when it finds
 * none, so a rotation that carried nothing forward would leave every
 * post-rotation event of the run in flight deriving `<phase>` while its own
 * dispatch half - written before the cut - carries `<phase>-<sha>`. One run,
 * two ids: `planning/risk-check.mjs`'s corr-scoped lookup and the triage gate's
 * prior-`rearm` lookup would both miss, and the one-re-arm cap on the only
 * blocking trigger would fail OPEN. Carrying the anchor is also what keeps
 * `renderTrace`'s brackets whole across the cut, which is what a caller
 * rendering the run immediately before and immediately after a rotation sees.
 *
 * Measured on this repository 2026-08-26: the newest anchor sat at byte 597,177
 * of 604,183, so the carried tail was ~7 KB - 1.2% of the record, against 83
 * anchors and 88 distinct `corr` in it. The cut is cheap because anchors are
 * frequent, not because the tail is trimmed.
 *
 * THE BOUND, and the ONLY thing it may drop. `reserve` is what the fresh file
 * owes beyond this tail - the pending line, plus whatever the rotation itself
 * writes - and the tail is trimmed until the whole fresh file fits under
 * `MAX_TRACE_BYTES`. Trimming drops post-anchor lines OLDEST-FIRST and only
 * ones carrying some OTHER `corr`: a line under the anchor's own id is a
 * dispatch or a close half of the run in flight, and dropping one changes the
 * bracket count across the rotation, which is the unqualified criterion this
 * whole rule is subordinate to. The anchor line itself is never dropped.
 *
 * WHERE EVEN THAT DOES NOT FIT, the tail is carried anyway and the fresh file
 * sits over the bound. Refusing there would re-create the write-death this
 * rotation exists to remove, and dropping a bracket half would break the count;
 * the cost is that the next append rotates again, bounded by how fast one run
 * can write a bound's worth of events under a single anchor.
 * THE MARKER is the last line of what this returns, after the carried tail, so
 * the tail's own order is untouched and the marker sits under the anchor whose
 * `corr` it takes. `rotationMarker` below builds it; its own bytes are counted
 * against the bound here, so the reserve a caller passes is the pending line
 * alone.
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
    // A line whose `corr` cannot be read is not the run in flight's - a
    // malformed or foreign-producer line pairs with nothing, so dropping it
    // under pressure cannot change a bracket count.
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
 * How long a writer that finds a rotation IN FLIGHT waits for it to land before
 * appending anyway. Milliseconds, and a ceiling rather than a deadline: the
 * common wait is the one or two milliseconds a claim takes to read the record
 * and swap a fresh one in. The budget only matters where the winner died
 * holding its claim, and there the writer appends into the record it can still
 * reach rather than failing.
 */
const ROTATE_WAIT_MS = 250;

/**
 * How old a claim's sidecar has to be before the claim is read as ABANDONED and
 * reclaimed (TRC-09). A constant beside the code that enforces it, never a
 * config key - the posture `MAX_TRACE_BYTES`, `ROTATED_TRACE_FILE`,
 * `ROTATE_WAIT_MS` and `lib/capture-file.mjs`'s `LOCK_STALE_MS` all take.
 *
 * Two figures set the value. It is about 4,600x the slowest full 1 MiB rotation
 * measured on this repository (3.17-6.50 ms over five runs, 2026-08-27), so a
 * live claim is nowhere near it - the margin is against a machine suspended
 * mid-rotation, not against a slow write. And it bounds the DEGRADED window: a
 * claim nobody will ever release costs about 252 ms an append until it is aged
 * out, so a `LOCK_STALE_MS`-sized 120 s would charge four times as much for the
 * same safety.
 */
const CLAIM_STALE_MS = 30_000;

/** @param {number} ms */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Is the sibling that already exists a rotation IN FLIGHT, or a generation an
 * earlier rotation left behind?
 *
 * The claim below is a hard LINK, so between the claim and the swap the live
 * path and the sibling are the same inode. That identity is the discriminator,
 * and it has to be one: treating an in-flight claim as a stale generation would
 * evict a claim a concurrent writer is still holding, and treating a stale
 * generation as in flight would leave the record unable to rotate a second
 * time - the write-death this whole arm removes, one indirection down.
 *
 * UNKNOWABLE READS AS IN FLIGHT. Where a platform supplies no inode (Node
 * reports `0`) or either stat fails, the safe answer is the one that never
 * evicts: it costs a deferred rotation, and the append still lands.
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
 * Has the claim that `rotationInFlight` just called in flight actually been
 * ABANDONED - taken by a process that was killed or timed out before it could
 * release it? `rotationInFlight` cannot answer this and must not be asked to:
 * measured 2026-08-27, a live claim and an abandoned one are byte-identical to
 * it, same `ino`, same `dev`, `nlink === 2`. Only the sidecar's age separates
 * them.
 *
 * UNKNOWABLE READS AS LIVE, the same posture the predicate above takes one
 * clause up. True only where `statSync` returns an `mtimeMs` strictly further
 * in the past than `CLAIM_STALE_MS`; an absent sidecar, a stat that throws and
 * an `mtime` in the future from a skewed clock all answer false. The asymmetry
 * is what makes that the only safe default: a wrong LIVE answer costs one
 * deferred rotation, and a wrong ABANDONED answer costs the whole record - the
 * holder's `readFileSync(sibling)` gets ENOENT, `carried` falls back to '', and
 * it swaps a record holding only the rotation marker over the live path while
 * the evictor's `finally` unlinks the last remaining name of the old inode.
 *
 * Failing live is also what makes this shippable before every claim in the wild
 * carries a sidecar: a claim taken by the code that shipped before TRC-09 has
 * none at all, and reads exactly as it did then.
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
 * Claim the record, swap a fresh one in carrying the run in flight, and hand
 * the old generation to `ROTATED_TRACE_FILE`.
 *
 * NO LOCK (D-03). `withPlanningFileLock` is refused here on purpose: the
 * `SubagentStop` hook writes through this function, and its own contract
 * forbids it to speak on the path a lock refusal would have to be reported on.
 * The concurrency to design against is cross-PROCESS - the hook renders the
 * record and then appends under a 10-second host timeout, so a rotation landing
 * between those two calls is a real interleaving, not a theoretical one.
 *
 * THE CLAIM IS `linkSync`, NOT `renameSync`. A rename REPLACES its destination
 * silently, so a writer still holding a stale stat would rename a live path
 * that a completed rotation had already re-created: the winner's generation is
 * destroyed, its events end up in the sibling, and exactly one sibling still
 * exists - so a count-based check would call that healthy. `linkSync` fails
 * `EEXIST` instead, which is atomic, single-winner, and REFUSES the claim
 * rather than detecting the damage after the fact, which no rename-back could
 * recover from. It costs one syscall on the rotation path alone.
 *
 * NEVER A READ-MODIFY-WRITE (D-04). The old generation is produced by the claim
 * itself and the fresh file is written whole to a private path and renamed into
 * place, so the live path is never absent and no writer's append is trimmed
 * away by a rewrite it did not see. Append mode is what makes interleaved
 * writers lossless, and an event lost that way is indistinguishable on the
 * record from a worker that never returned.
 *
 * @param {string} planningRoot
 * @param {number} reserve bytes the fresh file owes beyond the carried tail
 * EXPORTED for one reason: the losing arm cannot be reached through
 * `appendEvent`, which re-stats the record and so can never be made to arrive
 * here holding a stale one. Calling it directly IS a writer that decided to
 * rotate before another writer's rotation landed, which is the interleaving the
 * claim has to refuse. Nothing in the tree calls it but `appendEvent`.
 * @returns {{rotated: boolean, reason?: string, shortfall?: number|null}}
 *   `reason` ONLY where the rotation failed outright; losing the claim is
 *   `{rotated:false}` and the caller appends, because somebody else already
 *   made room. `shortfall` rides a rotation that DID rotate and states the
 *   bytes of the destroyed generation its rescue could not carry - a number, or
 *   `null` where even their count could not be established. Absent means the
 *   tail is complete.
 */
export function rotateTrace(planningRoot, reserve) {
  const file = tracePath(planningRoot);
  const sibling = rotatedTracePath(planningRoot);
  const priv = `${process.pid}.${Math.random().toString(36).slice(2)}`;
  /** @type {string|null} */
  let temp = null;
  /** @type {string|null} */
  let evicted = null;
  // The evicted path, but ONLY where what was evicted is a leftover GENERATION.
  // That is the one eviction with bytes worth rescuing, and it has to be told
  // apart from the abandoned-claim eviction: there the evicted path is a second
  // name for the LIVE inode, so a rescue reading it would re-append the live
  // record to itself at an offset that seals some other generation entirely.
  /** @type {string|null} */
  let leftover = null;
  const claim = rotationClaimPath(planningRoot);
  /** @type {string|null} */
  let dated = null;
  // The `mtime` THIS process stamped on the sidecar, so the confirm below can
  // tell its own write apart from a refresh some other claimant made.
  /** @type {number|null} */
  let mine = null;
  // The claim is HELD from the link until the swap. While it is held the
  // sibling is only a second name for the live file, so every failure arm has
  // to release it - a claim left behind reads as a rotation in flight forever
  // and the record never rotates again.
  let held = false;
  // The stamp this process wrote, at its PRIVATE path, until the link says it
  // owns the claim the stamp dates. Cleared once it is renamed into place, so
  // the release arms know there is nothing private left to remove.
  /** @type {string|null} */
  let pending = null;
  /**
   * Move the private stamp onto the shared sidecar path. Called only from the
   * two arms that have established the claim is this process's to date, and
   * `mine` is what the confirm below tells its own publish apart by.
   */
  const publish = () => {
    if (!pending) return;
    try { renameSync(pending, claim); dated = claim; mine = statSync(claim).mtimeMs; }
    catch { mine = null; /* fail live: an undated claim reads as live */ }
    pending = null;
  };
  try {
    let claimed = false;
    for (let attempt = 0; attempt < 2 && !claimed; attempt++) {
      // READ THE AGE BEFORE PUBLISHING A NEW STAMP. Every publish below
      // overwrites the only evidence a killed claimant left, so an age read
      // after one is this process's own and the reclaim could never fire.
      // Declared out here because the `catch` arm is what consults it.
      let wasStale = false;
      try {
        wasStale = claimAbandoned(claim);
        // STAMP PRIVATE, PUBLISH ONLY WHERE THE CLAIM IS THIS PROCESS'S.
        // The stamp has to exist before the `linkSync`, because the window it
        // closes is the other way round: a stamp written after the link leaves
        // the claim HELD beside the aged file a previous run left, and a third
        // process reading that age concludes ABANDONED and evicts a LIVE claim
        // - which costs the whole record, not one rotation (the holder's
        // `readFileSync(sibling)` then gets ENOENT, `carried` falls back to '',
        // and it swaps a record holding only the rotation marker over the live
        // path).
        //
        // But writing it straight to `claim` writes a path this process does
        // not own yet, and then every append that LOSES the link has refreshed
        // somebody else's claim: on a record appended more often than
        // `CLAIM_STALE_MS` that restarts the staleness clock on every append
        // and the abandoned claim never ages into a reclaim at all (measured
        // 2026-08-27: three consecutive appends into an abandoned state each
        // read the sidecar at ~252 ms old, their own wait budget, with `nlink`
        // stuck at 2). Having the loser put back what it overwrote is not the
        // remedy either - that is a check-then-write on a shared path, so a
        // writer taking the claim between the check and the rewrite gets its
        // FRESH stamp rewound to the dead claim's age and reads as abandoned
        // while it is live, which is the record-destroying arm above.
        //
        // Naming the stamp with `priv` removes that race rather than narrowing
        // it. The loser unlinks a file nothing else can see, and the dead
        // claimant's `mtime` - the only evidence the reclaim has - is never
        // touched by a writer that did not win. Only two arms publish it, and
        // both have established the claim is theirs to date: the link
        // succeeded, or the sidecar read ABANDONED and this process is about to
        // evict it.
        //
        // A PLAIN overwrite, never `{flag:'wx'}`. The retry that follows an
        // eviction comes back through here with the same `priv`, so an
        // exclusive create would throw on this process's own leftover and turn
        // the reclaim TRC-09 exists to deliver into a failed rotation. The `wx`
        // on the `temp` write below is not the precedent - that path carries
        // `priv` AND is written once per call.
        //
        // A FAILED sidecar write is swallowed rather than allowed to decide
        // the rotation: no sidecar reads as LIVE (D-02), which is exactly the
        // behaviour that shipped before TRC-09, whereas letting the throw reach
        // the arm below would send an unwritable root down the no-hard-links
        // rename fallback it has no business taking.
        pending = `${claim}.${priv}`;
        try { writeFileSync(pending, `${new Date().toISOString()}\n`); }
        catch { pending = null; /* fail live: no sidecar reads as a live claim */ }
        linkSync(file, sibling);
        claimed = true;
        held = true;
        // THE CLAIM IS OURS - publish the stamp that dates it. One atomic
        // rename, and the only window it leaves is between the link and this
        // line, where the sidecar is still the aged one the dead claimant left.
        // The eviction arm's own confirm-after-claiming closes that: a third
        // writer that evicts on that stale age re-stats the sidecar, finds an
        // mtime that is not the one it published, and puts the sibling back
        // rather than breaking this live claim.
        publish();
      } catch (e) {
        const code = e && /** @type {any} */ (e).code;
        if (code === 'ENOENT') return { rotated: false };
        if (code !== 'EEXIST') {
          // No hard links on this filesystem. FALL BACK to the replacing
          // rename and accept the window it leaves - never the other way
          // round, because the window is exactly what the link closes.
          //
          // No claim is HELD on this arm and the sibling is the generation
          // rather than a second name for the live file, so the stamp this
          // process wrote dates nothing. It was never published - the link is
          // what publishes it and the link is what just failed - so it is still
          // at the private path and the `finally` drops it. Nothing shared was
          // touched, which is the whole point of stamping private.
          try { renameSync(file, sibling); claimed = true; } catch { return { rotated: false }; }
          break;
        }
        // Somebody else holds the claim. WAIT for their swap before handing the
        // caller back to its append (D-03's re-stat-and-append arm): while the
        // claim is held the live PATH is still the old inode, so an append made
        // now lands in the sibling instead of the record. It is not a lock - it
        // acquires nothing, blocks nobody, refuses nothing, and it always
        // proceeds when the budget runs out, so the `SubagentStop` hook never
        // has a lock refusal to report on a path its contract forbids it to
        // speak on. It is bounded far under that hook's own 10-second timeout.
        //
        // UNLESS the claim was ABANDONED (TRC-09). A claimant killed or timed
        // out mid-rotation never runs its `finally`, so the claim stands
        // forever: the record never write-deads, but the bound it promises is
        // gone and every append pays the full budget - 252, 252 and 255 ms over
        // three consecutive appends measured 2026-08-27, each returning
        // `{written:true}`, with the live file growing past 1,048,576 bytes the
        // whole time. Shortening or skipping that budget is NOT the remedy: the
        // trigger is re-read from `statSync(file).size` on every call, so a
        // record left over the bound comes straight back into this arm and only
        // a COMPLETED rotation ends the state. The sidecar's age is consulted
        // ONLY here, where `rotationInFlight` answered true; where the sibling
        // is a different inode it is a leftover generation, and that arm's own
        // discriminator already shipped and answers on its own.
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
        // A generation an earlier rotation left, and evicting it is the one
        // DESTRUCTIVE act on this path - so re-stat first and never rotate a
        // file this writer did not observe over the trigger. The interleaving
        // that makes this load-bearing: A rotates and writes a fresh live file
        // while B is still holding the stat that sent it here, and B would
        // otherwise carry that fresh file away, destroy the generation A just
        // made and leave the record with nothing in it. `EEXIST` cannot see
        // that case - the sibling exists in both - and a check after the fact
        // is too late, so the claim is REFUSED rather than detected.
        let now = null;
        try { now = statSync(file).size; } catch { return { rotated: false }; }
        if (now + reserve < MAX_TRACE_BYTES) return { rotated: false };
        // PUBLISH THE STAMP HERE, and on no other losing arm. The sidecar read
        // ABANDONED and this process is about to evict the claim it dates, so
        // it is this process's to date - the one thing every other loser has
        // not established. It also has to happen BEFORE the eviction, because
        // the confirm below is what tells a second reclaimer's publish from
        // this one's and it reads the mtime this line leaves.
        publish();
        // Evict SINGLE-WINNER, the way lib/capture-file.mjs breaks a stale
        // lock: exactly one contender renames it to a private path and the
        // losers get `ENOENT`.
        const path = `${sibling}.evict.${priv}`;
        try { renameSync(sibling, path); } catch { return { rotated: false }; }
        evicted = path;
        if (!abandoned) leftover = path;
        // CONFIRM AFTER CLAIMING, on BOTH eviction arms, and before anything is
        // read or written - the same shape `lib/capture-file.mjs` uses to break
        // a stale lock. The rename above may have taken the sibling from a
        // claimant that arrived between the discriminator and here: a second
        // writer links, wins the claim, and stamps its own fresh sidecar, and
        // the mtime is no longer the one this process wrote. Breaking THAT claim
        // is not a deferred rotation, it is the whole record - the holder's
        // `readFileSync(sibling)` returns ENOENT, `carried` falls back to '',
        // and it swaps a record holding only the rotation marker over the live
        // path while this call's `finally` unlinks the last remaining name of
        // the old inode.
        //
        // THE LEFTOVER ARM NEEDS IT TOO (D-02), which reverses what shipped.
        // The exclusion argued that this arm's own discriminator already
        // answers, and it does not: `rotationInFlight(file, sibling)` was read
        // BEFORE the `renameSync(sibling, path)` above, so a writer that linked
        // in between has its live claim renamed away with nothing to put it
        // back. The discriminator answers about the instant it ran, and the
        // destructive act happens later - which is the whole reason a confirm
        // exists rather than a check.
        //
        // Put the sibling back only where nothing has taken the path meanwhile;
        // a plain rename back would clobber a claim a fourth writer legitimately
        // holds. Either way CLEAR `evicted`, so the release cannot delete a
        // claim that was just restored.
        let refreshed = false;
        try { refreshed = mine === null || statSync(claim).mtimeMs !== mine; } catch { refreshed = true; }
        if (refreshed) {
          try {
            if (!existsSync(sibling)) renameSync(path, sibling);
            else unlinkSync(path);
          } catch { /* it vanished under us - there is nothing left to restore */ }
          evicted = null;
          leftover = null;
          return { rotated: false };
        }
      }
    }
    if (!claimed) return { rotated: false };

    // Read AFTER the claim: only once the sibling is ours do we exclusively own
    // the bytes we are judging.
    let carried;
    try { carried = readFileSync(sibling, 'utf8'); } catch { carried = ''; }
    let seen = Buffer.byteLength(carried);

    temp = `${file}.rotate.${priv}`;
    writeFileSync(temp, freshRecord(carried, reserve), { flag: 'wx' });
    renameSync(temp, file);
    temp = null;
    held = false;

    // THE WINDOW, closed. Between the claim and the swap the live path still
    // named the old inode, so a concurrent writer's append landed in what is
    // now the sibling. Those bytes are read back and appended to the fresh
    // record here: a writer that was refused the claim must not also lose its
    // event, and a duplicate copy in a file nothing reads costs nothing. Whole
    // lines only, and bounded - a writer arriving after the swap opens the
    // fresh file and needs no recovery at all.
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

    // THE SECOND WINDOW, closed - the one the loop above cannot reach (D-05).
    // The loss is a TWO-STEP. Rotation 1 breaks off its carry-back the instant
    // the sibling stops growing, so a writer whose append landed in the old
    // inode a moment later has its bytes ONLY in the generation. Rotation 2 then
    // evicts that generation and the `finally` below unlinks it: the event is in
    // neither file, and nothing ever said so. So the writer that is about to
    // DESTROY a leftover generation finishes the carry-back the earlier rotation
    // started, here, at the last moment it can - after the swap, into the live
    // path, whole lines only, exactly as the loop above does.
    //
    // WHERE IT STARTS FROM. `carried` is the record this cut carried away, which
    // is the record rotation 1 wrote, so its newest rotation marker is rotation
    // 1's own and `carried_bytes` is the size that cut sealed the generation at.
    // Everything past that offset arrived after rotation 1 stopped accounting.
    //
    // NO SEAL, NO RESCUE. A generation left by the code that shipped before this
    // field carries no `carried_bytes`, and no offset can be guessed for it: the
    // choices are failing closed at the cost of one old event, or re-appending a
    // whole generation into a file readers actually read. It fails closed.
    //
    // SKIP WHAT IS ALREADY HERE, which is the one difference from the loop
    // above. There a duplicate lands in the generation, a file nothing reads;
    // here it lands in the live record, where a second copy of a bracket half
    // would change what `renderTrace` counts. Rotation 1's own carry-back
    // already put part of this delta into the record being carried, so the
    // overlap is expected rather than exceptional.
    //
    // AND IT NEVER DECIDES WHETHER THE ROTATION ROTATED. This function's
    // contract is that `reason` appears only where the rotation failed outright,
    // and a failed rescue is not that. But it must not be SILENT either - a tail
    // that cannot be completed has to be STATED, or the record is short by an
    // amount no reader can learn. Every failure arm - the stat, the read, the
    // line split, the append - reports `shortfall`: the bytes past the sealed
    // offset this call did not carry, taken from the stat rather than from what
    // was successfully read, because a read that threw established no count at
    // all. Where even the stat fails, `shortfall` is `null`: the tail was cut by
    // an unknown amount, which is still an answer. A caller that ignores the
    // field behaves exactly as it did before.
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
        // The NEWEST marker decides, and a non-numeric or negative seal is no
        // seal - a hand-edited or foreign-producer line must not aim a read.
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
      }
    }
    // Where the rescued lines leave the live record over the bound they are
    // carried anyway: that is the arm `freshRecord` already states, `renderTrace`
    // reports it as `capped`, and the next append rotates again.
    return shortfall === undefined ? { rotated: true } : { rotated: true, shortfall };
  } catch (e) {
    return { rotated: false, reason: (e && /** @type {any} */ (e).code) || 'rotate-failed' };
  } finally {
    // Leave nothing behind on ANY arm: no private temp, no unfinished claim, no
    // evicted generation.
    if (temp) { try { unlinkSync(temp); } catch { /* nothing to clean up */ } }
    if (held) { try { unlinkSync(sibling); } catch { /* nothing to release */ } }
    // GUARDED BY `held`, exactly as the release one line above is, and never
    // unconditionally. A claimant may delete only a sidecar it still owns.
    // `held` goes false at the swap while this process is still inside the
    // carry-back loop below it, so an unconditional unlink here would delete
    // the FRESH sidecar of a second process that took the claim legitimately in
    // that window - leaving a standing claim with no sidecar, which D-02 reads
    // as live forever and defeats TRC-09's reclaim permanently and silently.
    //
    // The consequence is deliberate: a rotation that COMPLETES leaves its
    // sidecar behind. That residue is INERT - once the swap has happened the
    // sibling is a separate inode, `rotationInFlight` is false, nothing reads
    // the sidecar, and the next claimant overwrites it before it links. The
    // `.gitignore` rule beside `/.planning/trace.1.jsonl` is what keeps it out
    // of a working tree's commits.
    if (held && dated) { try { unlinkSync(dated); } catch { /* nothing to release */ } }
    // A stamp this call never published dates nothing and belongs to nobody
    // else - it is at a path carrying `priv`, so no other process can see it.
    // Dropping it UNCONDITIONALLY is what keeps a losing append from touching
    // the shared sidecar at all, which is the whole reason the stamp is written
    // private: the dead claimant's `mtime` is the only evidence the reclaim
    // has, and an append that did not win the claim has no business refreshing
    // it. Every arm that DID publish cleared `pending` as it did so.
    if (pending) { try { unlinkSync(pending); } catch { /* nothing to clean up */ } }
    if (evicted) { try { unlinkSync(evicted); } catch { /* nothing to clean up */ } }
  }
}

/**
 * Append one event. NEVER throws, never writes to stdout or stderr: a trace that
 * cannot be written must leave its caller's envelope byte-identical. A trace
 * path that is a SYMLINK is refused with `reason:'symlinked-trace'` and nothing
 * is appended - the append would otherwise follow it out of the tree.
 *
 * The SIZE bound is not a refusal (TRC-08). At `MAX_TRACE_BYTES` the record
 * rotates and this append lands, so no writer is ever again told the record is
 * full; the two remaining size answers are `oversized-event`, for a single line
 * that reaches the bound by itself, and whatever code a rotation that could not
 * complete failed with.
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

  // RENDERED AHEAD of the size arm, which is a reordering and not a
  // rearrangement: the arm now needs this line's own byte length, because it
  // fires when the file PLUS this line would reach the bound rather than when
  // the file is already at it. The old arm admitted one last event that carried
  // the record past the bound, which is why every naturally grown record is a
  // line over it. Rendering is pure apart from the `correlationId` read, and
  // that read answers the same before a rotation and after one - the newest
  // anchor is exactly what the cut carries forward.
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

  // THE BOUND, enforced BEFORE the write and no longer a refusal. A record at
  // the bound used to answer `{written:false, reason:'size-cap'}` to every
  // writer for the rest of the project's life - permanent, silent write-death,
  // and the only thing that ever cleared it was a human noticing. It ROTATES
  // instead: the old generation becomes `ROTATED_TRACE_FILE`, the run in flight
  // is carried into a fresh record, and this append lands.
  //
  // Rotation lives HERE and nowhere else (D-02). Every writer in the tree - both
  // `route.mjs` sites, `review-provider.mjs`, the `SubagentStop` hook,
  // `planning/trace.mjs`, `task-record.mjs`, `risk-check.mjs`, `cite-count.mjs`
  // and `lease-check.mjs` - reaches the record through this function, so no call
  // site learns about rotation and none of them can be left write-dead.
  //
  // An absent file is the ordinary first write; any other stat failure is the
  // reason this append did not happen.
  let size = null;
  try {
    size = statSync(file).size;
  } catch (e) {
    const code = e && e.code;
    if (code !== 'ENOENT') return { written: false, reason: code || 'stat-failed' };
  }
  if (size !== null && size + pending >= MAX_TRACE_BYTES) {
    // THE MARKER IS RESERVED, not just the pending line. A rotation always
    // writes its marker into the fresh record, so an event that fits under the
    // bound by itself but not BESIDE the marker used to rotate and then land a
    // record over its bound on the very first write (measured 2026-08-30: 105 B
    // over). The reserve is what the rotation will actually write, so it is
    // MEASURED and never a constant: the marker embeds the carried anchor's
    // `corr` and `phase`, and `renderEvent` passes `phase` through unvalidated,
    // so no fixed number bounds it.
    //
    // On the SIZE ARM ONLY. This is the rotation path, which already reads the
    // record twice; the ordinary append path must not gain a read, because
    // every writer in the tree reaches the record through this function.
    //
    // The marker measured here can differ by a few bytes from the one written a
    // moment later - another writer may land an anchor in between, or the
    // record's own size may change the digits of `carried_bytes`. That is
    // acceptable for an admission check and is not a reason to move the check
    // into `rotateTrace` (D-06), which decides about the OLD record.
    //
    // A single line that reaches the bound on its own is REFUSED rather than
    // rotated. Rotating there throws the record away to make room for an event
    // that still would not fit, and the next append does it again - so the
    // reason is its own, distinguishable from the `size-cap` this arm replaces.
    // Reserving the marker DELIBERATELY moves a narrow band of event sizes -
    // between `MAX_TRACE_BYTES - marker` and `MAX_TRACE_BYTES` - from "rotate
    // and land" into that same refusal (D-09). It is the intended change, not a
    // regression: those events cannot be written under the bound either way.
    let owed = 0;
    try { owed = Buffer.byteLength(rotationMarker(readFileSync(file, 'utf8')).marker); }
    catch { /* unreadable here means the rotation below will fail on its own */ }
    if (pending + owed >= MAX_TRACE_BYTES) return { written: false, reason: 'oversized-event' };
    const rot = rotateTrace(planningRoot, pending);
    // Losing the claim is not a failure: somebody else already made the room,
    // and this writer appends into the record they left. Only a rotation that
    // FAILED carries a reason, and it is reported rather than appended past.
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
 * @property {{file: string, ts: any}} [rotated] present ONLY where the record
 *   carries a rotation marker, the way `coordinator` is present only where a
 *   coordinator marker is - so a record that never rotated renders
 *   byte-identically for every reader already parsing this envelope. It reports
 *   on the RECORD and not on the `--phase` scope, the same independence
 *   `capped` already has, because the cut took events of every phase away.
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
 * @property {{corr: any, phase: any, plan: any, role: string, event: any, ts: any, end: any, ms: number|null, tokens: number|null, turns?: number, duration_ms?: number, cache_creation_input_tokens?: number, cache_read_input_tokens?: number, agent_id?: string}[]} brackets
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
 *   THE CACHE FIGURES, and what they are NOT. `cache_creation_input_tokens` and
 *   `cache_read_input_tokens` are the worker's own billed cache traffic, summed
 *   across its transcript by the `SubagentStop` hook, which is the only writer
 *   that ever holds them. They reach a row by EITHER of two routes: on a close
 *   the hook was able to write, folded inline like every other close figure; or
 *   on a `WORKER_CACHE` fact, when the hook stopped a worker it could not close
 *   at all, folded by the post-pass that matches `corr` AND `agent_id`. The two
 *   routes share ONE rule and it is not the fill-only-empty one the fields
 *   beside them follow: the LARGER value wins, per key and independently. These
 *   two keys have exactly one writer, so two values for one worker are two
 *   reads of a transcript that only grows and the shorter one must never freeze
 *   the row - which also makes re-rendering the same file idempotent. They stop HERE
 *   either way: they never reach `roles`, and
 *   `roles.tokens` is byte-identical with and without them (D-03). The roles
 *   block bills what a RETURN reported - a final-window figure for one dispatch
 *   - while a cache read summed over turns counts one cached prefix once per
 *   turn, so adding one to the other would produce a number denominated in
 *   nothing. That is the same rule `cadence-core/workflows/report.md` states
 *   when it forbids a second, differently denominated window number.
 *
 *   `turns`, `duration_ms` and the two cache keys are the OPTIONAL keys: `ms`
 *   and `tokens` are on every row (null where they could not be computed),
 *   while a bracket whose close carried no tool-call count has no `turns` key,
 *   one whose close carried no wall clock has no `duration_ms` key, and one
 *   whose close reported no cache traffic has neither cache key at all - so a
 *   record written before any of those flags existed renders byte-identically.
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

  /** @type {any} the newest rotation marker in the record, or null for never */
  let rotated = null;

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
    // AHEAD of the phase filter, deliberately: a rotation cut events of EVERY
    // phase away, so the answer is a property of the record and not of the
    // scope a caller asked about - the same independence `out.capped` has,
    // taken off `statSync` before any filtering. The NEWEST marker wins, which
    // in line order is simply the last one seen.
    if (e.family === 'lifecycle' && e.event === ROTATION) rotated = e;
    if (wanted !== null && key(e.phase) !== wanted) continue;
    out.events.push(e);
    if (Object.prototype.hasOwnProperty.call(out.counts, e.family)) out.counts[e.family]++;
  }

  // The rotation signal, emitted the way `roles`, `coordinator` and `mismatched`
  // are - only where there is something to say. The sibling is named as THIS
  // reader can reach it rather than as the marker spells it: the marker's own
  // `file` is a name a hand-edited or foreign-producer line could put anything
  // in, and a field that pointed a reader at a path nobody read would be worse
  // than no field. Nothing opens it either way - no reader in the tree reads
  // the rotated generation.
  if (rotated) out.rotated = { file: rotatedTracePath(planningRoot), ts: rotated.ts };

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

  // THE CACHE-ONLY FACTS this pass collects and the post-pass below folds.
  // Keyed `corr\0agent_id` - both terms, never the id alone: measured
  // 2026-08-26 over 1,333 subagent transcripts, 7 of 1,323 distinct host ids
  // appear in two or more transcripts of the SAME project, so an unscoped
  // equality would land one session's figures on another's bracket. `corr` goes
  // through `key()` for the reason the worker key does: `1` and `"1"` are one
  // run.
  //
  // THE LARGER READ WINS for a pair, per key and independently - see
  // `moreComplete`. A transcript only GROWS, so a second `SubagentStop` for one
  // worker is a re-sum of the same file and a superset of the first. Ordering
  // the two by ARRIVAL (whichever `Map.set` saw last, or whichever was seen
  // first) makes the answer depend on the order the lines landed in; ordering
  // them by SIZE does not, so re-rendering the same file is idempotent and a
  // short read can never freeze a bracket. Summing them is refused: that would
  // double-bill every turn both reads covered. If the host ever produces
  // genuinely disjoint partial sums this understates rather than double-bills,
  // which is the direction this record already prefers.
  /** @type {Map<string, Record<string, number>>} */
  const cacheFacts = new Map();
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
    // And again for the two cache figures, guarded identically for the
    // identical hazard. Collected as an object carrying only the keys that
    // passed, so the omit-when-absent rule below is a spread rather than two
    // more conditionals: a figure nobody reported must leave NO key behind.
    /** @type {Record<string, number>} */
    const cache = {};
    for (const k of CACHE_KEYS) {
      if (typeof e[k] === 'number' && Number.isFinite(e[k])) cache[k] = e[k];
    }

    // The cache-only fact: collected here for the guarded `cache` object above,
    // and folded only AFTER the loop. It cannot join its bracket inline (D-09):
    // the host fires `SubagentStop` the moment the worker stops, while the
    // orchestrator writes the `--agent-id` close only once it has processed the
    // return, so the fact ordinarily arrives BEFORE the id it joins on - and the
    // whole existing fold runs inside the `TERMINAL` branch, which this name
    // deliberately never enters. A fact carrying no id can never reach a
    // bracket, and one whose transcript reported neither figure has nothing to
    // give, so neither is collected; neither is an error.
    if (e.event === WORKER_CACHE) {
      if (typeof e.agent_id === 'string' && e.agent_id && CACHE_KEYS.some((k) => k in cache)) {
        const pair = `${key(e.corr)}\0${e.agent_id}`;
        const prior = cacheFacts.get(pair);
        if (!prior) cacheFacts.set(pair, cache);
        else for (const k of CACHE_KEYS) if (moreComplete(prior, cache, k)) prior[k] = cache[k];
      }
      continue;
    }

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
          // The cache figures, OMITTED on the same rule and taken off the
          // TERMINAL alone for the same reason: they are summed out of the
          // worker's own transcript, and a dispatch half has no transcript to
          // read. They ride this row and go NOWHERE else - see the `brackets`
          // typedef for why the `roles` bill cannot have them.
          ...cache,
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
        // NOT the fill-only-empty clause, for the cache figures alone: the
        // LARGER read wins, per key and independently (see `moreComplete`).
        // The hook is the only writer that has these two at all, so there is no
        // second writer for fill-only-empty to protect - two values here are
        // two reads of one transcript that only grows, and the shorter one must
        // not freeze the row. This is still the arm that lands them on a row
        // the hand-written close opened first.
        for (const k of CACHE_KEYS) if (moreComplete(b, cache, k)) b[k] = cache[k];
        // Identity folds on the SAME fill-only-empty rule, and it has to: the
        // hook's figureless close is the writer that ordinarily opens this row
        // (the host fires SubagentStop when the worker stops, before the
        // orchestrator has processed the return), so without this clause an id
        // supplied on the hand-written close is dropped on exactly the arrival
        // order AC4 calls ordinary - and `lib/subagent-trace.mjs`'s
        // `alreadyClosed` equality test then reads a key that is never there.
        if (!('agent_id' in b) && e.agent_id) b.agent_id = e.agent_id;
        // THE SPAN, and it is NOT fill-only-empty - `end` is never empty, so
        // that rule would freeze it at whichever close landed first. `ms` is
        // DISPATCH-TO-CLOSE and the typedef says it includes whatever the
        // orchestrator did BETWEEN WRITING THE TWO HALVES, so the close that
        // ends the span is the LATER of them. Freezing it at the first is what
        // let a bracket render `ms` SHORTER than the `duration_ms` beside it -
        // a worker running 362s inside a 263s window, measured on this
        // repository's own record 2026-08-26 - and it understated every
        // bracket the hook closed first, which is the ordinary order.
        // MONOTONIC, never backwards: a delayed repeat close (the D-05
        // ordering, whose `ts` precedes the head pending dispatch) must not
        // shrink a span that already closed later.
        const a2 = millis(repeat.entry.ts);
        if (t !== null && (millis(b.end) === null || t > millis(b.end))) {
          b.end = e.ts;
          b.ms = a2 !== null ? t - a2 : null;
          // The coordinator span extends with it, or `residue_ms` keeps
          // billing the coordinator for time a worker held. Pushing a second
          // span does not double-count: `mergeSpans` unions overlapping spans
          // and this one shares its `a`, so it widens the existing span rather
          // than adding one. (The note that used to sit here said the reverse.)
          if (a2 !== null && t > a2) coordRow(e.corr).spans.push({ a: a2, b: t });
        }
        // The arm upgrades in ONE direction and never back. A figureless writer
        // that happened to run first would otherwise turn every checkpoint into
        // a clean `return` - billing a worker that came back unusable as a
        // clean close, the one arm this record exists to keep separate (the
        // TERMINAL contract at the top of this file). `e.event` is already
        // known to be a terminal, so "not `return`" is exactly "`checkpoint` or
        // `escalation`" without re-enumerating them.
        if (b.event === 'return' && e.event !== 'return') b.event = e.event;
        // No `mismatched` row: that one IS the PAIRING's to report, and a
        // terminal with nothing pending contributes none. The coordinator span
        // is handled above and is no longer withheld here - it widens with
        // `end` rather than being re-pushed as an independent span, which is
        // what the double-billing this note used to warn about would have
        // required.
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
  // THE POST-PASS FOLD. Every bracket is built by now, which is the point: a
  // fact that arrived first still finds the row its `agent_id` names.
  //
  // It touches the bracket ROW and nothing else - not `roleTotals`, not
  // `out.roles`, not `seenTerminals`, not `pairedRows` - because a cache read
  // summed over a worker's turns is a different denomination from a return's
  // final-window `tokens` (D-03), and `roles` is byte-identical with and without
  // every fact in the file. It reuses the SAME clause the repeat-close arm
  // applies to these two keys - the larger read wins, per key and independently
  // (see `moreComplete`) - so there is no second rule to keep in agreement with
  // the first, and a close that carried a SHORTER read of the worker's own
  // transcript is corrected by the fact rather than freezing it. A bracket
  // whose close carried the larger figure keeps it. A fact naming no bracket changes
  // nothing and is not an error. Where two brackets under one `corr` somehow
  // carry one `agent_id`, the fold stops at the first: one worker's traffic
  // copied onto two rows would bill it twice.
  for (const [pair, cache] of cacheFacts) {
    for (const b of out.brackets) {
      if (!b.agent_id || `${key(b.corr)}\0${b.agent_id}` !== pair) continue;
      for (const k of CACHE_KEYS) if (moreComplete(b, cache, k)) b[k] = cache[k];
      break;
    }
  }

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
