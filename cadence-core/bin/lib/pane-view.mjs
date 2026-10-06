// @ts-check
// pane-view.mjs - the Cadence pane as styled rows: what lib/pane.mjs reads,
// laid out as the owner's dashboard. Each row is a list of segments
// `{ text, color?, bold?, dim? }`; the module's Pane render turns a segment
// into a host Text. Nothing here is a host element.
//
// It draws what paneLines draws and reads it the same way: the heading, the
// drift and closed-milestone lines and the plan rows come from phaseView, the
// agents from agentRows, the spend from spendOf. Nothing is derived twice.
//
// The cache figures are the one part paneLines never had. They come from the
// module's live meter (lib/cache-meter.mjs), not a seam, so they are the
// session's and say so, never the phase's.
//
// No imports beyond lib/ files that import nothing, no Node globals: the
// hooks module loads this.
'use strict';

import { shownStatus } from './band.mjs';
import { breaksText, EMPTY_METER, hitRate, kilo, MAIN, percent } from './cache-meter.mjs';
import { agentRows, NO_CURSOR_NEXT, phaseView, READING_LINE, spendOf } from './pane.mjs';
import { SPEND_EXCLUDES } from './trace-suggest.mjs';

/**
 * @typedef {{text: string, color?: string, bg?: string, bold?: boolean, dim?: boolean, action?: 'next'}} Segment
 * @typedef {Segment[]} Row
 */

/** Cells the section heads take, the head included. */
const LABEL_CELLS = 11;

/** A phase status's chip colour, by the first word it starts with. */
const STATUS_COLORS = Object.freeze([['unplanned', 'gray'], ['context', 'blue'], ['planned', 'cyan'],
  ['executing', 'yellow'], ['executed', 'magenta'], ['verif', 'green'], ['complete', 'green']]);

/** The UAT counts in `status`'s order, and the color each draws in. */
const UAT_COLORS = Object.freeze({ pass: 'green', fail: 'red', pending: 'yellow', skipped: undefined, blocked: 'red' });

/**
 * The pane's rows for a snapshot, none wider than `width` cells.
 * @param {import('./pane.mjs').Snapshot | null} snapshot null until the first fetch settles
 * @param {number} width the pane's `bodyColumns`
 * @param {readonly import('./pane.mjs').RosterEntry[]} [roster]
 * @param {readonly import('./pane.mjs').Sight[]} [sights]
 * @param {import('./cache-meter.mjs').Meter} [meter] the session's cache meter
 * @returns {Row[]}
 */
export function paneView(snapshot, width, roster = [], sights = [], meter = EMPTY_METER) {
  if (!snapshot) return [fitRow([{ text: READING_LINE, dim: true }], width)];
  const phase = phaseView(snapshot.status);
  const bar = barCells(width);
  /** @type {Row} */
  const rule = [{ text: '─'.repeat(Math.max(0, width)), dim: true }];
  /** @type {Row[]} */
  const rows = [
    ...headingRows(snapshot, phase, roster),
    rule,
    ...planRows(phase.rows, bar),
    ...(phase.rows.length ? [rule] : []),
    ...agentLines(roster, sights, snapshot, meter),
    ...uatRows(phase.entry, bar),
    capturesRow(snapshot.captures),
    ...spendRows(snapshot.spend, width),
    ...cacheRows(meter, width),
  ];
  return rows.map((row) => fitRow(row.map((s) => ({ ...s, text: visible(s.text) })), width));
}

/**
 * The heading, the next command, and the drift line when the cursor disagrees.
 * @param {import('./pane.mjs').Snapshot} snapshot
 * @param {ReturnType<typeof phaseView>} phase
 * @param {readonly import('./pane.mjs').RosterEntry[]} roster
 * @returns {Row[]}
 */
function headingRows(snapshot, phase, roster) {
  const s = snapshot.status && snapshot.status.ok ? snapshot.status.value : null;
  const [first, ...drift] = phase.heading;
  /** @type {Row[]} */
  const rows = [];
  if (!s) rows.push([{ text: first, color: 'red' }]);
  else if (phase.entry) rows.push([{ text: `Phase ${s.current}`, bold: true, color: 'cyan' }, { text: ` of ${s.total}  `, dim: true }, { text: String(phase.entry.name), bold: true }]);
  else rows.push([{ text: first, bold: true }]);
  /** @type {Row} */
  const next = snapshot.cursor
    ? [{ text: 'next ', dim: true }, { text: snapshot.cursor.next, action: 'next' }]
    : [{ text: NO_CURSOR_NEXT, color: 'yellow' }];
  rows.push(phase.entry ? [chip(shownStatus(String(phase.entry.status), roster)), { text: '  ' }, ...next] : next);
  for (const line of drift) rows.push([{ text: '⚠ ', color: 'yellow' }, { text: line, color: 'yellow' }]);
  return rows;
}

/**
 * PLANS with its bar, then one row per plan: `✓` complete, `○` outstanding.
 * The rows are phaseView's, which end in ` · complete` or ` · outstanding`.
 * @param {readonly string[]} lines
 * @param {number} bar
 * @returns {Row[]}
 */
function planRows(lines, bar) {
  if (lines.length === 0) return [];
  const plans = lines.map((l) => /^(.*) · (complete|outstanding)$/.exec(l));
  if (plans.some((m) => m === null)) return [[head('PLANS'), { text: lines.join(' · '), dim: true }]];
  const done = plans.filter((m) => m[2] === 'complete').length;
  return [
    [head('PLANS'), ...barSegments(done, plans.length, bar, 'green'), { text: `  ${done} of ${plans.length}`, dim: true }],
    ...plans.map((m) => m[2] === 'complete'
      ? [{ text: '  ' }, { text: '☑', color: 'green' }, { text: ` ${m[1]}`, dim: true }]
      : [{ text: '  ' }, { text: '☐', color: 'yellow' }, { text: ` ${m[1]}` }]),
  ];
}

/**
 * AGENTS: one row per running agent behind a cyan `●`, the first beside the
 * head, then its cache figure once it has sent a request, and its breaks.
 * @param {readonly import('./pane.mjs').RosterEntry[]} roster
 * @param {readonly import('./pane.mjs').Sight[]} sights
 * @param {import('./pane.mjs').Snapshot} snapshot
 * @param {import('./cache-meter.mjs').Meter} meter
 * @returns {Row[]}
 */
function agentLines(roster, sights, snapshot, meter) {
  const lines = agentRows(roster, sights, snapshot.resolves || [], snapshot.sessionModel ?? null);
  if (roster.length === 0) return [[head('AGENTS'), { text: lines[0], dim: true }]];
  return lines.map((line, i) => {
    const loop = meter.loops.get(roster[i].id);
    /** @type {Row} */
    const cache = loop ? [{ text: ' · ', dim: true }, { text: `cache ${rateText(loop)}` }] : [];
    if (loop && loop.breaks) cache.push({ text: ' · ', dim: true }, { text: breaksText(loop.breaks), color: 'yellow' });
    return [i === 0 ? head('AGENTS') : { text: ' '.repeat(LABEL_CELLS) },
      { text: '●', color: 'cyan' }, { text: ` ${line}` }, ...cache];
  });
}

/**
 * UAT: pass of total as a bar, then each count that is not 0 in its color.
 * No `uat` key, no row.
 * @param {any} entry
 * @param {number} bar
 * @returns {Row[]}
 */
function uatRows(entry, bar) {
  const uat = entry && entry.uat;
  if (!uat || typeof uat !== 'object') return [];
  const keys = /** @type {(keyof typeof UAT_COLORS)[]} */ (Object.keys(UAT_COLORS));
  const total = keys.reduce((sum, k) => sum + (Number.isFinite(uat[k]) ? uat[k] : 0), 0);
  const pass = Number.isFinite(uat.pass) ? uat.pass : 0;
  /** @type {Row} */
  const counts = [];
  for (const k of keys.filter((key) => uat[key] !== 0 && uat[key] !== undefined)) {
    if (counts.length) counts.push({ text: ' · ', dim: true });
    counts.push(UAT_COLORS[k] ? { text: `${uat[k]} ${k}`, color: UAT_COLORS[k] } : { text: `${uat[k]} ${k}` });
  }
  if (counts.length === 0) counts.push({ text: 'none recorded', dim: true });
  const drawn = total > 0 ? [...barSegments(pass, total, bar, 'green'), { text: '  ' }] : [];
  return [[head('UAT'), ...drawn, ...counts]];
}

/**
 * CAPTURES: `capture-check`'s `substantive`, or why it is missing.
 * @param {import('./pane.mjs').Seam} captures
 * @returns {Row}
 */
function capturesRow(captures) {
  const n = captures && captures.ok ? captures.value.substantive : null;
  if (!Number.isInteger(n)) {
    const why = !captures ? { ok: false, reason: 'not-read' } : captures.ok ? { ok: false, reason: 'unparseable-output' } : captures;
    return [head('CAPTURES'), unavailable(why)];
  }
  return [head('CAPTURES'), { text: `${n} open` }];
}

/**
 * SPEND and its caveat, dim; none when there was no phase to price.
 * @param {import('./pane.mjs').Seam | null} spend
 * @param {number} width the pane's width, which the caveat wraps inside
 * @returns {Row[]}
 */
function spendRows(spend, width) {
  if (spend === null || spend === undefined) return [];
  if (!spend.ok) return [[head('SPEND'), unavailable(spend)]];
  const { total, unrecorded } = spendOf(spend.value);
  /** @type {Row} */
  const row = [head('SPEND'), total === null ? { text: 'none recorded', dim: true } : { text: `${grouped(total)} tokens` }];
  if (unrecorded) row.push({ text: ` · ${unrecorded} unrecorded`, dim: true });
  const room = Math.max(10, width - LABEL_CELLS);
  return [row, ...wrapWords(`Excludes ${SPEND_EXCLUDES.join(', ')}`, room)
    .map((line) => [{ text: ' '.repeat(LABEL_CELLS) }, { text: line, dim: true }])];
}

/**
 * CACHE: the main loop's hit rate over the session and on its last request,
 * or what its first request wrote while that is all it has sent, its breaks
 * with the last one's tokens lost, and the breaks in agents, then a dim line
 * saying whose figures they are.
 * @param {import('./cache-meter.mjs').Meter} meter
 * @param {number} width the pane's width, which the caveat wraps inside
 * @returns {Row[]}
 */
function cacheRows(meter, width) {
  const main = meter.loops.get(MAIN);
  if (!main) return [[head('CACHE'), { text: 'no request yet this session', dim: true }]];
  /** @type {Row} */
  const row = [head('CACHE'), { text: `main ${rateText(main)}` }];
  if (main.calls > 1) row.push({ text: ` (last ${percent(main.last)})`, dim: true });
  if (main.breaks) row.push({ text: ' · ', dim: true }, { text: `${breaksText(main.breaks)}, last ${kilo(main.lost)} lost`, color: 'yellow' });
  const agents = meter.breaks - main.breaks;
  if (agents > 0) row.push({ text: ' · ', dim: true }, { text: `${agents} in agents`, color: 'yellow' });
  const room = Math.max(10, width - LABEL_CELLS);
  return [row, ...wrapWords('This session, live: not part of the phase\'s spend', room)
    .map((line) => [{ text: ' '.repeat(LABEL_CELLS) }, { text: line, dim: true }])];
}

/**
 * A loop's hit rate over the session, or what its first request wrote while
 * that is all it has sent: one request's rate is only its cold write. After a
 * module reload that first request may be warm, so this says first, not cold.
 * @param {import('./cache-meter.mjs').Loop} loop
 * @returns {string}
 */
function rateText(loop) {
  return loop.calls === 1 ? `first request, ${kilo(loop.write)} written` : percent(hitRate(loop));
}

/**
 * A section head, bold, padded to the label column.
 * @param {string} label
 * @returns {Segment}
 */
function head(label) {
  return { text: label.padEnd(LABEL_CELLS), bold: true, color: 'cyan' };
}

/**
 * A status as a chip: the word on its colour.
 * @param {string} status
 * @returns {Segment}
 */
function chip(status) {
  const hit = STATUS_COLORS.find(([word]) => status.startsWith(word));
  return { text: ` ${status} `, color: 'black', bg: hit ? hit[1] : 'white', bold: true };
}

/**
 * `text` in lines of at most `room` cells, broken at spaces.
 * @param {string} text
 * @param {number} room
 * @returns {string[]}
 */
function wrapWords(text, room) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > room) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A failed source's reason, red: never an empty list or a zero in its place.
 * @param {import('./pane.mjs').Seam} seam
 * @returns {Segment}
 */
function unavailable(seam) {
  return { text: `unavailable · ${seam.reason}${seam.hint ? ` · ${seam.hint}` : ''}`, color: 'red' };
}

/**
 * Bar cells for a pane `width` cells across: a fifth of it, 10 to 24, and
 * never more than what the label column leaves.
 * @param {number} width
 */
function barCells(width) {
  return Math.max(0, Math.min(24, Math.max(10, Math.floor(width / 5)), width - LABEL_CELLS - 1));
}

/**
 * `part` of `whole` as `cells` cells: `█` filled in `color`, `░` dim.
 * @param {number} part
 * @param {number} whole
 * @param {number} cells
 * @param {string} color
 * @returns {Segment[]}
 */
function barSegments(part, whole, cells, color) {
  const filled = Math.max(0, Math.min(cells, Math.round((part / whole) * cells)));
  return [{ text: '█'.repeat(filled), color }, { text: '░'.repeat(cells - filled), dim: true }];
}

/**
 * Thousands with commas, without Intl.
 * @param {number} n
 */
function grouped(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Every control character shown as `?`, as paneLines shows it: the host
 * refuses a whole tree when a text child holds one.
 * @param {unknown} s
 */
function visible(s) {
  return String(s).replace(/[\x00-\x1f\x7f-\x9f]/g, '?');
}

/**
 * A row cut at the width, its last kept segment ending in `…`. Counted by
 * code point, so a cut never splits a surrogate pair. Empty segments drop.
 * @param {Row} row
 * @param {number} width
 * @returns {Row}
 */
function fitRow(row, width) {
  const kept = row.filter((s) => s.text !== '');
  const cells = kept.reduce((n, s) => n + Array.from(s.text).length, 0);
  if (cells <= width) return kept;
  if (!(width >= 1)) return [];
  /** @type {Row} */
  const out = [];
  let room = width - 1;
  for (const s of kept) {
    const chars = Array.from(s.text);
    if (chars.length >= room) {
      out.push({ ...s, text: chars.slice(0, room).join('') + '…' });
      break;
    }
    out.push(s);
    room -= chars.length;
  }
  return out;
}
