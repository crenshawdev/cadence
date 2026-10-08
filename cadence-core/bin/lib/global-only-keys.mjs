// @ts-check
// global-only-keys.mjs - the ONE statement of which config keys are honoured
// from the USER-GLOBAL layer alone, and the strip that enforces it. A
// `.planning/config.json` arrives with a clone; these three choose what Cadence
// RUNS (`workflow.test_command`, `workflow.lint_command`) and where a provider
// key is read from (`review.key_file`), so a tracked file must not be able to
// set them (CFG-02).
//
// Enforced at the MERGE, never at the prose sites that interpolate the values.
// No .mjs reads any of the three off config today, so patching prose alone would
// leave the value live for the first future reader and re-create the
// inspection/enforcement split - the shape STK-03 closed at config.mjs's write
// face versus route.mjs's read face, where a user-global `risk.override.<surface>`
// waived the floor in every repository on the machine because only one face
// carried the scope rule (D-03).
//
// HAND-MAINTAINED, and deliberately not read off config.schema.json at runtime,
// exactly as lib/retired-keys.mjs states for its own map: a cross-file read is
// how a cross-key check came to fire unconditionally (D-12), CADENCE_CONFIG_SCHEMA
// would turn a schema read into a one-variable switch that un-marks every
// protected key, and this runs inside git-guard.mjs's PreToolUse hook on every
// Bash call. The schema marker and this set are cross-checked against each other
// by self-verify instead, in both directions (D-04).
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns a
// stripped COPY and warning strings; the callers own the envelope -
// mergeLayers puts the strings on a field of its own and config.mjs's `get`
// folds them into the warnings it already emits.
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
 * Walk a dotted path through a PARSED layer object. Defensive at every segment:
 * a scalar, array or null where an object was expected yields ABSENT rather
 * than a throw, because this runs on whatever a user's config happens to hold.
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
 * The path prefix of the first ANCESTOR that is present but not an object, or
 * null when the walk is clean. This is the second way a repo layer reaches a
 * global-only key, and it does not go through the key at all: `deepMerge`
 * replaces arrays and scalars wholesale, so a repo layer holding
 * `{"workflow": "x"}` (or `[]`, or `null`) REPLACES the user-global `workflow`
 * object outright and every global-only key under it resolves to its schema
 * default. `readPath` reads that as ABSENT - nothing is set at the key - so the
 * strip above would leave the ancestor in place and the suppression it exists to
 * prevent lands anyway, silently.
 *
 * Only INTERMEDIATE segments are walked. The leaf's own value is whatever the
 * file holds and is stripped by value-agnostic rule; a non-object THERE is the
 * ordinary case, not an ancestor.
 *
 * Removing such an ancestor loses nothing a caller could have read: a scalar or
 * array cannot carry any key, global-only or otherwise, so the repo-settable
 * siblings under that section (`workflow.max_plan_tasks`, `review.mode`) are
 * already unreachable through it before this removes it.
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
 * The same object with `parts` removed, copying only the containers along that
 * path. A COPY, never a mutation: `mergeLayers` publishes the layer it parsed as
 * `layers.repo`, whose documented job is to carry the FILE's content, and a
 * caller reading provenance must still see what the file said.
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
  // defineProperty rather than assignment, for the reason lib/config-merge.mjs
  // states: the segment names here are fixed and safe, but a repo whose idiom is
  // "never assign into a parsed layer" keeps no exception for the safe case.
  Object.defineProperty(copy, head, {
    value: withoutPath(node[head], rest), writable: true, enumerable: true, configurable: true,
  });
  return copy;
}

/**
 * Strip every global-only key from a repo-layer object, and say which ones the
 * file SET.
 *
 * The two halves are deliberately asymmetric (D-13):
 *
 * - the STRIP is value-agnostic. `deepMerge` returns the higher layer's value
 *   for a `null`, so a repo `null` left in place OVERRIDES the user-global
 *   value - the same reach in the other direction - and
 *   `cadence-core/templates/config.json` ships all three at `null` into every
 *   scaffolded repo. Stripping regardless of value is what keeps a tracked file
 *   from suppressing the global command.
 * - the WARNING fires only where the value is NON-NULL. Warning on presence
 *   would fire on three untouched keys at a new project's first command, which
 *   trains exactly the click-through habit CFG-02 declined to build.
 *
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
    // The ancestor arm runs FIRST: a non-object ancestor makes readPath report
    // ABSENT, so checking the key alone would skip the one shape that suppresses
    // the user-global value without setting anything.
    const blocked = blockingAncestor(out, parts);
    if (blocked) {
      const section = blocked.join('.');
      const under = GLOBAL_ONLY_KEYS.filter((k) => k.startsWith(`${section}.`)).join(', ');
      const blockedValue = readPath(out, blocked);
      out = withoutPath(out, blocked);
      // Silent for a null, for the same reason the leaf arm is: null is not a
      // deliberate setting, and a scaffolded repo must not warn on its template.
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
 * The two ways this set and `config.schema.json`'s `src` marker can disagree,
 * modeled on check 8's `missing-rung-agent` / `undeclared-rung-agent` pair
 * (D-12). The pair is what keeps the hand-maintained set honest WITHOUT a
 * runtime read of the schema, which is the whole reason the set is hand-
 * maintained (see the file header).
 *
 * - `missing-global-only-marker` - a key the merge strips whose spec carries no
 *   `src: "global"`. The scope is then enforced and invisible: neither the
 *   schema nor the catalog derived from it shows a user why their value is
 *   ignored. A key the schema does not hold AT ALL reads here too, and says so.
 * - `undeclared-global-only-key` - a key the schema marks that the merge does
 *   not strip. The marker is a promise nothing keeps: a repo layer still sets
 *   the key while every rendered surface says it cannot.
 *
 * A key with NO `src` field is repo-settable and is not reported. The marker is
 * demanded on the enforced set alone, so this stays one edit rather than an
 * explicit `"src": "repo"` across the ~38 keys that carry no marker today.
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
