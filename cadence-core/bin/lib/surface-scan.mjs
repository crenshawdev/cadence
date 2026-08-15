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
 * (config.schema.json's `values`, route-table.json's `risk_surface_categories`,
 * references/review-triggers.md's detection list). Order is load-bearing only
 * for reading: nothing here compares by index.
 */
export const CATEGORIES = Object.freeze(['auth', 'migrations', 'billing',
  'concurrency', 'destructive', 'secrets', 'api_contract', 'untrusted_input']);

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
