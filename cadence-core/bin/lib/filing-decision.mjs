// @ts-check
// filing-decision.mjs - the pure core of the filing question: when a gate won't fix a finding now, which findings
// reach the user's ask and how each is recognized again on a later fire. No filesystem, no spawns.
// The payload is the only input, and the ask is never re-parsed from REVIEW prose.
// The entries are buildEntries's, not a second walk: two readers of one grammar disagree on exactly what one rejects.
'use strict';

import { createHash } from 'node:crypto';
import { buildEntries, fixFileIssue } from './adjudication-record.mjs';
import { readJsonPage } from './issue-decision.mjs';
import { redactUrl, redactCredentials } from './redact-url.mjs';

/**
 * The two raised severities a `blocking` gate halts over. Everything else is that arm's remainder, which gets filed.
 * A `survived` finding below this pair is one that was confirmed and not fixed, with no commit id because none exists.
 * The only other way to write it down was to downgrade the finding, which records "the adjudicator lowered it".
 */
export const HALTING_SEVERITIES = Object.freeze(['blocker', 'high']);

/** A copy of adjudication-record.mjs's unexported `FIX_COMMIT`; its test is what stops the two drifting. */
const FIX_COMMIT = /^[0-9a-fA-F]{7,40}$/;

/**
 * Whether `value` is a fix commit this module will read as a landed fix.
 * Checked here too although adjudication-record.mjs refuses a malformed one, because `halting` is the rail over records
 * that module never validated. If any non-blank string counted, `fix_commit: 'not-a-commit'` on a blocker that stood
 * would read as fixed and the close would proceed.
 * A shape check and nothing more: a well-formed id naming no commit still reads as usable.
 *
 * @param {unknown} value an entry's `fix_commit`, or whatever stood in for one
 * @returns {boolean}
 */
export const usableFixCommit = (value) => typeof value === 'string' && FIX_COMMIT.test(value);

/**
 * What a record's entries mean to a fire that is settling: which reach the user's ask (`filing`), which cleared halt
 * a caller has to see (`haltingSurvivors`) and which stop a close (`halting`).
 * A usable `fix_commit` or `fix_file` (a fix to an untracked file) is asked first and ends the question: a fixed entry is in none of the three sets, even with
 * `overridden: true`, or filter order would make one a permanent override.
 * `haltingSurvivors` are survived at blocker or high with no commit and `overridden`; they're in `filing` too.
 * `halting` is the fail-closed rail, only non-empty over a record another tool wrote or a hand edit.
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
    if (usableFixCommit(e.fix_commit) || (e.fix_file !== undefined && fixFileIssue(e.fix_file) === '')) continue;
    const stoodAtAHalt = e.ruling === 'survived' && HALTING_SEVERITIES.includes(e.severity);
    if (stoodAtAHalt && e.overridden !== true) { halting.push(e); continue; }
    filing.push(e);
    if (stoodAtAHalt) haltingSurvivors.push(e);
  }
  return { filing, haltingSurvivors, halting };
}

/**
 * Every finding in `payload` that the gate will not fix now: the payload face of `unfixedFromEntries`.
 * A payload `buildEntries` refuses comes back as a refusal, never an empty set: "nothing to ask about" ends the step,
 * "this payload is unreadable" must stop it, and an empty array collapses the two.
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

/** Hex characters of the digest a fingerprint token is. A collision would mistake a new finding for a declined one,
 * and at 16 (64 bits) the odds of any collision over 2^16 findings are under 2.4e-10. */
export const FINGERPRINT_CHARS = 16;

/** The join byte as an escape, since self-verify refuses a literal U+0000 anywhere under `cadence-core/bin/`. */
const NUL = '\0';

/**
 * The `(file, claim)` fingerprint of a finding, as a fixed-width lowercase hex token.
 * `line` is left out on purpose: a decline outlives its fire and is read back against an edited file, so a line in
 * the fingerprint would put the declined finding back in front of the user when the file shifts.
 * NUL-joined, since it can't appear in a path or claim: `("a b", "c")` and `("a", "b c")` must not digest alike.
 * Derived at each use, not stored on the finding: findingIssue in adjudication-record.mjs refuses unknown keys.
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
 * The label a declined finding's issue carries: one frozen literal, never caller text on a command line.
 * Nothing reads it back; the lookup is title-scoped, since an accepted issue never carries the label.
 * No colon, `::` or space: GitLab reads `::` as a scoped label with mutual exclusion.
 */
export const DECLINE_LABEL = 'cadence-declined';

/** Not a measured cap, just well under every documented title limit. Clipping a claim never changes the fingerprint. */
const TITLE_MAX = 200;

/**
 * How many fingerprints one `lookup` query may carry.
 * Six, because six terms joined by ` OR ` is five boolean operators, the ceiling GitHub's search docs state. Seven and
 * eight worked when measured, but a documented limit the index starts enforcing later truncates a page silently, and
 * that re-files an issue that exists. An extra round trip costs only latency.
 * Exported so the table's builders and issue-filing.mjs's chunking loop can't disagree.
 */
export const LOOKUP_CHUNK = 6;

/** The prefix marking a title as a Cadence filing, and the capture that recovers its fingerprint, spelled once. */
const TITLE_PREFIX = 'cadence';
const TITLE_TOKEN = new RegExp(`^\\[${TITLE_PREFIX} ([0-9a-f]{${FINGERPRINT_CHARS}})\\] `);

/** Whitespace runs collapse to single spaces: a title with an embedded newline has a tail no list view shows. */
const flatten = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** `flatten`, then the two credential strips: redactUrl first so a userinfo URL goes whole, then redactCredentials.
 * Applied to every finding-derived span of a title or body: a finding is third-party text that can quote a secret,
 * and the title lands in the committed FILED.md and DECLINED.md. Flatten first so a split credential is one span.
 *
 * redactUrl reads the end of its input as a possible cut, so a trailing `src/a.mjs:42` or `{ok:false}` would go as a
 * `user:secret` fragment. A finding field is whole, so a space behind it keeps the cut rules from matching.
 */
const clean = (v) => redactCredentials(redactUrl(`${flatten(v)} `)).trim();

/**
 * The issue title for a finding: the fingerprint token, then the claim.
 * The token is in the title because it's the only field all three CLIs return in one bounded list call.
 * The claim is redacted before the prefix is joined and before the clip, so the prefix stays byte-exact and a
 * credential can't survive as a clipped half. The fingerprint digests the raw `(file, claim)`, so an older row matches.
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
 * Null isn't a failure: a human can label any issue by hand, so the normalizer skips an unrecognized title. A missing
 * `title` field is the opposite: the CLI's shape changed and nothing in the response can be trusted.
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
 * Every row's argv supplies one: `gh issue create` prompts without `--body` and `glab issue create` opens an editor
 * without `--description`, and either blocks a child inside a gate step forever.
 * It carries the finding and nothing else: no CLI output, envelope, host or login. `failure_scenario` is in because an
 * issue without it is the finding with its argument removed.
 * Every field from the finding is redacted, file and ruling included, since the tracker may be public.
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
 * One decline-lookup response -> the fingerprint tokens it carries, plus whether the read is complete.
 * Separate from `normalizeList` in issue-decision.mjs, which reads `state` where this reads `title`.
 * A response that fills its page is incomplete: Forgejo clamps `tea issues list` at 50 rows whatever `--limit` asks,
 * and a truncated decline set read as whole puts declined findings back in front of the user.
 * A non-object row or a non-string `title` fails the whole read: the CLI's shape moved.
 * `detail` is a fixed phrase, never a slice of the response: a CLI's bytes aren't ours to put on an envelope.
 *
 * @param {unknown} text the CLI's stdout
 * @param {number} limit the page size the argv asked for
 * @returns {{complete: boolean, fingerprints: string[], detail: string|null}}
 */
export function normalizeDeclines(text, limit) {
  const page = readJsonPage(text, limit, (row) => {
    if (typeof row.title !== 'string') return { detail: 'a row carried no readable title' };
    const token = fingerprintInTitle(row.title);
    return token === null ? null : { record: token };
  });
  return { complete: page.complete, fingerprints: page.records, detail: page.detail };
}

/** An issue number however its CLI spells it, or null when the field carries no readable one.
 *
 * `tea issues list` prints `index` as a string and gh prints `number` as a number, so both shapes answer.
 * Positive only, and outside the safe-integer range is no number: `9007199254740993` reads back as `...992`.
 * @param {unknown} raw @returns {number|null} */
function issueNumber(raw) {
  const n = typeof raw === 'number' ? raw
    : (typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * One title-scoped lookup response -> the (fingerprint, issue number) pairs it carries, and whether it's complete.
 * Beside normalizeDeclines because this one exists for the number: a fire that finds a fingerprint already filed
 * has to report which issue holds it, and no create face prints one.
 * A response that fills its page is incomplete: read as whole, it says "not filed" about a filed issue.
 * A non-object row, a non-string `title`, or a token without a readable number fails the whole read.
 * `state` is never read, on purpose: a finding filed, fixed and closed must never be filed again.
 *
 * @param {unknown} text the CLI's stdout
 * @param {number} limit the page size the argv asked for
 * @param {string} numberKey the row's own `numberKey` fact - never spelled by a caller
 * @returns {{complete: boolean,
 *   records: Array<{fingerprint: string, number: number}>, detail: string|null}}
 */
export function normalizeLookup(text, limit, numberKey) {
  return readJsonPage(text, limit, (row) => {
    if (typeof row.title !== 'string') return { detail: 'a row carried no readable title' };
    const fingerprint = fingerprintInTitle(row.title);
    if (fingerprint === null) return null;
    const number = issueNumber(row[numberKey]);
    if (number === null) return { detail: `a row carrying a Cadence token had no readable ${numberKey}` };
    return { record: { fingerprint, number } };
  });
}

/**
 * How each provider's CLI is told to create an issue and look one up: a row per provider, with an argv builder and
 * stated facts beside it, as `CREATE_TABLE` in forge-decision.mjs does. The flags were read from each CLI's `--help`.
 * No row reads an issue number back from a create, because none of the three prints anything machine-readable.
 * `limit` is the page size `HOST_TABLE` in issue-decision.mjs states, and `numberKey` the field holding the number.
 * `visibility` is the argv asking public, private or internal, or null where the CLI can't; unreadable reads as public.
 */
export const FILING_TABLE = Object.freeze({
  forgejo: Object.freeze({
    // an unqualified `tea --repo` falls back to config file order, so a stranger's tracker would get the write
    needsLogin: true,
    limit: 50,
    numberKey: 'index',
    lookupMeasured: true,
    visibilityMeasured: false,
    /** No query: tea's docs list no visibility field and no command that views one repository, and `repos search
     *  --private` answers "no row" for both "not that kind" and "no such name". So the ask face shows public.
     *  If a later tea adds a query, flip the flag only after a live run against a public and a private repository.
     *  @type {null} */
    visibility: null,
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @param {string} login @returns {string[]} */
    create: (slug, issue, login) => ['issues', 'create', '--repo', slug,
      '--login', login, '--title', issue.title, '--description', issue.body,
      ...(issue.declined ? ['--labels', DECLINE_LABEL] : [])],
    /** Measured live on a Forgejo instance, which is what `lookupMeasured: true` records. `--keyword` on one token
     *  found its issue, and two space-joined tokens found both, so tea reads that as more than one term.
     *  A token no title carried returned `[]`, so an empty answer is real evidence: a complete miss is final and
     *  overrules a confirmed FILED.md row, as on github. Space-joining is the only spelling tea offers (no OR).
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
    /** Measured against a live repo, which answered `{"visibility":"PUBLIC"}`.
     *  gh's value is upper case (PUBLIC, PRIVATE, INTERNAL); `normalizeVisibility` folds the case.
     *  @param {string} slug @returns {string[]} */
    visibility: (slug) => ['repo', 'view', slug, '--json', 'visibility'],
    /** @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--body', issue.body,
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** Measured live: `in:title` plus the tokens joined with ` OR ` returned exactly the issues titled with them.
     *  Bare tokens also matched a body, and a body match is a discussion of a finding, not a filing of it.
     *  That is what `lookupMeasured: true` records, so a complete miss here is trusted over a confirmed ledger row.
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
    /** Not measured: `glab repo view --output json` is documented to print the project object, whose `visibility` is
     *  `public`, `internal` or `private`. If glab's JSON drops that key, the answer reads as public.
     *  @param {string} slug @returns {string[]} */
    visibility: (slug) => ['repo', 'view', slug, '--output', 'json'],
    /** `-y` isn't optional: without it glab asks for confirmation and the child blocks inside a gate step.
     *  @param {string} slug
     *  @param {{title: string, body: string, declined: boolean}} issue
     *  @returns {string[]} */
    create: (slug, issue) => ['issue', 'create', '--repo', slug,
      '--title', issue.title, '--description', issue.body, '-y',
      ...(issue.declined ? ['--label', DECLINE_LABEL] : [])],
    /** Assumed, not measured, and the only row that is: that `--search` with `--in title` matches a bracketed hex
     *  token, and that space-joined tokens read as more than one term. Wrong either way it returns nothing for an
     *  issue that exists, so `lookupMeasured` is false and a confirmed FILED.md row keeps suppressing.
     *  To measure it, file an issue titled `[cadence <hex>] ...` on a live GitLab project, run this argv for one
     *  token and then two, and flip the flag only if both come back. `--in title` keeps body matches out.
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
 * `read` says whether the word came off the forge. Anything else (unparseable stdout, a missing key, an unknown word)
 * is `public` with `read: false`, the direction that asks harder. The caller answers a nonzero exit or timeout the
 * same way. gh spells the word upper case and GitLab lower, so the case is folded.
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
