// @ts-check
// workflow-layers.mjs - the one read of the three workflow switches: may this run take the workflow path.
// A switch counts only when the repo config and the user-global config both set it to an explicit `true`.
// A committed repo value arrives with a clone, so alone it must never turn on the costlier path.
// The read is bothLayers': raw per layer, not mergeLayers, since the merge skips a torn layer where this answer has to fail.
// Missing file is unset; unreadable, non-object, or anything but boolean `true` is off. Never throws.
// If CADENCE_GLOBAL_CONFIG names the repo's own config, that's one layer, not two; `shared` says so.
'use strict';

import { bothLayers } from './config-merge.mjs';

/** The three keys, by name so no caller spells them. */
export const WORKFLOW_KEYS = Object.freeze({ use: 'workflow.use_workflows', multi: 'workflow.multi_workflow', execute: 'workflow.execute_workflows' });

/** @typedef {import('./config-merge.mjs').LayerState} LayerState */

/**
 * Do both layers set each workflow switch? Total: never throws, whatever `dir` is.
 * `on` is true only when `repo` and `global` are both `set` and are different files.
 * @param {string} dir repo/planning root
 * @returns {{shared: boolean, repoFile: string, globalFile: string, keys: Record<string, {on: boolean, repo: LayerState, global: LayerState}>}}
 */
export function workflowLayers(dir) {
  return bothLayers(dir, Object.values(WORKFLOW_KEYS));
}
