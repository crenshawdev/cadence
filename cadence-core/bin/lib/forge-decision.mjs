// @ts-check
// forge-decision.mjs - the pure core of the setup-time forge question: a provider table plus total functions that
// decide what setup does next. The seam supplies the live readings, and unknown input never throws.
// The persisted record is checked before the installed list, or a repo already set would be refused on a machine
// that just lacks the CLI right now.
// "Installed" is `onPath` and nothing else, passed in as a predicate so tests can stub PATH.
'use strict';

/**
 * The three providers Cadence can drive, each with its one binary name.
 * The keys are the `HOST_TABLE` keys in lib/issue-decision.mjs, so a synonym here would be a lookup miss at land time.
 * The order is what `installedProviders` walks, so the setup menu reads the same on every machine.
 */
export const PROVIDER_TABLE = Object.freeze({
  forgejo: 'tea',
  github: 'gh',
  gitlab: 'glab',
});

/** The binaries a refusal names, in table order, so the sentence a user reads can't drift from the lookup. */
const BINARIES = Object.freeze(Object.values(PROVIDER_TABLE));

/** A config value as a usable string, or null. Anything that isn't a non-empty string is unasked, not an error.
 * @param {unknown} v @returns {string|null} */
function text(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Which providers this machine can drive, folded through the caller's own resolver.
 * The predicate is the caller's, so the production lookup runs and a test can stub PATH.
 * A throwing predicate isn't caught: reading it as `false` would report a bare machine that isn't.
 *
 * @param {(bin: string) => unknown} resolves does this binary name resolve?
 * @returns {{provider: string, bin: string}[]} in PROVIDER_TABLE order
 */
export function installedProviders(resolves) {
  if (typeof resolves !== 'function') return [];
  const out = [];
  for (const [provider, bin] of Object.entries(PROVIDER_TABLE)) {
    if (resolves(bin)) out.push({ provider, bin });
  }
  return out;
}

/**
 * Which forge keys are still unanswered, spelled as the config keys a user would set.
 * One statement of "complete" for setup and the land-time tracker report, or one would re-ask and the other call blind.
 * In schema order, provider first. `git.forge_host` only counts on `forgejo`; github and gitlab have fixed hosts.
 *
 * @param {{provider?: unknown, repo?: unknown, host?: unknown}} record
 * @returns {string[]} `git.`-prefixed key names, empty when nothing is missing
 */
export function missingForgeKeys({ provider, repo, host } = {}) {
  const p = text(provider);
  const known = p !== null && Object.prototype.hasOwnProperty.call(PROVIDER_TABLE, p);
  const out = [];
  if (!known) out.push('git.forge_provider');
  if (!text(repo)) out.push('git.forge_repo');
  // only a recognized provider can say whether the host is needed; an unknown spelling reports the provider key alone
  if (p === 'forgejo' && !text(host)) out.push('git.forge_host');
  return out;
}

/**
 * Is the persisted forge record complete, i.e. nothing left to ask?
 * Provider and slug always, plus the host on `forgejo`, which can't come from origin when the SSH endpoint is split.
 * An unknown provider is incomplete: honouring a spelling no row carries would persist a record nothing can read.
 *
 * @param {{provider?: unknown, repo?: unknown, host?: unknown}} record
 * @returns {boolean}
 */
export function forgeRecordComplete(record) {
  return missingForgeKeys(record).length === 0;
}

/** Longest `owner/name` a forge serves (GitHub 39 + 100, GitLab 20 levels deep); 200 clears it. */
const SLUG_MAX = 200;

/** One slug segment; it never opens on `-`, which turns a value into a flag once it's on a command line. */
const SLUG_SEGMENT = /^[A-Za-z0-9_.][A-Za-z0-9._-]*$/;

/**
 * Is `slug` a repository selector this seam will hand back as a default?
 * It comes off repository content and setup interpolates it into a shell line, so this grammar is what makes that safe.
 * Two or more segments, not two: GitLab nests subgroups.
 * Refused: a leading `-` on any segment, `.` or `..` as a segment, anything outside [A-Za-z0-9._-], or over SLUG_MAX.
 * A refused slug yields no default, not a repaired one: a cleaned-up pre-filled answer is what a user confirms unread.
 *
 * @param {unknown} slug @returns {boolean}
 */
export function isForgeSlug(slug) {
  if (typeof slug !== 'string' || !slug || slug.length > SLUG_MAX) return false;
  const segments = slug.split('/');
  if (segments.length < 2) return false;
  return segments.every((seg) => seg !== '.' && seg !== '..' && SLUG_SEGMENT.test(seg));
}

/** Longest `host[:port]` a `git.forge_host` may carry. 253 is DNS's ceiling, and it covers the port too. */
const FORGE_HOST_MAX = 253;

/** One hostname label; a leading `-` is refused because the value lands in a shell line and a tea argv as a flag. */
const HOST_LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;

/** A port in its one canonical spelling: digits, no leading zero. The 1-65535 range is a numeric check below. */
const PORT_DIGITS = /^[1-9][0-9]*$/;

/**
 * The `hostname` and `port` halves of a `git.forge_host`, or null when it isn't a value this seam will persist.
 * Hostname: dot-separated labels of letters, digits and `-`, none opening or closing on `-`. Refused, not stripped.
 * Port: digits, no leading zero, 1 through 65535, or `:0443` would compare unequal on one side only.
 * No bracketed IPv6, on purpose: `loginNamesHost` can't read `[::1]:3001`, so nothing would match it.
 * Case isn't folded here, and a portless value gets a null port, never a defaulted one: no port and 443 differ.
 *
 * @param {unknown} host @returns {{hostname: string, port: string|null}|null}
 */
export function splitForgeHost(host) {
  if (typeof host !== 'string' || !host || host.length > FORGE_HOST_MAX) return null;
  const at = host.lastIndexOf(':');
  const hostname = at === -1 ? host : host.slice(0, at);
  const port = at === -1 ? null : host.slice(at + 1);
  if (!hostname || !hostname.split('.').every((label) => HOST_LABEL.test(label))) return null;
  if (port === null) return { hostname, port: null };
  if (!PORT_DIGITS.test(port)) return null;
  const n = Number(port);
  if (n < 1 || n > 65535) return null;
  return { hostname, port };
}

/**
 * The two defaults setup offers for the user to confirm, derived from an origin classification.
 * They are independently null on purpose: a slug comes off any origin, a provider only off github.com and gitlab.com.
 * Guessing a forge from a hostname's first label is a heuristic.
 * Never a host default: on a split SSH endpoint the classifier's host is the SSH hostname, not the instance.
 *
 * @param {unknown} classification a `classifyOrigin` verdict, or anything at
 *   all - an unreadable origin is no defaults, never a throw
 * @returns {{provider: string|null, repo: string|null}}
 */
export function originDefaults(classification) {
  const c = classification && typeof classification === 'object'
    ? /** @type {Record<string, unknown>} */ (classification) : {};
  const verdict = c.verdict;
  return {
    provider: verdict === 'github' || verdict === 'gitlab' ? verdict : null,
    repo: isForgeSlug(c.slug) ? /** @type {string} */ (c.slug) : null,
  };
}

/**
 * What should the setup step do about the forge?
 * Shaped like `decideIssueCheck`'s return, so workflows branch on `action` alone. Three actions and no fourth:
 *   configured  the persisted record answers everything - say and ask nothing
 *   ask         at least one provider resolved - ask only the gaps
 *   refuse      no provider resolved - a forge is a precondition, so stop with a reason and a hint
 * Total: absent means "not answered", so reading nothing gets `ask` or `refuse`, never a throw.
 *
 * @param {{provider?: unknown, repo?: unknown, host?: unknown,
 *   installed?: unknown}} args `installed` as `installedProviders` returns it
 * @returns {{action: 'configured'|'ask'|'refuse', reason: string, hint?: string}}
 */
export function decideForge({ provider, repo, host, installed } = {}) {
  if (forgeRecordComplete({ provider, repo, host })) {
    return {
      action: 'configured',
      reason: `this repository's forge is already set to ${text(provider)}: nothing to ask`,
    };
  }
  const found = Array.isArray(installed) ? installed : [];
  if (found.length > 0) {
    return {
      action: 'ask',
      reason: `${found.map((e) => e.bin).join(', ')} resolved on PATH: ask which forge hosts this repository`,
    };
  }
  return {
    action: 'refuse',
    reason: `no forge CLI is installed: none of ${BINARIES.join(', ')} resolves on PATH, and Cadence needs one to reach an issue tracker`,
    hint: 'install the CLI for the forge you use - tea for a Forgejo or Gitea instance, gh for GitHub, glab for GitLab - then re-run this setup step',
  };
}

/**
 * The `owner` and `name` halves of a repository selector, or null when it isn't one to hand a forge CLI.
 * It runs `isForgeSlug` first, so a value refused as a default can't be accepted as a creation target.
 * The split is at the last separator, so GitLab's `g/sub/r` is owner `g/sub` and name `r`.
 *
 * @param {unknown} slug @returns {{owner: string, name: string}|null}
 */
export function splitSlug(slug) {
  if (!isForgeSlug(slug)) return null;
  const s = /** @type {string} */ (slug);
  const at = s.lastIndexOf('/');
  return { owner: s.slice(0, at), name: s.slice(at + 1) };
}

/**
 * Is `owner` this login's own user account, rather than an organization on the same instance?
 * `tea repos create --owner john` fails with `GetOrgByName` for a personal repo, because `--owner` resolves as an org
 * and never as a user; with no `--owner` it creates under the login user.
 * Case-insensitive and trimmed, since Gitea doesn't care about case and a strict test would fail a working create.
 * A login that isn't a record is "not the user", never a throw; the seam refuses first, so that arm is unreachable.
 *
 * @param {unknown} owner @param {unknown} login @returns {boolean}
 */
export function ownerIsLoginUser(owner, login) {
  if (!login || typeof login !== 'object') return false;
  const user = /** @type {Record<string, unknown>} */ (login).user;
  if (typeof owner !== 'string' || typeof user !== 'string') return false;
  const a = owner.trim().toLowerCase();
  return a !== '' && a === user.trim().toLowerCase();
}

/**
 * `['--login', <name>]` for a usable login record, or `[]`.
 * Without `--login` tea picks its own, and prints `default` as the string `'false'`, so the default can't be trusted.
 * The create has to run as the login whose user answered the owner question.
 * A name opening on `-` is dropped: it's third-party bytes, and a flag-shaped value changes what a command means.
 * The seam refuses such a record too; this is the second door.
 *
 * @param {unknown} login @returns {string[]}
 */
function loginFlag(login) {
  if (!login || typeof login !== 'object') return [];
  const name = /** @type {Record<string, unknown>} */ (login).name;
  if (typeof name !== 'string') return [];
  const trimmed = name.trim();
  return trimmed === '' || trimmed.startsWith('-') ? [] : ['--login', trimmed];
}

/**
 * How each provider's CLI is told to create a repository: an argv builder and whether it leaves a git `origin` behind.
 * The three CLIs have three grammars, so the table is data and not a format string.
 * Every row pins `--private`: gh with no flag prompts and hangs a Bash call, and glab defaults to `internal`.
 * `needsLogin` marks the one row whose argv depends on a login record; it isn't "needs auth", all three do.
 * `wiresRemote` is read off the argv beside it, and the seam acts on it.
 */
export const CREATE_TABLE = Object.freeze({
  forgejo: Object.freeze({
    // tea's help mentions no remote at all
    wiresRemote: false,
    // --owner reads as an org, so the argv needs the login's user; the org arm is unmeasured
    needsLogin: true,
    /** @param {string} owner @param {string} name
     *  @param {unknown} login the `{name, user}` record for this instance
     *  @returns {string[]} */
    argv: (owner, name, login) => ['repos', 'create', '--name', name,
      // `--owner` names an organization, so it's only here when the owner isn't this login's own account
      ...(ownerIsLoginUser(owner, login) ? [] : ['--owner', owner]),
      ...loginFlag(login),
      '--private'],
  }),
  github: Object.freeze({
    // no --source in the argv, and gh's remote flag only applies to a create from a local directory
    wiresRemote: false,
    needsLogin: false,
    /** @param {string} owner @param {string} name @returns {string[]} */
    argv: (owner, name) => ['repo', 'create', `${owner}/${name}`, '--private'],
  }),
  gitlab: Object.freeze({
    // `--remoteName origin` is in the argv
    wiresRemote: true,
    needsLogin: false,
    /** @param {string} owner @param {string} name @returns {string[]} */
    argv: (owner, name) => ['repo', 'create', `${owner}/${name}`, '--private',
      '--remoteName', 'origin'],
  }),
});
