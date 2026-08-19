// Zero-dep tests for lib/report-rotation.mjs, the free-suffix picker an
// executor consults before its first write to `<plandir>/reports/plan-<k>.md`.
// Run: node --test 'cadence-core/bin/*.test.mjs' - CI's own glob.
//
// The module is pure, but the property that matters is a filesystem one: after
// the caller acts on its answer, the previous run's bytes are still readable.
// So these tests build REAL directories under `mkdtempSync` (the pattern
// planning.test.mjs uses), feed the module exactly what `readdirSync` returns,
// and then rename and re-read. A test that only compared strings would agree
// with a picker that answers a name the caller is about to overwrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rotationTarget } from './lib/report-rotation.mjs';

/** A fresh `<plandir>/reports/` holding `files` (name -> contents). */
function makeReports(files = {}) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-rotate-')), 'reports');
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

/** What an executor does with the module's answer: rotate, then write. */
function rotateThenWrite(dir, planKey, body) {
  const answer = rotationTarget(planKey, readdirSync(dir));
  if (answer.rotate) renameSync(join(dir, answer.from), join(dir, answer.to));
  writeFileSync(join(dir, `plan-${planKey}.md`), body);
  return answer;
}

test('fixture state 1 - no report present: nothing to rotate', () => {
  const dir = makeReports({});
  assert.deepEqual(rotationTarget(1, readdirSync(dir)), { rotate: false });

  // And not because the directory is empty: a report for ANOTHER plan, and the
  // transient risk diff that lives in this same directory, are not this plan's
  // record and must not be mistaken for one.
  const busy = makeReports({
    'plan-2.md': 'other plan',
    'plan-1-risk-task-3.diff': 'staged diff',
    'plan-11.md': 'plan eleven, not plan one suffixed',
  });
  assert.deepEqual(rotationTarget(1, readdirSync(busy)), { rotate: false });
});

test('fixture state 2 - one report present: rotates to the first free suffix', () => {
  const dir = makeReports({ 'plan-1.md': 'run A' });
  const answer = rotationTarget(1, readdirSync(dir));
  assert.deepEqual(answer, { rotate: true, from: 'plan-1.md', to: 'plan-1.1.md' });

  // The answer names a name nothing holds, which is what makes the caller's
  // rename non-destructive.
  assert.ok(!readdirSync(dir).includes(answer.to));

  // A bare `PLAN.md` is plan 1; `PLAN-2.md` is plan 2, and its own report is
  // the one that rotates.
  const two = makeReports({ 'plan-1.md': 'run A', 'plan-2.md': 'run A of plan 2' });
  assert.deepEqual(rotationTarget(2, readdirSync(two)),
    { rotate: true, from: 'plan-2.md', to: 'plan-2.1.md' });
});

test('fixture state 3 - several already rotated: takes the lowest free suffix', () => {
  const dir = makeReports({
    'plan-1.md': 'run D',
    'plan-1.1.md': 'run A',
    'plan-1.2.md': 'run B',
    'plan-1.3.md': 'run C',
  });
  assert.deepEqual(rotationTarget(1, readdirSync(dir)),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.4.md' });

  // A gap a hand-deleted report left is filled, not stepped over: the rule is
  // the lowest FREE suffix, which is total and needs no history.
  const gapped = makeReports({
    'plan-1.md': 'run D',
    'plan-1.1.md': 'run A',
    'plan-1.3.md': 'run C',
  });
  assert.deepEqual(rotationTarget(1, readdirSync(gapped)),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.2.md' });

  // Two-digit suffixes sort as numbers, not as strings: with 1..9 taken the
  // answer is 10, and a picker comparing text would answer a taken name.
  const many = makeReports(Object.fromEntries([
    ['plan-1.md', 'newest'],
    ...Array.from({ length: 9 }, (_, i) => [`plan-1.${i + 1}.md`, `run ${i}`]),
  ]));
  assert.deepEqual(rotationTarget(1, readdirSync(many)),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.10.md' });
});

test('the rotate-twice round trip leaves three readable reports, the earliest byte-identical', () => {
  const dir = makeReports({});

  // Run A writes the first report - nothing to rotate.
  assert.deepEqual(rotateThenWrite(dir, 1, 'RUN A\nPLAN COMPLETE\n'), { rotate: false });
  const runA = readFileSync(join(dir, 'plan-1.md'));

  // Run B rotates A aside, run C rotates B aside.
  assert.deepEqual(rotateThenWrite(dir, 1, 'RUN B\nPLAN PARTIAL\n'),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.1.md' });
  assert.deepEqual(rotateThenWrite(dir, 1, 'RUN C\nPLAN COMPLETE\n'),
    { rotate: true, from: 'plan-1.md', to: 'plan-1.2.md' });

  assert.deepEqual(readdirSync(dir).sort(), ['plan-1.1.md', 'plan-1.2.md', 'plan-1.md']);
  assert.deepEqual(readFileSync(join(dir, 'plan-1.1.md')), runA,
    "the earliest run's report is not byte-identical to its pre-rotation content");
  assert.equal(readFileSync(join(dir, 'plan-1.2.md'), 'utf8'), 'RUN B\nPLAN PARTIAL\n');
  assert.equal(readFileSync(join(dir, 'plan-1.md'), 'utf8'), 'RUN C\nPLAN COMPLETE\n');
});

test('unreadable inputs throw rather than answering "nothing to rotate"', () => {
  // Fail-open is the destructive arm: the caller acts on `rotate: false` by
  // writing over the file, so a malformed input must stop it, not license it.
  const dir = makeReports({ 'plan-1.md': 'run A' });
  for (const bad of [0, -1, 1.5, '08', '', ' 1', null, undefined, '1; rm -rf /']) {
    assert.throws(() => rotationTarget(bad, readdirSync(dir)), TypeError,
      `plan number ${JSON.stringify(bad)} was accepted`);
  }
  assert.throws(() => rotationTarget(1, 'plan-1.md'), TypeError);
  // What `readdirSync(dir, {withFileTypes:true})` returns: names that are not
  // strings would compare false against every candidate and answer `false`.
  assert.throws(() => rotationTarget(1, readdirSync(dir, { withFileTypes: true })), TypeError);
});
