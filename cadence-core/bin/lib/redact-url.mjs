// @ts-check
// redact-url.mjs - strip the userinfo out of every remote-looking URL in a
// string, so a caught git error's message can reach a seam envelope without
// carrying a credential (EXP-01, AC8). Pure and TOTAL on the require-int.mjs /
// retired-keys.mjs pattern: node builtins only (it uses none), no I/O, no emit,
// never throws.
//
// TWO exports, deliberately split (RVP-01):
//   `redactUrl`         - credentials in URL POSITION and nothing else. Its
//                         coverage is stated in exactly those words at
//                         issue-check.mjs:41-47, and that statement stays true
//                         because this export was not widened.
//   `redactCredentials` - credential-shaped SPANS a URL-position rule cannot
//                         see: an `authorization: Bearer <value>` echo and a
//                         `<name>=<value>` / `"<name>": "<value>"` pair whose
//                         name is credential-shaped. Added for the provider
//                         seam's HTTP failure excerpt, where the body is
//                         whatever a provider or an intermediary proxy chose to
//                         echo back - including, on a misconfigured gateway, the
//                         request headers.
// A caller that wants both composes them; neither is a superset of the other.
// The split is what lets a per-site regex stay out of the tree (D-14) without
// making one function's documented coverage a lie.
//
// ONE shared helper rather than a regex at each emit site (D-14). Four sites put
// a caught error's message into a `detail` - git-publish.mjs's push-failed,
// reap-failed and dispatch-internal arms, and planning.mjs's no-staged-set arm -
// and lib/publish-decision.mjs:14-17 already states the rule for this class: a
// security-relevant regex duplicated across sites is how the copies drift, and
// the fourth site is the one a reader misses.
//
// WHICH transports leak, measured 2026-08-13 on git 2.55.0 (D-15). git
// anonymizes the URL in its own error for the schemes it recognizes as
// network transports, so the `https://x-access-token:TOKEN@host` form the
// requirement cites never reaches the seam with the token attached:
//
//   git://cad:s3cr3t-tok@host.invalid/r.git   LEAKS
//     fatal: unable to look up cad:s3cr3t-tok@host.invalid (port 9418) ...
//   /nonexistent/cad:s3cr3t-tok@host.invalid/r.git   LEAKS (path-shaped)
//     fatal: '/nonexistent/cad:s3cr3t-tok@host.invalid/r.git' does not appear ...
//   https://cad:s3cr3t-tok@host.invalid/r.git   anonymized by git
//   ssh://cad:s3cr3t-tok@host.invalid/r.git     anonymized by git
//
// So this helper covers the anonymized schemes TOO. Depending on git to keep
// anonymizing them is depending on a behaviour no test here owns, and the two
// forms above are proof the coverage is per-transport rather than universal.
//
// Redaction is by SHAPE - the userinfo POSITION in a URL - never by matching
// known token prefixes. A prefix list (`ghp_`, `glpat-`, `x-access-token`) is a
// list of the credentials somebody already thought of, and the next forge's
// scheme is not on it.

/** What replaces the userinfo. Fixed, so a caller can grep for it. */
const MARK = '<redacted>';

// 1. Scheme-anchored: `<scheme>://<userinfo>@`. The `://` is unambiguous, so
//    this covers a password-less `https://ghp_token@host/r.git` where the whole
//    credential IS the user part. The userinfo class excludes `/ ? # @` and
//    whitespace, so an authority carrying no `@` (`https://host/r.git`) cannot
//    match and comes back byte-identical.
const SCHEME_USERINFO = /([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@]+)@/g;

// 2. Scheme-less: `<user>:<secret>@<host>`, which is what the two leaking forms
//    above actually print, and also the scp-shaped `user:token@host:path`. The
//    COLON is the discriminator that separates a credential from an address:
//    `john@jcrenshaw.dev` in a commit trailer has none and is left alone, and so
//    is the password-less scp remote `git@github.com:org/repo.git`, whose colon
//    falls after the `@` and carries a path rather than a secret. Neither class
//    crosses whitespace or `/`, so the userinfo cannot run backwards out of its
//    own token.
const BARE_USERINFO = /([^\s/:@]+:[^\s/@]+)@/g;

/**
 * `s` with the userinfo of every URL-shaped and scp-shaped remote replaced by
 * `<redacted>`, and everything else byte-identical. A string carrying no
 * userinfo comes back unchanged.
 *
 * Coerces rather than passing through: the callers all hand it
 * `e.message ?? String(e)`, and a helper that returned a non-string input
 * untouched would let an object carrying the same URL route around the one
 * thing this exists to do. So the return is always a string.
 * @param {unknown} s
 * @returns {string}
 */
export function redactUrl(s) {
  return String(s)
    .replace(SCHEME_USERINFO, `$1${MARK}@`)
    .replace(BARE_USERINFO, `${MARK}@`);
}

// 3. An HTTP authorization echo: `Bearer <token>`, optionally with its header
//    name in front so `authorization: Bearer x` goes whole rather than leaving
//    the header name pointing at a hole. The scheme word is consumed TOO - an
//    excerpt that still reads `Bearer <redacted>` has told a reader nothing the
//    name did not, and AC2 asks for the lead-in gone.
const AUTH_SCHEME = /(?:authorization\s*[:=]\s*)?(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi;

// 4. A credential-shaped NAME=VALUE pair, in the four spellings a body actually
//    carries it: `key=v` in a query string, `key: v` in a header dump,
//    `"api_token": "v"` in JSON, and `secret=v` in a form body.
//
//    Shape, not a prefix list, exactly as rules 1 and 2: the discriminator is
//    that a NAME a credential is stored under is followed by a separator and a
//    value. `an invalid token` in an error sentence has neither and survives
//    byte-identical, which is the boundary that keeps this from eating provider
//    diagnostics - the one thing the excerpt exists to carry.
//
//    The leading lookbehind is what stops `monkey=1` from matching on its last
//    three characters: a name may be PREFIXED (`x-api-key`, `openai_api_key`)
//    but only across a `_`, `-` or `.` boundary, never mid-word. The prefix
//    repetition is bounded at four rather than left open: an unbounded nested
//    quantifier backtracks quadratically on a long separator run, and this runs
//    against a provider-controlled body up to the response ceiling.
const CRED_NAME = '(?:[A-Za-z0-9]+[_.-]){0,4}'
  + '(?:api[_.-]?key|access[_.-]?token|refresh[_.-]?token|passwd|password|secret|token|key)';
//    The VALUE is three alternatives, not one class. A quoted value runs to its
//    closing quote so a secret containing a space (`"password": "hunter2 xyz"`)
//    goes whole - the bare class stops at the first space and left the tail in
//    the excerpt, which is the leak this whole rule exists to prevent. Both
//    quoted forms are `[^"]*` / `[^']*`: one bounded quantifier each, so the
//    linear-time property the prefix bound above protects is unchanged.
const CRED_VALUE = `(?:"[^"]*"|'[^']*'|[^\\s&"',;)\\]}>]+)`;
const CRED_PAIR = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?${CRED_NAME}["']?\\s*[:=]\\s*${CRED_VALUE}`, 'gi');

// 5. The same pair in camelCase, which rule 4 structurally cannot reach: its
//    prefix crosses a `_`, `-` or `.` only, and its lookbehind blocks a
//    mid-word terminal, so `apiSecret` and `clientSecret` - the ordinary
//    spelling of a JSON key - passed through byte-identical. Case is the
//    discriminator here rather than a separator, so this pattern is
//    case-SENSITIVE (no `i`) and that is what keeps `monkey` from matching on
//    its last three characters exactly as the lookbehind does for rule 4.
const CRED_PAIR_CAMEL = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?[a-z][A-Za-z0-9]{0,30}(?:Key|Token|Secret|Passwd|Password)["']?`
  + `\\s*[:=]\\s*${CRED_VALUE}`, 'g');

/**
 * `s` with every credential-shaped span replaced by `<redacted>` - the NAME, the
 * separator and the value together, never the value alone. Everything else is
 * byte-identical, including a bare credential WORD carrying no value.
 *
 * Coerces rather than passing through, and never throws, for the same reasons
 * `redactUrl` above does.
 * @param {unknown} s
 * @returns {string}
 */
export function redactCredentials(s) {
  return String(s)
    .replace(AUTH_SCHEME, MARK)
    .replace(CRED_PAIR, MARK)
    .replace(CRED_PAIR_CAMEL, MARK);
}
