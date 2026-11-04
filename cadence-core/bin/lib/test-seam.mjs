// @ts-check
// test-seam.mjs - the one sentinel that admits this tree's hermetic path overrides. CADENCE_CONFIG_SCHEMA and CADENCE_PLUGIN_MANIFEST each redirect a file the seams read as ground truth: the schema sets every review trigger's gate and decides which keys are known, and the manifest is what every version-skew answer is computed from
// CADENCE_DETECT_REACHABLE redirects a reading and not a file: detect-commands takes it as the set of binaries that resolve on PATH, so the seam's fixture assertions stop depending on which tools the machine happens to have. It's gated for the same reason as the other two, since the value decides which static-analysis command an executor runs before every commit
// it's read by presence and never through ||, because an empty value legitimately means nothing is on PATH and a falsy value read through || would silently become the live probe. Present, it stands in for the whole reachability answer and no filesystem is consulted
// each of the three used to carry a "hermetic test injection only" comment while being honoured in production with nothing gating it. Reading the override only when this sentinel holds makes the comment and the behaviour agree, and a repo-supplied .envrc or devcontainer env block can no longer change an enforcement answer by setting one variable
// it's not a privilege boundary: anything that can set CADENCE_CONFIG_SCHEMA can set CADENCE_TEST_SEAM beside it, and what the sentinel buys is a stated production surface. Where a redirect would carry a credential and not a file read, the answer is to delete the override and not fence it, as was done for the provider base override
// deliberately not gated: CADENCE_GLOBAL_CONFIG is a documented, user-facing relocation, honoured in production; CADENCE_MANAGED_SETTINGS and CADENCE_USER_SETTINGS are honest relocations too; and CADENCE_DEFERRED_READS already reports an unusable override rather than falling back
// pure lib: no fs, no emit, no imports, one read of process.env and no writes
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
