// @ts-check
// git-head.mjs - the one reader of "what branch is this repo on". Node builtins only.
// Apart from lib/git-tags.mjs because only three of the seams that want the branch also want the tags.
// Consumers: git-guard.mjs, git-publish.mjs and git-branch.mjs. Not land-cleanup.mjs, which takes --branch instead.
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
