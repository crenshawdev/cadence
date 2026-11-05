// @ts-check
// schema-eval.mjs - a keyword-limited, zero-dep JSON Schema evaluator, so `FINDING_SCHEMA` and `validateFindings`
// agree by machine and not on someone's say-so. Test-only, but in lib/ so tsconfig.ci.json typechecks it.
// It throws on any keyword `FINDING_SCHEMA` doesn't use: ignoring an unknown one would call a value satisfied.
// minLength and maxLength count code points, not 16-bit units, because two matching `.length`s would both be wrong.
// Pure: null for a conforming value, else a string naming the first violation. Throws only on a bad schema.
'use strict';

import { isPlainObject } from './text-util.mjs';

/** The complete set of keywords this evaluator understands. */
const IMPLEMENTED = new Set([
  'type', 'properties', 'required', 'additionalProperties',
  'items', 'enum', 'minimum', 'minLength', 'maxLength', 'maxItems',
]);

/** The `type` values this evaluator understands. */
const TYPES = new Set(['object', 'array', 'string', 'integer', 'number', 'boolean', 'null']);

/** Length in Unicode code points, not 16-bit units. @param {string} s */
function codePoints(s) {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

/**
 * Walks the whole schema, independent of any value, and throws on anything this evaluator can't faithfully
 * evaluate. It runs before evaluation over every branch: a value that never reaches a subschema would otherwise
 * let an unimplemented keyword through, which is the silent pass the throw exists to stop.
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
    // this covers the array-of-types union form too, which isn't implemented
    throw new Error(`schema-eval: unimplemented type \`${JSON.stringify(schema.type)}\` at ${path}`);
  }
  if ('additionalProperties' in schema && schema.additionalProperties !== false) {
    // false is the only form FINDING_SCHEMA uses; a subschema would need real evaluation, and guessing is out
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
