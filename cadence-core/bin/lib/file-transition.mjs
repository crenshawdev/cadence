// @ts-check
// file-transition.mjs - the one place under cadence-core/bin/ that runs an ordered list of steps and records which
// completed and which failed. renumber and milestone-prune both change several files to move `.planning/` between
// consistent states, atomicWrite only protects one, and each used to carry its own loop and bookkeeping.
// A refusal protocol, not a journal. `renumber remove` destroys `phases/<at>` before its first move, so step one can't be
// undone and a journal could only advertise a rollback that doesn't exist; milestone-prune already resumes with no disk state.
// So: refuse the whole transition if a pre-flight condition fails, otherwise report exactly how far it got.
// Conditions are the caller's, in its order. This module declares none and probes no filesystem, because EACCES, ENOTEMPTY
// and the git spawns can't be pre-checked, and a refusal promise it can't keep would talk callers out of checking the tree.
// The envelope stays with the caller, who renders the result. No I/O of its own, and keys and caught errors come back as
// given (identity, as thrown): planning.test.mjs deep-equals op objects, and each caller words its own error.
'use strict';

/**
 * One step: the caller's own key (an op object for `renumber`, a phase number for `milestone-prune`) paired with a
 * zero-argument thunk that performs it.
 * @template K
 * @typedef {[K, () => void]} TransitionStep
 */

/**
 * What a run reports. `ok` is true only when every thunk ran without throwing. `refused` is the pre-flight condition that
 * stopped the call, else `null`, which is how "nothing was attempted" differs from "a step failed".
 * @template K
 * @typedef {object} TransitionResult
 * @property {boolean} ok
 * @property {string|null} refused
 * @property {K[]} completed keys whose thunk returned, in loop order
 * @property {Array<{key: K, error: any}>} failures keys whose thunk threw, in
 *   loop order, each carrying the value it threw
 */

/**
 * One pre-flight condition: something the caller can check before the first thunk runs, with the description that names it in a refusal.
 * @typedef {object} PreflightCondition
 * @property {string} condition what must hold, as the refusal will report it
 * @property {() => boolean} satisfied evaluated lazily, and only until one
 *   answers false
 */

/**
 * Run `steps` in order under `discipline`, once every `preflight` condition holds.
 * Conditions are evaluated in the order given and the first unsatisfied one ends the call: no thunk runs, nothing is
 * written, and `refused` names it. Later conditions are never evaluated, so a cheap check ahead of an expensive one stays ahead.
 * `'stop-at-first-failure'` halts on the first throw and records at most one failure (renumber, where a half-applied tree
 * makes every later step's plan wrong). `'continue-past-failure'` attempts every thunk and collects failures in loop order
 * (milestone-prune, which prunes the documents for the phases that did clear).
 * A thunk's throw is caught. A malformed step list or a non-callable thunk propagates: this classifies a transition, it
 * doesn't police its caller.
 * @template K
 * @param {{steps: Array<TransitionStep<K>>, discipline: 'stop-at-first-failure' | 'continue-past-failure', preflight?: PreflightCondition[]}} plan
 * @returns {TransitionResult<K>}
 */
export function runTransition({ steps, discipline, preflight = [] }) {
  for (const { condition, satisfied } of preflight) {
    // Early return, not a collected verdict: evaluating the rest would break the ordering promise.
    if (!satisfied()) return { ok: false, refused: condition, completed: [], failures: [] };
  }
  /** @type {K[]} */
  const completed = [];
  /** @type {Array<{key: K, error: any}>} */
  const failures = [];
  for (const [key, run] of steps) {
    try {
      run();
      completed.push(key);
    } catch (error) {
      failures.push({ key, error });
      // Only the exact continue discipline continues, so an unrecognized one stops: fewer steps is the safe direction.
      if (discipline !== 'continue-past-failure') break;
    }
  }
  return { ok: failures.length === 0, refused: null, completed, failures };
}
