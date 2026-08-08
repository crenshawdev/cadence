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

// A dependency LOCKFILE, by basename, excluded before the token match (D-05).
// `pathTokens` splits on every non-alphanumeric run, so `package-lock.json`
// yields a `lock` token, which equals the concurrency surface's `lock` pattern
// and floored a whole phase to `critical` for a generated file no human wrote.
//
// Removing the `lock` and `locks` patterns was the simpler, data-only edit and
// is rejected: it trades a real detection away to close a false one, so
// `src/lock.rs`, `internal/lock/manager.go` and `db/locks.sql` would stop
// flooring with no test naming the loss. Excluding by basename names the
// lockfile CLASS at the point it is excluded, beside the `pathTokens` that
// produced the token in the first place.
//
// The rule is an ALLOWLIST of package-manager lockfile BASENAMES, and it
// SUPERSEDES D-05's two-shape enumeration (`.lock` plus `-lock.json`), which
// could not reach pnpm (`pnpm-lock.yaml`), NuGet (`packages.lock.json`),
// conda-lock (`conda-lock.yml`), bun (`bun.lockb`) or Go (`go.sum`).
//
// A SHAPE rule was written first and rejected under review. Widening to "a
// basename ending `.lock`/`.lockb`, or `[.-]lock.<manifest extension>`" reaches
// those spellings, but it also releases every lock RESOURCE a human wrote under
// the same spelling - `deploy/redis-lock.yaml`, `k8s/leader-lock.yaml`,
// `terraform/state-lock.toml`, and runtime state such as `db/replica.lock.json`
// - silently removing the concurrency floor from exactly the files the floor
// exists for. The set of package managers is finite and enumerable; the set of
// names that merely LOOK like a lockfile is not. So the allowlist is strictly
// more precise in both directions: it releases exactly the generated files
// nobody wrote, and an unrecognized basename conservatively KEEPS its floor.
//
// MAINTENANCE COST, stated because it is the price of that precision: a new
// package manager needs a line in this list (and a row in
// risk-surfaces.test.mjs, which hand-writes the same list so a deletion here
// fails there). Until it gets one, its lockfile floors a phase to `critical` -
// an unnecessary review, which is the cheap direction of the trade. The
// alternative is a shape rule that silently releases someone's leader-lock
// manifest, which is the expensive one.
//
// Matched EXACTLY, case included: `Cargo.lock`, `Gemfile.lock` and
// `Podfile.lock` are the spellings their own ecosystems generate, so a
// `gemfile.lock` is not a name any of these tools writes and keeps its floor
// like any other unrecognized basename. (The shape rule it replaced was
// case-insensitive; the reversal is deliberate and pinned as a test.)
//
// The exclusion applies to EVERY surface rather than to `concurrency` alone - a
// generated dependency manifest is not the evidence any of the eight is looking
// for, and a rule that held for one surface would still floor on the next
// pattern list that gains a word a package name happens to contain.
const LOCKFILES = new Set([
  // npm / pnpm / yarn / bun / deno
  'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock',
  'bun.lockb', 'bun.lock', 'deno.lock',
  // rust, python, ruby, php, .NET
  'Cargo.lock', 'poetry.lock', 'uv.lock', 'Pipfile.lock', 'pdm.lock',
  'Gemfile.lock', 'composer.lock', 'packages.lock.json',
  // conda, elixir, dart, go, nix, cocoapods, gradle
  'conda-lock.yml', 'conda-lock.yaml', 'mix.lock', 'pubspec.lock', 'go.sum',
  'flake.lock', 'Podfile.lock', 'gradle.lockfile',
]);

/** @param {string} p a declared path, already known to be a non-empty string */
function isLockfile(p) {
  const base = p.split(/[\\/]/).pop() || '';
  return LOCKFILES.has(base);
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
  // Non-strings are filtered here and must stay filtered - the function is
  // TOTAL and runs on whatever a PLAN's frontmatter holds - and the lockfile
  // exclusion sits in the same pass, BEFORE any token is computed.
  const paths = Array.isArray(files)
    ? files.filter((f) => typeof f === 'string' && f && !isLockfile(f))
    : [];
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

/**
 * How a warning names the user-global layer, so the same malformed entry in both
 * layers reads as two findings rather than deduping into one line.
 */
export const GLOBAL_LAYER = ' in the user-global config layer';

/**
 * The `risk.override.<surface>` waivers a LAYER actually wrote, keyed by surface
 * name - defensive at every hop because this runs on whatever a user's config
 * happens to hold, so a scalar where an object belongs contributes nothing
 * rather than throwing. The VALUES are kept verbatim; only a strict `true`
 * waives, and the caller speaks about anything else.
 *
 * Shared by both read faces on purpose: route.mjs and config.mjs disagreeing
 * about which entries a layer even HOLDS would put them back to describing one
 * situation two ways, one traversal below the shape check.
 * @param {any} c a config layer, trusted for nothing
 * @returns {Record<string, any>}
 */
export function riskOverridesIn(c) {
  /** @type {Record<string, any>} */
  const out = {};
  const risk = isObj(c) ? c.risk : null;
  if (!isObj(risk)) return out;
  const overrides = risk.override;
  if (!isObj(overrides)) return out;
  for (const [surface, value] of Object.entries(overrides)) {
    if (value !== undefined) out[surface] = value;
  }
  return out;
}

/**
 * The diagnostic a `risk.override.<surface>` entry earns for its own SHAPE, or
 * null when the entry is well formed - a strict `true`, or the ordinary
 * `false`/`null`. Layer-independent on purpose: a typo'd surface and a
 * non-boolean value are refused identically wherever they were written, which is
 * what stops either read face telling a user to move an entry the write face
 * would refuse and the repo layer would not honour.
 *
 * `declared` is the caller's own surface vocabulary - route.mjs reads it from
 * route-table.json's `surfaces`, config.mjs derives it from the schema keys via
 * `surfacesFromKeys`. They are separate files and self-verify's job is to prove
 * they agree, so this lib takes the list rather than picking a side.
 *
 * The names are SORTED before they are printed. The two sources hold the same
 * set in different orders - the table in declaration order, the schema keys
 * alphabetically - so an unsorted list makes the two faces emit different text
 * for one entry, which is the divergence this function exists to close. Sorted
 * also matches `surfaceKeyError`, so the write face names them the same way.
 * @param {string} surface
 * @param {any} value
 * @param {any} declared the accepted surface names, in any order
 * @param {string} [where] names the layer, or '' for the repo layer
 * @returns {string|null}
 */
export function overrideShapeWarning(surface, value, declared, where = '') {
  const names = Array.isArray(declared) ? declared.filter((s) => typeof s === 'string') : [];
  if (!names.includes(surface)) {
    return `risk.override.${surface}${where} names no declared risk surface `
      + `(${[...names].sort().join(', ')}); it waives nothing`;
  }
  if (value === true || value === false || value === null) return null;
  return `risk.override.${surface}=${JSON.stringify(value)}${where} is not true or `
    + `false; the ${surface} risk floor stands`;
}
