// @ts-check
// shared-rule.mjs - the LSP-then-grep rule, held here so self-verify, the preload proof and the tests quote one string.
// It lives in skills/cad-shared-rules/SKILL.md and in no role contract, so changing how agents find code is one edit.
//
// The rule says "the LSP tool" in those words: self-verify's tools lint reads that as naming LSP, so a role that
// preloads the shared skill without LSP in its tools is caught there too.
//
// Pure lib: no fs, no emit, no imports. Both checks take their input as a value, so a test can hand them its own.
'use strict';

export const SHARED_RULE = 'When the LSP tool answers for a file\'s type, use it for definitions and references '
  + 'before grep. If it errors or comes back empty, use grep for the rest of the run.';

/** The skill that holds the rule, and that every role lists after its contract. */
export const SHARED_SKILL = 'cad-shared-rules';

/** The one problem code the skill check files. */
export const CODE = 'shared-skill-lacks-rule';

/**
 * Whether a text carries the rule, whitespace-collapsed so a rewrap changes nothing. Pure and total.
 * @param {string} text
 * @returns {boolean}
 */
export function carriesSharedRule(text) {
  return String(text).replace(/\s+/g, ' ').includes(SHARED_RULE);
}

/**
 * What each role of a rung table lacks: LSP in its tools and not denied, the shared skill in its skills, or the
 * shared skill after `<role>-contract`. Judges the table's contents, never a file against it. Pure and total.
 * @param {Record<string, {tools?: readonly string[], disallowedTools?: readonly string[], skills?: readonly string[]}>} table
 * @returns {{role: string, detail: string}[]}
 */
export function roleTableIssues(table) {
  /** @type {{role: string, detail: string}[]} */
  const out = [];
  for (const [role, row] of Object.entries(table || {})) {
    const tools = Array.isArray(row && row.tools) ? row.tools : [];
    const denied = Array.isArray(row && row.disallowedTools) ? row.disallowedTools : [];
    const skills = Array.isArray(row && row.skills) ? row.skills : [];
    if (!tools.includes('LSP')) out.push({ role, detail: `${role} lacks LSP in its tools` });
    // deny wins over grant, so a denied LSP is a lost one while the shared skill still says use it first
    else if (denied.includes('LSP')) out.push({ role, detail: `${role} denies LSP in its disallowedTools` });
    const shared = skills.indexOf(SHARED_SKILL);
    const contract = skills.indexOf(`${role}-contract`);
    if (shared === -1) {
      out.push({ role, detail: `${role} lacks ${SHARED_SKILL} in its skills` });
    } else if (contract === -1 || shared < contract) {
      out.push({ role, detail: `${role} does not list ${SHARED_SKILL} after ${role}-contract` });
    }
  }
  return out;
}
