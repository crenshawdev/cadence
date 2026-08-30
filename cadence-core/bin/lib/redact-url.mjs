// @ts-check
// redact-url.mjs - strip the userinfo out of every remote-looking URL in a
// string, so a caught git error's message can reach a seam envelope without
// carrying a credential (EXP-01, AC8). Pure and TOTAL on the require-int.mjs /
// retired-keys.mjs pattern: node builtins only (it uses none), no I/O, no emit,
// never throws.
//
// TWO REDACTORS, deliberately split (RVP-01), plus the mark they both write:
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
//   `REDACTION_MARK`    - the string both write in place of what they removed.
//                         Exported because a caller that COUNTS redactions - the
//                         outbound payload fence in review-provider.mjs - needs
//                         the same constant, and a copied literal is the drift
//                         D-14 exists to keep out of the tree.
// A caller that wants both redactors composes them; neither is a superset of the
// other. The split is what lets a per-site regex stay out of the tree (D-14)
// without making one function's documented coverage a lie.
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
// COST, and the two things that bound it (#167). This helper used to run against
// a 4096-byte excerpt only, so its cost never showed. The outbound payload fence
// in `review-provider.mjs` hands it a whole artifact - up to
// `review.max_prompt_tokens`, ~480,000 characters at the default - and measured
// there the unbounded form took 25 seconds on 128,000 characters and would have
// taken minutes on a real payload. Both rules were QUADRATIC: a greedy class
// with no `:` or `@` after it backtracks once per start position, and a long
// run without either character is every long run.
//
// Two bounds, together linear in practice and bounded in the worst case:
//
//   1. `redactUrl` segments on WHITESPACE and applies the rules per segment.
//      Every class in all four rules excludes whitespace, so a match cannot
//      cross a run of it and the segmentation changes no verdict. Measured on a
//      462,000-character diff of ordinary code: 25.5s -> 23ms.
//   2. A segment is only handed to a rule when it CONTAINS the literal that
//      rule cannot match without - `@` for the two terminated rules, `:` for
//      the scheme-less ones, `://` for the scheme-anchored ones. One `indexOf`
//      per rule, and it skips a delimiter-free run outright.
//   3. Each rule carries a LOOKBEHIND that pins its start to the beginning of a
//      run, which is what bounds the case bound 2 lets through: a single
//      whitespace-free segment holding both the literal and a long run, which
//      is an ordinary minified bundle or a data URI. Measured before this,
//      `'A'x240000 + ':' + 'B'x240000 + '/'` spent 84 SECONDS inside the fence.
//
//      Each lookbehind is a NO-OP on the verdict, and provably so rather than
//      by inspection: a rule's first class is greedy over one character class,
//      so if it can match starting mid-run it can also match starting one
//      character earlier - the earlier attempt consumes the same characters and
//      reaches the same separator. Leftmost-match means the engine returns that
//      earlier one anyway, so a start whose PREVIOUS character is in the class
//      never produced a match that survived. Blocking it removes attempts, not
//      matches.
//
// None of the three moves a verdict, and that is deliberate: the QUANTIFIERS
// are still unbounded, because bounding them at 1024 was tried and it re-opened
// EXP-02 (#215) - a 2000-character userinfo cut before its `@` came back
// redacted from its tail with 985 bytes of the secret surviving. A cost bound
// that reintroduces a measured leak is not a cost bound worth having.
//
// Redaction is by SHAPE - the userinfo POSITION in a URL - never by matching
// known token prefixes. A prefix list (`ghp_`, `glpat-`, `x-access-token`) is a
// list of the credentials somebody already thought of, and the next forge's
// scheme is not on it.

/**
 * What replaces the userinfo, and every other span these redactors remove.
 * Fixed, so a caller can grep for it - and exported, so a caller that counts
 * occurrences of it counts the same string this file writes.
 */
export const REDACTION_MARK = '<redacted>';
const MARK = REDACTION_MARK;

// 1. Scheme-anchored: `<scheme>://<userinfo>@`. The `://` is unambiguous, so
//    this covers a password-less `https://ghp_token@host/r.git` where the whole
//    credential IS the user part. The userinfo class excludes `/ ? # @` and
//    whitespace, so an authority carrying no `@` (`https://host/r.git`) cannot
//    match and comes back byte-identical.
const SCHEME_USERINFO = /(?<![A-Za-z])([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@]+)@/g;

// 2. Scheme-less: `<user>:<secret>@<host>`, which is what the two leaking forms
//    above actually print, and also the scp-shaped `user:token@host:path`. The
//    COLON is the discriminator that separates a credential from an address:
//    `john@jcrenshaw.dev` in a commit trailer has none and is left alone, and so
//    is the password-less scp remote `git@github.com:org/repo.git`, whose colon
//    falls after the `@` and carries a path rather than a secret. Neither class
//    crosses whitespace or `/`, so the userinfo cannot run backwards out of its
//    own token.
const BARE_USERINFO = /(?<![^\s/:@])([^\s/:@]+:[^\s/@]+)@/g;

// 1b + 2b. The SAME two spans with their `@` cut off, anchored to end-of-input.
//    Both rules above are `@`-anchored, so a userinfo span whose `@` falls
//    outside a bounded window matches nothing and the credential survives
//    byte-identical. `bodyExcerpt` (review-provider.mjs) sanitizes only the
//    first 4096 bytes of a provider response, and a body compressible enough to
//    shrink past the 1024-byte excerpt cap carried a planted secret into the
//    failure envelope through exactly that gap (EXP-02, #215). This is the same
//    hole `CRED_VALUE` below already closes for a quoted `name:value` pair, in
//    the same shape and for the same reason: the terminated forms are tried
//    FIRST, so a well-formed body is untouched, and the worst an unterminated
//    tail can cost is over-redaction of that tail - never a leak.
//
//    What the anchor COSTS, stated here rather than rediscovered later. With
//    the `@` gone the discriminator went with it, so 1b redacts any authority
//    that ENDS the input: a body whose last characters are
//    `see https://docs.example.com` comes back `see https://<redacted>`. That
//    is deliberate, not an oversight - `https://ghp_token@host` is the ordinary
//    spelling of a forge PAT and rule 1 exists to catch it, and cut before its
//    `@` it is byte-for-byte a plain host. 2b keeps rule 2's COLON, which is
//    the only discriminator a scheme-less span ever had; without it every
//    trailing word would be a credential.
//
//    Both classes additionally exclude `"` and `'`, which the terminated forms
//    have no need to. An unterminated span can only end where the input does,
//    so a JSON body's own tail - `..."secret":"hunter2"}}` - otherwise reads as
//    one scheme-less userinfo span and the diagnostic the excerpt exists to
//    carry is eaten with it. A real userinfo carries no quote (they
//    percent-encode), so the exclusion costs nothing on the class this catches
//    and keeps the match INSIDE the JSON string where a cut URL actually sits.
//
//    One bounded quantifier per rule and no nesting, so the linear-time
//    property this file's header pays for is unchanged. No `g`: end-of-input
//    can match at most once.
const SCHEME_USERINFO_CUT = /(?<![A-Za-z])([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@"']+)$/;
const BARE_USERINFO_CUT = /(?<![^\s/:@"'])[^\s/:@"']+:[^\s/@"']+$/;

/**
 * `s` with the userinfo of every URL-shaped and scp-shaped remote replaced by
 * `<redacted>`, and everything else byte-identical. A string carrying no
 * userinfo comes back unchanged, with the ONE exception rules 1b/2b state: a
 * URL-shaped or `user:secret`-shaped span that ENDS the input is redacted
 * whether or not an `@` follows it, because a cut `@` is unrecoverable and the
 * span may be a credential the window sliced.
 *
 * Coerces rather than passing through: the callers all hand it
 * `e.message ?? String(e)`, and a helper that returned a non-string input
 * untouched would let an object carrying the same URL route around the one
 * thing this exists to do. So the return is always a string.
 * @param {unknown} s
 * @returns {string}
 */
export function redactUrl(s) {
  const text = String(s);
  // SEGMENTED ON WHITESPACE, and the header above says why. Every class in the
  // four rules excludes whitespace, so no match can cross a run of it: applying
  // the rules per segment is EQUIVALENT to applying them to the whole string,
  // and it is what keeps the cost linear in the total length rather than
  // quadratic in it.
  //
  // `split(/(\s+)/)` keeps the separators as members, so the join is
  // byte-identical on an input with nothing to redact.
  const parts = text.split(/(\s+)/);
  // The two CUT rules are `$`-anchored, so only the LAST segment can carry one -
  // and if the input ends in whitespace that segment is the empty string, which
  // matches nothing, exactly as an `$` after whitespace would.
  const last = parts.length - 1;
  for (let i = 0; i <= last; i += 1) {
    // The LITERAL each rule cannot match without. Checking for it first is a
    // linear `indexOf`; running the rule without it is the quadratic walk the
    // header describes, because a class with no terminator ahead of it
    // backtracks the whole segment once per start position. A segment carrying
    // the literal is scanned exactly as before, so no verdict moves.
    const at = parts[i].indexOf('@') !== -1;
    const colon = parts[i].indexOf(':') !== -1;
    const scheme = parts[i].indexOf('://') !== -1;
    let p = parts[i];
    if (at && scheme) p = p.replace(SCHEME_USERINFO, `$1${MARK}@`);
    if (at && colon) p = p.replace(BARE_USERINFO, `${MARK}@`);
    if (i === last) {
      if (scheme) p = p.replace(SCHEME_USERINFO_CUT, `$1${MARK}`);
      if (colon) p = p.replace(BARE_USERINFO_CUT, MARK);
    }
    parts[i] = p;
  }
  return parts.join('');
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
//    The VALUE is five alternatives, not one class. A quoted value runs to its
//    closing quote so a secret containing a space (`"password": "hunter2 xyz"`)
//    goes whole - the bare class stops at the first space and left the tail in
//    the excerpt, which is the leak this whole rule exists to prevent.
//
//    The UNTERMINATED quoted forms exist because a caller may hand this a
//    PREFIX of a larger body: `bodyExcerpt` sanitizes a bounded window, so a
//    credential straddling that window arrives carrying its opening quote and
//    no closing one. The terminated alternatives cannot match it, and the bare
//    class excludes `"` and `'` so it cannot match either - the whole pair used
//    to survive byte-identical, and 73 bytes of a value reached the failure
//    envelope in the measured case. Running to end-of-input closes that. The
//    terminated forms are tried FIRST, so a well-formed body is untouched, and
//    the worst an unterminated quote costs is over-redaction of a malformed
//    tail - never a leak.
//
//    All four quoted forms are `[^"]*` / `[^']*`: one bounded quantifier each,
//    so the linear-time property the prefix bound above protects is unchanged.
const CRED_VALUE = `(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|[^\\s&"',;)\\]}>]+)`;
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
