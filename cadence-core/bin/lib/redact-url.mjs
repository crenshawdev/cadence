// @ts-check
// redact-url.mjs - strip credentials out of text before it reaches a seam envelope. Pure and total, no I/O.
// `redactUrl` covers credentials in URL position and nothing else; callers rely on that claim, so it was never widened.
// `redactCredentials` takes the rest: an `authorization: Bearer <v>` echo and `name=value` pairs.
// `redactAndCap` runs both then caps at 1024 bytes.
// `redactOutbound` is the narrow one, for text bound for an outside reviewer: four shapes, ordinary code untouched.
// Redaction is by shape, never a token-prefix list, which only covers credentials somebody already thought of.
// git anonymizes `https://` and `ssh://` userinfo but leaks a `git://` remote's user and token whole, so don't trust git.

/** What replaces the userinfo and every other removed span: fixed so callers can grep it. */
export const REDACTION_MARK = '<redacted>';
const MARK = REDACTION_MARK;

// 1. scheme-anchored `<scheme>://<userinfo>@`, which covers a password-less `https://<token>@host`
// Every lookbehind pins the start to the start of a run: no verdict changes, and it kills quadratic backtracking
// (a 480k-character input took 84s without it). The scheme rules keep `[0-9+.-]*` inside the capture so `$1` writes the
// prefix back; pinning on letters alone was just as slow. Rules 2 and 2b pin the same way, to the start of a
// `/`-, `@`- or whitespace-delimited run.
const SCHEME_USERINFO = /(?<![A-Za-z0-9+.-])([0-9+.-]*[A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@]+)@/g;

// 2. scheme-less `<user>:<secret>@<host>` and scp `user:token@host:path`; the colon separates it from `git@host:o/r`
// It starts at the first non-colon character of a run, after any leading colons, and not after every colon in it: a later
// start can only match where the first one does, and restarting at each colon of `:a:a:a...` made it quadratic.
// The lookahead goes first so the lookbehind's walk back over a colon prefix only runs at a real candidate start.
const BARE_USERINFO = /(?=[^\s/:@])(?<=(?:^|[\s/@]):*)([^\s/:@]+:[^\s/@]+)@/g;

// 1b + 2b. The same two spans with the `@` cut off, anchored to end of input. Rules 1 and 2 need the `@`, so a userinfo
// whose `@` fell outside the sanitize window matched nothing and the secret survived (#215).
// That over-redacts: any authority ending the input goes (`see https://docs.example.com` comes back redacted), because
// a forge PAT cut before its `@` is byte-for-byte a plain host. 2b keeps the colon, the only discriminator it has.
// Both exclude quotes so a JSON tail like `"secret":"hunter2"}}` isn't eaten as userinfo.
const SCHEME_USERINFO_CUT = /(?<![A-Za-z0-9+.-])([0-9+.-]*[A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/?#@"']+)$/;
const BARE_USERINFO_CUT = /(?=[^\s/:@"'])(?<=(?:^|[\s/@"']):*)[^\s/:@"']+:[^\s/@"']+$/;

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
  // split on whitespace: no rule matches across it, so per-segment equals whole-string, and the pinned starts keep each
  // segment's cost linear
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

// redactOutbound: the wide rules above rewrite ordinary code (`const token = getToken();`), and a reviewer reading
// `<redacted>` mid-expression reviews the wrong code, so the outbound fence takes exactly four shapes and nothing else.
// A value is not a literal when it opens with a real variable (`$NAME`, `${`, `$(`, `$$NAME`, a whole `$1` or `$@`)
// or a `<placeholder>`; `$9x` is a literal, and so is anything in single quotes, which no shell or dotenv expands.
// No cut rules: the fence never windows its input, so a host ending the text is a host, not a credential cut short.
// Each rule starts only at a fixed literal, a line start or behind a pinned lookbehind, so a whole artifact stays linear.

// what opens a non-literal value in a double-quoted or bare position; a positional or special parameter only counts whole
const OUT_VAR = '\\$\\$?[A-Za-z_{(]|\\$[0-9@?#*!$-](?=[\\s"\'`;&|)}]|$)|<';

// an upper-case name that ends like a credential; `KEY` alone isn't one
const OUT_NAME = '(?:[A-Z][A-Z0-9_]*)?(?:TOKEN|SECRET|PASSWORD|PASSWD)|[A-Z][A-Z0-9_]*_KEY';

// a quoted value opens on a non-space and closes on its own line, or runs across lines only to a quote that ends one,
// so a PEM goes whole and the quote closing `'GITHUB_TOKEN=' + token;` never swallows the lines after it
const outQuoted = (q, opener) => `${q}(?![\\s${q}]${opener})(?:[^${q}\\n]+${q}|[^${q}]+${q}(?=[ \\t\\r]*(?:\\n|$)))`;

// `NAME=` with no spaces, then a literal
const OUT_ENV = new RegExp(`(?<![A-Za-z0-9_$.])((?:${OUT_NAME})=)`
  + `(?:${outQuoted('"', `|${OUT_VAR}`)}|${outQuoted("'", '|<')}|(?!${OUT_VAR}|["'=])[^\\s"'\`;&|<>()]+)`, 'g');

// the YAML env-map spelling (`environment:`, `env:`), one entry per line, diff marker and list dash allowed.
// The value must end the line, so a JS property (`API_TOKEN: tok,`) crosses; `|` and `>` open a block, not a value.
// A digit-free run of letters, dots and brackets is a type or an expression (`str`, `Optional[str]`, `process.env.X`).
const OUT_YAML_ENV = new RegExp(`^([+ -]?[ \\t]*(?:-[ \\t]+)?(?:${OUT_NAME})[ \\t]*:[ \\t]+)`
  + `(?:"(?!${OUT_VAR}|")[^"\\n]+"|'(?![<'])[^'\\n]+'`
  + `|(?!${OUT_VAR}|["'|>]|[A-Za-z_.[\\]]+[ \\t]*(?:#.*)?$)\\S*[^\\s,;{(\\[])(?=[ \\t]*(?:#.*)?$)`, 'gm');

// URL userinfo with or without a password, every RFC 3986 userinfo character plus a whole `${NAME}` or `${{ ... }}`;
// exactly `git` is the SSH user, no secret
const OUT_USERINFO = new RegExp('(?<![A-Za-z0-9+.-])([0-9+.-]*[A-Za-z][A-Za-z0-9+.-]*:\\/\\/)(?!git@)'
  + "((?:\\$\\{\\{[^{}\\n]*\\}\\}|\\$\\{[A-Za-z_][A-Za-z0-9_]*\\}|[A-Za-z0-9._~%!$&'()*+,;=:-])+)@", 'g');

// a userinfo part that is a whole variable; one literal part (`$GITHUB_ACTOR:ghp_...`) and the userinfo goes
const OUT_USERINFO_VAR = /^\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\}|\{\{[^{}]*\}\}|\([^()]*\))$/;

// an `Authorization: Bearer` header, the scheme word kept so the reader still sees what the line was; backtick for JS
const OUT_BEARER = /(authorization["'`]?[ \t]*:[ \t]*["'`]?bearer[ \t]+)(?![$<])[A-Za-z0-9._~+/=-]+/gi;

// a quoted api_key pair (`"api_key": "<v>"`, `'openai-api-key': '<v>'`, `"apiKey": "<v>"`), its quotes kept
const OUT_API_KEY = new RegExp(
  `((["'])[A-Za-z0-9_.-]{0,40}?api[_.-]?key\\2[ \\t]*:[ \\t]*(["']))(?!${OUT_VAR})(?:(?!\\3)[^\\n])+\\3`, 'gi');

/**
 * `s` with the four outbound credential shapes replaced by `<redacted>`, every other byte as it was:
 * an upper-case credential-named env assignment's literal value (`NAME=v` or a YAML `NAME: v` entry),
 * URL userinfo other than `git`, an `Authorization: Bearer` value, and a quoted `api_key` pair's value.
 * Coerces and never throws, for the same reason `redactUrl` does.
 * @param {unknown} s
 * @returns {string}
 */
export function redactOutbound(s) {
  let text = String(s);
  // a cheap literal check gates each rule, so a text without the literal never runs the regex
  if (text.indexOf('=') !== -1) text = text.replace(OUT_ENV, `$1${MARK}`);
  if (/(?:TOKEN|SECRET|PASSWORD|PASSWD|_KEY)[ \t]*:/.test(text)) text = text.replace(OUT_YAML_ENV, `$1${MARK}`);
  if (text.indexOf('://') !== -1 && text.indexOf('@') !== -1) {
    text = text.replace(OUT_USERINFO, (whole, scheme, info) => (
      info.split(':').every((part) => part === '' || OUT_USERINFO_VAR.test(part)) ? whole : `${scheme}${MARK}@`));
  }
  if (/authorization/i.test(text)) text = text.replace(OUT_BEARER, `$1${MARK}`);
  if (/api[_.-]?key/i.test(text)) text = text.replace(OUT_API_KEY, `$1${MARK}$3`);
  return text;
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
