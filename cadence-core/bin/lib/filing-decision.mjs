// @ts-check
// filing-decision.mjs - the pure, testable core of the FILING question (CAP-01,
// CAP-02): when a gate will not fix a finding now, which findings reach the
// user's ask and how is each one recognized again on a later fire.
//
// Zero-dep in the sense lib/forge-decision.mjs states it (node builtins only),
// and it uses exactly one - `node:crypto`'s `createHash`, for the fingerprint
// below. It never touches the filesystem, never spawns anything, never emits
// and never reads `process`: bin/issue-filing.mjs supplies the live readings
// and the triage prose asks the question. Same discipline as
// lib/forge-decision.mjs and lib/issue-decision.mjs - unknown or missing input
// never throws.
//
// THE PAYLOAD IS THE ONLY INPUT, AND THAT IS THE POINT (criterion 2). The set
// that reaches the ask is read off the STRUCTURED adjudication payload - the
// same `{voices: [...]}` object `planning.mjs adjudication --payload` already
// takes - and never re-parsed out of `REVIEW-<trigger>-<discriminator>.md`
// prose. No function here accepts prose at all, so "the ask follows the
// payload" is a property of the signature rather than a promise in a comment:
// there is no argument a caller could hand a REVIEW file's bytes to.
//
// AND THE ENTRIES ARE `buildEntries`'S, NOT A SECOND WALK. lib/adjudication-
// record.mjs already validates the payload, pairs every finding with its
// ruling and refuses every malformed shape by name. Walking `payload.voices`
// again here would be a second reader of one grammar - the split-brain
// lib/lease-grammar.mjs exists to prevent - and it would disagree first about
// exactly the inputs that matter, the ones one reader rejects.
'use strict';

import { createHash } from 'node:crypto';
import { buildEntries } from './adjudication-record.mjs';

/**
 * The two raised severities a `blocking` gate HALTS over.
 *
 * Everything else is that arm's remainder - the findings it reports and moves
 * past - and the remainder is what this phase files rather than parks.
 */
export const HALTING_SEVERITIES = Object.freeze(['blocker', 'high']);

/**
 * The rulings that mean the adjudicator did NOT let the finding stand.
 * `RULINGS` in lib/adjudication-record.mjs has three values and these are the
 * two that are not `survived`; the name for the pair is that file's own word.
 */
export const NON_SURVIVOR_RULINGS = Object.freeze(['downgraded', 'refuted']);

/**
 * Every finding in `payload` that the gate will NOT fix now.
 *
 * TWO FIELDS DECIDE IT AND NOTHING ELSE: the entry's `ruling` and its RAISED
 * `severity`. An entry is in the set unless it `survived` at `blocker` or
 * `high` - that one is the thing the gate is halting over, so it is being
 * fixed, not filed. Which makes the set exactly criterion 1's three sources at
 * once: the blocking arm's below-blocker/high remainder, the adjudicated arm's
 * non-survivors, and any `recorded not fixed` disposition.
 *
 * The severity read is the RAISED one, which is the only one an entry carries -
 * a `downgraded` ruling records that the adjudicator lowered the finding and
 * does not restate a new level, so there is no second severity to pick the
 * wrong one of.
 *
 * A PAYLOAD `buildEntries` REFUSES COMES BACK AS A REFUSAL, never as an empty
 * set. "Nothing to ask about" and "this payload is unreadable" send the fire
 * down opposite paths - the first ends the step and the second must stop it -
 * and an empty array is what collapses them into the wrong one. The refusal
 * carries `buildEntries`'s own `detail`, which names the offending entry,
 * because a caller told only "bad payload" has to go and find it again.
 *
 * @param {unknown} payload the composed `{voices: [...]}` adjudication payload
 * @returns {{ok: true, detail: string, findings: Array<Record<string, any>>}
 *   | {ok: false, detail: string, findings: Array<Record<string, any>>}}
 */
export function unfixedFindings(payload) {
  const built = buildEntries(payload);
  if (!built.ok) return { ok: false, detail: built.detail, findings: [] };
  const findings = built.entries.filter((e) => !(
    e.ruling === 'survived' && HALTING_SEVERITIES.includes(e.severity)
  ));
  return { ok: true, detail: '', findings };
}

/**
 * How many hex characters of the digest a fingerprint token is.
 *
 * 16 characters is 64 bits. A collision means a NEW finding is mistaken for one
 * the user already declined and is never put to them again, so the number is
 * chosen against that consequence rather than for tidiness: at 2^16 declined
 * findings on one tracker - two orders of magnitude past the 163 this
 * repository filed in its largest single sweep - the birthday probability of
 * any collision is under 2.4e-10. The full 64-character digest buys nothing
 * measurable, and the token is carried in an ISSUE TITLE where a human reads it
 * beside the claim.
 */
export const FINGERPRINT_CHARS = 16;

/** The join byte, written as the two-character escape rather than as itself:
 * self-verify check 15 refuses a literal U+0000 anywhere under
 * `cadence-core/bin/` (DFC-01), and this escape is that check's own remedy. */
const NUL = '\0';

/**
 * The `(file, claim)` fingerprint of a finding, as a fixed-width lowercase hex
 * token.
 *
 * `line` IS DELIBERATELY EXCLUDED. `convergenceKey` in
 * lib/adjudication-record.mjs joins the triple `(file, line, claim)` because it
 * is asking whether two voices raised the same thing in ONE fire, where the
 * line is stable by construction. A DECLINE outlives its fire: it is read back
 * on a later one, against a file that has been edited since, and a fingerprint
 * carrying the line forgets itself the moment the file shifts by one line -
 * which puts the same declined finding back in front of the user forever, the
 * exact loop criterion 11 removes.
 *
 * NUL-JOINED, the way `convergenceKey` joins its own triple: a separator that
 * cannot appear in a path or a claim, so `("a b", "c")` and `("a", "b c")`
 * cannot be made to digest alike by a value that contains the delimiter.
 *
 * NOTHING IS ADDED TO THE FINDING TO CARRY THIS. `findingIssue` in
 * lib/adjudication-record.mjs refuses any key outside `FINDING_KEYS`
 * (`file`, `line`, `severity`, `claim`, `failure_scenario`), so a `fingerprint`
 * field on a finding would make every existing adjudication payload and queue
 * member fail validation. It is DERIVED at each use and the disposition rides
 * BESIDE the finding, the way `RULING_KEYS` puts `ruling` beside `finding`.
 *
 * TOTAL over anything: a missing or non-string `file` or `claim` reads as the
 * empty string rather than throwing, so an unreadable finding fingerprints
 * consistently instead of taking the caller down.
 *
 * @param {unknown} finding anything carrying `file` and `claim`
 * @returns {string} `FINGERPRINT_CHARS` lowercase hex characters
 */
export function fingerprint(finding) {
  const f = finding && typeof finding === 'object' ? /** @type {any} */ (finding) : {};
  const str = (v) => (typeof v === 'string' ? v : '');
  return createHash('sha256')
    .update(`${str(f.file)}${NUL}${str(f.claim)}`)
    .digest('hex')
    .slice(0, FINGERPRINT_CHARS);
}
