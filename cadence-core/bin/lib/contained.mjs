// @ts-check
// contained.mjs - is a path inside a root? One statement of the check, so every reader and writer that asks agrees.
'use strict';

import { realpathSync } from 'node:fs';
import { sep } from 'node:path';

/**
 * Is `p` the directory `root` or inside it? Compares by segment, so `.planning-old` isn't inside
 * `.planning`. Both paths must already be resolved.
 * @param {string} p @param {string} root @returns {boolean}
 */
export function within(p, root) {
  return p === root || p.startsWith(root.endsWith(sep) ? root : root + sep);
}

/**
 * Does `p` resolve inside `root`? Judged on the real path, because a cloned repo can ship a symlink that
 * `mkdirSync(recursive)` or `readdirSync` would follow out of the tree. A root that won't resolve keeps its
 * literal spelling, which can only refuse more; a `p` that won't resolve is `false`, since nothing shows it's inside.
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
