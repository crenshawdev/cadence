// The declaration/path table for the lease grammar in lib/lease-grammar.mjs.
// Run: node --test cadence-core/bin/lease-grammar.test.mjs
// This tree's convention for a stated grammar is a unit table beside the
// seam-level cases (planning-files.test.mjs says so in its own header): the
// rows below are the grammar, and the `plan-overlap` / `lease-check` cases in
// planning.test.mjs prove the two seams reach it. Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { covers, intersects } from './lib/lease-grammar.mjs';

/** [declaration, path, covered, why] */
const COVERS = [
  ['src/a.js', 'src/a.js', true, 'a plain declaration covers the byte-identical path'],
  ['src/a.js', 'src/b.js', false, 'and nothing else'],
  ['src/', 'src/auth.js', true, 'a trailing slash is a directory lease'],
  ['src/', 'src/auth/', true, '...which covers a nested directory lease too'],
  ['src/', 'src/auth/session.js', true, '...at any depth'],
  ['src/', 'src/', true, 'a directory lease covers itself'],
  ['src/', 'srcfile.js', false, 'the slash is part of the prefix, so a sibling is not licensed'],
  ['src/auth', 'src/authority.js', false,
    'the non-substring arm: a plan declaring src/auth never licenses another plan\'s src/authority.js'],
  ['src/auth.js', 'src/', false, 'a file declaration does not cover the directory holding it'],
  ['src/a.rs (edit)', 'src/a.rs', false,
    'a non-path string matches nothing but itself - it is not a directory lease'],
];

test('covers: the declaration/path table', () => {
  for (const [declaration, path, expected, why] of COVERS) {
    assert.equal(covers(declaration, path), expected,
      `covers(${JSON.stringify(declaration)}, ${JSON.stringify(path)}) - ${why}`);
  }
});

test('intersects: symmetric on every row of the table', () => {
  // The pre-flight gate compares two DECLARATIONS and cannot know which side
  // is the directory lease, so the answer must not depend on the argument
  // order. Asymmetry here is the defect this phase closed, one layer up.
  for (const [a, b] of COVERS) {
    assert.equal(intersects(a, b), intersects(b, a),
      `intersects is not symmetric on ${JSON.stringify([a, b])}`);
  }
  assert.equal(intersects('src/', 'src/auth.js'), true);
  assert.equal(intersects('src/auth.js', 'src/'), true);
  assert.equal(intersects('src/', 'src/auth/'), true);
  assert.equal(intersects('src/auth/', 'src/'), true);
  assert.equal(intersects('src/auth', 'src/authority.js'), false);
  assert.equal(intersects('src/authority.js', 'src/auth'), false);
  assert.equal(intersects('src/a.js', 'src/b.js'), false);
});

test('a non-path string answers, it never throws', () => {
  // The task-line arm unions the raw annotated form into the same set as its
  // normalized twin (the cross-arm bridge), so non-paths arrive as a matter of
  // course. A throw here would take the whole gate down with them.
  for (const odd of ['src/a.rs (edit)', '', ' ', '{placeholder}', 'a`b.mjs', 'src/x(1)']) {
    assert.equal(typeof covers(odd, 'src/a.rs'), 'boolean', JSON.stringify(odd));
    assert.equal(typeof covers('src/', odd), 'boolean', JSON.stringify(odd));
    assert.equal(typeof intersects(odd, 'src/'), 'boolean', JSON.stringify(odd));
  }
  assert.equal(covers('src/a.rs (edit)', 'src/a.rs (edit)'), true);
});
