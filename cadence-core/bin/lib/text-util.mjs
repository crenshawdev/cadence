// @ts-check
// text-util.mjs - small helpers several modules need. Pure: no imports, no
// I/O, so a module that must not touch the filesystem can still use them.
'use strict';

/** @param {unknown} s @returns {string} `s` with every RegExp metacharacter escaped */
export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A non-null, non-array object. A type predicate, so a guard on an `unknown`
 * narrows for the `checkJs` typecheck.
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Sleep synchronously: the seams are one-shot processes, not servers. @param {number} ms */
export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
