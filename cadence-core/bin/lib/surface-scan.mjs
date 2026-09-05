// @ts-check
// surface-scan.mjs - the ONE statement of which of the eight risk-surface
// categories a project's STRUCTURE evidences, imported by planning.mjs's
// `detect-surfaces` subcommand (which does the I/O and hands the result here).
//
// It exists to answer one question once per project: which surfaces does the
// blocking `risk_surface` review need to watch? The answer is the user's, and
// this is the evidence put in front of them - so what it may NOT do matters
// more than what it does.
//
// THE RULE IT IS BUILT AROUND (D-14). Two answers exist, and "absent" is not
// one of them: a category is either EVIDENCED by the structure or the
// structure SAYS NOTHING about it. Silence is never absence. A scan that
// reported absence from absent evidence would narrow the one blocking trigger
// on a project whose risky code it simply could not see - which is precisely
// this repository, whose secrets handling (review-provider.mjs `resolveKey`),
// untrusted-input parsing (lib/config-merge.mjs) and destructive operations
// (lib/milestone-prune.mjs) are real and structurally invisible: no dependency
// manifest, no category directory. So no signal at all is `inconclusive`, and
// an inconclusive scan recommends all eight.
//
// AND WHAT IT MAY NOT READ. Never a keyword grep of source text. That pass was
// measured on this repo on 2026-08-13 and false-positived `auth` (16 matches on
// `session`, every one of them a Claude session) and `billing` (prose about
// token cost). The signals here are exactly D-14's: dependency manifests and
// the dependency names they declare, directory existence, and file types.
// Source text is not an input to this function, which is the only form that
// rule can take that a later edit cannot quietly undo.
//
// THE SPLIT FROM lib/risk-diff.mjs. This file answers which categories a
// project SCOPES, once, from its structure - and returns all eight
// unconditionally, because narrowing is the USER's. lib/risk-diff.mjs answers
// whether a given RANGE touched one, every time a plan completes, and is what
// the blocking `risk_surface` gate fires on. Neither is the other's detector.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. The caller
// reads the tree; this side owns the map from what was read to what it means.
'use strict';

/**
 * The eight categories, in the order every other statement of them uses
 * (config.schema.json's `values` on the two `risk_surface` list keys,
 * references/review-triggers.md's detection list). This list is the ONE
 * in-code statement of the vocabulary now that no data table holds a second.
 * Order is load-bearing only for reading: nothing here compares by index.
 */
export const CATEGORIES = Object.freeze(['auth', 'migrations', 'billing',
  'concurrency', 'destructive', 'secrets', 'api_contract', 'untrusted_input']);

/**
 * Whether a config layer ANSWERED the one-time surface question, and the set
 * that stands either way. The ONE statement of that predicate: `route.mjs`
 * reports it as `surfaces_answered` and `planning.mjs risk-check run` REFUSES
 * on it, and two copies of this rule would let the seam that enforces the
 * question disagree with the resolve that reports it.
 *
 * Fails SAFE in every direction that is not an exact, non-empty, fully
 * recognised list: a scalar, an empty list, and a list carrying any
 * unrecognised entry each leave every category standing AND the question
 * reading as unanswered. `["auth", "secret"]` is a typo for `secrets`, not a
 * decision to stop reviewing secret handling, and resolving it to its valid
 * subset would suppress the question forever while silently shrinking the only
 * blocking gate. Widening is the safe direction.
 *
 * The caller owns the diagnostics: this returns the DECISION and the two
 * partitions behind it, so `route.mjs` can word its `warnings[]` and
 * `risk-check run` its refusal detail without either re-deriving the rule.
 * `surfaces` is `kept` verbatim, duplicates and all: this function decides
 * whether the question was answered, and normalising the answer's SHAPE is a
 * separate change nobody asked for - `risk-check run` de-duplicates at its own
 * call site, where the value becomes a scan scope.
 *
 * @param {unknown} wrote the value `review.triggers.risk_surface.surfaces`
 *   merged to, or `undefined` when no layer wrote the key at all
 * @param {readonly string[]} [vocabulary] the recognised categories, defaulting
 *   to CATEGORIES - a caller holding a narrower vocabulary passes its own so a
 *   list that names fewer is honoured
 * @returns {{answered: boolean, surfaces: string[], kept: string[], bad: unknown[], written: boolean, list: boolean}}
 */
export function answeredSurfaces(wrote, vocabulary = CATEGORIES) {
  const vocab = Array.isArray(vocabulary)
    ? vocabulary.filter((c) => typeof c === 'string' && c) : [];
  const all = [...vocab];
  if (wrote === undefined) {
    return { answered: false, surfaces: all, kept: [], bad: [], written: false, list: false };
  }
  const isList = Array.isArray(wrote);
  const list = isList ? wrote : [];
  const kept = list.filter((x) => typeof x === 'string' && vocab.includes(x));
  const bad = list.filter((x) => !(typeof x === 'string' && vocab.includes(x)));
  const answered = kept.length > 0 && bad.length === 0;
  return {
    answered,
    surfaces: answered ? kept : all,
    kept,
    bad,
    written: true,
    list: isList,
  };
}

/**
 * Directory BASE names that evidence a category. Conservative on purpose: a
 * name here has to mean the category on nearly every project that uses it, so
 * generic containers (`tasks`, `contracts`, `public`, `lib`) are absent even
 * though some projects do put the surface there. A miss costs a recommendation
 * of all eight, which is the expensive-and-correct direction; a false hit costs
 * a user narrowing to a category they do not have.
 */
const DIR_SIGNALS = Object.freeze({
  auth: ['auth', 'authn', 'authz', 'oauth', 'identity'],
  migrations: ['migrations', 'migrate', 'db', 'database', 'prisma', 'alembic'],
  billing: ['billing', 'payments', 'payment', 'checkout'],
  concurrency: ['workers', 'jobs', 'queue', 'queues'],
  secrets: ['secrets', 'vault', 'crypto'],
  api_contract: ['api', 'openapi', 'swagger', 'graphql', 'proto', 'rpc'],
});

/** File BASE names that evidence a category, lowercased. */
const FILE_SIGNALS = Object.freeze({
  secrets: ['.env', '.env.local', '.env.production'],
  api_contract: ['openapi.yaml', 'openapi.yml', 'openapi.json',
    'swagger.yaml', 'swagger.json', 'schema.graphql'],
});

/** File EXTENSIONS (with the dot, lowercased) that evidence a category. */
const EXT_SIGNALS = Object.freeze({
  migrations: ['.sql'],
  api_contract: ['.proto', '.graphql', '.gql'],
});

/**
 * Declared dependency NAMES that evidence a category. Matched exactly, against
 * the name and against a scoped package's last segment (`@grpc/grpc-js` ->
 * `grpc-js`), never as a substring: a substring match on `auth` would take
 * `oauthlib`, `authoring` and `author` alike, which is the keyword pass this
 * design exists to keep out.
 */
const DEP_SIGNALS = Object.freeze({
  auth: ['passport', 'next-auth', 'jsonwebtoken', 'bcrypt', 'bcryptjs', 'argon2',
    'authlib', 'django-allauth', 'devise', 'omniauth', 'keycloak', 'jose'],
  migrations: ['prisma', 'knex', 'typeorm', 'sequelize', 'drizzle-orm', 'alembic',
    'flyway', 'liquibase', 'diesel', 'sqlx', 'mongoose', 'activerecord'],
  billing: ['stripe', 'braintree', 'paypal', 'chargebee', 'paddle', 'recurly'],
  concurrency: ['bullmq', 'bull', 'celery', 'sidekiq', 'resque', 'kafkajs',
    'amqplib', 'tokio', 'rayon', 'crossbeam'],
  secrets: ['dotenv', 'python-dotenv', 'node-vault', 'hvac', 'sops', 'keyring'],
  api_contract: ['graphql', 'apollo-server', 'openapi', 'grpc-js', 'protobufjs',
    'tsoa', 'trpc', 'swagger-ui-express'],
  untrusted_input: ['express', 'fastify', 'koa', 'hapi', 'flask', 'django',
    'fastapi', 'rails', 'actix-web', 'axum', 'body-parser', 'multer',
    'xml2js', 'js-yaml', 'marked'],
});

/**
 * The categories no structural signal can ever reach, DERIVED from the four
 * tables rather than written down a second time - a hand-kept list would go
 * stale the first time a signal is added. Today it is `destructive` alone: a
 * bulk delete or a `DROP` lives inside a statement, and no directory, manifest
 * or file type says a project performs one. These are recommended alongside
 * whatever was evidenced, because leaving them out would be exactly the
 * absence-from-silence conclusion the rule forbids.
 */
const UNSPEAKABLE = Object.freeze(CATEGORIES.filter((c) =>
  !DIR_SIGNALS[c] && !FILE_SIGNALS[c] && !EXT_SIGNALS[c] && !DEP_SIGNALS[c]));

/** @param {any} v @returns {string[]} */
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
/** @param {string} s */
const low = (s) => s.toLowerCase();

/**
 * What a tree's STRUCTURE evidences.
 *
 * @param {{dirs?: string[], files?: string[], extensions?: string[], dependencies?: string[]}} [tree]
 *   `dirs` and `files` are BASE names (a `db/migrate` walk contributes both
 *   `db` and `migrate`); `extensions` carry their dot; `dependencies` are the
 *   names declared by whatever manifests the caller found and parsed. Source
 *   TEXT is deliberately not among them.
 * @returns {{evidenced: Array<{category: string, signal: string}>, silent: string[],
 *   unspeakable: string[], inconclusive: boolean, recommended: string[]}}
 *   `evidenced` names each hit and the ONE signal that found it first, so the
 *   ask can state a reason rather than a verdict. `silent` is "the structure
 *   says nothing", never "absent". `inconclusive` is `evidenced.length === 0`,
 *   and an inconclusive scan recommends all eight.
 */
export function scanTree(tree = {}) {
  // Trusted for nothing, the rule every pure lib here follows: this runs on a
  // description a caller assembled from a tree, and a null or a scalar must
  // report rather than throw.
  const t = tree && typeof tree === 'object' ? tree : {};
  const dirs = new Set(strs(t.dirs).map(low));
  const files = new Set(strs(t.files).map(low));
  const exts = new Set(strs(t.extensions).map(low));
  const deps = new Set();
  for (const d of strs(t.dependencies)) {
    deps.add(low(d));
    const seg = low(d).split('/').pop();
    if (seg) deps.add(seg);
  }

  /** The first signal that evidences `category`, or null. */
  const signalFor = (/** @type {string} */ category) => {
    for (const name of DIR_SIGNALS[category] || []) {
      if (dirs.has(name)) return `directory ${name}/`;
    }
    for (const name of FILE_SIGNALS[category] || []) {
      if (files.has(name)) return `file ${name}`;
    }
    for (const ext of EXT_SIGNALS[category] || []) {
      if (exts.has(ext)) return `${ext} files`;
    }
    for (const dep of DEP_SIGNALS[category] || []) {
      if (deps.has(dep)) return `dependency ${dep}`;
    }
    return null;
  };

  /** @type {Array<{category: string, signal: string}>} */
  const evidenced = [];
  /** @type {string[]} */
  const silent = [];
  for (const category of CATEGORIES) {
    const signal = signalFor(category);
    if (signal) evidenced.push({ category, signal });
    else silent.push(category);
  }

  const inconclusive = evidenced.length === 0;

  // PRESENCE is provable from structure; ABSENCE is not, and the two are not
  // symmetric. Narrowing to the evidenced set treats "no signal matched" as
  // "not present", which is the absence-from-silence conclusion this whole
  // file exists to refuse - the UNSPEAKABLE carve-out below conceded the
  // principle and then applied it only to categories with no detectors at all.
  // A detector set cannot be complete: framework built-in auth (Django's
  // contrib.auth, Rails' has_secure_password) ships no separate dependency, so
  // `auth` reads silent in a project that plainly has it, and dropping it here
  // would persist a scope that skips the only blocking review it has.
  //
  // So every category is recommended. `evidenced` is not thereby useless - it
  // is the REASON the one-time question states, and `inconclusive` still says
  // whether any evidence was found at all. The narrowing is the USER's, which
  // is the entire point of asking once: their answer beats this guess.
  const recommended = [...CATEGORIES];

  return { evidenced, silent, unspeakable: [...UNSPEAKABLE], inconclusive, recommended };
}

/**
 * The most options one ask-user question may carry, per
 * `cadence-core/references/seams.md` (Seam: ask-user, "at most four options per
 * question"). It lives here as a number because this file BUILDS the option
 * list and a builder that can overrun the seam's cap is the same class of
 * defect as the duplicate option below - `prose-agreement.test.mjs` reads the
 * cap out of seams.md and holds this constant to it, so raising the seam moves
 * the requirement rather than leaving two numbers to drift.
 */
export const OPTION_CAP = 4;

/**
 * The ORDERED choices the one-time surface question offers, built here rather
 * than composed by a model at the ask site.
 *
 * WHY THIS IS A FUNCTION AT ALL (#206). The option list used to be three prose
 * bullets a model followed per run: recommend `recommended`, then "fill the
 * remaining slots with ... the evidenced categories alone, and all eight". The
 * last slot restated the first, so the question arrived offering the same eight
 * categories twice, and nothing could catch it because there was no list for a
 * test to read. A composed list is unprovable; this one is a value.
 *
 * THE ORDER, and every rule in it:
 *   1. `recommended` - all eight, whatever the scan found and whatever was
 *      already answered. The recommendation NEVER narrows on what a scan failed
 *      to evidence (D-14): silence is not absence, framework built-in auth
 *      ships no dependency, and a narrowed recommendation persists a scope that
 *      skips the only blocking review the project has. `inconclusive` changes
 *      the REASON stated beside this choice and nothing else about it.
 *   2. the answered set PLUS every category now evidenced that it does not
 *      already cover - the re-run this arm exists for, where a project added
 *      Stripe six months after answering.
 *   3. the answered set unchanged - keeping the current answer is an answer.
 *   4. the evidenced categories alone - the narrowest set the evidence
 *      supports, which is the user's to pick and never the recommendation.
 * Then any choice whose set is empty is dropped, and any whose set repeats an
 * earlier choice's: with nothing answered, 2 collapses onto 4 and 3 is empty,
 * so an unanswered project sees exactly two choices (or one, when the scan
 * evidenced nothing). Every set is built in `CATEGORIES` order, so two
 * spellings of one set compare equal rather than reading as two choices.
 *
 * Pure, like everything else in this file: it takes a `scanTree` result and the
 * set a config layer already answered, and returns a value. It reads no config
 * and no tree of its own.
 *
 * @param {ReturnType<typeof scanTree> | any} scan a `scanTree` result
 * @param {readonly string[]} [answered] the categories a config layer already
 *   answered - empty or absent means nobody has answered
 * @returns {Array<{surfaces: string[], reason: string}>} at most `OPTION_CAP`
 *   choices, the recommended one FIRST; `surfaces` is what picking it writes
 *   and `reason` is what the ask states beside it
 */
export function interviewOptions(scan, answered = []) {
  const s = scan && typeof scan === 'object' ? scan : {};
  const known = (/** @type {any} */ c) => typeof c === 'string' && CATEGORIES.includes(c);
  /** One set, in CATEGORIES order and de-duplicated. @param {any[]} cats */
  const order = (cats) => CATEGORIES.filter((c) => cats.includes(c));

  const evidence = (Array.isArray(s.evidenced) ? s.evidenced : [])
    .filter((e) => e && typeof e === 'object' && known(e.category));
  /** @type {Map<string, string>} category -> the ONE signal that evidenced it */
  const signals = new Map(evidence.map((e) =>
    [e.category, typeof e.signal === 'string' ? e.signal : '']));
  const evidenced = order(evidence.map((e) => e.category));
  const held = order(strs(answered).filter(known));
  const recommended = order(
    (Array.isArray(s.recommended) ? s.recommended : CATEGORIES).filter(known));
  // Derived, never read off the scan: `inconclusive` IS "nothing was
  // evidenced", and taking it from a field lets a doctored envelope state one
  // arm while carrying the other's evidence.
  const inconclusive = evidenced.length === 0;

  /** `auth (dependency passport), billing (dependency stripe)` */
  const naming = (/** @type {string[]} */ cats) => cats
    .map((c) => (signals.get(c) ? `${c} (${signals.get(c)})` : c)).join(', ');

  const gap = evidenced.filter((c) => !held.includes(c));
  /** @type {Array<{surfaces: string[], reason: string}>} */
  const candidates = [
    {
      surfaces: recommended,
      reason: inconclusive
        ? 'the structure evidences nothing either way - no dependency manifest and no '
          + 'category directory matched - and silence is never absence, so every category stays in scope'
        : `the structure evidences ${naming(evidenced)}; the rest are silent rather `
          + 'than absent, so every category stays in scope',
    },
    // Only when there IS an answered set AND the scan evidences something it
    // does not already cover. Both halves are load-bearing against the same
    // failure - a reason that names a set the user never chose:
    //   - empty gap: this set IS the answered set, and the dedup below would
    //     keep it under a reason ("plus what it evidences") naming nothing.
    //     Two choices reading as one is exactly the #206 shape.
    //   - empty `held`: this set IS `evidenced`, and because the dedup keeps
    //     the FIRST occurrence it would win over choice 4 and present the
    //     evidenced categories as "the answered set plus ..." to a project
    //     that has answered nothing. That is the first-fire path, so it is the
    //     sentence most users read. Dropping the choice here is what the ORDER
    //     comment above means by "with nothing answered, 2 collapses onto 4".
    ...(held.length && gap.length ? [{
      surfaces: order([...held, ...evidenced]),
      reason: `the answered set plus what the scan now evidences beyond it: ${naming(gap)}`,
    }] : []),
    { surfaces: held, reason: 'the set already answered, left unchanged' },
    { surfaces: evidenced, reason: `only what the structure evidences: ${naming(evidenced)}` },
  ];

  /** @type {Array<{surfaces: string[], reason: string}>} */
  const options = [];
  const seen = new Set();
  for (const choice of candidates) {
    if (!choice.surfaces.length) continue;
    const key = choice.surfaces.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(choice);
    if (options.length === OPTION_CAP) break;
  }
  return options;
}
