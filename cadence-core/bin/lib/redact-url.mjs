// @ts-check
// redact-url.mjs - strip credentials out of text before it reaches a seam envelope: userinfo in the remote-looking URLs of a
// caught git error, and credential-shaped spans in an HTTP failure body. Pure and total: node builtins only (`Buffer` is a
// global), no I/O. Two redactors, deliberately split, plus the mark they both write.
// `redactUrl` covers credentials in URL position and nothing else; callers rely on that claim, so it was never widened.
// `redactCredentials` takes what a URL rule can't see, an `authorization: Bearer <v>` echo and `name=value` pairs, for the
// provider seam's failure excerpt, where a misconfigured gateway may echo the request headers back.
// `redactAndCap` runs both then caps at 1024 bytes; `REDACTION_MARK` is exported so a counting caller uses the same string.
// Redaction is by shape, the userinfo position, never a token-prefix list: that's only the credentials somebody already
// thought of. git anonymizes `https://` and `ssh://` userinfo in its own errors but leaks `git://cad:tok@host/r.git` and
// path-shaped `/x/cad:tok@host/r.git` (git 2.55.0), so this covers the anonymized schemes too instead of trusting git.

/** What replaces the userinfo and every other span removed: fixed so callers can grep it, exported so a counter agrees. */
export const REDACTION_MARK = '<redacted>';
const MARK = REDACTION_MARK;

// 1. scheme-anchored `<scheme>://<userinfo>@`: covers a password-less `https://<token>@host`, where the token is the user part.
// Every rule's lookbehind pins its start to the start of a run. That changes no verdict (an earlier start always wins) and
// it kills the quadratic backtracking: 'A'x240000 + ':' + 'B'x240000 took 84s inside the payload fence without it. The
// scheme rules exclude the whole continuation class and keep `[0-9+.-]*` inside the capture so `$1` writes the prefix back;
// pinning on letters alone took 99.6s on `'1a'x240000 + ':///@'`.
const SCHEME_USERINFO = /(?<![A-Za-z0-9+.-])([0-9+.-]*[A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@]+)@/g;

// 2. scheme-less `<user>:<secret>@<host>` and scp `user:token@host:path`; the colon tells a credential from `git@host:org/repo`
const BARE_USERINFO = /(?<![^\s/:@])([^\s/:@]+:[^\s/@]+)@/g;

// 1b + 2b. The same two spans with their `@` cut off, anchored to end of input. Rules 1 and 2 need the `@`, so a userinfo
// whose `@` fell outside a bounded window matched nothing and the secret survived (#215): `bodyExcerpt` sanitizes only the
// first 4096 bytes. The cost is over-redaction: with the `@` gone, any authority that ends the input is redacted (`see
// https://docs.example.com` comes back `see https://<redacted>`). Deliberate, since cut before its `@` a forge PAT is
// byte-for-byte a plain host. 2b keeps the colon, the only discriminator a scheme-less span has. Both exclude quotes so a
// JSON tail like `"secret":"hunter2"}}` isn't eaten as userinfo. One bounded quantifier per rule and no `g`.
const SCHEME_USERINFO_CUT = /(?<![A-Za-z0-9+.-])([0-9+.-]*[A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@"']+)$/;
const BARE_USERINFO_CUT = /(?<![^\s/:@"'])[^\s/:@"']+:[^\s/@"']+$/;

/**
 * `s` with the userinfo of every URL-shaped and scp-shaped remote replaced by `<redacted>`, everything else byte-identical.
 * The one exception is rules 1b/2b: a span that ends the input is redacted with or without an `@`, since a cut `@` is gone.
 *
 * Coerces instead of passing through: callers hand it `e.message ?? String(e)`, and returning a non-string untouched would let
 * an object carrying the same URL route around the one thing this exists to do.
 * @param {unknown} s
 * @returns {string}
 */
export function redactUrl(s) {
  const text = String(s);
  // split on whitespace: no rule matches across it, so per-segment equals whole-string and cost stays linear (25.5s to 23ms)
  const parts = text.split(/(\s+)/);
  // the cut rules are `$`-anchored, so only the last segment can carry one (an empty last segment matches nothing)
  const last = parts.length - 1;
  for (let i = 0; i <= last; i += 1) {
    // check each rule's required literal with a linear indexOf first, or a terminator-less class backtracks per start
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

// 3. an authorization echo, header and scheme word included; `token` counts only behind its header, bare it's English
const AUTH_SCHEME = new RegExp(
  '(?:authorization\\s*[:=]\\s*)?(?:bearer|basic)\\s+[A-Za-z0-9._~+/=-]+'
  + '|authorization\\s*[:=]\\s*token\\s+[A-Za-z0-9._~+/=-]+', 'gi');

// 4. a credential-shaped name=value pair, in the four spellings a body carries it: `key=v`, `key: v`, `"api_token": "v"`, `secret=v`.
// By shape, not a prefix list: a name a credential lives under is followed by a separator and a value, so `an invalid token`
// in an error sentence survives, which keeps this from eating the provider diagnostics the excerpt exists to carry.
// The lookbehind stops `monkey=1` matching on its last three characters: a name may be prefixed (`x-api-key`) only across
// `_`, `-` or `.`. The prefix repeat is capped at four because an unbounded nested quantifier backtracks quadratically on a
// long separator run, and this runs on provider-controlled bodies. `pass` and `pwd` (`DB_PASS`) count only behind a prefix:
// bare, `pass: 3` is a test count and `pwd: /home/u` a shell line.
const CRED_NAME = '(?:(?:[A-Za-z0-9]+[_.-]){0,4}'
  + '(?:api[_.-]?key|access[_.-]?token|refresh[_.-]?token|passwd|password|secret|token|key)'
  + '|(?:[A-Za-z0-9]+[_.-]){1,4}(?:pass|pwd))';
// the value has five alternatives. A quoted value runs to its closing quote so a secret with a space
// (`"password": "hunter2 xyz"`) goes whole; the bare class stops at the first space and left the tail in the excerpt.
// The unterminated quoted forms exist because `bodyExcerpt` sanitizes a bounded window, so a credential straddling it
// arrives with its opening quote and no closing one, and 73 bytes of a value once reached the envelope that way. The
// terminated forms go first, so a well-formed body is untouched and the worst case is over-redacting a malformed tail.
// Each quoted form is one bounded quantifier.
const CRED_VALUE = `(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|[^\\s&"',;)\\]}>]+)`;
const CRED_PAIR = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?${CRED_NAME}["']?\\s*[:=]\\s*${CRED_VALUE}`, 'gi');

// 5. rule 4 in camelCase (`apiSecret`), which its separator-based prefix can't reach; no `i` flag, case is the discriminator
const CRED_PAIR_CAMEL = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?[a-z][A-Za-z0-9]{0,30}(?:Key|Token|Secret|Passwd|Password)["']?`
  + `\\s*[:=]\\s*${CRED_VALUE}`, 'g');

// 6. upper case, no separator (`PGPASSWORD`); no `KEY`, `PASS` or `PWD` here, since `MONKEY`, `BYPASS` and `OLDPWD` end in them
const CRED_PAIR_UPPER = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?[A-Z][A-Z0-9]{0,30}(?:PASSWORD|PASSWD|SECRET|TOKEN)["']?`
  + `\\s*[:=]\\s*${CRED_VALUE}`, 'g');

/**
 * `s` with every credential-shaped span replaced by `<redacted>`: the name, the separator and the value together, never the
 * value alone. Everything else is byte-identical, including a bare credential word with no value.
 * Coerces and never throws, for the same reasons `redactUrl` does.
 * @param {unknown} s
 * @returns {string}
 */
export function redactCredentials(s) {
  return String(s)
    .replace(AUTH_SCHEME, MARK)
    .replace(CRED_PAIR, MARK)
    .replace(CRED_PAIR_CAMEL, MARK)
    .replace(CRED_PAIR_UPPER, MARK);
}

// redactAndCap: the one excerpt builder for text from outside this process, so there's one cap and one order of operations

// 1024 bytes, measured: the biggest real OpenAI error body in review-provider's fixtures is 155 bytes, so 4x headroom
const MAX_EXCERPT_BYTES = 1024;

// appended where the cut happened so a reader can tell an excerpt from a whole body; inside the cap, not on top of it
const TRUNCATED = ' ...[truncated]';

// how much raw text the sanitizers ever see: a cost bound, not a privacy one (see `redactAndCap`)
const SANITIZE_WINDOW_BYTES = MAX_EXCERPT_BYTES * 4;

/**
 * A sanitized, capped string: one shape always, never a parsed object for a small input and a string for a large one.
 * Sanitize before cutting: cutting first can slice a credential in half and leave its prefix in the envelope.
 * Two sanitizers because neither covers the other: `redactUrl` takes URL position, `redactCredentials` takes the rest.
 * The window is a cost bound and not optional: `redactUrl` was quadratic (5.1s at 80KB), and a 4 MiB provider body would be
 * hours of CPU for one failure envelope. Its other callers hand it a git error, so the cost only became reachable here.
 * The window's edge can leave a credential's opening quote inside and its closing quote outside, which is why
 * `redactCredentials` matches an unterminated quoted value to end of input (rule 4). The `clean <= room` arm below alone
 * missed a body that shrank to just past the cap and let 73 bytes of a value through, so it's a second line of defence.
 * The cut is by bytes and the head is trimmed back if it landed mid-code-point, so the result never exceeds the cap.
 * @param {unknown} raw
 * @returns {string}
 */
export function redactAndCap(raw) {
  const full = raw == null ? '' : String(raw);
  const buf = Buffer.from(full, 'utf8');
  const windowed = buf.length > SANITIZE_WINDOW_BYTES;
  let clean = redactCredentials(redactUrl(
    windowed ? buf.subarray(0, SANITIZE_WINDOW_BYTES).toString('utf8') : full));
  const room = MAX_EXCERPT_BYTES - Buffer.byteLength(TRUNCATED);
  if (windowed && Buffer.byteLength(clean) <= room) {
    const lastSpace = clean.search(/\s\S*$/);
    clean = lastSpace >= 0 ? clean.slice(0, lastSpace) : '';
  }
  if (!windowed && Buffer.byteLength(clean) <= MAX_EXCERPT_BYTES) return clean;
  let head = Buffer.from(clean, 'utf8').subarray(0, room).toString('utf8');
  // a partial code point re-encodes as U+FFFD, wider than the bytes it replaced, so drop characters until it fits
  while (Buffer.byteLength(head) > room) head = head.slice(0, -1);
  return head + TRUNCATED;
}
