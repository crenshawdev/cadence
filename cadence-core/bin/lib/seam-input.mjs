// @ts-check
// seam-input.mjs - the ONE home for the argv and file INPUT helpers the bin
// scripts had each copied into themselves: two flag readers and the
// ''-on-failure text reader. Zero-dep, node builtins only, pure (no emit, no
// mergeLayers, no process): the caller owns its envelope.
//
// The input-side counterpart to lib/seam-io.mjs, and a SEPARATE module on
// purpose (D-04). That file's header claims "the ONE implementation of the seam
// OUTPUT convention" as its whole subject, so an input face grown onto it would
// make a stated boundary false; this is the sibling instead.
//
// Why a home at all: before this there were five byte-identical `flag`
// definitions (git-branch, git-publish, land-cleanup, release-bump,
// worktree-base), two `flagValue` definitions (weight, self-verify) and three
// `readText` definitions - twelve copies of three contracts, which is a drift
// surface rather than a convenience. helper-census.test.mjs pins each of them
// at exactly one definition so a sixth copy reddens instead of drifting.
//
// THE TWO FLAG READERS ARE TWO CONTRACTS, AND BOTH ARE LIVE. They answer
// DIFFERENTLY for a present-but-valueless flag, which is the reason there are
// two of them:
//
//   optionalFlag - absent OR present-with-no-value both read as `undefined`,
//     never a throw. It is the reader for the flags that legitimately default
//     when nothing is given - `--branch`, `--base`, `--remote`, `--merged`,
//     `--version`, `--date`, `--timeout-ms` - where the caller's own
//     `|| fallback` is the whole contract.
//   flagValue - a missing, empty or flag-shaped value THROWS
//     `{seam:'missing-flag-value', detail}`. Every caller holds an `e.seam`
//     catch arm that turns that object into a named refusal, and the refusal
//     is the point: `--root` with nothing after it used to fall through to the
//     plugin's own tree and report confident numbers about a tree the caller
//     never named.
//
// `--dir` reads through flagValue at EVERY seam (phase 2 D-01), reversing this
// header's earlier guarantee that its five callers kept the permissive reader.
// That guarantee rested on the mutating seams being the only place a wrong
// tree costs anything, and the advisory ones showed the identical defect:
// measured 2026-08-18, `git-branch.mjs tags --dir ''` answered with this
// repository's own 33 tags about a tree the caller never named. So the
// divergence was reversed for `--dir`, and for `--dir` alone. Each migrated
// bin took its own `e.seam` catch arm with the move (D-09) - a seam reading
// `--dir` through flagValue without one surfaces the refusal as
// `{"ok":false,"reason":"internal","detail":"[object Object]"}`.
//
// `readText` here is the ''-on-failure contract (a missing surface is not
// fatal). lib/include-consumers.mjs:123-130 keeps a DIFFERENT `readText` - an
// isFile()-guarded reader returning null - and it deliberately does not live
// here: null distinguishes "absent" from "empty", which is the distinction that
// check's callers act on, and '' collapses them. The census names that file as
// the one admitted second definition.
'use strict';

import { readFileSync } from 'node:fs';

/**
 * The argv entry positionally after `name`, or `undefined` when the flag is
 * absent. NEVER throws, and deliberately does not distinguish
 * present-with-no-value from absent - both are `undefined` so the caller's own
 * `|| fallback` applies. Callers that must tell those apart use `flagValue`.
 *
 * Takes `argv` as a parameter because each copy this replaced closed over its
 * own module-level `argv`; the bins bridge with a one-line partial application
 * (`const flag = (name) => optionalFlag(argv, name)`), which is an adapter
 * binding, not a second definition of the reader.
 *
 * @param {string[]} argv @param {string} name @returns {string|undefined}
 */
export function optionalFlag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/**
 * Read a flag's value, distinguishing ABSENT from PRESENT-WITH-NO-VALUE.
 *
 * The two must not collapse. `--root` with nothing after it - the shape a
 * caller produces by passing an unset or empty `$TREE` - used to read as
 * `undefined` and fall through to the plugin's own tree, so the caller got
 * ok:true and the Cadence repo's numbers for a tree it never named. That is
 * the quiet-wrong-number class, and it is worse than a hard error because the
 * envelope looks correct. A missing, empty or flag-shaped value throws
 * `{seam:'missing-flag-value', detail:<flag>}`; a genuinely absent flag still
 * returns undefined so the caller's own default applies.
 *
 * BOTH fields of the thrown object are load-bearing: the callers' catch arms
 * emit `{ok:false, reason:e.seam, detail:e.detail}`, and a thrown object with
 * no `message` would otherwise surface as detail `"[object Object]"`.
 *
 * @param {string[]} argv @param {string} flag @returns {string|undefined}
 */
export function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v === '' || v.startsWith('--')) {
    throw { seam: 'missing-flag-value', detail: flag };
  }
  return v;
}

/**
 * Read a file, or "" if missing/unreadable (a missing surface is not fatal).
 * A directory, a permission failure and an absent path all collapse to "" -
 * the callers here feed the text to prose parsers that answer the same way
 * about an empty document as about one that is not there.
 * @param {string} file @returns {string}
 */
export function readText(file) {
  try { return readFileSync(file, 'utf8'); }
  catch { return ''; }
}
