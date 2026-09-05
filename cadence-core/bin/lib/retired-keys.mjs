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
// crossWarnings' cross-file read of a routing data table is exactly how a
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
  // `replacement` is deliberately null for both of the next two rows even though
  // something DID take their place: the field renders as `use "<key>" instead`,
  // so it may only ever name a key `config.mjs set` will accept. Nothing
  // one-to-one replaces a level that answered for six roles at once, and
  // `roles.<role>.model` is a placeholder rather than a settable key - naming it
  // there would send a user to a write the seam then refuses as unknown, which
  // is precisely the defect this milestone fixed in `model.profile`'s own entry.
  // The pointer rides `detail`, which both faces render verbatim.
  'stakes': Object.freeze({
    replacement: null,
    since: 'v3.7.12',
    detail: 'the single level that decided every role\'s model and effort is '
      + 'gone - each role now carries its own `roles.<role>.model` and '
      + '`roles.<role>.effort`, and routing reads nothing from this key. Run '
      + '`/cad-config --roles` to be asked what each role should cost and have '
      + 'those keys written, then `config.mjs unset stakes` to drop this one',
  }),
  'model.profile': Object.freeze({
    replacement: null,
    detail: 'the spend profile went with the `auto` mode, and the level that '
      + 'replaced it is retired too - name the model and the reasoning effort '
      + 'per role instead, as `roles.<role>.model` and `roles.<role>.effort`, '
      + 'which `/cad-config --roles` asks for and writes',
  }),
  'model.auto.escalate_on_failure': Object.freeze({
    replacement: 'model.escalate_on_failure',
    detail: 'escalation is no longer gated behind the retired `auto` mode; it is '
      + 'honoured on every dispatch, for every role',
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
  'workflow.subagent_timeout': Object.freeze({
    replacement: null,
    since: 'v2.7.0',
    detail: 'removed because nothing could enforce it - no code read the key, '
      + 'and the host spawn seam takes no timeout and offers no cancel, so a '
      + 'dispatch runs until it returns; size plans with workflow.max_plan_tasks '
      + 'instead, which is the real lever on what one dispatch costs',
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
  'review.triggers.pre_ship.gate': Object.freeze({
    replacement: null,
    since: 'v3.2.0',
    detail: 'the pre-ship trigger was removed - it was a fourth adversarial '
      + 'pass over work risk_surface, diff and plan had already cleared, at the '
      + 'one point where acting on a finding means committing on top of what is '
      + 'being published; /cad-land now fires no review and its unattended '
      + 'close halts on the risk_surface survivors the phase already recorded',
  }),
  'review.triggers.pre_ship.tier': Object.freeze({
    replacement: null,
    since: 'v3.2.0',
    detail: 'removed with the pre-ship trigger - there is no fire left for a '
      + 'model tier to select; set review.triggers.risk_surface.tier for the '
      + 'gate that still runs on this branch\'s work',
  }),
  'review.triggers.pre_ship.effort': Object.freeze({
    replacement: null,
    since: 'v3.2.0',
    detail: 'removed with the pre-ship trigger - there is no fire left for a '
      + 'reasoning effort to reach; set review.triggers.risk_surface.effort for '
      + 'the gate that still runs on this branch\'s work',
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
  // hasOwn, not a bare `RETIRED_KEYS[key]`: this map is a plain frozen object,
  // so a key named `__proto__`, `constructor`, `toString` or any other
  // Object.prototype member resolved to Object.prototype itself - a truthy
  // "spec" whose `since`, `replacement` and `detail` are all undefined. That is
  // how `config.mjs check '__proto__=1'` answered `retired in v2.0.0:
  // undefined`: a WRONG diagnostic rather than a missing one, naming a
  // retirement that never happened and sending the user to look for a
  // replacement that never existed.
  //
  // The guard lives HERE rather than at the caller so every caller inherits it,
  // and it is `hasOwn` rather than a check on the spec's shape: a spec whose
  // `replacement` is null is a legitimate row - 16 of the 17 ship that way - so
  // filtering by value would delete most of the vocabulary. A genuinely retired
  // key is an own property of the frozen literal above, so this changes nothing
  // for it.
  const spec = typeof key === 'string' && Object.hasOwn(RETIRED_KEYS, key)
    ? RETIRED_KEYS[key] : undefined;
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
