// @ts-check
// config-merge.mjs - the ONE implementation of Cadence's config layering:
// repo > global > defaults. route.mjs (read side) and config.mjs (get) both
// import from here so the merge semantics can never drift between them.
'use strict';

import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';
import { stripGlobalOnly } from './global-only-keys.mjs';

// User-global config layer. CADENCE_GLOBAL_CONFIG relocates it (and keeps
// tests hermetic); otherwise ~/.claude/cadence/config.json.
//
// homedir() THROWS where the uid has no passwd entry and HOME is unset - the
// ordinary `docker run -u 12345` / OpenShift arbitrary-UID case. This runs at
// module load, so an unguarded throw kills every importer before it can emit
// its structured {ok:false} line, with a raw stack and nothing on stdout. An
// unresolvable home just means there is no global layer to read: '' fails the
// readLayer open as ENOENT, which is already the silent legitimately-absent
// path, so the merge degrades to repo + defaults exactly as if the file were
// missing.
function defaultGlobalConfig() {
  try { return join(homedir(), '.claude', 'cadence', 'config.json'); }
  catch { return ''; }
}
export const GLOBAL_CONFIG = process.env.CADENCE_GLOBAL_CONFIG || defaultGlobalConfig();

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
 *
 * The accumulation DEFINES an own property and never assigns `merged[k] = ...`,
 * which is load-bearing rather than stylistic. `JSON.parse` makes `__proto__` an
 * ordinary own key that `Object.entries` yields like any other, but assigning at
 * that key runs `Object.prototype`'s `__proto__` SETTER, which reparents
 * `merged` instead of storing anything on it - so a repo layer arriving with a
 * clone could hand the merged config a prototype carrying whatever it liked, and
 * every `config.git?.on_protected` read in the spine would inherit it. Defining
 * the property stores the key, and a `__proto__` an attacker wrote lands as an
 * inert own key nothing reads. Two live shapes fire this, under OPPOSITE
 * global-layer states, and both close here: top-level `{"__proto__":{"git":...}}`
 * when no global layer defines `git` (through `mergeLayers`'s
 * `deepMerge(globalValue || {}, repoValue || {})`), and `{"git":{"__proto__":...}}`
 * one level down when one does.
 *
 * `{ ...base }` needs nothing: spread copies own enumerable properties as data
 * properties, so a `__proto__` on the base side is already carried as a key. And
 * the result keeps its ordinary `Object.prototype` - never `Object.create(null)`,
 * which is what every caller and every `assert.deepEqual` in the suite expects
 * (lib/trace.mjs:534-541 states the same reasoning for the same hazard).
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

/** @param {any} v */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Filesystem identity of a layer path: the realpath, else the realpath'd parent
 * joined with the basename (the file may not exist - an absent layer is
 * ordinary here), else a plain absolute resolve. That is what lets the
 * comparison below see through a symlink, a relative spelling, a `.`/`..`
 * segment and a trailing slash alike, rather than comparing two rendered
 * strings.
 *
 * EXPORTED for config.mjs's write face, which asks the identical "is this one
 * file wearing both layer names" question before it refuses a repo-layer-only
 * key at the user-global layer. That copy existed here once as `fsIdentity`
 * inside config.mjs and was deleted with the risk floor (8063832d); a second
 * copy is how the write face and the merge come to disagree about which file
 * they are looking at.
 *
 * TOTAL, and never-matching for a non-string or EMPTY path: GLOBAL_CONFIG is
 * deliberately '' where homedir() throws, and '' must never match a real target
 * (the same guard config.mjs states at its own identity check). `null` is equal
 * to nothing here, including another `null`.
 * @param {any} p
 * @returns {string|null}
 */
export function layerIdentity(p) {
  if (typeof p !== 'string' || p === '') return null;
  try { return realpathSync(p); } catch { /* absent - fall through */ }
  try { return join(realpathSync(dirname(p)), basename(p)); } catch { /* dir absent too */ }
  try { return resolvePath(p); } catch { return null; }
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
 *
 * `layers` is ADDITIVE and carries the two validated per-layer objects (either
 * one null when that layer was absent, unparseable, or not a JSON object), for
 * one reason: the merge LOSES provenance, and a key whose schema `src` is
 * `repo` has to know which file carried it. Without it a caller can only read
 * the merged value, which is how a `risk.override.<surface>` written once in
 * the user-global file waived a risk floor in every repository on the machine.
 * `config`, `source` and `warnings` are unchanged - every existing caller
 * destructures named fields, and their values here are byte-identical.
 *
 * One file can resolve as BOTH layer paths (CADENCE_GLOBAL_CONFIG pointed at
 * the repo config, `--global`, a symlink, a relative spelling). It is ONE
 * layer, so it is read once and collapses to the REPO slot: `layers.repo` holds
 * it and `layers.global` stays null. Collapsing toward repo, never global, is
 * what preserves today's behaviour - a waiver in such a file IS honoured
 * through `layers.repo`, and resolving the other way would silently revoke it.
 * The merged VALUE never moves either way (`deepMerge(x, x)` is a no-op); what
 * changes is provenance and warnings, which is where the damage was: one broken
 * file diagnosed twice, and a `source` naming a repo layer the user does not
 * have.
 *
 * `asGlobal` is how a caller says it addressed the USER-GLOBAL layer itself
 * (config.mjs's `--global` arm, which hands GLOBAL_CONFIG in as the file to
 * read). On a collapse the two paths ARE one file, so nothing on disk can say
 * which layer the caller meant, and guessing from the spelling would re-import
 * the string compare this function just removed - so the caller states it. It
 * changes the `source` LABEL, and it exempts the read from the global-only
 * strip below: that arm IS the user-global layer, collapsed into the repo slot,
 * so stripping there would drop the user's own settings and warn about them.
 *
 * `scopeWarnings` is a field of its OWN, never an entry on `warnings[]` (D-05):
 * a diagnostic about a key that was cleanly ignored is not a torn layer, and
 * mixing the two on one channel is what made every warning class a land-stopper.
 * It is empty (not absent) when nothing was set, so a caller can spread it
 * unconditionally.
 *
 * `tornLayers` is ADDITIVE and names the layer FILES whose content could not be
 * used as a config layer at all - the two parse failures and the two
 * not-an-object skips, which are the only four places `warnings` is built here.
 * It exists because `warnings[]` is a MESSAGE channel and the one seam that
 * mutates needs a CLASS: `git-publish.mjs` used to refuse a publish or a reap on
 * any non-empty `warnings[]`, so phase 1 had to route its global-only-key
 * diagnostic onto `scopeWarnings` to avoid stopping a land, and the next
 * diagnostic added here would have stopped one again (D-18). With the class on
 * its own field the refusal asks the question it means - "did a layer that could
 * have carried protected_branches fail to parse" - and every other caller is
 * untouched: `config`, `source`, `layers`, `warnings` and `scopeWarnings` are
 * byte-identical, and it is empty rather than absent for the same reason
 * `scopeWarnings` is.
 * @param {string} repoFile
 * @param {{asGlobal?: boolean}} [opts]
 */
export function mergeLayers(repoFile, opts = {}) {
  // Identity BEFORE either read, not a compare of two rendered strings after:
  // a symlink and an absolute-vs-relative spelling of one file render
  // differently and were read - and diagnosed - twice.
  const gid = layerIdentity(GLOBAL_CONFIG);
  const rid = layerIdentity(repoFile);
  const shared = gid !== null && rid !== null && gid === rid;
  const global = shared ? null : readLayer(GLOBAL_CONFIG);
  const repo = readLayer(repoFile);
  const layers = [];
  const warnings = [global ? global.warning : null, repo.warning].filter(Boolean);
  // The same four places, on the CLASS channel: the file behind each warning,
  // never its wording (see `tornLayers` in the header).
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
  // The label for a collapsed file cannot come from the filesystem - both paths
  // ARE that file - so it comes from what the caller says it addressed. A
  // `--global` read has no repo layer to name; every other caller asked for a
  // repo config that the user's global env happens to alias.
  const sharedSource = opts && opts.asGlobal ? 'global' : 'repo';
  // The three keys a tracked file must not be able to choose (CFG-02), removed
  // from the object the MERGE consumes - `layers.repo` keeps the file's own
  // parsed content, and `config`, `source` and `warnings` keep their values for
  // every existing caller.
  const scoped = opts && opts.asGlobal
    ? { layer: repoValue, warnings: [] }
    : stripGlobalOnly(repoValue, repoFile);
  return {
    config: deepMerge(globalValue || {}, scoped.layer || {}),
    source: layers.length ? (shared ? sharedSource : layers.join('+')) : 'defaults',
    layers: { global: globalValue || null, repo: repoValue || null },
    // Kept alongside the collapse above: two genuinely different layers that
    // are both broken still get one entry each, and a caller pushing its own
    // strings in (route.mjs) never doubles a diagnostic.
    warnings: [...new Set(warnings)],
    scopeWarnings: scoped.warnings,
    // De-duplicated for the same reason `warnings` is: one collapsed file that
    // resolves as both layer paths is ONE torn layer, not two.
    tornLayers: [...new Set(tornLayers)],
  };
}
