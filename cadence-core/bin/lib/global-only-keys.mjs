// @ts-check
// global-only-keys.mjs - the one statement of which config keys are honoured from the user-global layer alone,
// and the strip that enforces it. A .planning/config.json arrives with a clone, and these three choose what
// Cadence runs or where a provider key is read from, so a tracked file must not be able to set them.
// Enforced at the merge, not at the prose sites: no .mjs reads any of the three today, so patching prose alone
// would leave the value live for the first future reader and split inspection from enforcement again.
// Hand-maintained on purpose, not read off config.schema.json: a cross-file read once made a cross-key check
// fire unconditionally, CADENCE_CONFIG_SCHEMA would make it a one-variable switch that un-marks every protected
// key, and this runs in git-guard.mjs's PreToolUse hook on every Bash call. self-verify cross-checks both ways.
// Pure: no fs, no emit, no process, no Date, no randomness. mergeLayers puts the warning strings on a field of
// its own and config.mjs's get folds them into its warnings.
'use strict';

/**
 * Every config key honoured from the user-global layer alone, as the exact
 * dotted token the schema and the CLI spell it with.
 * @type {ReadonlyArray<string>}
 */
export const GLOBAL_ONLY_KEYS = Object.freeze([
  'workflow.test_command',
  'workflow.lint_command',
  'review.key_file',
]);

/** The `src` value config.schema.json marks a global-only key with. */
export const GLOBAL_SRC = 'global';

/** @param {any} v */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Nothing at that path - distinct from a path holding `null`, which IS set. */
const ABSENT = Symbol('absent');

/**
 * Walks a dotted path through a parsed layer. A scalar, array or null where an object was expected yields
 * ABSENT, not a throw, because this runs on whatever a user's config happens to hold.
 * @param {any} node @param {string[]} parts
 */
function readPath(node, parts) {
  let cur = node;
  for (const p of parts) {
    if (!isObj(cur) || !Object.hasOwn(cur, p)) return ABSENT;
    cur = cur[p];
  }
  return cur;
}

/**
 * The path prefix of the first ancestor that is present but not an object, or null when the walk is clean.
 * A repo layer can reach a global-only key this way without touching the key: deepMerge replaces arrays and
 * scalars wholesale, so `{"workflow": "x"}` (or `[]`, or `null`) replaces the user-global `workflow` object and
 * every global-only key under it falls to its schema default. readPath reads that as ABSENT, so the strip would
 * leave the ancestor in place and the suppression would land silently.
 * Only intermediate segments are walked; a non-object at the leaf is the ordinary case.
 * Removing such an ancestor loses nothing: a scalar or array can't carry keys, so the repo-settable siblings
 * (`workflow.max_plan_tasks`, `review.mode`) were already unreachable through it.
 * @param {any} node @param {string[]} parts
 * @returns {string[]|null}
 */
function blockingAncestor(node, parts) {
  let cur = node;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!isObj(cur) || !Object.hasOwn(cur, parts[i])) return null;
    cur = cur[parts[i]];
    if (!isObj(cur)) return parts.slice(0, i + 1);
  }
  return null;
}

/**
 * The same object with `parts` removed, copying only the containers along that path. A copy, never a mutation:
 * mergeLayers publishes the layer it parsed as `layers.repo`, and that has to keep showing what the file said.
 * @param {any} node @param {string[]} parts
 */
function withoutPath(node, parts) {
  const [head, ...rest] = parts;
  if (!isObj(node) || !Object.hasOwn(node, head)) return node;
  const copy = { ...node };
  if (!rest.length) {
    delete copy[head];
    return copy;
  }
  // defineProperty over assignment, as in lib/config-merge.mjs: never assign into a parsed layer, even when the name is safe
  Object.defineProperty(copy, head, {
    value: withoutPath(node[head], rest), writable: true, enumerable: true, configurable: true,
  });
  return copy;
}

/**
 * Strips every global-only key from a repo-layer object, and says which ones the file set. The halves are
 * asymmetric on purpose:
 * - the strip is value-agnostic. deepMerge returns the higher layer's value for a `null`, so a repo `null`
 *   would override the user-global value, and `cadence-core/templates/config.json` ships all three at `null`
 *   into every scaffolded repo.
 * - the warning fires only on a non-null value. Warning on presence would fire on three untouched keys at a
 *   new project's first command, which trains click-through.
 * @param {any} layer the PARSED repo layer (anything else is returned as-is)
 * @param {string} file the repo layer's path, named in every warning so an
 *   attack and an honest mistake are equally visible
 * @returns {{layer: any, warnings: string[]}}
 */
export function stripGlobalOnly(layer, file) {
  /** @type {string[]} */
  const warnings = [];
  if (!isObj(layer)) return { layer, warnings };
  let out = layer;
  for (const key of GLOBAL_ONLY_KEYS) {
    const parts = key.split('.');
    // ancestor arm first: a non-object ancestor makes readPath report ABSENT, so checking the key alone would
    // skip the one shape that suppresses the user-global value without setting anything
    const blocked = blockingAncestor(out, parts);
    if (blocked) {
      const section = blocked.join('.');
      const under = GLOBAL_ONLY_KEYS.filter((k) => k.startsWith(`${section}.`)).join(', ');
      const blockedValue = readPath(out, blocked);
      out = withoutPath(out, blocked);
      // silent for a null, like the leaf arm: a scaffolded repo mustn't warn on its own template
      if (blockedValue !== null) {
        warnings.push(`config section "${section}" in ${file} is not a JSON object and `
          + `was ignored: it would have replaced the user-global "${section}" section `
          + `outright, suppressing ${under}, which are honoured from the user-global `
          + 'config layer only');
      }
      continue;
    }
    const value = readPath(out, parts);
    if (value === ABSENT) continue;
    out = withoutPath(out, parts);
    if (value === null) continue;
    warnings.push(`config key "${key}" is set in ${file} and was ignored: it is `
      + 'honoured from the user-global config layer only - set it there with '
      + '`config.mjs set --global`');
  }
  return { layer: out, warnings };
}

/**
 * The two ways this set and `config.schema.json`'s `src` marker can disagree. The pair keeps the
 * hand-maintained set honest without a runtime read of the schema.
 * - `missing-global-only-marker` - a key the merge strips whose spec carries no `src: "global"`, so the scope
 *   is enforced but invisible to the user. A key the schema doesn't hold at all reads here too, and says so.
 * - `undeclared-global-only-key` - a key the schema marks that the merge doesn't strip, so the marker promises
 *   what nothing keeps.
 * A key with no `src` is repo-settable and isn't reported: the marker is demanded on the enforced set alone, so
 * this stays one edit rather than an explicit `"src": "repo"` on every other key.
 * @param {any} schemaKeys the schema's `keys` object (key -> spec)
 * @returns {{code: string, detail: string}[]}
 */
export function globalOnlyMarkerIssues(schemaKeys) {
  /** @type {{code: string, detail: string}[]} */
  const out = [];
  const keys = isObj(schemaKeys) ? schemaKeys : {};
  const enforced = new Set(GLOBAL_ONLY_KEYS);
  for (const key of GLOBAL_ONLY_KEYS) {
    const spec = Object.hasOwn(keys, key) ? keys[key] : undefined;
    if (isObj(spec) && spec.src === GLOBAL_SRC) continue;
    out.push({ code: 'missing-global-only-marker',
      detail: `${key}: lib/global-only-keys.mjs strips it out of the repo layer, but `
        + (isObj(spec)
          ? `config.schema.json carries no "src": "${GLOBAL_SRC}" on it`
          : 'config.schema.json does not hold the key at all') });
  }
  for (const [key, spec] of Object.entries(keys)) {
    if (!isObj(spec) || spec.src !== GLOBAL_SRC || enforced.has(key)) continue;
    out.push({ code: 'undeclared-global-only-key',
      detail: `${key}: config.schema.json marks it "src": "${GLOBAL_SRC}", but `
        + 'lib/global-only-keys.mjs does not strip it, so a repo layer still sets it' });
  }
  return out;
}
