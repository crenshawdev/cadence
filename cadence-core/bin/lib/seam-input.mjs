// @ts-check
// seam-input.mjs - the ONE home for the argv and file INPUT helpers the bin
// scripts had each copied into themselves: the throwing flag reader and the
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
// surface rather than a convenience. helper-census.test.mjs pins each of the
// surviving contracts at exactly one definition so a re-copy reddens instead
// of drifting.
//
// ONE FLAG READER NOW, AND THE OTHER CONTRACT IS A DECLARED DISPOSITION
// (ARG-06). There were two live readers here, answering DIFFERENTLY for a
// present-but-valueless flag: `optionalFlag` read absent and
// present-with-no-value both as `undefined` so the caller's own `|| fallback`
// applied, and `flagValue` refused. The first has collapsed into
// lib/arg-contract.mjs - a flag that legitimately defaults (`--branch`,
// `--base`, `--remote`, `--merged`, `--version`, `--timeout-ms`) now DECLARES
// the `fallback` disposition on its row, which is the same answer reached from
// a declaration rather than from a second reader. That is the second reversal
// of this header's two-contract guarantee, after phase 2 reversed it for
// `--dir`, and it closed a defect the positional reader carried: it returned
// the NEXT FLAG as a value, so `git-branch.mjs decide --branch --dir <p>` read
// `--dir` as the branch name (D-13). A declared `fallback` reads that spelling
// as ABSENT instead.
//
//   flagValue - a missing, empty or flag-shaped value THROWS
//     `{seam:'missing-flag-value', detail}`, built by `missingFlagValue`
//     below. It is the rule lib/arg-contract.mjs CONSULTS for the
//     absent-versus-nothing-usable split rather than re-spelling, so this stays
//     the one place that line is drawn for the whole seam layer. The refusal is
//     the point: `--root` with nothing after it used to fall through to the
//     plugin's own tree and report confident numbers about a tree the caller
//     never named.
//
// No bin calls it directly any more: each declares its flags and reads them
// through lib/arg-contract.mjs, whose `requireFlag` raises this module's
// refusal object for the bins holding an `e.seam` catch arm and whose
// `evaluateFlag` returns a classification for the bins that name their own
// refusal. A seam reading a `refuse` row through the raising form without that
// arm surfaces the refusal as
// `{"ok":false,"reason":"internal","detail":"[object Object]"}` (D-09).
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
 * The refusal object, as a VALUE. One construction, two raisers: `flagValue`
 * throws it below for the missing, empty and flag-shaped spellings, and
 * lib/arg-contract.mjs's `requireFlag` throws the same object for a flag whose
 * declared row refuses on the VALUE axis - `--root "   "` is neither empty nor
 * flag-shaped, so `flagValue` waves it through and the row is what refuses it.
 * Two raisers, ONE construction: helper-census.test.mjs pins this body here.
 *
 * It is a function rather than a literal at each site for the reason
 * helper-census.test.mjs states about every helper here: a second construction
 * of one contract in a second file is what silently drifts, and the two fields
 * are exactly what the callers' `e.seam` arms emit - a thrown object without
 * them surfaces as detail `"[object Object]"`.
 *
 * @param {string} flag @returns {{seam: string, detail: string}}
 */
export function missingFlagValue(flag) {
  return { seam: 'missing-flag-value', detail: flag };
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
    throw missingFlagValue(flag);
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
