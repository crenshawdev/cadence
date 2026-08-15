// Grammar tests for lib/risk-diff.mjs and the `risk-check` seam that feeds it -
// whether a committed RANGE touched a risk surface, and the record that says so
// was written.
// Run: node --test cadence-core/bin/risk-diff.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test()
// with a sequential loop reports the loop's count, not the rows', so a row that
// never ran still looks green (prior-project finding, CAPTURE.md).
//
// The subject is one rule (RSK-01/RSK-02): the answer is always computed and
// always recorded, so "the detection step was skipped" stops being readable as
// "it ran and matched nothing". Several rows below are about the states the
// scan declines to collapse - a binary file, an unreadable body - because those
// are the half a later "simplification" would fold into `matches: []`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanDiff } from './lib/risk-diff.mjs';
import { CATEGORIES } from './lib/surface-scan.mjs';

const ALL = [...CATEGORIES];

/** A one-file unified diff with the given added lines. */
const diffOf = (path, added) => `diff --git a/${path} b/${path}\n`
  + `index 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n`
  + `@@ -1,2 +1,${1 + added.length} @@\n unchanged context line\n`
  + `${added.map((l) => `+${l}`).join('\n')}\n`;

// --- the pure lib -------------------------------------------------------------

test('a risky range matches a category and names the signal that found it', () => {
  const r = scanDiff(diffOf('src/auth/login.ts',
    ['const claims = jwt.verify(raw, KEY);']), ALL);
  assert.equal(r.checked, true);
  assert.ok(r.matches.length >= 1, 'a JWT verify under src/auth matched nothing');
  for (const m of r.matches) {
    assert.ok(ALL.includes(m.category), `${m.category} is not one of the eight tokens`);
    assert.ok(typeof m.signal === 'string' && m.signal,
      `the ${m.category} match names no signal`);
  }
  assert.ok(r.matches.some((m) => m.category === 'auth'));
});

test('a clean range is judged clean: no matches, and not inconclusive', () => {
  const r = scanDiff(diffOf('docs/notes.md', ['A paragraph about the roadmap.']), ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.inconclusive, false);
  assert.equal(r.checked, true);
  assert.deepEqual(r.categories, ALL);
});

test('a binary-only range is inconclusive, never collapsed into a clean answer', () => {
  // The state this seam exists for. Git rendered the change as bytes, so the
  // scan cannot judge it - reporting `matches: []` alone would hand the caller
  // a cleared range it never read.
  const r = scanDiff('diff --git a/logo.png b/logo.png\n'
    + 'index 1111111..2222222 100644\n'
    + 'Binary files a/logo.png and b/logo.png differ\n', ALL);
  assert.equal(r.checked, true);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.matches, []);
});

test('an empty body is `checked: false`, and that implies inconclusive', () => {
  const r = scanDiff('', ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.matches, []);
});

test('a substring is not a path signal: src/authority.rs is not `auth`', () => {
  // The rule cmdLeaseCheck already states for declared paths, held here for
  // detection: whole segments only, or `src/auth` licenses `src/authority.rs`.
  const r = scanDiff(diffOf('src/authority.rs', ['pub fn rank(x: u32) -> u32 { x + 1 }']), ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.checked, true);
});

test('a null body returns a record rather than throwing', () => {
  const r = scanDiff(null, ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.matches, []);
});

test('a scalar body returns a record rather than throwing', () => {
  const r = scanDiff(42, ALL);
  assert.equal(r.checked, false);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.categories, ALL);
});

test('a partly-binary range that also matched reports BOTH, not one or the other', () => {
  // `inconclusive` is independent of `matches`: collapsing either into the
  // other loses the half the caller has to act on.
  const r = scanDiff(`${diffOf('db/migrations/003_add_column.sql', ['ALTER TABLE users ADD COLUMN kind text;'])}`
    + 'diff --git a/logo.png b/logo.png\n'
    + 'Binary files a/logo.png and b/logo.png differ\n', ALL);
  assert.equal(r.inconclusive, true);
  assert.ok(r.matches.some((m) => m.category === 'migrations'));
});

test('the vocabulary is the CALLER\'s: a category outside it is never reported', () => {
  const r = scanDiff(diffOf('src/auth/login.ts', ['const c = jwt.verify(raw, KEY);']),
    ['migrations', 'billing']);
  assert.deepEqual(r.categories, ['migrations', 'billing']);
  assert.deepEqual(r.matches.map((m) => m.category).filter((c) => c === 'auth'), []);
});

test('context lines are not an input - only added and removed lines are read', () => {
  // A `DROP TABLE` sitting UNCHANGED beside an edit is the code the range did
  // not touch. Matching it would fire the one blocking gate on every neighbour
  // of every edit.
  const body = 'diff --git a/src/report.ts b/src/report.ts\n'
    + 'index 1111111..2222222 100644\n--- a/src/report.ts\n+++ b/src/report.ts\n'
    + '@@ -1,3 +1,3 @@\n const sql = "DROP TABLE users";\n-const n = 1;\n+const n = 2;\n';
  const r = scanDiff(body, ALL);
  assert.deepEqual(r.matches, []);
  assert.equal(r.inconclusive, false);
});
