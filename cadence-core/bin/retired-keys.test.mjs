// Tests for lib/retired-keys.mjs - the retired-vocabulary map both config
// faces read. Run: node --test cadence-core/bin/retired-keys.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test()
// with a sequential loop reports the loop's count, not the rows', so a row that
// never ran still looks green (prior-project finding, CAPTURE.md).
// Only node: builtins, no subprocess - the lib is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETIRED_KEYS, retiredKeyError, retiredKeysIn } from './lib/retired-keys.mjs';

// --- retiredKeyError: the write face ------------------------------------------

test('model.profile names its replacement key and all three stakes values', () => {
  const e = retiredKeyError('model.profile');
  assert.match(e, /use "stakes"/);
  assert.match(e, /solo/);
  assert.match(e, /shipped/);
  assert.match(e, /critical/);
});

test('model.auto.escalate_on_failure names the promoted key', () => {
  assert.match(retiredKeyError('model.auto.escalate_on_failure'),
    /use "model\.escalate_on_failure"/);
});

test('model.auto.ceiling reads as a removal, naming no replacement key', () => {
  const e = retiredKeyError('model.auto.ceiling');
  assert.match(e, /retired in v2\.0\.0/);
  assert.match(e, /removed with the `auto` mode/);
  assert.doesNotMatch(e, /use "/);   // nothing took its place
});

test('model.auto.max_escalations reads as a removal, naming no replacement key', () => {
  const e = retiredKeyError('model.auto.max_escalations');
  assert.match(e, /retired in v2\.0\.0/);
  assert.match(e, /retry rung its own routing cell names/); // why there is no second step to cap
  assert.doesNotMatch(e, /use "/);
});

test('a live key is not retired: stakes and workflow.research both return null', () => {
  assert.equal(retiredKeyError('stakes'), null);
  assert.equal(retiredKeyError('workflow.research'), null);
});

test('a non-string key never throws and is not retired', () => {
  for (const k of [undefined, null, 5, {}, ['model.profile']]) {
    // @ts-expect-error - deliberately off-grammar input
    assert.equal(retiredKeyError(k), null, String(k));
  }
});

test('RETIRED_KEYS is frozen, so a caller cannot edit the shared map', () => {
  assert.equal(Object.isFrozen(RETIRED_KEYS), true);
  assert.equal(Object.isFrozen(RETIRED_KEYS['model.profile']), true);
});

test('review.triggers.pre_ship.gate reads as a removal naming the milestone', () => {
  const e = retiredKeyError('review.triggers.pre_ship.gate');
  assert.match(e, /retired in v3\.2\.0/);
  assert.match(e, /risk_surface/);          // what still gates the close
  assert.doesNotMatch(e, /use "/);          // nothing took its place
});

test('review.triggers.pre_ship.tier and .effort each name v3.2.0 too', () => {
  for (const k of ['review.triggers.pre_ship.tier', 'review.triggers.pre_ship.effort']) {
    assert.match(retiredKeyError(k), /retired in v3\.2\.0/, k);
  }
});

// --- retiredKeysIn: the read faces --------------------------------------------

test('a config that set the pre-ship gate gets a v3.2.0 warning, not unrecognized-key', () => {
  // This repo's own .planning/config.json carried `review.triggers.pre_ship.gate`
  // until the trigger was deleted, so the upgrade path is not hypothetical.
  const w = retiredKeysIn({ review: { triggers: { pre_ship: { gate: 'off' } } } });
  assert.equal(w.length, 1, JSON.stringify(w));
  assert.match(w[0], /review\.triggers\.pre_ship\.gate/);
  assert.match(w[0], /v3\.2\.0/);
});

test('a config still holding model.profile warns exactly once, naming both keys', () => {
  const w = retiredKeysIn({ model: { profile: 'balanced' } });
  assert.equal(w.length, 1);
  assert.match(w[0], /model\.profile/);
  assert.match(w[0], /stakes/);
});

test('the presence of the key is the fault, whatever value it holds', () => {
  // D-09: a retired KEY fails worse than a retired value - it resolves at the
  // default and reports a configured layer. So the check is value-agnostic.
  for (const v of [null, false, 0, '', 'balanced']) {
    assert.equal(retiredKeysIn({ model: { profile: v } }).length, 1, JSON.stringify(v));
  }
});

test('two retired auto keys yield two warnings, one each', () => {
  const w = retiredKeysIn({ model: { auto: { ceiling: 'quality', max_escalations: 1 } } });
  assert.equal(w.length, 2, JSON.stringify(w));
  assert.match(w.join(' '), /model\.auto\.ceiling/);
  assert.match(w.join(' '), /model\.auto\.max_escalations/);
});

test('a live v2 config warns about nothing', () => {
  assert.deepEqual(retiredKeysIn({ stakes: 'shipped', model: { escalate_on_failure: true } }), []);
});

test('a scalar at an intermediate segment yields no match and no throw', () => {
  assert.deepEqual(retiredKeysIn({ model: 5 }), []);
  assert.deepEqual(retiredKeysIn({ model: { auto: 'yes' } }), []);
  assert.deepEqual(retiredKeysIn({ model: null }), []);
});

test('an array at an intermediate segment yields no match and no throw', () => {
  assert.deepEqual(retiredKeysIn({ model: ['profile'] }), []);
  assert.deepEqual(retiredKeysIn({ model: { auto: ['ceiling'] } }), []);
});

test('a null or non-object config yields an empty list', () => {
  assert.deepEqual(retiredKeysIn(null), []);
  assert.deepEqual(retiredKeysIn(undefined), []);
  assert.deepEqual(retiredKeysIn([1, 2]), []);
  assert.deepEqual(retiredKeysIn(42), []);
  assert.deepEqual(retiredKeysIn('model.profile'), []);
});
