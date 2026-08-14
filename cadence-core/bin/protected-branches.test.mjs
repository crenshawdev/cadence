// Unit tests for lib/protected-branches.mjs (COR-01, AC1). Pure function, no
// fixtures: the four seams that consume it each keep their OWN string-form arm
// against their own seam (git-guard.test.mjs, git-publish.test.mjs,
// git-branch.test.mjs, land-cleanup.test.mjs), because a coercion proved only
// here is not proved to reach a decision.
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
