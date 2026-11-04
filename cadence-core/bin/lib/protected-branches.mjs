// @ts-check
// protected-branches.mjs - the one coercion of `git.protected_branches` into the list the five readers guard with
// (git-guard, git-publish, git-branch, land-cleanup, issue-check). Pure, node builtins only.
// The list never has an empty or whitespace-only entry: land-cleanup and issue-check index `[0]` for a base ref, so such
// an entry becomes `git branch --merged ""` and `git log ..HEAD`, which answer emptily and successfully instead of failing.
// It coerces an already-merged `git` block and never calls mergeLayers itself: each callsite merges something different
// and wants a different second answer off it (git-publish `{branches, warnings, tornLayers}`, git-guard `tornPrefixes`),
// so a helper that merged would be five helpers. It isn't on config-merge.mjs (layering) or seam-io.mjs (output only) either.
// A lone string is an easy hand-edit and names the branch the user means to protect (#38), so it's honored rather than
// silently reverting to the default list and unprotecting that branch.
'use strict';

/** Does this entry name a branch? Only a string with something left after trimming. The predicate decides what is
 * kept, never how it's spelled: `git` is the only thing entitled to say a name is unusable. */
const namesABranch = (entry) => typeof entry === 'string' && entry.trim() !== '';

/**
 * The protected-branch list from an already-merged `git` config block.
 * An entry survives only when it names a branch. An array that was already empty stays `[]`: empty means "nothing is
 * protected", and re-protecting `main` behind the user's back is the silent revert this helper exists to prevent.
 * A non-empty array where every entry fails is a typo, not a decision, so it falls to `['main','master']` rather than a
 * list that protects nothing while reading as configured. A string becomes a one-element list when it names a branch
 * (#38); `""` is the `[""]` case spelled differently. Anything else (absent, number, object, null) is the default.
 *
 * @param {Record<string, any> | undefined | null} git the merged `git` block
 * @returns {string[]}
 */
export function resolveProtectedBranches(git) {
  const value = git ? git.protected_branches : undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const named = value.filter(namesABranch);
    return named.length > 0 ? named : ['main', 'master'];
  }
  if (typeof value === 'string') return namesABranch(value) ? [value] : ['main', 'master'];
  return ['main', 'master'];
}
