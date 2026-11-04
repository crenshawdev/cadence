// @ts-check
// what a declared `files:` entry covers, as one statement two seams ask: plan-overlap intersected by exact string while lease-check read a trailing slash as a directory, so `src/` in one plan and `src/auth.js` in another passed the parallel-safety gate and were then refused at commit
//
// a declaration ending in `/` is a directory lease and covers everything beneath it; every other declaration covers only the byte-identical path
// no substring matching, or a plan declaring `src/auth` would license `src/authority.js`, a different file another plan may have declared, and the lease would license destroying it
// non-path strings are accepted and match only themselves: parsePlanFiles unions the raw annotated form of a task line (`src/a.rs (edit)`) in beside its normalized twin
// no filesystem, and three things deliberately not normalized:
//   symlinks: resolving one needs the filesystem at gate time, and a plan declares files it hasn't created yet
//   case folding: whether `SRC/a.js` and `src/a.js` are one path depends on the filesystem, so folding would resolve the same declarations differently on two machines
//   `..`: climbing out of the repo root is a different defect from two readers disagreeing about a spelling
// only the declared side is resolved; the staged side arrives canonical through `repoRel`, and a second transform over it is how the non-ASCII hard block gets re-broken
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
