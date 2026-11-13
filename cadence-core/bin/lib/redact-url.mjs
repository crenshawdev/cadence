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
// `<redacted>` mid-expression reviews the wrong code, so source text crosses a narrow fence of four single-line shapes.
// Guessing from a value's shape whether YAML or a quoted run is code or a literal traded leaks for garbling every round,
// so a diff is fenced per file instead: a config file's part loses what the wide or the narrow rules take, the rest
// crosses the narrow ones.
// A value is not a literal when it opens with a real variable (`$NAME`, `${`, `$(`, `$$NAME`, a whole `$1` or `$@`)
// or a `<placeholder>`; `$9x` is a literal, and so is anything in single quotes, which no shell or dotenv expands.
// No cut rules on the narrow side: it never windows its input, so a host ending the text is a host.
// Each rule starts only at a fixed literal, a line start or behind a pinned lookbehind, so a whole artifact stays linear.

// what opens a non-literal value in a double-quoted or bare position; a positional or special parameter only counts whole
const OUT_VAR = '\\$\\$?[A-Za-z_{(]|\\$[0-9@?#*!$-](?![A-Za-z0-9_])|<';

// an upper-case name that ends like a credential; `KEY` alone isn't one
const OUT_NAME = '(?:[A-Z][A-Z0-9_]*)?(?:TOKEN|SECRET|PASSWORD|PASSWD)|[A-Z][A-Z0-9_]*_KEY';

// a quoted value opens on a non-space and closes on its own line, so the quote closing `'GITHUB_TOKEN=' + token;`
// never runs into the lines after it; a multi-line value lives in a config file, and that part gets the wide rules
const outQuoted = (q, opener) => `${q}(?![\\s${q}]${opener})[^${q}\\n]+${q}`;

// `NAME=` with no spaces, then a literal
const OUT_ENV = new RegExp(`(?<![A-Za-z0-9_$.])((?:${OUT_NAME})=)`
  + `(?:${outQuoted('"', `|${OUT_VAR}`)}|${outQuoted("'", '|<')}|(?!${OUT_VAR}|["'=])[^\\s"'\`;&|<>()]+)`, 'g');

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
 * A text mid-redaction. Character i stands for `from[i]`..`to[i]` of the original: a kept character for itself, a mark
 * character for the whole span its mark took. Null arrays mean nothing has been taken yet.
 * @typedef {{text: string, from: Int32Array | null, to: Int32Array | null}} Tracked
 */

/**
 * `t` with each `[a, b)` of `cuts` (flat pairs, ascending, disjoint, non-empty, in `t.text`) replaced by a mark.
 * Each mark's span of the original goes onto `spans` as a flat pair.
 * @param {Tracked} t
 * @param {number[]} cuts
 * @param {number[]} spans
 * @returns {Tracked}
 */
function applyCuts(t, cuts, spans) {
  if (cuts.length === 0) return t;
  const old = t.text;
  let size = old.length;
  for (let k = 0; k < cuts.length; k += 2) size += MARK.length - (cuts[k + 1] - cuts[k]);
  const from = new Int32Array(size);
  const to = new Int32Array(size);
  /** @type {(r: number, a: number, w: number) => void} */
  const keep = (r, a, w) => {
    if (t.from && t.to) {
      from.set(t.from.subarray(r, a), w);
      to.set(t.to.subarray(r, a), w);
    } else {
      for (let i = r; i < a; i += 1) { from[w + i - r] = i; to[w + i - r] = i + 1; }
    }
  };
  const pieces = [];
  let r = 0;
  let w = 0;
  for (let k = 0; k < cuts.length; k += 2) {
    const a = cuts[k];
    const b = cuts[k + 1];
    keep(r, a, w);
    w += a - r;
    // order is kept, so the first character's start and the last one's end bound everything between
    const s = t.from ? t.from[a] : a;
    const e = t.to ? t.to[b - 1] : b;
    from.fill(s, w, w + MARK.length);
    to.fill(e, w, w + MARK.length);
    w += MARK.length;
    spans.push(s, e);
    pieces.push(old.slice(r, a), MARK);
    r = b;
  }
  keep(r, old.length, w);
  pieces.push(old.slice(r));
  return { text: pieces.join(''), from, to };
}

/**
 * `t` after a `replace` with `re`: the same matches, and `cut` names the part of each the mark takes, `[a, b)` inside
 * the match, or null to leave it be. With `start`, `re` sees only the text from there on, as if it were all there was.
 * @param {Tracked} t
 * @param {RegExp} re
 * @param {(m: RegExpExecArray) => [number, number] | null} cut
 * @param {number[]} spans
 * @param {number} [start]
 * @returns {Tracked}
 */
function replaceTracked(t, re, cut, spans, start = 0) {
  const src = start === 0 ? t.text : t.text.slice(start);
  /** @type {number[]} */
  const cuts = [];
  re.lastIndex = 0;
  for (let m = re.exec(src); m !== null; m = re.global ? re.exec(src) : null) {
    const c = cut(m);
    if (c && c[1] > c[0]) cuts.push(start + m.index + c[0], start + m.index + c[1]);
    // replace steps past an empty match, so this does too, or it finds the same one forever
    if (m[0] === '') re.lastIndex += 1;
  }
  return applyCuts(t, cuts, spans);
}

/**
 * The narrow fence: four single-line shapes go, every other byte stays.
 * @param {Tracked} t
 * @param {number[]} spans
 * @returns {Tracked}
 */
function narrowTracked(t, spans) {
  // a cheap literal check gates each rule, so a text without the literal never runs the regex
  if (t.text.indexOf('=') !== -1) t = replaceTracked(t, OUT_ENV, (m) => [m[1].length, m[0].length], spans);
  if (t.text.indexOf('://') !== -1 && t.text.indexOf('@') !== -1) {
    t = replaceTracked(t, OUT_USERINFO, (m) => (
      m[2].split(':').every((part) => part === '' || OUT_USERINFO_VAR.test(part))
        ? null : [m[1].length, m[0].length - 1]), spans);
  }
  if (/authorization/i.test(t.text)) t = replaceTracked(t, OUT_BEARER, (m) => [m[1].length, m[0].length], spans);
  if (/api[_.-]?key/i.test(t.text)) {
    t = replaceTracked(t, OUT_API_KEY, (m) => [m[1].length, m[0].length - m[3].length], spans);
  }
  return t;
}

/**
 * `redactCredentials(redactUrl(t))`, rule for rule, with each mark tracked to the original. No redactUrl rule crosses
 * whitespace, so the whole text matches as its segments do; only the cut rules are held to the last segment.
 * A test pins this to those two functions' own output, so a rule added there and not here fails instead of leaking.
 * @param {Tracked} t
 * @param {number[]} spans
 * @returns {Tracked}
 */
function wideTracked(t, spans) {
  if (t.text.indexOf('@') !== -1) {
    if (t.text.indexOf('://') !== -1) {
      t = replaceTracked(t, SCHEME_USERINFO, (m) => [m[1].length, m[0].length - 1], spans);
    }
    if (t.text.indexOf(':') !== -1) t = replaceTracked(t, BARE_USERINFO, (m) => [0, m[0].length - 1], spans);
  }
  let last = t.text.length;
  while (last > 0 && !/\s/.test(t.text[last - 1])) last -= 1;
  if (t.text.indexOf('://', last) !== -1) {
    t = replaceTracked(t, SCHEME_USERINFO_CUT, (m) => [m[1].length, m[0].length], spans, last);
  }
  if (t.text.indexOf(':', last) !== -1) t = replaceTracked(t, BARE_USERINFO_CUT, (m) => [0, m[0].length], spans, last);
  for (const re of [AUTH_SCHEME, CRED_PAIR, CRED_PAIR_CAMEL, CRED_PAIR_UPPER]) {
    t = replaceTracked(t, re, (m) => [0, m[0].length], spans);
  }
  return t;
}

// a YAML block under a credential name (`PRIVATE_KEY: |`, `>-`): the wide rules take the `|` as the value and let the
// block cross, so config text loses the block first
const OUT_YAML_BLOCK = new RegExp(`^([+ -]?)([ \\t]*(?:-[ \\t]+)?)(?:${OUT_NAME})[ \\t]*:[ \\t]+[|>][+-]?[ \\t]*(?:#.*)?$`,
  'gm');

/**
 * The block under each OUT_YAML_BLOCK key as a cut, from its first line's text to its last line's end; the key line,
 * each line's marker and indent, and the blank lines before it stay.
 * @param {string} text
 * @returns {number[]}
 */
function yamlBlockCuts(text) {
  /** @type {number[]} */
  const cuts = [];
  OUT_YAML_BLOCK.lastIndex = 0;
  for (let head = OUT_YAML_BLOCK.exec(text); head !== null; head = OUT_YAML_BLOCK.exec(text)) {
    // `$` stops before a `\r` too, so the key line runs to its own `\n` and a CRLF key line keeps both bytes
    let headEnd = text.indexOf('\n', head.index + head[0].length);
    if (headEnd === -1) headEnd = text.length;
    // a diff marker on the key means one on every line under it, so the depth is measured past it
    const marker = head[1].length;
    const depth = head[2].length;
    let at = headEnd;
    let start = -1;
    let blockEnd = headEnd;
    while (at < text.length) {
      let end = text.indexOf('\n', at + 1);
      if (end === -1) end = text.length;
      const line = text.slice(at + 1, end);
      const body = marker && /^[+ -]/.test(line) ? line.slice(1) : line;
      const indent = /^[ \t]*/.exec(body)?.[0].length ?? 0;
      // blank lines belong to a block but never end one, so a trailing blank stays outside the mark
      if (body.trim() !== '') {
        if (indent <= depth) break;
        if (start === -1) start = at + 1 + line.length - body.length + indent;
        // the last line's `\r` stays outside the mark, so the mark line ends the way the block did
        blockEnd = line.endsWith('\r') ? end - 1 : end;
      }
      at = end;
    }
    if (start !== -1) {
      cuts.push(start, blockEnd);
      OUT_YAML_BLOCK.lastIndex = blockEnd;
    }
  }
  return cuts;
}

/**
 * `text` with each span of `spans` (flat pairs, any order) replaced by a mark, overlapping spans sharing one.
 * @param {string} text
 * @param {number[]} spans
 * @returns {string}
 */
function markSpans(text, spans) {
  const order = [];
  for (let k = 0; k < spans.length; k += 2) order.push(k);
  order.sort((x, y) => spans[x] - spans[y] || spans[y + 1] - spans[x + 1]);
  const pieces = [];
  let r = 0;
  let s = -1;
  let e = -1;
  for (const k of order) {
    if (spans[k] < e) {
      if (spans[k + 1] > e) e = spans[k + 1];
      continue;
    }
    if (e !== -1) { pieces.push(text.slice(r, s), MARK); r = e; }
    s = spans[k];
    e = spans[k + 1];
  }
  if (e !== -1) { pieces.push(text.slice(r, s), MARK); r = e; }
  pieces.push(text.slice(r));
  return pieces.join('');
}

// the files whose literals are config, not code: they get the wide rules, the fence's rule before the narrow one existed
const CONFIG_PATH = /(?:^|\/)(?:\.env[^/]*|\.npmrc|\.netrc|Dockerfile|[^/]*\.(?:ya?ml|toml|ini|cfg|conf|properties|sh))$/;

/**
 * Whether a `diff --git a/<A> b/<B>` part is a config file's: either side, so a rename out of `.env` still counts.
 * @param {string} part
 * @returns {boolean}
 */
function isConfigPart(part) {
  const nl = part.indexOf('\n');
  const head = (nl === -1 ? part : part.slice(0, nl)).replace(/\r$/, '');
  const cut = Math.max(head.lastIndexOf(' b/'), head.lastIndexOf(' "b/'));
  if (cut === -1) return false;
  return [head.slice('diff --git '.length, cut), head.slice(cut + 1)]
    .some((path) => CONFIG_PATH.test(path.replace(/^"|"$/g, '')));
}

/**
 * `s` fenced for an outside reviewer, every byte the rules don't take as it was. A diff is split at each
 * `diff --git` line and each file's part fenced by its path. Any file but a config file, and text with no path (an
 * instruction, a situation, a plan, what comes before the first header), gets the narrow fence: an upper-case
 * credential-named `NAME=v` literal, URL userinfo other than `git`, an `Authorization: Bearer` value, and a quoted
 * `api_key` pair's value, each on one line. A config file (`.env*`, `*.yml`, `*.toml`, `*.sh`, ...) loses every span
 * either the narrow fence or the wide rules (after its YAML credential blocks go) take, and joins lines where they do.
 * Coerces and never throws, for the same reason `redactUrl` does.
 * @param {unknown} s
 * @returns {string}
 */
export function redactOutbound(s) {
  const text = String(s);
  /** @type {(t: string) => string} */
  const narrow = (t) => narrowTracked({ text: t, from: null, to: null }, []).text;
  if (!/^diff --git /m.test(text)) return narrow(text);
  // a header only ever starts a line, and a diff's content lines all carry a marker, so no file's text can fake one
  return text.split(/^(?=diff --git )/m).map((part) => {
    if (!part.startsWith('diff --git ') || !isConfigPart(part)) return narrow(part);
    // each set reads the original, so one set's mark can't shift the quotes the other pairs; whatever either takes goes
    /** @type {number[]} */
    const spans = [];
    narrowTracked({ text: part, from: null, to: null }, spans);
    const blocks = /:[ \t]+[|>]/.test(part) ? yamlBlockCuts(part) : [];
    wideTracked(applyCuts({ text: part, from: null, to: null }, blocks, spans), spans);
    return markSpans(part, spans);
  }).join('');
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
