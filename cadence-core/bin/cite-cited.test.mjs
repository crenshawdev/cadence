// The cited-side grammar in lib/cite-cited.mjs (RBK-01).
// Run: node --test cadence-core/bin/cite-cited.test.mjs
// A unit table beside the seam-level `cite-count` cases in planning.test.mjs,
// the convention lease-grammar.test.mjs states. Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citedMentions } from './lib/cite-cited.mjs';

/** The scope one mention resolved to, for a plan whose own phase is `own`. */
const scope = (text, own = '2') => citedMentions(text, own).map((m) => `${m.number}@${m.phase}`);

test('a bare D-NN is scoped to the plan\'s OWN phase (D-10)', () => {
  assert.deepEqual(scope('Locked by CONTEXT: D-08 puts the reader here.'), ['D-08@2']);
});

/**
 * The four qualified spellings MEASURED on this corpus - 23 of 1028 mentions -
 * each with the phase it names. A rule that admitted three of them would report
 * the fourth against the wrong phase's decision numbers, silently.
 */
const QUALIFIED = [
  ['phase 2 D-02', 'D-02', '2'],
  ['`phases/1/CONTEXT.md` D-13', 'D-13', '1'],
  ['`phases/5/CONTEXT.md`: D-01', 'D-01', '5'],
  ['`phases/2/CONTEXT.md`\'s D-01', 'D-01', '2'],
];

test('each of the four measured qualified spellings scopes to the phase it names', () => {
  for (const [text, number, phase] of QUALIFIED) {
    // Own phase 9, so a spelling the grammar failed to read reports 9 and the
    // row fails rather than accidentally agreeing with the plan's own phase.
    assert.deepEqual(scope(`The plan says ${text} applies.`, '9'), [`${number}@${phase}`],
      `qualified spelling: ${text}`);
  }
});

test('the curly-apostrophe possessive is the same spelling', () => {
  assert.deepEqual(scope('`phases/4/CONTEXT.md`’s D-07 applies.', '9'), ['D-07@4']);
});

test('a phase named several words earlier does NOT capture the mention', () => {
  // The falsifier for a widened qualifier: an unrelated phase number back in
  // the sentence must not bind, or the collision rule D-10 exists to close
  // comes back through the qualifier instead of through the number.
  assert.deepEqual(
    scope('In phase 5 the executor recorded a deviation, and D-01 says otherwise.'),
    ['D-01@2']);
  assert.deepEqual(scope('`phases/5/CONTEXT.md` states that D-01 was wrong.'), ['D-01@2']);
});

test('a D-NN inside a fenced block is still a mention (D-09)', () => {
  const text = 'Prose D-01.\n\n```\nnode x.mjs --note "D-08 the fenced one"\n```\n\nMore D-03.\n';
  assert.deepEqual(scope(text), ['D-01@2', 'D-08@2', 'D-03@2']);
});

test('the number shape is the one parseContextDecisions accepts', () => {
  assert.deepEqual(scope('see D-2.1 and D-13 and D-007'), ['D-2.1@2', 'D-13@2', 'D-007@2']);
});

test('a D-NN glued to a preceding word is not a mention', () => {
  assert.deepEqual(scope('AD-08 and TD-01 and xD-05 name nothing here'), []);
});

test('mentions are NOT deduplicated and stay in document order', () => {
  // .planning/phases/1/PLAN-2.md:285 is the measured line standing for two
  // distinct surfaced rows, so the caller owns the arithmetic.
  assert.deepEqual(scope('D-01 and D-01 again, then phase 3 D-01.'),
    ['D-01@2', 'D-01@2', 'D-01@3']);
});

test('the look-back window is per mention, not per file', () => {
  // A qualifier far enough back is not a qualifier. The bound is what keeps the
  // scan constant-work per mention on caller-authored text.
  const far = `phase 7${' '.repeat(400)}D-01`;
  assert.deepEqual(scope(far), ['D-01@2']);
});

test('a plan\'s own phase spelling is carried verbatim', () => {
  assert.deepEqual(scope('D-01 here', '1.10'), ['D-01@1.10']);
  assert.deepEqual(scope('D-01 here', 3), ['D-01@3']);
});

test('unusable input is an empty answer, never a throw', () => {
  for (const text of [undefined, null, 42, '', {}, []]) {
    assert.deepEqual(citedMentions(text, '2'), [], `${JSON.stringify(text)} answers empty`);
  }
  assert.deepEqual(citedMentions('D-01', null), [{ number: 'D-01', phase: '' }],
    'an unusable own-phase leaves the scope empty rather than guessing one');
});
