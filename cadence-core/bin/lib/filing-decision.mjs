// @ts-check
// filing-decision.mjs - the pure core of the filing question: when a gate won't fix a finding now, which findings reach
// the user's ask and how each one is recognized again on a later fire. Node builtins only (`node:crypto`'s createHash, for
// the fingerprint), no filesystem, no spawns, no `process`: bin/issue-filing.mjs supplies the live readings. Unknown input never throws.
// The payload is the only input. The ask is read off the structured `{voices: [...]}` adjudication payload and never
// re-parsed from REVIEW prose, so no function here takes prose and "the ask follows the payload" is a property of the signature.
// The entries are buildEntries's, not a second walk: adjudication-record.mjs already validates the payload and pairs each
// finding with its ruling, and a second reader of one grammar would disagree first on exactly the inputs one reader rejects.
'use strict';

import { createHash } from 'node:crypto';
import { buildEntries } from './adjudication-record.mjs';
import { redactUrl, redactCredentials } from './redact-url.mjs';

/**
 * The two raised severities a `blocking` gate halts over. Everything else is that arm's remainder, which this module files rather than parks.
 * A `survived` finding below this pair is one that was confirmed and not fixed, with no commit id because none exists, and
 * adjudication-record.mjs stores it as it is. Before it could, the only way to write the remainder down was to downgrade
 * the finding, which records "the adjudicator lowered it" over "it stood and nobody fixed it".
 */
export const HALTING_SEVERITIES = Object.freeze(['blocker', 'high']);

/** A copy of adjudication-record.mjs's `FIX_COMMIT`, which isn't exported, pinned against it by adjudication-record.test.mjs. The test is what stops the two drifting. */
const FIX_COMMIT = /^[0-9a-fA-F]{7,40}$/;

/**
 * Whether `value` is a fix commit this module will read as a landed fix.
 * The shape is checked here although adjudication-record.mjs refuses a malformed one at composition time, because `halting`
 * rests on this answer and it's the rail over records that module never validated: another tool's, a hand edit, an older
 * artifact. If any non-blank string counted, `fix_commit: 'not-a-commit'` on an unoverridden blocker that stood would read
 * as fixed and the close a person should have been stopped at would proceed.
 * A shape check and nothing more, since this module never does I/O: a well-formed id naming no commit still reads as usable.
 *
 * @param {unknown} value an entry's `fix_commit`, or whatever stood in for one
 * @returns {boolean}
 */
export const usableFixCommit = (value) => typeof value === 'string' && FIX_COMMIT.test(value);

/**
 * The one statement of what a record's entries mean to a fire that is settling: which reach the user's ask (`filing`),
 * which cleared halt a caller has to see (`haltingSurvivors`) and which stop a close (`halting`). It takes the entries
 * `buildEntries` returns, the array a written ADJUDICATION-*.json stores, so a reader of the record asks what the composer does.
 * A usable `fix_commit` is asked first and ends the question: a fixed entry is in none of the three sets, even with
 * `overridden: true`. The schema allows both, and leaving the precedence to filter order is how one entry becomes a permanent override.
 * `haltingSurvivors` are survived at blocker or high with no commit and `overridden`. They're in `filing` too: nobody is
 * fixing them, and reading ruling and severity alone would drop them silently, never fixed, filed, declined or asked.
 * `halting` is the fail-closed rail. `buildEntries` refuses that shape at composition, so it's non-empty only over a record
 * another tool wrote, a hand edit or an older artifact, which is the input a close has to stop on.
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
 * Every finding in `payload` that the gate will not fix now: the payload face of `unfixedFromEntries`, read off that one statement.
 * A payload `buildEntries` refuses comes back as a refusal, never an empty set. "Nothing to ask about" ends the step and
 * "this payload is unreadable" must stop it, and an empty array collapses the two. The refusal carries `buildEntries`'s own
 * `detail`, which names the offending entry.
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

/** Hex characters of the digest a fingerprint token is. A collision would mistake a new finding for one the user already
 * declined, so 16 (64 bits) is chosen against that: at 2^16 declined findings on one tracker the odds of any collision are under 2.4e-10. */
export const FINGERPRINT_CHARS = 16;

/** The join byte as an escape: self-verify refuses a literal U+0000 anywhere under `cadence-core/bin/`. */
const NUL = '\0';

/**
 * The `(file, claim)` fingerprint of a finding, as a fixed-width lowercase hex token.
 * `line` is left out on purpose. convergenceKey joins `(file, line, claim)` to ask whether two voices raised the same
 * thing in one fire. A decline outlives its fire and is read back against an edited file, so a fingerprint carrying the
 * line forgets itself when the file shifts and puts the declined finding back in front of the user forever.
 * NUL-joined like convergenceKey: a separator that can't appear in a path or claim, so `("a b", "c")` and `("a", "b c")`
 * don't digest alike.
 * Nothing is added to the finding to carry it: findingIssue in adjudication-record.mjs refuses any key outside
 * `FINDING_KEYS`, so a `fingerprint` field would fail every existing payload. It's derived at each use.
 * Total: a missing or non-string `file` or `claim` reads as '' rather than throwing.
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
 * The label a declined finding's issue carries.
 * A fact of the table, like `--private` in `CREATE_TABLE`: one frozen literal, never caller text, which would put free text on a command line and could split the decline set with a second spelling.
 * Nothing reads it back any more. The lookup is title-scoped now, because an accepted issue never carries the label and a label filter was blind to it. It's still written on a declined create, for a human on the tracker.
 * No colon, `::` or space: GitLab reads `::` as a scoped label with mutual exclusion, and a label a forge interprets behaves differently per provider.
 */
export const DECLINE_LABEL = 'cadence-declined';

/** Not a measured cap: it sits well under every documented title limit and stays legible in a list view. A longer claim is clipped, which changes the title and never the fingerprint. */
const TITLE_MAX = 200;

/**
 * How many fingerprints one `lookup` query may carry.
 * Six, because six terms joined by ` OR ` is five boolean operators, the ceiling GitHub's search docs state. Seven and
 * eight were measured working against `crenshawdev/cadence` on 2026-09-03, but the number isn't set from that: a documented
 * limit the index starts enforcing later truncates a page silently, and a silent truncation here re-files an issue that
 * already exists. An extra round trip costs latency and nothing else.
 * Exported so the table's builders and issue-filing.mjs's chunking loop can't disagree.
 */
export const LOOKUP_CHUNK = 6;

/** The prefix that marks a title as a Cadence filing, and the capture that recovers its fingerprint. One spelling for writing and reading, so they can't drift. */
const TITLE_PREFIX = 'cadence';
const TITLE_TOKEN = new RegExp(`^\\[${TITLE_PREFIX} ([0-9a-f]{${FINGERPRINT_CHARS}})\\] `);

/** Newlines and whitespace runs collapse to single spaces: a title with an embedded newline has a tail no list view shows. */
const flatten = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** `flatten`, then the two credential strips: redactUrl first so a userinfo URL goes whole, then redactCredentials for a
 * name/value pair or an Authorization scheme. Applied to every finding-derived span of a title or body, since a finding is
 * third-party text that can quote a secret from the code and the title lands in the committed FILED.md and DECLINED.md.
 * Flatten first so a credential split by a newline is one span.
 *
 * redactUrl reads the end of its input as a possible cut, so a trailing `src/a.mjs:42` or `{ok:false}` would go as a
 * `user:secret` fragment. A finding field is whole, not a window, so a space is added behind it and the cut rules match
 * nothing. Only a span that carries its `@` is userinfo here. */
const clean = (v) => redactCredentials(redactUrl(`${flatten(v)} `)).trim();

/**
 * The issue title for a finding: the fingerprint token, then the claim.
 * The token is in the title because it's the only field the lookup can ask all three CLIs for in one bounded list call
 * (`gh --json number,title`, `glab --output json`, `tea --fields index,title`), and reading a body back would be one call per issue.
 * The claim is redacted before the prefix is joined and before the clip, so the prefix stays byte-exact for
 * fingerprintInTitle and a credential can't survive as a clipped half no pattern matches. The fingerprint isn't redacted:
 * it digests the raw `(file, claim)`, so a row an earlier version wrote still matches and nothing is re-filed.
 *
 * @param {unknown} finding @returns {string}
 */
export function issueTitle(finding) {
  const f = finding && typeof finding === 'object' ? /** @type {any} */ (finding) : {};
  const head = `[${TITLE_PREFIX} ${fingerprint(finding)}] `;
  const claim = clean(f.claim) || '(no claim)';
  return (head + claim).slice(0, TITLE_MAX);
}

/**
 * The fingerprint token an issue title carries, or `null` when it carries none.
 * Null isn't a failure: a label is something a human can apply by hand on any forge, and an issue labelled that way is
 * not a decline record. So the normalizer skips an unrecognized title, the opposite of a missing `title` field, which means
 * the CLI's output shape changed and nothing in the response can be trusted.
 *
 * @param {unknown} title @returns {string|null}
 */
export function fingerprintInTitle(title) {
  if (typeof title !== 'string') return null;
  const m = TITLE_TOKEN.exec(title);
  return m ? m[1] : null;
}

/**
 * The issue body for a finding.
 * Every row's argv supplies one: `gh issue create` prompts for a body without `--body` ("Supply a body. Will prompt for
 * one otherwise.", gh 2.98.0) and `glab issue create` opens an editor without `--description`, and either blocks a child
 * inside a gate step forever.
 * It carries the finding and nothing else: no CLI output, envelope, host or login. `failure_scenario` is in because an
 * issue without it is the finding with its argument removed.
 * Every field taken from the finding is redacted, file and ruling included, since the body is posted to a tracker that may
 * be public. The fingerprint at the foot is a hash of the raw text, not a way back to it.
 *
 * @param {unknown} finding @returns {string}
 */
export function issueBody(finding) {
  const f = finding && typeof finding === 'object' ? /** @type {any} */ (finding) : {};
  const at = `${clean(f.file) || '(no file)'}:${Number.isSafeInteger(f.line) ? f.line : '?'}`;
  return [
    `Raised at ${at} as **${clean(f.severity) || '(no severity)'}**`
      + `${f.voice ? ` by ${clean(f.voice)}` : ''}`
      + `${f.ruling ? `, ruled ${clean(f.ruling)}` : ''}.`,
    '',
    `**Claim.** ${clean(f.claim) || '(no claim)'}`,
    '',
    `**Failure scenario.** ${clean(f.failure_scenario) || '(none given)'}`,
    '',
    `Filed by Cadence. Fingerprint \`${fingerprint(finding)}\` over (file, claim).`,
  ].join('\n');
}

/**
 * One decline-lookup response -> the fingerprint tokens it carries, plus whether the read is complete. Total, and an
 * incomplete answer carries no tokens.
 * Written here rather than imported, and the readers stay separate on purpose: `normalizeList` in issue-decision.mjs
 * reads `state` for the land report, which asks for `number,state`, and this one reads `title`. Folding them would put a
 * `title` requirement on that report or make this one demand a `state` it never uses.
 * A response that fills its page is incomplete and carries nothing, and it's worse here: Forgejo clamps `tea issues list`
 * at 50 rows whatever `--limit` asks, and a truncated decline set read as whole puts declined findings back in front of the user.
 * A row that isn't an object, or whose `title` isn't a string, fails the whole read: a renamed field means the CLI's shape
 * moved. A row whose title carries no Cadence token is skipped.
 * `detail` is a fixed phrase, never a slice of the response: a forge CLI's bytes aren't ours to put in an envelope.
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

/** An issue number however its CLI spells it, or null when the field carries no readable one.
 *
 * `tea issues list` prints `index` as a string and gh prints `number` as a number, so both shapes answer. Written here
 * because issue-decision.mjs's own helper isn't exported.
 * Positive only, and outside the safe-integer range is no number: `0` isn't an issue on any of the three, and
 * `9007199254740993` reads back as `...992`, which names a different issue than the tracker holds.
 * @param {unknown} raw @returns {number|null} */
function issueNumber(raw) {
  const n = typeof raw === 'number' ? raw
    : (typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * One title-scoped lookup response -> the (fingerprint, issue number) pairs it carries, plus whether the read is complete.
 * Beside normalizeDeclines, not a widening of it, because this one exists for the number: a fire that finds a fingerprint
 * already on the tracker has to report which issue holds it, and no create face prints one, so the lookup is the only source.
 * A response that fills its page is incomplete, as in normalizeDeclines. Here a truncated page read as whole says "not
 * filed" about an issue that is filed, and the duplicate that follows is the defect this closes.
 * A row that isn't an object or whose `title` isn't a string fails the whole read, and so does one with a Cadence token but
 * no readable number: a token without its number is half a record. A row with no token is skipped.
 * `state` is never read, on purpose: an existing issue suppresses whether open or closed. The fingerprint doesn't change
 * when the code is fixed, so a finding filed, fixed and closed is never filed again.
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
 * How each provider's CLI is told to create an issue and look one up: a row per provider, with a builder returning the
 * argv and stated facts beside it, as `CREATE_TABLE` in forge-decision.mjs does. The flags were read from each CLI's own
 * `--help` on 2026-09-03 (gh 2.99.0, glab 1.116.0, tea 0.15.1), not recalled. The keys are `PROVIDER_TABLE`'s, since the
 * persisted `git.forge_provider` is the key directly.
 * No row reads an issue number back from a create, because none of the three prints anything machine-readable.
 * `limit` is the page size `HOST_TABLE` in issue-decision.mjs states and `numberKey` the field each CLI puts the number
 * in, so no seam has to know which provider it's talking to.
 * `visibility` builds the read-only argv asking whether the repo is public, private or internal, or is null where the CLI
 * has no such query. Unreadable reads as public, the safe direction: the question that follows is asked harder for a public repo.
 * Whether a forge refuses a label it doesn't hold on create is unsettled, and only a live create against each answers it.
 */
export const FILING_TABLE = Object.freeze({
  forgejo: Object.freeze({
    // An unqualified `tea --repo` falls back to config file order, so a stranger's tracker would answer and be written to.
    needsLogin: true,
    limit: 50,
    numberKey: 'index',
    lookupMeasured: true,
    visibilityMeasured: false,
    /** No query. tea's docs list the printable fields of `repos` (description, forks, id, name, owner, stars, ssh, updated,
     *  url, permission, type) with no visibility, and no command that views one repository. `repos search --private`
     *  answers "no row" for both "not that kind" and "no such name", which isn't a reading. So this is unreadable and the ask
     *  face shows public. If a later tea adds a query, the argv goes here and the flag flips only after a live run against
     *  a public and a private repository.
     *  @type {null} */
    visibility: null,
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @param {string} login @returns {string[]} */
    create: (slug, issue, login) => ['issues', 'create', '--repo', slug,
      '--login', login, '--title', issue.title, '--description', issue.body,
      ...(issue.declined ? ['--labels', DECLINE_LABEL] : [])],
    /** Measured live 2026-09-03 against `crenshawdev/cadence` on a Forgejo instance, which is what `lookupMeasured: true`
     *  records. `--keyword` on one token returned the issue whose title carried it as `[cadence <hex>] ...`, and two tokens
     *  joined with a space returned both issues, so tea reads a space-joined list as more than one term. A token no title
     *  carried returned `[]`, so an empty answer is real evidence: a complete miss is final and overrules a confirmed
     *  FILED.md row, as on github. Space-joining is the only spelling tea offers (one search string, no OR), and now it's measured.
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
    visibilityMeasured: true,
    /** Measured 2026-10-26 on gh 2.45.0 against `crenshawdev/cadence`, which answered `{"visibility":"PUBLIC"}`.
     *  gh's value is upper case (PUBLIC, PRIVATE, INTERNAL); `normalizeVisibility` folds the case.
     *  @param {string} slug @returns {string[]} */
    visibility: (slug) => ['repo', 'view', slug, '--json', 'visibility'],
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--body', issue.body,
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** Measured live (2026-09-03, crenshawdev/cadence): `in:title` then the tokens joined with ` OR ` returned exactly the
     *  issues whose titles carry them. Bare tokens also matched a body: `--search 084c9ce03c072e0b` returned three issues,
     *  one a bug report quoting the token, where `in:title` returned the two duplicates. A body match is a discussion of a
     *  finding, not a filing of it. That reading is what `lookupMeasured: true` records, so a complete miss here is
     *  trusted over a confirmed ledger row, and no other row's miss is.
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
    visibilityMeasured: false,
    /** Not measured. `glab repo view <repo> --output json` is documented and prints the project object, whose `visibility`
     *  is `public`, `internal` or `private`. Whether glab's JSON keeps that key is open; if it doesn't, the answer is
     *  unparseable and reads as public.
     *  @param {string} slug @returns {string[]} */
    visibility: (slug) => ['repo', 'view', slug, '--output', 'json'],
    /** `-y` isn't optional: without it glab asks for confirmation and the child blocks inside a gate step.
     *  @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--description', issue.body, '-y',
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** Assumed, not measured, and the only row that is: that `--search` with `--in title` matches a bracketed hex token in
     *  a title, and that space-joined tokens read as more than one term. glab offers one search string and no OR, like tea,
     *  but tea's was run live. Wrong either way this returns nothing for an issue that exists, so `lookupMeasured` is
     *  false: an empty answer isn't evidence, and a confirmed FILED.md row keeps suppressing over it, or the lookup would
     *  make duplicates likelier than before it existed. To measure it, put an issue titled `[cadence <hex>] ...` on a live
     *  GitLab project, run this argv for one token and then two, and flip the flag only if both come back. `--in title`
     *  keeps body matches out, where glab's default is `title,description`.
     *  @param {string} slug @param {number} limit @param {string[]} fingerprints
     *  @returns {string[]} */
    lookup: (slug, limit, fingerprints) => ['issue', 'list', '--repo', slug,
      '--search', fingerprints.join(' '), '--in', 'title', '--all',
      '--output', 'json', '--per-page', String(limit)],
  }),
});

/** The three words a repository's visibility is reported in, and no others. */
const VISIBILITY_WORDS = Object.freeze(['public', 'private', 'internal']);

/**
 * One visibility query's stdout -> `{visibility, read}`, always one of three fixed words.
 * `read` says whether the word came off the forge. Anything that isn't a JSON object holding a `visibility` string naming
 * one of the three (unparseable stdout, a missing key, an unknown word) is `public` with `read: false`, the direction that
 * asks harder rather than softer. A nonzero exit or a timeout never reaches here; the caller answers those with the same
 * pair. gh spells the word upper case and GitLab lower, so the case is folded.
 *
 * @param {unknown} stdout
 * @returns {{visibility: 'public'|'private'|'internal', read: boolean}}
 */
export function normalizeVisibility(stdout) {
  let value = null;
  try { value = JSON.parse(String(stdout)); } catch { value = null; }
  const raw = value && typeof value === 'object' ? /** @type {any} */ (value).visibility : null;
  const word = typeof raw === 'string' ? raw.toLowerCase() : '';
  const hit = VISIBILITY_WORDS.find((w) => w === word);
  return hit
    ? { visibility: /** @type {'public'|'private'|'internal'} */ (hit), read: true }
    : { visibility: 'public', read: false };
}
