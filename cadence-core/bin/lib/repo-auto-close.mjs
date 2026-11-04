// @ts-check
// repo-auto-close.mjs - the one read of `git.auto_close` that answers "may this machine run an unattended publish or
// merge of this repository". Zero-dep, two filesystem reads and no other I/O.
// Authorized only when both `<dir>/.planning/config.json` and the user-global config set `git.auto_close` to an explicit
// `true`. A global value alone can't speak for a repo that never opted in, and a repo value alone can't speak for the
// user: the repo config is committed and arrives with a clone, which must not be able to switch on an unattended push.
// Each half is a raw `JSON.parse` of its own file, not `mergeLayers`: `config.mjs get` can't answer per layer, and the
// merge skips a torn layer where this read must withhold. Anything that throws or isn't an explicit `true` reads as no
// opt-in, because failing closed is the only safe direction for an answer that unlocks a push.
// If CADENCE_GLOBAL_CONFIG names the repo's own config (by `layerIdentity`, through symlinks), that's one layer and no
// authorization. `shared` says so, so the refusal names the file instead of telling the user to set a key it already sets.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL_CONFIG, isPlainObject, layerIdentity } from './config-merge.mjs';

/** @typedef {'set' | 'unset' | 'unreadable'} LayerOptIn */

/**
 * One layer's answer. `unset` for a missing file (and the `''` path GLOBAL_CONFIG holds where homedir() throws),
 * `unreadable` for a file that exists but won't read, parse or isn't a JSON object, `set` only for an explicit
 * `git.auto_close === true`.
 * @param {string} file
 * @returns {LayerOptIn}
 */
function layerOptIn(file) {
  if (!file) return 'unset';
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { return /** @type {any} */ (e)?.code === 'ENOENT' ? 'unset' : 'unreadable'; }
  if (!isPlainObject(parsed)) return 'unreadable';
  return parsed?.git?.auto_close === true ? 'set' : 'unset';
}

/**
 * Did both layers opt in to the unattended close of the repository at `dir`?
 * Total: never throws, whatever `dir` is. `authorized` is true only when `repo` and `global` are both `set` and are
 * different files; `shared` means they're one file, and then `global` reads `unset`.
 * @param {string} dir repo/planning root
 * @returns {{authorized: boolean, repo: LayerOptIn, global: LayerOptIn, shared: boolean, repoFile: string, globalFile: string}}
 */
export function autoCloseLayers(dir) {
  let repoFile = '';
  try { repoFile = join(dir, '.planning', 'config.json'); } catch { /* non-string dir */ }
  const repo = layerOptIn(repoFile);
  const rid = layerIdentity(repoFile);
  const shared = rid !== null && rid === layerIdentity(GLOBAL_CONFIG);
  const global = shared ? 'unset' : layerOptIn(GLOBAL_CONFIG);
  return { authorized: repo === 'set' && global === 'set', repo, global, shared, repoFile, globalFile: GLOBAL_CONFIG };
}
