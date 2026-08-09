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
import { execFileSync } from 'node:child_process';

/**
 * Every tag in the repo containing `dir`, trimmed, in `git tag --list` order.
 *
 * Degrades to `[]` on ANY failure - no repo, no tags, no git on PATH, an
 * unreadable dir - so a caller in a non-repo decides exactly as it did before
 * this reader existed. "No tags" and "cannot tell" deliberately collapse: both
 * mean this reader has no evidence of a publication, and neither is evidence
 * OF one. A consumer that needs to distinguish them needs a different question,
 * not a different failure mode here.
 *
 * `dir` may be any path inside the working tree (the planning root, say): `git
 * -C` discovers the repo upward from it.
 * @param {string} dir @returns {string[]}
 */
export function readTags(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'tag', '--list'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((t) => t.trim()).filter(Boolean);
  } catch { return []; }
}
