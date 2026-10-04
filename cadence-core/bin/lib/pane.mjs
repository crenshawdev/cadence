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

/**
 * @typedef {{next: string} | null} Cursor
 * @typedef {{cursor: Cursor}} Snapshot one fetch's answers
 */

/**
 * The pane's lines for a snapshot, each at most `width` cells.
 * @param {Snapshot | null} snapshot null until the first fetch settles
 * @param {number} width the pane's `bodyColumns`
 * @returns {string[]}
 */
export function paneLines(snapshot, width) {
  if (!snapshot) return [fit(READING_LINE, width)];
  /** @type {string[]} */
  const lines = [];
  lines.push(snapshot.cursor ? `next ${snapshot.cursor.next}` : NO_CURSOR_NEXT);
  return lines.map((line) => fit(visible(line), width));
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
