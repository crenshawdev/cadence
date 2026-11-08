// @ts-check
// config-layers.mjs - the one rule for "what is this setting doing, and who set it": per key, each layer's cell,
// the value in force and the winner, plus the counts the /cad-config opening screen prints.
// It reads the merge's own `config` for the value in force and never re-derives it from the raw layers, which
// keep values the merge dropped. config-merge.mjs reads no schema (git-guard runs it), so the layering rules
// for the menu live here instead.
// Pure: no fs, no emit, no process, no Date, no randomness.
'use strict';

import { isDeepStrictEqual } from 'node:util';
import { checkGrammar } from './config-value.mjs';
import { RETIRED_KEYS, retiredKeysIn } from './retired-keys.mjs';
import { appliesAnswer } from './setting-conditions.mjs';
import { isPlainObject } from './text-util.mjs';

// Flattens a config object to dotted leaf paths. Arrays and null are leaves.
// The skip is exactly `_meta`, not every `_`-prefixed key: a prefix rule also swallowed `__proto__`, so validate
// said {"ok":true,"checked":0} about a hostile config the guard was already obeying.
// Accumulating with defineProperty matters for the same reason: assigning a top-level leaf named `__proto__`
// runs Object.prototype's setter and reparents acc instead of recording a key.
/**
 * Every leaf of a config object as a dotted key.
 * @param {any} obj @param {string} prefix @param {Record<string, any>} acc
 * @returns {Record<string, any>}
 */
export function flatten(obj, prefix, acc) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, acc);
    else Object.defineProperty(acc, path, { value: v, writable: true, enumerable: true, configurable: true });
  }
  return acc;
}

/** @param {any} layer */
const leaves = (layer) => (isPlainObject(layer) ? flatten(layer, '', {}) : {});

// the reviewer names a list can hold: strings, as route.mjs reads them
/** @param {any} list @returns {string[]|null} */
function usableNames(list) {
  if (!Array.isArray(list)) return null;
  const names = list.filter((x) => typeof x === 'string' && x);
  return names.length ? names : null;
}

/**
 * One layer's cell for one key. A global-only key in the repo and a `testing.*` key in global are ignored by the
 * merge; a null there is silent, as the merge's own warning is.
 * @param {'repo'|'global'} layer
 */
function cellFor(layer, key, spec, flat, torn, file) {
  if (torn) return { state: 'unreadable', file };
  if (!Object.hasOwn(flat, key)) return { state: 'unset' };
  const value = flat[key];
  const ignored = layer === 'repo' ? spec.src === 'global' : key.startsWith('testing.');
  if (ignored) return value === null ? { state: 'unset' } : { state: 'ignored', value };
  return { state: 'set', value };
}

/**
 * @param {any[]} rows
 * @param {{repo: boolean, global: boolean}} torn
 */
function tally(rows, torn) {
  const n = (/** @type {(r: any) => boolean} */ pred) => rows.filter(pred).length;
  const bothSet = (/** @type {any} */ r) => r.repo.state === 'set' && r.global.state === 'set';
  return {
    settings: rows.length,
    advanced: n((r) => !r.shown),
    repo: torn.repo ? 'unreadable' : n((r) => r.repo.state === 'set'),
    global: torn.global ? 'unreadable' : n((r) => r.global.state === 'set'),
    beating: torn.repo || torn.global ? 'unreadable'
      : n((r) => !r.both && bothSet(r) && !isDeepStrictEqual(r.repo.value, r.global.value)),
    at_default: torn.repo ? 'unreadable' : n((r) => r.repo.state === 'set' && isDeepStrictEqual(r.repo.value, r.default)),
  };
}

/**
 * @param {object} input
 * @param {Record<string, any>} input.keys the schema's `keys`
 * @param {any} input.merged what `mergeLayers` returned: `config`, `layers` and `tornLayers`
 * @param {{repo: string, global: string}} input.files the two layer paths, as they were passed to the merge
 * @param {Record<string, {on: boolean}>} input.both the both-layer answers, by key: a key listed here has no winner
 *   and is on only when its answer says so
 */
export function layerRows({ keys, merged, files, both }) {
  const config = isPlainObject(merged.config) ? merged.config : {};
  const layers = merged.layers || { global: null, repo: null };
  const tornLayers = merged.tornLayers || [];
  const torn = { repo: tornLayers.includes(files.repo), global: tornLayers.includes(files.global) };
  const flat = { repo: leaves(layers.repo), global: leaves(layers.global) };
  const inForce = flatten(config, '', {});
  /** @type {string[]} */
  const warnings = [];

  // the cross-model names the user-global layer itself lists, which route.mjs requires of every provider
  const globalNames = (usableNames(flat.global['review.reviewers']) || []).filter((n) => n !== 'claude-subagent');

  const rows = [];
  for (const [key, spec] of Object.entries(keys)) {
    const dflt = spec.default === undefined ? null : spec.default;
    const rc = cellFor('repo', key, spec, flat.repo, torn.repo, files.repo);
    const gc = cellFor('global', key, spec, flat.global, torn.global, files.global);
    const row = /** @type {Record<string, any>} */ ({
      key, ...(typeof spec.label === 'string' ? { label: spec.label } : {}),
      group: spec.section, shown: typeof spec.question === 'string', position: spec.position,
      default: dflt, global: gc, repo: rc,
    });
    if (Object.hasOwn(both, key)) {
      row.both = true;
      row.value = both[key].on === true;
      row.winner = null;
      rows.push(row);
      continue;
    }
    // a repo section that replaces a whole global object (a null above the key) leaves the key to the default
    const merging = Object.hasOwn(inForce, key);
    row.winner = rc.state === 'set' ? 'repo'
      : gc.state === 'set' ? (merging ? 'global' : 'repo') : 'default';
    let value = merging && inForce[key] !== null && inForce[key] !== undefined ? inForce[key] : dflt;
    if (key === 'review.reviewers') {
      const wanted = usableNames(value) || usableNames(dflt) || ['claude-subagent'];
      const dropped = wanted.filter((n) => n !== 'claude-subagent' && !globalNames.includes(n));
      const kept = wanted.filter((n) => !dropped.includes(n));
      value = kept.length ? kept : ['claude-subagent'];
      if (dropped.length) row.dropped = dropped;
    }
    if (spec.grammar === 'model_id' && checkGrammar(spec, value) !== null) {
      warnings.push(`${key}: the stored value is not a model id and was read as null`);
      value = null;
      row.unusable = true;
    }
    row.value = value;
    rows.push(row);
  }

  // whether each setting does anything, read against the value in force of every key
  const values = Object.create(null);
  for (const r of rows) values[r.key] = r.value;
  for (const r of rows) {
    const answer = appliesAnswer(keys[r.key].applies_when, values);
    r.applies = answer.applies;
    if (!answer.applies) r.no_effect = answer.why;
  }

  // retired and unknown keys stay out of every count; a section set to a non-object over keys the schema holds
  // replaces them all, and is named for it
  const schemaKeys = Object.keys(keys);
  warnings.push(...retiredKeysIn(config));
  for (const k of Object.keys(inForce)) {
    if (Object.hasOwn(keys, k) || Object.hasOwn(RETIRED_KEYS, k)) continue;
    warnings.push(schemaKeys.some((s) => s.startsWith(`${k}.`))
      ? `config key "${k}" is not an object, so it replaces every ${k}.* setting below it with the defaults`
      : `config key "${k}" is not a setting this schema carries and was ignored`);
  }

  // the groups, ordered by where their first setting sits in the walk
  /** @type {Map<string, number>} */
  const first = new Map();
  for (const r of rows) {
    const p = typeof r.position === 'number' ? r.position : Infinity;
    first.set(r.group, Math.min(first.has(r.group) ? /** @type {number} */ (first.get(r.group)) : Infinity, p));
  }
  const names = [...first.keys()].sort((a, b) => /** @type {number} */ (first.get(a)) - /** @type {number} */ (first.get(b)));
  const groups = names.map((name, i) => ({ n: i + 1, name, ...tally(rows.filter((r) => r.group === name), torn) }));
  const ordered = names.flatMap((name) => {
    const inGroup = rows.filter((r) => r.group === name);
    return [...inGroup.filter((r) => r.shown).sort((a, b) => a.position - b.position), ...inGroup.filter((r) => !r.shown)];
  });

  /** @type {{layer: string, file: string}[]} */
  const unreadable = [];
  if (torn.repo) unreadable.push({ layer: 'repo', file: files.repo });
  if (torn.global) unreadable.push({ layer: 'global', file: files.global });

  return { rows: ordered, groups, totals: tally(rows, torn), unreadable, warnings };
}
