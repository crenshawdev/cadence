// @ts-check
// git-head.mjs - the one reader of "what branch is this repo on", and of the config that picks where a push lands.
// Node builtins only.
// Apart from lib/git-tags.mjs because only three of the seams that want the branch also want the tags.
// Consumers: git-guard.mjs, git-publish.mjs and branch-advice.mjs. Not land-cleanup.mjs, which takes --branch instead.
import { execFileSync } from 'node:child_process';

/**
 * The current branch of the repo containing `dir`, trimmed, or `''`.
 *
 * Never throws: git-guard.mjs is a PreToolUse hook that swallows any throw, so a throwing reader would make the
 * guard quietly stop guarding. Callers read `''` as not on a base. A detached HEAD answers the literal `HEAD`.
 *
 * `dir` is the caller's directory, and `git -C` finds the repo upward from it.
 * @param {string} dir @returns {string}
 */
export function readCurrentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

/**
 * The push.default and remote.<name>.push lines git config holds for the repo containing `dir`, every scope, in
 * git's order: `['push.default upstream']`. `[]` when none is set, and null when git can't answer, which git-guard
 * reads as a push it can't rule clear.
 * @param {string} dir @returns {string[] | null}
 */
export function readPushConfig(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'config', '--get-regexp', '^(push\\.default|remote\\..*\\.push)$'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch (e) {
    return /** @type {{status?: number}} */ (e).status === 1 ? [] : null; // 1 is git config's "no match"
  }
}
