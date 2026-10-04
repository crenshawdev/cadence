// @ts-check
// pane.mjs - the Cadence pane: the full picture of the current phase, drawn
// by the Cadence module (hooks/cadence-mod.mjs) in a pane of its own, opened
// with `/cad-panel` (phase 4, D-01).
//
// Every figure it shows is a seam's answer, taken as the seam gave it. None is
// re-derived here (D-04): a second derivation would be a second answer, free
// to disagree with the first. The adapter owns all I/O, through `$`, and hands
// this file what it read; this file only turns that into lines.
//
// No imports beyond lib/ files that import nothing, no Node globals: a hooks
// module may load nothing else.
//
// What each section reads:
// - `next`: the STATE.md cursor's `next`, parsed by lib/state-cursor.mjs, the
//   value the band shows (D-03).
// - the heading, the disagreement line and the plan rows: one `planning.mjs
//   status` run. The phase is its derived `current` (D-05); the rows are that
//   entry's `plans`, or one `PLAN.md` once it is planned, each marked by
//   `outstanding[]` (D-06). A cursor `status` says disagrees (`cursor.agrees`
//   false) gets a line of its own: the pane names both phases, picks neither.
//
// The layout, one row per line, top to bottom:
//   1. the phase heading
//   2. the cursor-disagreement line
//   3. `next <command>`
//   4. the plan rows
//   5. UAT
//   6. the running agents
//   7. the open captures
//   8. the token spend and its caveat
// A line never wraps and never runs past the width: too long, it is cut and
// ends in `…`. A section whose source failed reads as unavailable and names
// the refusal's reason, never an empty list or a zero in place of the data.
'use strict';

/** What the pane draws until its first fetch has left a snapshot. */
export const READING_LINE = 'Cadence · reading…';

/** The `next` line with no readable cursor: the band's hint (phase 3, D-06). */
export const NO_CURSOR_NEXT = 'next · no readable cursor · run /cad-progress';

/** The answer to `/cad-panel` outside a Cadence project (PNL-02). */
export const NO_PROJECT_TEXT =
  'No .planning/ here, so there is no Cadence pane to open. /cad-new-project or /cad-adopt starts one.';

/** How long one seam run may take before the host kills it. */
export const SEAM_TIMEOUT_MS = 10000;

/**
 * @typedef {{next: string} | null} Cursor
 * @typedef {{ok: boolean, value?: any, reason?: string, hint?: string}} Seam
 *   a seam's answer: `ok` with its envelope in `value`, or not `ok` with the
 *   refusal's `reason` and `hint`
 * @typedef {{cursor: Cursor, status: Seam}} Snapshot one fetch's answers
 */

/**
 * The argv that runs one `planning.mjs` subcommand against a project.
 * @param {string} pluginRoot `$.plugin.root`
 * @param {string} projectRoot the directory holding `.planning/`
 * @param {readonly string[]} args the subcommand and its flags
 * @returns {string[]}
 */
export function seamArgv(pluginRoot, projectRoot, args) {
  return ['node', join(pluginRoot, 'cadence-core/bin/planning.mjs'), '--dir', join(projectRoot, '.planning'), ...args];
}

/** The answer for a run that rejected: a timeout, a spawn the host refused. */
export const RUN_FAILED = Object.freeze({ ok: false, reason: 'run-failed' });

/**
 * A seam's stdout as a Seam: the envelope when it says `ok: true`, else the
 * refusal's `reason` and `hint`, else `unparseable-output`.
 * @param {unknown} stdout
 * @returns {Seam}
 */
export function seamAnswer(stdout) {
  let v;
  try {
    v = JSON.parse(String(stdout));
  } catch {
    v = null;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, reason: 'unparseable-output' };
  if (v.ok === true) return { ok: true, value: v };
  const reason = typeof v.reason === 'string' && v.reason ? v.reason : 'refused';
  return typeof v.hint === 'string' && v.hint ? { ok: false, reason, hint: v.hint } : { ok: false, reason };
}

/**
 * The pane's lines for a snapshot, each at most `width` cells.
 * @param {Snapshot | null} snapshot null until the first fetch settles
 * @param {number} width the pane's `bodyColumns`
 * @returns {string[]}
 */
export function paneLines(snapshot, width) {
  if (!snapshot) return [fit(READING_LINE, width)];
  const phase = phaseView(snapshot.status);
  const lines = [
    ...phase.heading,
    snapshot.cursor ? `next ${snapshot.cursor.next}` : NO_CURSOR_NEXT,
    ...phase.rows,
  ];
  return lines.map((line) => fit(visible(line), width));
}

/** The statuses a phase has a `PLAN.md` in, when `status` lists no `plans`. */
const PLANNED = new Set(['planned', 'executed', 'complete']);

/**
 * The heading, the disagreement line and the plan rows, from `status`.
 * @param {Seam} status
 * @returns {{heading: string[], rows: string[], entry: any}} `entry`: the
 *   current phase's `phases[]` entry, or null with no current phase
 */
export function phaseView(status) {
  if (!status || !status.ok) return { heading: [unavailable('Phase', status)], rows: [], entry: null };
  const s = status.value;
  /** @type {string[]} */
  const heading = [];
  let entry = null;
  if (s.current === null || s.current === undefined) {
    heading.push(s.cycle === 'none' ? 'No active phase · the milestone is closed' : 'No active phase · every phase is complete');
  } else {
    entry = (Array.isArray(s.phases) ? s.phases : []).find((p) => p && String(p.n) === String(s.current)) || null;
    heading.push(`Phase ${s.current} of ${s.total}${entry ? ` · ${entry.name} · ${entry.status}` : ''}`);
  }
  if (s.cursor && s.cursor.agrees === false) heading.push(`Cursor says phase ${s.cursor.phase} · ${s.cursor.status}`);
  if (entry === null) return { heading, rows: [], entry };
  const plans = Array.isArray(entry.plans) ? entry.plans : PLANNED.has(entry.status) ? ['PLAN.md'] : [];
  if (plans.length === 0) return { heading, rows: ['No plan yet'], entry };
  const due = (Array.isArray(s.outstanding) ? s.outstanding : [])
    .find((o) => o && String(o.phase) === String(s.current));
  const open = new Set(due && Array.isArray(due.plans) ? due.plans : []);
  return { heading, rows: plans.map((f) => `${f} · ${open.has(f) ? 'outstanding' : 'complete'}`), entry };
}

/**
 * A section whose source failed: never an empty list or a zero in its place.
 * @param {string} label
 * @param {Seam | null | undefined} seam
 */
function unavailable(label, seam) {
  if (!seam || seam.ok) return `${label} unavailable · not-read`;
  return `${label} unavailable · ${seam.reason}${seam.hint ? ` · ${seam.hint}` : ''}`;
}

/**
 * `dir/name`, without doubling the separator at a filesystem root.
 * @param {string} dir
 * @param {string} name
 */
function join(dir, name) {
  return /[\\/]$/.test(dir) ? dir + name : `${dir}/${name}`;
}

/**
 * A kick runs its task when nothing is running (D-04). A kick during a run
 * queues exactly one more run, of the latest kick's task, started when this
 * one settles: the last change is never missed, and a burst of events costs
 * two runs, not one each. A task that throws leaves the runner usable.
 *
 * The task comes with each kick rather than once here because the module may
 * not hold `$` between events; each kick's task closes over its own.
 * @returns {(task: () => unknown) => Promise<void>} the kick; its promise
 *   settles once the run it started or joined, and any queued behind it, have
 */
export function singleFlight() {
  /** @type {Promise<void> | null} */
  let running = null;
  /** @type {(() => unknown) | null} */
  let queued = null;
  return function kick(task) {
    if (running) {
      queued = task;
      return running;
    }
    running = (async () => {
      try {
        for (let run = task; run; run = queued) {
          queued = null;
          try {
            // through `then`, so even a task that throws at once yields first
            // and `running` is set before this loop can end
            await Promise.resolve().then(run);
          } catch {
            // the next kick runs it again
          }
        }
      } finally {
        running = null;
      }
    })();
    return running;
  };
}

/**
 * Every control character shown as `?`. The text comes from files and seam
 * output a person or a tool wrote, and the host refuses a whole tree when a
 * text child holds one (C0, DEL, C1: tab, CR and LF too).
 * @param {string} s
 */
function visible(s) {
  return String(s).replace(/[\x00-\x1f\x7f-\x9f]/g, '?');
}

/**
 * Cut at the width, ending in `…`. Counted by code point, so a cut never
 * splits a surrogate pair.
 * @param {string} line
 * @param {number} width
 */
function fit(line, width) {
  const chars = Array.from(line);
  if (chars.length <= width) return line;
  if (!(width >= 1)) return '';
  return chars.slice(0, width - 1).join('') + '…';
}
