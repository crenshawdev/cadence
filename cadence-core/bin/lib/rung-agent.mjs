// @ts-check
// rung-agent.mjs - the ONE statement of the rung->agent-file mapping rule,
// imported by both route.mjs (which resolves an escalation to an agent name)
// and self-verify.mjs (which proves every name the table can produce exists
// on disk). Spelling the rule twice is exactly the resolved-then-silently-
// wrong class this repo keeps closing (#39, #43, #64): route.mjs would name a
// file the linter never looked for.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns
// names and problem CODES; the callers own the envelope - route.mjs decides
// what a malformed spec means for a dispatch (nothing: it fails open), and
// self-verify.mjs decides what it means for CI (a problem entry).
//
// A role spec in cadence-core/route-table.json looks like:
//   { "tier": "light", "base_effort": "low",
//     "rungs": ["low", "high"], "escalate_to": "high" }
// The base rung lives at the UNSUFFIXED filename agents/<role>.md; every
// other rung lives at agents/<role>-<rung>.md (D-01).
'use strict';

/**
 * @typedef {object} RoleSpec
 * @property {string} [base_effort] the rung the unsuffixed agent file carries
 * @property {string[]} [rungs] every rung this role can be dispatched at
 * @property {string} [escalate_to] the rung a failure escalation resolves to
 */

/**
 * The agent-file name for one rung of one role. The base rung keeps the
 * unsuffixed name; every other rung is `<role>-<rung>` (D-01).
 *
 * Deliberately unvalidated and never throws: it is a NAME function, and the
 * two callers disagree about what an invalid rung means (route.mjs dispatches
 * anyway and fails open; self-verify.mjs reports it). Validation lives in
 * `rungIssues`.
 * @param {string} role
 * @param {RoleSpec} spec
 * @param {string} rung
 * @returns {string}
 */
export function agentForRung(role, spec, rung) {
  return rung === (spec || {}).base_effort ? role : `${role}-${rung}`;
}

/**
 * Every agent name the route table can produce for one role, in declared
 * order and de-duplicated: the base rung first, then each member of `rungs`,
 * then `escalate_to`.
 *
 * Tolerant by construction - a malformed spec still yields the base name
 * rather than throwing, because self-verify calls this on a table it has not
 * validated yet and route.mjs must never crash a dispatch on bad data. A
 * missing or non-array `rungs` contributes nothing; a non-string rung value
 * is skipped rather than producing an `<role>-undefined` phantom that no
 * check could act on.
 * @param {string} role
 * @param {RoleSpec} spec
 * @returns {string[]}
 */
export function rungAgents(role, spec) {
  const s = spec || {};
  const out = [];
  const push = (/** @type {string} */ name) => {
    if (name && !out.includes(name)) out.push(name);
  };
  // The base rung always yields the unsuffixed name, including when
  // `base_effort` is absent - agentForRung would return `role` there anyway.
  push(role);
  const rungs = Array.isArray(s.rungs) ? s.rungs : [];
  for (const r of rungs) {
    if (typeof r === 'string' && r) push(agentForRung(role, s, r));
  }
  if (typeof s.escalate_to === 'string' && s.escalate_to) {
    push(agentForRung(role, s, s.escalate_to));
  }
  return out;
}

/**
 * Problems in one role's OWN rung declaration - not on disk, which is
 * self-verify's job. Every `detail` begins with the role name, because the
 * caller files these against `cadence-core/route-table.json` and the role is
 * the only thing that locates them (AC4).
 *
 * Codes:
 *   `rung-not-declared`  `rungs` is absent/empty, or `base_effort` /
 *                        `escalate_to` is absent or outside `rungs`
 *   `unknown-rung`       a rung value outside `rungOrder`, or `rungOrder`
 *                        itself absent/empty
 *
 * When `rungOrder` is absent or empty nothing can be checked against it, so
 * one problem naming `rung_order` is returned INSTEAD of one per value - a
 * cascade would bury the single fix.
 * @param {string} role
 * @param {RoleSpec} spec
 * @param {string[]} [rungOrder]
 * @returns {Array<{code: string, detail: string}>}
 */
export function rungIssues(role, spec, rungOrder) {
  const s = spec || {};
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  const rungs = Array.isArray(s.rungs) ? s.rungs : null;
  const shown = rungs ? `[${rungs.join(', ')}]` : '(none)';

  if (!rungs || rungs.length === 0) {
    issues.push({ code: 'rung-not-declared', detail: `${role} declares no rungs array` });
  } else {
    if (s.base_effort === undefined || s.base_effort === null) {
      issues.push({ code: 'rung-not-declared', detail: `${role} has no base_effort` });
    } else if (!rungs.includes(s.base_effort)) {
      issues.push({ code: 'rung-not-declared',
        detail: `${role} base_effort "${s.base_effort}" is not in its own rungs ${shown}` });
    }
    if (s.escalate_to === undefined || s.escalate_to === null) {
      issues.push({ code: 'rung-not-declared', detail: `${role} has no escalate_to` });
    } else if (!rungs.includes(s.escalate_to)) {
      issues.push({ code: 'rung-not-declared',
        detail: `${role} escalate_to "${s.escalate_to}" is not in its own rungs ${shown}` });
    }
  }

  const order = Array.isArray(rungOrder) ? rungOrder : [];
  if (order.length === 0) {
    issues.push({ code: 'unknown-rung',
      detail: `${role} cannot be checked: rung_order is absent or empty` });
    return issues;
  }
  const seen = new Set();
  for (const v of [...(rungs || []), s.base_effort, s.escalate_to]) {
    if (typeof v !== 'string' || !v || seen.has(v)) continue;
    seen.add(v);
    if (!order.includes(v)) {
      issues.push({ code: 'unknown-rung',
        detail: `${role} names rung "${v}", which is not in rung_order [${order.join(', ')}]` });
    }
  }
  return issues;
}
