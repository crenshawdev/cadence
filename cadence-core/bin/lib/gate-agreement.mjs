// @ts-check
// gate-agreement.mjs - the ONE statement of what makes the twelve
// `review.triggers.<t>.{gate,tier,effort}` rows in config.schema.json a usable
// answer, imported by self-verify.mjs (which files each issue as a CI problem
// against the SCHEMA) and, for `gateTriggers` alone, by route.mjs (which
// resolves those rows into the routing bundle).
//
// Three surfaces describe these twelve settings and, before this, nothing made
// them agree: `config.mjs get` answers one out of the schema `default` when no
// layer set one, the key's `purpose` is the prose a user reads while setting it,
// and route.mjs resolves the same rows for a dispatch. A schema default of
// `"advisory"` for `phase_diff` once survived a deliberate v3.2.0 move of that
// gate to `off` with every check green, and `workflows/execute.md` carried a
// paragraph telling callers to route around the seam because of it. This is the
// comparison that was missing; it adds no key, no flag and no command.
//
// The rows used to sit on a `null` sentinel meaning "the stakes level decides",
// and this lib compared them against the level-keyed grids in
// `route-table.json`. The level is gone and so is that table: the schema
// `default` IS the answer now, so the two halves below are what a row has to
// hold, and `null` has stopped being exempt. A null default is a value the
// resolver cannot answer at all.
//
// Both halves are MANDATORY, and that is the point of the prose half. An
// opt-in rule - hold the prose only where a clause already exists - lets a
// maintainer silence it by deleting one sentence, which is the same hole check
// 14 was written to close for CONTRACTS rows: a surface silently opting out of
// its own lint while looking clean.
//
// THE CLAUSE GRAMMAR, stated here because it is the thing the prose half reads
// and the thing a maintainer writing a purpose has to satisfy:
//
//     defaults to <value>
//
// case-insensitive, the value optionally wrapped in backticks or quotes, and
// `<value>` a member of that row's own `values` enum. Everything else in the
// purpose is free prose: a row may list the other members, explain them, or say
// what setting the key does, and only a second `defaults to` clause naming a
// different member counts as a disagreement.
//
// The trigger list is derived from the schema's own `review.triggers.*.gate`
// key names, never hand-kept, so a fifth trigger is walked the day its key
// lands (D-09). The vocabulary each row is judged against is that row's OWN
// `values`, so this lib holds no second opinion about the accepted names and
// takes no vocabulary from its caller: the schema is now the only authority
// and it arrives whole.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns
// `{code, detail}` entries and the caller owns the envelope. Every `detail`
// names the KEY, which is the locating convention lib/rung-agent.mjs states for
// the same reason: "a gate disagrees" sends a maintainer reading all twelve
// rows.
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
 * The three fields one trigger carries, in the order the rows are walked - so a
 * maintainer reading a run of problems sees one trigger's three rows together.
 */
const FIELDS = ['gate', 'tier', 'effort'];

/** The schema key holding one field of one trigger. One spelling, used everywhere. */
/** @param {string} trigger @param {string} field */
const rowKey = (trigger, field) => `review.triggers.${trigger}.${field}`;

/**
 * Every trigger the schema defines a gate row for, in key order. Derived, never
 * hand-kept (D-09): the day a fifth trigger's key lands, it is walked without an
 * edit here, and the day one is retired it stops being walked without leaving a
 * phantom behind. route.mjs imports this so the resolver and the linter walk one
 * derivation rather than two lists.
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
 * Every way one of the twelve rows fails to be an answer, as `{code, detail}`
 * entries.
 *
 * Codes:
 *   `gate-default-invalid` the row's `default` is not a member of its own
 *                          `values`. `null` included: with no level left to fall
 *                          back to, a null default is a value the resolver
 *                          cannot answer, and `config.mjs get` reports it
 *                          verbatim as what the trigger does.
 *   `gate-prose-missing`   the row's `purpose` carries no `defaults to <value>`
 *                          clause at all (a non-string `purpose` reads here too,
 *                          and says so).
 *   `gate-prose-drift`     the `purpose` says it defaults to a member of
 *                          `values` that is not the row's `default`.
 *   `gate-row-malformed`   the schema key exists but its spec is not an object,
 *                          or is absent entirely, so it carries neither a
 *                          default nor a purpose.
 *
 * Nothing throws and nothing short-circuits: a row with two faults reports two
 * problems, so a maintainer fixing one does not discover the other on the next
 * pass. That includes a row whose default is invalid AND whose prose names some
 * other member - those are two edits, not one.
 *
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
        // An ABSENT default is rendered as absent rather than folded into
        // `null` by `show`, so a message never sends a maintainer looking for a
        // value the row does not carry. `null` no longer has a sentinel
        // meaning: it is reported like any other non-member.
        issues.push({ code: 'gate-default-invalid',
          detail: `${key}: default ${def === undefined ? '(absent)' : show(def)} is not one of `
            + `[${values.join(', ')}] - nothing decides this key when no layer sets it, so `
            + 'the default IS the answer route.mjs resolves and config.mjs get reports' });
      }

      // --- the prose half ------------------------------------------------------
      // MANDATORY, never conditional on a clause already being there: an opt-in
      // rule is silenced by deleting the sentence it reads. Longest member
      // first, so one member that is a prefix of another cannot claim its match.
      const purpose = spec.purpose;
      const text = typeof purpose === 'string' ? purpose : '';
      const alts = [...values].sort((a, b) => b.length - a.length).map(esc).join('|');
      /** @type {string[]} */
      const named = [];
      if (alts) {
        // The closing wrapper is optional and the tail is a lookahead rather
        // than `\b`: a backtick followed by `;` has no word boundary between
        // them, so `\b` would only match here by backtracking, and the rule is
        // meant to be readable rather than lucky.
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
