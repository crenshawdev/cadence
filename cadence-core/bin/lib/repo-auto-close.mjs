// @ts-check
// repo-auto-close.mjs - the ONE read of `git.auto_close` that answers "may this
// machine run an unattended publish or merge of THIS repository", first
// extracted out of git-publish.mjs as a repo-only read (phase 1, AUT-01).
// Zero-dep, node builtins only, two filesystem reads and no other I/O.
//
// The rule (D-02): the unattended close is authorized only when BOTH the
// repository's `<dir>/.planning/config.json` AND the user-global config set
// `git.auto_close` to an explicit `true`. Either half alone authorizes nothing:
//
//   - a user-global value alone cannot speak for a repository that never opted
//     in, because the close mutates THAT repository (D-08);
//   - a repository value alone cannot speak for the user, because the repo
//     config is committed and arrives with a clone, and a cloned repository
//     must not be able to turn on an unattended push or merge on a machine
//     whose user never opted in (D-08's converse).
//
// "Requested" and "authorized" are ONE answer now: `/cad-land` step 3 branches
// on it (through `git-publish.mjs authorized`) and land-cleanup.mjs `gate` halts
// on it, so the ask that gets skipped is exactly the ask the halt covers.
//
// Each half stays a RAW `JSON.parse` of its own file rather than a
// `mergeLayers(...)` read. `config.mjs get` cannot answer per-layer at all, the
// census in self-verify.test.mjs pins the merge's callsites, and the merge
// SKIPS a torn layer, where this read must WITHHOLD: a file that does not parse
// cannot prove the opt-in it may carry, and failing closed is the only safe
// direction for an answer that unlocks a push. So every throw - missing file,
// unreadable file, truncated JSON - and every shape that is not an explicit
// `true` reads as no opt-in. A file that EXISTS but cannot be read, parsed or
// is not an object is still told apart as `unreadable`, so the refusal can name
// it as broken rather than as the missing half.
//
// One file is one layer. When CADENCE_GLOBAL_CONFIG names the repository's own
// config file (by `layerIdentity`, which sees through symlinks and relative
// spellings), there is ONE layer, so at most one opt-in and no authorization.
// That mirrors `mergeLayers`' own rule, and a cloned repository cannot set the
// environment variable that would make its own file count twice.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL_CONFIG, isPlainObject, layerIdentity } from './config-merge.mjs';

/** @typedef {'set' | 'unset' | 'unreadable'} LayerOptIn */

/**
 * One layer's answer. `unset` for a missing file (and for the `''` path
 * GLOBAL_CONFIG holds where homedir() throws); `unreadable` for a file that
 * exists but would not read, parse, or is not a JSON object; `set` only for an
 * explicit `git.auto_close === true`.
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
 * Did BOTH layers opt in to the unattended close of the repository at `dir`?
 *
 * TOTAL: never throws, whatever `dir` is or is not. `authorized` is true ONLY
 * when `repo` and `global` are both `set` and the two are different files.
 *
 * @param {string} dir repo/planning root
 * @returns {{authorized: boolean, repo: LayerOptIn, global: LayerOptIn, repoFile: string, globalFile: string}}
 */
export function autoCloseLayers(dir) {
  let repoFile = '';
  try { repoFile = join(dir, '.planning', 'config.json'); } catch { /* non-string dir */ }
  const repo = layerOptIn(repoFile);
  const rid = layerIdentity(repoFile);
  const shared = rid !== null && rid === layerIdentity(GLOBAL_CONFIG);
  const global = shared ? 'unset' : layerOptIn(GLOBAL_CONFIG);
  return { authorized: repo === 'set' && global === 'set', repo, global, repoFile, globalFile: GLOBAL_CONFIG };
}
