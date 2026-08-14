// @ts-check
// redact-url.mjs - strip the userinfo out of every remote-looking URL in a
// string, so a caught git error's message can reach a seam envelope without
// carrying a credential (EXP-01, AC8). Pure and TOTAL on the require-int.mjs /
// retired-keys.mjs pattern: node builtins only (it uses none), no I/O, no emit,
// never throws.
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
