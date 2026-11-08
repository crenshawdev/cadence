// @ts-check
// global-only-keys.mjs - the config keys honoured from the user-global layer alone, and the strip that enforces it.
// .planning/config.json arrives with a clone, and these three pick what Cadence runs or where a key is read from.
// Enforced at the merge, not in prose: no .mjs reads these today, so patching prose would leave the value live.
// Hand-maintained, not read off config.schema.json: this runs in git-guard's PreToolUse hook on every Bash call,
// and a schema override would un-mark every protected key. self-verify cross-checks both ways.
// Pure: no fs, no emit, no process, no Date, no randomness.
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
 * A repo layer can suppress a global-only key without touching it: `{"workflow": "x"}` replaces the user-global
 * `workflow` object wholesale, and readPath reads that as ABSENT, so the strip alone would miss it.
 * Only intermediate segments are walked. Removing the ancestor loses nothing, a scalar can't carry sibling keys.
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
  // defineProperty, as in lib/config-merge.mjs: never assign into a parsed layer, even under a safe name
  Object.defineProperty(copy, head, {
    value: withoutPath(node[head], rest), writable: true, enumerable: true, configurable: true,
  });
  return copy;
}

/**
 * The path of every own key spelled with a dot, walking plain objects (arrays are leaves, `_meta` is skipped as
 * flatten skips it). A setting's dotted name only exists as nesting: `set` writes {"workflow":{"test_command":x}},
 * so a literal "workflow.test_command" key is never one, and walking it as one let a clone's repo layer pick the
 * command an agent runs. No config map takes dotted names (the schema's keys are all fixed paths), so none is lost.
 * @param {any} node @param {string} [prefix]
 * @returns {string[]}
 */
export function dottedKeyPaths(node, prefix = '') {
  if (!isObj(node)) return [];
  /** @type {string[]} */
  const out = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === '_meta') continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (k.includes('.')) out.push(path);
    else out.push(...dottedKeyPaths(v, path));
  }
  return out;
}

/**
 * The same layer with every dotted key dropped, at any depth. A copy that defines each property, as withoutPath
 * does, and the very object back when nothing is dotted.
 * @param {any} node
 * @returns {any}
 */
export function withoutDottedKeys(node) {
  if (!isObj(node) || !dottedKeyPaths(node).length) return node;
  /** @type {Record<string, any>} */
  const copy = {};
  for (const [k, v] of Object.entries(node)) {
    if (k !== '_meta' && k.includes('.')) continue;
    Object.defineProperty(copy, k, {
      value: k === '_meta' ? v : withoutDottedKeys(v), writable: true, enumerable: true, configurable: true,
    });
  }
  return copy;
}

/** @param {string} path @param {string} file */
export const dottedKeyWarning = (path, file) => `config key "${path}" in ${file} was ignored: a key spelled `
  + 'with a dot is not a setting - nest it ({"section":{"name":...}}) or write it with `config.mjs set`';

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
  // first: a literal "workflow.test_command" key never matches the nested walk below, and the merge would read it
  for (const path of dottedKeyPaths(layer)) warnings.push(dottedKeyWarning(path, file));
  let out = withoutDottedKeys(layer);
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
 * The two ways this set and `config.schema.json`'s `src` marker can disagree, so the hand-kept set stays honest.
 * - `missing-global-only-marker` - a stripped key whose spec has no `src: "global"`, or isn't in the schema at all.
 * - `undeclared-global-only-key` - a key the schema marks that the merge doesn't strip.
 * A key with no `src` is repo-settable and isn't reported.
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
