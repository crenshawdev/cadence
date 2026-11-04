// @ts-check
// forge-decision.mjs - the pure core of the setup-time forge question: a frozen provider table plus total functions
// that decide, from the persisted forge record and the caller's own "does this name resolve" answer, what setup does next.
// It touches no filesystem and spawns nothing; bin/forge.mjs supplies the live readings. Unknown input never throws.
// Nothing here prompts or writes: a stdin block inside a Bash call would hang the workflow, so the question is asked
// in prose and the answers come back through `config.mjs set`.
// The persisted record is checked before the installed list. A repo whose forge keys are already set has to be asked
// nothing on a second run, and checking binaries first would refuse it on a machine that just lacks the CLI right now.
// "Installed" is `onPath` and nothing else - no `--version`, no login probe - passed in as a predicate so the production
// resolver stays lib/on-path.mjs. The forgejo create row does need a login, but the seam reads that and hands it in.
'use strict';

/**
 * The three providers Cadence can drive, each with its one binary name, in the fixed order callers report them in.
 * The keys are the ones `HOST_TABLE` in lib/issue-decision.mjs and `git.forge_provider`'s enum use: the persisted value
 * is a `HOST_TABLE` key at land time, so a synonym here would be a lookup miss there.
 * The order is what `installedProviders` walks, so the setup menu reads the same on every machine.
 */
export const PROVIDER_TABLE = Object.freeze({
  forgejo: 'tea',
  github: 'gh',
  gitlab: 'glab',
});

/** The binaries a refusal names, in table order, so the sentence a user reads can't drift from the lookup. */
const BINARIES = Object.freeze(Object.values(PROVIDER_TABLE));

/** A config value as a usable string, or null. Anything that isn't a non-empty string is unasked, not an error:
 * the shipped template has `null` and there's no envelope here to refuse into.
 * @param {unknown} v @returns {string|null} */
function text(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Which providers this machine can drive, folded through the caller's own resolver.
 * The predicate is the caller's (bin/forge.mjs passes `onPath`), so the production lookup runs and a test can stub PATH.
 * A throwing predicate isn't caught: a resolver that can't answer is the caller's fault, and reading it as `false`
 * would report a bare machine that isn't.
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
 * One statement of "complete" with two readers: setup decides whether to ask, the land-time tracker report decides
 * whether to call, and if they disagreed it would either re-ask a settled question or call a forge with no selector.
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
 * Provider and slug always, plus the instance host on `forgejo`: tea addresses an instance through a login name, the
 * host resolves it, and it can't be derived from origin. On a split SSH endpoint origin is `ssh.jcrenshaw.dev` while
 * the instance is `git.jcrenshaw.dev`, which is this repo's own shape. github and gitlab keep it null.
 * An unknown provider is incomplete: it's a `HOST_TABLE` key at land time, so honouring a spelling no row carries
 * would persist a record nothing can read.
 *
 * @param {{provider?: unknown, repo?: unknown, host?: unknown}} record
 * @returns {boolean}
 */
export function forgeRecordComplete(record) {
  return missingForgeKeys(record).length === 0;
}

/** Longest `owner/name` a forge serves (GitHub 39 + 100, GitLab 20 levels deep); 200 clears it and bounds the grammar. */
const SLUG_MAX = 200;

/** One slug segment; it never opens on `-`, which turns a value into a flag once it's on a command line. */
const SLUG_SEGMENT = /^[A-Za-z0-9_.][A-Za-z0-9._-]*$/;

/**
 * Is `slug` a repository selector this seam will hand back as a default?
 * It comes off repository content (`git remote get-url origin`) and setup interpolates it into the shell line that
 * runs `config.mjs set git.forge_repo=<slug>`, so this grammar is what makes that safe. It lives in the seam
 * because prose can't hold a grammar.
 * Two or more segments, not two: GitLab nests subgroups and `glab --repo` takes `group/subgroup/repo` whole.
 * Refused: a leading `-` on any segment (reads as a flag), `.` or `..` as a segment, anything outside [A-Za-z0-9._-]
 * (whitespace, quotes, `$`, backticks, `;` and newlines end an argument), and anything over SLUG_MAX.
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

/** Longest `host[:port]` a `git.forge_host` may carry. 253 is DNS's own ceiling, and it covers the port too, since a
 * separate bound for the tail would be a second rule to keep in step. */
const FORGE_HOST_MAX = 253;

/** One hostname label; a leading `-` is refused because the value ends up in a shell line and a tea argv as a flag. */
const HOST_LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;

/** A port in its one canonical spelling: digits, no leading zero. The 1-65535 range is a numeric check below. */
const PORT_DIGITS = /^[1-9][0-9]*$/;

/**
 * The `hostname` and `port` halves of a `git.forge_host`, or null when it isn't a value this seam will persist or compare.
 * One function judges and splits: a separate predicate would be a second answer to the same question.
 * Hostname: dot-separated labels of letters, digits and `-`, none opening or closing on `-`. Anything else is refused,
 * not stripped; whitespace, quotes, `$`, backticks, `;`, `/`, `@`, newlines and control bytes all end an argument.
 * Port: digits, no leading zero, 1 through 65535. It's compared with what `httpPortOf` reads off a tea login url
 * through a numeric conversion, so admitting `:0443` would persist a value that compares unequal on one side only.
 * No bracketed IPv6, on purpose: `loginNamesHost` can't read `[::1]:3001`, so it would persist a value nothing matches.
 * Case isn't folded here (`teaLoginNameForHost` does that), and a portless value gets a null port, never a defaulted
 * one: "named no port" and "named 443" are different facts.
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
 * They are independently null on purpose. `classifyOrigin` gives a slug for any origin with two or more path segments
 * but a provider only for github.com and gitlab.com, since guessing a forge from a hostname's first label is a heuristic
 * it can't be right about; self-hosted gets a slug to confirm and no `(recommended)` provider.
 * Never a host default: on a split SSH endpoint the classifier's host is the SSH hostname, not the instance the user
 * opens in a browser, so a derived default would be wrong on the first repo that read it, and offering the guess
 * pre-filled would erase the difference between the asked value and the guess.
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
 * Modelled on `decideIssueCheck`'s return, which workflows branch on by `action` alone: `{action, reason}` and a
 * `hint` on the refusing one. Three actions and no fourth, because prose that has to tell four states apart gets one wrong:
 *   configured  the persisted record answers everything - say and ask nothing
 *   ask         at least one provider resolved - ask, carrying what's already answered so only the gaps are asked
 *   refuse      no provider resolved - a forge is a precondition, so this is a stop with a reason and a hint
 * Reason and hint live here, not in the seam, so the sentence a user reads can be tested without spawning anything.
 * Total: every field is optional and absent means "not answered", so reading nothing gets `ask` or `refuse`, never a throw.
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
 * It runs `isForgeSlug` first rather than keep a grammar of its own, so a value refused as a default can't be accepted
 * as a creation target. The split is at the last separator, so GitLab's `g/sub/r` is owner `g/sub` and name `r`.
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
 * tea has no single create grammar. `tea repos create --name r --owner john --private` exits 1 with `GetOrgByName`
 * for a personal repo (measured on tea 0.15.1), because `--owner` resolves as an organization and never as a user;
 * with no `--owner` it creates `john/r` under the login user.
 * Case-insensitive and trimmed, since Gitea resolves account names without regard to case and a strict test would fail
 * the create for a difference the server doesn't have.
 * A login that isn't a record is "not the user", never a throw; that keeps `--owner` in the argv, and bin/forge.mjs
 * refuses before the builder when it can't resolve a login, so that arm is unreachable in production.
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
 * Without `--login` tea picks a login from its own config, and a single login even prints `default` as the string
 * `'false'`, so "the default" can't be relied on. The create has to run as the same login whose user answered the
 * owner question, or the answer was about an account the create never used.
 * A name opening on `-` is dropped: it's third-party bytes from a CLI's stdout, and a flag-shaped value is the one way
 * an untrusted string changes what a command means. The seam refuses such a record too; this is the second door.
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
 * How each provider's CLI is told to create a repository: one row per provider, shaped like `HOST_TABLE` in
 * lib/issue-decision.mjs, with a builder for the argv and a stated fact about what it does to the git remote.
 * The binary isn't repeated here; `PROVIDER_TABLE` says which one drives which provider.
 * The three CLIs have three grammars (measured on gh 2.98.0, glab 1.114.0, tea 0.15.1), so the table is data and not a
 * format string. Every row pins `--private` and takes no visibility: gh with no flag drops to an interactive prompt
 * that hangs a Bash call, glab defaults to `internal`, tea to private, and three defaults isn't a choice for a user.
 * `needsLogin` marks the one row whose argv depends on a login record the seam must read and refuse without. It
 * isn't "needs auth" (all three do), and it's about the argv, not about a provider's name.
 * `wiresRemote` is read off the argv beside it: does it leave a git `origin` at the created repo? bin/forge.mjs
 * does the follow-up that acts on it.
 */
export const CREATE_TABLE = Object.freeze({
  forgejo: Object.freeze({
    // tea's help mentions no remote at all
    wiresRemote: false,
    // --owner reads as an org, so the argv needs the login's user; the org arm is unmeasured, tea's error is all we have
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
