// @ts-check
// risk-diff.mjs - the ONE statement of whether a set of files touched one of the
// risk-surface categories, in two faces over ONE signal table: `scanDiff` reads
// a committed RANGE, for planning.mjs's `risk-check` subcommand (which reads the
// range out of git and hands the body here), and `scanDeclared` reads a DECLARED
// FILE SET, for route.mjs's plan-time risk floor (CER-01), where no diff exists
// yet. Two faces and not two files because the signals and their ORDER are the
// thing that must not drift: a floor that raised on evidence the commit-time
// gate would not fire on is two detectors wearing one name.
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
 *
 * AND WHY SO MANY ALTERNATIVES OPEN WITH A ONE-CHARACTER CLASS, and why some
 * labels are two string literals joined: this file is scanned BY these patterns
 * whenever a range that edits it reaches the `risk_surface` gate, and a pattern
 * written plainly matches its own source. Ten lines here did until v3.5.5 - a
 * whole-file add of this file evidenced six of the eight categories, every one
 * of them from the table below rather than from anything the file does - and
 * that gate is `blocking` at every stakes level, so a phase editing the
 * detector spent its one re-arm on a self-match. `[x]yz` matches the same
 * language as `xyz` while the source text no longer carries the literal, and
 * `'ab' + 'cd'` is the same label bytes: REACH is unchanged and no emitted
 * `signal` string moves, which is the whole constraint. Keep the device when
 * you add an alternative or a label that would otherwise sit here plainly;
 * bin/risk-diff.test.mjs's census row fails when one does. The fix is at the
 * MENTION, never a path or filename exemption for this file - that is the rule
 * lib/merge-warnings.mjs states for a lexical rule that reported itself, and a
 * name-keyed detector is the one README.md deleted in v2.7.0.
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
 * The first signal that evidences `category`, or null - THE one ordering, for
 * both faces. Path evidence before content evidence, and within the paths
 * segment before base name before extension: a `signal` string is what a fire
 * site quotes as its reason, so the order decides which of several true
 * sentences the user is shown, and two copies of it would answer the same
 * question in two wordings.
 *
 * `lines` is the text this may read: the ADDED and REMOVED lines for
 * `scanDiff`, the declared files' body lines for `scanDeclared`. Neither face
 * passes context lines - `scanDiff` because they are the code the range did not
 * touch, `scanDeclared` because it has no diff to draw a distinction in.
 *
 * `contentPrefix` is the ONE thing the two faces spell differently, and it is
 * passed in rather than forked into a second table because the ORDER above is
 * what must not drift - a second copy of this walk is how the two faces would
 * come to answer the same question in two wordings. `scanDiff` read a range and
 * says `changed line`; `scanDeclared` read a whole current body at a moment when
 * no diff exists and nothing changed, so it says `body line`. The LABEL bytes
 * after the prefix are identical on both faces on purpose: a reader comparing a
 * plan-time reason with a commit-time `risk_surface` finding has to see the same
 * construct named the same way, or the floor looks like a different detector.
 * The PATH signal strings are face-neutral already and carry no prefix at all.
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
 *   matches: Array<{category: string, signal: string}>, inconclusive: boolean,
 *   empty: boolean}}
 *   `checked` is FALSE only when there was no diff body to read at all, and
 *   `checked: false` implies `inconclusive: true`. `empty` is TRUE only on the
 *   opposite arm: a body that WAS read and held nothing. Each `matches` entry
 *   names the category and the ONE signal that found it first, the shape
 *   `scanTree`'s `evidenced` uses, so a fire site can state a reason instead of
 *   a bare verdict.
 */
export function scanDiff(body, categories) {
  const wanted = strs(categories);

  // TWO STATES THIS USED TO COLLAPSE INTO ONE ANSWER (#140, D-01). A non-string
  // body was coerced to `''` and then took the same arm as a zero-byte diff, so
  // "git handed back nothing to read" and "git read the range and it was empty"
  // were byte-identical records: `checked: false, inconclusive: true`. The
  // second is a COMPLETED check that matched nothing, and reporting it as
  // unchecked deadlocked the blocking `risk_surface` gate - `risk-check status`
  // filters on `checked` before its fire predicate is ever consulted, so an
  // empty committed range refused `risk-record-missing` and no re-run could
  // clear it, because re-running wrote the same record again.
  //
  // A non-string body is what `cmdRiskCheckRun` leaves when `resolveRange`
  // refused or the `git diff` threw. It keeps today's answer.
  if (typeof body !== 'string') {
    return { checked: false, categories: wanted, matches: [], inconclusive: true, empty: false };
  }
  // EMPTY IS DECIDED FROM THE BODY, never from the resolved ids being equal
  // (D-01): a revert pair has `base_id !== head_id` and a zero net diff, and an
  // id compare would leave that shape deadlocked exactly as before. `checked`
  // is the load-bearing half of the answer and `inconclusive: false` is not.
  if (!body.trim()) {
    return { checked: true, categories: wanted, matches: [], inconclusive: false, empty: true };
  }

  const { paths, changed, unreadable } = parseDiff(body);
  const sets = pathSets(paths);

  /** @type {Array<{category: string, signal: string}>} */
  const matches = [];
  for (const category of wanted) {
    // `changed line`: this face read a RANGE, and the lines it matched are lines
    // the range added or removed.
    const signal = signalIn(category, sets, changed, 'changed line');
    if (signal) matches.push({ category, signal });
  }

  // INDEPENDENT of `matches`, deliberately: a range that is partly binary and
  // partly a matched secrets change reports both, because collapsing either
  // into the other loses the half the caller has to act on.
  // `empty: false` on the scanned arm too, so the field is on EVERY return and
  // its ABSENCE marks a record written before this seam split the two states,
  // rather than a fresh honest `false` (D-03).
  return { checked: true, categories: wanted, matches, inconclusive: unreadable, empty: false };
}

/**
 * The two files that ARE the signal table, exempt from `scanDeclared`'s
 * whole-body content pass (D-01). A whole-body scan of a signal table matches
 * its own patterns by construction - that is self-reference, not evidence about
 * the change - and this file's own header records the measured cost of the
 * confusion: a whole-file add of it evidenced six of the eight categories, every
 * one of them from the table rather than from anything the file does.
 *
 * SCOPED TO THIS FACE, and deliberately not to `scanDiff`. That face reads a
 * HUNK - the lines a range actually added or removed - so a self-match there is
 * a real edit to a real pattern, and its header's rule holds unedited: the fix
 * is at the MENTION, never a path or filename exemption. Here the input is the
 * file's ENTIRE current body, most of which the plan does not touch, so the
 * mention rule has nothing to bite on.
 *
 * Matched as a path SUFFIX so a checkout nested under another tree keeps the
 * exemption, and never as a bare base name, which would exempt any file a
 * project happened to call `risk-diff.mjs`.
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
 * Final extensions that name a DOCUMENT, whose body `scanDeclared` skips the
 * same way it skips a signal table's. A document cannot execute the call it
 * prints and a fenced example is a quotation, not a call site, so a whole-body
 * content pass over prose evidences what the prose DESCRIBES rather than what
 * the declared change does. Measured on this repository's 30 phase directories:
 * `METHOD.md` alone raised five phases on a recursive-delete line it documents
 * and references/review-triggers.md raised five more, and dropping the thirteen
 * documentation evidences took the raising phases from 29 of 30 to 27 - every
 * phase that lost one had no other evidence at all.
 *
 * A file with NO extension is deliberately not a document: that fails toward
 * raising, which is the safe direction, and a `Makefile` or a shebang script is
 * exactly the shape that would otherwise be exempted by accident.
 *
 * The PATH signals still run over a document's path, so `docs/auth/session.md`
 * evidences `auth` by segment and a declaration is never ignored - the body is
 * what is skipped, not the file.
 *
 * SCOPED TO THIS FACE, on the same reasoning the signal-table exemption above
 * states and for the same reason `scanDiff` is left out of it: that face reads a
 * HUNK, so a line ADDED to a document is a change someone actually made in this
 * range and its header's rule - fix at the MENTION, never a path or filename
 * exemption - stays in force unedited.
 */
const DOCUMENT_EXTS = Object.freeze(['.md', '.markdown', '.mdx', '.txt', '.rst', '.adoc']);

/** Whether `path`'s final extension names a document. */
function isDocument(/** @type {string} */ path) {
  return DOCUMENT_EXTS.includes(baseAndExt(path).ext);
}

/**
 * THE LINE KINDS `scanDeclared` WITHHOLDS from its content pass (RSK-05, D-03),
 * the third exemption on this face and the first that is about a LINE rather
 * than a file. A declared file's body is mostly lines the plan will never
 * touch, and two kinds of them name a construct without doing it: an IMPORT
 * statement, which brings a name into scope, and a CONSTANT DECLARATION whose
 * initializer is a literal, which binds a value. Measured on this repository
 * 2026-08-26: four of the raises on the archived phase set rest on exactly
 * those - an `fs` teardown import in a test file, and three SCREAMING_SNAKE
 * constants whose NAME carries a credential word - so the floor was raising on
 * the vocabulary a file happens to mention rather than on anything it does.
 *
 * A LINE THAT CALLS SOMETHING IS STILL EVIDENCE, and that is the whole boundary.
 * Every pattern below is anchored at line START, on the rule this file's header
 * states, and every one of them must reach the END of the line: a line that
 * both declares and calls - an import followed by a call to what it imported -
 * is NOT withheld, because withholding it would drop a genuine call site and buy
 * the discount by weakening the floor. The literal restriction on the constant
 * arm is the same argument: a `const` bound to a JSON parse of a file read is
 * syntactically a constant declaration and is a real untrusted-input call site,
 * so exempting every `const` would make the floor fire or not on assignment
 * style. A dynamic `import` CALL is code, not an import statement, and is
 * excluded here for the same reason.
 *
 * SCOPED TO THIS FACE, like the two exemptions above and for their reason:
 * `scanDiff` reads a HUNK, where an import someone actually added is a change
 * in the range, and its header's fix-at-the-MENTION rule stays in force
 * unedited. Nothing here reaches `CONTENT_SIGNALS`, which the `blocking`
 * commit-time gate shares by construction (D-02).
 */
const IMPORT_LINE_KINDS = Object.freeze([
  // ES modules, Java, Python `import x`. The negative lookahead is the dynamic
  // `import` call, which is an expression and stays code.
  /^\s*import\s+(?!\()[^;]*;?\s*$/,
  // Python `from x import y`.
  /^\s*from\s+\S+\s+import\s+[^;]*;?\s*$/,
  // C and C++.
  /^\s*#\s*include\s+\S[^;]*$/,
  // Rust, PHP, Perl. `use ` and never `use`, so `useEffect(...)` stays a call.
  /^\s*use\s+[^;]*;?\s*$/,
  // CommonJS. The binding keyword is broader than the constant arm's on
  // purpose: what makes this an import is the module load on the right.
  /^\s*(?:const|let|var)\s+[^=;]+=\s*require\s*\([^;]*\)\s*;?\s*$/,
]);

/** `const NAME = ...` and its cousins in other languages, up to the initializer. */
const DECLARED_CONSTANT =
  /^\s*(?:(?:export|public|private|protected|readonly)\s+)*(?:const|static|final|val)\s+[A-Za-z_$][^=;]*=\s*([^;]*?)\s*;?\s*$/;

/** A SCREAMING_SNAKE name bound with no declaration keyword at all - Python,
 * shell, Make. The name shape is the one `CONTENT_SIGNALS.secrets` itself
 * reads, so the two agree on what a constant NAME looks like. */
const SHOUTING_CONSTANT = /^\s*[A-Z][A-Z0-9_]*\s*(?::[^=;]*)?=\s*([^;]*?)\s*;?\s*$/;

/** What an initializer may START with to be a literal: a string, a number, a
 * regex, a bracketed literal, or one of the value keywords. Deliberately not a
 * `(`, which opens an arrow function or a parenthesized expression. */
const LITERAL_INITIALIZER =
  /^(?:['"`]|[-+]?\d|\/[^/*]|[[{]|true\b|false\b|null\b|undefined\b|None\b|nil\b)/;

/** An initializer that is nothing but a regex literal. Judged on its own,
 * because a regex may carry a `(` of its own - `/\bPhase (\d+)\b/` is one of the
 * four measured false positives - and that parenthesis is a capture group, not
 * a call. */
const REGEX_LITERAL = /^\/(?:[^/\\\n]|\\.)*\/[a-z]*$/;

/** A call anywhere in an initializer: a `(` opened by a name, a closing bracket
 * or a closing paren. This is what keeps a literal-looking initializer that
 * actually invokes something - a list holding a call, a regex with `.test`
 * applied - counting as evidence. */
const CALL_EXPRESSION = /[\w$\])]\s*\(/;

/** Whether `line` is only a module import. */
function isImportStatement(/** @type {string} */ line) {
  return IMPORT_LINE_KINDS.some((re) => re.test(line));
}

/** Whether `line` is only a constant declaration bound to a literal. */
function isConstantDeclaration(/** @type {string} */ line) {
  const m = DECLARED_CONSTANT.exec(line) || SHOUTING_CONSTANT.exec(line);
  if (!m) return false;
  const init = m[1];
  if (!init || !LITERAL_INITIALIZER.test(init)) return false;
  return REGEX_LITERAL.test(init) || !CALL_EXPRESSION.test(init);
}

/** Whether `line` names a construct without doing it, and so is withheld from
 * `scanDeclared`'s content pass. */
function isIncidentalLine(/** @type {string} */ line) {
  return isImportStatement(line) || isConstantDeclaration(line);
}

/**
 * What a DECLARED FILE SET touches - the plan-time face, where there is no diff
 * to read because the change has not been written yet.
 *
 * @param {any} files what the caller could read: a list of `{path, body}`, where
 *   `body` is the file's current bytes or nothing at all. A bare string entry is
 *   a path with no body. Trusted for nothing - a null, a scalar or a
 *   non-list reports rather than throws.
 * @param {any} categories the category vocabulary, from the CALLER, exactly as
 *   `scanDiff` takes it: normally `CATEGORIES` from lib/surface-scan.mjs
 *   narrowed to the project's answered
 *   `review.triggers.risk_surface.surfaces` set. A category not in this list is
 *   not looked for and is not reported.
 * @returns {{categories: string[], matches: Array<{category: string, signal: string}>,
 *   withheld: Array<{path: string, category: string}>}}
 *   `matches` is the same `{category, signal}` entries `scanDiff` returns, so a
 *   fire site states a reason from one shape whichever face produced it.
 *   `withheld` is what the LINE-KIND exemption cost, per declared path: a
 *   category that file evidenced BEFORE the narrowing and does not evidence
 *   after it, because its only matching line was an import or a literal
 *   constant. A raise that used to rest on one of those says so instead of
 *   moving silently, and a file whose category survives on a line the exemption
 *   kept is not listed. `scanDiff` has no such field: that face withholds
 *   nothing.
 *
 * A DECLARED PATH WITH NO READABLE BODY IS NOT INCONCLUSIVE, which is the one
 * place this face deliberately parts from `scanDiff`'s silence-is-never-cleared
 * rule. At plan time a declared file frequently does not exist yet - the plan is
 * what creates it - so calling an absent body unjudgeable would raise every
 * create-a-file plan. That is the raise-tax the retired name-keyed floor died
 * of, where `tests/ingest_concurrency.rs` took six roles to their top rung. The
 * path signals still run over such a file, so the declaration is not ignored;
 * only the body it does not have yet is.
 */
export function scanDeclared(files, categories) {
  const wanted = strs(categories);
  const list = Array.isArray(files) ? files : [];
  /** @type {string[]} */
  const paths = [];
  /** @type {string[]} */
  const lines = [];
  /** Per declared path that lost at least one line, what the exemption kept and
   * what it withheld - the only input the cost list below needs. */
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
      // The third exemption, and the only one that is per LINE (RSK-05, D-03):
      // a line that names a construct without doing it is not evidence that the
      // declared change touches the surface.
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
    // `body line`, never `changed line`: this face runs at plan time, where no
    // diff exists and nothing has changed - what it matched is a line of a
    // declared file's CURRENT body, most of which the plan will not touch.
    const signal = signalIn(category, sets, lines, 'body line');
    if (signal) matches.push({ category, signal });
  }

  // WHAT THE NARROWING COST, per declared path. Computed through the SAME
  // `signalIn` the matches above go through - a second signal table here would
  // be the drift this file exists to prevent - and asked twice of one file: once
  // over every line of its body, once over the lines the exemption kept. A
  // category answering the first and not the second evidenced that file only on
  // a withheld line. The PATH signals run identically in both calls, so a file
  // that evidences a category by its path or its extension never appears here:
  // the exemption did not cost that evidence, and saying it did would be false.
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
