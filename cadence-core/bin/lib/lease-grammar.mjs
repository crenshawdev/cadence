// @ts-check
// lease-grammar.mjs - the ONE statement of what a declared `files:` entry
// covers. A plan's declarations are read at two different moments by two
// different seams, and until this module existed each carried its own idea of
// containment: `plan-overlap` intersected the two lists by exact string
// equality, while `lease-check` read a trailing slash as a directory prefix. A
// phase declaring `src/` in one plan and `src/auth.js` in another therefore
// produced an EMPTY overlap, passed the parallel-safety gate that is supposed
// to prove the two plans independent, and was then refused at the commit step -
// the gate admitting exactly the pair the enforcement would not separate. Both
// seams now ask this module, so the two answers cannot drift apart again.
//
// THE GRAMMAR, in one sentence each:
//
//   A declaration ending in `/` is a DIRECTORY LEASE and covers every path
//   beneath it, so `src/` covers `src/auth.js` and `src/auth/session.js`.
//
//   Every other declaration covers only the BYTE-IDENTICAL path.
//
// The second rule's narrowness is deliberate and load-bearing, not an
// unfinished substring match: matching by substring would let a plan declaring
// `src/auth` license `src/authority.js`, a DIFFERENT file that some other plan
// may have declared, and the lease would then license destroying it. A plan
// that means the directory says so with the slash.
//
// NON-PATH STRINGS are accepted, never classified as directory leases and never
// a throw. `parsePlanFiles` deliberately unions the raw annotated form of a
// `- **Files:**` task line (`src/a.rs (edit)`) into the same set as its
// normalized twin - the cross-arm bridge that keeps one declared path from
// reaching the set as two different strings - so this module is handed strings
// that are not paths as a matter of course. One that does not end in `/` simply
// matches nothing but itself, which is the correct answer for a string no file
// is named.
//
// NO FILESYSTEM, and three cases deliberately NOT normalized here, each with
// its reason:
//
//   symlinks       resolving one needs filesystem access at gate time, and
//                  `plan-overlap` runs against declarations that name files
//                  which may not exist yet - a plan declares what it is about
//                  to create.
//   case folding   whether `SRC/a.js` and `src/a.js` are one path is a property
//                  of the filesystem, so folding here would make two identical
//                  declarations resolve differently on two machines.
//   `..` traversal a declaration that climbs out of the repo root is an
//                  out-of-repo-lease defect, a different thing from two readers
//                  disagreeing about one spelling, and it is not made safe by
//                  agreeing about it.
//
// Only the DECLARED side is resolved. The staged side reaches `lease-check`
// already canonical through `repoRel` - repo-relative, forward-slash, no `./`,
// no `//` - and a second transform over paths that round-tripped through that
// seam's byte-level guard is how the non-ASCII hard block gets re-broken.
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
 * Do two DECLARATIONS reach any of the same files? Symmetric by construction,
 * because either one may be the directory lease containing the other - which
 * is the whole question the pre-flight overlap gate is asking.
 *
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
export function intersects(a, b) {
  return covers(a, b) || covers(b, a);
}
