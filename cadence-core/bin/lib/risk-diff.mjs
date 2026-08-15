// @ts-check
// risk-diff.mjs - the ONE statement of whether a committed RANGE touched one of
// the risk-surface categories, imported by planning.mjs's `risk-check`
// subcommand (which reads the range out of git and hands the body here).
//
// THE SPLIT, because two files now carry the word "surface" (RSK-01).
// lib/surface-scan.mjs answers which categories a project SCOPES - a one-time
// question about a tree's STRUCTURE, whose answer the user persists in
// `review.triggers.risk_surface.surfaces`. This file answers whether a given
// RANGE touched one of them, every time a plan completes. The first is a
// scoping aid and returns all eight unconditionally; the second is the
// detection the blocking `risk_surface` gate fires on, and it can and does
// return nothing.
//
// WHAT IT EXISTS TO FIX. Detection used to be `workflows/execute.md` telling a
// model to check a diff against a prose list. A fire wrote a lifecycle event
// and a non-match wrote nothing, so the run record could not tell "the step was
// skipped" from "it ran and matched nothing". Heuristic detection stays
// heuristic - that is not what changed. What changed is that the answer is now
// computed by something that always returns one, so "did not run" stops
// masquerading as "ran clean".
//
// SILENCE IS NEVER A CLEARED RANGE, the same rule lib/surface-scan.mjs states
// for structure. A range this cannot judge - a file git rendered as binary, a
// body with no readable hunk, a GITLINK section whose hunk carries a submodule
// commit id where the code would be - is `inconclusive: true`, never collapsed into
// `matches: []`, and `inconclusive` is INDEPENDENT of `matches` so a partly
// unreadable range that also matched reports both. The caller fires on either,
// because widening is the only safe direction on the one gate that is
// `blocking` at every stakes level.
//
// AND WHAT IT MAY NOT READ. Never a category-NAME keyword grep. That pass was
// measured on this repo on 2026-08-13 and false-positived `auth` on sixteen
// `session` matches, every one of them a Claude session, and `billing` on prose
// about token cost (lib/surface-scan.mjs's header holds the same rule and the
// same evidence). Its signals are the changed PATHS - whole segments, base
// names and extensions, never substrings, so `src/auth` is not matched by
// `src/authority.rs` - and ANCHORED patterns over the ADDED and REMOVED lines
// only. Context lines are not an input: they are the code the range did not
// touch, and matching them would fire on every neighbour of every edit.
//
// The category VOCABULARY arrives from the caller, the way lib/gate-agreement's
// gate and level names do, so this file never becomes a second statement of the
// eight tokens; `CATEGORIES` in lib/surface-scan.mjs is the lib-side statement
// and the caller passes it (narrowed to the project's resolved set).
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. The caller
// reads the range; this side owns the map from what was read to what it means.
'use strict';

/** @param {any} v @returns {string[]} */
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
/** @param {string} s */
const low = (s) => s.toLowerCase();

/**
 * Whole path SEGMENTS that evidence a category, lowercased. Conservative on
 * purpose and deliberately close to lib/surface-scan.mjs's `DIR_SIGNALS`: a
 * name here has to mean the category on nearly every project that uses it, so
 * generic containers (`lib`, `src`, `tasks`, `public`) are absent even though
 * some projects do put the surface there. A miss costs nothing but a narrower
 * reason - the content patterns below still see the same lines - while a false
 * hit costs a blocking panel on a non-risk.
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
 * File BASE names that evidence a category, lowercased and matched whole. A
 * dotfile is its own base name, so `.env` is listed here rather than as an
 * extension.
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
 * ANCHORED patterns over the added and removed lines, each with the label the
 * `signal` string quotes. Anchored means the pattern names a CONSTRUCT - a
 * statement, a call, an assignment shape - never a bare category word: a
 * `\bauth\b` here would be exactly the keyword pass this design refuses.
 *
 * Non-global regexes on purpose: a `/g` literal carries `lastIndex` between
 * calls, so the second line tested against one starts mid-string and the third
 * silently misses.
 */
const CONTENT_SIGNALS = Object.freeze({
  auth: [
    { re: /\bjsonwebtoken\b|\bjwt\.(sign|verify|decode)\s*\(/i, label: 'a JWT sign/verify call' },
    { re: /\bbcrypt|\bargon2|\bscrypt\s*\(/i, label: 'a password-hashing call' },
    { re: /\bAuthorization\s*:\s*["'`]?\s*Bearer\b/i, label: 'an Authorization: Bearer header' },
    { re: /\b(is_?authenticated|require_?(auth|login)|check_?permission)\b/i, label: 'an authentication guard' },
  ],
  migrations: [
    { re: /\bALTER\s+TABLE\b/i, label: 'an ALTER TABLE statement' },
    { re: /\bCREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\b/i, label: 'a CREATE TABLE/INDEX statement' },
    { re: /\b(ADD|DROP|RENAME)\s+COLUMN\b/i, label: 'a column change' },
    { re: /\b(add_?column|create_?table|remove_?column|add_?index)\s*\(/i, label: 'a migration DSL call' },
  ],
  billing: [
    { re: /\bstripe\b/i, label: 'a Stripe reference' },
    { re: /\b(braintree|chargebee|recurly|paddle|paypal)\b/i, label: 'a payment-provider reference' },
    { re: /\b(price_id|amount_cents|unit_amount|subscription_id)\b/i, label: 'a pricing field' },
  ],
  concurrency: [
    { re: /\bPromise\.(all|allSettled|race)\s*\(/, label: 'a concurrent Promise combinator' },
    { re: /\bnew\s+(Worker|Thread)\s*\(/, label: 'a worker/thread construction' },
    { re: /\b(Mutex|RwLock|Semaphore|threading\.Lock)\b/, label: 'a lock primitive' },
    { re: /\bgo\s+func\s*\(|\bgoroutine\b|\btokio::spawn\b/, label: 'a spawned task' },
  ],
  destructive: [
    { re: /\brm\s+-[a-z]*[rf]/i, label: 'an `rm -rf`' },
    { re: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)\b/i, label: 'a DROP statement' },
    { re: /\b(TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i, label: 'a bulk delete' },
    { re: /\b(rmSync|unlinkSync|rimraf|shutil\.rmtree)\b/, label: 'a recursive delete call' },
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
    { re: /\b(bodyParser|body-parser|multer|formidable)\b/, label: 'a request-body parser' },
  ],
});

/** A path's comparable tokens: every segment, plus the base name minus one final extension. */
function segmentsOf(/** @type {string} */ path) {
  const parts = low(path).split('/').filter(Boolean);
  const out = new Set(parts);
  const base = parts[parts.length - 1];
  if (base) {
    const dot = base.lastIndexOf('.');
    // `dot > 0`, never `>= 0`: a dotfile's leading dot is part of its NAME
    // (`.env`), and stripping it would compare `env` as though it were a stem.
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

/**
 * A GITLINK section: a submodule pointer moving. Two markers, because git
 * spells the same change either way depending on which lines the range
 * produced - the `160000` mode on the `index`/`new file`/`deleted file` line,
 * and the `Subproject commit <id>` lines the hunk carries INSTEAD of code.
 * (A third spelling, `diff.submodule=log`'s `Submodule <path> aaa..bbb:`
 * stanza, emits no `@@` at all and already lands in `unreadable` through the
 * no-hunk arm below.)
 */
const GITLINK_MODE = /^(?:index [0-9a-f]+\.\.[0-9a-f]+ 160000|(?:new file|deleted file|old|new) mode 160000)$/;
const GITLINK_LINE = /^Subproject commit [0-9a-f]{7,64}(?:-dirty)?$/;

/**
 * The parts of a unified diff this reads: which paths changed, which lines the
 * range ADDED or REMOVED, and whether anything in it could not be read.
 *
 * `unreadable` is the honest half. A `Binary files ... differ` stanza, a file
 * section carrying no hunk at all, and a GITLINK section are all change this
 * cannot judge, and saying so is the whole point of the seam.
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
   * Inside a hunk, `--- x` and `+++ x` are a REMOVED and an ADDED line whose
   * own text begins with two dashes or pluses, not file headers: the headers
   * always precede the first `@@` of their section. Without this a removed
   * markdown rule reads as a path and leaves the range's real content unread.
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
      // A previous section that never showed a hunk or a binary stanza is a
      // rename, a mode change or a truncated body - real change, unjudged.
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
    // A GITLINK section is UNREADABLE even though git emitted a hunk for it.
    // The `@@` sets `sectionRead` and the hunk then carries commit ids where
    // the code would be: every line of what the submodule actually changed
    // lives in another repository this never opened. Left alone, a range whose
    // only change was `vendor/sdk` bumping read `matches: []` with
    // `inconclusive: false` - a judged-clean verdict over code the scanner
    // never saw, which is the one collapse this seam exists to refuse.
    if (!inHunk && GITLINK_MODE.test(line)) { unreadable = true; continue; }
    if (!inHunk && line.startsWith('--- ')) { addPath(line.slice(4).replace(/^a\//, '')); continue; }
    if (!inHunk && line.startsWith('+++ ')) { addPath(line.slice(4).replace(/^b\//, '')); continue; }
    // Content. `+++`/`---` are consumed above, so a bare `+`/`-` here is a
    // changed line; a leading space is CONTEXT and is deliberately dropped.
    if (line.startsWith('+') || line.startsWith('-')) {
      const content = line.slice(1);
      // The gitlink's own pointer line. Marked unread and kept OUT of
      // `changed`: it is a commit id, not code, and feeding a bare hex string
      // to the content patterns can only ever produce a reason that is not
      // true. The PATH still reaches the path signals, so a bumped
      // `vendor/auth-sdk` still names its category - with `inconclusive` beside
      // it, since the match is all this could see.
      if (GITLINK_LINE.test(content)) { unreadable = true; continue; }
      changed.push(content);
    }
  }
  if (inSection && !sectionRead) unreadable = true;
  // No hunk anywhere in a body that had bytes: an unparseable body, a
  // rename-only range, or a read that stopped short. Reported, never cleared.
  if (hunks === 0) unreadable = true;
  return { paths: [...paths], changed, unreadable };
}

/**
 * What a committed RANGE touched.
 *
 * @param {any} body the unified-diff body the caller read out of git. Trusted
 *   for nothing: a null, a scalar or an unparseable body reports rather than
 *   throws.
 * @param {any} categories the category vocabulary, from the CALLER - normally
 *   `CATEGORIES` from lib/surface-scan.mjs, narrowed to the project's resolved
 *   `review.triggers.risk_surface.surfaces` set. A category not in this list is
 *   not looked for and is not reported.
 * @returns {{checked: boolean, categories: string[],
 *   matches: Array<{category: string, signal: string}>, inconclusive: boolean}}
 *   `checked` is FALSE only when there was no diff body to read at all, and
 *   `checked: false` implies `inconclusive: true`. Each `matches` entry names
 *   the category and the ONE signal that found it first, the shape
 *   `scanTree`'s `evidenced` uses, so a fire site can state a reason instead of
 *   a bare verdict.
 */
export function scanDiff(body, categories) {
  const wanted = strs(categories);
  const text = typeof body === 'string' ? body : '';
  if (!text.trim()) {
    return { checked: false, categories: wanted, matches: [], inconclusive: true };
  }

  const { paths, changed, unreadable } = parseDiff(text);
  const segments = new Set();
  const bases = new Set();
  const exts = new Set();
  for (const p of paths) {
    for (const s of segmentsOf(p)) segments.add(s);
    const { base, ext } = baseAndExt(p);
    if (base) bases.add(base);
    if (ext) exts.add(ext);
  }

  /** The first signal that evidences `category`, or null. */
  const signalFor = (/** @type {string} */ category) => {
    for (const name of SEGMENT_SIGNALS[category] || []) {
      if (segments.has(name)) return `path segment ${name}`;
    }
    for (const name of FILE_SIGNALS[category] || []) {
      if (bases.has(name)) return `file ${name}`;
    }
    for (const ext of EXT_SIGNALS[category] || []) {
      if (exts.has(ext)) return `${ext} file`;
    }
    for (const { re, label } of CONTENT_SIGNALS[category] || []) {
      if (changed.some((l) => re.test(l))) return `changed line: ${label}`;
    }
    return null;
  };

  /** @type {Array<{category: string, signal: string}>} */
  const matches = [];
  for (const category of wanted) {
    const signal = signalFor(category);
    if (signal) matches.push({ category, signal });
  }

  // INDEPENDENT of `matches`, deliberately: a range that is partly binary and
  // partly a matched secrets change reports both, because collapsing either
  // into the other loses the half the caller has to act on.
  return { checked: true, categories: wanted, matches, inconclusive: unreadable };
}
