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
 * Parse a JSON file, distinguishing a legitimately-absent layer (silent, per
 * D-01) from one that exists but fails to parse (surfaced via `warning`, so a
 * corrupt layer is diagnosable instead of quietly acting identical to
 * absence). Still never fatal - `value` is null either way, so a bad layer
 * contributes nothing to the merge. `present` is true only when the file was
 * read and parsed successfully - whatever the parsed value (`null`, `0`,
 * `false`, `""` included) - so callers can gate a "not an object" warning on
 * presence rather than truthiness without double-warning a parse failure.
 * @param {string} file
 * @returns {{value: any, warning: string|null, present: boolean}}
 */
export function readLayer(file) {
  try {
    return { value: JSON.parse(readFileSync(file, 'utf8')), warning: null, present: true };
  } catch (e) {
    if (e && e.code === 'ENOENT') return { value: null, warning: null, present: false };
    return { value: null, warning: `config layer ${file} failed to parse and was skipped: ${e.message}`, present: false };
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

/** @param {any} v */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Merge the global and repo layers (repo wins). Returns {config, source,
 * warnings} where source names the layers that applied ("global+repo",
 * "defaults"...) and warnings names any layer that failed to PARSE (distinct
 * from being legitimately absent - D-01) or whose top-level parsed to
 * something other than a JSON object - present but not a JSON object, so a
 * falsy parse (`null`, `0`, `false`, `""`) warns exactly like a truthy scalar
 * (a scalar/array config is skipped, not merged in as if it were the whole
 * config - #45.3). `config`/`source` are byte-identical to the absent case
 * for a malformed or non-object layer; only `warnings` differs, and it is
 * empty (not present at all) when nothing failed to parse or was skipped.
 * Defaults are the caller's concern (route has DEFAULTS, config.mjs get
 * builds them from the schema) - this merges only the two file layers.
 * @param {string} repoFile
 */
export function mergeLayers(repoFile) {
  const global = readLayer(GLOBAL_CONFIG);
  const repo = readLayer(repoFile);
  const layers = [];
  const warnings = [global.warning, repo.warning].filter(Boolean);
  let globalValue = global.value;
  let repoValue = repo.value;
  if (global.present && !isPlainObject(globalValue)) {
    warnings.push(`config layer ${GLOBAL_CONFIG} top-level is not an object; skipped`);
    globalValue = null;
  }
  if (repo.present && !isPlainObject(repoValue)) {
    warnings.push(`config layer ${repoFile} top-level is not an object; skipped`);
    repoValue = null;
  }
  if (globalValue) layers.push('global');
  if (repoValue) layers.push('repo');
  return {
    config: deepMerge(globalValue || {}, repoValue || {}),
    source: layers.length ? layers.join('+') : 'defaults',
    // One file can resolve as BOTH layers (CADENCE_GLOBAL_CONFIG pointed at the
    // repo file, or a symlink between them). Merging it onto itself is a no-op,
    // so only the diagnostics doubled - one broken file reported twice. Every
    // warning names its file, so identical strings mean the same layer and
    // collapse; two genuinely broken layers still get one entry each.
    warnings: [...new Set(warnings)],
  };
}
