// @ts-check
// publish-authorization.mjs - the ONE reader of `cadence.publishForVerification`,
// the repository-local git setting that authorizes publishing a branch for CI
// verification (phase 1, D-02). `test-policy check` reports it and the publish
// path imports this same function, so the two cannot drift.
//
// WHY `git config --local` AND NOTHING ELSE. The value must come from this
// repository's own `.git/config`: not the user-global config, not `git -c`, not
// the environment, not `.planning/config.json` (which arrives with a clone), and
// not `git.auto_close`. `--local` alone is not enough - measured with git 2.56,
// it reads ANOTHER repository's value when `GIT_DIR` or `GIT_COMMON_DIR` points
// there, even with `-C`. So the child runs with every repository-local variable
// `git rev-parse --local-env-vars` prints removed, which also drops
// `GIT_CONFIG_PARAMETERS`, the carrier of `git -c`.
'use strict';

import { execFileSync } from 'node:child_process';

/**
 * `env` without the variables that would point git at a repository other than
 * the one `-C` names. Never throws: when git cannot print its own list, the two
 * measured ones are removed.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function localGitEnv(env = process.env) {
  let names = ['GIT_DIR', 'GIT_COMMON_DIR'];
  try {
    names = execFileSync('git', ['rev-parse', '--local-env-vars'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch { /* fall back to the two measured names */ }
  const clean = { ...env };
  for (const n of names) delete clean[n];
  return clean;
}

/**
 * True only when the repository at `dir` holds `cadence.publishForVerification`
 * as true in its own config. An unset value (exit 1) or an invalid one (exit 128)
 * is false, and this never throws.
 * @param {string} dir
 * @returns {boolean}
 */
export function publishAuthorized(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'config', '--local', '--type=bool', '--get', 'cadence.publishForVerification'],
      { encoding: 'utf8', env: localGitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }).trim() === 'true';
  } catch { return false; }
}
