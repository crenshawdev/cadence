// @ts-check
// base-ref.mjs - the ONE check both land seams (issue-check.mjs `check`,
// land-cleanup.mjs `cleanup`) run on the RESOLVED base before it reaches a git
// argv (phase 1 D-10, D-11). The base is repository-committed text
// (`git.base_branch`), so a value shaped like a flag is an option to git, not a
// ref: `--output=<path>` in `git log <base>..HEAD` writes a file.
//
// It refuses a base that begins with `-` WITHOUT spawning anything, and
// otherwise requires that the base names a commit here - locally, or as
// `origin/<base>` alone: /cad-land step 4's `git checkout <base>` creates the
// local branch from origin/<base>, so a remote-only base is one a land that
// finished before this check existed still finishes. It answers with the
// reason fragment the caller puts in an `action:"skip"` envelope, or null when
// the base is usable. The base is JSON-quoted in that fragment because the
// caller's reason is printed verbatim by /cad-land and the value is committed
// text: a raw newline would forge a second line.
//
// Not planning/core.mjs's `riskRef` / `resolveRef`: those are a different
// contract (a caller's refs for `risk-check`) and stay as they are. Node
// builtins only. Never throws.
'use strict';

import { spawnSync } from 'node:child_process';

/**
 * @param {string} dir the repository directory
 * @param {unknown} base the resolved base
 * @param {number} [timeout] ms bound on the one spawn, SIGKILL at the bound;
 *   omitted means unbounded, as the caller's other git reads are
 * @returns {string|null} why the base is refused, or null when it is usable
 */
export function refuseBase(dir, base, timeout) {
  const named = JSON.stringify(String(base));
  if (typeof base === 'string' && base.startsWith('-')) {
    return `base ${named} begins with "-" and would be read by git as an option`;
  }
  // `--quiet` keeps a miss silent; the first candidate that names a commit wins.
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
