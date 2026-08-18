// @ts-check
// git-tags.mjs - the ONE reader of "what has this repo already published".
// Zero-dep (node builtins only). Extracted from git-branch.mjs when a second
// consumer appeared (`planning.mjs audit`'s version_drift signal, FRI-03), for
// the same reason lib/branch-decision.mjs keeps ONE prose version reader: two
// callers asking the same question of git are two answers waiting to drift, and
// the answer here is the input to a ship-blocking verdict on one side and a
// branch-naming refusal on the other.
//
// Tags, never a manifest (D-03). A tag is language-agnostic and true in a
// project that is not Cadence; the only manifest reader in this tree resolves
// `.claude-plugin/plugin.json` relative to the SCRIPT, so anywhere but this repo
// it would compare a user's milestone against Cadence's own version.
//
// The upward discovery `git -C` performs is BOUNDED here (TAG-01). `git -C
// <dir>` walks parents until it finds a repository, so a project that is not
// itself a repository used to inherit an enclosing one's tags - and the audit
// asks this question from `.planning`, which never holds `.git`. A project
// checked out inside an unrelated umbrella repository could therefore be FAILed
// by a version it never published. The caller now states which project root the
// answer has to belong to, and an answer from outside it is no answer.
import { execFileSync } from 'node:child_process';
import { resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';

/**
 * The path with its symlinks resolved, or the absolute path when it cannot be:
 * the two sides of the containment test below are produced differently - git
 * prints a physical path, the caller hands us a logical one - and a symlinked
 * checkout (`/code -> /data/code` on this developer's box) would otherwise read
 * as "a different project" and silently drop every tag.
 * @param {string} p @returns {string}
 */
function physical(p) {
  try { return realpathSync(resolve(p)); } catch { return resolve(p); }
}

/**
 * Is `top` the project root `root`, or a directory inside it? Segment-wise, so
 * `/a/bc` is not read as inside `/a/b`.
 * @param {string} top @param {string} root @returns {boolean}
 */
function within(top, root) {
  return top === root || top.startsWith(root.endsWith(sep) ? root : root + sep);
}

/**
 * Every tag in the repo containing `dir`, trimmed, in `git tag --list` order -
 * but only when that repo is `projectRoot`'s own.
 *
 * Degrades to `[]` on ANY failure - no repo, no tags, no git on PATH, an
 * unreadable dir, or a repo that is not this project's - so a caller in a
 * non-repo decides exactly as it did before this reader existed. "No tags",
 * "cannot tell" and "not ours" deliberately collapse: all three mean this
 * reader has no evidence of a publication, and none is evidence OF one. A
 * consumer that needs to distinguish them needs a different question, not a
 * different failure mode here (D-08).
 *
 * `dir` may be any path inside the working tree (the planning root, say) and
 * `projectRoot` is the root the caller derived for itself - the two differ, and
 * each caller derives its own (D-07): the audit's `dir` IS the planning root,
 * so its project root is that directory's parent, while `git-branch.mjs decide`
 * already receives the project root and joins `.planning` itself.
 *
 * A LINKED WORKTREE still reads: `--show-toplevel` there returns the worktree
 * root, which is the root the caller derived, and the tags are shared with the
 * main repository.
 * @param {string} dir @param {string} projectRoot @returns {string[]}
 */
export function readTags(dir, projectRoot) {
  const git = (...args) => execFileSync('git', ['-C', dir, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const top = git('rev-parse', '--show-toplevel').trim();
    if (!top || !within(physical(top), physical(projectRoot))) return [];
    return git('tag', '--list').split('\n').map((t) => t.trim()).filter(Boolean);
  } catch { return []; }
}
