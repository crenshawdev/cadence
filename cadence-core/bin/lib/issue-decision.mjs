// @ts-check
// issue-decision.mjs - the pure, testable core of the /cad-land tracker report
// (LND-01). Zero-dep (node builtins only, and it uses none): one frozen
// per-host table plus four TOTAL functions that decide, from an origin URL, a
// `tea login list` reading, a `git log <base>..HEAD` body and one forge-CLI
// response, WHICH issues this branch references and which of them are still
// open - or which single line says why nothing can be reported.
// It never spawns a CLI, never runs git and never does I/O - issue-check.mjs
// supplies the live readings, and cad-land prose prints the sentence. Mirrors
// close-decision.mjs's discipline: unknown or missing inputs never throw.
//
// ONE IMPORT, AND IT IS THE FORGE RECORD'S OWN RULE. `missingForgeKeys` says
// which of `git.forge_provider`, `git.forge_repo` and `git.forge_host` are
// still unanswered, and it is imported from lib/forge-decision.mjs rather than
// restated here: the setup step decides whether to ASK on that rule and this
// file decides whether to CALL on it, and a tree where those two disagree
// either re-asks a settled question or calls a forge it has no selector for.
// Same discipline as lib/on-path.mjs - one rule, two callers, no way to drift.
//
// NOTHING HERE WRITES. The whole surface answers questions about a tracker; no
// row's argv closes, reopens, comments on or edits an issue, and there is no
// function that could. Landing reports; closing stays an explicit ask.
//
// The three CLI rows are EXTERNAL facts, confirmed 2026-08-15 rather than
// recalled:
//   gh   `gh issue list --help` on gh 2.x here: `--state all`, `--json
//        number,state`, `-R/--repo [HOST/]OWNER/REPO`, `-L/--limit int
//        (default 30)`. Live sample: [{"number":14156,"state":"OPEN"}].
//        `--limit` pages internally, so 60 rows come back for `--limit 60`.
//   tea  `tea issues list --help` on tea 0.9.x here: `--state all|open`,
//        `--fields index,state`, `--output json`, `--repo`, `--limit int
//        (default 30)`. Live sample: [{"index":"171","state":"open"}] - `index`
//        is a STRING. `tea issues <index> --repo <slug> --fields index,state
//        --output json` reads one issue, and prints its `index` as a NUMBER.
//   glab `glab issue list` published docs (gitlab-org/cli, docs/source/issue/
//        list.md, read 2026-08-15): `-A/--all` (both states), `-O/--output
//        json`, `-P/--per-page int (default 30)`, `-R/--repo OWNER/REPO`. The
//        json arm prints the API issue objects, whose number is `iid` and whose
//        state is `opened`/`closed`. Corrected 2026-08-25: `glab` IS installed
//        here - `/usr/bin/glab`, version 1.114.0 - and the four flags above are
//        confirmed against its own `--help`, so the row is no longer proved by
//        a captured sample alone. What is UNCHANGED is the discipline: this row
//        is proved by a PATH-injected stub and never by a spawn, the same way
//        the `gh` and `tea` rows are. That was never a consequence of the
//        binary being absent - a live spawn would put a real tracker inside a
//        unit test - so nothing about the row moves now that it is present.
//
// WHY EACH ROW CARRIES A PAGING FLAG. All three CLIs cap a bare `issue list` at
// 30 rows. This repo's own tracker holds over 170, so an unbounded call would
// report a referenced issue as not-found while looking exactly like a small
// project - the one failure this check must never produce. The limits are the
// largest page each side actually serves, which is not the same as the largest
// number the flag accepts:
//   gh    200 - `--limit` pages internally, so the row count is the real answer
//   glab  100 - the GitLab API's per_page ceiling
//   tea    50 - measured against a live Gitea/Forgejo instance 2026-08-15:
//               `--limit 100` and `--limit 200` both returned exactly 50, and
//               `--page 2` returned the next 50, so the server clamps the page
//               and a bigger number buys nothing but a false sense of coverage.
// A response that FILLS its page is therefore reported incomplete, and the
// caller degrades to one line instead of answering. That is deliberate and it
// is the conservative direction: a truncated page and an empty tracker produce
// the same records, and only one of them means "#42 does not exist".
//
// tea's clamp is the reason the forgejo row asks `--state open` and carries a
// per-issue `resolve`: at `--state all` a real tracker fills the 50-row page,
// so the honest incomplete read was the only thing this seam ever produced on
// the repository it was built in. See HOST_TABLE's own header.

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

/** An issue number however its CLI spells it: `tea issues list` prints `index`
 * as a STRING and `tea issues <index>` prints it as a NUMBER (both measured
 * 2026-08-15), so the two readers below share one normalization rather than
 * disagreeing about which `42` is the referenced one.
 *
 * A number OUTSIDE the safe-integer range is no readable number, and `null` -
 * this function's existing "no readable number" answer, which both call sites
 * already act on - is what it gets. Unguarded, `9007199254740993` read back as
 * `9007199254740992` and a 400-digit one as `Infinity`, so `partitionIssues`
 * answered about a DIFFERENT issue than the tracker holds, which is the whole
 * value of "#42 is still open" gone.
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
 * One CLI response -> the `{number, state}` records the partition consumes,
 * plus whether the read is COMPLETE. Total: any input at all answers, and an
 * incomplete answer carries NO records, so a caller cannot accidentally treat a
 * partial page as the whole tracker.
 *
 * `detail` is a fixed phrase, never a slice of the response: the bytes a forge
 * CLI prints are not this seam's to put in an envelope.
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
    // A renamed or missing field fails the WHOLE read rather than dropping the
    // row: dropping it is how a renamed field becomes a not-found verdict.
    if (number === null || state === null) return bad(`a row carried no readable ${numberKey}/state`);
    records.push({ number, state });
  }
  if (records.length >= limit) return bad(`the response filled the ${limit}-row page and may be truncated`);
  return { complete: true, records, detail: null };
}

/**
 * ONE issue's state out of a per-issue response, or null when the response does
 * not answer for THAT number. Accepts a single object or a one-element array,
 * because the CLI has printed both shapes.
 *
 * NULL IS THE ONLY FAILURE ANSWER, and the caller renders it `unresolved` -
 * never `not-found`. `tea` exits nonzero both for an issue that does not exist
 * and for a read that failed, and this seam discards child stderr by contract,
 * so a not-found here would be an affirmative answer about input it could not
 * read - the failure `partitionIssues` was written to refuse.
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
 * Host -> the ONE bounded list call this seam makes per land, and the reader for
 * its response. Never one call per referenced number.
 *
 * `argv(slug, limit)` is byte-exact apart from its interpolations, and the repo
 * slug is always present: `gh` and `glab` would otherwise infer the repo from
 * the process cwd, and `tea` infers nothing at all.
 *
 * THE FORGEJO ROW BINDS EVERY CALL WITH `--remote origin`, and that IS the
 * binding. `--repo <owner>/<name>` names the repository but not the login, and
 * tea resolves an unqualified one in config FILE ORDER - so the first login in
 * the user's config could answer for a repository it has never heard of, exit 0
 * and all (D-07). `--remote origin` tells tea to discover the login from the
 * checkout's own `origin` remote instead (`--remote string, -R string: Discover
 * Gitea login from remote`, tea 0.15.1). The two flags compose - measured
 * 2026-08-15: with `--repo forgejo/forgejo --remote origin` in a checkout whose
 * origin is codeberg.org, tea answered from the codeberg login even though it
 * sits SECOND in the config. The seam always spawns with `cwd` set to the
 * repository `--dir` names, which is what makes `origin` resolvable at all.
 *
 * THE ONE LIMIT OF DELEGATING IT, and why the call is guarded rather than the
 * binding: when NO login's host names the remote's host, tea does not refuse.
 * It prints `NOTE: no login matched this repository, falling back to login
 * '<first>' in non-interactive mode.` on STDERR, exits 0, and answers from
 * config order - i.e. a stranger's tracker, reported as this repository's. This
 * seam cannot SEE that happen: the NOTE is on stderr, which the caller discards
 * by contract (issue-check.mjs's header), tea 0.15.1 offers no
 * strict/no-fallback flag, and no subcommand reports which login answered.
 *
 * So it does not try to see it - it declines to ASK. `classifyOrigin` answers
 * `no-login` unless some login NAMES the origin host exactly, which is the same
 * condition tea itself falls back on, read from the same login list. That is a
 * precondition on making the call, NOT a rule for picking a login: which login
 * serves this remote is still tea's answer via `--remote origin`, and this file
 * makes no host judgment beyond equality. The distinction matters because the
 * PICKING rule was tried twice and could not be made correct without a vendored
 * public suffix list (see classifyOrigin); the guard needs no such list, because
 * exact equality guesses at nothing. The fix for a remote that fails it is a
 * login whose `ssh_host` names the remote's host, and the `no-login` line says
 * so. `gh` and `glab` need no equivalent: neither is multi-account-ambiguous
 * the way tea's `--repo` fallback is.
 *
 * THE FORGEJO ROW NAMES ITS INSTANCE WITH `--login`, NOT `--remote origin`
 * (phase 1 D-01, D-08, AC4). It carried `--remote origin` until the persisted
 * forge record existed: that flag hands the login pick to tea, which reads the
 * CHECKOUT's own remote - so a repository that has lost `origin`, or that is
 * being reported on from a tree where the remote was never added, had no way to
 * name an instance at all and the report degraded. The persisted
 * `git.forge_host` is what replaces it, turned into a login NAME by
 * `teaLoginNameForHost` below and handed to every call this row builds.
 *
 * Measured on the installed tea 0.15.1, because no source states it: `--login`
 * takes a configured login's NAME and nothing else (`--login git.example.com`
 * against a config holding that URL under another name answers `login name
 * 'git.example.com' does not exist`), `--repo` carries no host in any spelling
 * (`host/owner/repo` is read as owner `host`), and `--remote` names a git
 * remote. So a host reaches tea only by way of the `tea login list --output
 * json` record whose `url` names it.
 *
 * `login` is REQUIRED on this row, never optional and never omitted when null:
 * an unqualified `--repo` falls back to config FILE ORDER, which is how a
 * stranger's tracker gets reported as this repository's, and the caller's job
 * is to skip rather than to call without one. `github` and `gitlab` take no
 * third argument - their hosts are fixed and neither is multi-account-ambiguous
 * the way tea's `--repo` is.
 *
 * THE FORGEJO ROW ALONE LISTS `--state open` AND CARRIES A `resolve`. The
 * server clamps `tea issues list` at 50 rows whatever `--limit` asks for
 * (`--limit 50`, `100` and `200` each returned exactly 50 against this repo's
 * tracker of 180+, and Codeberg - a different instance under different
 * administration - clamps identically), so `--state all` filled its page on any
 * real tracker, `normalizeList` correctly reported the read incomplete, and the
 * whole report degraded to a skip line. `--state open` returned 19 rows here: a
 * complete read. What that costs is that a referenced number missing from the
 * list is now closed OR absent rather than absent, so the row carries
 * `resolve` - one bounded `tea issues <index>` per unanswered number, capped at
 * the caller's own constant. Paging the list was rejected: it widens the seam
 * past its stated one bounded call per land and puts more network latency on
 * the land path. `github` and `gitlab` keep `--state all` and get no resolve -
 * `gh` pages internally to its `--limit`, and `glab` pages to its `--per-page`
 * (100, the GitLab API's own ceiling), so both rows' reads are COMPLETE and
 * there is nothing for a `resolve` to resolve. Corrected 2026-08-25: the reason
 * given here used to be that `glab` was not installed here and that inventing
 * its argv would therefore ship an untestable change. It is installed - `/usr/bin/glab`, version
 * 1.114.0 - so that reason was false as well as beside the point; the paging
 * behaviour is what the row turns on.
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
    // All five flags exist on the installed tea, and `--login` on the
    // single-issue form as well as on `list` (`tea issues --help` and
    // `tea issues list --help`). No `--state`: the number is named directly.
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

/** Everything that would stop a degradation reason being ONE line: the C0
 * controls (newline and CR, and the ESC that opens an ANSI sequence), DEL, the
 * C1 range, and the two Unicode line separators. The hostname classes below are
 * `[^/:]+`, which admits every one of them, and the hostname is interpolated
 * straight into the unrecognized and no-login reasons - so `origin` set to
 * `https://evil.example\nINJECTED/org/repo.git` would print two lines, or
 * terminal control sequences, where criterion 3 promises exactly one. */
const NOT_ONE_LINE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** The `[A-Za-z][A-Za-z0-9+.-]*://[user@]host[:port]` authority, as
 * `[, scheme, hostname, port]`. ONE spelling of it, because two would be two
 * answers to "which instance is this" the moment one of them learned about
 * ports and the other did not. */
const AUTHORITY = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(?:[^@/]*@)?([^/:]+)(?::(\d+))?/;

/** The HTTP(S) port an authority names, as one comparable string, or null.
 *
 * WHY IT IS THE http(s) PORT AND NOT "THE PORT". This value exists to be
 * compared against a `tea login list` record's API `url`, which is always http
 * or https - so that is the only port on either side that can be compared with
 * the other at all. `ssh://git@host:2222/o/r.git` names an SSH port, and
 * reading 2222 as a mismatch against the same instance's API 443 would refuse
 * the split-endpoint shape this repository itself has. Every non-http(s)
 * scheme therefore answers null, which reads as "no comparable port" and
 * leaves the hostname to decide by itself, exactly as it did before ports were
 * carried at all.
 *
 * THE SCHEME'S DEFAULT IS THE PORT, not an absence. `https://h` and
 * `https://h:443` are one endpoint written two ways, and treating the
 * unspelled one as "unported" would make them differ the moment a login spelled
 * it out - a silent mismatch on the commonest configuration there is. A port
 * with leading zeros or outside the safe-integer range normalizes for the same
 * reason: `:0443` and `:443` are one number, and a value that is not a number
 * at all answers null rather than a string nothing can equal.
 * @param {string} scheme @param {string|undefined} explicit
 * @returns {string|null} */
function httpPortOf(scheme, explicit) {
  const s = scheme.toLowerCase();
  if (s !== 'http' && s !== 'https') return null;
  if (!explicit) return s === 'https' ? '443' : '80';
  const n = Number(explicit);
  return Number.isSafeInteger(n) ? String(n) : null;
}

/** `https://host[:port]/owner/repo[.git]` and the scp-shaped
 * `[user@]host:owner/repo[.git]` - the two forms cad-land already meets.
 *
 * A hostname carrying anything from NOT_ONE_LINE is REJECTED, not cleaned: no
 * forge serves such a host, so there is no honest repaired form, and a stripped
 * hostname would be printed back as though it were what the user configured.
 * The caller reads null as an unrecognized origin and degrades to its own line.
 *
 * THE PORT IS CARRIED, NOT DROPPED. It used to be matched and discarded, which
 * made `https://forge.example:3000` and `https://forge.example:3001` one host
 * to everything downstream - two Forgejo instances on one machine, told apart
 * by nothing. The scp form carries none: its colon separates host from path,
 * and its transport is SSH, whose port is not the http(s) one this returns.
 * @param {string} url
 * @returns {{hostname:string, path:string, httpPort:string|null}|null} */
function splitOrigin(url) {
  const parsed = (hostname, path, httpPort) =>
    (NOT_ONE_LINE.test(hostname) ? null : { hostname: hostname.toLowerCase(), path, httpPort });
  const schemed = new RegExp(AUTHORITY.source + '\\/(.+)$').exec(url);
  if (schemed) return parsed(schemed[2], schemed[4], httpPortOf(schemed[1], schemed[3]));
  // scp-shaped: the colon separates host from PATH, so the part after it must
  // not start with `/` (that spelling is a schemeless URL, not scp syntax).
  const scp = /^(?:[^@/]*@)?([^/:]+):(?!\/)(.+)$/.exec(url);
  if (scp) return parsed(scp[1], scp[2], null);
  return null;
}

/**
 * Does one `tea login list` record NAME this host - and, when the caller knows
 * which PORT it means, that port too? The three fields a login identifies its
 * forge by - its own `name`, its API `url`'s hostname and its `ssh_host` -
 * compared lowercased and EXACTLY. No suffix, subdomain or registrable-domain
 * reading: this is the guard's whole vocabulary, and the reason it needs no
 * public suffix list is that it never asks what two hosts have in common.
 *
 * WHY THE PORT IS HERE, IN THE SHARED PREDICATE, and not in one caller. This
 * function is the ONE statement of how a tea login identifies its forge, and
 * both callers reach it: `teaLoginNameForHost` at land time, and `forge.mjs`'s
 * create arm at setup. Two Forgejo instances on one hostname at different ports
 * - `https://forge.example:3000` and `https://forge.example:3001` - were
 * indistinguishable to it, so a create could be pinned with `--login` to the
 * wrong instance and the repository land there while `origin` was set to the
 * other. A second, port-aware spelling in the caller is exactly the thing this
 * function's header forbids: it would give one path a host rule the other could
 * disagree with. So the rule moves HERE, and stays one rule.
 *
 * THE PORT IS A VETO, NOT A NEW REQUIREMENT, which is what keeps every login
 * that resolves today resolving. A `host` handed in with no port (`httpPort`
 * null - which a land-time call still is whenever the persisted
 * `git.forge_host` states no port, and it may now state one: FRG-05 gave that
 * key a `host[:port]` grammar and `teaLoginNameForHost` splits it and passes
 * both halves) behaves byte for byte as before. With a port, a
 * login is REFUSED when it names this same hostname under a DIFFERENT http(s)
 * port, and is otherwise judged by the three fields exactly as it was. That
 * closes the confirmed case - each rival login's own `url` names its port -
 * without turning a login whose `url` names another hostname entirely into a
 * mismatch, which is the ordinary split-endpoint shape (`ssh_host`
 * `ssh.example.com`, `url` `https://git.example.com`).
 *
 * WHAT IT STILL CANNOT TELL APART, stated rather than papered over: two logins
 * on one hostname where neither record's `url` names a port that differs -
 * because one carries no readable `url` at all, or because the request came in
 * over a scheme whose port is not comparable to an API url's (see
 * `httpPortOf`). There the first in tea's own list order still wins, which is
 * the arbitrary-but-STABLE rule `teaLoginNameForHost`'s header states and the
 * genuine tie it was written about. A port is not that tie: it is real
 * distinguishing information, and discarding it was the defect.
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
 * Classify the origin URL into a SETUP-TIME DEFAULT: which forge the origin
 * suggests, and which `owner/name` selector it carries.
 *
 * ITS JOB CHANGED IN PHASE 1 (D-01), AND IT HAS ONE CALLER. `bin/forge.mjs
 * detect` calls it to offer the two defaults the user CONFIRMS at project
 * setup; `bin/issue-check.mjs` no longer calls it at all. The persisted
 * `git.forge_provider` / `git.forge_repo` / `git.forge_host` record is what the
 * land-time tracker report resolves, so a repository that temporarily loses its
 * remote does not silently change behaviour - which is the failure that made
 * config authoritative and demoted this function to a default builder.
 *
 * WHAT WENT WITH THAT DEMOTION. It used to take a `tea login list` reading and
 * answer `forgejo` or `no-login` from it. Both arms are gone: setup probes no
 * login at all (D-06), so there was no reading to pass and those arms were
 * reachable from nothing. The `no-login` LINE still exists - it moved to
 * `decideIssueCheck`, where it now means that no tea login serves the instance
 * host the user CONFIRMED, which is a question about a value a human typed
 * rather than about a hostname parsed off an SSH endpoint.
 *
 * The verdicts are FOUR:
 *   github / gitlab  a forge the hostname identifies, so a provider default
 *                    can be offered
 *   no-remote        no origin URL at all - no defaults to offer
 *   unrecognized     anything else. NOT a failure: the slug is still returned
 *                    when the path parsed, and the caller offers it as a
 *                    default with no provider recommendation beside it. A
 *                    self-hosted forge is the ordinary case here, not an error.
 *
 * github and gitlab are matched on the HOSTNAME (`github.com` / `gitlab.com`
 * and their subdomains) and nothing else. A self-hosted GitLab at
 * `gitlab.example.com` therefore lands on `unrecognized` and is offered no
 * provider default; guessing a forge from a hostname's first label would be a
 * heuristic this file has no way to be right about, and the user is being asked
 * the question anyway.
 *
 * THE HOST IS A HOSTNAME AND THE PORT IS ITS OWN FIELD (`httpPort`). Two
 * Forgejo instances can sit on one hostname at different ports, so a caller
 * that has to name ONE instance - `forge.mjs create`, pinning a `tea --login` -
 * needs both halves, and reading the port back out of the URL in that caller
 * would be a second URL grammar beside this one. `httpPort` is the http(s)
 * port only (see `httpPortOf`): null on the scp form and on every other scheme,
 * where nothing a tea login records could be compared with it anyway.
 *
 * @param {unknown} originUrl the `git remote get-url origin` text, or ''/null
 * @returns {{verdict:'github'|'gitlab'|'no-remote'|'unrecognized',
 *   host:string|null, httpPort:string|null, slug:string|null}}
 */
export function classifyOrigin(originUrl) {
  const url = typeof originUrl === 'string' ? originUrl.trim() : '';
  if (!url) return { verdict: 'no-remote', host: null, httpPort: null, slug: null };
  const parts = splitOrigin(url);
  if (!parts) return { verdict: 'unrecognized', host: null, httpPort: null, slug: null };
  const segments = parts.path.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  // Two segments minimum: without owner AND name there is no repo selector, so
  // there is no slug worth offering as a default.
  const slug = segments.length >= 2 ? segments.join('/') : null;
  const host = parts.hostname;
  const httpPort = parts.httpPort;
  if (!slug) return { verdict: 'unrecognized', host, httpPort, slug: null };
  if (host === 'github.com' || host.endsWith('.github.com')) return { verdict: 'github', host, httpPort, slug };
  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) return { verdict: 'gitlab', host, httpPort, slug };
  return { verdict: 'unrecognized', host, httpPort, slug };
}

/**
 * The NAME of the first `tea login list` record that names `host`, or null.
 *
 * The other half of what phase 1 did to the login probe: the probe stays and
 * its job changes. It used to guard a CLASSIFICATION - "does any login name
 * this origin's host, and may I therefore call tea at all". It now turns the
 * persisted `git.forge_host` into the login NAME `tea --login` requires, which
 * is the only way a host reaches tea (see HOST_TABLE's forgejo row). A null
 * answer is the caller's cue to skip on the `no-login` line rather than to call
 * without a login and let tea fall back to config order.
 *
 * FIRST IN TEA'S OWN LIST ORDER, deliberately. Two logins can name one host -
 * two accounts on one instance - and any rule that picked between them would be
 * inventing a preference the user never stated. Taking the first the list names
 * is arbitrary but STABLE: the same land resolves the same login every time,
 * which is the property that matters when the alternative is a pick that moves.
 *
 * The predicate's vocabulary is UNCHANGED and stays exact equality over the
 * three fields a login identifies its forge by. Equality is what needs no
 * public suffix list - it never asks what two hosts have in COMMON - and the
 * host it is handed here was confirmed by a human at setup rather than parsed
 * off an SSH endpoint, which is the failure `loginNamesHost`'s own header
 * records.
 *
 * IT IS HANDED A `host[:port]`, NOT A BARE HOSTNAME (FRG-05). `git.forge_host`
 * carries an optional port since its write face grew a grammar, so this
 * function splits the persisted value with that ONE grammar - `splitForgeHost`
 * - and passes both halves: the hostname where the hostname goes, the port as
 * `loginNamesHost`'s `httpPort` argument. That argument existed and was null on
 * every land-time call, so a user with two instances on one hostname landed
 * against whichever login came first. The port half reaches the predicate as
 * the same comparable decimal string `httpPortOf` produces, which the grammar's
 * no-leading-zero rule is what guarantees - there is no normalization step
 * here, by design.
 *
 * A HOST THE GRAMMAR REFUSES ANSWERS NULL, the same answer an empty or
 * non-string host already gets. Null is the caller's cue to take its `no-login`
 * line, and there is no honest repair for a value that could not have been
 * persisted through the write face at all.
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
 * The issue numbers a `git log <base>..HEAD` body references, deduplicated and
 * ascending. `#N`, `closes #N` and `fixes #N` are all one shape - the keyword
 * is prose around the same token, so matching the token covers the three forms
 * the requirement names without a keyword list that the fourth spelling is
 * missing from.
 *
 * The `#` must be preceded by start-of-text, or by a character that is neither
 * a word character nor another `#`, and the digits must end on a word boundary.
 * That is what keeps three near-misses out:
 *   `deadbeef1234`     a sha carries no `#` at all
 *   `abc#42`           `#` inside a word
 *   `## 3 things`      a markdown heading puts a space after the `#` run, and a
 *                      `##3` spelling is refused by the no-`#`-before rule
 * and `#42abc` is refused by the trailing boundary.
 *
 * A reference outside the safe-integer range is EXCLUDED from the array rather
 * than carried: this function returns a bare `number[]` with no envelope to
 * refuse into, and a 400-digit `#` reference names no issue - letting it
 * through would make the seam ask the tracker about `Infinity`.
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
 * Answer open / closed / not-found for each referenced number, over ONE fetch.
 *
 * `not-found` is its own answer and is NEVER rendered as closed, because the
 * whole value of the check is that "#42 is still open" can be trusted.
 *
 * Answers at all ONLY over a fetch the normalizer reported COMPLETE: handed an
 * incomplete or unreadable one it returns null and the caller degrades to its
 * one line. A truncated page and an empty tracker carry the same records, and
 * inferring not-found from the first is exactly the wrong answer.
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
 * A value safe to interpolate into a degradation line, or a stand-in phrase.
 *
 * The `no-login` reason names the persisted `git.forge_host`, and that value is
 * a `string_or_null` a user can set to anything - so the same NOT_ONE_LINE
 * classes `splitOrigin` rejects a hostname for would let a configured host
 * print two lines, or an ANSI sequence, where /cad-land promises exactly one.
 * The origin-parsing guard used to be what stopped that, and it no longer sits
 * between config and this sentence.
 *
 * REPLACED WHOLE, never stripped: a cleaned host printed back would read as
 * what the user configured, and no forge serves such a host anyway, so there is
 * no honest repaired form. The phrase still points at the right fix.
 * @param {unknown} host @returns {string}
 */
function oneLine(host) {
  if (typeof host !== 'string' || !host.trim()) return 'the configured Forgejo instance';
  return NOT_ONE_LINE.test(host) ? 'the configured Forgejo instance' : host;
}

/**
 * Should the seam query the tracker, and if not, WHY - in the one line
 * `/cad-land` step 1 prints and then continues past.
 *
 * Modelled on close-decision.mjs's `decideGateHalt` return, which `/cad-land`
 * already branches on by `action` alone: `{action, reason}`, one of `query`,
 * `skip` or `off`, and every skip carries a distinct named reason.
 *
 * `off` IS ITS OWN ACTION, not a skip. A skip is a degradation - something the
 * seam wanted to read and could not - and its reason is the line step 1 prints.
 * The key set to false is not a degradation but the user's own instruction, and
 * the requirement is that step 1 then says NOTHING about the tracker. Folding it
 * into `skip` would make the caller either print a tracker line on every land
 * with the check off, or pattern-match a reason STRING to suppress it, and a
 * caller matching on prose is how a reason rewording becomes a regression. So
 * the discrimination is structural and the reason below still exists: it names
 * what the seam did not do for anyone reading the JSON, and nobody prints it.
 *
 * TOTAL and STAGED. Every field past `enabled` is optional, and an absent one
 * means "not known yet, not a reason to stop", so the seam calls this before
 * classifying, before resolving the binary and again after the call, and the
 * key-off arm is reached before anything is spawned. Only an explicit `false`
 * or an explicit incomplete fetch stops the run.
 *
 * WHAT THE FORGE ARMS ASK NOW (phase 1 D-01). The two arms that classified an
 * origin URL - `no-remote` and `unrecognized` - are gone, replaced by ONE arm
 * asking whether this repository has a forge CONFIGURED, naming the keys that
 * are still unset. That is the whole point of making config authoritative: a
 * repository whose remote is temporarily gone reports the same thing it
 * reported yesterday, and the sentence names a key the user can set rather than
 * a hostname the seam could not classify. The `no-login` arm SURVIVES and is
 * rebound: the host it names is the persisted `git.forge_host`, and it still
 * means that no `tea` login serves that instance, so the fix it points at is
 * still a login.
 *
 * The eight reasons, in the order they are asked (1 rides the `off` action,
 * 2-8 ride `skip`):
 *   1 the key is off        5 the resolved binary is absent from PATH
 *   2 no forge configured   6 the CLI was killed at the bound, or exited
 *   3 no tea login for the    nonzero - two lines, because "it hung" and "it
 *     configured instance     refused" are different things to go fix
 *   4 the ref scan failed   7 the CLI exited zero carrying a response the
 *                             normalizer could not read as complete
 * Seven now, not eight, and that subtraction is the point: two degradations
 * that differed only in how the origin URL failed became one that says what to
 * set.
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
  // Anything that is not the literal `true` is the off arm, including an
  // absent argument: this is asked before a single subprocess is started.
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
  // `null` means the login list was READ and named none; `undefined` means it
  // has not been read yet, which is not a reason to stop - the same staging
  // every field below follows.
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
