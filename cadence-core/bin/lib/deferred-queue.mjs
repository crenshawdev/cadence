// @ts-check
// deferred-queue.mjs - the one statement of what a deferred gate fire leaves behind, and what that artifact is called
// a deferred gate lets the run continue, so the finding has to still be there at land time
// a committed file, not the trace: trace.jsonl is gitignored and drops a phase's events at `uat_verdict complete`
// findings are stored verbatim: `/cad-milestone` prunes the phase dir, and a bare count is nothing to act on
// membership is this file existing with no superseding record beside it
// one flat return, no JSDoc union: CI typecheck runs `strict: false`, so narrowing doesn't happen
'use strict';

import { findingIssue } from './adjudication-record.mjs';
import { isPlainObject } from './text-util.mjs';

/**
 * A queue member's filename, built the way `recordName` builds the record's: same discriminator and round.
 * The stems differ because the two share a directory and mean opposite things: judged, and not judged.
 *
 * @param {string} trigger @param {string} discriminator @param {number} round
 */
export const queueName = (trigger, discriminator, round) =>
  `DEFERRED-${trigger}-${discriminator}${round > 1 ? `-r${round}` : ''}.json`;

/**
 * Classify the payload a deferred fire defers: the reviewer's own `{findings: [...]}` object.
 * An empty array is accepted and is not a clean gate: refusing it would decide the gate's arm from the findings,
 * and the run would stall at a `deferred` gate whose panel came back empty.
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
  // pass the reviewer's objects straight through: a field-by-field copy is the paraphrase the record refuses
  return { ok: true, detail: '', findings };
}

/**
 * Is `name` a queue member's filename, whatever fire wrote it?
 * A prefix/suffix test and never a parse: `DEFERRED-diff-plan-1.json` reads as trigger `diff` with discriminator
 * `plan-1` and as `diff-plan` with `1`, since both tokens admit `-`. Identity comes off the member's own fields,
 * and `queueIdentity` closes the loop by rebuilding this name from them.
 *
 * @param {unknown} name one directory-entry name
 * @returns {boolean}
 */
export const isQueueName = (name) => typeof name === 'string'
  && name.startsWith('DEFERRED-') && name.endsWith('.json')
  && name.length > 'DEFERRED-.json'.length;

/**
 * Classify one candidate queue file: the name it's filed under and the value its bytes parsed to.
 * The name is rebuilt and compared because it's the only rail tying contents to filename: without it a member whose
 * `trigger` said `diff` under another trigger's name would be cleared by that trigger's adjudication.
 * A malformed member isn't a skip: the caller lists it as unreadable and refuses the land, since an unprovable queue
 * isn't an empty one.
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
  // the bound fireIdentity applies at the write face: a round below 1 or a fractional one names a file nothing mints
  if (!Number.isSafeInteger(round) || round < 1) {
    return no('queue member .round must be an integer of at least 1');
  }
  // validated at the write face, and re-checking would block every land on a member that failed a later tightening
  if (!Array.isArray(findings)) return no('queue member .findings must be an array');
  const spelled = queueName(trigger, discriminator, round);
  if (spelled !== name) {
    return no(`queue member is filed as ${name} but its own fields spell ${spelled}`);
  }
  return { ok: true, detail: '', phase, trigger, discriminator, round, findings: findings.length };
}
