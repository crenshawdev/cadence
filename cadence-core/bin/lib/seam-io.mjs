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

/**
 * The catch arm every seam entry script ends in. A refusal `requireFlag` raised carries `.seam` and `.detail`
 * and no `message`, so without the split a valueless --dir would surface as internal "[object Object]".
 * @param {any} e whatever the dispatch threw
 * @param {(msg: string) => any} [scrub] what the internal detail passes through (`redactUrl` where a URL can ride a message)
 */
export function emitCaught(e, scrub = (msg) => msg) {
  if (e && e.seam) {
    emit({ ok: false, reason: e.seam, detail: e.detail,
      hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  } else {
    emit({ ok: false, reason: 'internal', detail: scrub(e && e.message ? e.message : String(e)) });
  }
}
