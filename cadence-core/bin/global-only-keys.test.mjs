// Tests for lib/global-only-keys.mjs - the set of keys honoured from the
// user-global layer alone, and the strip that enforces it (CFG-02).
// Run: node --test cadence-core/bin/global-only-keys.test.mjs
//
// ONE test() per row, deliberately, following retired-keys.test.mjs: a table
// asserted inside a single test() with a sequential loop reports the loop's
// count, not the rows', so a row that never ran still looks green.
// Only node: builtins, no subprocess - the lib is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_ONLY_KEYS, GLOBAL_SRC, stripGlobalOnly } from './lib/global-only-keys.mjs';

const FILE = '/w/.planning/config.json';

// --- the set itself -----------------------------------------------------------

test('the set is exactly the three keys CFG-02 names, and is frozen', () => {
  assert.deepEqual([...GLOBAL_ONLY_KEYS],
    ['workflow.test_command', 'workflow.lint_command', 'review.key_file']);
  assert.equal(Object.isFrozen(GLOBAL_ONLY_KEYS), true);
  assert.equal(GLOBAL_SRC, 'global');
});

// --- the strip ----------------------------------------------------------------

test('a non-null value is removed from the layer the merge consumes', () => {
  const { layer } = stripGlobalOnly({ workflow: { test_command: 'rm -rf /' } }, FILE);
  assert.deepEqual(layer, { workflow: {} });
});

test('a non-null value warns, naming BOTH the key and the file it came from', () => {
  const { warnings } = stripGlobalOnly({ workflow: { test_command: 'rm -rf /' } }, FILE);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /workflow\.test_command/);
  assert.match(warnings[0], /\/w\/\.planning\/config\.json/);
  // and one clause the user can act on without a second lookup
  assert.match(warnings[0], /user-global config layer only/);
});

test('all three keys are stripped, one warning each - not just the first', () => {
  const { layer, warnings } = stripGlobalOnly({
    workflow: { test_command: 'a', lint_command: 'b' },
    review: { key_file: '/tmp/keys.env' },
  }, FILE);
  assert.deepEqual(layer, { workflow: {}, review: {} });
  assert.equal(warnings.length, 3);
  for (const key of GLOBAL_ONLY_KEYS) {
    assert.ok(warnings.some((w) => w.includes(`"${key}"`)), `${key}: ${JSON.stringify(warnings)}`);
  }
});

test('a null value is stripped too - the strip is value-agnostic (D-13)', () => {
  // deepMerge returns the higher layer's value for a null, so a repo `null`
  // left in place OVERRIDES the user-global value. templates/config.json ships
  // all three at null into every scaffolded repo, so leaving them would let a
  // tracked file suppress the global command.
  const { layer } = stripGlobalOnly({
    workflow: { test_command: null, lint_command: null },
    review: { key_file: null },
  }, FILE);
  assert.deepEqual(layer, { workflow: {}, review: {} });
});

test('a null value warns about NOTHING - presence is not setting (D-13)', () => {
  // The shape templates/config.json ships. Warning here would fire on three
  // untouched keys at a new project's first command.
  const { warnings } = stripGlobalOnly({
    workflow: { test_command: null, lint_command: null },
    review: { key_file: null },
  }, FILE);
  assert.deepEqual(warnings, []);
});

test('an empty string IS a set value: stripped and warned about', () => {
  // `config.mjs set workflow.test_command=` writes "", which the one prose
  // reader treats as nothing to run - but it is a value the file chose, not the
  // absence templates/config.json ships.
  const { layer, warnings } = stripGlobalOnly({ workflow: { test_command: '' } }, FILE);
  assert.deepEqual(layer, { workflow: {} });
  assert.equal(warnings.length, 1);
});

test('a layer setting none of them is returned untouched and silent', () => {
  const input = { workflow: { research: true }, git: { auto_close: true } };
  const { layer, warnings } = stripGlobalOnly(input, FILE);
  assert.deepEqual(layer, input);
  assert.deepEqual(warnings, []);
});

test('sibling keys under the same parent survive the strip', () => {
  const { layer } = stripGlobalOnly({
    workflow: { research: true, test_command: 'x', max_plan_tasks: 8 },
  }, FILE);
  assert.deepEqual(layer, { workflow: { research: true, max_plan_tasks: 8 } });
});

test('the input object is never mutated - the strip returns a COPY', () => {
  // mergeLayers publishes the parsed layer as `layers.repo`, whose documented
  // job is to carry what the FILE said.
  const input = { workflow: { test_command: 'x' } };
  stripGlobalOnly(input, FILE);
  assert.deepEqual(input, { workflow: { test_command: 'x' } });
});

test('a non-object layer is handed back as-is, never a throw', () => {
  // mergeLayers guards this itself, but the lib runs on whatever a user's
  // config happens to hold.
  for (const v of [null, undefined, 7, 'x', [1, 2]]) {
    const { layer, warnings } = stripGlobalOnly(v, FILE);
    assert.deepEqual(layer, v);
    assert.deepEqual(warnings, []);
  }
});

test('a scalar PARENT is stripped: it would replace the global section wholesale', () => {
  // The second way a repo layer reaches these keys, and it sets none of them.
  // deepMerge replaces scalars and arrays wholesale, so `{"workflow":"x"}` takes
  // out the user-global `workflow` object entirely and every global-only key
  // under it falls back to its schema default - the suppression the strip
  // exists to prevent, arriving without touching the key at all.
  const { layer } = stripGlobalOnly({ workflow: 'nonsense', review: [1, 2] }, FILE);
  assert.deepEqual(layer, {});
});

test('a scalar parent warns, naming the section, the file and the keys it hid', () => {
  const { warnings } = stripGlobalOnly({ workflow: 'nonsense' }, FILE);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"workflow"/);
  assert.match(warnings[0], /\/w\/\.planning\/config\.json/);
  assert.match(warnings[0], /workflow\.test_command/);
  assert.match(warnings[0], /workflow\.lint_command/);
});

test('a scalar parent warns ONCE, not once per key beneath it', () => {
  // Two global-only keys live under `workflow`; one offending section is one
  // fact about the file, and the loop must not report it twice.
  const { warnings } = stripGlobalOnly({ workflow: 42 }, FILE);
  assert.equal(warnings.length, 1);
});

test('a null parent is stripped silently - presence is not setting (D-13)', () => {
  const { layer, warnings } = stripGlobalOnly({ workflow: null, review: null }, FILE);
  assert.deepEqual(layer, {});
  assert.deepEqual(warnings, []);
});

test('a section with no global-only key beneath it is left alone whatever its type', () => {
  // The ancestor rule is scoped to the protected paths: `git` carries none of
  // them, so a nonsense value there is the user's own problem to read back.
  const input = { git: 'nonsense', planning: [1] };
  const { layer, warnings } = stripGlobalOnly(input, FILE);
  assert.deepEqual(layer, input);
  assert.deepEqual(warnings, []);
});
