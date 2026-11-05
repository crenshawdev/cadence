// @ts-check
// git-tags.mjs - the one reader of "what has this repo already published", shared by the audit's version_drift and the
// branch-naming refusal, since two answers would drift and both feed a blocking verdict.
// Tags, never a manifest: a tag is language-agnostic, and the manifest reader resolves relative to the script.
// `git -C <dir>` walks up to the first repository, so a project that isn't one inherited an enclosing repo's tags and
// could fail on a version it never published. So the caller states its root; an answer from outside it is no answer.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { within } from './contained.mjs';

/**
 * The path with symlinks resolved, or the absolute path when it can't be.
 * git prints a physical path, so a symlinked checkout would read as another project and drop every tag.
 * @param {string} p @returns {string}
 */
function physical(p) {
  try { return realpathSync(resolve(p)); } catch { return resolve(p); }
}

/**
 * Every tag in the repo containing `dir`, in `git tag --list` order, but only when that repo is `projectRoot`'s own.
 * Degrades to `[]` on any failure: "no tags", "can't tell" and "not ours" all mean no evidence of a publication.
 * A linked worktree still reads: `--show-toplevel` returns the worktree root, and the tags are shared.
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
