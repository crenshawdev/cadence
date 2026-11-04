// @ts-check
// git-tags.mjs - the one reader of "what has this repo already published". Zero-dep. It was pulled out of git-branch.mjs
// when `planning.mjs audit`'s version_drift signal became a second consumer: two callers asking git the same question are
// two answers waiting to drift, and this one feeds a ship-blocking verdict and a branch-naming refusal.
// Tags, never a manifest: a tag is language-agnostic, while the only manifest reader in this tree resolves
// `.claude-plugin/plugin.json` relative to the script, so elsewhere it would compare a user's milestone to Cadence's version.
// `git -C <dir>` walks up to the first repository, so a project that isn't one used to inherit an enclosing repo's tags and
// could be failed by a version it never published (the audit asks from `.planning`, which never holds `.git`). So the caller
// states its project root, and an answer from outside it is no answer.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { within } from './contained.mjs';

/**
 * The path with symlinks resolved, or the absolute path when it can't be. git prints a physical path and the caller hands
 * us a logical one, so a symlinked checkout (`/code -> /data/code` here) would read as another project and drop every tag.
 * @param {string} p @returns {string}
 */
function physical(p) {
  try { return realpathSync(resolve(p)); } catch { return resolve(p); }
}

/**
 * Every tag in the repo containing `dir`, trimmed, in `git tag --list` order, but only when that repo is `projectRoot`'s own.
 * Degrades to `[]` on any failure (no repo, no tags, no git, unreadable dir, someone else's repo): "no tags", "can't tell"
 * and "not ours" all mean no evidence of a publication; a consumer that must tell them apart needs a different question.
 * `dir` may be anywhere in the working tree and `projectRoot` is the root the caller derived: the audit's `dir` is the
 * planning root so its project root is the parent, while `git-branch.mjs decide` already receives the project root.
 * A linked worktree still reads: `--show-toplevel` returns the worktree root, and the tags are shared with the main repo.
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
