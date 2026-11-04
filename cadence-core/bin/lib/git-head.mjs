// @ts-check
// git-head.mjs - the one reader of "what branch is this repo on". Node builtins only, same mold as
// lib/git-tags.mjs, which answers the different question of what's already published. Two modules because
// only three of the seams that want the branch also want the tags.
//
// Three consumers: git-guard.mjs (the protected-branch rail), git-publish.mjs (the push gate) and git-branch.mjs
// (the integration-branch advice). Not land-cleanup.mjs, which takes its branch from --branch or the planning
// prose and must not gain a reader of its own.
import { execFileSync } from 'node:child_process';

/**
 * The current branch of the repo containing `dir`, trimmed, or `''`.
 *
 * Never throws: no repo, no commits, no git on PATH or an unreadable dir all answer `''`. That's load-bearing,
 * because git-guard.mjs is a PreToolUse hook that swallows any throw, so a reader that threw would make the guard
 * quietly stop guarding right when it couldn't tell where it was. Callers already read `''` as not on a base.
 * A detached HEAD answers the literal `HEAD`, which is git's own answer, so it passes through.
 *
 * `dir` is always the caller's directory (the hook's cwd, or the seam's `--dir`), and `git -C` finds the repo upward from it.
 * @param {string} dir @returns {string}
 */
export function readCurrentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}
