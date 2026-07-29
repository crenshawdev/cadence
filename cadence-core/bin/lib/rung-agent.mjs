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
 * The canonical BODY of a rung agent file: the rung line, then a pointer at
 * the contract it preloads. Stated here rather than inside self-verify for the
 * same reason the name mapping is - the check and the files it checks must
 * read ONE source, or they drift and the linter blesses the drift.
 * @param {string} rung the file's frontmatter `effort`
 * @param {string} skill the contract skill the file preloads
 * @returns {string}
 */
export function rungBody(rung, skill) {
  return `Your rung is \`${rung}\`.\n\n`
    + `Follow the preloaded \`${skill}\` skill exactly - it is your full\n`
    + 'contract. This file names that contract and your rung, and adds nothing else.\n';
}

/**
 * A body in whitespace-insensitive form, so re-wrapping a paragraph is free
 * and only a REWORD counts as a change. Comparing raw text would make the
 * line breaks load-bearing - a CI failure with no fix a maintainer would
 * think of.
 * @param {string} text
 * @returns {string}
 */
export function normalizeBody(text) {
  return String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Whether a rung file's body is anything other than the canonical template.
 *
 * An ALLOWLIST, deliberately, and this is the second attempt at the rule.
 * D-04 rejected a size-only check because a 200-byte behavioural instruction
 * fits under any weight budget - but so does a 200-byte instruction carrying
 * no contract section tag, so the tag denylist it chose instead had the same
 * hole: a rung file whose whole body is plain prose passed CI. A rung file has
 * exactly ONE legitimate body, so "is it that body" is the only rule that
 * matches what INTERNALS.md:11 claims - it refuses a rung file carrying any
 * instruction of its own, including a same-size REPLACEMENT of the pointer
 * paragraph, which no byte budget can see.
 *
 * The tag denylist stays in front of this in self-verify: when a body DOES
 * carry `<process>`, naming the tag is the more actionable message.
 *
 * A file declaring several skills passes if its body points at any ONE of
 * them - the template names a single contract, and nothing here rules out a
 * future multi-contract agent.
 *
 * @param {string} body the agent file's prose, frontmatter already stripped
 * @param {string} [rung] the file's frontmatter `effort`
 * @param {string[]} [skills] the file's declared `skills:` entries
 * @returns {null|{detail: string}} null when the body IS the template
 */
export function rungBodyIssue(body, rung, skills) {
  const found = normalizeBody(body);
  const declared = (Array.isArray(skills) ? skills : [])
    .filter((s) => typeof s === 'string' && s);
  const names = declared.length ? declared : ['<contract>'];
  const wanted = names.map((s) => normalizeBody(rungBody(rung || '', s)));
  if (wanted.includes(found)) return null;
  return { detail: `body is not the rung template - expected exactly ${JSON.stringify(wanted[0])}` };
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
 *   `rung-demotion`      `escalate_to` sits BELOW `base_effort` in
 *                        `rungOrder` - equal is legal and common
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

  // DIRECTION, which membership cannot see: `escalate_to` may sit at or above
  // `base_effort`, never below. Equal is the shipped default for five of six
  // roles (D-03/D-07 held today's escalation verbatim), so only a strict
  // demotion fires. Without this a data-only edit makes a FAILURE RETRY
  // re-dispatch at lower effort while route.mjs still reports
  // `escalated: true` - the retry thinks less, and says it thought more.
  // route.mjs stays fail-open and does not re-check this (D-03); CI is where
  // a bad table is supposed to die.
  const bi = order.indexOf(s.base_effort);
  const ei = order.indexOf(s.escalate_to);
  if (bi >= 0 && ei >= 0 && ei < bi) {
    issues.push({ code: 'rung-demotion',
      detail: `${role} escalate_to "${s.escalate_to}" is BELOW base_effort "${s.base_effort}" in rung_order [${order.join(', ')}]` });
  }
  return issues;
}
