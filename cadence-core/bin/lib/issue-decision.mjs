// @ts-check
// issue-decision.mjs - the pure core of the /cad-land tracker report: a frozen per-host table plus total functions that
// decide which issues this branch references and which are still open, or the one line saying why nothing can be reported.
// No I/O: issue-check.mjs supplies the live readings and cad-land prose prints the sentence. Unknown input never throws.
// missingForgeKeys comes from forge-decision.mjs instead of being restated: setup asks on that rule and this file calls on
// it, and two copies would re-ask a settled question or call a forge with no selector. Nothing here writes; closing is an explicit ask.
// The CLI argv in HOST_TABLE was checked against the installed tools (gh 2.x, tea 0.15.1, glab 1.114.0), not recalled, and
// each row is proved by a PATH-injected stub rather than a spawn, which would put a real tracker inside a unit test.
// Every row carries a paging flag: the CLIs cap a bare list at 30 and a real tracker holds more, so an unbounded call
// would report a referenced issue as not-found while looking like a small project. A response that fills its page is
// incomplete, because a truncated page and an empty tracker produce the same records.

'use strict';

import { missingForgeKeys, splitForgeHost } from './forge-decision.mjs';

/** open / closed, normalized across the three CLIs' spellings.
 * @param {string} raw @returns {'open'|'closed'|null} */
function normalizeState(raw) {
  const s = raw.toLowerCase();
  if (s === 'open' || s === 'opened') return 'open';
  if (s === 'closed') return 'closed';
  return null;
}

/** An issue number however its CLI spells it: `tea issues list` prints `index` as a string and `tea issues <index>` as a
 * number, so both readers share this. Outside the safe-integer range is null, because 9007199254740993 reads back as
 * ...992 and partitionIssues would answer about a different issue than the tracker holds.
 * @param {unknown} raw @returns {number|null} */
function normalizeNumber(raw) {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) ? raw : null;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

/**
 * One CLI response -> the `{number, state}` records plus whether the read is complete. Total, and an incomplete answer
 * carries no records, so a partial page can't be mistaken for the whole tracker.
 * `detail` is a fixed phrase, never a slice of the response: a forge CLI's bytes aren't ours to put in an envelope.
 *
 * @param {unknown} text the CLI's stdout
 * @param {number} limit the page size the argv asked for
 * @param {string} numberKey which field carries the issue number
 * @returns {{complete:boolean, records:Array<{number:number,state:'open'|'closed'}>, detail:string|null}}
 */
function normalizeList(text, limit, numberKey) {
  const bad = (detail) => ({ complete: false, records: [], detail });
  if (typeof text !== 'string') return bad('response was not text');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return bad('response was not JSON'); }
  if (!Array.isArray(parsed)) return bad('response was not a JSON array');
  /** @type {Array<{number:number,state:'open'|'closed'}>} */
  const records = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') return bad('a row was not an object');
    const rawState = /** @type {Record<string, unknown>} */ (row).state;
    const number = normalizeNumber(/** @type {Record<string, unknown>} */ (row)[numberKey]);
    const state = typeof rawState === 'string' ? normalizeState(rawState) : null;
    // A renamed or missing field fails the whole read: dropping the row is how a rename turns into a not-found verdict.
    if (number === null || state === null) return bad(`a row carried no readable ${numberKey}/state`);
    records.push({ number, state });
  }
  if (records.length >= limit) return bad(`the response filled the ${limit}-row page and may be truncated`);
  return { complete: true, records, detail: null };
}

/**
 * One issue's state out of a per-issue response, or null when it doesn't answer for that number. Takes an object or a
 * one-element array, since the CLI has printed both. Null is the only failure answer and renders `unresolved`, never
 * `not-found`: tea exits nonzero for a missing issue and a failed read alike, and stderr is discarded.
 * @param {unknown} text @param {number} number
 * @returns {'open'|'closed'|null}
 */
function readOneIssue(text, number) {
  if (typeof text !== 'string') return null;
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1) return null;
    parsed = parsed[0];
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const row = /** @type {Record<string, unknown>} */ (parsed);
  if (normalizeNumber(row.index) !== number) return null;
  return typeof row.state === 'string' ? normalizeState(row.state) : null;
}

/**
 * Host -> the one bounded list call per land, and the reader for its response. Never one call per referenced number.
 * The repo slug is always passed: gh and glab would infer it from cwd, and tea infers nothing.
 * Limits are the largest page each side really serves: gh 200 (pages internally), glab 100 (GitLab's per_page ceiling),
 * tea 50 (the server clamps; --limit 100 and 200 both returned exactly 50).
 * The forgejo row names its instance with --login and `login` is required, because tea without one falls back to config
 * file order and reports a stranger's tracker as this repo's. tea 0.15.1's --login takes a login name only and --repo
 * carries no host, so a host reaches tea only through the `tea login list` record whose url names it.
 * Forgejo alone lists --state open and carries a `resolve`: --state all filled the clamped 50-row page on any real
 * tracker and the whole report degraded to a skip. So a number missing from the list is closed or absent, and `resolve`
 * makes one bounded `tea issues <index>` call for it. Paging the list was rejected as more latency on the land path.
 */
export const HOST_TABLE = Object.freeze({
  github: Object.freeze({
    bin: 'gh',
    limit: 200,
    /** @param {string} slug @param {number} limit @returns {string[]} */
    argv: (slug, limit) => ['issue', 'list', '--repo', slug, '--state', 'all',
      '--json', 'number,state', '--limit', String(limit)],
    /** @param {unknown} text @param {number} limit */
    normalize: (text, limit) => normalizeList(text, limit, 'number'),
  }),
  gitlab: Object.freeze({
    bin: 'glab',
    limit: 100,
    /** @param {string} slug @param {number} limit @returns {string[]} */
    argv: (slug, limit) => ['issue', 'list', '--repo', slug, '--all',
      '--output', 'json', '--per-page', String(limit)],
    /** @param {unknown} text @param {number} limit */
    normalize: (text, limit) => normalizeList(text, limit, 'iid'),
  }),
  forgejo: Object.freeze({
    bin: 'tea',
    limit: 50,
    /** @param {string} slug @param {number} limit @param {string} login
     * @returns {string[]} */
    argv: (slug, limit, login) => ['issues', 'list', '--repo', slug,
      '--login', login, '--state', 'open',
      '--fields', 'index,state', '--output', 'json', '--limit', String(limit)],
    /** @param {unknown} text @param {number} limit */
    normalize: (text, limit) => normalizeList(text, limit, 'index'),
    // --login works on the single-issue form as well as `list`, and there's no --state because the number is named.
    resolve: Object.freeze({
      /** @param {string} slug @param {number} number @param {string} login
       * @returns {string[]} */
      argv: (slug, number, login) => ['issues', String(number), '--repo', slug,
        '--login', login, '--fields', 'index,state', '--output', 'json'],
      /** @param {unknown} text @param {number} number */
      read: (text, number) => readOneIssue(text, number),
    }),
  }),
});

/** Everything that would stop a degradation reason being one line: C0 controls (ESC included), DEL, C1 and the two Unicode
 * line separators. The hostname classes below admit all of them and the host is interpolated into the reasons. */
const NOT_ONE_LINE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** `scheme://[user@]host[:port]` as `[, scheme, hostname, port]`. One spelling, since two would disagree once one learned ports. */
const AUTHORITY = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(?:[^@/]*@)?([^/:]+)(?::(\d+))?/;

/** The http(s) port an authority names, as one comparable string, or null.
 *
 * Only http(s) ports compare against a `tea login list` record's API url. An ssh:// port like 2222 would read as a
 * mismatch against the same instance's 443, so every other scheme answers null and the hostname decides alone.
 * The scheme's default is the port, not an absence: `https://h` and `https://h:443` are one endpoint, and `:0443` is `:443`.
 * A port that isn't a number answers null rather than a string nothing can equal.
 * @param {string} scheme @param {string|undefined} explicit
 * @returns {string|null} */
function httpPortOf(scheme, explicit) {
  const s = scheme.toLowerCase();
  if (s !== 'http' && s !== 'https') return null;
  if (!explicit) return s === 'https' ? '443' : '80';
  const n = Number(explicit);
  return Number.isSafeInteger(n) ? String(n) : null;
}

/** `https://host[:port]/owner/repo[.git]` and the scp-shaped `[user@]host:owner/repo[.git]`, the two forms cad-land meets.
 *
 * A hostname carrying anything from NOT_ONE_LINE is rejected, not cleaned: no forge serves one, and a stripped hostname
 * would print back as what the user configured. The caller reads null as unrecognized.
 * The port is carried because dropping it made two Forgejo instances on one machine, on ports 3000 and 3001, one host. The scp
 * form has none: its colon splits host from path, and its transport is SSH.
 * `portSpelled` is a different fact from the port: whether the URL wrote one at all. It comes off the same AUTHORITY match.
 * @param {string} url
 * @returns {{hostname:string, path:string, httpPort:string|null,
 *   portSpelled:boolean}|null} */
function splitOrigin(url) {
  const parsed = (hostname, path, httpPort, portSpelled) =>
    (NOT_ONE_LINE.test(hostname)
      ? null : { hostname: hostname.toLowerCase(), path, httpPort, portSpelled });
  const schemed = new RegExp(AUTHORITY.source + '\\/(.+)$').exec(url);
  if (schemed) {
    return parsed(schemed[2], schemed[4], httpPortOf(schemed[1], schemed[3]),
      schemed[3] !== undefined);
  }
  // scp: the colon splits host from path, so a `/` right after it is a schemeless URL, not scp syntax.
  const scp = /^(?:[^@/]*@)?([^/:]+):(?!\/)(.+)$/.exec(url);
  if (scp) return parsed(scp[1], scp[2], null, false);
  return null;
}

/**
 * Does one `tea login list` record name this host, and this port when the caller knows it? A login identifies its forge
 * by its `name`, its API url's hostname and its `ssh_host`, compared lowercased and exactly. No suffix or registrable-domain
 * reading, which is why no public suffix list is needed.
 * The port check lives here because teaLoginNameForHost and forge.mjs's create arm both reach this predicate. Two instances
 * on one hostname at different ports looked identical, so a create could pin --login to the wrong one. A port rule in
 * either caller would let the two paths disagree.
 * The port is a veto, not a new requirement: with none, behaviour is unchanged, and with one a login is refused only when it
 * names this hostname under a different http(s) port. A login whose url names another hostname is the ordinary split-endpoint
 * shape, not a mismatch. Two logins on one hostname with no differing port still tie, and tea's list order wins.
 *
 * @param {unknown} login @param {string} host
 * @param {string|null} [httpPort] the http(s) port the caller's URL names, or
 *   null when it names none that can be compared
 * @returns {boolean}
 */
export function loginNamesHost(login, host, httpPort = null) {
  if (!login || typeof login !== 'object') return false;
  const rec = /** @type {Record<string, unknown>} */ (login);
  const api = typeof rec.url === 'string' ? AUTHORITY.exec(rec.url) : null;
  const apiHost = api ? api[2].toLowerCase() : null;
  const apiPort = api ? httpPortOf(api[1], api[3]) : null;
  if (httpPort !== null && apiHost === host && apiPort !== null && apiPort !== httpPort) return false;
  for (const field of ['name', 'ssh_host']) {
    const v = rec[field];
    if (typeof v === 'string' && v.toLowerCase() === host) return true;
  }
  return apiHost === host;
}

/**
 * Classify the origin URL into a setup-time default: which forge it suggests and which `owner/name` it carries.
 * Its only caller is `forge.mjs detect`. issue-check.mjs doesn't call it: the persisted git.forge_* record answers at land
 * time, so a repo that loses its remote doesn't change behaviour. The `no-login` line moved to decideIssueCheck.
 * Verdicts: github / gitlab (the hostname identifies it), no-remote (no origin URL), unrecognized (anything else). That's
 * not a failure: the slug still comes back when the path parsed, and a self-hosted forge is the ordinary case.
 * Matching is on hostname only (`github.com`, `gitlab.com` and subdomains). Guessing from a first label would be a heuristic
 * this file can't be right about, and the user is asked anyway.
 * `httpPort` is its own field so a caller naming one instance (forge.mjs create, pinning --login) needn't reread the URL.
 * `portSpelled` says what a null httpPort can't: no port written (the scp form) or one written over a scheme whose port
 * isn't comparable (ssh://git@host:2222/o/r.git).
 *
 * @param {unknown} originUrl the `git remote get-url origin` text, or ''/null
 * @returns {{verdict:'github'|'gitlab'|'no-remote'|'unrecognized',
 *   host:string|null, httpPort:string|null, portSpelled:boolean, slug:string|null}}
 */
export function classifyOrigin(originUrl) {
  const url = typeof originUrl === 'string' ? originUrl.trim() : '';
  if (!url) return { verdict: 'no-remote', host: null, httpPort: null, portSpelled: false, slug: null };
  const parts = splitOrigin(url);
  if (!parts) return { verdict: 'unrecognized', host: null, httpPort: null, portSpelled: false, slug: null };
  const segments = parts.path.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  // owner and name both, or there's no repo selector worth offering as a default.
  const slug = segments.length >= 2 ? segments.join('/') : null;
  const host = parts.hostname;
  const httpPort = parts.httpPort;
  const portSpelled = parts.portSpelled;
  if (!slug) return { verdict: 'unrecognized', host, httpPort, portSpelled, slug: null };
  if (host === 'github.com' || host.endsWith('.github.com')) return { verdict: 'github', host, httpPort, portSpelled, slug };
  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) return { verdict: 'gitlab', host, httpPort, portSpelled, slug };
  return { verdict: 'unrecognized', host, httpPort, portSpelled, slug };
}

/**
 * The name of the first `tea login list` record that names `host`, or null.
 * It turns the persisted git.forge_host into the login name `tea --login` requires (see HOST_TABLE). Null is the caller's
 * cue to skip on the `no-login` line rather than call without one and let tea fall back to config order.
 * First in tea's own list order, on purpose: two accounts on one instance is a real shape and any pick between them would
 * invent a preference. Arbitrary but stable beats a pick that moves.
 * It takes `host[:port]`: splitForgeHost splits it with the one grammar and the port goes to loginNamesHost as httpPort,
 * so two instances on one hostname no longer land against whichever login came first. There's no normalization step
 * because that grammar already refuses leading zeros.
 * A host the grammar refuses answers null, like an empty one. It couldn't have been persisted through the write face.
 *
 * @param {unknown} logins the `tea login list --output json` reading, or null
 * @param {unknown} host the persisted instance host, `hostname` or `hostname:port`
 * @returns {string|null} the login's `name`, or null when none matches
 */
export function teaLoginNameForHost(logins, host) {
  if (!Array.isArray(logins)) return null;
  if (typeof host !== 'string' || !host.trim()) return null;
  const split = splitForgeHost(host.trim());
  if (!split) return null;
  const wanted = split.hostname.toLowerCase();
  for (const login of logins) {
    if (!loginNamesHost(login, wanted, split.port)) continue;
    const name = login && typeof login === 'object' ? login.name : null;
    if (typeof name === 'string' && name) return name;
  }
  return null;
}

/**
 * The issue numbers a `git log <base>..HEAD` body references, deduplicated and ascending. `#N`, `closes #N` and `fixes #N`
 * are one shape, so matching the token covers all three without a keyword list the fourth spelling is missing from.
 * The `#` needs start-of-text or a non-word, non-`#` before it, and a word boundary after the digits. That keeps out a
 * sha (no `#` at all), `abc#42`, `## 3 things` (a heading), `##3` and `#42abc`.
 * A reference outside the safe-integer range is left out: there's no envelope to refuse into here, and a 400-digit one
 * names no issue and would make us ask the tracker about Infinity.
 *
 * @param {unknown} logText @returns {number[]}
 */
export function scanIssueRefs(logText) {
  if (typeof logText !== 'string' || !logText) return [];
  const found = new Set();
  const re = /(^|[^\w#])#(\d+)\b/g;
  let m;
  while ((m = re.exec(logText)) !== null) {
    const n = Number(m[2]);
    if (Number.isSafeInteger(n)) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Open / closed / not-found for each referenced number, over one fetch. Not-found is its own answer and never renders as
 * closed, because the whole value is that "#42 is still open" can be trusted.
 * It answers only over a complete fetch, else null and the caller degrades to its one line. A truncated page and an empty
 * tracker carry the same records, and inferring not-found from the first is the wrong answer.
 *
 * @param {unknown} numbers
 * @param {unknown} fetched a normalizer return
 * @returns {{open:number[], closed:number[], notFound:number[]}|null}
 */
export function partitionIssues(numbers, fetched) {
  const f = /** @type {{complete?:unknown, records?:unknown}} */ (fetched);
  if (!f || typeof f !== 'object' || f.complete !== true || !Array.isArray(f.records)) return null;
  /** @type {Map<number,string>} */
  const states = new Map();
  for (const r of f.records) {
    if (r && typeof r === 'object' && typeof r.number === 'number') states.set(r.number, r.state);
  }
  const wanted = Array.isArray(numbers) ? numbers.filter((n) => typeof n === 'number') : [];
  /** @type {{open:number[], closed:number[], notFound:number[]}} */
  const out = { open: [], closed: [], notFound: [] };
  for (const n of wanted) {
    const state = states.get(n);
    if (state === 'open') out.open.push(n);
    else if (state === 'closed') out.closed.push(n);
    else out.notFound.push(n);
  }
  return out;
}

/**
 * A value safe to put in a degradation line, or a stand-in phrase.
 * The `no-login` reason names git.forge_host, which a user can set to anything, so the NOT_ONE_LINE classes guard this
 * sentence too: the origin-parsing guard no longer sits between config and here.
 * Replaced whole, never stripped: a cleaned host would read as what the user configured. The phrase still points at the fix.
 * @param {unknown} host @returns {string}
 */
function oneLine(host) {
  if (typeof host !== 'string' || !host.trim()) return 'the configured Forgejo instance';
  return NOT_ONE_LINE.test(host) ? 'the configured Forgejo instance' : host;
}

/**
 * Should the seam query the tracker, and if not, why, in the one line /cad-land step 1 prints and carries on past.
 * `{action, reason}` with `query`, `skip` or `off`, so cad-land branches on `action` alone and every skip has its own reason.
 * `off` is its own action, not a skip: a skip is a degradation, while the key set false is the user's instruction and step 1
 * then says nothing. Folding it in would make the caller match a reason string, and matching prose turns a rewording into a regression.
 * Total and staged: every field past `enabled` is optional and absent means not known yet, so the seam calls this again after
 * each reading. Only an explicit `false` or an explicit incomplete fetch stops the run.
 * The forge arm names the unset git.forge_* keys, and the `no-login` arm means no tea login serves the persisted host.
 * Seven reasons, in the order asked: key off, no forge configured, no tea login, commits unreadable, CLI not on PATH,
 * CLI killed at the bound or exited nonzero (two lines, since "it hung" and "it refused" are different fixes), and a
 * zero exit with a response that wasn't a complete list.
 *
 * @param {{enabled?:boolean,
 *   forge?:{provider?:unknown, repo?:unknown, host?:unknown},
 *   loginName?:string|null,
 *   logOk?:boolean, bin?:string, cliPresent?:boolean, exitOk?:boolean,
 *   timedOut?:boolean, fetched?:{complete?:boolean, detail?:string|null}|null}} args
 * @returns {{action:'query'|'skip'|'off', reason:string}}
 */
export function decideIssueCheck({ enabled, forge, loginName, logOk, bin, cliPresent, exitOk, timedOut, fetched } = {}) {
  const skip = (reason) => ({ action: /** @type {'skip'} */ ('skip'), reason });
  // Anything but a literal true is off, an absent argument included: this is asked before any subprocess starts.
  if (enabled !== true) {
    return {
      action: /** @type {'off'} */ ('off'),
      reason: 'git.issue_check is off: no tracker report, and no forge CLI was run',
    };
  }
  if (forge) {
    const missing = missingForgeKeys(forge);
    if (missing.length) {
      return skip(`this repository has no forge configured (${missing.join(', ')} unset - `
        + '/cad-adopt or /cad-new-project asks for them): no tracker report');
    }
  }
  // null: the login list was read and named none. undefined: not read yet, which is no reason to stop.
  if (loginName === null) {
    return skip(`tea holds no login for ${oneLine(forge && forge.host)}: no tracker report`);
  }
  if (logOk === false) {
    return skip('the commits on this branch could not be read, so no issue reference could be scanned: no tracker report');
  }
  const cli = bin || 'the forge CLI';
  if (cliPresent === false) {
    return skip(`the ${cli} CLI is not on PATH: no tracker report`);
  }
  if (exitOk === false) {
    return timedOut === true
      ? skip(`${cli} did not answer inside the call bound and was killed: no tracker report`)
      : skip(`${cli} exited nonzero: no tracker report`);
  }
  if (fetched && fetched.complete !== true) {
    const why = fetched.detail ? ` (${fetched.detail})` : '';
    return skip(`${cli} returned a response this seam could not read as a complete issue list${why}: no tracker report`);
  }
  return { action: 'query', reason: `${cli} can be asked for this repository's issues` };
}
