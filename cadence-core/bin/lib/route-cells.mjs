// @ts-check
// route-cells.mjs - the ONE statement of what makes cadence-core/route-table.json's
// four grids AND its shared vocabulary arrays well-formed, imported by self-verify.mjs
// (which files each issue as a CI problem). Same shape and same reasons as lib/rung-agent.mjs: route.mjs
// reads these grids and fails OPEN on anything wrong with them, so CI is the only
// place a bad cell can die, and the rule it dies by has to be written once.
//
// Every `detail` NAMES THE CELL - `<level>/<role>`, `<level>/<trigger>` or
// `tiers/<trigger>` for the one grid that keys on a trigger alone - because
// in an 18-cell grid the level and the key are the only things that locate a
// problem. "a model outside model_aliases" sends a maintainer reading all 18.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. File EXISTENCE is
// the caller's job (it does the I/O); this side owns the map from a rung to the
// file name that should exist.
'use strict';

import { rungFile } from './rung-agent.mjs';

/** @param {any} v */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {any} v @returns {any} */
const obj = (v) => (isObj(v) ? v : null);
/** @param {any} v @returns {string[]} */
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);

/**
 * The role names the table DECLARES as routable, which is what route.mjs checks
 * a `--role` against. One reader, so the key can move without the check and the
 * resolver disagreeing about which roles exist.
 * @param {any} table
 * @returns {string[]}
 */
export function declaredRoles(table) {
  return strs(obj(table) ? table.roles : null);
}

/**
 * Every agent-file stem the grids can produce, mapped to the first cell that
 * names it. A Map rather than a Set so the caller can say WHICH cell wants a
 * file that is missing: `has()` still answers the reverse direction (a rung file
 * no cell reaches), and the label answers the forward one.
 * @param {any} table
 * @returns {Map<string, string>} stem -> `<level>/<role>`
 */
export function routableAgents(table) {
  /** @type {Map<string, string>} */
  const out = new Map();
  const cells = obj(obj(table) ? table.cells : null);
  if (!cells) return out;
  for (const [level, row] of Object.entries(cells)) {
    const r = obj(row);
    if (!r) continue;
    for (const [role, cell] of Object.entries(r)) {
      const c = obj(cell);
      if (!c) continue;
      for (const rung of [c.effort, c.retry]) {
        const stem = typeof rung === 'string' ? rungFile(role, rung) : null;
        if (stem && !out.has(stem)) out.set(stem, `${level}/${role}`);
      }
    }
  }
  return out;
}

/** Element-for-element string equality between two declared vocabularies. */
/** @param {string[]} a @param {string[]} b */
function sameList(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Everything wrong with the table's shared VOCABULARY arrays, as the same
 * `{code, detail}` entries.
 *
 * Codes:
 *   `stakes-order-drift`       `stakes_order` is not the caller's `levels`
 *   `gate-vocabulary-drift`    `gates` is not the caller's `gates`
 *   `surface-vocabulary-missing`  `risk_surface_categories` is absent, empty,
 *                              or holds anything but non-empty strings
 *
 * The first two are mandatory for the reason `rung-demotion` is: a vocabulary duplicated
 * across two files with no guard drifts silently. route.mjs compares levels by
 * INDEX in `stakes_order`, so a drifted order reorders the whole ladder, and it
 * refuses a user-set gate against `gates`, so a drifted list would refuse a gate
 * `config.mjs set` accepts.
 *
 * `surface-vocabulary-missing` is the one that takes no caller vocabulary,
 * because it is not a comparison: `risk_surface_categories` is the set
 * route.mjs RETURNS when no config layer answered the risk-surface scope
 * question, so an absent or malformed list resolves an empty scope and
 * silently stops the only blocking review trigger from firing. Whether it
 * still AGREES with config.schema.json's enum and with the category list in
 * references/review-triggers.md is a three-way comparison over two documents
 * this lib does not read, and lives in bin/prose-agreement.test.mjs.
 *
 * Vocabulary from the CALLER, never off the table, so this lib never grows a
 * second opinion about the accepted names.
 * @param {any} table the parsed route-table.json, trusted for nothing
 * @param {{levels?: string[], gates?: string[]}} [vocab]
 * @returns {Array<{code: string, detail: string}>}
 */
export function vocabularyIssues(table, vocab = {}) {
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  const t = obj(table) || {};
  const levels = strs(vocab.levels);
  const gateNames = strs(vocab.gates);
  const show = (/** @type {any} */ v) => JSON.stringify(v === undefined ? null : v);

  if (levels.length && !sameList(strs(t.stakes_order), levels)) {
    issues.push({ code: 'stakes-order-drift',
      detail: `stakes_order ${show(t.stakes_order)} is not the accepted stakes order `
        + `[${levels.join(', ')}] - the ladder compares levels by their index in that array` });
  }
  if (gateNames.length && !sameList(strs(t.gates), gateNames)) {
    issues.push({ code: 'gate-vocabulary-drift',
      detail: `gates ${show(t.gates)} is not the accepted gate vocabulary `
        + `[${gateNames.join(', ')}] - a drifted list refuses a gate config.mjs accepts` });
  }
  const categories = t.risk_surface_categories;
  if (!Array.isArray(categories) || !categories.length
    || !categories.every((x) => typeof x === 'string' && x)) {
    issues.push({ code: 'surface-vocabulary-missing',
      detail: `risk_surface_categories ${show(categories)} is not a non-empty list of `
        + `category names - route.mjs returns it as the risk_surface scope when no config `
        + `layer set review.triggers.risk_surface.surfaces, so an absent or malformed list `
        + `resolves an empty scope and the one blocking trigger stops firing on everything` });
  }

  return issues;
}

/**
 * Everything wrong with the four grids, as `{code, detail}` entries.
 *
 * Codes:
 *   `missing-cell`        a (level, role) pair with no entry, a level with no
 *                         review row or no verify value, a trigger the level's
 *                         review row omits, or a trigger with no `tiers` entry
 *   `missing-rung-agent`  a cell whose `effort` or `retry` names a rung that
 *                         lib/rung-agent.mjs maps to no agent file
 *   `unknown-model`       a cell `model` outside the table's `model_aliases`
 *   `unknown-rung`        a cell `effort`/`retry` outside `rung_order`, or a
 *                         `verify` value outside on/off
 *   `unknown-gate`        a review value outside the schema's gate enum
 *   `unknown-trigger`     a review or `tiers` key that is not a trigger the
 *                         schema defines
 *   `unknown-tier`        a `tiers` value outside the table's `tier_names`
 *   `rung-demotion`       a cell whose `retry` sits BELOW its `effort`
 *
 * `tiers` is the ONE grid that does not key on a level: it names the fallback
 * model tier a trigger's reviewer-availability test uses when no config layer
 * set `review.triggers.<t>.tier`, so its cells are located by trigger alone
 * (`tiers/<trigger>`). A trigger with no entry is caught here rather than at
 * resolve time for the reason every other cell is: route.mjs fails open, so a
 * missing tier would resolve every provider unavailable on a live dispatch and
 * report a fallback the user never configured.
 *
 * `rung-demotion` is the one code no acceptance criterion asked for, and it is
 * mandatory: membership checks cannot see DIRECTION, and this phase deletes
 * `rungIssues`, which was the only direction guard in the tree. Without it,
 * editing a cell's `retry` to a lower rung passes `unknown-rung`, passes
 * `missing-rung-agent` (the file exists), keeps self-verify green, and makes
 * route.mjs dispatch a WEAKER rung on a failed attempt while reporting
 * `escalated: true` - the retry thinks less and says it thought more. Equal is
 * legal (four cells in the shipped table hold their rung); only a strict
 * demotion fires.
 *
 * A value of the wrong TYPE (a number, an object, null) reports under the same
 * code rather than throwing - this runs on a table nothing has validated yet -
 * and a cell with two faults reports two problems rather than short-circuiting,
 * so a maintainer fixing one does not discover the second on the next pass.
 *
 * The vocabulary is supplied by the CALLER rather than read off the table, so
 * the accepted names come from config.schema.json - the file that already
 * defines them - and this lib never grows a second opinion about them.
 * @param {any} table the parsed route-table.json, trusted for nothing
 * @param {{levels?: string[], triggers?: string[], gates?: string[]}} [vocab]
 * @returns {Array<{code: string, detail: string}>}
 */
export function cellIssues(table, vocab = {}) {
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  const t = obj(table) || {};
  const levels = strs(vocab.levels);
  const triggers = strs(vocab.triggers);
  const gateNames = strs(vocab.gates);
  const roles = declaredRoles(t);
  const cells = obj(t.cells);
  const review = obj(t.review);
  const verify = obj(t.verify);
  const order = strs(t.rung_order);
  const aliases = strs(t.model_aliases);
  const tierNames = strs(t.tier_names);
  const show = (/** @type {any} */ v) => JSON.stringify(v === undefined ? null : v);

  // A vocabulary the table itself was supposed to declare, missing: ONE problem
  // naming the absent list, never one per cell. A cascade of 36 buries the
  // single fix (the rule lib/rung-agent.mjs' rungIssues set for rung_order).
  if (levels.length && roles.length && !order.length) {
    issues.push({ code: 'unknown-rung',
      detail: 'rung_order is absent or empty, so no cell rung can be checked against it' });
  }
  if (levels.length && roles.length && !aliases.length) {
    issues.push({ code: 'unknown-model',
      detail: 'model_aliases is absent or empty, so no cell model can be checked against it' });
  }

  for (const level of levels) {
    const row = obj(cells ? cells[level] : null);
    for (const role of roles) {
      const cell = obj(row ? row[role] : null);
      if (!cell) {
        issues.push({ code: 'missing-cell',
          detail: `${level}/${role}: no cell - the level names no model, effort or retry rung for this role` });
        continue;
      }
      const at = `${level}/${role}`;

      if (aliases.length && !(typeof cell.model === 'string' && aliases.includes(cell.model))) {
        issues.push({ code: 'unknown-model',
          detail: `${at}: model ${show(cell.model)} is not in model_aliases [${aliases.join(', ')}]` });
      }

      // A rung with no file is caught HERE rather than at spawn time: route.mjs
      // returns an agent name it never checks exists, so an unbuilt or renamed
      // rung would otherwise surface as a failed dispatch mid-run.
      for (const which of ['effort', 'retry']) {
        const rung = cell[which];
        if (order.length && !(typeof rung === 'string' && order.includes(rung))) {
          issues.push({ code: 'unknown-rung',
            detail: `${at}: ${which} rung ${show(rung)} is not in rung_order [${order.join(', ')}]` });
          continue; // a rung outside the vocabulary having no file is not news
        }
        if (typeof rung === 'string' && rungFile(role, rung)) continue;
        issues.push({ code: 'missing-rung-agent',
          detail: `${at}: ${which} rung ${show(rung)} maps to no agent file for ${role}` });
      }

      // DIRECTION, which no membership check can see.
      const ei = order.indexOf(cell.effort);
      const ri = order.indexOf(cell.retry);
      if (ei >= 0 && ri >= 0 && ri < ei) {
        issues.push({ code: 'rung-demotion',
          detail: `${at}: retry rung "${cell.retry}" sits BELOW effort rung "${cell.effort}" in rung_order [${order.join(', ')}] - a retry would think LESS while reporting an escalation` });
      }
    }

    const gates = obj(review ? review[level] : null);
    if (!gates) {
      issues.push({ code: 'missing-cell',
        detail: `${level}: no review row - the level names no gate for any trigger` });
    } else {
      for (const trigger of triggers) {
        if (gates[trigger] === undefined) {
          issues.push({ code: 'missing-cell',
            detail: `${level}/${trigger}: the review row names no gate for this trigger` });
        }
      }
      for (const [trigger, gate] of Object.entries(gates)) {
        if (triggers.length && !triggers.includes(trigger)) {
          issues.push({ code: 'unknown-trigger',
            detail: `${level}/${trigger}: not a trigger config.schema.json defines [${triggers.join(', ')}]` });
          continue; // an unknown trigger's gate value is the wrong thing to fix
        }
        if (gateNames.length && !(typeof gate === 'string' && gateNames.includes(gate))) {
          issues.push({ code: 'unknown-gate',
            detail: `${level}/${trigger}: gate ${show(gate)} is not one of [${gateNames.join(', ')}]` });
        }
      }
    }

    const v = verify ? verify[level] : undefined;
    if (v === undefined) {
      issues.push({ code: 'missing-cell',
        detail: `${level}: no verify value - the level does not say whether the deep-verify pass runs` });
    } else if (v !== 'on' && v !== 'off') {
      issues.push({ code: 'unknown-rung',
        detail: `${level}: verify ${show(v)} is not one of [off, on]` });
    }
  }

  // The `tiers` grid, checked in BOTH directions against the same trigger list
  // the review rows are checked against - a trigger the schema defines with no
  // fallback tier, and an entry for a trigger the schema does not define.
  const tiers = obj(t.tiers);
  if (triggers.length && !tierNames.length) {
    // ONE problem naming the absent list, never one per trigger (the rule
    // rung_order and model_aliases already follow above).
    issues.push({ code: 'unknown-tier',
      detail: 'tier_names is absent or empty, so no fallback tier can be checked against it' });
  }
  if (triggers.length && !tiers) {
    issues.push({ code: 'missing-cell',
      detail: 'tiers: no tiers block - the table names no fallback model tier for any trigger' });
  } else if (tiers) {
    for (const trigger of triggers) {
      if (tiers[trigger] === undefined) {
        issues.push({ code: 'missing-cell',
          detail: `tiers/${trigger}: no fallback tier - the availability test has no tier to read `
            + `when no config layer sets review.triggers.${trigger}.tier` });
      }
    }
    for (const [trigger, tier] of Object.entries(tiers)) {
      if (triggers.length && !triggers.includes(trigger)) {
        issues.push({ code: 'unknown-trigger',
          detail: `tiers/${trigger}: not a trigger config.schema.json defines [${triggers.join(', ')}]` });
        continue; // an unknown trigger's tier value is the wrong thing to fix
      }
      if (tierNames.length && !(typeof tier === 'string' && tierNames.includes(tier))) {
        issues.push({ code: 'unknown-tier',
          detail: `tiers/${trigger}: tier ${show(tier)} is not one of [${tierNames.join(', ')}]` });
      }
    }
  }

  return issues;
}
