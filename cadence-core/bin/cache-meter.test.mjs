// @ts-check
// Zero-dep tests for lib/cache-meter.mjs: each loop's hit rate and the break
// rule.
// Run: node --test cadence-core/bin/cache-meter.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breaksText, EMPTY_METER, hitRate, kilo, MAIN, meterDrop, meterStep, percent } from './lib/cache-meter.mjs';

/** One request's usage: cache read, cache write, fresh input. */
const usage = (/** @type {number} */ read, /** @type {number} */ write, /** @type {number} */ fresh = 2) =>
  ({ cache_read_input_tokens: read, cache_creation_input_tokens: write, input_tokens: fresh, output_tokens: 50 });

/** Steps for one loop, in order: `[model, messages, usage]`. */
function run(/** @type {[string, number, any][]} */ steps, loop = MAIN, meter = EMPTY_METER) {
  return steps.reduce((m, [model, messages, u]) => meterStep(m, loop, model, messages, u), meter);
}

test('a first request tallies and breaks nothing', () => {
  const m = run([['opus', 3, usage(0, 17019, 3)]]);
  const loop = m.loops.get(MAIN);
  assert.deepEqual({ ...loop, prefix: undefined }, { read: 0, write: 17019, fresh: 3, calls: 1, last: 0,
    breaks: 0, lost: 0, prefix: undefined });
  assert.deepEqual(loop?.prefix, { model: 'opus', messages: 3, cached: 17019 });
  assert.equal(m.breaks, 0);
});

test('a request that reads back all its loop cached is no break', () => {
  const m = run([['opus', 3, usage(0, 17019)], ['opus', 5, usage(17019, 4920)]]);
  assert.equal(m.loops.get(MAIN)?.breaks, 0);
  assert.equal(m.breaks, 0);
  assert.equal(hitRate(m.loops.get(MAIN)), 17019 / (17019 + 17019 + 4920 + 4));
});

test('a request that reads back less than its loop cached is a break, priced by what it lost', () => {
  const m = run([['opus', 3, usage(10000, 30000)], ['opus', 5, usage(1500, 40000)]]);
  const loop = m.loops.get(MAIN);
  assert.equal(loop?.breaks, 1);
  assert.equal(loop?.lost, 40000 - 1500);
  assert.equal(m.breaks, 1);
});

test('a second break counts again and keeps the latest loss', () => {
  const m = run([['opus', 3, usage(0, 40000)], ['opus', 5, usage(0, 40000)], ['opus', 7, usage(30000, 10000)]]);
  assert.equal(m.loops.get(MAIN)?.breaks, 2);
  assert.equal(m.loops.get(MAIN)?.lost, 10000);
  assert.equal(m.breaks, 2);
});

test('a message count that dropped (compaction, /clear, rewind) starts a new prefix, no break', () => {
  const m = run([['opus', 40, usage(90000, 2000)], ['opus', 2, usage(0, 12000)], ['opus', 4, usage(12000, 800)]]);
  assert.equal(m.loops.get(MAIN)?.breaks, 0);
  assert.equal(m.breaks, 0);
});

test('a model switch starts a new prefix, no break', () => {
  const m = run([['opus', 10, usage(50000, 2000)], ['sonnet', 12, usage(0, 52000)]]);
  assert.equal(m.loops.get(MAIN)?.breaks, 0);
  assert.equal(m.breaks, 0);
});

test('loops are kept apart: an agent\'s first request is no break against main', () => {
  let m = run([['opus', 10, usage(50000, 2000)]]);
  m = run([['opus', 1, usage(0, 9000)]], 'a1', m);
  m = run([['opus', 3, usage(2000, 9000)]], 'a1', m);
  assert.equal(m.loops.get(MAIN)?.breaks, 0);
  assert.equal(m.loops.get('a1')?.breaks, 1);
  assert.equal(m.loops.get('a1')?.lost, 7000);
  assert.equal(m.breaks, 1);
});

test('a usage it cannot read leaves the meter as it was', () => {
  const m = run([['opus', 3, usage(0, 17019)]]);
  for (const bad of [null, undefined, 'x', {}, usage(NaN, 1), usage(1, -1), { ...usage(1, 1), input_tokens: '2' }]) {
    assert.equal(meterStep(m, MAIN, 'opus', 5, bad), m, String(JSON.stringify(bad)));
  }
});

test('a request with no model or message count tallies but can neither break nor be broken against', () => {
  let m = run([['opus', 3, usage(0, 40000)]]);
  m = meterStep(m, MAIN, undefined, 5, usage(0, 40000));
  assert.equal(m.loops.get(MAIN)?.breaks, 0);
  assert.equal(m.loops.get(MAIN)?.prefix, null);
  m = meterStep(m, MAIN, 'opus', 7, usage(0, 40000));
  assert.equal(m.breaks, 0);
  assert.equal(m.loops.get(MAIN)?.calls, 3);
});

test('a stopped agent\'s loop drops and its breaks stay in the session\'s', () => {
  let m = run([['opus', 1, usage(0, 9000)], ['opus', 3, usage(0, 9000)]], 'a1');
  m = meterDrop(m, 'a1');
  assert.equal(m.loops.has('a1'), false);
  assert.equal(m.breaks, 1);
  assert.equal(meterDrop(m, 'a1'), m);
  assert.equal(meterDrop(m, MAIN), m);
  assert.equal(meterDrop(m, undefined), m);
});

test('the step never touches the meter it was given', () => {
  const m = run([['opus', 3, usage(0, 17019)]]);
  const loop = m.loops.get(MAIN);
  meterStep(m, MAIN, 'opus', 5, usage(0, 17019));
  assert.equal(m.loops.get(MAIN), loop);
  assert.equal(loop?.calls, 1);
  assert.equal(EMPTY_METER.loops.size, 0);
});

test('the formats', () => {
  assert.equal(percent(null), '-');
  assert.equal(percent(0.879), '87.9%');
  assert.equal(percent(1), '100.0%');
  assert.equal(kilo(850), '850');
  assert.equal(kilo(38500), '38.5k');
  assert.equal(breaksText(1), '1 cache break');
  assert.equal(breaksText(2), '2 cache breaks');
  assert.equal(hitRate(undefined), null);
  assert.equal(hitRate(run([['opus', 1, usage(0, 0, 0)]]).loops.get(MAIN)), null);
});
