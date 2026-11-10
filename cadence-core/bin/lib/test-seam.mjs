// @ts-check
// the one sentinel that opens the test-only overrides (schema, plugin manifest, detect-commands reachability)
// each one changes an enforced answer, so a repo's .envrc can't set one without this
// read by presence, never ||: an empty CADENCE_DETECT_REACHABLE means nothing is on PATH, not "probe for real"
// not a privilege boundary, just a named surface; CADENCE_GLOBAL_CONFIG stays ungated, it's a documented relocation
// pure lib: no fs, no emit, no imports, reads of process.env and no writes; callers pass their shipped path in
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

/**
 * Where a script reads config.schema.json: `CADENCE_CONFIG_SCHEMA` when the seam is open and it is set, else the
 * caller's shipped path.
 * @param {string} shipped
 * @returns {string}
 */
export function schemaPath(shipped) {
  return (testSeamOpen() && process.env.CADENCE_CONFIG_SCHEMA) || shipped;
}

/**
 * Where a script reads plugin.json: `CADENCE_PLUGIN_MANIFEST` when the seam is open and it is set, else the
 * caller's shipped path.
 * @param {string} shipped
 * @returns {string}
 */
export function manifestPath(shipped) {
  return (testSeamOpen() && process.env.CADENCE_PLUGIN_MANIFEST) || shipped;
}
