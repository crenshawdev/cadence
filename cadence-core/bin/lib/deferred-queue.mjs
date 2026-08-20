// @ts-check
// deferred-queue.mjs - the ONE statement of what a DEFERRED gate fire leaves
// behind, and the ONE rule for what that artifact is called.
//
// WHAT IT IS FOR. A gate resolved `deferred` runs its reviewer, persists what
// came back and lets the run continue: the finding stops the LAND, not the RUN.
// That only holds if the finding is still there at land time, in a form the
// refusal can name and a human can triage. This module states the shape of that
// queue member, and the seam that writes it (`planning.mjs deferred record`)
// owns every decision that touches the world.
//
// WHY A COMMITTED FILE AND NOT THE TRACE (CONTEXT D-01). `.planning/trace.jsonl`
// is gitignored, and `renderTrace` drops a phase's events at its `uat_verdict
// complete` - so a trace-resident queue evaporates on a fresh clone and again at
// sign-off, while every in-session test stays green. The queue member is a file
// beside the sibling `REVIEW-<trigger>-<discriminator>.md`, and it is COMMITTED,
// which the REVIEW file is not.
//
// WHY THE FINDINGS ARE STORED VERBATIM AND NOT COUNTED. `/cad-milestone` prunes
// the phase directory, and the queue has to survive that with enough in it to
// triage: a member holding a count whose bodies lived only in a deleted REVIEW
// file names a number nobody can act on. The bytes stored are the reviewer's
// own, validated through `findingIssue` in lib/adjudication-record.mjs so the
// shape a queue member holds is exactly the shape an adjudication record would
// accept for it later.
//
// NO RULING LIVES HERE (CONTEXT D-09). `RULINGS` is frozen at three values and
// a finding with no ruling is a REFUSAL, not a fourth ruling - so a deferred
// fire writes no `ADJUDICATION-*.json` at all, and its members read as unruled
// until a real adjudication supersedes them. Membership is this file existing
// with no superseding record beside it, never absence-of-record alone: every
// advisory fire also leaves a REVIEW file with no record.
//
// Pure in the sense lib/adjudication-record.mjs and lib/report-rotation.mjs
// are - classify, never emit, no fs, no git, no env, no process, no randomness.
// It takes no CONTRACTS row and no CLI entry point, for the reason
// self-verify.mjs check 14 states about `lib/*.mjs`: they are modules prose
// never invokes.
//
// ONE FLAT RETURN ON BOTH PATHS, never a JSDoc discriminated union: this repo's
// CI typecheck runs `strict: false`, where narrowing a union by its boolean
// literal does not happen, so the union costs every caller a cast. The reason
// is `resolveRange`'s in planning.mjs, and this follows it.
'use strict';

import { findingIssue } from './adjudication-record.mjs';

/**
 * A JSON object, as opposed to null, an array or a scalar.
 *
 * Declared as a TYPE PREDICATE rather than a plain boolean for the reason
 * lib/adjudication-record.mjs states about its own: `buildQueue` takes
 * `unknown`, and without the predicate the guard narrows to `object` and every
 * field read past it is a TS2339 under this repo's `checkJs` CI typecheck
 * (measured).
 *
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A queue member's filename, built the way `recordName` builds the record's -
 * same discriminator, same round suffix, different stem.
 *
 * The stems have to differ: the two artifacts sit in ONE directory and mean
 * opposite things, one saying a fire was judged and the other saying it was
 * not. Sharing the round rule is what lets the supersession test be a filename
 * comparison rather than a second index - round 2's queue member is superseded
 * by round 2's record and by nothing else.
 *
 * @param {string} trigger @param {string} discriminator @param {number} round
 */
export const queueName = (trigger, discriminator, round) =>
  `DEFERRED-${trigger}-${discriminator}${round > 1 ? `-r${round}` : ''}.json`;

/**
 * Classify the payload a deferred fire defers: the reviewer's own
 * `{findings: [...]}` object, the SAME file the fire wrote to the sibling
 * `REVIEW-<trigger>-<discriminator>.md`.
 *
 * An EMPTY findings array is accepted and is not the same thing as a clean
 * gate: what a fire found is the reviewer's answer, and the arm a fire settles
 * at is the gate's decision. A seam that refused an empty queue member would be
 * deciding the second question from the first, and the run would stall at a
 * `deferred` gate whose panel happened to come back with nothing.
 *
 * @param {unknown} payload
 * @returns {{ok: boolean, detail: string, findings: any[]}} `ok: false` names
 *   the finding and the rule it broke, in `buildEntries`' own words.
 */
export function buildQueue(payload) {
  const no = (/** @type {string} */ detail) => ({ ok: false, detail, findings: [] });
  if (!isPlainObject(payload)) return no('payload is not a JSON object');
  for (const k of Object.keys(payload)) {
    if (k !== 'findings') {
      return no(`payload carries an unknown key: ${k} - it must be the {findings: [...]} `
        + 'object the reviewer returned and nothing else');
    }
  }
  const findings = payload.findings;
  if (!Array.isArray(findings)) return no('payload.findings must be an array');
  for (let i = 0; i < findings.length; i += 1) {
    const issue = findingIssue(findings[i], `payload.findings[${i}]`);
    if (issue) return no(issue);
  }
  // The reviewer's own objects, passed straight through: the caller writes what
  // it is given, so a copy built field by field here would be the paraphrase
  // the record beside it refuses.
  return { ok: true, detail: '', findings };
}
