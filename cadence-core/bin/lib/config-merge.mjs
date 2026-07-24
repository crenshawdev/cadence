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
 * Read one config layer, discriminating an absent file (ENOENT) from a
 * present-but-unparseable one (SyntaxError / other read failure) - the
 * absent-vs-malformed distinction #39 requires. The fail-safe stays: either
 * outcome yields `config: null` so the caller's merge still skips the layer.
 * @param {string} file
 * @returns {{config: any, failed: boolean}} failed is true only when the file
 *   exists but could not be parsed/read.
 */
export function readLayer(file) {
  try { return { config: JSON.parse(readFileSync(file, 'utf8')), failed: false }; }
  catch (e) {
    if (e && e.code === 'ENOENT') return { config: null, failed: false };
    return { config: null, failed: true };
  }
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
 *
 * A layer that exists but failed to parse contributes nothing to `config`
 * (the fail-safe merge is unchanged) but is no longer silent: a parenthetical
 * note naming it rides through `source`, and one line is written to stderr
 * naming the file - so a broken layer reads differently from an absent one.
 * @param {string} repoFile
 */
export function mergeLayers(repoFile) {
  const global = readLayer(GLOBAL_CONFIG);
  const repo = readLayer(repoFile);
  const layers = [];
  if (global.config) layers.push('global');
  if (repo.config) layers.push('repo');
  const notes = [];
  if (global.failed) {
    notes.push('global config failed to parse');
    process.stderr.write(`cadence: warning: ${GLOBAL_CONFIG} failed to parse; global config layer skipped\n`);
  }
  if (repo.failed) {
    notes.push('repo config failed to parse');
    process.stderr.write(`cadence: warning: ${repoFile} failed to parse; repo config layer skipped\n`);
  }
  const base = layers.length ? layers.join('+') : 'defaults';
  return {
    config: deepMerge(global.config || {}, repo.config || {}),
    source: notes.length ? `${base} (${notes.join(', ')})` : base,
  };
}
