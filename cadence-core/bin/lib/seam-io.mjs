// @ts-check
// seam-io.mjs - the ONE implementation of the seam output convention every
// bin script follows (planning/config/route/review-provider): exactly one
// JSON object on stdout, exit code mirroring ok (0 ok, 1 degraded), and
// never process.exit() after the write - that can truncate stdout mid-write
// on a pipe, and stdout is the single channel the whole seam layer parses.
// Setting exitCode instead lets the stream drain and the process exit
// cleanly once no work remains.
//
// Scripts keep their own thin ok()/fail() wrappers (their output shapes
// differ deliberately - hint fields, throwing vs returning); this module
// owns the convention those wrappers must never drift from.
'use strict';

/**
 * Sentinel a throwing wrapper uses to unwind the current command; entry
 * points swallow it and treat anything else as an internal error.
 */
export const DONE = Symbol('cadence-seam-done');

/**
 * Write the one JSON line and mirror `ok` into the exit code.
 * @param {Record<string, any>} obj
 */
export function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
  process.exitCode = obj.ok === false ? 1 : 0;
}
