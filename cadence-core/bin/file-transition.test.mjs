// The stated table for lib/file-transition.mjs (JRN-01).
// Run: node --test cadence-core/bin/file-transition.test.mjs
//
// The module runs an ordered step list and keeps a completed/failed record, so
// every case below is built from THUNKS THAT RECORD what they did rather than
// from a mock: a side-effect counter is the only way to prove that a step which
// reports nothing also RAN nothing, which is the whole content of the
// stop-at-first-failure arm.
//
// The module touches no filesystem, so the cases here need none either.
// Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTransition } from './lib/file-transition.mjs';

/**
 * Three steps whose keys are `'a'`, `'b'`, `'c'`, each pushing its own key
 * onto `ran` when its thunk is entered. `throwsAt` names the key whose thunk
 * throws AFTER recording that it ran - a step that failed still ran.
 */
function threeSteps(ran, throwsAt = null) {
  return ['a', 'b', 'c'].map((key) => [key, () => {
    ran.push(key);
    if (key === throwsAt) throw new Error(`${key} failed`);
  }]);
}

test('stop-at-first-failure: the failing step is the last thing that runs', () => {
  const ran = [];
  const r = runTransition({ steps: threeSteps(ran, 'b'), discipline: 'stop-at-first-failure' });

  assert.equal(r.ok, false);
  assert.equal(r.refused, null, 'a step failure is not a pre-flight refusal');
  assert.deepEqual(r.completed, ['a']);
  assert.equal(r.failures.length, 1, 'the stop arm records at most one failure');
  assert.equal(r.failures[0].key, 'b');
  assert.match(r.failures[0].error.message, /b failed/);
  // The side-effect counter, not the result, is what proves step three never
  // ran: an absent key in `completed` is equally consistent with a thunk that
  // ran and threw.
  assert.deepEqual(ran, ['a', 'b'], "step three's thunk must never have been entered");
});

test('continue-past-failure: every thunk is attempted and the failures keep loop order', () => {
  const ran = [];
  const r = runTransition({ steps: threeSteps(ran, 'b'), discipline: 'continue-past-failure' });

  assert.equal(r.ok, false);
  assert.equal(r.refused, null);
  assert.deepEqual(r.completed, ['a', 'c']);
  assert.deepEqual(r.failures.map((f) => f.key), ['b']);
  assert.match(r.failures[0].error.message, /b failed/);
  assert.deepEqual(ran, ['a', 'b', 'c']);
});

test('the error is carried AS THROWN, never stringified inside the module', () => {
  // Both callers render the caught value themselves and their wordings differ
  // (`String(e)` in one, bare `e` in the other), so the value has to arrive
  // intact - including when what was thrown is not an Error at all.
  const thrown = { code: 'ENOTEMPTY', message: 'dest already exists' };
  const r = runTransition({
    steps: [['only', () => { throw thrown; }]],
    discipline: 'stop-at-first-failure',
  });
  assert.strictEqual(r.failures[0].error, thrown);
});

for (const discipline of ['stop-at-first-failure', 'continue-past-failure']) {
  test(`all three steps succeeding reports every key completed (${discipline})`, () => {
    const ran = [];
    const r = runTransition({ steps: threeSteps(ran), discipline });

    assert.equal(r.ok, true);
    assert.equal(r.refused, null);
    assert.deepEqual(r.completed, ['a', 'b', 'c']);
    assert.deepEqual(r.failures, []);
    assert.deepEqual(ran, ['a', 'b', 'c']);
  });
}

test('an empty step list succeeds with nothing completed', () => {
  const r = runTransition({ steps: [], discipline: 'stop-at-first-failure' });
  assert.equal(r.ok, true);
  assert.equal(r.refused, null);
  assert.deepEqual(r.completed, []);
  assert.deepEqual(r.failures, []);
});

test('an object key comes back by IDENTITY, never as a clone', () => {
  // planning.test.mjs deep-equals `renumber`'s `completed` against op OBJECTS,
  // so a structural clone would pass that assertion while changing what the
  // envelope actually carries. strictEqual is what reddens on the clone.
  const rm = { rm: 'phases/1' };
  const move = { git_mv: ['phases/2', 'phases/1'] };
  const r = runTransition({
    steps: [[rm, () => {}], [move, () => { throw new Error('mv failed'); }]],
    discipline: 'stop-at-first-failure',
  });
  assert.strictEqual(r.completed[0], rm);
  assert.strictEqual(r.failures[0].key, move);
});
