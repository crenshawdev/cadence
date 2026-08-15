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
//   tea  `tea issues list --help` on tea 0.9.x here: `--state all`, `--fields
//        index,state`, `--output json`, `--repo`, `--limit int (default 30)`.
//        Live sample: [{"index":"171","state":"open"}] - `index` is a STRING.
//   glab `glab issue list` published docs (gitlab-org/cli, docs/source/issue/
//        list.md, read 2026-08-15): `-A/--all` (both states), `-O/--output
//        json`, `-P/--per-page int (default 30)`, `-R/--repo OWNER/REPO`. The
//        json arm prints the API issue objects, whose number is `iid` and whose
//        state is `opened`/`closed`. No `glab` on this machine, so this row is
//        proved by a captured sample and a PATH-injected stub, never a spawn.
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

/** open / closed, normalized across the three CLIs' spellings.
 * @param {string} raw @returns {'open'|'closed'|null} */
function normalizeState(raw) {
  const s = raw.toLowerCase();
  if (s === 'open' || s === 'opened') return 'open';
  if (s === 'closed') return 'closed';
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
    const rawNumber = /** @type {Record<string, unknown>} */ (row)[numberKey];
    const rawState = /** @type {Record<string, unknown>} */ (row).state;
    const number = typeof rawNumber === 'number' ? rawNumber
      : (typeof rawNumber === 'string' && /^\d+$/.test(rawNumber) ? Number(rawNumber) : null);
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
 * Host -> the ONE bounded call that lists issues in EVERY state with number and
 * state, and the reader for its response. One call per land covering both facts
 * the report needs; never one call per referenced number.
 *
 * `argv(slug, limit)` is byte-exact apart from the two interpolations, and the
 * repo slug is always present: `gh` and `glab` would otherwise infer the repo
 * from the process cwd, and `tea` infers nothing at all.
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
    /** @param {string} slug @param {number} limit @returns {string[]} */
    argv: (slug, limit) => ['issues', 'list', '--repo', slug, '--state', 'all',
      '--fields', 'index,state', '--output', 'json', '--limit', String(limit)],
    /** @param {unknown} text @param {number} limit */
    normalize: (text, limit) => normalizeList(text, limit, 'index'),
  }),
});

/** `https://host[:port]/owner/repo[.git]` and the scp-shaped
 * `[user@]host:owner/repo[.git]` - the two forms cad-land already meets.
 * @param {string} url @returns {{hostname:string, path:string}|null} */
function splitOrigin(url) {
  const schemed = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/:]+)(?::\d+)?\/(.+)$/.exec(url);
  if (schemed) return { hostname: schemed[1].toLowerCase(), path: schemed[2] };
  // scp-shaped: the colon separates host from PATH, so the part after it must
  // not start with `/` (that spelling is a schemeless URL, not scp syntax).
  const scp = /^(?:[^@/]*@)?([^/:]+):(?!\/)(.+)$/.exec(url);
  if (scp) return { hostname: scp[1].toLowerCase(), path: scp[2] };
  return null;
}

/**
 * Classify the origin URL into the forge whose tracker can be read, using the
 * hosts a `tea login list` reading names for everything that is not github or
 * gitlab - the rule skills/cad-land/SKILL.md step 1 already states.
 *
 * The verdicts are FIVE, not three, because the degradations are not
 * interchangeable (LND-01, criterion 3):
 *   github / gitlab / forgejo  a tracker this seam can read
 *   no-remote      no origin URL at all
 *   no-login       a host `tea` could serve, where the login list names no
 *                  login for it. Distinct from `unrecognized` on purpose: a
 *                  Forgejo origin with `tea` installed but unauthenticated must
 *                  not be reported as an unknown host, because the fix is a
 *                  login and the line has to say so.
 *   unrecognized   neither github nor gitlab, and no `tea` reading exists to
 *                  recognize it (the CLI is absent, or the URL did not parse,
 *                  or the path names no owner/repo). Without a reading there is
 *                  no evidence the host serves a tracker at all.
 *
 * github and gitlab are matched on the HOSTNAME (`github.com` / `gitlab.com`
 * and their subdomains) and nothing else. A self-hosted GitLab at
 * `gitlab.example.com` therefore lands on `unrecognized` and degrades in one
 * line; guessing a forge from a hostname's first label would be a heuristic
 * this file has no way to be right about.
 *
 * @param {unknown} originUrl the `git remote get-url origin` text, or ''/null
 * @param {string[]|null|undefined} teaHosts hosts a `tea login list` reading
 *   named, or null/undefined when tea could not be consulted at all
 * @returns {{verdict:'github'|'gitlab'|'forgejo'|'no-login'|'no-remote'|'unrecognized',
 *   host:string|null, slug:string|null}}
 */
export function classifyOrigin(originUrl, teaHosts) {
  const url = typeof originUrl === 'string' ? originUrl.trim() : '';
  if (!url) return { verdict: 'no-remote', host: null, slug: null };
  const parts = splitOrigin(url);
  if (!parts) return { verdict: 'unrecognized', host: null, slug: null };
  const segments = parts.path.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  // Two segments minimum: without owner AND name there is no repo selector to
  // bind the call to, and an unbound call reports another project's tracker.
  const slug = segments.length >= 2 ? segments.join('/') : null;
  const host = parts.hostname;
  if (!slug) return { verdict: 'unrecognized', host, slug: null };
  if (host === 'github.com' || host.endsWith('.github.com')) return { verdict: 'github', host, slug };
  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) return { verdict: 'gitlab', host, slug };
  if (!Array.isArray(teaHosts)) return { verdict: 'unrecognized', host, slug };
  const named = teaHosts.some((h) => typeof h === 'string' && h.toLowerCase() === host);
  return { verdict: named ? 'forgejo' : 'no-login', host, slug };
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
 * @param {unknown} logText @returns {number[]}
 */
export function scanIssueRefs(logText) {
  if (typeof logText !== 'string' || !logText) return [];
  const found = new Set();
  const re = /(^|[^\w#])#(\d+)\b/g;
  let m;
  while ((m = re.exec(logText)) !== null) found.add(Number(m[2]));
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
 * The eight reasons, in the order they are asked (1 rides the `off` action,
 * 2-8 ride `skip`):
 *   1 the key is off        6 the resolved binary is absent from PATH
 *   2 no origin remote      7 the CLI was killed at the bound, or exited
 *   3 unrecognized host       nonzero - two lines, because "it hung" and "it
 *   4 no tea login for it     refused" are different things to go fix
 *   5 the ref scan failed   8 the CLI exited zero carrying a response the
 *                             normalizer could not read as complete
 *
 * @param {{enabled?:boolean,
 *   classification?:{verdict:string, host:string|null, slug:string|null},
 *   logOk?:boolean, bin?:string, cliPresent?:boolean, exitOk?:boolean,
 *   timedOut?:boolean, fetched?:{complete?:boolean, detail?:string|null}|null}} args
 * @returns {{action:'query'|'skip'|'off', reason:string}}
 */
export function decideIssueCheck({ enabled, classification, logOk, bin, cliPresent, exitOk, timedOut, fetched } = {}) {
  const skip = (reason) => ({ action: /** @type {'skip'} */ ('skip'), reason });
  // Anything that is not the literal `true` is the off arm, including an
  // absent argument: this is asked before a single subprocess is started.
  if (enabled !== true) {
    return {
      action: /** @type {'off'} */ ('off'),
      reason: 'git.issue_check is off: no tracker report, and no forge CLI was run',
    };
  }
  const host = classification && classification.host ? classification.host : 'the origin host';
  if (classification) {
    if (classification.verdict === 'no-remote') {
      return skip('no origin remote is configured: there is no tracker to report on');
    }
    if (classification.verdict === 'unrecognized') {
      return skip(`${host} is neither github nor gitlab and no tea login list could name it: no tracker report`);
    }
    if (classification.verdict === 'no-login') {
      return skip(`tea holds no login for ${host}: no tracker report`);
    }
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
