// @ts-check
// git-head.mjs - the ONE reader of "what branch is this repo on". Zero-dep
// (node builtins only), the same mold as lib/git-tags.mjs, which answers the
// neighbouring question "what has this repo already published". Two modules
// rather than one: the tag list and the current branch are different questions,
// and only three of the seams that want the second want the first.
//
// Three consumers, extracted when the third copy of the same six lines appeared:
// git-guard.mjs (the protected-branch rail), git-publish.mjs (the ONE mutating
// seam's push gate) and git-branch.mjs (the integration-branch advice). NOT
// land-cleanup.mjs, which has no branch reader and must not gain one - it takes
// its branch from --branch or derives it from the planning prose.
import { execFileSync } from 'node:child_process';

/**
 * The current branch of the repo containing `dir`, trimmed, or `''`.
 *
 * Degrades to `''` on ANY failure - no repo, no commits, no git on PATH, an
 * unreadable dir - and NEVER throws. That is load-bearing, not a style choice:
 * git-guard.mjs is a PreToolUse hook whose last line is `try { main(); } catch
 * {}`, so a reader that threw here would make the guard silently stop guarding
 * exactly when it could not tell where it was. "Detached HEAD", "not a repo"
 * and "cannot tell" deliberately collapse: each means this reader has no branch
 * name to guard against, and each caller already treats `''` as not-on-a-base.
 * (A detached HEAD answers the literal string `HEAD`, which is git's answer and
 * not this reader's business to reinterpret.)
 *
 * `dir` is the CALLER's directory - the hook's cwd for git-guard, the seam's
 * `--dir` for the other two - never a path this module derives. `git -C`
 * discovers the repo upward from it.
 * @param {string} dir @returns {string}
 */
export function readCurrentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}
