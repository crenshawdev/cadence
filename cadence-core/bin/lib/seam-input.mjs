// @ts-check
// the argv and file input helpers the bin scripts each copied; the input-side sibling of seam-io, kept apart on purpose
// flagValue throws `{seam:'missing-flag-value', detail}` for a missing, empty or flag-shaped value: `--root` with
// nothing after it used to fall through to the plugin's own tree and report numbers about a tree nobody named
// no bin calls it directly; arg-contract's `requireFlag` raises it for bins with an `e.seam` catch arm
// readText returns '' on failure; include-consumers keeps a second one returning null, which the census admits
'use strict';

import { readFileSync } from 'node:fs';

/**
 * The refusal object, as a value: one construction, two raisers. `flagValue`
 * throws it for a missing, empty or flag-shaped spelling, and arg-contract's
 * `requireFlag` throws the same object when a declared row refuses on the value
 * axis (`--root "   "` is neither, so `flagValue` waves it through). A second
 * construction in a second file is what silently drifts, and helper-census pins
 * this body. A thrown object missing either field surfaces as detail
 * `"[object Object]"`.
 *
 * @param {string} flag @returns {{seam: string, detail: string}}
 */
export function missingFlagValue(flag) {
  return { seam: 'missing-flag-value', detail: flag };
}

/**
 * Read a flag's value, telling absent from present-with-no-value.
 *
 * `--root` with nothing after it (an unset `$TREE`) used to read as undefined
 * and fall through to the plugin's own tree, so the caller got ok:true and this
 * repo's numbers for a tree it never named. That's worse than a hard error
 * because the envelope looks right. A missing, empty or flag-shaped value now
 * throws `{seam:'missing-flag-value', detail:<flag>}`; a genuinely absent flag
 * returns undefined so the caller's default applies. Both fields of the thrown
 * object matter, since the catch arms emit `reason:e.seam, detail:e.detail`.
 *
 * @param {string[]} argv @param {string} flag @returns {string|undefined}
 */
export function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v === '' || v.startsWith('--')) {
    throw missingFlagValue(flag);
  }
  return v;
}

/**
 * Read a file, or "" if missing or unreadable. A directory, a permission failure
 * and an absent path all collapse to "", since the callers feed the text to
 * prose parsers that answer the same about an empty document as a missing one.
 * @param {string} file @returns {string}
 */
export function readText(file) {
  try { return readFileSync(file, 'utf8'); }
  catch { return ''; }
}
