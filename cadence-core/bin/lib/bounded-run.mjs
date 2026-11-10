// @ts-check
// bounded-run.mjs - run one child under a time bound and say only how it went. Never throws.
// stdout is '' on any failure and stderr is dropped at the spawn: a forge CLI's stderr isn't ours to read, and the default
// hands a failing child's stderr to the terminal.
'use strict';

import { execFileSync } from 'node:child_process';

/**
 * Run a command, bounded, and never throw. SIGKILL because a child that ignores SIGTERM outlives its own timeout.
 * `ok: false` means "this call didn't come back clean", not "the remote did nothing": a nonzero exit, a kill on the
 * timeout and a transport failure are one value, and on a write the last two can follow a remote that committed.
 * `timedOut` is the one thing a caller can tell apart, because the child got SIGKILL.
 *
 * @param {string} bin @param {string[]} args
 * @param {{cwd?: string, timeout: number}} opts
 * @returns {{ok: boolean, stdout: string, timedOut: boolean}}
 */
export function boundedRun(bin, args, { cwd, timeout }) {
  try {
    const stdout = execFileSync(bin, args, {
      cwd, timeout, killSignal: 'SIGKILL', encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { ok: true, stdout, timedOut: false };
  } catch (e) {
    const err = /** @type {{signal?: string}} */ (e || {});
    return { ok: false, stdout: '', timedOut: err.signal === 'SIGKILL' };
  }
}
