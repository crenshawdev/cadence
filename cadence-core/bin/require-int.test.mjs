// Reference-value tests for lib/require-int.mjs. Run: node --test cadence-core/bin/require-int.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireInt, requireCursorNumber, requirePhaseArg } from './lib/require-int.mjs';

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

// --- the safe range is part of the grammar (ARG-04) --------------------------

const PAST_SAFE = '9007199254740993'; // Number() of this is ...992, a different number
const FOUR_HUNDRED_DIGITS = '9'.repeat(400); // Number() of this is Infinity

test('requireInt: refuses a value past the safe-integer range', () => {
  // Before the guard this answered { ok: true, value: 9007199254740992 } - the
  // flag reader handing `--total`/`--attempt`/`--turns` a number nobody typed.
  assert.deepEqual(requireInt(PAST_SAFE), { ok: false });
  assert.deepEqual(requireInt(FOUR_HUNDRED_DIGITS), { ok: false });
  assert.deepEqual(requireInt(String(Number.MAX_SAFE_INTEGER)), {
    ok: true,
    value: Number.MAX_SAFE_INTEGER,
  });
});

test('requireCursorNumber: refuses a value past the safe-integer range in both forms', () => {
  for (const opts of [{}, { decimal: true }]) {
    assert.deepEqual(requireCursorNumber(PAST_SAFE, opts), { ok: false }, JSON.stringify(opts));
    assert.deepEqual(requireCursorNumber(FOUR_HUNDRED_DIGITS, opts), { ok: false }, JSON.stringify(opts));
  }
  // The bound is a bound, not a narrowing: the shapes the cursor file holds
  // still read exactly as they did.
  assert.deepEqual(requireCursorNumber('4'), { ok: true, value: 4 });
  assert.deepEqual(requireCursorNumber('2.1', { decimal: true }), { ok: true, value: 2.1 });
});

test('requirePhaseArg: refuses a value past the safe-integer range', () => {
  assert.deepEqual(requirePhaseArg(PAST_SAFE), { ok: false });
  assert.deepEqual(requirePhaseArg(FOUR_HUNDRED_DIGITS), { ok: false });
});

test('requirePhaseArg: the spellings the range guard must NOT touch still read', () => {
  assert.deepEqual(requirePhaseArg('2.1'), { ok: true, raw: '2.1', value: 2.1 });
  assert.deepEqual(requirePhaseArg('1.10'), { ok: true, raw: '1.10', value: 1.1 });
  assert.deepEqual(requirePhaseArg('08'), { ok: true, raw: '08', value: 8 });
});
