// @ts-check
// the one implementation of config layering, repo > global > defaults, so route.mjs and config.mjs can't drift
'use strict';

import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';
import { stripGlobalOnly } from './global-only-keys.mjs';
import { isPlainObject } from './text-util.mjs';
export { isPlainObject };

// CADENCE_GLOBAL_CONFIG is a documented relocation, honoured in production and not gated behind CADENCE_TEST_SEAM
// otherwise ~/.claude/cadence/config.json; homedir throws with no passwd entry and no HOME (docker run -u 12345)
// this runs at module load, so '' means "no global layer" and reads as an absent file
function defaultGlobalConfig() {
  try { return join(homedir(), '.claude', 'cadence', 'config.json'); }
  catch { return ''; }
}
export const GLOBAL_CONFIG = process.env.CADENCE_GLOBAL_CONFIG || defaultGlobalConfig();

/**
 * Parse a JSON file, telling an absent layer (silent) from one that fails to parse (a `warning`). Never fatal:
 * `value` is null either way. `present` is true once the file parsed, even to `null` or `0`, so "not an object"
 * warns on presence.
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
 * Deep-merge `over` onto `base`: nested objects recurse, arrays and scalars replace wholesale.
 *
 * It defines each property instead of assigning `merged[k]`, and that's load-bearing: assigning to `__proto__` runs the
 * setter and reparents `merged`, so a repo layer from a clone could plant a prototype that every config read inherits.
 * Defined, it's an inert own key. The result keeps a normal `Object.prototype`, which every caller and
 * deepEqual expects.
 * @param {any} base @param {any} over
 */
export function deepMerge(base, over) {
  if (over === undefined) return base;
  if (base === null || typeof base !== 'object' || Array.isArray(base) ||
      over === null || typeof over !== 'object' || Array.isArray(over)) return over;
  const merged = { ...base };
  for (const [k, v] of Object.entries(over)) {
    Object.defineProperty(merged, k, {
      value: deepMerge(base[k], v), writable: true, enumerable: true, configurable: true,
    });
  }
  return merged;
}

/**
 * Filesystem identity of a layer path: the realpath, else the realpath'd parent plus the basename, else a plain
 * resolve. It sees through symlinks, relative spellings and `..`, which comparing strings can't.
 *
 * Exported so config.mjs's write face asks the same "one file wearing both layer names" question; a second copy
 * would disagree. Never matches a non-string or empty path: GLOBAL_CONFIG is '' where homedir throws, and ''
 * must not match a real target.
 * @param {any} p
 * @returns {string|null}
 */
export function layerIdentity(p) {
  if (typeof p !== 'string' || p === '') return null;
  try { return realpathSync(p); } catch { /* absent - fall through */ }
  try { return join(realpathSync(dirname(p)), basename(p)); } catch { /* dir absent too */ }
  try { return resolvePath(p); } catch { return null; }
}

// a policy was accepted when testing.scope is one of these; one predicate so the merge and readTestingPolicy agree
// hand-maintained, not read off the schema, since git-guard's PreToolUse hook runs this
export const ACCEPTED_TEST_SCOPES = Object.freeze(['focused', 'integrated', 'thorough']);
/** @param {any} v */
export const isAcceptedTestScope = (v) => typeof v === 'string' && ACCEPTED_TEST_SCOPES.includes(v);

/**
 * Merge the global and repo layers (repo wins) into {config, source, warnings}. A layer that fails to parse or isn't
 * an object is skipped and named in `warnings` (#45.3). Defaults are the caller's concern.
 *
 * `layers` keeps each validated layer, since a repo-only key must know which file carried it. One file resolving as
 * both layer paths is read once and collapses to the repo slot; `asGlobal` says which was meant.
 *
 * `scopeWarnings` and `tornLayers` are separate fields, so an ignored key never reads as a torn layer.
 * The `testing` section is stripped from the global object by name.
 * @param {string} repoFile
 * @param {{asGlobal?: boolean}} [opts]
 */
export function mergeLayers(repoFile, opts = {}) {
  // identity before either read: a symlink or relative spelling of one file was read and diagnosed twice
  const gid = layerIdentity(GLOBAL_CONFIG);
  const rid = layerIdentity(repoFile);
  const shared = gid !== null && rid !== null && gid === rid;
  const global = shared ? null : readLayer(GLOBAL_CONFIG);
  const repo = readLayer(repoFile);
  const layers = [];
  const warnings = [global ? global.warning : null, repo.warning].filter(Boolean);
  // the same four places on the class channel: the file behind each warning and never its wording
  const tornLayers = [];
  if (global && global.warning) tornLayers.push(GLOBAL_CONFIG);
  if (repo.warning) tornLayers.push(repoFile);
  let globalValue = global ? global.value : null;
  let repoValue = repo.value;
  if (global && global.present && !isPlainObject(globalValue)) {
    warnings.push(`config layer ${GLOBAL_CONFIG} top-level is not an object; skipped`);
    tornLayers.push(GLOBAL_CONFIG);
    globalValue = null;
  }
  if (repo.present && !isPlainObject(repoValue)) {
    warnings.push(`config layer ${repoFile} top-level is not an object; skipped`);
    tornLayers.push(repoFile);
    repoValue = null;
  }
  if (globalValue) layers.push('global');
  if (repoValue) layers.push('repo');
  // both paths are one file, so the label follows what the caller addressed, not the filesystem
  const sharedSource = opts && opts.asGlobal ? 'global' : 'repo';
  // the keys a tracked file must not choose are removed from the merge; layers.repo keeps the parsed content
  const scoped = opts && opts.asGlobal
    ? { layer: repoValue, warnings: [] }
    : stripGlobalOnly(repoValue, repoFile);
  const scopeWarnings = [...scoped.warnings];
  // the global object the merge consumes has no testing section; layers.global is untouched
  let globalForMerge = globalValue;
  if (global && globalValue && Object.hasOwn(globalValue, 'testing')) {
    const { testing, ...rest } = globalValue;
    globalForMerge = rest;
    if (testing !== null) {
      scopeWarnings.push(`config section "testing" in ${GLOBAL_CONFIG} was ignored: it is honoured `
        + 'from the repository config layer only, so a user-global value cannot lower or accept a '
        + "testing policy for a repository that never chose one");
    }
  }
  let config = deepMerge(globalForMerge || {}, scoped.layer || {});
  const asGlobal = !!(opts && opts.asGlobal);
  if (!asGlobal && repoValue && isPlainObject(repoValue.testing) && repoValue.testing.scope != null
      && !isAcceptedTestScope(repoValue.testing.scope)) {
    scopeWarnings.push(`config key "testing.scope" is ${JSON.stringify(repoValue.testing.scope)} in ${repoFile}, `
      + 'which is not focused, integrated or thorough, so no testing policy is accepted');
  }
  return {
    config,
    source: layers.length ? (shared ? sharedSource : layers.join('+')) : 'defaults',
    layers: { global: globalValue || null, repo: repoValue || null },
    // two different broken layers still get one entry each, and a caller pushing its own strings never doubles one
    warnings: [...new Set(warnings)],
    scopeWarnings,
    // de-duplicated for the same reason: a file that resolves as both layer paths is one torn layer, not two
    tornLayers: [...new Set(tornLayers)],
  };
}

/**
 * The one read of the testing policy keys: the merged `testing` section, the two forge keys the policy checks
 * address, whether the accepted-scope predicate holds, a scope outside it, and the merge's `warnings` and
 * `tornLayers`. It's here, not a new file, so self-verify's merge census keeps its count.
 *
 * `testing` has no schema defaults applied (this file reads no schema): a key nobody set is absent. `accepted`
 * reads the repo layer's scope.
 * @param {string} file
 */
export function readTestingPolicy(file) {
  const { config, layers, warnings, tornLayers } = mergeLayers(file);
  const repoTesting = layers.repo && layers.repo.testing;
  const scope = isPlainObject(repoTesting) ? repoTesting.scope : null;
  return {
    testing: isPlainObject(config.testing) ? config.testing : {},
    forgeProvider: isPlainObject(config.git) && config.git.forge_provider !== undefined ? config.git.forge_provider : null,
    forgeRepo: isPlainObject(config.git) && config.git.forge_repo !== undefined ? config.git.forge_repo : null,
    accepted: isAcceptedTestScope(scope),
    invalidScope: scope === null || scope === undefined || isAcceptedTestScope(scope) ? null : scope,
    warnings,
    tornLayers,
  };
}
