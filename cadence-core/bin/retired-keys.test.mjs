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

// --- ARG-05: a prototype member is not a retirement ---------------------------

test('every Object.prototype member reads as not-retired, never as a v2.0.0 removal', () => {
  // RETIRED_KEYS is a plain frozen object, so a bare `RETIRED_KEYS[key]` answered
  // any of these with Object.prototype itself - truthy, with `since`,
  // `replacement` and `detail` all undefined - and `config.mjs check
  // '__proto__=1'` reported `retired in v2.0.0: undefined`. That is a WRONG
  // diagnostic rather than a missing one: it names a retirement that never
  // happened and sends the user looking for a replacement.
  //
  // The set is WALKED rather than hand-listed (D-13): `__defineGetter__` and its
  // three siblings sit beside the obvious `constructor` / `toString` / `valueOf`,
  // and a hand-list is how the next member the language adds stops being covered.
  const members = Object.getOwnPropertyNames(Object.prototype);
  assert.ok(members.length >= 12, JSON.stringify(members));
  for (const k of members) assert.equal(retiredKeyError(k), null, k);
});

test('the guard costs the vocabulary nothing: a real retirement still reports since, replacement and detail', () => {
  // CONTEXT's flagged assumption, settled: `Object.hasOwn` changes nothing for a
  // key that IS retired, because every row is an own property of the frozen
  // literal. Checked on a row carrying all three fields at once - a non-default
  // `since` would have read as v2.0.0, and a dropped `detail` as `undefined`.
  const withReplacement = retiredKeyError('model.auto.escalate_on_failure');
  assert.match(withReplacement, /^retired in v2\.0\.0: /);          // its own since
  assert.match(withReplacement, /use "model\.escalate_on_failure" instead/);
  assert.match(withReplacement, /honoured at every stakes level/);   // its own detail
  assert.doesNotMatch(withReplacement, /undefined/);

  // And a row whose `since` is NOT the v2.0.0 default, with no replacement.
  const removed = retiredKeyError('workflow.subagent_timeout');
  assert.match(removed, /^retired in v2\.7\.0: /);
  assert.match(removed, /workflow\.max_plan_tasks/);                 // its own detail
  assert.doesNotMatch(removed, /undefined/);
});
