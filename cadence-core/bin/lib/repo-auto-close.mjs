// @ts-check
// repo-auto-close.mjs - the ONE read of `git.auto_close` that answers "did this
// REPOSITORY authorize an unattended publish or merge", extracted verbatim out
// of git-publish.mjs where it lived as a private `repoAutoClose` (phase 1,
// AUT-01). Zero-dep, node builtins only, one filesystem read and no other I/O.
//
// Why this is not the merged value, and why that is the whole point. One config
// key now has TWO resolutions and they are deliberately allowed to disagree:
//
//   requested  - the MERGED global+repo value, read through `config.mjs get`.
//                It is presentation: skills/cad-land/SKILL.md branches on it and
//                skips the publish ask, and land-cleanup.mjs `gate` reads the
//                same value so its blocker/high halt covers exactly the runs
//                that skipped the human. Those two must never diverge - 0b1c322
//                aligned them onto the repo layer, broke the pairing, and was
//                reverted.
//   authorized - THIS read. Repository layer only, because an unattended push
//                or merge is a mutation of somebody else's project, and a
//                setting in the user's own home directory cannot speak for a
//                repository that never opted in (D-08). It gates the mutation;
//                the merged value gates the prompt.
//
// It stays a RAW `JSON.parse` of `<dir>/.planning/config.json` rather than
// `mergeLayers(...).layers.repo`, for two reasons and the second is the
// load-bearing one (D-02):
//
//   (a) `config.mjs get` cannot answer per-layer at all - it destructures
//       `layers` away and publishes only `values`, `source` and `warnings`.
//   (b) a merge-derived answer inherits the merge's torn-layer behaviour, under
//       which a corrupt USER-GLOBAL file can refuse the operation. That would
//       let one bad file in a home directory WITHDRAW a repository's
//       authorization - an authorization check must never fail in that
//       direction.
//
// The raw read fails CLOSED instead: every throw - missing file, unreadable
// file, truncated JSON - and every shape that is not an explicit `true` answers
// `false`, which is "this repository did not opt in". That is the only safe
// default for an answer that unlocks a mutation.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Did the repository at `dir` itself authorize the unattended close?
 *
 * TOTAL: never throws, whatever `dir` is or is not. `true` ONLY on an explicit
 * `git.auto_close === true` in `<dir>/.planning/config.json`; a missing file, an
 * unreadable one, unparseable JSON, a non-object payload, an absent key, a
 * falsy value, and a value that exists only in the user-global layer all answer
 * `false`.
 *
 * @param {string} dir repo/planning root
 * @returns {boolean}
 */
export function repoAutoClose(dir) {
  try {
    const repo = JSON.parse(readFileSync(join(dir, '.planning', 'config.json'), 'utf8'));
    return repo?.git?.auto_close === true;
  } catch { return false; }
}
