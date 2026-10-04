// @ts-check
// band.mjs - the one line the Cadence module (hooks/cadence-mod.mjs) draws
// above the prompt: phase, status, the running Cadence agents, next command.
//
// No imports beyond lib/, no Node globals: a hooks module may load nothing
// else. The module does the I/O and hands this the parsed cursor.
//
// The line never wraps and never runs past the width it is given. Too long,
// the running list shrinks to its first agent plus a count, then the end of
// the line is cut with an ellipsis.
'use strict';

/** The line when STATE.md is missing or does not parse (phase 3, D-06). */
export const NO_CURSOR_LINE = 'Cadence · no readable cursor · run /cad-progress';

/**
 * @param {{phase: number, total: number, status: string, next: string} | null} cursor
 * @param {readonly {role: string, rung: string}[]} running
 * @param {number} width cells the line may take
 * @returns {string}
 */
export function bandLine(cursor, running, width) {
  if (!cursor) return fit(NO_CURSOR_LINE, width);
  const head = `Cadence · Phase ${cursor.phase} of ${cursor.total} · ${cursor.status}`;
  const tail = ` · next ${cursor.next}`;
  const names = running.map((a) => `${a.role} (${a.rung})`);
  let line = head + (names.length ? ` · running ${names.join(', ')}` : '') + tail;
  if (names.length > 1 && cells(line) > width) {
    line = `${head} · running ${names[0]} +${names.length - 1}${tail}`;
  }
  return fit(line, width);
}

/** @param {string} s */
function cells(s) {
  return Array.from(s).length;
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
