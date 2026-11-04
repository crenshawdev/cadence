// @ts-check
// setting-explanations.mjs - holds each key's `explain` entries in
// config.schema.json to the key they sit on, imported by self-verify.mjs (which
// files each issue as a CI problem against the SCHEMA).
//
// The /cad-config walk and any other reader (a config panel) offer these
// entries as answers, so an entry the key would refuse is a choice that
// fails on write, and a `values` member with no entry is an option the walk
// never shows. Two rules, and no more (D-13):
//
//   explained-value-refused  an entry's `value` is not accepted by the key. It
//                            answers exactly as `config.mjs validate` does,
//                            through lib/config-value.mjs. On a list key an
//                            entry is ONE MEMBER of the list, so it is tested
//                            as a one-member list. `null` on a list key whose
//                            `default` is `null` is also accepted: D-09 explains
//                            `null` there, and `check` refuses writing it
//                            while D-11 forbids changing what `check` accepts.
//   explained-value-missing  a key that holds a `question` has a `values`
//                            member with no entry. A bool has no `values`, so
//                            `true` and `false` are its members. A key with no
//                            question is outside the walk and carries `values`
//                            with no entries by design (D-05).
//
// Text on an entry is not required, and hints are not checked.
//
// Pure lib: no fs, no emit, no process. It returns `{code, detail}` entries,
// each `detail` naming the key and the value, and takes no CONTRACTS row, for
// the reason check 14 states about `lib/*.mjs`.
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
