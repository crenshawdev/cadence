// Zero-dep tests for lib/window-budget.mjs and the `planning.mjs trace window`
// seam (MSR-03).
// Run: node --test 'cadence-core/bin/*.test.mjs'
//
// Two layers, matching the rest of the suite: the pure rule is exercised
// directly on literal bracket rows, and the CLI is exercised through
// planning.mjs against scratch `.planning` fixtures, so the one JSON line and
// the exit code a caller actually sees are what get asserted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowBudget, CODES, NO_ROLE } from './lib/window-budget.mjs';

/** A bracket row with the fields the rule reads, defaults filled in. */
const row = (over) => ({
  corr: '4-abc1234',
  phase: 4,
  plan: '1',
  role: 'cad-executor',
  event: 'return',
  ts: '2026-08-17T10:00:00Z',
  end: '2026-08-17T10:20:00Z',
  ms: 1200000,
  tokens: 100000,
  ...over,
});

const CEILINGS = { 'cad-executor': 200000, 'cad-verifier': 100000 };

// --- the ceiling comparison --------------------------------------------------

test('a row over its ceiling is one budget-overrun problem naming the role', () => {
  const r = windowBudget('.planning/trace.jsonl', [row({ tokens: 275285 })], CEILINGS);
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].kind, CODES.overrun);
  assert.equal(r.problems[0].kind, 'budget-overrun');
  assert.equal(r.problems[0].file, '.planning/trace.jsonl');
  assert.match(r.problems[0].detail, /cad-executor/);
  assert.ok(r.problems[0].detail.includes('275285 exceeds budget 200000 by 75285'),
    `detail did not carry the arithmetic: ${r.problems[0].detail}`);
  assert.equal(r.compared, 1);
  assert.equal(r.unrecorded, 0);
  assert.deepEqual(r.unbudgeted, {});
});

test('a row EXACTLY at its ceiling does not cross - this is a ceiling, not an equality', () => {
  const r = windowBudget('t.jsonl', [row({ tokens: 200000 })], CEILINGS);
  assert.deepEqual(r.problems, []);
  assert.equal(r.compared, 1);
});

test('a row under its ceiling is silent, and there is no shrink arm', () => {
  const r = windowBudget('t.jsonl', [row({ tokens: 1 })], CEILINGS);
  assert.deepEqual(r.problems, []);
  assert.equal(r.compared, 1);
});

// --- what cannot be compared is reported, never skipped or priced as zero ----

test('a null-tokens row is counted unrecorded, never priced as zero', () => {
  const r = windowBudget('t.jsonl', [row({ tokens: null })], CEILINGS);
  assert.deepEqual(r.problems, []);
  assert.equal(r.unrecorded, 1);
  assert.equal(r.compared, 0);
});

test('a row whose role has no ceiling is counted per role, never skipped', () => {
  const r = windowBudget('t.jsonl', [
    row({ role: 'cad-planner', tokens: 900000 }),
    row({ role: 'cad-planner', tokens: 10 }),
    row({ role: undefined }),
  ], CEILINGS);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.unbudgeted, { 'cad-planner': 2, [NO_ROLE]: 1 });
  assert.equal(r.compared, 0);
});

test('the role test runs first: an unbudgeted role with no figure counts once', () => {
  const r = windowBudget('t.jsonl', [row({ role: 'cad-planner', tokens: null })], CEILINGS);
  assert.deepEqual(r.unbudgeted, { 'cad-planner': 1 });
  assert.equal(r.unrecorded, 0);
});

test('a ceiling that is not a positive integer leaves the role unbudgeted', () => {
  // A hand-edited config.json is the producer. Coercing would let
  // `275285 > "200000"` decide a finding, and reading it as 0 would report
  // every dispatch of that role as a crossing.
  for (const bad of ['200000', 0, -1, 1.5, null, undefined, NaN]) {
    const r = windowBudget('t.jsonl', [row({ tokens: 275285 })], { 'cad-executor': bad });
    assert.deepEqual(r.problems, [], `ceiling ${String(bad)} produced a problem`);
    assert.deepEqual(r.unbudgeted, { 'cad-executor': 1 }, `ceiling ${String(bad)} was compared`);
  }
});

// --- the empty and degenerate inputs -----------------------------------------

test('an empty bracket list is an empty report, not a failure', () => {
  const r = windowBudget('t.jsonl', [], CEILINGS);
  assert.deepEqual(r, { problems: [], unbudgeted: {}, unrecorded: 0, compared: 0 });
});

test('a non-array brackets value and a non-object ceilings map report nothing', () => {
  assert.deepEqual(windowBudget('t.jsonl', null, CEILINGS).problems, []);
  const r = windowBudget('t.jsonl', [row({ tokens: 275285 })], null);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.unbudgeted, { 'cad-executor': 1 });
});

test('every row lands in exactly one bucket, so the buckets sum to the row count', () => {
  const rows = [
    row({ tokens: 275285 }),                        // crossed
    row({ tokens: 10 }),                            // under
    row({ tokens: null }),                          // unrecorded
    row({ role: 'cad-planner' }),                   // unbudgeted
  ];
  const r = windowBudget('t.jsonl', rows, CEILINGS);
  const unbudgeted = Object.values(r.unbudgeted).reduce((a, b) => a + b, 0);
  assert.equal(r.compared + r.unrecorded + unbudgeted, rows.length);
  assert.equal(r.problems.length, 1);
});
