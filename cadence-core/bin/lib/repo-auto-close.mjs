// @ts-check
// repo-auto-close.mjs - the one read of `git.auto_close`: may this machine publish or merge here unattended.
// Authorized only when the repo config and the user-global config both set it to an explicit `true`.
// The repo config arrives with a clone, so it alone must never switch on an unattended push.
// The read is bothLayers': raw per half, not `mergeLayers`, since the merge skips a torn layer where this must withhold.
// Anything that throws or isn't an explicit `true` is no opt-in: an answer that unlocks a push fails closed.
// If CADENCE_GLOBAL_CONFIG names the repo's own config, that's one layer, not two; `shared` says so.
'use strict';

import { bothLayers } from './config-merge.mjs';

/** @typedef {import('./config-merge.mjs').LayerState} LayerOptIn */

/** The one key this read answers, by name so no caller spells it. */
export const AUTO_CLOSE_KEY = 'git.auto_close';

/**
 * Did both layers opt in to the unattended close of the repository at `dir`?
 * Total: never throws, whatever `dir` is. `authorized` is true only when `repo` and `global` are both `set` and are
 * different files; `shared` means they're one file, and then `global` reads `unset`.
 * @param {string} dir repo/planning root
 * @returns {{authorized: boolean, repo: LayerOptIn, global: LayerOptIn, shared: boolean, repoFile: string, globalFile: string}}
 */
export function autoCloseLayers(dir) {
  const { shared, repoFile, globalFile, keys } = bothLayers(dir, [AUTO_CLOSE_KEY]);
  const { on, repo, global } = keys[AUTO_CLOSE_KEY];
  return { authorized: on, repo, global, shared, repoFile, globalFile };
}
