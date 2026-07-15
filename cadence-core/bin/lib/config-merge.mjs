// @ts-check
// config-merge.mjs - the ONE implementation of Cadence's config layering:
// repo > global > defaults. route.mjs (read side) and config.mjs (get) both
// import from here so the merge semantics can never drift between them.
'use strict';

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// User-global config layer. CADENCE_GLOBAL_CONFIG relocates it (and keeps
// tests hermetic); otherwise ~/.claude/cadence/config.json.
export const GLOBAL_CONFIG = process.env.CADENCE_GLOBAL_CONFIG ||
  join(homedir(), '.claude', 'cadence', 'config.json');

/**
 * Parse a JSON file, or null if missing/unreadable/invalid - a bad layer is
 * skipped, never fatal (the spine must not block on config).
 * @param {string} file
 */
export function readJSON(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return null; }
}

/**
 * Deep-merge `over` onto `base`: nested objects recurse, arrays and scalars
 * replace wholesale (the higher-precedence layer's list wins, no concat).
 * @param {any} base @param {any} over
 */
export function deepMerge(base, over) {
  if (over === undefined) return base;
  if (base === null || typeof base !== 'object' || Array.isArray(base) ||
      over === null || typeof over !== 'object' || Array.isArray(over)) return over;
  const merged = { ...base };
  for (const [k, v] of Object.entries(over)) merged[k] = deepMerge(base[k], v);
  return merged;
}

/**
 * Merge the global and repo layers (repo wins). Returns {config, source}
 * where source names the layers that applied ("global+repo", "defaults"...).
 * Defaults are the caller's concern (route has DEFAULTS, config.mjs get
 * builds them from the schema) - this merges only the two file layers.
 * @param {string} repoFile
 */
export function mergeLayers(repoFile) {
  const global = readJSON(GLOBAL_CONFIG);
  const repo = readJSON(repoFile);
  const layers = [];
  if (global) layers.push('global');
  if (repo) layers.push('repo');
  return {
    config: deepMerge(global || {}, repo || {}),
    source: layers.length ? layers.join('+') : 'defaults',
  };
}
