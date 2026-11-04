// @ts-check
// what a `--plan` value may be, stated once for the two `risk-check` faces that have to agree about it
// `run` guarded `--plan` with requireInt while `status` demands whatever key the lifecycle brackets carry, so a fix pass bracketed as `1-fix` made `status` demand a record `run` answered `bad-args` for: a blocking gate no argv could satisfy, whose only exit was an override
// so the grammar widens to the worker key and `status` doesn't narrow, since dropping a key the coordinator actually bracketed would fail open on the one trigger that blocks everywhere. One predicate, so the face that enforces can't disagree with the face that reports
// what it refuses, each for a reason:
//   a non-string     parseArgs gives a valueless `--plan` the boolean `true` and Number(true) is 1, so a bare `--plan` recorded the answer against the first plan
//   empty or blank   identifies nothing, and `status` groups ranges by this value, so a blank one joins the "no plan at all" row
//   outer whitespace `trace append --plan` stores the string untrimmed, so ` 1` and `1` would be two rows; refused and not normalized, because a trimming face would write a record no untrimmed receipt could settle
//   NUL or newline  `rowKey` joins the correlation id and plan with NUL, so a key carrying one could collide with another row's identity, and a newline breaks the append-only JSONL
// the accepted value comes back verbatim, since the record and the receipt have to be one spelling or the join finds nothing
// classify, never emit, no I/O, like require-int; each caller owns its reason string
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
