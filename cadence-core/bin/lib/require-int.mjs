// @ts-check
// the shared guard for numeric flags: rejects anything that isn't a clean integer string, so a bad `--total` (#42) or `--attempt` (#45.2) never coerces to NaN or to a wrong-but-valid int like Number(true)===1
// the range is part of the grammar: `--total 9007199254740993` parses to `9007199254740992`, a different number than the caller typed arriving with ok:true, so the predicate is isSafeInteger and not isInteger
// no emit, no I/O: callers own their reason string (`bad-args` vs `usage`) and this only classifies
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
  if (Number.isNaN(n) || !Number.isSafeInteger(n)) return { ok: false };
  return { ok: true, value: n };
}

// a clean integer isn't what STATE.md can hold: parseCursor reads unsigned `\d+(?:\.\d+)?` with no exponent, so `--total -2` and `--total 1e21` would pass requireInt, write, and make the next `cursor get` fail `unparseable-cursor`
// so the flag has to look like the file format and so does the number once rendered back, which is what catches a digits-only value whose String() yields `1e+21`
// no isSafeInteger here, since the decimal form accepts `2.1` and that would refuse every sub-phase; the parsed number is bounded instead, which refuses `9007199254740993` (it survives the round trip while naming a different number)
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
  if (!Number.isFinite(n) || n > Number.MAX_SAFE_INTEGER) return { ok: false };
  return { ok: true, value: n };
}

/**
 * The `--phase` reader: `requireCursorNumber`'s decimal form plus the caller's
 * own spelling, trimmed.
 *
 * A phase number is a directory component and an arithmetic value, and
 * `String(Number(x))` isn't a round trip for the first. A `--phase` of `1.10`
 * normalized to `1.1` and read a different phase's directory under ok:true, and
 * `08` answered about the directory for `8`. So `raw` builds every path and
 * directory-naming diagnostic, and `value` is for arithmetic and comparisons.
 *
 * The String(n) round trip inside requireCursorNumber still matters: it refuses
 * a digits-only value whose String() yields `1e+21`, and the magnitude bound
 * refuses `9007199254740993`, whose `value` would be a neighbour's number.
 * @param {unknown} raw
 * @returns {{ok: true, raw: string, value: number} | {ok: false}}
 */
export function requirePhaseArg(raw) {
  const parsed = requireCursorNumber(raw, { decimal: true });
  if (!parsed.ok) return { ok: false };
  return { ok: true, raw: String(raw).trim(), value: parsed.value };
}
