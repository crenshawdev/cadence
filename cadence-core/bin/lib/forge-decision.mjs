// @ts-check
// forge-decision.mjs - the pure, testable core of the setup-time forge question
// (FRG-01). Zero-dep (node builtins only, and it uses none): one frozen
// provider table plus two TOTAL functions that decide, from a persisted forge
// record and a caller's own "does this name resolve" answer, WHAT the setup
// step in workflows/new-project.md and workflows/adopt.md should do next.
// It never touches the filesystem, never spawns anything, never emits and never
// reads `process` - bin/forge.mjs supplies the live readings and the workflow
// prose asks the questions. Mirrors lib/issue-decision.mjs's discipline:
// unknown or missing inputs never throw.
//
// NOTHING HERE PROMPTS AND NOTHING HERE WRITES (CONTEXT D-12). A seam that
// blocked on stdin inside a Bash tool call would hang the workflow that ran it,
// so the question is asked in prose through the ask-user seam and the answers
// come back through `config.mjs set`. This module's whole job is to say which
// of three things is true, so that the prose has exactly one value to branch
// on - the way `/cad-land` step 1 branches on `decideIssueCheck`'s `action`.
//
// WHY THE PERSISTED RECORD IS CONSULTED BEFORE THE INSTALLED LIST. The two
// acceptance criteria pull in opposite directions: AC2 says a repository whose
// forge keys are already set is asked NOTHING on a second run, and AC5 says a
// machine with no forge CLI refuses. Asking about the binaries first would
// refuse an already-configured repository on a machine that happens not to have
// the CLI installed right now - re-opening a settled question because of a
// state that setup does not need. Setup persists a choice; it is land time that
// needs a binary, and issue-check.mjs already has its own named line for a CLI
// that is not on PATH.
//
// "INSTALLED" IS `onPath` AND NOTHING ELSE (CONTEXT D-06). No `--version`
// call, no `tea login list`, no auth probe: DETECTION resolves WHERE issue
// writes will go and never asks whether the user is logged in. That is what
// keeps AC1's "no subprocess is spawned during detection" assertion true, and
// it is why this module takes a PREDICATE rather than doing the lookup - the
// production resolver stays `lib/on-path.mjs`, one rule with one implementation.
// CREATION is the one place that reading changed: `CREATE_TABLE`'s forgejo row
// cannot be built without knowing who tea is logged in as (see the row), so
// bin/forge.mjs reads a login list on THAT arm. Still nothing here spawns it -
// the seam passes the record in, exactly as it passes `onPath` in.
'use strict';

/**
 * The three providers Cadence can drive, each with the ONE binary name that
 * drives it, in the fixed order every caller reports them in.
 *
 * The KEYS are the vocabulary `HOST_TABLE` in lib/issue-decision.mjs already
 * uses for its rows and `git.forge_provider`'s enum already carries. There is
 * deliberately no second spelling anywhere: the persisted provider value is
 * used directly as a `HOST_TABLE` key at land time, so a synonym here would be
 * a lookup miss there rather than a naming preference.
 *
 * The ORDER is load-bearing in the small way a menu is: `installedProviders`
 * walks it, so the choices the setup step offers come out the same on every
 * machine instead of following whatever order a config or a directory listing
 * happened to have.
 */
export const PROVIDER_TABLE = Object.freeze({
  forgejo: 'tea',
  github: 'gh',
  gitlab: 'glab',
});

/** The binaries this module looks for, in table order - the list a refusal
 * names, so the sentence a user reads and the lookup that produced it cannot
 * drift apart. */
const BINARIES = Object.freeze(Object.values(PROVIDER_TABLE));

/** A persisted config value as a usable string, or null. Anything that is not
 * a non-empty string after trimming is UNASKED, not an error: `null` is what
 * templates/config.json ships and what a user's own edit is most likely to
 * leave behind, and this module has no envelope to refuse into.
 * @param {unknown} v @returns {string|null} */
function text(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Which providers this machine can drive, folded through the caller's own
 * resolver.
 *
 * The predicate is the caller's - bin/forge.mjs passes `onPath` from
 * lib/on-path.mjs - so the production lookup is what runs and a test injects a
 * stub the same way every other seam does, by prepending a directory to the
 * child's PATH. A predicate that throws is not caught: a resolver that cannot
 * answer is a fault in the caller, not a provider that is absent, and silently
 * reading a throw as `false` would report a machine bare that is not.
 *
 * @param {(bin: string) => unknown} resolves does this BINARY NAME resolve?
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
 * WHICH forge keys are still unanswered, spelled as the config keys a user
 * would set - the list `bin/issue-check.mjs` names in its not-configured line,
 * and the question `forgeRecordComplete` below answers as a boolean.
 *
 * ONE statement of what a complete forge record is, with TWO readers, for the
 * reason `lib/on-path.mjs`'s header gives about "reachable": the setup step
 * decides whether to ask and the land-time tracker report decides whether to
 * call, and a tree where those two disagree either re-asks a settled question
 * or calls a forge it has no selector for. So the rule lives here and
 * `lib/issue-decision.mjs` imports it rather than restating it.
 *
 * In SCHEMA ORDER, provider first, so the sentence a user reads names the key
 * they have to set first. `git.forge_host` appears only on a `forgejo`
 * provider, because `github` and `gitlab` have fixed hosts and a null there is
 * not a gap.
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
  // Only a provider we RECOGNIZE can tell us whether the host is required, and
  // only `forgejo` requires it. An unknown provider spelling reports the
  // provider key alone rather than guessing a third key it might also need.
  if (p === 'forgejo' && !text(host)) out.push('git.forge_host');
  return out;
}

/**
 * Is the persisted forge record COMPLETE - is there nothing left to ask?
 *
 * Provider and slug always; on `forgejo`, the instance host as well (CONTEXT
 * D-08). A Forgejo row that cannot name its instance is NOT configured: `tea`
 * addresses an instance through a login name, the host is what resolves that
 * name, and it is never derivable from the origin URL - on a split SSH endpoint
 * the origin's host is the SSH hostname (`ssh.jcrenshaw.dev`) and not the
 * instance the user reaches in a browser (`git.jcrenshaw.dev`), which is the
 * shape this repository itself has. `github` and `gitlab` need no such key:
 * their hosts are fixed, so the key stays null there and its absence is not a
 * gap.
 *
 * An UNKNOWN provider string is incomplete rather than complete: the value is
 * used as a `HOST_TABLE` key at land time, so honouring a spelling no row
 * carries would persist a record nothing can read.
 *
 * @param {{provider?: unknown, repo?: unknown, host?: unknown}} record
 * @returns {boolean}
 */
export function forgeRecordComplete(record) {
  return missingForgeKeys(record).length === 0;
}

/**
 * The longest `owner/name` a forge serves, as a byte bound rather than a taste.
 *
 * GitHub caps an owner at 39 characters and a repository name at 100; GitLab's
 * subgroup nesting is capped at 20 levels. 200 is comfortably above every real
 * slug and far below anything a hostile origin URL would need to be
 * interesting, and a bound stated here is one the grammar below does not have
 * to reason about by way of a quantifier.
 */
const SLUG_MAX = 200;

/** One path segment of a slug: at least one character, and never opening on a
 * `-`, which is the character that turns a value into a FLAG the moment it is
 * interpolated into a command line. */
const SLUG_SEGMENT = /^[A-Za-z0-9_.][A-Za-z0-9._-]*$/;

/**
 * Is `slug` a repository selector this seam will hand back as a default?
 *
 * WHY THIS IS VALIDATED AT ALL, and why here (CONTEXT D-12, `untrusted_input`).
 * The value comes off REPOSITORY CONTENT - `git remote get-url origin`, which
 * is whatever `.git/config` says - and the setup step interpolates the default
 * it is handed into the shell line that runs `config.mjs set
 * git.forge_repo=<slug>`. A validated slug is what makes that interpolation
 * safe, and validating it in the SEAM rather than in the prose is the half of
 * D-12 that says this module detects, validates and persists nothing: prose
 * cannot hold a grammar, and every caller re-deriving one is how a rule comes
 * to be enforced in three different strengths. This is the same hazard class
 * `references/conventions.md` states for caller-derived text.
 *
 * TWO OR MORE SEGMENTS, not exactly two. GitLab nests subgroups, so
 * `group/subgroup/repo` is an ordinary selector there and `glab --repo` takes
 * it whole; requiring exactly two would refuse a real repository and hand the
 * user a blank field on the one forge that needs the longest one.
 *
 * WHAT IS REFUSED, and why each one is not a stylistic choice:
 *   a leading `-` on any segment    a value that reads as a FLAG once it is
 *                                   interpolated onto a command line
 *   `.` or `..` as a whole segment  a path traversal in selector position
 *   anything outside [A-Za-z0-9._-] whitespace, quotes, `$`, backticks, `;`,
 *                                   newlines - the characters that end an
 *                                   argument and start something else
 *   over SLUG_MAX bytes             no forge serves it
 * A refused slug yields NO default rather than a repaired one: there is no
 * honest repair for a selector nobody typed, and a cleaned-up value offered as
 * a pre-filled answer is exactly the shape a user confirms without reading.
 *
 * @param {unknown} slug @returns {boolean}
 */
export function isForgeSlug(slug) {
  if (typeof slug !== 'string' || !slug || slug.length > SLUG_MAX) return false;
  const segments = slug.split('/');
  if (segments.length < 2) return false;
  return segments.every((seg) => seg !== '.' && seg !== '..' && SLUG_SEGMENT.test(seg));
}

/**
 * The two defaults the setup step offers for the user to CONFIRM, derived from
 * an origin classification.
 *
 * THE TWO HAVE DIFFERENT AVAILABILITIES (CONTEXT D-07), which is why they are
 * one function returning two independently-null fields rather than one nullable
 * pair. `classifyOrigin` supplies a slug for any origin that parses into two or
 * more path segments, but it supplies a PROVIDER only for the `github.com` and
 * `gitlab.com` hostname suffixes - guessing a forge from a hostname's first
 * label is a heuristic that file has no way to be right about. So the common
 * self-hosted case offers a slug to confirm and no provider recommendation at
 * all, and the setup step marks nothing `(recommended)` there.
 *
 * NO HOST DEFAULT IS OFFERED, EVER (CONTEXT D-08). The Forgejo instance host is
 * asked outright and confirmed by the user, because on a split SSH endpoint the
 * classifier's host is the SSH hostname (`ssh.jcrenshaw.dev`) and not the
 * instance the user reaches in a browser (`git.jcrenshaw.dev`) - the shape this
 * repository itself has, so a derived default would be wrong on the first
 * repository that read it. That is what separates the asked value from the
 * classifier's guess, and offering the guess as a pre-filled answer would erase
 * the distinction the key exists for.
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
 *
 * Modelled on `decideIssueCheck`'s return, which the workflows already branch
 * on by `action` alone: `{action, reason}` and, on the one refusing action, a
 * `hint`. THREE actions and nothing else, because prose that has to distinguish
 * a fourth state is prose that will get one of them wrong:
 *   configured  the persisted record answers every question - say nothing, ask
 *               nothing (AC2)
 *   ask         at least one provider resolved - put the question to the user,
 *               carrying whatever of the record is already answered so only the
 *               gaps are asked
 *   refuse      no provider resolved - a forge is a PRECONDITION (FRG-02), so
 *               this is a stop with a reason and a hint, not a no-tracker mode
 *
 * The reason and hint live here rather than in the seam for the reason
 * `decideIssueCheck`'s do: the sentence a user reads is the thing worth
 * testing, and testing it through a subprocess would prove the spawn instead.
 *
 * TOTAL. Every field is optional and an absent one means "not answered", so a
 * caller that read nothing at all gets `ask` or `refuse` rather than a throw.
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
 * The `owner` and `name` halves of a repository selector, or null when the
 * selector is not one this phase will hand to a forge CLI.
 *
 * ONE predicate decides what a repository reference may be: this splitter runs
 * `isForgeSlug` first rather than re-deriving a grammar of its own, so a value
 * refused as a setup-time default cannot be accepted as a creation target. The
 * split is at the LAST separator, which is what makes GitLab's nested subgroups
 * come apart correctly - `g/sub/r` is owner `g/sub` and name `r`, the two
 * strings the `tea` row weighs `--owner` against and the two halves `gh` and
 * `glab` want rejoined.
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
 * Is `owner` this login's OWN user account, rather than an organization on the
 * same instance?
 *
 * THE QUESTION EXISTS BECAUSE `tea` HAS NO SINGLE CREATE GRAMMAR. Measured
 * 2026-08-24 against a live Forgejo instance on tea 0.15.1, logged in as the
 * user `john`: `tea repos create --name r --owner john --private` exits 1 with
 * `Error: GetOrgByName`, because `--owner` resolves as an ORGANIZATION and
 * never as a user account, while the same call with no `--owner` at all exits 0
 * and creates `john/r` under the login user. So the flag is not a spelling of
 * "who owns this" - it is a spelling of "which org", and passing it for a
 * personal repository is the common case failing.
 *
 * The comparison is CASE-INSENSITIVE and trimmed: Gitea resolves an account
 * name without regard to case, so `John` and `john` are one account and a
 * case-sensitive test here would pass `--owner John` at a login named `john`
 * and fail the create for a difference the server does not have.
 *
 * A LOGIN THAT IS NOT A RECORD IS "NOT THE USER", never a throw: this module's
 * standing rule is that unknown or missing inputs answer rather than raise, and
 * the answer that keeps `--owner` in the argv is the one that changes nothing
 * about what shipped before. bin/forge.mjs refuses ahead of the builder when it
 * cannot resolve a login at all, so that arm is unreachable in production.
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
 *
 * WHY THE LOGIN IS NAMED AT ALL. Without `--login`, tea picks a login from its
 * own config - the default one, or the first in file order when none is flagged
 * default (measured here: a single login prints `default` as the STRING
 * `'false'`, so "the default login" is not a value that can be relied on). This
 * argv is built by asking ONE login whether the owner is its user; the create
 * has to then run as THAT login, or the answer was about an account the create
 * never used. Naming it is what makes the question and the call the same login.
 *
 * A NAME OPENING ON `-` IS DROPPED, not passed. The record is third-party bytes
 * from a CLI's stdout, and a value reading as a flag in an argument vector is
 * the one way an untrusted string changes what a command means. The seam
 * refuses such a record outright; this is the second door on the same rule.
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
 * How each provider's CLI is told to create a repository - one row per
 * provider, in the shape `HOST_TABLE` in lib/issue-decision.mjs already uses
 * (CONTEXT D-14): a builder that returns the argv, and a stated fact about what
 * that argv does to the git remote.
 *
 * THE BINARY IS NOT REPEATED HERE. `PROVIDER_TABLE` above already says which
 * binary drives which provider, and a second copy is a second thing to keep in
 * step - the caller reads the name from there and the argv from here.
 *
 * THREE DIFFERENT GRAMMARS FOR ONE OPERATION, measured 2026-08-24 on gh 2.98.0,
 * glab 1.114.0 and tea 0.15.1. `gh` and `glab` take the slug as one positional;
 * `tea` takes the two halves as separate flags and has no positional form. This
 * is why the table is data rather than a formatted string: there is no shape
 * the three share to be parameterized.
 *
 * AND THE `tea` ROW HAS NO SINGLE ARGV EITHER (corrected 2026-08-24, after the
 * first live run of AC7 failed). `--owner` resolves as an ORGANIZATION, so it
 * is wrong for a personal repository - the whole common case - and right only
 * when the owner genuinely is an org. `ownerIsLoginUser` above carries the
 * measurement and `needsLogin` below carries the consequence: this is the one
 * row whose argv cannot be built from the selector alone, because it needs to
 * know who the instance thinks you are. What is measured is the personal arm
 * (no `--owner`, exit 0) and the user arm through `--owner` (exit 1,
 * `GetOrgByName`). What is NOT measured, and is therefore stated as unverified
 * rather than asserted: whether `--owner <org>` succeeds when the owner really
 * IS an organization. That arm ships as the best reading of tea's own error -
 * a flag that looks a name up as an org is a flag for an org - and the first
 * live create into an org is what would confirm or refute it.
 *
 * `needsLogin` IS THE ROW SAYING WHAT IT CANNOT ANSWER ALONE. It does not mean
 * "this forge needs authentication" - all three do. It means the argv on THIS
 * row depends on a login record the seam has to go and read, so bin/forge.mjs
 * must resolve one and refuse before the spawn when it cannot. Reading that off
 * `provider === 'forgejo'` instead would be a rule about a provider's name
 * rather than about the argv beside it, which is the same mistake `wiresRemote`
 * exists to avoid.
 *
 * VISIBILITY IS PINNED, NOT DEFAULTED (CONTEXT D-04). Every row carries
 * `--private` and no row takes a visibility parameter, because the three CLIs
 * disagree about what happens without one: `gh` with no `--public`/`--private`/
 * `--internal` drops to an INTERACTIVE PROMPT, which would hang inside a Bash
 * tool call; `glab` silently defaults to `internal`; `tea` defaults private.
 * Three different defaults is not a choice worth putting to a user, so the
 * value is a fact of the row and the confirmation states it.
 *
 * `wiresRemote` IS READ OFF THE ARGV BESIDE IT, NEVER OFF A PROVIDER'S
 * REPUTATION. It says one thing: does the argv on THIS row leave a git `origin`
 * pointing at the created repository?
 *   glab   TRUE  - `--remoteName origin` sits in the argv, and `glab repo
 *                  create --help` calls it "Remote name for the Git repository
 *                  you're in".
 *   tea    FALSE - `tea repos create --help` mentions no remote at all
 *                  (CONTEXT D-15).
 *   gh     FALSE - the pinned argv carries no `--source`, and `gh repo create
 *                  --help` scopes `-r, --remote` to a create made FROM a local
 *                  source directory. CONTEXT D-15's sentence groups `gh` with
 *                  `glab`; AC6's pinned argv is a measured recording and is
 *                  what this row follows, because flagging `gh` as wiring a
 *                  remote would ship a row contradicting the argv printed
 *                  beside it. See PLAN-2's Notes for what amending AC6 instead
 *                  would have cost.
 * The follow-up that ACTS on the flag is bin/forge.mjs's, not this module's:
 * nothing here spawns anything.
 */
export const CREATE_TABLE = Object.freeze({
  forgejo: Object.freeze({
    wiresRemote: false,
    needsLogin: true,
    /** @param {string} owner @param {string} name
     *  @param {unknown} login the `{name, user}` record for this instance
     *  @returns {string[]} */
    argv: (owner, name, login) => ['repos', 'create', '--name', name,
      // `--owner` NAMES AN ORGANIZATION AND NOTHING ELSE - see the header. It
      // is present only when the owner is NOT this login's own account.
      ...(ownerIsLoginUser(owner, login) ? [] : ['--owner', owner]),
      ...loginFlag(login),
      '--private'],
  }),
  github: Object.freeze({
    wiresRemote: false,
    needsLogin: false,
    /** @param {string} owner @param {string} name @returns {string[]} */
    argv: (owner, name) => ['repo', 'create', `${owner}/${name}`, '--private'],
  }),
  gitlab: Object.freeze({
    wiresRemote: true,
    needsLogin: false,
    /** @param {string} owner @param {string} name @returns {string[]} */
    argv: (owner, name) => ['repo', 'create', `${owner}/${name}`, '--private',
      '--remoteName', 'origin'],
  }),
});
