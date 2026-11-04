// @ts-check
// config-merge.mjs - the one implementation of Cadence's config layering, repo > global > defaults. route.mjs (read) and config.mjs (get) both import from here so the merge semantics can't drift
'use strict';

import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';
import { stripGlobalOnly } from './global-only-keys.mjs';
import { isPlainObject } from './text-util.mjs';
export { isPlainObject };

// user-global config layer. CADENCE_GLOBAL_CONFIG is a documented, user-facing relocation, honoured in production and deliberately not gated behind CADENCE_TEST_SEAM (lib/test-seam.mjs says why); the tests also use it to stay hermetic. Otherwise ~/.claude/cadence/config.json
// homedir() throws where the uid has no passwd entry and HOME is unset, the ordinary docker run -u 12345 / OpenShift arbitrary-UID case. This runs at module load, so an unguarded throw kills every importer before it can emit its structured {ok:false} line. An unresolvable home just means no global layer: '' fails readLayer open as ENOENT, the silent absent path
function defaultGlobalConfig() {
  try { return join(homedir(), '.claude', 'cadence', 'config.json'); }
  catch { return ''; }
}
export const GLOBAL_CONFIG = process.env.CADENCE_GLOBAL_CONFIG || defaultGlobalConfig();

/**
 * Parse a JSON file, telling a legitimately absent layer (silent) from one that exists but fails to parse (surfaced via `warning`, so a corrupt layer is diagnosable and not quietly identical to absence). Never fatal: `value` is null either way, so a bad layer contributes nothing to the merge. `present` is true only when the file was read and parsed, whatever the parsed value (`null`, `0`, `false`, `""` included), so callers can gate a "not an object" warning on presence and not truthiness without double-warning a parse failure.
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
 * Deep-merge `over` onto `base`: nested objects recurse, arrays and scalars replace wholesale (the higher-precedence layer's list wins, no concat).
 *
 * The accumulation defines an own property and never assigns `merged[k] = ...`, and that's load-bearing. `JSON.parse` makes `__proto__` an ordinary own key, but assigning at that key runs Object.prototype's `__proto__` setter, which reparents `merged` and stores nothing, so a repo layer arriving with a clone could hand the merged config a prototype carrying whatever it liked and every `config.git?.on_protected` read in the spine would inherit it. Defining the property stores the key, and an attacker's `__proto__` lands as an inert own key nothing reads. It fires two ways, under opposite global-layer states, and both close here: top-level `{"__proto__":{"git":...}}` when no global layer defines `git`, and `{"git":{"__proto__":...}}` one level down when one does.
 *
 * `{ ...base }` needs nothing, since spread copies own enumerable properties as data properties. The result keeps its ordinary `Object.prototype`, never `Object.create(null)`, which is what every caller and every `assert.deepEqual` in the suite expects.
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
 * Filesystem identity of a layer path: the realpath, else the realpath'd parent joined with the basename (the file may not exist, an absent layer is ordinary), else a plain absolute resolve. That lets the comparison below see through a symlink, a relative spelling, a `.`/`..` segment and a trailing slash, which comparing two rendered strings can't.
 *
 * Exported for config.mjs's write face, which asks the identical "is this one file wearing both layer names" question before refusing a repo-layer-only key at the user-global layer. A second copy is how the write face and the merge come to disagree about which file they're looking at.
 *
 * Total, and never-matching for a non-string or empty path: GLOBAL_CONFIG is deliberately '' where homedir() throws, and '' must never match a real target. `null` equals nothing, including another `null`.
 * @param {any} p
 * @returns {string|null}
 */
export function layerIdentity(p) {
  if (typeof p !== 'string' || p === '') return null;
  try { return realpathSync(p); } catch { /* absent - fall through */ }
  try { return join(realpathSync(dirname(p)), basename(p)); } catch { /* dir absent too */ }
  try { return resolvePath(p); } catch { return null; }
}

// the testing policy: testing.scope set to one of these three means a policy was accepted; null, absent or anything else a hand edit left does not. One predicate, read by mergeLayers (the invalid-scope warning) and readTestingPolicy so they can't disagree. Hand-maintained and not read off config.schema.json, since this file runs inside git-guard.mjs's PreToolUse hook, where a schema read or a spawn doesn't belong
export const ACCEPTED_TEST_SCOPES = Object.freeze(['focused', 'integrated', 'thorough']);
/** @param {any} v */
export const isAcceptedTestScope = (v) => typeof v === 'string' && ACCEPTED_TEST_SCOPES.includes(v);

/**
 * Merge the global and repo layers (repo wins). Returns {config, source, warnings}: source names the layers that applied ("global+repo", "defaults"...) and warnings names any layer that failed to parse (distinct from being legitimately absent) or whose top level parsed to something other than a JSON object, so a falsy parse (`null`, `0`, `false`, `""`) warns like a truthy scalar. A scalar or array config is skipped, not merged in as if it were the whole config (#45.3). `config` and `source` are byte-identical to the absent case for a malformed or non-object layer; only `warnings` differs, and it's empty when nothing failed. Defaults are the caller's concern (route has DEFAULTS, config.mjs get builds them from the schema).
 *
 * `layers` is additive and carries the two validated per-layer objects (either null when that layer was absent, unparseable or not an object), because the merge loses provenance and a key whose schema `src` is `repo` has to know which file carried it. Without it a `risk.override.<surface>` written once in the user-global file waived a risk floor in every repository on the machine.
 *
 * One file can resolve as both layer paths (CADENCE_GLOBAL_CONFIG pointed at the repo config, `--global`, a symlink, a relative spelling). It's one layer, so it's read once and collapses to the repo slot: `layers.repo` holds it and `layers.global` stays null. Collapsing toward repo preserves today's behaviour (a waiver in such a file is honoured through `layers.repo`, and resolving the other way would silently revoke it). The merged value never moves (`deepMerge(x, x)` is a no-op); what changes is provenance and warnings, where the damage was: one broken file diagnosed twice, and a `source` naming a repo layer the user doesn't have.
 *
 * `asGlobal` is how a caller says it addressed the user-global layer itself (config.mjs's `--global` arm, which hands GLOBAL_CONFIG in as the file to read). On a collapse the two paths are one file and nothing on disk says which layer the caller meant, and guessing from the spelling would re-import the string compare this function just removed. It changes the `source` label and exempts the read from the global-only strip below, since stripping the user's own settings there would drop them and warn about them.
 *
 * `scopeWarnings` is a field of its own and never an entry on `warnings[]`: a diagnostic about a key that was cleanly ignored isn't a torn layer, and mixing the two on one channel is what made every warning class a land-stopper. It's empty (not absent) when nothing was set, so a caller can spread it unconditionally.
 *
 * `tornLayers` is additive and names the layer files whose content couldn't be used as a config layer at all (the two parse failures and the two not-an-object skips, the only four places `warnings` is built here). `warnings[]` is a message channel and the one seam that mutates needs a class: git-publish.mjs used to refuse on any non-empty `warnings[]`, so a new global-only-key diagnostic had to be routed onto `scopeWarnings` to avoid stopping a land, and the next one added here would have stopped one again. With the class on its own field the refusal asks "did a layer that could have carried protected_branches fail to parse", and every other field is byte-identical. It's empty rather than absent, like `scopeWarnings`.
 *
 * The `testing` section is honoured from the repo layer alone: `repo_only` in the schema refuses the write at the user-global layer, but a hand-edited global file never went through that write face, so the whole section is removed from the global object the merge consumes, by the literal section name with no schema read (this runs in the PreToolUse hook), and a non-null one is named on `scopeWarnings`. `layers.global` keeps the file's own content, and a collapsed read has no global layer, so the user's own file reads as written there.
 * @param {string} repoFile
 * @param {{asGlobal?: boolean}} [opts]
 */
export function mergeLayers(repoFile, opts = {}) {
  // identity before either read and not a compare of two rendered strings after: a symlink and an absolute-vs-relative spelling of one file render differently and were read and diagnosed twice
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
  // the label for a collapsed file can't come from the filesystem, since both paths are that file, so it comes from what the caller says it addressed. A --global read has no repo layer to name; every other caller asked for a repo config that the user's global env happens to alias
  const sharedSource = opts && opts.asGlobal ? 'global' : 'repo';
  // the three keys a tracked file must not be able to choose, removed from the object the merge consumes; layers.repo keeps the file's own parsed content
  const scoped = opts && opts.asGlobal
    ? { layer: repoValue, warnings: [] }
    : stripGlobalOnly(repoValue, repoFile);
  const scopeWarnings = [...scoped.warnings];
  // the global object the merge consumes, without a testing section; layers.global is untouched
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
    // kept alongside the collapse above: two genuinely different layers that are both broken still get one entry each, and a caller pushing its own strings in (route.mjs) never doubles a diagnostic
    warnings: [...new Set(warnings)],
    scopeWarnings,
    // de-duplicated for the same reason: one collapsed file that resolves as both layer paths is one torn layer, not two
    tornLayers: [...new Set(tornLayers)],
  };
}

/**
 * The one read of the testing policy keys: for a config file, the merged `testing` section, the two forge keys the policy checks address, whether the accepted-scope predicate above holds, a scope outside it, and the merge's `warnings` and `tornLayers`. The `test-policy` seam reads through here so there's a single answer to "was a policy accepted". It lives in this file and not a new one so self-verify's merge census keeps its count.
 *
 * `testing` is the merged object with no schema defaults applied (this file reads no schema): a key nobody set is absent from it. `accepted` reads the repo layer's own scope.
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
