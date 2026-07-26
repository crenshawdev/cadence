// Reference-value tests for lib/require-int.mjs. Run: node --test cadence-core/bin/require-int.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireInt } from './lib/require-int.mjs';

test('requireInt: accepts a clean integer string', () => {
  assert.deepEqual(requireInt('4'), { ok: true, value: 4 });
});

test('requireInt: accepts a signed integer with surrounding whitespace', () => {
  assert.deepEqual(requireInt(' -2 '), { ok: true, value: -2 });
});

test('requireInt: rejects non-numeric, empty, whitespace-only, and non-integer strings', () => {
  assert.deepEqual(requireInt('abc'), { ok: false });
  assert.deepEqual(requireInt(''), { ok: false });
  assert.deepEqual(requireInt('  '), { ok: false });
  assert.deepEqual(requireInt('4.5'), { ok: false });
  assert.deepEqual(requireInt('4abc'), { ok: false });
});

test('requireInt: rejects a boolean true (valueless flag) and undefined', () => {
  assert.deepEqual(requireInt(true), { ok: false });
  assert.deepEqual(requireInt(undefined), { ok: false });
});
