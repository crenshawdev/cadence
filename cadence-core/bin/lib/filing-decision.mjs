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
 *
 * THE REMAINDER IS NOW RECORDABLE AS WHAT IT IS. A `survived` finding raised
 * BELOW this pair is one that was confirmed and NOT fixed, carrying no commit
 * id because none exists, and lib/adjudication-record.mjs stores that entry
 * rather than refusing it. Before it could, the only way to write the
 * remainder down was to DOWNGRADE the finding, which records "the adjudicator
 * lowered it" over "it stood and nobody fixed it" - so the set this module
 * returns and the record the same fire writes now say the same thing about the
 * same findings.
 */
export const HALTING_SEVERITIES = Object.freeze(['blocker', 'high']);

/**
 * The rulings that mean the adjudicator did NOT let the finding stand.
 * `RULINGS` in lib/adjudication-record.mjs has three values and these are the
 * two that are not `survived`; the name for the pair is that file's own word.
 */
export const NON_SURVIVOR_RULINGS = Object.freeze(['downgraded', 'refuted']);

/**
 * What a `fix_commit` has to LOOK like before this module reads it as work
 * that is already committed: an abbreviated id through a full one, the range
 * an auditor can hand to `git show`.
 *
 * Carried as this module's own copy of lib/adjudication-record.mjs's
 * `FIX_COMMIT`, which that file does not export, and PINNED against it by
 * adjudication-record.test.mjs - one value table driven through `buildEntries`
 * and through `usableFixCommit`, asserting the two accept and refuse the same
 * members. Same hand-maintained-then-compared shape `HALTING_SEVERITIES` above
 * already carries against the same file, for the same reason: the test is what
 * stops the two drifting.
 */
const FIX_COMMIT = /^[0-9a-fA-F]{7,40}$/;

/**
 * Whether `value` is a fix commit this module will read as a landed fix.
 *
 * WHY THE SHAPE IS CHECKED HERE AT ALL, when lib/adjudication-record.mjs
 * already refuses a malformed value at composition time: the set that rests on
 * this answer is `halting`, and `halting` is the rail over records that module
 * NEVER validated - one another tool wrote, one a person hand-edited, one older
 * than the requirement. A composition-time check cannot reach input that never
 * went through composition, so treating any non-blank string as proof of a fix
 * hands the fail-closed rail its own defeat: `fix_commit: 'not-a-commit'` on an
 * unoverridden blocker that stood would read as fixed, all three sets would
 * come back empty, and the close a person should have been stopped at would
 * proceed. A blank string is the same defeat spelled shorter.
 *
 * IT IS A SHAPE CHECK AND DELIBERATELY NOTHING MORE. Nothing here asks git
 * whether the object exists - this module never does I/O - so a well-formed id
 * naming no commit still reads as usable. What the check buys is the
 * separation a rail actually needs: a commit id from a sentence.
 *
 * @param {unknown} value an entry's `fix_commit`, or whatever stood in for one
 * @returns {boolean}
 */
export const usableFixCommit = (value) => typeof value === 'string' && FIX_COMMIT.test(value);

/**
 * The ONE statement of what a record's entries mean to a fire that is settling:
 * which of them reach the user's ask, which cleared halt a caller has to see,
 * and which of them STOP a close.
 *
 * Takes the ENTRIES rather than the payload: the array `buildEntries` returns,
 * which is byte-for-byte the array a written `ADJUDICATION-*.json` stores, so a
 * reader holding only the record on disk asks the same question the composer
 * asks over the payload. `unfixedFindings` below is the payload face and is a
 * wrapper over this one - the meaning lives HERE, once, because a second
 * statement of it is the drift a downstream halt decision would be resting on.
 *
 * FOUR FIELDS DECIDE ALL THREE ANSWERS AND NOTHING ELSE: the entry's `ruling`,
 * its RAISED `severity`, the `overridden` marker, and `fix_commit`. All three
 * sets are answered in ONE pass, so no two of them can disagree about one
 * entry, and every entry lands in at most one disposition.
 *
 * A USABLE `fix_commit` IS ASKED FIRST AND ENDS THE QUESTION (CONTEXT D-04,
 * D-05). An entry naming one is FIXED, and a fixed entry is in NONE of the
 * three sets: the work is committed, so there is nothing to put to a user,
 * nothing for a person to have cleared, and nothing for a close to stop over.
 * That holds even when the same entry ALSO carries `overridden: true` - the
 * schema permits both on one entry, since lib/adjudication-record.mjs refuses
 * only when NEITHER is present, and leaving the precedence to the ORDER of two
 * filters is how one entry becomes a permanent unfixed override at every close.
 * The exclusion used to live one layer up, at bin/issue-filing.mjs's own face,
 * so the gate deciding a close and the face filing issues held two spellings of
 * one meaning; this is where that split ends.
 *
 * USABLE MEANS THE VALUE COULD BE A COMMIT ID, which `usableFixCommit` above
 * decides and states its reason for. A non-blank string is not enough here,
 * and that is not a second validator: the set this answer gates is `halting`,
 * which exists only over records lib/adjudication-record.mjs never saw.
 * This module's stated discipline is unchanged - an unusable value is not an
 * error and nothing throws over it, it is simply not a fix.
 *
 * `filing` IS WHAT THIS FIRE WILL NOT FIX NOW, which is what reaches the user's
 * ask: every entry except a fixed one and except the unfixed survivor a
 * blocking gate is halting over. Which makes the set exactly criterion 1's
 * three sources at once: the blocking arm's below-blocker/high remainder, the
 * adjudicated arm's non-survivors, and any `recorded not fixed` disposition.
 *
 * `haltingSurvivors` IS THE SUBSET A PERSON CLEARED - ruled `survived` at
 * `blocker` or `high`, carrying no commit, marked `overridden: true`. It is
 * folded into `filing` as well as named here, because it is both things at
 * once: nobody is fixing it, and a caller settling the fire has to be able to
 * see on its own that this range's blocking halt was cleared by a human
 * decision rather than by committed work. `overridden` is read at all because
 * an override is the one surviving blocker nobody is fixing - the single case
 * where "stood at a halting severity" stops implying "a commit is coming".
 * Reading the ruling and the severity alone drops it from `filing` silently,
 * and silence is the worst answer available here: the finding is then never
 * fixed, never filed, never declined and never put to the user.
 *
 * `halting` IS THE FAIL-CLOSED RAIL, and it is not dead code even though a
 * VALID record can never hold one. An entry lands there when it is ruled
 * `survived` at `blocker` or `high`, is NOT overridden and cites no usable
 * commit - and `buildEntries` REFUSES exactly that shape at composition time,
 * so a record this tree wrote holds none of them and every ruled outcome
 * resolves to fixed, overridden, downgraded, refuted or below-halting. The set
 * is non-empty only over a record something else wrote, a person edited by
 * hand, or an artifact older than the requirement, which is precisely the input
 * a close has to stop on rather than read past. The name is deliberately not
 * `haltingSurvivors`: those two hold opposite dispositions of one shape,
 * cleared and uncleared, and two near-identical names for opposite answers is
 * the confusion this paragraph exists to prevent.
 *
 * The severity read is the RAISED one, which is the only one an entry carries -
 * a `downgraded` ruling records that the adjudicator lowered the finding and
 * does not restate a new level, so there is no second severity to pick the
 * wrong one of.
 *
 * A NON-ENTRY IS SKIPPED, never counted into any of the three sets.
 * `buildEntries` cannot produce one, so the wrapper below is unaffected; a
 * record read off disk can hold anything, and the discipline this module states
 * is that unknown input never throws. `deriveCounts` skips the same shape for
 * the same reason.
 *
 * @param {unknown} entries a built record's `entries[]`
 * @returns {{filing: Array<Record<string, any>>,
 *   haltingSurvivors: Array<Record<string, any>>,
 *   halting: Array<Record<string, any>>}}
 */
export function unfixedFromEntries(entries) {
  /** @type {Array<Record<string, any>>} */
  const filing = [];
  /** @type {Array<Record<string, any>>} */
  const haltingSurvivors = [];
  /** @type {Array<Record<string, any>>} */
  const halting = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    if (e === null || typeof e !== 'object' || Array.isArray(e)) continue;
    if (usableFixCommit(e.fix_commit)) continue;
    const stoodAtAHalt = e.ruling === 'survived' && HALTING_SEVERITIES.includes(e.severity);
    if (stoodAtAHalt && e.overridden !== true) { halting.push(e); continue; }
    filing.push(e);
    if (stoodAtAHalt) haltingSurvivors.push(e);
  }
  return { filing, haltingSurvivors, halting };
}

/**
 * Every finding in `payload` that the gate will NOT fix now.
 *
 * The PAYLOAD face of `unfixedFromEntries`: it validates and pairs through
 * `buildEntries`, then reads its set off that one statement rather than
 * restating the four-field test here. The returned array is the same array,
 * over the same data, that the entries face returns on `filing`.
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
  return { ok: true, detail: '', findings: unfixedFromEntries(built.entries).filing };
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

/**
 * The label a DECLINED finding's issue carries, and the only place a decline
 * persists.
 *
 * A FACT OF THE TABLE, exactly as `--private` is a fact of `CREATE_TABLE`'s
 * rows: one frozen literal, never a parameter, never a flag, never text a
 * caller derived. A caller that could choose it would put free text on a
 * command line, and could split the decline set in two by writing a second
 * spelling.
 *
 * NOTHING READS IT BACK ANY MORE. `LOOKUP` below used to be one list call
 * filtered by exactly this label; it is a title-scoped search now, because an
 * issue Cadence ACCEPTED never carries the label and was therefore invisible to
 * a label-filtered query (CONTEXT D-07). The label remains a fact of the CREATE
 * rows alone - written on a declined create, read by a human on the tracker.
 *
 * No colon, no `::`, no space. GitLab reads `::` as a SCOPED label with
 * mutual-exclusion semantics inside its scope, and a label a forge interprets
 * is a label whose behaviour differs per provider - which is the one thing a
 * shared literal may not do.
 */
export const DECLINE_LABEL = 'cadence-declined';

/**
 * The longest composed issue title this module will build.
 *
 * NOT a measured cap on any service, and it is not written as one: it is chosen
 * to sit well under every documented issue-title limit and to stay legible in a
 * list view, where the fingerprint prefix and the first line of the claim are
 * what a human scans. A claim longer than the remainder is CLIPPED, which
 * changes the title and never the fingerprint - the digest is taken over the
 * claim's own bytes, so a clipped title still recovers the token that a full
 * one would.
 */
const TITLE_MAX = 200;

/**
 * How many fingerprints one `lookup` query may carry.
 *
 * SIX, because six terms joined by ` OR ` is FIVE boolean operators, and five
 * is the ceiling GitHub's own search documentation states. Seven and eight
 * terms were measured working against `crenshawdev/cadence` on 2026-09-03
 * (`rc=0`, results growing monotonically), and the measurement is deliberately
 * NOT what this number is set from (CONTEXT D-09): a documented limit the index
 * begins enforcing later truncates a page silently, and a silent truncation on
 * this query re-files an issue that already exists. An extra round trip on a
 * fire with more than six accepts costs latency and nothing else.
 *
 * One number, exported, so the table's builders and `issue-filing.mjs`'s
 * chunking loop cannot disagree about how many a query holds.
 */
export const LOOKUP_CHUNK = 6;

/** The prefix that makes a title recognizable as a Cadence filing, and the
 * capture that recovers its fingerprint. One spelling, used to WRITE by
 * `issueTitle` and to READ by `fingerprintInTitle`, so the two cannot drift. */
const TITLE_PREFIX = 'cadence';
const TITLE_TOKEN = new RegExp(`^\\[${TITLE_PREFIX} ([0-9a-f]{${FINGERPRINT_CHARS}})\\] `);

/** One line: newlines and runs of whitespace collapse to single spaces, because
 * a title with an embedded newline is a title whose tail no list view shows and
 * whose second line a title reader never sees. Flatten on write, never trust
 * the caller - the discipline `appendArchiveRows` states for the same reason. */
const flatten = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * The issue TITLE for a finding: the fingerprint token, then the claim.
 *
 * The token is in the title rather than in the body because the title is the
 * only field the lookup can ask all three CLIs for in one bounded list
 * call - `gh --json number,title`, `glab --output json` and `tea --fields
 * index,title` - and reading a body back would be one call per issue, which is
 * the per-finding query criterion 11 forbids.
 *
 * @param {unknown} finding @returns {string}
 */
export function issueTitle(finding) {
  const f = finding && typeof finding === 'object' ? /** @type {any} */ (finding) : {};
  const head = `[${TITLE_PREFIX} ${fingerprint(finding)}] `;
  const claim = flatten(f.claim) || '(no claim)';
  return (head + claim).slice(0, TITLE_MAX);
}

/**
 * The fingerprint token an issue title carries, or `null` when it carries none.
 *
 * NULL IS NOT A FAILURE HERE. The decline lookup is filtered by
 * `DECLINE_LABEL`, and a label is something a human can apply by hand on any of
 * the three forges; an issue somebody labelled themselves is not a decline
 * record and has no token to find. So an unrecognized title is SKIPPED by the
 * normalizer below rather than failing the read - the opposite direction from a
 * missing `title` FIELD, which means the CLI's own output shape changed and
 * nothing about the response can be trusted.
 *
 * @param {unknown} title @returns {string|null}
 */
export function fingerprintInTitle(title) {
  if (typeof title !== 'string') return null;
  const m = TITLE_TOKEN.exec(title);
  return m ? m[1] : null;
}

/**
 * The issue BODY for a finding.
 *
 * Every row's argv supplies one, and that is a requirement rather than a
 * courtesy: `gh issue create` PROMPTS for a body when `--body` is absent
 * ("Supply a body. Will prompt for one otherwise.", gh 2.98.0) and `glab issue
 * create` opens an EDITOR without `--description`. Either one blocks a child
 * process inside a gate step forever.
 *
 * It carries the finding and nothing else: no CLI output, no envelope, no host
 * or login. `failure_scenario` is included because it is the half of a finding
 * that says why the claim matters, and an issue filed without it is the finding
 * with its argument removed.
 *
 * @param {unknown} finding @returns {string}
 */
export function issueBody(finding) {
  const f = finding && typeof finding === 'object' ? /** @type {any} */ (finding) : {};
  const at = `${flatten(f.file) || '(no file)'}:${Number.isSafeInteger(f.line) ? f.line : '?'}`;
  return [
    `Raised at ${at} as **${flatten(f.severity) || '(no severity)'}**`
      + `${f.voice ? ` by ${flatten(f.voice)}` : ''}`
      + `${f.ruling ? `, ruled ${flatten(f.ruling)}` : ''}.`,
    '',
    `**Claim.** ${flatten(f.claim) || '(no claim)'}`,
    '',
    `**Failure scenario.** ${flatten(f.failure_scenario) || '(none given)'}`,
    '',
    `Filed by Cadence. Fingerprint \`${fingerprint(finding)}\` over (file, claim).`,
  ].join('\n');
}

/**
 * One decline-lookup response -> the fingerprint tokens it carries, plus
 * whether the read is COMPLETE. Total: any input at all answers, and an
 * incomplete answer carries NO tokens.
 *
 * WRITTEN HERE RATHER THAN IMPORTED, and the two readers stay two on purpose.
 * `normalizeList` in lib/issue-decision.mjs reads `state` to answer whether an
 * issue is still open; this one reads `title` to recover a fingerprint. They
 * agree on the truncation RULE and on nothing else, and folding them would
 * either put a `title` requirement on the land-time report - which asks for
 * `number,state` and would start failing on every response - or make this one
 * demand a `state` it never uses. lib/issue-decision.mjs is a read-only face
 * this phase does not extend.
 *
 * A RESPONSE THAT FILLS ITS PAGE IS INCOMPLETE AND CARRIES NOTHING, exactly as
 * `normalizeList` decides it and for a consequence that is worse here: Forgejo
 * clamps `tea issues list` at 50 rows server-side whatever `--limit` asks, and
 * a truncated decline set read as the whole set puts findings the user already
 * declined back in front of them. The caller's answer to incomplete is to
 * REFUSE the fire (criterion 12), never to proceed on a partial page.
 *
 * A row that is not an object, or whose `title` is not a string, fails the
 * WHOLE read: a renamed or missing field means the CLI's output shape moved,
 * and nothing else in the response can be trusted either. A row whose title
 * carries no Cadence token is SKIPPED - see `fingerprintInTitle` for why those
 * two directions differ.
 *
 * `detail` is a fixed phrase, never a slice of the response: the bytes a forge
 * CLI prints are not this seam's to put in an envelope (CONTEXT D-16).
 *
 * @param {unknown} text the CLI's stdout
 * @param {number} limit the page size the argv asked for
 * @returns {{complete: boolean, fingerprints: string[], detail: string|null}}
 */
export function normalizeDeclines(text, limit) {
  const bad = (detail) => ({ complete: false, fingerprints: [], detail });
  if (typeof text !== 'string') return bad('response was not text');
  let parsed;
  try { parsed = JSON.parse(text); } catch { return bad('response was not JSON'); }
  if (!Array.isArray(parsed)) return bad('response was not a JSON array');
  /** @type {string[]} */
  const fingerprints = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') return bad('a row was not an object');
    const title = /** @type {Record<string, unknown>} */ (row).title;
    if (typeof title !== 'string') return bad('a row carried no readable title');
    const token = fingerprintInTitle(title);
    if (token !== null) fingerprints.push(token);
  }
  if (parsed.length >= limit) {
    return bad(`the response filled the ${limit}-row page and may be truncated`);
  }
  return { complete: true, fingerprints, detail: null };
}

/** An issue number however its CLI spells it, or null when the field carries no
 * readable one.
 *
 * `tea issues list` prints `index` as a STRING and gh prints `number` as a
 * NUMBER, both measured, so both shapes answer. Written here rather than
 * imported from lib/issue-decision.mjs for the reason `normalizeDeclines`
 * states about itself: that module is a read-only face this work does not
 * extend, and its own helper is not exported.
 *
 * POSITIVE, and outside the safe-integer range is no readable number. `0` is
 * not an issue on any of the three, and `9007199254740993` reads back as
 * `...992` - a number that names a DIFFERENT issue than the tracker holds,
 * which is the whole value of "this one already exists" gone.
 * @param {unknown} raw @returns {number|null} */
function issueNumber(raw) {
  const n = typeof raw === 'number' ? raw
    : (typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * One TITLE-SCOPED LOOKUP response -> the (fingerprint, issue number) pairs it
 * carries, plus whether the read is COMPLETE. Total: any input at all answers,
 * and an incomplete answer carries NOTHING.
 *
 * BESIDE `normalizeDeclines`, NOT A WIDENING OF IT (CONTEXT D-10). That one
 * answers `fingerprints: string[]` and drops the number, and its own header
 * states that its two readers stay two on purpose. The NUMBER is the thing this
 * one exists for: a fire that finds a fingerprint already on the tracker has to
 * report WHICH issue holds it, and no create face on any of the three CLIs
 * prints a machine-readable number, so the lookup is the only place one can
 * come from. Three readers now, each reading the field its own question needs.
 *
 * A RESPONSE THAT FILLS ITS PAGE IS INCOMPLETE AND CARRIES NOTHING, the rule
 * `normalizeDeclines` states and `normalizeList` in lib/issue-decision.mjs
 * shares. The consequence here is a create rather than an ask: a truncated page
 * read as the whole answer says "not filed" about an issue that is filed, and
 * the duplicate that follows is the defect this work exists to close.
 *
 * A row that is not an object, or whose `title` is not a string, fails the
 * WHOLE read - a renamed or missing field means the CLI's output shape moved.
 * A row whose title carries a Cadence token but whose number key is absent or
 * unreadable fails the whole read too, which is where this normalizer and
 * `normalizeDeclines` genuinely differ: the output shape moved from a token to
 * a pair, so a token without its number is half a record and there is nowhere
 * to put it. A row whose title carries NO token is SKIPPED, unchanged - a human
 * can title an issue anything, and a title-scoped search still matches on a
 * substring of a word.
 *
 * `state` IS NEVER READ, and that is CONTEXT D-05 rather than an omission: an
 * existing issue suppresses whether it is open or closed. The fingerprint is
 * `sha256(file + NUL + claim)`, so nothing about it changes when the code is
 * fixed, and a finding filed, fixed and closed can never be filed again. The
 * same coarseness was already accepted for declines in v3.7.1.
 *
 * `detail` is a fixed phrase, never a slice of the response: the bytes a forge
 * CLI prints are not this seam's to put in an envelope (CONTEXT D-16).
 *
 * @param {unknown} text the CLI's stdout
 * @param {number} limit the page size the argv asked for
 * @param {string} numberKey the row's own `numberKey` fact - never spelled by a caller
 * @returns {{complete: boolean,
 *   records: Array<{fingerprint: string, number: number}>, detail: string|null}}
 */
export function normalizeLookup(text, limit, numberKey) {
  /** @param {string} detail */
  const bad = (detail) => ({ complete: false, records: [], detail });
  if (typeof text !== 'string') return bad('response was not text');
  let parsed;
  try { parsed = JSON.parse(text); } catch { return bad('response was not JSON'); }
  if (!Array.isArray(parsed)) return bad('response was not a JSON array');
  /** @type {Array<{fingerprint: string, number: number}>} */
  const records = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') return bad('a row was not an object');
    const title = /** @type {Record<string, unknown>} */ (row).title;
    if (typeof title !== 'string') return bad('a row carried no readable title');
    const token = fingerprintInTitle(title);
    if (token === null) continue;
    const number = issueNumber(/** @type {Record<string, unknown>} */ (row)[numberKey]);
    if (number === null) return bad(`a row carrying a Cadence token had no readable ${numberKey}`);
    records.push({ fingerprint: token, number });
  }
  if (parsed.length >= limit) {
    return bad(`the response filled the ${limit}-row page and may be truncated`);
  }
  return { complete: true, records, detail: null };
}

/**
 * How each provider's CLI is told to CREATE an issue and to LIST the declined
 * ones - one row per provider, in the shape `CREATE_TABLE` in
 * lib/forge-decision.mjs already uses (CONTEXT D-14): a builder that returns
 * the argv, and a stated fact beside it.
 *
 * THE BINARY IS NOT REPEATED HERE. `PROVIDER_TABLE` in lib/forge-decision.mjs
 * says which binary drives which provider, and the KEYS below are that table's
 * own three, because the persisted `git.forge_provider` value is used directly
 * as the key here. A second spelling would be a lookup miss rather than a
 * naming preference.
 *
 * THE FLAGS ARE MEASURED, not recalled - read 2026-09-03 on this machine from
 * each CLI's own `--help`, gh 2.99.0, glab 1.116.0, tea 0.15.1 - a re-reading
 * of a block first taken against gh 2.98.0 and glab 1.114.0; tea has not moved:
 *   gh    `issue create`: `-t/--title`, `-b/--body`, `-l/--label name`,
 *         `-R/--repo` (inherited). `issue list`: `-l/--label strings`,
 *         `-S/--search query`, `-s/--state {open|closed|all}`, `--json fields`,
 *         `-L/--limit int`.
 *   glab  `issue create`: `-t/--title`, `-d/--description`, `-l/--label`,
 *         `-R/--repo`, `-y/--yes`. `issue list`: `-l/--label`,
 *         `--search <string>`, `--in title,description`, `-A/--all`,
 *         `-O/--output json`, `-P/--per-page int`, `-R/--repo`.
 *   tea   `issues create`: `-t/--title`, `-d/--description`, `-L/--labels`
 *         (comma-separated), `-r/--repo`, `-l/--login`. `issues list`:
 *         `-L/--labels`, `-k/--keyword string`, `--state (all|open|closed)`,
 *         `-f/--fields` (which offers `index,title`), `-o/--output json`,
 *         `--limit int`, `-l/--login`.
 * The LABEL flag is singular on gh and glab and plural-comma on tea, and it is
 * the one spelling all three share on the CREATE call - which is what makes a
 * label the decline marker rather than `gh issue close --reason` (gh-only) or
 * `tea issues close` (no reason flag at all).
 *
 * `glab` CARRIES `-y` AND THAT IS NOT OPTIONAL - written in the short form the
 * row's own vector uses, since that is the spelling the pinned test asserts.
 * `glab issue create --help`
 * calls it "Don't prompt for confirmation to submit the issue"; without it the
 * child blocks on a confirmation prompt inside a gate step, and a hung child is
 * the failure a 60-second timeout turns into a refusal at best. Every row
 * likewise supplies a description/body for the reason `issueBody` states.
 *
 * NO ROW READS AN ISSUE NUMBER BACK, because none of the three prints
 * machine-readable output on a successful create - there is no `--json` on any
 * of the three create faces. Exit zero is the whole answer. That is also what
 * keeps no-third-party-output (CONTEXT D-16) true by CONSTRUCTION here: there
 * is no create response to be tempted to put on an envelope.
 *
 * THE LOOKUP IS A TITLE-SCOPED SEARCH FOR THE FIRE'S OWN FINGERPRINTS, one
 * query per chunk of `LOOKUP_CHUNK` of them, never one call per finding. It
 * used to be one list call filtered by `DECLINE_LABEL`, and that shape could
 * not answer the question this seam now asks: an issue Cadence ACCEPTED carries
 * no label, so a label-filtered query is blind to exactly the set a create must
 * not duplicate (CONTEXT D-07).
 *
 * BARE FINGERPRINTS ARE REFUSED, TITLES ONLY. Measured 2026-09-03 against
 * `crenshawdev/cadence`: `gh issue list --search 084c9ce03c072e0b` returned
 * THREE issues, one of them a bug report that merely quotes the token in its
 * body, while `--search 'in:title 084c9ce03c072e0b'` returned exactly the two
 * duplicates that token names. A body match is a discussion OF a finding, not a
 * filing of it, and treating one as the other suppresses a create that should
 * happen.
 *
 * The page size is the same per-provider one `HOST_TABLE` in
 * lib/issue-decision.mjs states, for the same measured reasons:
 *   gh    200 - `--limit` pages internally, so the row count is the real answer
 *   glab  100 - the GitLab API's per_page ceiling
 *   tea    50 - Forgejo/Gitea clamps the page server-side whatever `--limit`
 *               asks, so a bigger number buys nothing but false coverage
 * `normalizeDeclines` and `normalizeLookup` above apply the truncation rule -
 * and on a title-scoped search a filled page is a stronger signal than on a
 * list, because a query naming at most six tokens has no business returning
 * fifty rows.
 *
 * THE NUMBER KEY IS A STATED FACT PER ROW, never something a caller spells.
 * `numberKey` names the field that row's CLI puts the issue number in, and the
 * three are all different - `number`, `iid`, `index`, exactly the three
 * `HOST_TABLE` in lib/issue-decision.mjs already reads. It rides the row for
 * the reason `limit` does: a seam that spelled `iid` at a call site would be a
 * seam that knows which provider it is talking to, which is the knowledge this
 * table exists to hold instead.
 *
 * WHETHER THE LOOKUP HAS BEEN MEASURED IS A STATED FACT TOO, and this one is
 * LOAD-BEARING rather than documentary. `lookupMeasured` is true on the github
 * and forgejo rows: each argv was run live against a real instance holding a
 * known fingerprint and its answer read by hand - github against
 * `crenshawdev/cadence` on 2026-09-03, forgejo against the Forgejo mirror of
 * the same repository on 2026-09-03. The GITLAB row is the one that still joins
 * a chunk's tokens with a SPACE on an assumption: glab offers one search string
 * and no OR, and whether it reads that as more than one term is unknown
 * (CONTEXT D-12). On an unmeasured row a wrongly-EMPTY response cannot be told
 * apart from a genuine miss, so `cmdFile` does not let a complete miss overrule
 * a confirmed `.planning/FILED.md` row there - the ledger keeps suppressing,
 * exactly as it does for a lookup that could not run at all. On a MEASURED row
 * the miss stays final, which is D-04's stated cost for the nine ledger rows
 * whose issues were deleted. Without this flag the lookup would make duplicate
 * filing MORE likely on an assumed forge than it was before the lookup existed,
 * because an assumed query's empty answer would override the only authority
 * that forge had. A row's flag flips to true when that exact argv has been run
 * against a live instance holding a known fingerprint and seen to return it -
 * not before, and never from a transcript.
 *
 * The forgejo row takes a LOGIN on both calls and the other two take none, the
 * split `HOST_TABLE` already states: an unqualified `tea --repo` falls back to
 * config FILE ORDER, so a stranger's tracker answers - and here it would be a
 * stranger's tracker WRITTEN to. `gh` and `glab` are not multi-account-
 * ambiguous the way tea's `--repo` is.
 *
 * WHETHER `DECLINE_LABEL` MUST ALREADY EXIST ON THE INSTANCE IS NOT SETTLED
 * HERE. A forge may refuse a label it does not hold rather than creating it on
 * the create call, and that answer is unobtainable without a live create
 * against each of the three. Task 8's live run records it at
 * `.planning/phases/3/live-forge-check.md`; if a provider refuses, the fix
 * belongs in THIS TABLE's argv or this comment, never in a transcript.
 */
export const FILING_TABLE = Object.freeze({
  forgejo: Object.freeze({
    needsLogin: true,
    limit: 50,
    numberKey: 'index',
    lookupMeasured: true,
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @param {string} login @returns {string[]} */
    create: (slug, issue, login) => ['issues', 'create', '--repo', slug,
      '--login', login, '--title', issue.title, '--description', issue.body,
      ...(issue.declined ? ['--labels', DECLINE_LABEL] : [])],
    /** MEASURED live 2026-09-03 against `crenshawdev/cadence` on a Forgejo
     *  instance, which is what `lookupMeasured: true` above records. Both
     *  halves of CONTEXT D-12's assumption held. `--keyword` on a single token
     *  returned the issue whose TITLE carried it as `[cadence <hex>] ...`, so
     *  tea matches a bracketed hex token inside a title; the same flag given
     *  two tokens joined with a SPACE returned BOTH issues, so tea reads a
     *  space-joined list as more than one term rather than one literal string.
     *  A token no title carried returned `[]`, which is the reading that makes
     *  an empty answer here real evidence: a complete miss on this row is
     *  final, and overrules a confirmed `.planning/FILED.md` row exactly as
     *  github's does. Space-joining is still the only spelling available - tea
     *  offers one search string and no OR - it is now a measured one.
     *  @param {string} slug @param {number} limit @param {string[]} fingerprints
     *  @param {string} login @returns {string[]} */
    lookup: (slug, limit, fingerprints, login) => ['issues', 'list', '--repo', slug,
      '--login', login, '--keyword', fingerprints.join(' '), '--state', 'all',
      '--fields', 'index,title', '--output', 'json', '--limit', String(limit)],
  }),
  github: Object.freeze({
    needsLogin: false,
    limit: 200,
    numberKey: 'number',
    lookupMeasured: true,
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--body', issue.body,
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** The one arm MEASURED live (2026-09-03, crenshawdev/cadence): `in:title`
     *  followed by the tokens joined with ` OR ` returned exactly the issues
     *  whose titles carry them, where the same tokens bare also matched a body.
     *  That live reading is what `lookupMeasured: true` records, and this is the
     *  only row carrying it: a complete MISS from this query is trusted over a
     *  confirmed ledger row, and no other row's miss is.
     *  @param {string} slug @param {number} limit @param {string[]} fingerprints
     *  @returns {string[]} */
    lookup: (slug, limit, fingerprints) => ['issue', 'list', '--repo', slug,
      '--search', `in:title ${fingerprints.join(' OR ')}`, '--state', 'all',
      '--json', 'number,title', '--limit', String(limit)],
  }),
  gitlab: Object.freeze({
    needsLogin: false,
    limit: 100,
    numberKey: 'iid',
    lookupMeasured: false,
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--description', issue.body, '-y',
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** ASSUMED, NOT MEASURED (CONTEXT D-12), and now the ONLY row that is: that
     *  `--search` with `--in title` matches a bracketed hex token in a title,
     *  and that space-joined tokens are read as more than one term. glab offers
     *  one search string and no OR, the same shape tea does - but tea's was run
     *  live and this one has no instance here to run it against. Wrong either
     *  way, this arm returns nothing for an issue that exists, which is why it
     *  carries `lookupMeasured: false` above: an empty answer from this query is
     *  not evidence, so a confirmed `.planning/FILED.md` row keeps suppressing
     *  over it rather than being overruled by it. Measuring it is the same
     *  procedure the forgejo row's comment records: put an issue titled
     *  `[cadence <hex>] ...` on a live GitLab project, run this exact argv for
     *  one token and then for two, and flip the flag only if both come back.
     *  `--in title` is what keeps a body match out - glab's default is
     *  `title,description`, which is the bare-token failure the header states.
     *  @param {string} slug @param {number} limit @param {string[]} fingerprints
     *  @returns {string[]} */
    lookup: (slug, limit, fingerprints) => ['issue', 'list', '--repo', slug,
      '--search', fingerprints.join(' '), '--in', 'title', '--all',
      '--output', 'json', '--per-page', String(limit)],
  }),
});
