// @ts-check
// test-seam.mjs - the ONE sentinel that admits this tree's hermetic path
// overrides. `CADENCE_ROUTE_TABLE`, `CADENCE_CONFIG_SCHEMA` and
// `CADENCE_PLUGIN_MANIFEST` each redirect a file the seams read as GROUND TRUTH
// - the route table sets every review trigger's gate, the schema decides which
// keys are known and which carry the `src: "global"` marker, and the manifest is
// what every version-skew answer is computed from. A fourth,
// `CADENCE_DETECT_REACHABLE`, redirects a READING rather than a file:
// `detect-commands` takes it as the set of binaries that resolve on PATH, in
// place of its own probe, so the seam's 23 fixture assertions stop depending on
// which tools the machine running them happens to have installed (RCH-01,
// phase 3 D-11). It is gated for the same reason as the three above rather than
// as a courtesy: the value decides which static-analysis command an executor is
// told to run before every commit, which is an enforcement answer. Read by
// PRESENCE, never through `||` - an empty value legitimately means "nothing is
// on PATH", and a falsy value read through `||` would silently become the live
// probe. Present, it stands in for the whole reachability answer: no filesystem
// is consulted, which is what lets one fixture prove the live probe (a tree
// carrying its own `node_modules/.bin`) and the same fixture prove the
// variable had force. Each carried a comment saying
// "hermetic test injection only" and was honored in production with nothing
// gating it, so the comment described an intent the code did not enforce.
// Reading the override only when this sentinel holds closes that gap: the
// comment and the behaviour agree, and a repo-supplied `.envrc` or devcontainer
// env block no longer changes an enforcement answer by setting one variable.
//
// It is NOT a privilege boundary. Anything that can set `CADENCE_ROUTE_TABLE`
// can set `CADENCE_TEST_SEAM` beside it; what the sentinel buys is a STATED
// production surface, not isolation from an attacker who already controls the
// environment. Where a redirect would carry a credential rather than a file
// read, the answer is to delete the override, not to fence it - see the
// `CADENCE_PROVIDER_BASE` removal in review-provider.mjs.
//
// Deliberately NOT gated (per phase-2 D-16, decided per variable):
// `CADENCE_GLOBAL_CONFIG` is a documented user-facing relocation,
// `CADENCE_MANAGED_SETTINGS` / `CADENCE_USER_SETTINGS` are honest relocations
// too, and `CADENCE_DEFERRED_READS` already REPORTS an unusable override rather
// than falling back.
//
// Pure lib: no fs, no emit, no imports. One read of process.env, no writes.
'use strict';

/**
 * True only when `CADENCE_TEST_SEAM` is exactly `1`. Anything else - unset,
 * empty, `true`, `0`, `01`, ` 1 ` - reads as closed, so the gate can never be
 * opened by an accidental spelling.
 * @returns {boolean}
 */
export function testSeamOpen() {
  return process.env.CADENCE_TEST_SEAM === '1';
}
