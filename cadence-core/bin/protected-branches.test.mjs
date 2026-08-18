// Unit tests for lib/protected-branches.mjs (COR-01, AC1). Pure function, no
// fixtures: the five seams that consume it each keep their OWN string-form arm
// against their own seam (git-guard.test.mjs, git-publish.test.mjs,
// git-branch.test.mjs, land-cleanup.test.mjs, issue-check.test.mjs), because a
// coercion proved only here is not proved to reach a decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';

test('an array passes through unchanged', () => {
  assert.deepEqual(resolveProtectedBranches({ protected_branches: ['release'] }), ['release']);
  assert.deepEqual(
    resolveProtectedBranches({ protected_branches: ['main', 'trunk', 'release'] }),
    ['main', 'trunk', 'release']);
});

test('an EMPTY array still means nothing is protected (D-09)', () => {
  // Never a fallback to ['main','master']: emptying the list is the user
  // saying something, and re-protecting main behind their back is the silent
  // revert this helper exists to prevent.
  assert.deepEqual(resolveProtectedBranches({ protected_branches: [] }), []);
});

test('a lone string names the branch the user means to protect (#38)', () => {
  assert.deepEqual(resolveProtectedBranches({ protected_branches: 'release' }), ['release']);
});

// GRD-01 / AC1, one assertion per row. The grammar is ONE predicate over both
// spellings (D-01): a value that reads as configured but names no branch is a
// typo, so it falls to the default rather than to a list that protects nothing
// (D-02). `[]` is the one input that keeps its own answer, because it named
// nothing on purpose.
test('a string that names no branch falls to the default (GRD-01, D-02)', () => {
  assert.deepEqual(resolveProtectedBranches({ protected_branches: '' }), ['main', 'master']);
  assert.deepEqual(resolveProtectedBranches({ protected_branches: ' ' }), ['main', 'master']);
  assert.deepEqual(resolveProtectedBranches({ protected_branches: '\t\n' }), ['main', 'master']);
});

test('an array whose entries all name no branch falls to the default (GRD-01, D-01)', () => {
  // [''] is byte-identical to what the string '' used to produce, reached by
  // the other spelling - the same hole, so the same answer.
  assert.deepEqual(resolveProtectedBranches({ protected_branches: [''] }), ['main', 'master']);
  assert.deepEqual(resolveProtectedBranches({ protected_branches: ['', ' '] }), ['main', 'master']);
  assert.deepEqual(resolveProtectedBranches({ protected_branches: [null, 7] }), ['main', 'master']);
});

test('an array keeps the entries that DO name a branch (GRD-01, D-01)', () => {
  assert.deepEqual(resolveProtectedBranches({ protected_branches: ['', 'main'] }), ['main']);
  assert.deepEqual(
    resolveProtectedBranches({ protected_branches: ['main', '', null, 'release'] }),
    ['main', 'release']);
});

test('a surviving entry is kept as the user spelled it, never rewritten', () => {
  // The predicate decides what is KEPT, not what it is spelled as: trimming
  // here would be a second behaviour, and git is what judges a branch name.
  assert.deepEqual(resolveProtectedBranches({ protected_branches: [' main '] }), [' main ']);
  assert.deepEqual(resolveProtectedBranches({ protected_branches: ' release ' }), [' release ']);
});

test('no returned list ever carries an empty or whitespace-only entry (AC1)', () => {
  // Two of the five readers index [0] for a BASE REF, so an entry naming no
  // branch becomes `git branch --merged ""` and `git log ..HEAD` - queries
  // that answer emptily and successfully instead of failing.
  const inputs = [undefined, null, 7, true, {}, '', ' ', 'release', [], [''],
    ['', 'main'], ['main', 'master'], [null], [' main ']];
  for (const value of inputs) {
    for (const entry of resolveProtectedBranches({ protected_branches: value })) {
      assert.ok(typeof entry === 'string' && entry.trim() !== '',
        `input ${JSON.stringify(value)} returned entry ${JSON.stringify(entry)}`);
    }
  }
});

test('every other shape falls back to the default list', () => {
  for (const value of [undefined, null, 7, true, { main: true }]) {
    assert.deepEqual(resolveProtectedBranches({ protected_branches: value }),
      ['main', 'master'], `shape ${JSON.stringify(value)}`);
  }
  assert.deepEqual(resolveProtectedBranches({}), ['main', 'master']);
});

test('a missing git block is the default, never a throw', () => {
  // git-guard.mjs is a PreToolUse hook that swallows every throw, so a helper
  // that threw here would make the guard silently stop guarding.
  assert.deepEqual(resolveProtectedBranches(undefined), ['main', 'master']);
  assert.deepEqual(resolveProtectedBranches(null), ['main', 'master']);
});
