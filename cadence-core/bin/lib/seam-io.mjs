// @ts-check
// seam-io.mjs - the seam output convention every bin script follows: one JSON object on stdout, exit 0 for ok
// and 1 for degraded. Never process.exit() after the write, it can truncate stdout on a pipe and stdout is the
// only channel the seam layer parses. Set exitCode and let the stream drain.
//
// Scripts keep their own thin ok()/fail() wrappers because their output shapes differ on purpose; this owns
// the convention those wrappers must not drift from.
'use strict';

/**
 * Sentinel a throwing wrapper uses to unwind the command; entry points swallow it and treat
 * anything else as an internal error.
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
