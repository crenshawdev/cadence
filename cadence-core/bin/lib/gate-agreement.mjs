// @ts-check
// gate-agreement.mjs - what makes the twelve `review.triggers.<t>.{gate,tier,effort}` rows a usable answer.
// self-verify.mjs files each issue as a CI problem; route.mjs imports `gateTriggers` alone.
// The schema `default`, the `purpose` prose and route.mjs's resolution all describe these rows, and an "advisory"
// default once survived a move of `phase_diff` to `off`. `null` isn't exempt, since the default is the answer.
// The prose half reads `defaults to <value>`; only a second one naming a different member of `values` disagrees.
// Pure: no fs, no emit, no process, no Date, no randomness.
'use strict';

/** @param {any} v */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {any} v @returns {any} */
const obj = (v) => (isObj(v) ? v : null);
/** @param {any} v @returns {string[]} */
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
/** @param {any} v */
const show = (v) => JSON.stringify(v === undefined ? null : v);
/** @param {string} s */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The three fields one trigger carries, in walk order, so one trigger's three rows show together in a run of problems.
 */
const FIELDS = ['gate', 'tier', 'effort'];

/** The schema key holding one field of one trigger. One spelling, used everywhere. */
/** @param {string} trigger @param {string} field */
const rowKey = (trigger, field) => `review.triggers.${trigger}.${field}`;

/**
 * Every trigger the schema defines a gate row for, in key order. Derived, never hand-kept: a fifth trigger is
 * walked without an edit here, and a retired one stops being walked and leaves no phantom. route.mjs imports this
 * so the resolver and the linter share one derivation.
 * @param {any} schemaKeys the schema's `keys` object (key -> spec)
 * @returns {string[]}
 */
export function gateTriggers(schemaKeys) {
  const keys = obj(schemaKeys) || {};
  const out = [];
  for (const key of Object.keys(keys)) {
    const parts = key.split('.');
    if (parts.length !== 4) continue;
    if (parts[0] !== 'review' || parts[1] !== 'triggers' || parts[3] !== 'gate') continue;
    if (parts[2] && !out.includes(parts[2])) out.push(parts[2]);
  }
  return out;
}

/**
 * Every way one of the twelve rows fails to be an answer, as `{code, detail}` entries. Codes:
 *   `gate-default-invalid` the row's `default` isn't a member of its own `values`, `null` included.
 *   `gate-prose-missing`   the row's `purpose` has no `defaults to <value>` clause.
 *   `gate-prose-drift`     the `purpose` defaults to a member of `values` that isn't the row's `default`.
 *   `gate-row-malformed`   the schema key's spec is absent or not an object.
 * Nothing throws or short-circuits, so a row with two faults reports both.
 * @param {any} schemaKeys the parsed config.schema.json `keys` map, trusted for nothing
 * @returns {Array<{code: string, detail: string}>}
 */
export function gateAgreementIssues(schemaKeys) {
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  const keys = obj(schemaKeys) || {};

  for (const trigger of gateTriggers(keys)) {
    for (const field of FIELDS) {
      const key = rowKey(trigger, field);
      const spec = obj(keys[key]);
      if (!spec) {
        issues.push({ code: 'gate-row-malformed',
          detail: `${key}: the schema row is ${show(keys[key])}, not an object, so it carries `
            + 'neither a default to read nor a purpose to check it against' });
        continue;
      }

      const values = strs(spec.values);

      // --- the default half ----------------------------------------------------
      const def = spec.default;
      const defOk = typeof def === 'string' && values.includes(def);
      if (!defOk) {
        // an absent default prints as absent, not folded into null by show, so the message never sends anyone
        // looking for a value the row doesn't carry; null is reported like any other non-member
        issues.push({ code: 'gate-default-invalid',
          detail: `${key}: default ${def === undefined ? '(absent)' : show(def)} is not one of `
            + `[${values.join(', ')}] - nothing decides this key when no layer sets it, so `
            + 'the default IS the answer route.mjs resolves and config.mjs get reports' });
      }

      // --- the prose half ------------------------------------------------------
      // Never conditional on a clause being there: an opt-in rule is silenced by deleting the sentence it reads.
      // Longest member first, so a member that prefixes another can't claim its match.
      const purpose = spec.purpose;
      const text = typeof purpose === 'string' ? purpose : '';
      const alts = [...values].sort((a, b) => b.length - a.length).map(esc).join('|');
      /** @type {string[]} */
      const named = [];
      if (alts) {
        // the tail is a lookahead, not `\b`: a backtick before `;` has no word boundary, so `\b` would match by luck
        const clause = new RegExp(
          `\\bdefaults?\\s+to\\s+[\`"']?(${alts})[\`"']?(?![\\w-])`, 'gi');
        for (const m of text.matchAll(clause)) {
          const found = m[1].toLowerCase();
          if (!named.includes(found)) named.push(found);
        }
      }
      if (!named.length) {
        issues.push({ code: 'gate-prose-missing',
          detail: `${key}: ${typeof purpose === 'string'
            ? 'the purpose states no default'
            : `the purpose is ${show(purpose)}, not a string, so it states no default`}`
            + ' - every one of these purposes must carry a "defaults to <value>" clause naming '
            + `one of [${values.join(', ')}], because the prose is where a user setting the key `
            + 'learns what it already does' });
        continue;
      }
      for (const g of named) {
        if (g === def) continue;
        issues.push({ code: 'gate-prose-drift',
          detail: `${key}: the purpose says it defaults to "${g}", but the row's default is `
            + `${def === undefined ? '(absent)' : show(def)}` });
      }
    }
  }

  return issues;
}
