// @ts-check
// contained.mjs - is a path inside a root? One statement of the check, so the
// readers and writers that ask it all agree.
'use strict';

import { realpathSync } from 'node:fs';
import { sep } from 'node:path';

/**
 * Is `p` the directory `root` or inside it? Segment-wise, so `.planning-old` is
 * not read as inside `.planning`. Both paths must already be resolved.
 * @param {string} p @param {string} root @returns {boolean}
 */
export function within(p, root) {
  return p === root || p.startsWith(root.endsWith(sep) ? root : root + sep);
}

/**
 * Does `p` RESOLVE inside `root`? Judged on the real path, because a cloned
 * repo can ship a symlink that `mkdirSync(recursive)` or `readdirSync` would
 * follow out of the tree. A root that cannot be resolved keeps its literal
 * spelling, which can only refuse paths; a `p` that cannot be resolved answers
 * `false`, since it has not been shown to be contained.
 * @param {string} root
 * @param {string} p
 * @returns {boolean}
 */
export function insideRoot(root, p) {
  let real;
  try {
    real = realpathSync(root);
  } catch {
    real = root;
  }
  try {
    return within(realpathSync(p), real);
  } catch {
    return false;
  }
}
