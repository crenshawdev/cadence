// @ts-check
// what a declared `files:` entry covers: one statement for two seams that disagreed on a trailing slash
//
// a declaration ending in `/` is a directory lease and covers everything beneath it; any other covers only itself
// no substring matching, or a plan declaring `src/auth` would license `src/authority.js`
// non-path strings match only themselves: parsePlanFiles adds each raw task line beside its twin
// no filesystem, so no symlink resolution (plans declare files not yet created), no case folding, no `..` handling
// only the declared side is resolved; the staged side arrives canonical through `repoRel`
'use strict';

/**
 * Does `declaration` license `path`?
 *
 * @param {unknown} declaration one entry of a plan's declared files
 * @param {unknown} path a repo-relative path, or another declaration
 * @returns {boolean}
 */
export function covers(declaration, path) {
  if (typeof declaration !== 'string' || typeof path !== 'string') return false;
  if (!declaration.endsWith('/')) return declaration === path;
  return path.startsWith(declaration);
}

/**
 * Do two declarations reach any of the same files? Symmetric, because either
 * may be the directory lease containing the other.
 *
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
export function intersects(a, b) {
  return covers(a, b) || covers(b, a);
}

/**
 * Does this declaration carry a spelling the grammar refuses? Exactly three: a
 * leading `./`, a `/./` segment and `//`. Each names the same file as its plain
 * spelling, so admitting one would put a file in the declared set under two
 * strings read as two files.
 *
 * Refused rather than normalized, because normalizing can only widen a lease
 * and a parallel-safety gate must not do that quietly. The caller drops the
 * declaration and files a diagnostic so the author is told.
 *
 * `..` isn't here: that's an out-of-repo lease, a different question.
 *
 * @param {unknown} declaration @returns {boolean}
 */
export function isRefusedSpelling(declaration) {
  if (typeof declaration !== 'string') return false;
  return declaration.startsWith('./')
    || declaration.includes('/./')
    || declaration.includes('//');
}
