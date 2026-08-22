// @ts-check
// file-transition.mjs - the ONE place under cadence-core/bin/ where an ordered
// list of steps is run and a record is kept of which ones completed and which
// failed (JRN-01).
//
// WHAT A MULTI-FILE TRANSITION IS. Several operations here change more than one
// file to move `.planning/` from one consistent state to another. `renumber`
// deletes a phase directory, `git mv`s the rest and then rewrites ROADMAP.md,
// REQUIREMENTS.md and STATE.md; `milestone-prune` removes or archives one
// directory per completed phase and then rewrites both documents. `atomicWrite`
// protects ONE file from torn bytes and cannot make several files change
// together, so every one of these can stop halfway and - before this module -
// each one carried its own hand-written loop and its own completed/failed
// bookkeeping. Four approximations of one rule is the defect; this is the rule.
//
// A REFUSAL PROTOCOL, NOT A JOURNAL (D-01). This does not write a journal, a
// marker, a lock or a temp path, and there is no replay and no resume. That is
// a decision against issue #145's ask, and the evidence is in the code the
// issue cites:
//
//   - `renumber remove` destroys `phases/<at>` before the first move runs, so
//     step one can never be undone. A journal could only ever advertise a
//     rollback this code does not have, and a caller who believes in it stops
//     hand-checking the tree - which is worse than a generic failure, and is
//     what the D-03 comment above `cmdRenumber`'s step list already says.
//   - `milestone-prune` is ALREADY resumable with zero on-disk state: it
//     recomputes its candidate set from ROADMAP and filters it by a
//     (label, artifact-origin) containment test over ARCHIVE.md. State on disk
//     would be a second, staler answer to a question the tree already answers.
//   - The fixture that actually produces `partial-apply` forces its failure by
//     chmod'ing the `.planning` ROOT to 0o555. A journal written under that
//     root fails EACCES FIRST, which would make `completed` empty and the
//     journal write itself the reported failure - reddening the very
//     assertions that pin the honest partial report.
//
// So the guarantee this offers is the other one: validate what CAN be
// pre-checked before the first step runs, refuse the transition WHOLE when a
// condition does not hold, and otherwise report exactly how far it got.
//
// THE ENVELOPE STAYS WITH THE CALLER (D-02). The result carries no `reason`, no
// `hint`, no `emit` and no exit code, because the two shipped callers' envelopes
// are structurally incompatible - `renumber` emits `{reason:'partial-apply',
// completed, failed:<op object>, detail, hint}` and `milestone-prune` emits
// `{reason:'partial-prune', action:'partial', failed:<number[]>, ...}` over a
// dozen more fields. Both deliberately bypass `fail()`. This returns a
// discriminated result and the caller renders it, the way
// `withPlanningFileLock` in lib/capture-file.mjs returns
// `{ok:true,value}|{ok:false,reason,detail}` for planning.mjs to render.
//
// NO I/O OF ITS OWN. Every filesystem touch and every spawn stays inside the
// caller's thunks, which is what lets `renumber` keep its `git rm`, `gitMv` and
// `atomicWrite` calls and `milestone-prune` keep its `rmSync`, `mkdirSync`,
// `lstatSync` and `renameSync` calls exactly where they already sit.
//
// TWO PROPERTIES ARE LOAD-BEARING, not incidental:
//   - Keys come back by IDENTITY, never copied and never normalized.
//     planning.test.mjs deep-equals `renumber`'s `completed` against op
//     OBJECTS, and a structural clone would satisfy that assertion while
//     quietly changing what the envelope carries downstream.
//   - A caught error is carried AS THROWN, never stringified in here.
//     `renumber` renders `e && e.message ? e.message : String(e)` into
//     `detail` while `milestone-prune` renders `e && e.message ? e.message : e`
//     into a warning sentence; both wordings have to stay reachable at their
//     own call sites.
'use strict';

/**
 * One step: the caller's own KEY - whatever that caller puts in its envelope,
 * an op object for `renumber` and a phase number for `milestone-prune` - paired
 * with a zero-argument thunk that performs the step.
 * @template K
 * @typedef {[K, () => void]} TransitionStep
 */

/**
 * What a run reports.
 *
 * `ok` is true only when every thunk ran without throwing. `refused` is the
 * description of the pre-flight condition that stopped the call, and `null`
 * otherwise - which is what distinguishes "nothing was attempted" from "a step
 * failed", a distinction `renumber`'s two-armed hint already has to make.
 * @template K
 * @typedef {object} TransitionResult
 * @property {boolean} ok
 * @property {string|null} refused
 * @property {K[]} completed keys whose thunk returned, in loop order
 * @property {Array<{key: K, error: any}>} failures keys whose thunk threw, in
 *   loop order, each carrying the value it threw
 */

/**
 * Run `steps` in order under `discipline`.
 *
 * `discipline` is D-03's two arms, and both callers keep the one they ship
 * with. `'stop-at-first-failure'` halts on the first throw, leaves the
 * remaining thunks unrun and records at most one failure - `renumber`, where a
 * half-applied tree makes every later step's plan wrong. `'continue-past-failure'`
 * attempts every thunk and collects the failures in loop order -
 * `milestone-prune`, which prunes the documents for the phases that did clear.
 *
 * A thunk's throw is caught. Anything else - a malformed step list, a thunk
 * that is not callable - propagates, the way a throw from `withPlanningFileLock`'s
 * `fn` propagates: this classifies a transition, it does not police its caller.
 * @template K
 * @param {{steps: Array<TransitionStep<K>>, discipline: 'stop-at-first-failure' | 'continue-past-failure'}} plan
 * @returns {TransitionResult<K>}
 */
export function runTransition({ steps, discipline }) {
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
      // The CONTINUE arm is the one that must be spelled exactly, so an
      // unrecognized discipline stops rather than runs on: fewer steps is the
      // safe direction when the caller's intent did not arrive intact.
      if (discipline !== 'continue-past-failure') break;
    }
  }
  return { ok: failures.length === 0, refused: null, completed, failures };
}
