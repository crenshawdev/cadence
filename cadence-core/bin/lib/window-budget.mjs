// @ts-check
// window-budget.mjs - the pure rule behind `planning.mjs trace window`: given the paired `brackets` rows of a trace
// render and a role-to-ceiling map, say which dispatches ran a bigger context window than their role's ceiling allows.
// The disk half lives in planning.mjs.
// The budgeted `tokens` is the figure the host reported on the subagent's return: a final-window proxy, not a sum
// across turns.
// It reports and never refuses: a crossing is a finding about a run that already finished, and nothing on the dispatch
// path reads a ceiling. At or under a ceiling is silent; there's no shrink arm.
// Nothing is priced as zero or skipped: rows with no role ceiling or no token figure are counted beside the problems,
// since zero would make an unmeasured dispatch the cheapest.
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // The same kind self-verify.mjs's prose-surface budget check files: one budget vocabulary across both, with that
  // check's `<n> exceeds budget <m> by <d>` detail tail.
  overrun: 'budget-overrun',
});

/** The counter key for a bracket whose row named no role at all. */
export const NO_ROLE = '(no role)';

/**
 * A ceiling this rule can compare against: a positive integer. Anything else (absent, null, a hand-edited string, zero,
 * a fraction) means no usable ceiling and the role's rows are counted as unbudgeted. Comparing a string would let
 * JavaScript's coercion decide a finding, and treating a bad value as 0 would report every dispatch of that role as a
 * crossing.
 * @param {any} v
 * @returns {v is number}
 */
function usableCeiling(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * The role a bracket bills to, as a counter key. An absent or non-string role keys on `NO_ROLE` and not the empty
 * string, so an unbudgeted count reads as a sentence in a report.
 * @param {any} v
 */
function roleKey(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : NO_ROLE;
}

/**
 * @typedef {object} WindowBudgetResult
 * @property {{kind: string, file: string, detail: string}[]} problems one per
 *   crossing, in the order the brackets were given
 * @property {Record<string, number>} unbudgeted rows whose role has no usable
 *   ceiling, counted per role
 * @property {number} unrecorded rows whose terminal carried no token figure
 * @property {number} compared rows that were actually measured against a
 *   ceiling - the denominator every other figure here is a complement of
 */

/**
 * Every bracket row measured against its role's ceiling. Each row lands in exactly one bucket (crossed, silently under,
 * unbudgeted or unrecorded), so `compared + unrecorded + sum(unbudgeted)` is the row count and a reader can tell how
 * much of the record the report saw. The role test runs first: a row whose role has no ceiling can't be compared
 * whatever its token figure, so also counting it as unrecorded would double-count one row.
 * @param {string} file the record the rows were read from, carried onto every
 *   problem so a crossing names its own source the way self-verify's budget
 *   problems name the surface
 * @param {any} brackets the `brackets` array of a trace render
 * @param {any} ceilings role -> token ceiling
 * @returns {WindowBudgetResult}
 */
export function windowBudget(file, brackets, ceilings) {
  /** @type {{kind: string, file: string, detail: string}[]} */
  const problems = [];
  /** @type {Record<string, number>} */
  const unbudgeted = {};
  let unrecorded = 0;
  let compared = 0;

  const rows = Array.isArray(brackets) ? brackets : [];
  const map = ceilings !== null && typeof ceilings === 'object' ? ceilings : {};
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue;
    const role = roleKey(row.role);
    const ceiling = role === NO_ROLE ? undefined : map[role];
    if (!usableCeiling(ceiling)) {
      unbudgeted[role] = (unbudgeted[role] || 0) + 1;
      continue;
    }
    const tokens = row.tokens;
    if (typeof tokens !== 'number' || !Number.isFinite(tokens)) {
      unrecorded += 1;
      continue;
    }
    compared += 1;
    if (tokens <= ceiling) continue;
    // The bracket's identity, not just its role: one role runs many dispatches in a milestone, and a crossing nobody
    // can locate in the record is a number, not a finding. The tail is self-verify's wording.
    const where = `corr ${row.corr ?? '-'}, phase ${row.phase ?? '-'}, `
      + `plan ${row.plan ?? '-'}, ${row.event ?? '-'} at ${row.ts ?? '-'}`;
    problems.push({
      kind: CODES.overrun,
      file: typeof file === 'string' ? file : '',
      detail: `${role} (${where}): ${tokens} exceeds budget ${ceiling} by ${tokens - ceiling}`,
    });
  }
  return { problems, unbudgeted, unrecorded, compared };
}
