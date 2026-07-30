// @ts-check
// risk-surfaces.mjs - the pure half of the computed risk floor (STK-03): given
// the paths a phase's PLAN declares and the `surfaces` block of
// cadence-core/route-table.json, say which declared risk surfaces the phase
// touches and how high that raises the stakes level. The disk half - reading
// the PLAN off `.planning/` - lives in lib/phase-plans.mjs; the two are split on
// trigger and failure mode, exactly as lib/route-cells.mjs is split from
// self-verify.mjs's I/O.
//
// Detection is a FLOOR: `raiseTo` can only move a level LATER in the declared
// order, never earlier. A surface the table declares but this lib cannot read
// (a non-array `patterns`, a pattern that is not a string, a row that is not an
// object) contributes NO match rather than throwing - this runs on whatever a
// user's route-table.json happens to hold, and route.mjs fails open on it.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. The caller owns
// the envelope - route.mjs turns a match into a `reason` entry, config.mjs turns
// `surfaceKeyError`'s string into a `{key, error}` detail entry.
'use strict';

/** @param {any} v */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The lowercase alphanumeric tokens of a declared path. A camelCase or
 * digit-to-upper boundary becomes a separator first (`authService.ts` yields
 * `auth`), then every run of non-alphanumeric characters splits (so `/`, `\`,
 * `.`, `-` and `_` all separate) and empties are dropped: a leading dot in
 * `.env.example` yields `[env, example]`, not an empty first token.
 *
 * Tokens are matched for EQUALITY against a surface's patterns, never as
 * substrings - a substring match would floor every path holding `api` inside
 * `rapid`, and a floor that fires on noise trains the user to waive it.
 * @param {any} path
 * @returns {string[]}
 */
export function pathTokens(path) {
  if (typeof path !== 'string' || !path) return [];
  return path
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * @typedef {object} SurfaceMatch
 * @property {string} surface the surface name the row is keyed by
 * @property {any} floor the row's declared floor, verbatim (the caller checks it
 *   against its own level vocabulary; this lib has no opinion about the names)
 * @property {string} path the declared path that matched
 * @property {string} pattern the pattern it matched on
 */

/**
 * The risk surfaces a declared file list touches: at most ONE entry per surface
 * - the first (path, pattern) pair that matches, walking the files in the order
 * given and each surface's patterns in declaration order - so the result is
 * deterministic and a surface cannot report twice for one phase.
 *
 * Surfaces are walked in the table's declaration order, so `reason` entries come
 * out in a stable order across runs whatever the file list looks like.
 * @param {any} files the phase's declared paths, trusted for nothing
 * @param {any} surfaces the `surfaces` block of route-table.json
 * @returns {SurfaceMatch[]}
 */
export function matchSurfaces(files, surfaces) {
  /** @type {SurfaceMatch[]} */
  const out = [];
  if (!isObj(surfaces)) return out;
  const paths = Array.isArray(files) ? files.filter((f) => typeof f === 'string' && f) : [];
  if (!paths.length) return out;
  /** @type {Map<string, string[]>} */
  const tokensOf = new Map();
  for (const p of paths) if (!tokensOf.has(p)) tokensOf.set(p, pathTokens(p));

  for (const [surface, row] of Object.entries(surfaces)) {
    if (!isObj(row)) continue;
    const patterns = Array.isArray(row.patterns) ? row.patterns : [];
    if (!patterns.length) continue;
    let hit = null;
    for (const path of paths) {
      const tokens = tokensOf.get(path) || [];
      if (!tokens.length) continue;
      for (const pattern of patterns) {
        if (typeof pattern !== 'string' || !pattern) continue;
        if (tokens.includes(pattern)) { hit = { surface, floor: row.floor, path, pattern }; break; }
      }
      if (hit) break;
    }
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * Whichever of `baseline` and `floor` sits LATER in `order` - the floor's whole
 * comparison. A value absent from `order` (an unknown level, a non-string, a
 * missing floor) returns `baseline` UNCHANGED: `indexOf` answers -1 for it, and
 * treating -1 as a position would let an unknown floor lower the level, which is
 * the exact inversion this phase exists to prevent.
 * @param {any} baseline the configured stakes level
 * @param {any} floor the detected floor
 * @param {any} order the declared stakes order, lowest first
 * @returns {any} the effective level
 */
export function raiseTo(baseline, floor, order) {
  const levels = Array.isArray(order) ? order : [];
  const bi = levels.indexOf(baseline);
  const fi = levels.indexOf(floor);
  if (bi < 0 || fi < 0) return baseline;
  return fi > bi ? floor : baseline;
}

/** The config-key prefix every per-surface waiver is written under. */
export const OVERRIDE_PREFIX = 'risk.override.';

/**
 * The surface names a schema key list declares under `risk.override.`, sorted -
 * the accepted vocabulary both the write face and self-verify check against.
 * Derived from the schema rather than from route-table.json on purpose: the two
 * are separate files, and self-verify's job is to prove they agree.
 * @param {any} schemaKeys
 * @returns {string[]}
 */
export function surfacesFromKeys(schemaKeys) {
  const keys = Array.isArray(schemaKeys) ? schemaKeys : [];
  const names = new Set();
  for (const k of keys) {
    if (typeof k !== 'string' || !k.startsWith(OVERRIDE_PREFIX)) continue;
    const name = k.slice(OVERRIDE_PREFIX.length).split('.')[0];
    if (name) names.add(name);
  }
  return [...names].sort();
}

/**
 * The write-face error string for a key under `risk.override.` that the schema
 * does not hold, or null for every other key (including a real waiver key, and
 * including anything outside the prefix - those belong to the generic
 * `unknown key` arm). Names every accepted surface, so the remediation needs no
 * second lookup - the shape lib/retired-keys.mjs set.
 * @param {any} key
 * @param {any} schemaKeys
 * @returns {string|null}
 */
export function surfaceKeyError(key, schemaKeys) {
  if (typeof key !== 'string' || !key.startsWith(OVERRIDE_PREFIX)) return null;
  const keys = Array.isArray(schemaKeys) ? schemaKeys : [];
  if (keys.includes(key)) return null;
  const name = key.slice(OVERRIDE_PREFIX.length);
  const accepted = surfacesFromKeys(keys);
  return `"${name}" is not a risk surface; accepted surfaces are ${accepted.join(', ')}`;
}
