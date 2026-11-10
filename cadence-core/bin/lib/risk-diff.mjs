// @ts-check
// whether a set of files touched a risk-surface category, in two faces over one signal table
//
// `scanDiff` reads a committed range, `scanDeclared` a declared file set for the plan-time floor
// one table and one ordering, or the floor raises on evidence the gate wouldn't fire on
// silence is never a cleared range: a binary file, a body with no hunk or a submodule bump is `inconclusive`
// signals are changed paths (never substrings) and anchored patterns over added and removed lines only
// no category-name keyword grep (it false-positived `auth` on every Claude session); pure, the caller reads the range
'use strict';

/** @param {any} v @returns {string[]} */
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
/** @param {string} s */
const low = (s) => s.toLowerCase();

/**
 * Whole path segments that evidence a category, lowercased. Close to
 * surface-scan's directory list on purpose, and just as conservative: a miss
 * only narrows the reason because the content patterns still see the lines,
 * while a false hit costs a blocking panel on a non-risk.
 */
const SEGMENT_SIGNALS = Object.freeze({
  auth: ['auth', 'authn', 'authz', 'oauth', 'identity', 'login', 'session'],
  migrations: ['migrations', 'migrate', 'migration', 'alembic', 'prisma'],
  billing: ['billing', 'payments', 'payment', 'checkout', 'pricing', 'invoices'],
  concurrency: ['workers', 'worker', 'jobs', 'queue', 'queues', 'concurrency'],
  secrets: ['secrets', 'vault', 'crypto', 'keystore'],
  api_contract: ['openapi', 'swagger', 'graphql', 'proto', 'rpc'],
});

/**
 * File base names that evidence a category, lowercased and matched whole. A
 * dotfile is its own base name, so `.env` is listed here and not as an extension.
 */
const FILE_SIGNALS = Object.freeze({
  secrets: ['.env', '.env.local', '.env.production', 'id_rsa', 'id_ed25519'],
  api_contract: ['openapi.yaml', 'openapi.yml', 'openapi.json',
    'swagger.yaml', 'swagger.json', 'schema.graphql'],
});

/** File EXTENSIONS (with the dot, lowercased) that evidence a category. */
const EXT_SIGNALS = Object.freeze({
  migrations: ['.sql'],
  api_contract: ['.proto', '.graphql', '.gql'],
  secrets: ['.pem', '.key', '.p12', '.pfx'],
});

/**
 * Anchored patterns over the added and removed lines, each with the label the
 * `signal` string quotes. Anchored means a construct, never a bare category word.
 *
 * Not global: a `/g` literal keeps `lastIndex` between calls and misses the third line.
 *
 * The one-character classes and split labels keep these patterns from matching
 * this file's own source, which a plain pattern did until v3.5.5 and spent the
 * blocking gate's re-arm on. Keep the device when adding an alternative; the
 * test's census row fails when one is missing. Fix the mention, never exempt
 * this file by name.
 */
const CONTENT_SIGNALS = Object.freeze({
  auth: [
    { re: /\bjsonwebtoken\b|\bjwt\.(sign|verify|decode)\s*\(/i, label: 'a JWT sign/verify call' },
    { re: /\bbcrypt|\bargon2|\bscrypt\s*\(/i, label: 'a password-hashing call' },
    { re: /\bAuthorization\s*:\s*["'`]?\s*Bearer\b/i, label: 'an Authorization' + ': Bearer header' },
    { re: /\b(is_?authenticated|require_?(auth|login)|check_?permission)\b/i, label: 'an authentication guard' },
  ],
  migrations: [
    { re: /\bALTER\s+TABLE\b/i, label: 'an ALTER' + ' TABLE statement' },
    { re: /\bCREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\b/i, label: 'a CREATE' + ' TABLE/INDEX statement' },
    { re: /\b(ADD|DROP|RENAME)\s+COLUMN\b/i, label: 'a column change' },
    { re: /\b(add_?column|create_?table|remove_?column|add_?index)\s*\(/i, label: 'a migration DSL call' },
  ],
  billing: [
    { re: /\b[s]tripe\b/i, label: 'a Str' + 'ipe reference' },
    { re: /\b([b]raintree|[c]hargebee|[r]ecurly|[p]addle|[p]aypal)\b/i, label: 'a payment-provider reference' },
    { re: /\b([p]rice_id|[a]mount_cents|[u]nit_amount|[s]ubscription_id)\b/i, label: 'a pricing field' },
  ],
  concurrency: [
    { re: /\bPromise\.(all|allSettled|race)\s*\(/, label: 'a concurrent Promise combinator' },
    { re: /\bnew\s+(Worker|Thread)\s*\(/, label: 'a worker/thread construction' },
    { re: /\b([M]utex|[R]wLock|[S]emaphore|threading\.Lock)\b/, label: 'a lock primitive' },
    { re: /\bgo\s+func\s*\(|\bgoroutine\b|\btokio::spawn\b/, label: 'a spawned task' },
  ],
  destructive: [
    { re: /\brm\s+-[a-z]*[rf]/i, label: 'an `rm' + ' -rf`' },
    { re: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)\b/i, label: 'a DROP statement' },
    { re: /\b(TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i, label: 'a bulk delete' },
    { re: /\b([r]mSync|[u]nlinkSync|[r]imraf|shutil\.rmtree)\b/, label: 'a recursive delete call' },
    { re: /\bgit\s+(push[^\n]*--force|reset\s+--hard|clean\s+-[a-z]*f)/, label: 'a destructive git command' },
  ],
  secrets: [
    { re: /\b[A-Z][A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY)[A-Z0-9_]*\s*[=:]/,
      label: 'a credential-named assignment' },
    { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'an inline private key' },
    { re: /\b(createCipheriv|createDecipheriv|createHmac|randomBytes)\s*\(/, label: 'a crypto primitive call' },
  ],
  api_contract: [
    { re: /\b(app|router|api)\.(get|post|put|patch|delete)\s*\(\s*["'`]/, label: 'an HTTP route declaration' },
    { re: /@(Get|Post|Put|Patch|Delete|Request)Mapping\b|@(app\.)?(route|get|post)\s*\(/, label: 'a route annotation' },
    { re: /^\s*(openapi|swagger)\s*:\s*["']?\d/i, label: 'an OpenAPI version header' },
  ],
  untrusted_input: [
    { re: /\bJSON\.parse\s*\(/, label: 'a JSON.parse call' },
    { re: /\b(req|request|ctx)\.(body|query|params|headers)\b/, label: 'a request-input read' },
    { re: /\b(yaml|YAML)\.(load|parse)\s*\(|\bparseXml\b|\bxml2js\b/, label: 'a markup parse call' },
    { re: /\b([b]odyParser|[b]ody-parser|[m]ulter|[f]ormidable)\b/, label: 'a request-body parser' },
  ],
});

/** @type {Map<string, (line: string) => boolean>} */
const prefilters = new Map();

/**
 * Whether any content pattern of `categories` can match a line, as one combined regex per flag set (Node 22 has no
 * inline flag groups). A line it refuses moves no answer, so the scans drop those lines before the ordered walk.
 * The patterns carry no flag but `i`, which is what the split relies on.
 * @param {string[]} categories
 */
function contentPrefilter(categories) {
  const key = categories.join('\n');
  let hit = prefilters.get(key);
  if (!hit) {
    /** @type {string[]} */
    const folded = [];
    /** @type {string[]} */
    const exact = [];
    for (const category of categories) {
      for (const { re } of CONTENT_SIGNALS[category] || []) (re.flags === 'i' ? folded : exact).push(re.source);
    }
    const regexes = [];
    if (folded.length) regexes.push(new RegExp(folded.join('|'), 'i'));
    if (exact.length) regexes.push(new RegExp(exact.join('|')));
    hit = (line) => regexes.some((re) => re.test(line));
    prefilters.set(key, hit);
  }
  return hit;
}

/** A path's comparable tokens: every segment, plus the base name minus one final extension. */
function segmentsOf(/** @type {string} */ path) {
  const parts = low(path).split('/').filter(Boolean);
  const out = new Set(parts);
  const base = parts[parts.length - 1];
  if (base) {
    const dot = base.lastIndexOf('.');
    // `dot > 0`: a dotfile's leading dot is part of its name, and stripping it would compare `env` as a stem
    if (dot > 0) out.add(base.slice(0, dot));
  }
  return out;
}

/** A path's base name and its final extension (with the dot), lowercased. */
function baseAndExt(/** @type {string} */ path) {
  const base = low(path).split('/').filter(Boolean).pop() || '';
  const dot = base.lastIndexOf('.');
  return { base, ext: dot > 0 ? base.slice(dot) : '' };
}

/** The three comparable sets a path list yields, built once per scan. */
function pathSets(/** @type {string[]} */ paths) {
  const segments = new Set();
  const bases = new Set();
  const exts = new Set();
  for (const p of paths) {
    for (const s of segmentsOf(p)) segments.add(s);
    const { base, ext } = baseAndExt(p);
    if (base) bases.add(base);
    if (ext) exts.add(ext);
  }
  return { segments, bases, exts };
}

/**
 * The first signal that evidences `category`, or null, in the one ordering both faces share: path evidence before
 * content, and segment before base name before extension. A `signal` is the reason a fire site quotes, so the order
 * decides which true sentence the user sees.
 *
 * `lines` is what this may read: added and removed lines for `scanDiff`, body lines for `scanDeclared`. Never context.
 *
 * `contentPrefix` is the one thing the faces spell differently (`changed line` or `body line`); the label after it is
 * identical so a plan-time reason and a commit-time finding name a construct alike.
 * @param {string} category
 * @param {{segments: Set<string>, bases: Set<string>, exts: Set<string>}} sets
 * @param {string[]} lines
 * @param {string} contentPrefix
 * @returns {string|null}
 */
function signalIn(category, sets, lines, contentPrefix) {
  for (const name of SEGMENT_SIGNALS[category] || []) {
    if (sets.segments.has(name)) return `path segment ${name}`;
  }
  for (const name of FILE_SIGNALS[category] || []) {
    if (sets.bases.has(name)) return `file ${name}`;
  }
  for (const ext of EXT_SIGNALS[category] || []) {
    if (sets.exts.has(ext)) return `${ext} file`;
  }
  for (const { re, label } of CONTENT_SIGNALS[category] || []) {
    if (lines.some((l) => re.test(l))) return `${contentPrefix}: ${label}`;
  }
  return null;
}

/**
 * A GITLINK section: a submodule pointer moving. Git spells it two ways, the
 * `160000` mode on a header line, or `Subproject commit <id>` lines in place of
 * code. The `submodule=log` spelling has no hunk and lands in `unreadable`
 * through the no-hunk arm.
 */
const GITLINK_MODE = /^(?:index [0-9a-f]+\.\.[0-9a-f]+ 160000|(?:new file|deleted file|old|new) mode 160000)$/;
const GITLINK_LINE = /^Subproject commit [0-9a-f]{7,64}(?:-dirty)?$/;

/**
 * The paths that changed, the lines the range added or removed, and whether
 * anything in it couldn't be read. `unreadable` is the honest half: binary
 * stanzas, sections with no hunk and GITLINK sections are change this can't
 * judge, and saying so is the point.
 * @param {string} body
 */
function parseDiff(body) {
  /** @type {Set<string>} */
  const paths = new Set();
  /** @type {string[]} */
  const changed = [];
  let hunks = 0;
  let unreadable = false;
  /** True once the current file section has shown a hunk or a binary stanza. */
  let sectionRead = true;
  let inSection = false;
  /**
   * Inside a hunk, `--- x` and `+++ x` are removed and added lines, not file
   * headers, which always come before the first `@@`. Otherwise a removed
   * markdown rule reads as a path.
   */
  let inHunk = false;

  const addPath = (/** @type {string} */ p) => {
    const t = p.trim();
    if (t && t !== '/dev/null') paths.add(t);
  };

  for (const raw of body.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const header = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
    if (header) {
      // a section that never showed a hunk is a rename, a mode change or a truncated body: real change, unjudged
      if (inSection && !sectionRead) unreadable = true;
      inSection = true;
      sectionRead = false;
      inHunk = false;
      addPath(header[1]);
      addPath(header[2]);
      continue;
    }
    if (line.startsWith('@@')) { hunks++; sectionRead = true; inHunk = true; continue; }
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      unreadable = true;
      sectionRead = true;
      continue;
    }
    // a gitlink section is unreadable though git emits a hunk for it: the hunk is commit ids, so a bumped submodule
    // would otherwise read as judged clean over code this never opened
    if (!inHunk && GITLINK_MODE.test(line)) { unreadable = true; continue; }
    if (!inHunk && line.startsWith('--- ')) { addPath(line.slice(4).replace(/^a\//, '')); continue; }
    if (!inHunk && line.startsWith('+++ ')) { addPath(line.slice(4).replace(/^b\//, '')); continue; }
    // `+++`/`---` were consumed above, so a bare `+` or `-` is a changed line; a leading space is context and dropped
    if (line.startsWith('+') || line.startsWith('-')) {
      const content = line.slice(1);
      // the pointer line is a commit id, not code, so keep it out of `changed`; the path still reaches the path signals
      if (GITLINK_LINE.test(content)) { unreadable = true; continue; }
      changed.push(content);
    }
  }
  if (inSection && !sectionRead) unreadable = true;
  // no hunk anywhere in a body that had bytes: unparseable, rename-only or a short read, reported and never cleared
  if (hunks === 0) unreadable = true;
  return { paths: [...paths], changed, unreadable };
}

/**
 * What a committed range touched.
 *
 * @param {any} body the unified-diff body read out of git. Trusted for nothing:
 *   a null, a scalar or an unparseable body reports rather than throws.
 * @param {any} categories the category vocabulary from the caller, normally
 *   `CATEGORIES` narrowed to the project's resolved set. A category not in the
 *   list is not looked for and is not reported.
 * @returns {{checked: boolean, categories: string[],
 *   matches: Array<{category: string, signal: string}>, inconclusive: boolean,
 *   empty: boolean}}
 *   `checked` is false only when there was no diff body to read, and implies
 *   `inconclusive: true`. `empty` is true only for a body that was read and held
 *   nothing. Each match names the category and the first signal that found it.
 */
export function scanDiff(body, categories) {
  const wanted = strs(categories);

  // "git gave us nothing" and "git read the range and it was empty" once looked the same, and the empty one deadlocked
  // the blocking gate: `risk-check status` filters on `checked` first, so no re-run could clear it
  // a non-string body is what `cmdRiskCheckRun` leaves when `resolveRange` refused or the diff threw: unchecked
  if (typeof body !== 'string') {
    return { checked: false, categories: wanted, matches: [], inconclusive: true, empty: false };
  }
  // decide empty from the body, not from equal ids: a revert pair has different ids and a zero net diff
  if (!body.trim()) {
    return { checked: true, categories: wanted, matches: [], inconclusive: false, empty: true };
  }

  const { paths, changed, unreadable } = parseDiff(body);
  const sets = pathSets(paths);
  const lines = changed.filter(contentPrefilter(wanted));

  /** @type {Array<{category: string, signal: string}>} */
  const matches = [];
  for (const category of wanted) {
    // `changed line`, since this face read a range
    const signal = signalIn(category, sets, lines, 'changed line');
    if (signal) matches.push({ category, signal });
  }

  // independent of `matches`: a range partly binary and partly a matched change must report both
  // `empty: false` on this arm too, so a record without the field marks one written before the split
  return { checked: true, categories: wanted, matches, inconclusive: unreadable, empty: false };
}

/**
 * The two files that are the signal table, exempt from `scanDeclared`'s
 * whole-body content pass because a whole-body scan of a table matches its own
 * patterns, which is self-reference and not evidence about the change.
 *
 * Only this face: `scanDiff` reads a hunk, where a self-match is a real edit to
 * a real pattern and the fix is at the mention, never an exemption. Matched as
 * a path suffix so a nested checkout keeps it, and never as a bare base name,
 * which would exempt any file a project called `risk-diff.mjs`.
 */
const SIGNAL_TABLE_FILES = Object.freeze([
  'cadence-core/bin/lib/risk-diff.mjs',
  'cadence-core/bin/lib/surface-scan.mjs',
]);

/** Whether `path` names one of the signal-table files themselves. */
function isSignalTable(/** @type {string} */ path) {
  const p = low(path).replace(/^\.\//, '');
  return SIGNAL_TABLE_FILES.some((f) => p === f || p.endsWith(`/${f}`));
}

/**
 * Extensions that name a document, whose body `scanDeclared` skips. A document
 * can't execute the call it prints, so a whole-body pass over prose evidences
 * what the prose describes.
 *
 * No extension means not a document: that fails toward raising, and a Makefile
 * or a shebang script would otherwise be exempted by accident. The path signals
 * still run, so `docs/auth/session.md` evidences `auth`; only the body is
 * skipped. Only this face, for the same reason as the table exemption.
 */
const DOCUMENT_EXTS = Object.freeze(['.md', '.markdown', '.mdx', '.txt', '.rst', '.adoc']);

/** Whether `path`'s final extension names a document. */
function isDocument(/** @type {string} */ path) {
  return DOCUMENT_EXTS.includes(baseAndExt(path).ext);
}

/**
 * The line kinds `scanDeclared` withholds from its content pass: an import, which brings a name into scope, and a
 * constant bound to a literal. Both name a construct without doing it, and four raises on this repo's phases rested
 * on exactly those.
 *
 * A line that calls something is still evidence. Every pattern is anchored at line start and must reach the end of
 * the line, so an import followed by a call isn't withheld, and a constant bound to a parse of a file read isn't
 * either. A dynamic `import` call is code. Only this face withholds; the commit-time gate's shared table is untouched.
 */
const IMPORT_LINE_KINDS = Object.freeze([
  // ES modules, Java, Python `import x`; the lookahead leaves a dynamic import call as code
  /^\s*import\s+(?!\()[^;]*;?\s*$/,
  // Python `from x import y`; written so a long run of spaces can't make this or the next two backtrack
  /^\s*from\s+\S+\s+import\s[^;]*(?:;\s*)?$/,
  // C and C++.
  /^\s*#\s*include\s+\S[^;]*$/,
  // Rust, PHP, Perl. `use ` and never `use`, so `useEffect(...)` stays a call.
  /^\s*use\s[^;]*(?:;\s*)?$/,
  // CommonJS: broader than the constant arm because the module load on the right is what makes it an import
  /^\s*(?:const|let|var)\s[^=;]+=\s*require\s*\([^;]*\)\s*(?:;\s*)?$/,
]);

// constants capture the initializer untrimmed and the caller trims it; trimming in the regex backtracked on spaces

/** `const NAME = ...` and its cousins in other languages, up to the initializer. */
const DECLARED_CONSTANT =
  /^\s*(?:(?:export|public|private|protected|readonly)\s+)*(?:const|static|final|val)\s+[A-Za-z_$][^=;]*=([^;]*)(?:;\s*)?$/;

/** A SCREAMING_SNAKE name with no declaration keyword (Python, shell, Make), shaped like the credential pattern's. */
const SHOUTING_CONSTANT = /^\s*[A-Z][A-Z0-9_]*\s*(?::[^=;]*)?=([^;]*)(?:;\s*)?$/;

/** What an initializer may start with to be a literal; not `(`, which opens an arrow function or a group. */
const LITERAL_INITIALIZER =
  /^(?:['"`]|[-+]?\d|\/[^/*]|[[{]|true\b|false\b|null\b|undefined\b|None\b|nil\b)/;

/** An initializer that is only a regex literal, judged alone because its parens are capture groups, not a call. */
const REGEX_LITERAL = /^\/(?:[^/\\\n]|\\.)*\/[a-z]*$/;

/** A call anywhere in an initializer, which keeps a literal-looking one that invokes something counting as evidence. */
const CALL_EXPRESSION = /[\w$\])]\s*\(/;

/** Whether `line` is only a module import. */
function isImportStatement(/** @type {string} */ line) {
  return IMPORT_LINE_KINDS.some((re) => re.test(line));
}

/** Whether `line` is only a constant declaration bound to a literal. */
function isConstantDeclaration(/** @type {string} */ line) {
  const m = DECLARED_CONSTANT.exec(line) || SHOUTING_CONSTANT.exec(line);
  if (!m) return false;
  const init = m[1].trim();
  if (!init || !LITERAL_INITIALIZER.test(init)) return false;
  return REGEX_LITERAL.test(init) || !CALL_EXPRESSION.test(init);
}

/** Whether `line` names a construct without doing it, so it's withheld from the content pass. */
function isIncidentalLine(/** @type {string} */ line) {
  return isImportStatement(line) || isConstantDeclaration(line);
}

/**
 * What a declared file set touches, the plan-time face, where the change isn't written yet and there is no diff.
 *
 * @param {any} files a list of `{path, body}` (body may be absent) or bare string paths; anything else is reported
 * @param {any} categories the category vocabulary from the caller, as `scanDiff` takes it
 * @returns {{categories: string[], matches: Array<{category: string, signal: string}>,
 *   withheld: Array<{path: string, category: string}>}}
 *   `matches` has the same shape `scanDiff` returns. `withheld` is what the line-kind exemption cost per path: a
 *   category the file evidenced before the narrowing and doesn't after. `scanDiff` withholds nothing.
 *
 * A declared path with no readable body is not inconclusive, the one place this face parts from `scanDiff`: the plan
 * often creates the file, and calling an absent body unjudgeable would raise every create-a-file plan.
 */
export function scanDeclared(files, categories) {
  const wanted = strs(categories);
  const couldMatch = contentPrefilter(wanted);
  const list = Array.isArray(files) ? files : [];
  /** @type {string[]} */
  const paths = [];
  /** @type {string[]} */
  const lines = [];
  /** Per declared path that lost a line: what the exemption kept and withheld. */
  /** @type {Array<{path: string, kept: string[], dropped: string[]}>} */
  const split = [];
  for (const entry of list) {
    const path = typeof entry === 'string'
      ? entry
      : (entry && typeof entry === 'object' && typeof entry.path === 'string' ? entry.path : '');
    if (!path) continue;
    paths.push(path);
    const body = entry && typeof entry === 'object' ? entry.body : undefined;
    if (typeof body !== 'string' || !body) continue;
    if (isSignalTable(path)) continue;
    if (isDocument(path)) continue;
    /** @type {string[]} */
    const kept = [];
    /** @type {string[]} */
    const dropped = [];
    for (const raw of body.split('\n')) {
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      // a line no wanted pattern can match is neither kept nor dropped to any effect, so skip the line-kind tests
      if (!couldMatch(line)) continue;
      // the third exemption, per line: a line that names a construct without doing it isn't evidence of touching it
      if (isIncidentalLine(line)) { dropped.push(line); continue; }
      kept.push(line);
      lines.push(line);
    }
    if (dropped.length) split.push({ path, kept, dropped });
  }

  const sets = pathSets(paths);
  /** @type {Array<{category: string, signal: string}>} */
  const matches = [];
  for (const category of wanted) {
    // `body line`, not `changed line`: no diff exists at plan time, and this is a line of the current body
    const signal = signalIn(category, sets, lines, 'body line');
    if (signal) matches.push({ category, signal });
  }

  // ask signalIn twice per file, over every line and over the kept lines; a category only the first answers rested
  // on a withheld line. Path signals run in both, so a file evidenced by its path never appears here
  /** @type {Array<{path: string, category: string}>} */
  const withheld = [];
  for (const { path, kept, dropped } of split) {
    const fileSets = pathSets([path]);
    const whole = kept.concat(dropped);
    for (const category of wanted) {
      if (!signalIn(category, fileSets, whole, 'body line')) continue;
      if (signalIn(category, fileSets, kept, 'body line')) continue;
      withheld.push({ path, category });
    }
  }
  return { categories: wanted, matches, withheld };
}
