// @ts-check
// require-int.mjs - the shared seam numeric-flag guard. Rejects anything that
// is not a clean integer string before a caller derives a number from a CLI
// flag, so a bad `--total` (#42) or `--attempt` (#45.2) never silently
// coerces to NaN (or, worse, to a wrong-but-valid int like Number(true)===1)
// and reaches a write or a routing decision. Dependency-free, side-effect-
// free: no emit, no I/O. Callers own their own reason string (`bad-args` vs
// `usage`) - this helper only classifies the value (D-01/D-03).
'use strict';

/**
 * @param {unknown} raw
 * @returns {{ok: true, value: number} | {ok: false}}
 */
export function requireInt(raw) {
  if (typeof raw !== 'string') return { ok: false };
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false };
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isInteger(n)) return { ok: false };
  return { ok: true, value: n };
}

// A clean integer is not the same contract as a number STATE.md can hold.
// parseCursor reads `Phase: <phase> of <total>` as `\d+(?:\.\d+)?` and `\d+` -
// unsigned, no exponent - so `--total -2` and `--total 1e21` pass requireInt,
// write, and make the very next `cursor get` fail `unparseable-cursor`. This
// guard mirrors the parser on both ends: the flag must look like the file
// format, and so must the number once rendered back (which is what catches a
// digits-only value large enough that String() yields `1e+21`).
const CURSOR_SHAPE = { plain: /^\d+$/, decimal: /^\d+(?:\.\d+)?$/ };

/**
 * @param {unknown} raw
 * @param {{decimal?: boolean}} [opts] allow one decimal part (phase
 *   insertions like 2.1); totals are whole numbers only.
 * @returns {{ok: true, value: number} | {ok: false}}
 */
export function requireCursorNumber(raw, opts = {}) {
  if (typeof raw !== 'string') return { ok: false };
  const re = opts.decimal ? CURSOR_SHAPE.decimal : CURSOR_SHAPE.plain;
  const trimmed = raw.trim();
  if (!re.test(trimmed)) return { ok: false };
  const n = Number(trimmed);
  if (!re.test(String(n))) return { ok: false };
  return { ok: true, value: n };
}
