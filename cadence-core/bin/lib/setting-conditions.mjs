// @ts-check
// setting-conditions.mjs - a setting's `applies_when` in config.schema.json: the conditions under which it does
// anything. appliesAnswer reads them against the values in force (never the merged config, which holds no defaults,
// so an unset gate would pass `not: off`) and names each one that fails.
// A condition it can't read never claims "no effect": a false one is worse than none.
// settingConditionIssues holds the list to the keys it names, for self-verify.
// Pure: no fs, no emit, no process.
'use strict';
import { isDeepStrictEqual } from 'node:util';
import { checkValue } from './config-value.mjs';

const OPERATORS = ['not', 'is', 'includes'];
/** @param {any} v */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {any} v */
const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v === undefined ? null : v));

/**
 * Does a setting apply, given the value in force of every key. Every condition must hold.
 * @param {any} list the setting's `applies_when`
 * @param {Record<string, any>} values value in force by key
 * @returns {{applies: boolean, why: string[]}} `why` holds one sentence per failed condition
 */
export function appliesAnswer(list, values) {
  /** @type {string[]} */
  const why = [];
  if (!Array.isArray(list)) return { applies: true, why };
  for (const c of list) {
    if (!isObj(c) || typeof c.key !== 'string' || !Object.hasOwn(values, c.key)) continue;
    const ops = OPERATORS.filter((op) => Object.hasOwn(c, op));
    if (ops.length !== 1) continue;
    const have = values[c.key];
    const now = `${c.key} is ${show(have)}`;
    if (ops[0] === 'not') {
      if (isDeepStrictEqual(have, c.not)) why.push(now);
    } else if (ops[0] === 'is') {
      if (!isDeepStrictEqual(have, c.is)) why.push(`${now}, not ${show(c.is)}`);
    } else if (!Array.isArray(have) || !have.some((m) => isDeepStrictEqual(m, c.includes))) {
      why.push(`${now}, which doesn't include ${show(c.includes)}`);
    }
  }
  return { applies: why.length === 0, why };
}

/**
 * The keys whose `applies_when` names this one.
 * @param {Record<string, any>} schemaKeys
 * @param {string} key
 * @returns {string[]}
 */
export function dependentsOf(schemaKeys, key) {
  return Object.entries(schemaKeys)
    .filter(([, spec]) => isObj(spec) && Array.isArray(spec.applies_when)
      && spec.applies_when.some((/** @type {any} */ c) => isObj(c) && c.key === key))
    .map(([k]) => k);
}

/**
 * Rules, filed by self-verify as CI problems:
 *   applies-when-malformed       the list isn't a list of `{key, <one of not|is|includes>}`
 *   applies-when-unknown-key     a condition names a key the schema doesn't hold, which a retired key is too
 *   applies-when-value-refused   the compared value is one the named key refuses, judged as `config.mjs validate` does;
 *                                an `includes` member is tested as a one-member list, so a key that isn't a list refuses it
 * @param {any} schemaKeys the parsed config.schema.json `keys` map, trusted for nothing
 * @returns {Array<{code: string, detail: string}>}
 */
export function settingConditionIssues(schemaKeys) {
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  if (!isObj(schemaKeys)) return issues;
  for (const [key, spec] of Object.entries(schemaKeys)) {
    if (!isObj(spec) || spec.applies_when === undefined) continue;
    if (!Array.isArray(spec.applies_when)) {
      issues.push({ code: 'applies-when-malformed', detail: `${key}: applies_when is not a list` });
      continue;
    }
    for (const c of spec.applies_when) {
      const ops = isObj(c) ? OPERATORS.filter((op) => Object.hasOwn(c, op)) : [];
      if (!isObj(c) || typeof c.key !== 'string' || ops.length !== 1) {
        issues.push({ code: 'applies-when-malformed',
          detail: `${key}: ${show(c)} is not a key with exactly one of ${OPERATORS.join(', ')}` });
        continue;
      }
      const target = Object.hasOwn(schemaKeys, c.key) ? schemaKeys[c.key] : null;
      if (!isObj(target)) {
        issues.push({ code: 'applies-when-unknown-key', detail: `${key}: the condition names ${c.key}, which the schema doesn't hold` });
        continue;
      }
      const isList = target.type === 'array_enum' || target.type === 'array_string';
      const op = ops[0];
      const error = op === 'includes'
        ? (isList ? checkValue(target, [c.includes]) : `${c.key} is not a list`)
        : checkValue(target, c[op]);
      if (error !== null) {
        issues.push({ code: 'applies-when-value-refused',
          detail: `${key}: the ${op} value ${show(c[op])} is refused by ${c.key} (${error})` });
      }
    }
  }
  return issues;
}
