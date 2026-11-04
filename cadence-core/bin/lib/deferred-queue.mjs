// @ts-check
// deferred-queue.mjs - the one statement of what a deferred gate fire leaves behind, and what that artifact is called
// a deferred gate runs its reviewer, persists the result and lets the run continue: the finding stops the land, not the run,
// so it has to still be there at land time in a form the refusal can name and a human can triage
// a committed file and not the trace: trace.jsonl is gitignored and `renderTrace` drops a phase's events at `uat_verdict complete`,
// so a trace-resident queue evaporates on a fresh clone and at sign-off while every in-session test stays green
// findings are stored verbatim, not counted: `/cad-milestone` prunes the phase directory, and a count whose bodies lived in a
// deleted REVIEW file names a number nobody can act on. They go through `findingIssue` so the shape matches what an adjudication accepts
// no ruling lives here, a finding with no ruling is a refusal and not a fourth ruling, so membership is this file existing
// with no superseding record beside it, never absence of a record alone (an advisory fire also leaves a REVIEW file with none)
// one flat return on both paths, never a JSDoc discriminated union: CI typecheck runs `strict: false`, where narrowing by a boolean literal doesn't happen
'use strict';

import { findingIssue } from './adjudication-record.mjs';
import { isPlainObject } from './text-util.mjs';

/**
 * A queue member's filename, built the way `recordName` builds the record's: same discriminator, same round suffix, different stem.
 * The stems differ because the two sit in one directory and mean opposite things, one saying a fire was judged and the other
 * that it wasn't. Sharing the round rule lets the supersession test be a filename comparison and not a second index.
 *
 * @param {string} trigger @param {string} discriminator @param {number} round
 */
export const queueName = (trigger, discriminator, round) =>
  `DEFERRED-${trigger}-${discriminator}${round > 1 ? `-r${round}` : ''}.json`;

/**
 * Classify the payload a deferred fire defers: the reviewer's own `{findings: [...]}` object, the same file the fire wrote to
 * the sibling REVIEW file.
 * An empty findings array is accepted and isn't the same as a clean gate: what a fire found is the reviewer's answer, and the
 * arm it settles at is the gate's decision. Refusing an empty member would decide the second from the first, and the run would
 * stall at a `deferred` gate whose panel came back with nothing.
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
  // the reviewer's own objects passed straight through: the caller writes what it's given, and a copy built field by field here would be the paraphrase the record beside it refuses
  return { ok: true, detail: '', findings };
}

/**
 * Is `name` a queue member's filename, whatever fire wrote it?
 * A prefix/suffix test and never a parse, because `DEFERRED-<trigger>-<discriminator>` can't be split back into its two tokens:
 * both admit `-`, so `DEFERRED-diff-plan-1.json` reads equally as trigger `diff` with discriminator `plan-1` and as trigger
 * `diff-plan` with discriminator `1`. A reader that guessed would resolve the wrong ADJUDICATION sibling and report a settled
 * fire as queued or a queued one as settled. So the identity comes off the member's own fields, and `queueIdentity` closes the
 * loop by rebuilding this name from them.
 *
 * @param {unknown} name one directory-entry name
 * @returns {boolean}
 */
export const isQueueName = (name) => typeof name === 'string'
  && name.startsWith('DEFERRED-') && name.endsWith('.json')
  && name.length > 'DEFERRED-.json'.length;

/**
 * Classify one candidate queue file: the name it's filed under and the value its bytes parsed to.
 * The name is rebuilt and compared because it's the only rail tying a member's contents to its filename, and the
 * caller's supersession test is a filename comparison built from these fields. Without it a member whose `trigger`
 * said `diff` under another trigger's name would be cleared by an adjudication of a fire it doesn't belong to, the
 * queue silently emptying itself, the one failure a land refusal can't survive.
 * A malformed member isn't a skip: the caller lists it as unreadable and refuses the land, because an unprovable
 * queue isn't an empty one, and an unreadable file wearing this name is evidence a fire was deferred.
 * Findings are counted and their bodies not returned, so reviewer text never rides a path with no file transport.
 *
 * @param {unknown} name the directory-entry name the value was read from
 * @param {unknown} parsed the file's parsed JSON
 * @returns {{ok: boolean, detail: string, phase: string, trigger: string,
 *            discriminator: string, round: number, findings: number}}
 */
export function queueIdentity(name, parsed) {
  const no = (/** @type {string} */ detail) => ({
    ok: false, detail, phase: '', trigger: '', discriminator: '', round: 0, findings: 0,
  });
  if (!isPlainObject(parsed)) return no('queue member is not a JSON object');
  const { phase, trigger, discriminator, round, findings } = parsed;
  for (const [k, v] of [['phase', phase], ['trigger', trigger], ['discriminator', discriminator]]) {
    if (typeof v !== 'string' || v.trim() === '') {
      return no(`queue member .${k} must be a non-blank string`);
    }
  }
  // the same bound fireIdentity applies at the write face; a round below 1 or a fractional one names a file queueName never mints
  if (!Number.isSafeInteger(round) || round < 1) {
    return no('queue member .round must be an integer of at least 1');
  }
  // the bodies were validated at the write face, and re-checking would block every land on a member that failed a later tightening of that shape
  if (!Array.isArray(findings)) return no('queue member .findings must be an array');
  const spelled = queueName(trigger, discriminator, round);
  if (spelled !== name) {
    return no(`queue member is filed as ${name} but its own fields spell ${spelled}`);
  }
  return { ok: true, detail: '', phase, trigger, discriminator, round, findings: findings.length };
}
