// @ts-check
// the one sentinel that opens the test-only overrides (schema, plugin manifest, detect-commands reachability)
// each one changes an enforced answer, so a repo's .envrc can't set one without this
// read by presence, never ||: an empty CADENCE_DETECT_REACHABLE means nothing is on PATH, not "probe for real"
// not a privilege boundary, just a named surface; CADENCE_GLOBAL_CONFIG stays ungated, it's a documented relocation
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
