// The stated table for lib/file-transition.mjs (JRN-01).
// Run: node --test cadence-core/bin/file-transition.test.mjs
//
// The module runs an ordered step list and keeps a completed/failed record, so
// every case below is built from THUNKS THAT RECORD what they did rather than
// from a mock: a side-effect counter is the only way to prove that a step which
// reports nothing also RAN nothing, which is the whole content of the
// stop-at-first-failure arm.
//
// The module touches no filesystem of its own. The pre-flight cases at the
// bottom still build a real tree, because "a refusal writes nothing" is only
// falsifiable against one.
// Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
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

// --- the pre-flight stage: the refusal that writes nothing -----------------
// These cases DO touch a filesystem, and deliberately so: the claim under test
// is that a refused transition leaves the tree exactly as it found it, which
// only a real tree can falsify. The module still opens nothing itself - every
// write below is inside a caller thunk that must never be entered.

/** A `.planning/`-shaped tree of three documents, each with known contents. */
function planningFixture() {
  const root = join(mkdtempSync(join(tmpdir(), 'cad-transition-')), '.planning');
  mkdirSync(join(root, 'phases', '1'), { recursive: true });
  writeFileSync(join(root, 'ROADMAP.md'), '# Roadmap\n\n- [x] **Phase 1: Store**\n');
  writeFileSync(join(root, 'REQUIREMENTS.md'), '# Requirements\n\n| STOR-01 | 1 |\n');
  writeFileSync(join(root, 'phases', '1', 'SUMMARY.md'), '# Phase 1\n\nDone.\n');
  return root;
}

const FIXTURE_FILES = ['ROADMAP.md', 'REQUIREMENTS.md', join('phases', '1', 'SUMMARY.md')];

/** Every path under `dir`, recursively, relative and sorted. */
function listing(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    out.push(relative(base, full));
    if (entry.isDirectory()) out.push(...listing(full, base));
  }
  return out.sort();
}

/**
 * The three-document rewrite this phase's callers actually perform, as a step
 * list. Every thunk records itself in `ran` before it writes, so a thunk that
 * was entered cannot hide behind a write that failed.
 */
function rewriteAll(root, ran) {
  return FIXTURE_FILES.map((f) => [{ edit: f }, () => {
    ran.push(f);
    writeFileSync(join(root, f), 'REWRITTEN');
  }]);
}

test('pre-flight: the first unsatisfied condition refuses, and no thunk runs', () => {
  const root = planningFixture();
  const before = FIXTURE_FILES.map((f) => readFileSync(join(root, f), 'utf8'));
  const ran = [];
  const evaluated = [];
  const condition = (name, answer) => ({
    condition: name,
    satisfied: () => { evaluated.push(name); return answer; },
  });

  const r = runTransition({
    preflight: [
      condition('the roadmap is readable', true),
      condition('the archive root is writable', false),
      condition('git reports a clean tree', true),
    ],
    steps: rewriteAll(root, ran),
    discipline: 'stop-at-first-failure',
  });

  assert.equal(r.ok, false);
  assert.equal(r.refused, 'the archive root is writable',
    'the refusal names the condition that did not hold');
  assert.deepEqual(r.completed, []);
  assert.deepEqual(r.failures, [], 'a refusal is not a step failure');
  assert.deepEqual(ran, [], 'not one step thunk may be entered');
  assert.deepEqual(evaluated, ['the roadmap is readable', 'the archive root is writable'],
    'the condition after the refusing one is never evaluated');
  assert.deepEqual(FIXTURE_FILES.map((f) => readFileSync(join(root, f), 'utf8')), before,
    'every file in the planned write set is byte-identical');
});

test('pre-flight: a refusal creates no file anywhere under the planning root', () => {
  // The listing is what pins D-01 in code rather than in prose: a journal, a
  // marker, a lock or a temp path written anywhere below the root reddens this
  // case, whatever it is named.
  const root = planningFixture();
  const before = listing(root);

  const r = runTransition({
    preflight: [{ condition: 'the archive root is writable', satisfied: () => false }],
    steps: rewriteAll(root, []),
    discipline: 'continue-past-failure',
  });

  assert.equal(r.refused, 'the archive root is writable');
  assert.deepEqual(listing(root), before, 'the tree is identical, file for file');
});

for (const discipline of ['stop-at-first-failure', 'continue-past-failure']) {
  test(`pre-flight: every condition satisfied runs the steps normally (${discipline})`, () => {
    const root = planningFixture();
    const ran = [];
    const r = runTransition({
      preflight: [
        { condition: 'the roadmap is readable', satisfied: () => true },
        { condition: 'git reports a clean tree', satisfied: () => true },
      ],
      steps: rewriteAll(root, ran),
      discipline,
    });

    assert.equal(r.ok, true);
    assert.equal(r.refused, null);
    assert.deepEqual(r.completed.map((k) => k.edit), FIXTURE_FILES);
    assert.deepEqual(ran, FIXTURE_FILES);
    for (const f of FIXTURE_FILES) assert.equal(readFileSync(join(root, f), 'utf8'), 'REWRITTEN');
  });
}

test('pre-flight: an empty condition list behaves exactly as no pre-flight at all', () => {
  const ranEmpty = [];
  const ranAbsent = [];
  const withEmpty = runTransition({
    preflight: [], steps: threeSteps(ranEmpty, 'b'), discipline: 'continue-past-failure',
  });
  const withNone = runTransition({
    steps: threeSteps(ranAbsent, 'b'), discipline: 'continue-past-failure',
  });

  assert.deepEqual(withEmpty.completed, withNone.completed);
  assert.deepEqual(withEmpty.failures.map((f) => f.key), withNone.failures.map((f) => f.key));
  assert.equal(withEmpty.ok, withNone.ok);
  assert.equal(withEmpty.refused, withNone.refused);
  assert.deepEqual(ranEmpty, ranAbsent);
});
