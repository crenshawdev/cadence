// @ts-check
// require-int.mjs - the shared seam numeric-flag guard. Rejects anything that
// is not a clean integer string before a caller derives a number from a CLI
// flag, so a bad `--total` (#42) or `--attempt` (#45.2) never silently
// coerces to NaN (or, worse, to a wrong-but-valid int like Number(true)===1)
// and reaches a write or a routing decision. RANGE IS PART OF THE GRAMMAR:
// the predicate is `Number.isSafeInteger`, not `Number.isInteger`, because
// `--total 9007199254740993` parses to `9007199254740992` - a DIFFERENT number
// than the caller typed, arriving with ok:true. A value silently changed on the
// way in is the same defect as a NaN reaching a write, one digit quieter.
// Dependency-free, side-effect-free: no emit, no I/O. Callers own their own
// reason string (`bad-args` vs `usage`) - this helper only classifies the
// value (D-01/D-03).
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

// A clean integer is not the same contract as a number STATE.md can hold.
// parseCursor reads `Phase: <phase> of <total>` as `\d+(?:\.\d+)?` and `\d+` -
// unsigned, no exponent - so `--total -2` and `--total 1e21` pass requireInt,
// write, and make the very next `cursor get` fail `unparseable-cursor`. This
// guard mirrors the parser on both ends: the flag must look like the file
// format, and so must the number once rendered back (which is what catches a
// digits-only value large enough that String() yields `1e+21`).
// The magnitude bound after that round trip is the third leg of the same
// grammar. This reader cannot take requireInt's `Number.isSafeInteger`: its
// decimal form legitimately accepts `2.1`, and `Number.isSafeInteger(2.1)` is
// false, so the integer predicate would refuse every sub-phase. So the PARSED
// NUMBER is bounded instead - finite, and no greater than MAX_SAFE_INTEGER,
// with the regex already excluding negatives - which is what refuses
// `9007199254740993`: a spelling that survives the round trip (String() of it
// is `9007199254740992`, still digits-only) while naming a different number
// than the caller typed.
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
 * THE `--phase` reader (D-02). Same shape rule as `requireCursorNumber`'s
 * decimal form, and one field more: the caller's OWN spelling, trimmed.
 *
 * A phase number is two different things at once - a directory component and an
 * arithmetic value - and `String(Number(x))` is not a round trip for the first
 * of them. `--phase 1.10` normalized to `1.1` READ A DIFFERENT PHASE'S
 * DIRECTORY, silently and with an ok:true envelope, and `--phase 08` answered
 * about `phases/8`. So `raw` is what every path and every directory-naming
 * diagnostic is built from, and `value` is kept for arithmetic and comparisons
 * ONLY (a `total`, an `=== current`, a ROADMAP phase number).
 *
 * The `String(n)` round trip inside `requireCursorNumber` is still doing work
 * here even though the raw string is what gets used: it is what refuses a
 * digits-only value large enough that `String()` yields `1e+21`, which stays
 * arithmetic-poison for the `value` half no matter how the directory is spelled.
 * The magnitude bound beside it does the same job one order down, refusing
 * `9007199254740993` whose `value` half would otherwise be a neighbour's number.
 * @param {unknown} raw
 * @returns {{ok: true, raw: string, value: number} | {ok: false}}
 */
export function requirePhaseArg(raw) {
  const parsed = requireCursorNumber(raw, { decimal: true });
  if (!parsed.ok) return { ok: false };
  return { ok: true, raw: String(raw).trim(), value: parsed.value };
}
