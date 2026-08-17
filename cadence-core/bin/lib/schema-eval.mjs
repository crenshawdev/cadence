// @ts-check
// schema-eval.mjs - a keyword-limited JSON Schema evaluator, in-repo and
// zero-dep. It exists for exactly one job: to make the agreement between
// `FINDING_SCHEMA` (the shape review-provider.mjs SENDS on the wire) and
// `validateFindings` (the shape it ASSERTS on return) a machine-run fact
// rather than a reviewer's opinion frozen at write time. The agreement test in
// review-provider.test.mjs runs every fixture through both sides and compares
// accept-vs-reject; without an independent reading of the schema there is no
// second side to compare against, and the drift the pairing exists to kill
// returns unnoticed.
//
// TEST-ONLY BY DESIGN. Nothing in the shipped runtime path imports it: the
// seam validates with `validateFindings`, which is hand-written and fast. It
// lives here under `lib/` rather than inside the test file because
// `tsconfig.ci.json` includes every `.mjs` under `cadence-core/bin` and
// EXCLUDES `*.test.mjs` - so a helper in the test file is unchecked, and this
// helper's correctness is what the whole agreement verdict rests on.
//
// LIMITED ON PURPOSE, and it THROWS on its limits. It implements exactly the
// keywords `FINDING_SCHEMA` uses and no others. An evaluator that IGNORED an
// unknown keyword would treat it as satisfied, so a keyword added to
// FINDING_SCHEMA tomorrow with no mirror in `validateFindings` would make the
// agreement test go green on an agreement it never checked. Throwing turns
// that silent pass into a loud failure at the moment the schema grows.
//
// CODE POINTS, never UTF-16 code units. JSON Schema counts `minLength` and
// `maxLength` in Unicode code points; JavaScript's `.length` counts UTF-16
// units, so one astral character (an emoji) reads as 2. That distinction is
// load-bearing HERE specifically: both this module and `validateFindings` were
// written in the same phase, so if both reached for `.length` they would agree
// with each other while both disagreed with the schema, and the agreement test
// would pass on the shared error. The non-BMP fixtures in that table are what
// pin it.
//
// Pure and total in the conforming direction: no I/O, no emit, node builtins
// only. It returns `null` when the value conforms or a string naming the first
// violation. It throws ONLY on a schema it cannot faithfully evaluate, never
// on a value.
'use strict';

/** The complete set of keywords this evaluator understands. */
const IMPLEMENTED = new Set([
  'type', 'properties', 'required', 'additionalProperties',
  'items', 'enum', 'minimum', 'minLength', 'maxLength', 'maxItems',
]);

/** The `type` values this evaluator understands. */
const TYPES = new Set(['object', 'array', 'string', 'integer', 'number', 'boolean', 'null']);

/** @param {unknown} v @returns {boolean} */
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Length in Unicode code points. See the header. @param {string} s */
function codePoints(s) {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

/**
 * Walk the whole SCHEMA (independently of any value) and throw on anything
 * this evaluator cannot faithfully evaluate. Run before evaluation, over every
 * branch, because a value that never reaches a subschema would otherwise let
 * an unimplemented keyword through unnoticed - which is the exact silent pass
 * the throw exists to prevent.
 * @param {any} schema @param {string} path
 */
function assertSupported(schema, path) {
  if (!isPlainObject(schema)) {
    throw new Error(`schema-eval: ${path} is not a schema object`);
  }
  for (const k of Object.keys(schema)) {
    if (!IMPLEMENTED.has(k)) {
      throw new Error(`schema-eval: unimplemented keyword \`${k}\` at ${path}`);
    }
  }
  if ('type' in schema && !TYPES.has(schema.type)) {
    // Includes the array-of-types union form, which this evaluator does not do.
    throw new Error(`schema-eval: unimplemented type \`${JSON.stringify(schema.type)}\` at ${path}`);
  }
  if ('additionalProperties' in schema && schema.additionalProperties !== false) {
    // `false` is the only form FINDING_SCHEMA uses. A subschema value would
    // need real evaluation and `true` is a no-op this module has never had to
    // mean; either way, guessing is what the header refuses.
    throw new Error(`schema-eval: unimplemented additionalProperties at ${path}`);
  }
  if ('properties' in schema) {
    if (!isPlainObject(schema.properties)) {
      throw new Error(`schema-eval: properties at ${path} is not an object`);
    }
    for (const [k, sub] of Object.entries(schema.properties)) assertSupported(sub, `${path}.${k}`);
  }
  if ('items' in schema) assertSupported(schema.items, `${path}[]`);
}

/**
 * @param {any} schema @param {any} value @param {string} path
 * @returns {string|null}
 */
function walk(schema, value, path) {
  if ('type' in schema) {
    const t = schema.type;
    const ok = t === 'object' ? isPlainObject(value)
      : t === 'array' ? Array.isArray(value)
        : t === 'string' ? typeof value === 'string'
          : t === 'integer' ? Number.isInteger(value)
            : t === 'number' ? typeof value === 'number' && Number.isFinite(value)
              : t === 'boolean' ? typeof value === 'boolean'
                : value === null;
    if (!ok) return `${path}: expected ${t}`;
  }
  if ('enum' in schema && !schema.enum.some((/** @type {any} */ e) => Object.is(e, value))) {
    return `${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`;
  }
  if (typeof value === 'string') {
    const n = codePoints(value);
    if ('minLength' in schema && n < schema.minLength) {
      return `${path}: shorter than minLength ${schema.minLength} (${n})`;
    }
    if ('maxLength' in schema && n > schema.maxLength) {
      return `${path}: longer than maxLength ${schema.maxLength} (${n})`;
    }
  }
  if (typeof value === 'number' && 'minimum' in schema && value < schema.minimum) {
    return `${path}: below minimum ${schema.minimum} (${value})`;
  }
  if (Array.isArray(value)) {
    if ('maxItems' in schema && value.length > schema.maxItems) {
      return `${path}: more than maxItems ${schema.maxItems} (${value.length})`;
    }
    if ('items' in schema) {
      for (let i = 0; i < value.length; i += 1) {
        const bad = walk(schema.items, value[i], `${path}[${i}]`);
        if (bad) return bad;
      }
    }
  }
  if (isPlainObject(value)) {
    for (const r of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, r)) return `${path}: missing required \`${r}\``;
    }
    if (schema.additionalProperties === false) {
      const known = schema.properties ? Object.keys(schema.properties) : [];
      for (const k of Object.keys(value)) {
        if (!known.includes(k)) return `${path}: unknown key \`${k}\``;
      }
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
      const bad = walk(sub, value[k], `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;
}

/**
 * Evaluate `value` against `schema`.
 * @param {any} schema @param {any} value
 * @returns {string|null} null when the value conforms, else the first violation
 * @throws when the schema carries a keyword this evaluator does not implement
 */
export function evaluateSchema(schema, value) {
  assertSupported(schema, '$');
  return walk(schema, value, '$');
}
