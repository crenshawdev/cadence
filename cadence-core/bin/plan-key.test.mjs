// The stated table for the worker-key grammar in lib/plan-key.mjs (RSK-03).
// Run: node --test cadence-core/bin/plan-key.test.mjs
//
// This tree's convention for a stated grammar is a unit table beside the
// seam-level cases (lease-grammar.test.mjs and planning-files.test.mjs say so
// in their own headers): the rows below ARE the grammar, one per spelling, each
// carrying the reason it exists, and the `risk-check` cases further down prove
// both faces reach it. Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requirePlanKey } from './lib/plan-key.mjs';

/** [value, accepted, why] - the grammar, stated once. */
export const PLAN_KEYS = [
  ['1', true, 'a plan number, the first-dispatch key workflows/execute.md names'],
  ['2', true, 'any plan number, not just the first'],
  ['10', true, 'more than one digit'],
  ['1-fix', true,
    'the fix-pass key a coordinator actually bracketed, and the spelling risk-check run refused'],
  ['1-cut-b', true, 'the second continuation of one plan - measured on this repo\'s own trace'],
  ['cad-verifier', true,
    'a role name: seams.md calls --bracket-plan "the worker key when it is not the role name", '
    + 'and the live trace holds 239 role-keyed events'],
  [true, false,
    'a valueless --plan: parseArgs gives it the boolean true and Number(true) is 1, so the '
    + 'answer would be recorded against plan 1 (the VAL-01 rail)'],
  [undefined, false, 'an absent value is not a key'],
  [42, false, 'a non-string of any kind, so no caller can hand this a number and be trusted'],
  ['', false, 'the empty key identifies nothing, and status groups completed ranges by it'],
  ['   ', false, 'whitespace-only is the empty key with cover'],
  [' 1', false,
    'leading whitespace: trace append stores the caller\'s string untrimmed, so " 1" and "1" '
    + 'would reach the join as two rows'],
  ['1 ', false, 'trailing whitespace, the same argument from the other end'],
  ['1\u00002', false,
    'a NUL: rowKey joins the correlation id and the plan with one, so this key can be spelled '
    + 'to collide with another row\'s identity'],
  ['1\nfix', false, 'a newline: the record and the receipt both live in append-only JSONL'],
  ['1\rfix', false, 'and the other line break, which is the same class'],
];

test('requirePlanKey: the stated table', () => {
  for (const [value, accepted, why] of PLAN_KEYS) {
    const r = requirePlanKey(value);
    assert.equal(r.ok, accepted, `requirePlanKey(${JSON.stringify(value)}) - ${why}`);
  }
});

test('an accepted key comes back VERBATIM, never normalized', () => {
  // The record `risk-check run` writes and the receipt `trace append --plan`
  // writes must be ONE spelling or the join finds nothing (D-01's stated cost).
  // A predicate that "helpfully" trimmed or lowercased would mint the second
  // spelling itself, at the one door built to stop that.
  for (const [value, accepted] of PLAN_KEYS) {
    if (!accepted) continue;
    const r = requirePlanKey(value);
    assert.equal(r.key, value, JSON.stringify(value));
  }
});

test('a refusal carries no value at all', () => {
  // Shaped like lib/require-int.mjs: a `{ok:false}` with nothing on it, so a
  // caller that forgot to check `ok` gets `undefined` rather than a plausible
  // key it can go on to write.
  for (const [value, accepted] of PLAN_KEYS) {
    if (accepted) continue;
    assert.deepEqual(requirePlanKey(value), { ok: false }, JSON.stringify(value));
  }
});
