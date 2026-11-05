// @ts-check
// what a `--plan` value may be, stated once for the two `risk-check` faces
// `run` used requireInt but `status` takes any bracketed key, so `1-fix` left a blocking gate no argv could satisfy
//   a non-string     a valueless `--plan` parses as `true` and Number(true) is 1, so it hit the first plan
//   empty or blank   identifies nothing, so it would join the no-plan row
//   outer whitespace `trace append` stores it untrimmed, so ` 1` and `1` would be two rows
//   NUL or newline   `rowKey` joins on NUL, and a newline breaks the JSONL
// the value comes back verbatim, or the record and the receipt won't join
'use strict';

/** NUL and both line breaks; `\r` rides with `\n` because refusing half the class would leave the hole open. */
const FORBIDDEN = /[\0\n\r]/;

/**
 * @param {unknown} raw a `--plan` value as argv delivered it
 * @returns {{ok: true, key: string} | {ok: false}}
 */
export function requirePlanKey(raw) {
  if (typeof raw !== 'string') return { ok: false };
  if (raw.trim() === '') return { ok: false };
  if (raw !== raw.trim()) return { ok: false };
  if (FORBIDDEN.test(raw)) return { ok: false };
  return { ok: true, key: raw };
}
