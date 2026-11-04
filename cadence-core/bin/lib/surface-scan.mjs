// @ts-check
// which of the eight risk-surface categories a project's structure evidences
//
// "absent" isn't an answer here: a category is either evidenced or the structure says nothing about it, and silence is not absence. Narrowing on silence would shrink the one blocking review on a project whose risky code this can't see, which is this repo
// no keyword grep of source text: it false-positived `auth` on every Claude session and `billing` on prose about token cost. Manifests, dependency names, directories and file types only
// this answers which categories a project scopes, once, from structure, and returns all eight because narrowing is the user's; risk-diff answers whether a given range touched one
// pure: the caller reads the tree
'use strict';

/**
 * The eight categories, in the order the config schema and review-triggers list
 * them. The one in-code statement of the vocabulary. Nothing compares by index.
 */
export const CATEGORIES = Object.freeze(['auth', 'migrations', 'billing',
  'concurrency', 'destructive', 'secrets', 'api_contract', 'untrusted_input']);

/**
 * Whether a config layer answered the one-time surface question, and the set
 * that stands either way. One statement, because `route.mjs` reports it and
 * `risk-check run` refuses on it, and two copies could disagree.
 *
 * Anything but an exact, non-empty, fully recognised list leaves every category
 * standing and the question unanswered. `["auth", "secret"]` is a typo, not a
 * decision to stop reviewing secrets, and keeping its valid subset would
 * silently shrink the only blocking gate. `surfaces` is `kept` verbatim,
 * duplicates and all; `risk-check run` de-duplicates at its own call site.
 *
 * @param {unknown} wrote the merged `review.triggers.risk_surface.surfaces`, or `undefined` when no layer wrote it
 * @param {readonly string[]} [vocabulary] the recognised categories, CATEGORIES by default
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
 * Directory base names that evidence a category. Conservative: a name has to
 * mean the category on nearly every project that uses it, so `tasks`,
 * `contracts`, `public` and `lib` are out. A miss costs a recommendation of all
 * eight, a false hit costs a user narrowing away a category they do have.
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
 * Declared dependency names that evidence a category, matched exactly against
 * the name and a scoped package's last segment (`@grpc/grpc-js` -> `grpc-js`).
 * A substring match on `auth` would take `oauthlib` and `author`.
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
 * The categories no structural signal can reach, derived from the four tables
 * so a new signal can't leave a hand-kept list stale. Today that's
 * `destructive` alone: no directory or manifest says a project runs a bulk
 * delete. They're recommended anyway, since leaving them out is the
 * absence-from-silence conclusion.
 */
const UNSPEAKABLE = Object.freeze(CATEGORIES.filter((c) =>
  !DIR_SIGNALS[c] && !FILE_SIGNALS[c] && !EXT_SIGNALS[c] && !DEP_SIGNALS[c]));

/** @param {any} v @returns {string[]} */
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
/** @param {string} s */
const low = (s) => s.toLowerCase();

/**
 * What a tree's structure evidences.
 *
 * @param {{dirs?: string[], files?: string[], extensions?: string[], dependencies?: string[]}} [tree]
 *   `dirs` and `files` are base names (a `db/migrate` walk contributes both
 *   `db` and `migrate`); `extensions` carry their dot; `dependencies` are the
 *   names declared by whatever manifests the caller parsed. Source text is
 *   deliberately not among them.
 * @returns {{evidenced: Array<{category: string, signal: string}>, silent: string[],
 *   unspeakable: string[], inconclusive: boolean, recommended: string[]}}
 *   `evidenced` names each hit and the first signal that found it, so the ask
 *   can state a reason. `silent` is "the structure says nothing", never
 *   "absent". `inconclusive` is `evidenced.length === 0`, and an inconclusive
 *   scan recommends all eight.
 */
export function scanTree(tree = {}) {
  // a caller assembled this from a tree, so a null or a scalar reports instead of throwing
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

  // presence is provable from structure and absence isn't; framework built-in auth (Django contrib.auth, Rails has_secure_password) ships no dependency, so narrowing to the evidenced set would skip the only blocking review there
  // `evidenced` still carries the reason the question states, and the narrowing is the user's
  const recommended = [...CATEGORIES];

  return { evidenced, silent, unspeakable: [...UNSPEAKABLE], inconclusive, recommended };
}

/**
 * The most options one ask-user question may carry, per seams.md. A test reads
 * the cap out of seams.md and holds this to it, so raising the seam moves the
 * requirement.
 */
export const OPTION_CAP = 4;

/**
 * The ordered choices the one-time surface question offers, built here and not
 * composed by a model at the ask site (#206): the prose version offered the
 * same eight categories twice and no test had a list to read.
 *
 *   1. `recommended`, all eight; it never narrows on what a scan missed.
 *   2. the answered set plus every evidenced category it misses.
 *   3. the answered set unchanged, because keeping it is an answer.
 *   4. the evidenced categories alone, the user's pick and never the default.
 * Empty sets and repeats are dropped, and every set is in `CATEGORIES` order so
 * two spellings of one set compare equal.
 *
 * @param {ReturnType<typeof scanTree> | any} scan a `scanTree` result
 * @param {readonly string[]} [answered] the categories a config layer already answered, empty if none
 * @returns {Array<{surfaces: string[], reason: string}>} at most `OPTION_CAP`
 *   choices, recommended first; `surfaces` is what picking one writes
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
  // derived, not read off the scan: a doctored envelope could state one arm while carrying the other's evidence
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
    // needs an answered set and a gap: with no gap this set is the answered one under a reason naming nothing, and with nothing answered it equals `evidenced` and would beat choice 4 with a false "answered set plus"
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
