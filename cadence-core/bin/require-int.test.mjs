// Reference-value tests for lib/require-int.mjs. Run: node --test cadence-core/bin/require-int.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireInt, requirePhaseArg } from './lib/require-int.mjs';

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

// --- requirePhaseArg: the spelling AND the number (D-02) ---------------------

test('requirePhaseArg: a sub-phase keeps the caller\'s own spelling', () => {
  // The defect in one line: `String(Number('1.10'))` is `'1.1'`, a DIFFERENT
  // phase's directory.
  assert.deepEqual(requirePhaseArg('1.10'), { ok: true, raw: '1.10', value: 1.1 });
});

test('requirePhaseArg: a zero-padded phase addresses phases/08, not phases/8', () => {
  assert.deepEqual(requirePhaseArg('08'), { ok: true, raw: '08', value: 8 });
});

test('requirePhaseArg: the raw spelling is trimmed', () => {
  assert.deepEqual(requirePhaseArg(' 2 '), { ok: true, raw: '2', value: 2 });
});

test('requirePhaseArg: refuses everything the cursor shape refuses', () => {
  // `1e21` is refused by the String(n) round trip inside requireCursorNumber,
  // which stays load-bearing for the arithmetic half of the result.
  for (const bad of ['1e21', '10000000000000000000000', '-1', 'abc', '', '  ', '1.2.3', '4abc']) {
    assert.deepEqual(requirePhaseArg(bad), { ok: false }, bad);
  }
  assert.deepEqual(requirePhaseArg(true), { ok: false });
  assert.deepEqual(requirePhaseArg(undefined), { ok: false });
});
