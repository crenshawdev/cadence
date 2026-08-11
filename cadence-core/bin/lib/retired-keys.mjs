// @ts-check
// retired-keys.mjs - the ONE statement of which config keys v2.0.0 retired and
// what replaced them, imported by config.mjs (the write face, `checkPairs`, and
// the read face, `get`) and by route.mjs (the other read face). Spelling it in
// each face separately is the drift class this repo keeps closing: a key
// refused at `set` with one message and silently ignored at `resolve` is the
// same defect as no diagnostic at all.
//
// A retired key is precisely one the schema NO LONGER holds, so this map cannot
// be derived from config.schema.json - a schema-derived list would name nothing.
// It is a hand-maintained record of a rename, and it reads nothing off disk:
// crossWarnings' route-table.json read across a file boundary is exactly how a
// cross-key check came to fire unconditionally (D-12).
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns
// strings; the callers own the envelope - config.mjs turns the write-face
// string into a `{key, error}` detail entry, and both read faces push the
// `retiredKeysIn` strings onto the `warnings` array they already carry.
'use strict';

/**
 * @typedef {object} RetiredKey
 * @property {string|null} replacement the key that took its place, or null when
 *   the key was removed outright with nothing standing in for it
 * @property {string} detail one clause a user can act on without a lookup
 * @property {string} [since] the version that retired it, default 'v2.0.0' -
 *   the map spans more than one milestone now, and a message naming the wrong
 *   one sends a user at the wrong changelog entry
 */

/**
 * Every retired config key, keyed by the exact dotted token a user writes at
 * the CLI - `checkPairs` looks a key up by that token, so the spelling here IS
 * the matched string. `since` names the milestone that retired each one.
 * @type {Readonly<Record<string, RetiredKey>>}
 */
export const RETIRED_KEYS = Object.freeze({
  'model.profile': Object.freeze({
    replacement: 'stakes',
    detail: 'the routing axis now asks what a break costs, not what a dispatch '
      + 'costs: solo, shipped, critical',
  }),
  'model.auto.escalate_on_failure': Object.freeze({
    replacement: 'model.escalate_on_failure',
    detail: 'escalation is no longer gated behind the retired `auto` mode; it is '
      + 'honoured at every stakes level',
  }),
  'model.auto.ceiling': Object.freeze({
    replacement: null,
    detail: 'removed with the `auto` mode - escalation no longer steps a spend '
      + 'ladder, so there is no ceiling for it to stop at',
  }),
  'model.auto.max_escalations': Object.freeze({
    replacement: null,
    detail: 'removed with the `auto` mode - a role escalates to exactly one rung, '
      + "the retry rung its own routing cell names, so there is no second step to cap",
  }),
  'risk.override.auth': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
  'risk.override.migrations': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
  'risk.override.billing': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
  'risk.override.concurrency': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
  'risk.override.destructive': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
  'risk.override.secrets': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
  'risk.override.api_contract': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
  'risk.override.untrusted_input': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed with the dispatch-time risk floor - stakes is no longer '
      + 'raised by a path token, so there is no floor for a waiver to lower; '
      + 'the commit-time risk_surface review still judges the actual diff',
  }),
});

/**
 * The write-face error string for a retired key, or null when the key is not
 * retired. Phrased to name its own fix, matching config.mjs's existing
 * `cannot set through "..."` precedent: the remediation needs no second lookup.
 * @param {string} key
 * @returns {string|null}
 */
export function retiredKeyError(key) {
  const spec = typeof key === 'string' ? RETIRED_KEYS[key] : undefined;
  if (!spec) return null;
  const since = spec.since || 'v2.0.0';
  return spec.replacement
    ? `retired in ${since}: use "${spec.replacement}" instead (${spec.detail})`
    : `retired in ${since}: ${spec.detail}`;
}

/**
 * Walk a dotted path through a MERGED config object and report whether the
 * final segment is actually present. Value-agnostic: the key's PRESENCE is the
 * fault (D-09), so a null or false value still counts. Defensive at every
 * segment - a scalar, array or null where an object was expected yields no
 * match rather than a throw, because this runs on whatever a user's config
 * happens to hold.
 * @param {any} config
 * @param {string} dotted
 * @returns {boolean}
 */
function hasPath(config, dotted) {
  const parts = dotted.split('.');
  let node = config;
  for (let i = 0; i < parts.length; i++) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return false;
    if (!Object.prototype.hasOwnProperty.call(node, parts[i])) return false;
    node = node[parts[i]];
  }
  return true;
}

/**
 * One warning string per retired key actually present in a merged config, in
 * RETIRED_KEYS declaration order. A config holding none - the ordinary case -
 * yields an empty array, so a caller can spread it onto its `warnings` list
 * unconditionally.
 * @param {any} config a MERGED config object (never a file path)
 * @returns {string[]}
 */
export function retiredKeysIn(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return [];
  const out = [];
  for (const [key, spec] of Object.entries(RETIRED_KEYS)) {
    if (!hasPath(config, key)) continue;
    const since = spec.since || 'v2.0.0';
    out.push(spec.replacement
      ? `config key "${key}" was retired in ${since} and is ignored: use "${spec.replacement}" instead (${spec.detail})`
      : `config key "${key}" was retired in ${since} and is ignored: ${spec.detail}`);
  }
  return out;
}
