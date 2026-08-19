// @ts-check
// protected-branches.mjs - the ONE coercion of `git.protected_branches` into
// the branch list the five readers guard with (git-guard, git-publish,
// git-branch, land-cleanup, issue-check). Zero-dep, pure, node builtins only -
// the same mold as lib/git-tags.mjs.
//
// The returned list never contains an empty or whitespace-only entry, and that
// is load-bearing at more than the guard verdict: land-cleanup.mjs and
// issue-check.mjs both index `[0]` for a BASE REF, so an entry naming no branch
// spends itself as `git branch --merged ""` and `git log ..HEAD` - queries that
// answer emptily and successfully rather than failing (D-01, D-02, D-09).
//
// A PURE coercion over an already-merged `git` block, never its own
// mergeLayers (D-01). Each of the five callsites merges a different thing and
// needs a different SECOND answer off the same merge - git-publish returns
// `{branches, warnings, tornLayers}`, git-guard keys its torn-layer arm on
// `tornPrefixes` - so a helper that merged would have to be five helpers. It is
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

/** Does this entry name a branch? A string whose trimmed form is non-empty.
 * The predicate decides what is KEPT, never what it is spelled as: re-spelling
 * a branch name the user typed is a second behaviour, and `git` is the only
 * thing entitled to say a name is unusable. */
const namesABranch = (entry) => typeof entry === 'string' && entry.trim() !== '';

/**
 * The protected-branch list from an already-merged `git` config block.
 *
 * One grammar over both spellings (D-01): an entry survives only when it names
 * a branch. An array that was ALREADY empty passes through as `[]` - an empty
 * list means "nothing is protected" and must never fall through to the default
 * (D-09), because a user who emptied the list said something and re-protecting
 * `main` behind their back is the silent revert this helper exists to prevent.
 * A NON-empty array whose entries all fail the predicate is a different thing:
 * a value naming no branch is a typo, not a decision, so it falls to the
 * default `['main','master']` (D-02) rather than to a list that protects
 * nothing while reading as configured. A string becomes a one-element list when
 * it names a branch (#38), and falls to the default when it does not - `""` is
 * byte-identical to the `[""]` this refuses, reached by a different spelling.
 * Anything else - absent, number, object, null - is the default.
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
