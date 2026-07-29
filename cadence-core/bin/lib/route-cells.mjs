// @ts-check
// route-cells.mjs - the ONE statement of what makes cadence-core/route-table.json's
// three grids well-formed, imported by self-verify.mjs (which files each issue as
// a CI problem). Same shape and same reasons as lib/rung-agent.mjs: route.mjs
// reads these grids and fails OPEN on anything wrong with them, so CI is the only
// place a bad cell can die, and the rule it dies by has to be written once.
//
// Every `detail` NAMES THE CELL - `<level>/<role>` or `<level>/<trigger>` - because
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
  return strs(obj(table) ? table.role_order : null);
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

/**
 * Everything wrong with the three grids, as `{code, detail}` entries.
 *
 * Codes:
 *   `missing-cell`        a (level, role) pair with no entry, a level with no
 *                         review row or no verify value, or a trigger the
 *                         level's review row omits
 *   `missing-rung-agent`  a cell whose `effort` or `retry` names a rung that
 *                         lib/rung-agent.mjs maps to no agent file
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
  const roles = declaredRoles(t);
  const cells = obj(t.cells);
  const review = obj(t.review);
  const verify = obj(t.verify);

  for (const level of levels) {
    const row = obj(cells ? cells[level] : null);
    for (const role of roles) {
      const cell = obj(row ? row[role] : null);
      if (!cell) {
        issues.push({ code: 'missing-cell',
          detail: `${level}/${role}: no cell - the level names no model, effort or retry rung for this role` });
        continue;
      }
      // A rung with no file is caught HERE rather than at spawn time: route.mjs
      // returns an agent name it never checks exists, so an unbuilt or renamed
      // rung would otherwise surface as a failed dispatch mid-run.
      for (const which of ['effort', 'retry']) {
        const rung = cell[which];
        if (typeof rung === 'string' && rungFile(role, rung)) continue;
        issues.push({ code: 'missing-rung-agent',
          detail: `${level}/${role}: ${which} rung ${JSON.stringify(rung)} maps to no agent file for ${role}` });
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
    }
    if (!verify || verify[level] === undefined) {
      issues.push({ code: 'missing-cell',
        detail: `${level}: no verify value - the level does not say whether the deep-verify pass runs` });
    }
  }

  return issues;
}
