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
 * The ONE statement of which entries of a record the gate will not fix now.
 *
 * Takes the ENTRIES rather than the payload: the array `buildEntries` returns,
 * which is byte-for-byte the array a written `ADJUDICATION-*.json` stores, so a
 * reader holding only the record on disk asks the same question the composer
 * asks over the payload. `unfixedFindings` below is the payload face and is a
 * wrapper over this one - the meaning lives HERE, once, because a second
 * statement of it is the drift a downstream halt decision would be resting on.
 *
 * THREE FIELDS DECIDE IT AND NOTHING ELSE: the entry's `ruling`, its RAISED
 * `severity`, and the `overridden` marker. An entry is in the filing set unless
 * it `survived` at `blocker` or `high` AND was not overridden - that one is the
 * thing the gate is halting over, so it is being fixed, not filed. Which makes
 * the set exactly criterion 1's three sources at once: the blocking arm's
 * below-blocker/high remainder, the adjudicated arm's non-survivors, and any
 * `recorded not fixed` disposition.
 *
 * THE MARKER IS THE THIRD FIELD BECAUSE AN OVERRIDE IS THE ONE SURVIVING
 * BLOCKER NOBODY IS FIXING. `overridden` in lib/adjudication-record.mjs records
 * that a user let a blocking FAIL stand, so an overridden blocker or high is by
 * construction unfixed - the single case where "survived at a halting severity"
 * stops implying "a commit is coming". Reading only the first two fields drops
 * it from the set silently, and silence is the worst answer available here: the
 * finding is then never fixed, never filed, never declined and never put to the
 * user. Before the marker existed the same payload was a loud REFUSAL from
 * `buildEntries`, which is the state this must not quietly replace.
 *
 * Those overridden entries come back NAMED, on `haltingSurvivors`, as well as
 * folded into `filing`. They are the subset a caller settling the fire has to
 * be able to see on its own: a record holding one is a record whose blocking
 * halt was cleared by a person rather than by a commit, and the receipt that
 * settles it has to say so. Answered in the SAME pass as `filing` so the two
 * can never disagree about one entry.
 *
 * `fix_commit` IS STILL NOT ONE OF THE FIELDS (CONTEXT D-07). A voluntary fix
 * on a medium is legal and cites its commit, and dropping an entry for carrying
 * one belongs to bin/issue-filing.mjs's `cmdUnfixed`, the face that already
 * adds the live lookup on top of this pure selection. An overridden entry that
 * ALSO names a commit is in the set here and is removed there, which is that
 * split working rather than a case this function missed.
 *
 * The severity read is the RAISED one, which is the only one an entry carries -
 * a `downgraded` ruling records that the adjudicator lowered the finding and
 * does not restate a new level, so there is no second severity to pick the
 * wrong one of.
 *
 * A NON-ENTRY IS SKIPPED, never counted into either set. `buildEntries` cannot
 * produce one, so the wrapper below is unaffected; a record read off disk can
 * hold anything, and the discipline this module states is that unknown input
 * never throws. `deriveCounts` skips the same shape for the same reason.
 *
 * @param {unknown} entries a built record's `entries[]`
 * @returns {{filing: Array<Record<string, any>>,
 *   haltingSurvivors: Array<Record<string, any>>}}
 */
export function unfixedFromEntries(entries) {
  /** @type {Array<Record<string, any>>} */
  const filing = [];
  /** @type {Array<Record<string, any>>} */
  const haltingSurvivors = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    if (e === null || typeof e !== 'object' || Array.isArray(e)) continue;
    const stoodAtAHalt = e.ruling === 'survived' && HALTING_SEVERITIES.includes(e.severity);
    if (stoodAtAHalt && e.overridden !== true) continue;
    filing.push(e);
    if (stoodAtAHalt) haltingSurvivors.push(e);
  }
  return { filing, haltingSurvivors };
}

/**
 * Every finding in `payload` that the gate will NOT fix now.
 *
 * The PAYLOAD face of `unfixedFromEntries`: it validates and pairs through
 * `buildEntries`, then reads its set off that one statement rather than
 * restating the three-field test here. The returned array is the same array,
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
 * caller derived. What it is read back by is `LOOKUP` below, whose whole query
 * is this label - so a caller that could choose it could split the decline set
 * in two and start re-asking about half of it, and a caller-derived one would
 * put free text on a command line.
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
 * only field the decline lookup can ask all three CLIs for in one bounded list
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
 * THE FLAGS ARE MEASURED, not recalled - read 2026-08-25 on this machine from
 * each CLI's own `--help`, gh 2.98.0, glab 1.114.0, tea 0.15.1:
 *   gh    `issue create`: `-t/--title`, `-b/--body`, `-l/--label name`,
 *         `-R/--repo` (inherited). `issue list`: `-l/--label strings`,
 *         `-s/--state {open|closed|all}`, `--json fields`, `-L/--limit int`.
 *   glab  `issue create`: `-t/--title`, `-d/--description`, `-l/--label`,
 *         `-R/--repo`, `-y/--yes`. `issue list`: `-l/--label`, `-A/--all`,
 *         `-O/--output json`, `-P/--per-page int`, `-R/--repo`.
 *   tea   `issues create`: `-t/--title`, `-d/--description`, `-L/--labels`
 *         (comma-separated), `-r/--repo`, `-l/--login`. `issues list`:
 *         `-L/--labels`, `--state (all|open|closed)`, `-f/--fields` (which
 *         offers `index,title`), `-o/--output json`, `--limit int`,
 *         `-l/--login`.
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
 * THE DECLINE LOOKUP IS ONE LIST CALL FILTERED BY `DECLINE_LABEL`, never one
 * call per finding, and it carries the same per-provider page size `HOST_TABLE`
 * in lib/issue-decision.mjs states, for the same measured reasons:
 *   gh    200 - `--limit` pages internally, so the row count is the real answer
 *   glab  100 - the GitLab API's per_page ceiling
 *   tea    50 - Forgejo/Gitea clamps the page server-side whatever `--limit`
 *               asks, so a bigger number buys nothing but false coverage
 * `normalizeDeclines` above applies the truncation rule that goes with them.
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
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @param {string} login @returns {string[]} */
    create: (slug, issue, login) => ['issues', 'create', '--repo', slug,
      '--login', login, '--title', issue.title, '--description', issue.body,
      ...(issue.declined ? ['--labels', DECLINE_LABEL] : [])],
    /** @param {string} slug @param {number} limit @param {string} login
     *  @returns {string[]} */
    lookup: (slug, limit, login) => ['issues', 'list', '--repo', slug,
      '--login', login, '--labels', DECLINE_LABEL, '--state', 'all',
      '--fields', 'index,title', '--output', 'json', '--limit', String(limit)],
  }),
  github: Object.freeze({
    needsLogin: false,
    limit: 200,
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--body', issue.body,
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** @param {string} slug @param {number} limit @returns {string[]} */
    lookup: (slug, limit) => ['issue', 'list', '--repo', slug,
      '--label', DECLINE_LABEL, '--state', 'all',
      '--json', 'number,title', '--limit', String(limit)],
  }),
  gitlab: Object.freeze({
    needsLogin: false,
    limit: 100,
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--description', issue.body, '-y',
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** @param {string} slug @param {number} limit @returns {string[]} */
    lookup: (slug, limit) => ['issue', 'list', '--repo', slug,
      '--label', DECLINE_LABEL, '--all',
      '--output', 'json', '--per-page', String(limit)],
  }),
});
