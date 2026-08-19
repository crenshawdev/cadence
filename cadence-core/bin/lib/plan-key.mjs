// @ts-check
// plan-key.mjs - the ONE statement of what a `--plan` value may be, for the two
// `risk-check` faces that have to agree about it.
//
// THE DEFECT (RSK-03). `risk-check run` guarded `--plan` with `requireInt` and
// `risk-check status` derives what it demands from the lifecycle brackets
// `workflows/execute.md` writes, where `references/seams.md` describes
// `--bracket-plan` as "the worker key when it is not the role name" and
// lib/trace.mjs describes it as "a plan number on either execute path, a role
// name for a role-dispatched worker". A coordinator that bracketed a fix pass
// as `1-fix` therefore had `status` demand a record for `1-fix` that `run`
// answered `bad-args` for - a blocking gate, at every stakes level, that no
// argv could satisfy and whose only exit was an `override`.
//
// So the grammar WIDENS to the worker key, and `status` does not narrow
// (phase 3 D-01): dropping a key the coordinator actually bracketed would be
// fail-open on the one trigger that blocks everywhere, which is the worse of
// the two errors. ONE predicate, consulted by both faces (D-02) - two copies
// let the face that enforces the question disagree with the face that reports
// it, which is the failure lib/surface-scan.mjs's `answeredSurfaces` comment
// already states for the surface question, and which is this defect itself one
// spelling over.
//
// WHAT IT REFUSES, each for a reason and not for tidiness:
//
//   a non-string     `parseArgs` gives a VALUELESS `--plan` the boolean `true`,
//                    and `Number(true)` is 1 - so `risk-check run --plan` with
//                    nothing after it recorded the answer against plan 1. That
//                    is the VAL-01 rail the `requireInt` call was standing for,
//                    and it survives the widening.
//   empty / blank    a key that identifies nothing. `status` groups completed
//                    ranges BY this value, so a blank one silently joins the
//                    "no plan at all" row.
//   outer whitespace `trace append --plan` stores the caller's string
//                    untrimmed, so ` 1` and `1` would reach the join as two
//                    different rows. Refused rather than normalized, because a
//                    face that trimmed would write a record no receipt written
//                    with the untrimmed spelling could ever settle - D-01's
//                    stated cost, paid at the door instead.
//   NUL or newline   `cmdRiskCheckStatus`'s `rowKey` joins the correlation id
//                    and the plan with a NUL separator, so a key carrying one
//                    can be spelled to collide with another row's identity -
//                    a receipt for one range settling another. A newline is
//                    the same argument against the append-only JSONL the
//                    record and the receipt both live in.
//
// The accepted value comes back VERBATIM, never normalized: the record `run`
// writes and the receipt `trace append --plan` writes must be one spelling or
// the join finds nothing, and the only spelling both callers can be relied on
// to produce is the one the coordinator typed.
//
// Shaped like lib/require-int.mjs: classify, never emit, no I/O, no env -
// each caller owns its own reason string and its own wording.
'use strict';

/** NUL and both line breaks. `\r` rides with `\n` because they are one class -
 * a key that can be split across the record's line boundary - and refusing
 * half of it would leave the argument standing and the hole open. */
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
