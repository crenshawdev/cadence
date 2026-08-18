// @ts-check
// window-budget.mjs - the pure rule behind the `planning.mjs trace window`
// report (MSR-03): given the paired `brackets` rows a trace render produced and
// a role-to-ceiling map, say which dispatches ran a larger context window than
// their role's ceiling allows. The disk half - locating `.planning/trace.jsonl`,
// rendering it, resolving the ceilings out of the merged config and wrapping
// the answer in the seam's one JSON line - lives in `planning.mjs`, the same
// split lib/config-reach.mjs, lib/deferred-reads.mjs and lib/merge-warnings.mjs
// use.
//
// WHAT THE BUDGETED QUANTITY IS. The `tokens` on a bracket row is the figure the
// dispatch's TERMINAL lifecycle event carried - the number the host reported on
// that subagent's return - and it is read here as a FINAL-WINDOW PROXY: roughly
// how large that dispatch's context window had grown by the time it came back.
// It is NOT a sum across the dispatch's turns, and nothing in this repo records
// one. `cadence-core/references/seams.md` states the provenance, argues the
// defaults and says why no capture path was added to get a truer number;
// nothing about it is restated here.
//
// IT REPORTS AND NEVER REFUSES. A crossing is a finding about a run that has
// already finished. Nothing on the dispatch path reads a ceiling, and nothing
// in the spawn seam could resize or cancel a dispatch already running even if it
// did - which is the same sentence that got the wall-clock timeout key deleted
// in v2.7.0. So the output of this rule is problems, never a verdict a caller is
// meant to halt on.
//
// A CEILING, NOT AN EQUALITY. A row UNDER its ceiling is silent and there is no
// shrink arm, exactly as self-verify.mjs's prose-budget check states in its own
// header: growth is the risk a budget exists to catch, and a dispatch that cost
// less than its ceiling needs no gate. A row exactly AT its ceiling is under it.
//
// NOTHING IS PRICED AS ZERO, AND NOTHING IS SKIPPED. Two rows cannot be
// compared at all: one whose role has no ceiling, and one whose terminal
// carried no token figure. Both are COUNTED and returned beside the problems,
// the same distinction lib/trace.mjs's per-role `unrecorded` counter already
// makes between "spent nothing" and "reported nothing". Silently skipping
// either would let a role drop out of the report by having no key, and pricing
// either at zero would report a dispatch nobody measured as the cheapest one in
// the run.
//
// Pure rule: no disk, no emit, no exit, no Date, no randomness. The caller owns
// the walk and the envelope.
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // Deliberately the SAME kind self-verify.mjs's prose-surface budget check
  // files. One budget vocabulary across the two surfaces that have budgets, so
  // a reader who has seen one crossing can read the other without a second
  // grammar - and the detail's `<n> exceeds budget <m> by <d>` tail is that
  // check's, to the word.
  overrun: 'budget-overrun',
});

/** The counter key for a bracket whose row named no role at all. */
export const NO_ROLE = '(no role)';

/**
 * A ceiling this rule can compare against: a positive integer. Anything else -
 * absent, null, a string a hand-edited config.json left behind, a zero, a
 * fraction - means the role has NO usable ceiling, and its rows are counted as
 * unbudgeted rather than compared. Comparing against a string would let
 * `275285 > '200000'` decide a finding by JavaScript's coercion rules, and
 * treating a bad value as 0 would report every dispatch of that role as a
 * crossing.
 * @param {any} v
 * @returns {v is number}
 */
function usableCeiling(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * The role a bracket bills to, as a counter key. A row whose `role` is absent
 * or is not a non-empty string keys on `NO_ROLE` rather than on the empty
 * string, so an unbudgeted-role count reads as a sentence in a report.
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
 * Every bracket row measured against its role's ceiling.
 *
 * EACH ROW LANDS IN EXACTLY ONE BUCKET - crossed, silently under, unbudgeted or
 * unrecorded - so `compared + unrecorded + sum(unbudgeted)` is the row count and
 * a reader can tell how much of the record the report actually saw. The role
 * test runs FIRST: a row whose role carries no ceiling cannot be compared
 * whatever its token figure, so counting it as unrecorded as well would
 * double-count one row under two different absences.
 *
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
    // The bracket's IDENTITY, not just its role: one role runs many dispatches
    // in a milestone, and a crossing nobody can locate in the record is a
    // number rather than a finding. The tail is self-verify's own wording.
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
