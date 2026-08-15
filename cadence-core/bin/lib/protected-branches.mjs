// @ts-check
// protected-branches.mjs - the ONE coercion of `git.protected_branches` into
// the branch list the four readers guard with (git-guard, git-publish,
// git-branch, land-cleanup). Zero-dep, pure, node builtins only - the same mold
// as lib/git-tags.mjs.
//
// A PURE coercion over an already-merged `git` block, never its own
// mergeLayers (D-01). Each of the four callsites merges a different thing and
// needs a different SECOND answer off the same merge - git-publish returns
// `{branches, warnings, tornLayers}`, git-guard keys its torn-layer arm on
// `tornPrefixes` - so a helper that merged would have to be four helpers. It is
// a new module rather than an export on lib/config-merge.mjs (whose header
// claims config LAYERING as its whole subject, which a git-key coercion is not)
// and rather than an addition to lib/seam-io.mjs (an output-only boundary,
// D-04).
//
// The string arm's reason, carried here from the two callsites where it was
// written down (#38): a lone string is an easy hand-edit and names the branch
// the user MEANS to protect, so honor it rather than silently reverting to the
// default list and unprotecting that branch. Other non-array, non-string shapes
// still fall to the default.
'use strict';

/**
 * The protected-branch list from an already-merged `git` config block.
 *
 * An array passes through UNCHANGED, `[]` included: an empty list means
 * "nothing is protected" and must never fall through to the default (D-09) -
 * a user who emptied the list said something, and re-protecting `main` behind
 * their back is the silent revert this whole helper exists to prevent. A
 * string becomes a one-element list (#38). Anything else - absent, number,
 * object, null - is the default `['main','master']`.
 *
 * @param {Record<string, any> | undefined | null} git the merged `git` block
 * @returns {string[]}
 */
export function resolveProtectedBranches(git) {
  const value = git ? git.protected_branches : undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return ['main', 'master'];
}
