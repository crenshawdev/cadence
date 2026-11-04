// @ts-check
// base-ref.mjs - the check both land seams (issue-check.mjs `check`, land-cleanup.mjs `cleanup`) run on the
// resolved base before it reaches a git argv. The base is committed text (`git.base_branch`), so a flag-shaped
// value is an option to git and not a ref: `--output=<path>` in `git log <base>..HEAD` writes a file.
//
// It refuses a base starting with `-` without spawning anything, then needs the base to name a commit, locally or
// as `origin/<base>` alone, because /cad-land's checkout makes the local branch from origin/<base>. It returns the
// reason for the caller's `action:"skip"` envelope, or null when the base is usable. The base is JSON-quoted in
// that reason since /cad-land prints it verbatim, and a raw newline in committed text would forge a second line.
//
// Not planning/core.mjs's `riskRef` / `resolveRef`, which are a different contract (refs for `risk-check`).
// Node builtins only. Never throws.
'use strict';

import { spawnSync } from 'node:child_process';

/**
 * @param {string} dir the repository directory
 * @param {unknown} base the resolved base
 * @param {number} [timeout] ms bound on the one spawn, killed with SIGKILL at the bound;
 *   omitted means unbounded, like the caller's other git reads
 * @returns {string|null} why the base is refused, or null when it is usable
 */
export function refuseBase(dir, base, timeout) {
  const named = JSON.stringify(String(base));
  if (typeof base === 'string' && base.startsWith('-')) {
    return `base ${named} begins with "-" and would be read by git as an option`;
  }
  // --quiet so a miss is silent; the first candidate that names a commit wins.
  const names = (base) => {
    try {
      return spawnSync('git', ['-C', dir, 'rev-parse', '--verify', '--quiet', `${base}^{commit}`], {
        stdio: 'ignore', killSignal: 'SIGKILL', ...(timeout ? { timeout } : {}),
      }).status === 0;
    } catch { return false; }
  };
  const usable = names(base) || names(`refs/remotes/origin/${base}`);
  return usable ? null : `base ${named} names no commit in this repository`;
}
