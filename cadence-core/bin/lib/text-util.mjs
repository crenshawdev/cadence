// @ts-check
// text-util.mjs - small pure helpers. No imports, no I/O, so a module barred from the filesystem can use them.
'use strict';

/** @param {unknown} s @returns {string} `s` with every RegExp metacharacter escaped */
export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A non-null, non-array object. It's a predicate so a guard on an `unknown` narrows under checkJs.
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Blocks on purpose, the seams are one-shot processes and not servers. @param {number} ms */
export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
