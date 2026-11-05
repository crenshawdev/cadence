// @ts-check
// workflow-layers.mjs - the one read of the two workflow switches: may this run take the workflow path.
// A switch counts only when the repo config and the user-global config both set it to an explicit `true`.
// A committed repo value arrives with a clone, so alone it must never turn on the costlier path.
// Raw `JSON.parse` per layer, not mergeLayers: the merge skips a torn layer where this answer has to fail.
// Missing file is unset; unreadable, non-object, or anything but boolean `true` is off. Never throws.
// If CADENCE_GLOBAL_CONFIG names the repo's own config, that's one layer, not two; `shared` says so.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL_CONFIG, isPlainObject, layerIdentity } from './config-merge.mjs';

/** The two keys, by name so no caller spells them. */
export const WORKFLOW_KEYS = Object.freeze({ use: 'workflow.use_workflows', multi: 'workflow.multi_workflow' });

/** @typedef {'set' | 'unset' | 'unreadable'} LayerState */

/**
 * One layer's answer for the given dotted key.
 * @param {string} file
 * @param {string[]} path
 * @returns {LayerState}
 */
function layerState(file, path) {
  if (!file) return 'unset';
  let node;
  try { node = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { return /** @type {any} */ (e)?.code === 'ENOENT' ? 'unset' : 'unreadable'; }
  if (!isPlainObject(node)) return 'unreadable';
  for (const part of path) {
    if (!isPlainObject(node) || !Object.hasOwn(node, part)) return 'unset';
    node = node[part];
  }
  return node === true ? 'set' : 'unset';
}

/**
 * Do both layers set each workflow switch? Total: never throws, whatever `dir` is.
 * `on` is true only when `repo` and `global` are both `set` and are different files.
 * @param {string} dir repo/planning root
 * @returns {{shared: boolean, repoFile: string, globalFile: string, keys: Record<string, {on: boolean, repo: LayerState, global: LayerState}>}}
 */
export function workflowLayers(dir) {
  let repoFile = '';
  try { repoFile = join(dir, '.planning', 'config.json'); } catch { /* non-string dir */ }
  const shared = layerIdentity(repoFile) !== null && layerIdentity(repoFile) === layerIdentity(GLOBAL_CONFIG);
  /** @type {Record<string, {on: boolean, repo: LayerState, global: LayerState}>} */
  const keys = {};
  for (const key of Object.values(WORKFLOW_KEYS)) {
    const path = key.split('.');
    const repo = layerState(repoFile, path);
    const global = shared ? 'unset' : layerState(GLOBAL_CONFIG, path);
    keys[key] = { on: repo === 'set' && global === 'set', repo, global };
  }
  return { shared, repoFile, globalFile: GLOBAL_CONFIG, keys };
}
