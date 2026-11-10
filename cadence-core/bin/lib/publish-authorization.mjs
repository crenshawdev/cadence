// @ts-check
// the one reader of cadence.publishForVerification, shared with `test-policy check` so the two can't drift
// local config only: a clone's .planning/config.json, `git -c` or the user-global file must never authorize a publish
// --local alone isn't enough: GIT_DIR or GIT_COMMON_DIR can aim it at another repo, so strip what rev-parse lists
'use strict';

import { execFileSync } from 'node:child_process';

/** @type {string[]|null|undefined} git's list, asked once per process; null when git couldn't answer, so a later call asks again */
let names;
const FALLBACK_NAMES = ['GIT_DIR', 'GIT_COMMON_DIR'];
/** @returns {string[]|null} */
function askNames() {
  try {
    return execFileSync('git', ['rev-parse', '--local-env-vars'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch { return null; }
}

/**
 * `env` minus the variables that would aim git at some other repository. Never throws.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function localGitEnv(env = process.env) {
  names ??= askNames();
  const clean = { ...env };
  for (const n of names ?? FALLBACK_NAMES) delete clean[n];
  return clean;
}

/**
 * True only when this repo's own config holds `cadence.publishForVerification` as true. Unset or invalid is false.
 * @param {string} dir
 * @returns {boolean}
 */
export function publishAuthorized(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'config', '--local', '--type=bool', '--get', 'cadence.publishForVerification'],
      { encoding: 'utf8', env: localGitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }).trim() === 'true';
  } catch { return false; }
}
