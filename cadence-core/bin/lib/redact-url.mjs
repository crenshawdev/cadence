// @ts-check
// redact-url.mjs - strip credentials out of text before it reaches a seam envelope. Pure and total, no I/O.
// `redactUrl` covers credentials in URL position and nothing else; callers rely on that claim, so it was never widened.
// `redactCredentials` takes the rest: an `authorization: Bearer <v>` echo and `name=value` pairs.
// `redactAndCap` runs both then caps at 1024 bytes.
// Redaction is by shape, never a token-prefix list, which only covers credentials somebody already thought of.
// git anonymizes `https://` and `ssh://` userinfo but leaks `git://cad:tok@host/r.git`, so don't trust git to do it.

/** What replaces the userinfo and every other removed span: fixed so callers can grep it. */
export const REDACTION_MARK = '<redacted>';
const MARK = REDACTION_MARK;

// 1. scheme-anchored `<scheme>://<userinfo>@`, which covers a password-less `https://<token>@host`
// Every lookbehind pins the start to the start of a run: no verdict changes, and it kills quadratic backtracking
// (a 480k-character input took 84s without it). The scheme rules keep `[0-9+.-]*` inside the capture so `$1` writes the
// prefix back; pinning on letters alone was just as slow.
const SCHEME_USERINFO = /(?<![A-Za-z0-9+.-])([0-9+.-]*[A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@]+)@/g;

// 2. scheme-less `<user>:<secret>@<host>` and scp `user:token@host:path`; the colon separates it from `git@host:o/r`
const BARE_USERINFO = /(?<![^\s/:@])([^\s/:@]+:[^\s/@]+)@/g;

// 1b + 2b. The same two spans with the `@` cut off, anchored to end of input. Rules 1 and 2 need the `@`, so a userinfo
// whose `@` fell outside the sanitize window matched nothing and the secret survived (#215).
// That over-redacts: any authority ending the input goes (`see https://docs.example.com` comes back redacted), because
// a forge PAT cut before its `@` is byte-for-byte a plain host. 2b keeps the colon, the only discriminator it has.
// Both exclude quotes so a JSON tail like `"secret":"hunter2"}}` isn't eaten as userinfo.
const SCHEME_USERINFO_CUT = /(?<![A-Za-z0-9+.-])([0-9+.-]*[A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@"']+)$/;
const BARE_USERINFO_CUT = /(?<![^\s/:@"'])[^\s/:@"']+:[^\s/@"']+$/;

/**
 * `s` with the userinfo of every URL-shaped and scp-shaped remote replaced by `<redacted>`, the rest byte-identical.
 * The one exception is rules 1b/2b: a span that ends the input is redacted with or without an `@`.
 *
 * Coerces instead of passing through, or an object carrying the same URL would route around what this exists to do.
 * @param {unknown} s
 * @returns {string}
 */
export function redactUrl(s) {
  const text = String(s);
  // split on whitespace: no rule matches across it, so per-segment equals whole-string and cost stays linear
  const parts = text.split(/(\s+)/);
  // the cut rules are `$`-anchored, so only the last segment can carry one
  const last = parts.length - 1;
  for (let i = 0; i <= last; i += 1) {
    // check each rule's required literal with a linear indexOf first, or a terminator-less class backtracks
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

// 3. an authorization echo, scheme word included; `token` counts only behind its header, bare it's English
const AUTH_SCHEME = new RegExp(
  '(?:authorization\\s*[:=]\\s*)?(?:bearer|basic)\\s+[A-Za-z0-9._~+/=-]+'
  + '|authorization\\s*[:=]\\s*token\\s+[A-Za-z0-9._~+/=-]+', 'gi');

// 4. a credential-shaped name=value pair: `key=v`, `key: v`, `"api_token": "v"`, `secret=v`
// By shape: a name is followed by a separator and a value, so `an invalid token` in an error sentence survives.
// The lookbehind stops `monkey=1` matching on its last three characters; a prefix (`x-api-key`) goes only across `_-.`.
// The prefix repeat is capped at four: an unbounded nested quantifier backtracks quadratically on provider bodies.
// `pass` and `pwd` (`DB_PASS`) count only behind a prefix: bare, `pass: 3` is a test count and `pwd: /home/u` a path.
const CRED_NAME = '(?:(?:[A-Za-z0-9]+[_.-]){0,4}'
  + '(?:api[_.-]?key|access[_.-]?token|refresh[_.-]?token|passwd|password|secret|token|key)'
  + '|(?:[A-Za-z0-9]+[_.-]){1,4}(?:pass|pwd))';
// a quoted value runs to its closing quote so a secret with a space (`"password": "hunter2 xyz"`) goes whole
// the unterminated forms exist because the sanitize window can cut a value after its opening quote, and 73 bytes of one
// once reached the envelope that way; terminated forms go first, so the worst case is over-redacting a malformed tail
const CRED_VALUE = `(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|[^\\s&"',;)\\]}>]+)`;
const CRED_PAIR = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?${CRED_NAME}["']?\\s*[:=]\\s*${CRED_VALUE}`, 'gi');

// 5. rule 4 in camelCase (`apiSecret`), which its prefix can't reach; no `i` flag, case is the discriminator
const CRED_PAIR_CAMEL = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?[a-z][A-Za-z0-9]{0,30}(?:Key|Token|Secret|Passwd|Password)["']?`
  + `\\s*[:=]\\s*${CRED_VALUE}`, 'g');

// 6. upper case, no separator (`PGPASSWORD`); no `KEY`, `PASS` or `PWD`, since `MONKEY` and `BYPASS` end in them
const CRED_PAIR_UPPER = new RegExp(
  `(?<![A-Za-z0-9_.-])["']?[A-Z][A-Z0-9]{0,30}(?:PASSWORD|PASSWD|SECRET|TOKEN)["']?`
  + `\\s*[:=]\\s*${CRED_VALUE}`, 'g');

/**
 * `s` with every credential-shaped span replaced by `<redacted>`: name, separator and value, never the value alone.
 * Everything else is byte-identical, including a bare credential word with no value.
 * Coerces and never throws, for the same reason `redactUrl` does.
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

// redactAndCap: the one excerpt builder for text from outside this process, so there's one cap and one order

// 1024 bytes: the biggest real error body in the fixtures is 155, so that's headroom
const MAX_EXCERPT_BYTES = 1024;

// appended where the cut happened so a reader can tell an excerpt from a whole body; inside the cap, not on top
const TRUNCATED = ' ...[truncated]';

// how much raw text the sanitizers ever see: a cost bound, not a privacy one
const SANITIZE_WINDOW_BYTES = MAX_EXCERPT_BYTES * 4;

/**
 * A sanitized, capped string: one shape always.
 * Sanitize before cutting: cutting first can slice a credential in half and leave its prefix in the envelope.
 * The window isn't optional: `redactUrl` was quadratic, so a 4 MiB provider body would burn hours.
 * Its edge can leave a credential's opening quote inside and the closing one outside, hence rule 4's open forms.
 * The `clean <= room` arm alone missed a body that shrank to just past the cap and let 73 bytes through.
 * The cut is by bytes, trimmed back off a mid-code-point, so the result never exceeds the cap.
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
