// @ts-check
// gate-agreement.mjs - the ONE statement of what makes a
// `review.triggers.<t>.gate` row in config.schema.json agree with the gate
// cadence-core/route-table.json's `review` grid actually fires, imported by
// self-verify.mjs (which files each issue as a CI problem against the SCHEMA,
// the side that moves - the grid is the authority and does not move).
//
// Three surfaces describe the review gates and, before this, nothing made them
// agree: `config.mjs get` answers a gate out of the schema `default` when no
// layer set one, the key's `purpose` is the prose a user reads while setting it,
// and the `review` grid is what route.mjs resolves and what fires. A schema
// default of `"advisory"` for `phase_diff` survived a deliberate v3.2.0 move of
// that cell to `off` at `shipped` with every check green, and `workflows/
// execute.md` carried a paragraph telling callers to route around the seam
// because of it. This is the comparison that was missing; it adds no key, no
// flag and no command.
//
// Both halves are MANDATORY, and that is the point of the prose half. An
// opt-in rule - hold the prose only where a level clause already exists - lets a
// maintainer silence it by deleting one sentence, which is the same hole check
// 14 was written to close for CONTRACTS rows: a surface silently opting out of
// its own lint while looking clean.
//
// `null` is exempt SPECIFICALLY, and nothing else. A `null` default is the
// sentinel for "no scalar claim to check, the level decides" (D-01), so only
// the prose half is held for such a row; the whole check would otherwise go
// quiet the moment the schema moves onto the sentinel. Any OTHER non-gate
// default - a typo'd `"adivsory"`, a `false`, a number - is its own problem
// under its own code, because nothing in the tree validates a schema `default`
// against its own key's `values` enum (`effortEnumIssues` in lib/rung-agent.mjs
// reads `values`, never `default`) while `config.mjs get` reports whatever is
// written there.
//
// The trigger list is derived from the schema's own `review.triggers.*.gate`
// key names, never hand-kept, so a fifth trigger is walked the day its key
// lands (D-09). The gate and level vocabularies come from the CALLER, the way
// lib/route-cells.mjs takes its own, so this lib never grows a second opinion
// about the accepted names. The grid arrives PARSED: this never reads or
// imports route.mjs, which resolves the same table for dispatch.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns
// `{code, detail}` entries and the caller owns the envelope. Every `detail`
// names the TRIGGER and, where the fault is per-level, the LEVEL - the locating
// convention lib/route-cells.mjs states for a grid, for the same reason: "a
// gate disagrees" sends a maintainer reading all twelve cells.
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

/** The schema key holding a trigger's gate. One spelling, used in both directions. */
/** @param {string} trigger */
const gateKey = (trigger) => `review.triggers.${trigger}.gate`;

/**
 * Every trigger the schema defines a gate row for, in key order. Derived, never
 * hand-kept (D-09): the day a fifth trigger's key lands, it is walked without an
 * edit here, and the day one is retired it stops being walked without leaving a
 * phantom behind.
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
 * Everything the schema's gate rows claim that the `review` grid does not fire,
 * as `{code, detail}` entries.
 *
 * Codes:
 *   `gate-default-drift`   the row's `default` is a real gate name, and the grid
 *                          fires something else at one or more levels. ONE entry
 *                          per trigger naming every level it disagrees at, not
 *                          one per level: a scalar default is one value with one
 *                          fix, and route-cells' rule for a single-fix fault is
 *                          one problem, never a cascade that buries it.
 *   `gate-default-invalid` the row's `default` is neither `null` nor a gate the
 *                          caller's vocabulary holds. `config.mjs get` answers
 *                          it verbatim, so a typo here is what a reader is told
 *                          the trigger does.
 *   `gate-prose-missing`   the row's `purpose` carries no `<gate> at <level>`
 *                          clause for some level (a non-string `purpose` reads
 *                          here too, and says so). One entry per level, because
 *                          each level clause is its own statement to restore.
 *   `gate-prose-drift`     the `purpose` names a gate at a level the grid fires
 *                          a different one at.
 *   `gate-grid-missing`    the grid answers nothing usable - no `review` block,
 *                          no row for a level, or a cell that is not a gate the
 *                          caller's vocabulary holds - so the schema's claim
 *                          cannot be checked there. Reported rather than
 *                          silently skipped: a table nothing has validated is
 *                          exactly the input this runs on.
 *   `gate-row-malformed`   the schema key exists but its spec is not an object,
 *                          so it carries neither a default nor a purpose.
 *
 * Nothing throws and nothing short-circuits: a row with two faults reports two
 * problems, so a maintainer fixing one does not discover the other on the next
 * pass.
 *
 * @param {any} schemaKeys the parsed config.schema.json `keys` map, trusted for nothing
 * @param {any} table the parsed route-table.json, trusted for nothing
 * @param {{levels?: string[], gates?: string[]}} [vocab]
 * @returns {Array<{code: string, detail: string}>}
 */
export function gateAgreementIssues(schemaKeys, table, vocab = {}) {
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  const keys = obj(schemaKeys) || {};
  const levels = strs(vocab.levels);
  const gateNames = strs(vocab.gates);
  // No vocabulary is not a finding here - it is the caller having no schema to
  // read the accepted names out of, which check 8 already reports from its own
  // side. Guarding rather than inventing defaults is what keeps this lib from
  // growing a second opinion about the names.
  if (!levels.length || !gateNames.length) return issues;

  const triggers = gateTriggers(keys);
  if (!triggers.length) return issues;

  const review = obj(obj(table) ? table.review : null);
  if (!review) {
    issues.push({ code: 'gate-grid-missing',
      detail: 'the route table carries no `review` grid, so no '
        + `review.triggers.<t>.gate default or purpose can be checked against what fires `
        + `(triggers: ${triggers.join(', ')})` });
    return issues;
  }

  // The grid, level by level, resolved ONCE for every trigger below. A level
  // with no row is one problem naming the level rather than one per trigger.
  /** @type {Map<string, any>} */
  const rows = new Map();
  for (const level of levels) {
    const row = obj(review[level]);
    if (!row) {
      issues.push({ code: 'gate-grid-missing',
        detail: `${level}: the review grid names no gates at this level, so no `
          + 'review.triggers.<t>.gate default or purpose can be checked against it' });
      continue;
    }
    rows.set(level, row);
  }

  // Built from the CALLER's vocabularies, so the clause grammar cannot name a
  // gate or a level the schema does not define.
  const clause = new RegExp(
    `\\b(${gateNames.map(esc).join('|')})\\s+at\\s+(${levels.map(esc).join('|')})\\b`, 'gi');

  for (const trigger of triggers) {
    const key = gateKey(trigger);
    const spec = obj(keys[key]);
    if (!spec) {
      issues.push({ code: 'gate-row-malformed',
        detail: `${key}: the schema row is ${show(keys[key])}, not an object, so it carries `
          + 'neither a default to compare nor a purpose to read' });
      continue;
    }

    // What the grid FIRES for this trigger, per level. `null` means the grid
    // could not answer, which is reported here and then excluded from both
    // halves below - comparing against an unusable cell would file the same
    // fault twice under two codes.
    /** @type {Map<string, string>} */
    const fires = new Map();
    for (const level of levels) {
      const row = rows.get(level);
      if (!row) continue;
      const cell = row[trigger];
      if (typeof cell === 'string' && gateNames.includes(cell)) {
        fires.set(level, cell);
        continue;
      }
      issues.push({ code: 'gate-grid-missing',
        detail: `${key}: the review grid fires ${show(cell)} for ${trigger} at ${level}, `
          + `which is not one of [${gateNames.join(', ')}], so the schema's claim about `
          + 'this level cannot be checked' });
    }

    // --- the default half ----------------------------------------------------
    const def = spec.default;
    if (def === null) {
      // The sentinel: no scalar claim, the level decides. Only the prose half
      // is held. Exempt SPECIFICALLY, so the check does not go quiet on every
      // other non-gate value.
    } else if (typeof def !== 'string' || !gateNames.includes(def)) {
      // An ABSENT default is rendered as absent, not folded into `null` by
      // `show`: `null` is the one legal non-gate value here, so a message
      // reading "default null is neither null nor a gate" would send a
      // maintainer looking for a value the row does not carry.
      issues.push({ code: 'gate-default-invalid',
        detail: `${key}: default ${def === undefined ? '(absent)' : show(def)} is neither null nor one of `
          + `[${gateNames.join(', ')}] - config.mjs get answers a schema default verbatim, so `
          + 'this is what a reader is told the trigger does at every level' });
    } else {
      const off = [...fires].filter(([, gate]) => gate !== def);
      if (off.length) {
        issues.push({ code: 'gate-default-drift',
          detail: `${key}: default "${def}" is what config.mjs get answers for an unset gate, `
            + `but the review grid fires ${off.map(([l, g]) => `"${g}" at ${l}`).join(', ')} - `
            + 'set the default to null so the stakes level decides' });
      }
    }

    // --- the prose half ------------------------------------------------------
    // MANDATORY, never conditional on a clause already being there: an opt-in
    // rule is silenced by deleting the sentence it reads.
    const purpose = spec.purpose;
    const text = typeof purpose === 'string' ? purpose : '';
    /** @type {Map<string, string[]>} */
    const claimed = new Map();
    for (const m of text.matchAll(clause)) {
      const gate = m[1].toLowerCase();
      const level = m[2].toLowerCase();
      const seen = claimed.get(level) || [];
      if (!seen.includes(gate)) seen.push(gate);
      claimed.set(level, seen);
    }
    for (const [level, gate] of fires) {
      const named = claimed.get(level) || [];
      if (!named.length) {
        issues.push({ code: 'gate-prose-missing',
          detail: `${key}: ${typeof purpose === 'string'
            ? `the purpose states no gate at ${level}`
            : `the purpose is ${show(purpose)}, not a string, so it states no gate at ${level}`}`
            + ` - every gate purpose must carry a "<gate> at <level>" clause for `
            + `${levels.join(', ')}, because the prose is where a user setting the key `
            + 'learns what the level already does' });
        continue;
      }
      for (const g of named) {
        if (g === gate) continue;
        issues.push({ code: 'gate-prose-drift',
          detail: `${key}: the purpose says "${g} at ${level}", but the review grid fires `
            + `"${gate}" at ${level}` });
      }
    }
  }

  return issues;
}
