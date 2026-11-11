// @ts-check
// text-util.mjs - small pure helpers. No imports, no I/O, so a module barred from the filesystem can use them.
'use strict';

/** @param {unknown} s @returns {string} `s` with every RegExp metacharacter escaped */
export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {unknown} v @returns {string} `v` as JSON, an undefined written as null */
export function show(v) {
  return JSON.stringify(v === undefined ? null : v);
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

/**
 * A stateful line filter: `true` while the line is a fence marker or inside a fenced code block, `false` for
 * content. One scanner per walk, fed every line in order.
 * Follows CommonMark closely enough: up to three spaces of indent, three or more backticks or tildes, and a
 * closer of the same character, at least as long, with no info string. The delimiter line itself is never content.
 * @returns {(line: string) => boolean}
 */
export function fenceScanner() {
  /** @type {{char: string, len: number}|null} */
  let fence = null;
  return (/** @type {string} */ line) => {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})\s*(.*)$/);
    if (!f) return fence !== null;
    const char = f[1][0], len = f[1].length;
    if (fence === null) fence = { char, len };
    else if (char === fence.char && len >= fence.len && !f[2].trim()) fence = null;
    return true;
  };
}
