// @ts-check
// protected-branches.mjs - the one coercion of `git.protected_branches` into the list the five readers guard with.
// No empty or whitespace-only entry survives: land-cleanup and issue-check index `[0]` for a base ref, and an empty
// one makes git answer emptily and successfully instead of failing.
// It coerces an already-merged `git` block and never calls mergeLayers, since each callsite wants a different answer.
// A lone string is an easy hand-edit that names the branch the user means (#38), so honor it.
'use strict';

/** Does this entry name a branch? A string with something left after trimming; only git can call a name unusable. */
const namesABranch = (entry) => typeof entry === 'string' && entry.trim() !== '';

/**
 * The protected-branch list from an already-merged `git` config block.
 * An array that was already empty stays `[]`: empty means "nothing is protected", and re-protecting `main` behind the
 * user's back is the silent revert this exists to prevent.
 * A non-empty array where every entry fails is a typo, so it falls to `['main','master']`.
 * A string becomes a one-element list when it names a branch (#38). Anything else is the default.
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
