// The surfaced-set rules in lib/cite-surfaced.mjs (RBK-01).
// Run: node --test cadence-core/bin/cite-surfaced.test.mjs
// This tree's convention for a stated rule is a unit table beside the seam-level
// cases (lease-grammar.test.mjs says so in its own header): the rows here are
// the rule, and the `cite-count` cases in planning.test.mjs prove the seam
// reaches it. Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfacedRows, SURFACED_KINDS } from './lib/cite-surfaced.mjs';

/** A recall result row, in the `{score, source, phase?, snippet}` shape recall returns. */
const row = (source, snippet, extra = {}) => ({ score: 1, source, snippet, ...extra });

test('own-phase rows are dropped and archived same-numbered rows are kept (D-04)', () => {
  // ONE payload proving BOTH directions at phase 2, so a rule that dropped both
  // or kept both fails here rather than passing half of AC2.
  const { rows } = surfacedRows({
    results: [
      row('phases/2/CONTEXT.md', 'D-01 (own): the phase being planned'),
      row('_archive-v3.5.0/2/CONTEXT.md', 'D-01 (archived dir): a retired same-numbered phase'),
      row('v3.5.3/phases/2/CONTEXT.md', 'D-01 (archive residue): a retired same-numbered phase'),
    ],
  }, '2');
  assert.deepEqual(rows.map((r) => r.source),
    ['_archive-v3.5.0/2/CONTEXT.md', 'v3.5.3/phases/2/CONTEXT.md'],
    'the queried phase\'s own CONTEXT is excluded; both archived spellings of the same number stay');
});

test('own-phase exclusion is the caller\'s SPELLING, not the number', () => {
  // `requirePhaseArg` returns the caller's own spelling and the directory is
  // addressed with it, so `phases/1.10/` and `phases/1.1/` are different phases.
  const { rows } = surfacedRows({
    results: [row('phases/1.10/CONTEXT.md', 'D-01 (a): x'), row('phases/1.1/CONTEXT.md', 'D-01 (b): y')],
  }, '1.10');
  assert.deepEqual(rows.map((r) => r.source), ['phases/1.1/CONTEXT.md']);
});

test('a prefix and not a segment search: phases/2x/ is not phase 2', () => {
  const { rows } = surfacedRows({ results: [row('phases/21/CONTEXT.md', 'D-01 (a): x')] }, '2');
  assert.deepEqual(rows.map((r) => r.source), ['phases/21/CONTEXT.md']);
});

test('the set is the bounded `results`, never `total` (D-11)', () => {
  // The reconstructed phase-1 plan-time query: 5 results against total 441.
  // Counting against `total` caps the reported rate near 1% on a set the
  // planner was never shown.
  const results = [1, 2, 3, 4, 5].map((i) => row(`phases/${i}/SUMMARY.md`, `deviation ${i}`));
  const out = surfacedRows({ results, total: 441 }, '9');
  assert.equal(out.rows.length, 5);
  assert.notEqual(out.rows.length, 441);
});

test('a CONTEXT row\'s id is read out of its own snippet head (D-02)', () => {
  const { rows } = surfacedRows({
    results: [row('phases/1/CONTEXT.md', 'D-09 (deviation edge): the plan asserted X')],
  }, '2');
  assert.equal(rows[0].kind, 'decision');
  assert.equal(rows[0].id, 'phases/1/CONTEXT.md#D-09');
  assert.equal(rows[0].number, 'D-09');
  assert.equal(rows[0].phase, '1', 'the phase is the SOURCE\'s, not the row\'s `phase` field (D-10)');
});

test('a live and an archived D-09 stay separable ids', () => {
  const { rows } = surfacedRows({
    results: [
      row('phases/1/CONTEXT.md', 'D-09 (live): x'),
      row('v3.5.3/phases/1/CONTEXT.md', 'D-09 (archived): y'),
    ],
  }, '2');
  assert.deepEqual(rows.map((r) => r.id),
    ['phases/1/CONTEXT.md#D-09', 'v3.5.3/phases/1/CONTEXT.md#D-09']);
  assert.deepEqual(rows.map((r) => r.phase), ['1', '1']);
});

test('the decimal D-NN shape parseContextDecisions accepts is accepted here', () => {
  const { rows } = surfacedRows({
    results: [row('phases/1/CONTEXT.md', 'D-2.1 (decimal): x')],
  }, '2');
  assert.equal(rows[0].id, 'phases/1/CONTEXT.md#D-2.1');
});

test('CAPTURE, SUMMARY and UAT rows carry their kind and NO id (D-02)', () => {
  const { rows } = surfacedRows({
    results: [
      row('CAPTURE.md', 'a todo nobody numbered', { phase: 3 }),
      row('phases/1/SUMMARY.md', 'the plan asserted X, Y was true'),
      row('phases/1/UAT.md', 'item 4 expected the gate to hold'),
    ],
  }, '2');
  assert.deepEqual(rows.map((r) => r.kind), ['capture', 'deviation', 'uat']);
  for (const r of rows) {
    assert.equal(r.id, undefined, `${r.kind} carries no identifier, so its arm is unjoinable`);
    assert.equal(r.number, undefined);
  }
});

test('a decision whose snippet head is not a D-NN keeps its kind and gains no id', () => {
  // A legacy or hand-edited CONTEXT bullet. It is a surfaced decision that
  // nothing can join to, which reads as uncited rather than as absent.
  const { rows } = surfacedRows({
    results: [row('phases/1/CONTEXT.md', 'the durable decision nobody numbered')],
  }, '2');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'decision');
  assert.equal(rows[0].id, undefined);
});

test('a source naming none of the four artifacts is REPORTED, not counted into an arm', () => {
  const out = surfacedRows({
    results: [
      row('phases/1/CONTEXT.md', 'D-01 (a): x'),
      row('phases/1/NOTES.md', 'something the corpus walk does not index'),
      row('phases/1/', 'a directory'),
    ],
  }, '2');
  assert.deepEqual(out.rows.map((r) => r.source), ['phases/1/CONTEXT.md']);
  assert.deepEqual(out.unkinded, ['phases/1/NOTES.md', 'phases/1/']);
  // The headline reconciles with the breakdown precisely because the unkinded
  // rows are not in it.
  assert.equal(out.rows.length,
    SURFACED_KINDS.reduce((a, k) => a + out.rows.filter((r) => r.kind === k).length, 0));
});

test('a malformed row contributes nothing and is reported, never a throw', () => {
  // The payload is a FILE a caller wrote (D-03), so none of these is a crash.
  const out = surfacedRows({
    results: [
      null,
      'phases/1/CONTEXT.md',
      42,
      [],
      {},
      { source: '' },
      { source: 7 },
      row('phases/1/CONTEXT.md', 'D-01 (a): x'),
    ],
  }, '2');
  assert.equal(out.malformed, 7);
  assert.deepEqual(out.rows.map((r) => r.source), ['phases/1/CONTEXT.md']);
  assert.deepEqual(out.unkinded, []);
});

test('an envelope with no usable `results` is an empty answer, never a throw', () => {
  for (const envelope of [undefined, null, 42, 'x', {}, { results: null }, { results: {} },
    { backend: 'none', results: [], total: 0 }]) {
    const out = surfacedRows(envelope, '2');
    assert.deepEqual(out, { rows: [], unkinded: [], malformed: 0 },
      `${JSON.stringify(envelope)} answers empty`);
  }
});

test('an unusable phase spelling excludes nothing rather than excluding blindly', () => {
  const out = surfacedRows({ results: [row('phases/2/CONTEXT.md', 'D-01 (a): x')] }, null);
  assert.deepEqual(out.rows.map((r) => r.source), ['phases/2/CONTEXT.md']);
});

test('the arms are exactly the four the corpus walk can produce', () => {
  assert.deepEqual([...SURFACED_KINDS], ['decision', 'capture', 'deviation', 'uat']);
});
