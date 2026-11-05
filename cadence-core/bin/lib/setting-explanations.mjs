// @ts-check
// setting-explanations.mjs - holds each key's `explain` entries in config.schema.json to the key they sit on.
// self-verify.mjs files each issue as a CI problem. Two rules:
//   explained-value-refused  an entry's `value` isn't accepted by the key, judged as `config.mjs validate` does.
//                            On a list key an entry is tested as a one-member list.
//   explained-value-missing  a key holding a `question` has a `values` member with no entry. A key with no question
//                            is outside the walk.
// Text and hints aren't checked. Pure: no fs, no emit, no process, and no CONTRACTS row since it's a lib.
'use strict';
import { checkValue } from './config-value.mjs';

/** @param {any} v */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {any} v */
const show = (v) => JSON.stringify(v === undefined ? null : v);

/**
 * @param {any} schemaKeys the parsed config.schema.json `keys` map, trusted for nothing
 * @returns {Array<{code: string, detail: string}>}
 */
export function settingExplanationIssues(schemaKeys) {
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  if (!isObj(schemaKeys)) return issues;

  for (const [key, spec] of Object.entries(schemaKeys)) {
    if (!isObj(spec)) continue;
    const entries = Array.isArray(spec.explain) ? spec.explain.filter(isObj) : [];
    const isList = spec.type === 'array_enum' || spec.type === 'array_string';

    for (const { value } of entries) {
      if (isList && value === null && spec.default === null) continue;
      const error = checkValue(spec, isList ? [value] : value);
      if (error !== null) {
        issues.push({ code: 'explained-value-refused',
          detail: `${key}: the explained value ${show(value)} is refused by the key (${error})` });
      }
    }

    if (typeof spec.question !== 'string' || !spec.question) continue;
    const members = spec.type === 'bool' ? [true, false] : (Array.isArray(spec.values) ? spec.values : []);
    for (const member of members) {
      if (!entries.some((e) => e.value === member)) {
        issues.push({ code: 'explained-value-missing',
          detail: `${key}: the allowed value ${show(member)} has no explain entry` });
      }
    }
  }
  return issues;
}
