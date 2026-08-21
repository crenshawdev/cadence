// Tests for lib/phase-plans.mjs - the disk half of the computed risk floor.
// Run: node --test cadence-core/bin/phase-plans.test.mjs
//
// ONE test() per row (the route-cells.test.mjs convention), and every fixture is
// built in its own mkdtempSync directory so no row can see another's tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cursorPhase, declaredPhaseFiles, declaredPlanFiles } from './lib/phase-plans.mjs';
import { renderCursor } from './lib/planning-files.mjs';

/** A fresh planning root. `plans` is keyed `<phase>/<filename>`. */
function planningRoot(plans = {}, stateText = null) {
  const root = mkdtempSync(join(tmpdir(), 'cad-phase-plans-'));
  for (const [rel, text] of Object.entries(plans)) {
    const file = join(root, 'phases', rel);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  if (stateText !== null) writeFileSync(join(root, 'STATE.md'), stateText);
  return root;
}

/** A PLAN.md declaring exactly these frontmatter `files:` paths. */
const plan = (...files) =>
  `---\nphase: 9\nplan: 1\nrequirements:\n  - STK-03\nfiles:\n${
    files.map((f) => `  - ${f}\n`).join('')}---\n\n# Plan\n`;

// --- cursorPhase -------------------------------------------------------------

test('cursorPhase returns the cursor phase', () => {
  const root = planningRoot({}, renderCursor({
    phase: 4, total: 6, name: 'The computed floor',
    status: 'planned', next: '/cad-execute 4', updated: '2026-07-29',
  }));
  assert.equal(cursorPhase(root), 4);
});

test('cursorPhase returns a decimal phase as a Number', () => {
  const root = planningRoot({}, renderCursor({
    phase: 2.1, total: 6, name: 'Inserted',
    status: 'planned', next: '/cad-execute 2.1', updated: '2026-07-29',
  }));
  assert.equal(cursorPhase(root), 2.1);
});

test('a missing STATE.md is null, silently - the ordinary pre-project state', () => {
  assert.equal(cursorPhase(planningRoot({})), null);
  assert.equal(cursorPhase(join(tmpdir(), 'cad-no-such-root-67890')), null);
});

test('a garbled STATE.md is null, never a throw', () => {
  assert.equal(cursorPhase(planningRoot({}, '# State\n\nnot a cursor at all\n')), null);
});

// --- declaredPhaseFiles: the union face --------------------------------------

test('two conforming plans both parse: the union, found 2, clean 2', () => {
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md', 'src/a.mjs'),
    '7/PLAN-2.md': plan('src/b.mjs', 'README.md'),
  });
  const r = declaredPhaseFiles(root, 7);
  // Lexicographic file order, first occurrence kept - `README.md` is declared
  // by both plans and appears once, in PLAN-1's position.
  assert.deepEqual(r.files, ['README.md', 'src/a.mjs', 'src/b.mjs']);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.found, 2);
  assert.equal(r.clean, 2);
});

test('a plan out of grammar contributes NO path, warns, and leaves clean below found', () => {
  // The `files:` list here PARSES - `items` comes back holding `src/a.mjs` -
  // and is still dropped whole. Salvaging the half that parsed would floor a
  // phase off a path list the grammar already rejected.
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md'),
    '7/PLAN-2.md': '---\nphase: 7\nplan: 2\nfiles:\n  - src/a.mjs\n  a line that is not a key\n---\n\n# Plan\n',
  });
  const r = declaredPhaseFiles(root, 7);
  assert.deepEqual(r.files, ['README.md']);
  assert.equal(r.found, 2);
  assert.equal(r.clean, 1, 'clean below found is what the aggregation rule reads');
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /^risk floor: /);
  assert.match(r.warnings[0], /PLAN-2\.md/);
  assert.match(r.warnings[0], /line 6: unknown-line/);
});

test('an unreadable plan does the same: no path, one warning, clean below found', () => {
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md'),
    '7/PLAN-2.md': plan('src/b.mjs'),
  });
  chmodSync(join(root, 'phases', '7', 'PLAN-2.md'), 0o000);
  const r = declaredPhaseFiles(root, 7);
  assert.deepEqual(r.files, ['README.md']);
  assert.equal(r.found, 2);
  assert.equal(r.clean, 1);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /^risk floor: cannot read .*PLAN-2\.md \(EACCES\)/);
  chmodSync(join(root, 'phases', '7', 'PLAN-2.md'), 0o644);
});

test('an absent phase directory is zero found and NO warning - the pre-plan state', () => {
  // Warning here would fire on every /cad-context dispatch of every project.
  const empty = declaredPhaseFiles(planningRoot({}), 7);
  assert.deepEqual(empty, { files: [], warnings: [], found: 0, clean: 0 });
  const noRoot = declaredPhaseFiles(join(tmpdir(), 'cad-no-such-root-13579'), 7);
  assert.deepEqual(noRoot, { files: [], warnings: [], found: 0, clean: 0 });
});

test('a phase directory holding no PLAN file is zero found, no warning, no throw', () => {
  const root = planningRoot({ '7/CONTEXT.md': '# Context\n', '7/PLAN-gaps.md': plan('src/x.mjs') });
  const r = declaredPhaseFiles(root, 7);
  // `PLAN-gaps.md` is NON-CONFORMING and is invisible here exactly as it is to
  // listPlanFiles, status, audit and executor dispatch.
  assert.deepEqual(r, { files: [], warnings: [], found: 0, clean: 0 });
});

test('a `- **Files:**` task line contributes nothing to either face (D-05)', () => {
  const body = '---\nphase: 7\nplan: 1\nfiles:\n  - README.md\n---\n\n# Plan\n\n'
    + '### Task 1\n\n- **Files:** src/auth/session.rs, migrations/001.sql\n';
  const root = planningRoot({ '7/PLAN-1.md': body });
  assert.deepEqual(declaredPhaseFiles(root, 7).files, ['README.md']);
  assert.deepEqual(declaredPlanFiles(root, 7, '1').files, ['README.md']);
});

// --- declaredPlanFiles: the named-plan face ----------------------------------

test('the named-plan face reads ONLY the file its key names', () => {
  const root = planningRoot({
    '7/PLAN-1.md': plan('README.md'),
    '7/PLAN-2.md': plan('src/auth/session.rs'),
  });
  const one = declaredPlanFiles(root, 7, '1');
  assert.deepEqual(one.files, ['README.md']);
  assert.deepEqual(one.warnings, []);
  assert.equal(one.found, 1);
  assert.equal(one.clean, 1);
  const two = declaredPlanFiles(root, 7, '2');
  assert.deepEqual(two.files, ['src/auth/session.rs']);
  assert.equal(two.clean, 1);
});

test('key `1` reads PLAN.md when PLAN-1.md is absent, and PLAN-1.md when it is not', () => {
  const bare = planningRoot({ '7/PLAN.md': plan('README.md') });
  assert.deepEqual(declaredPlanFiles(bare, 7, '1').files, ['README.md']);
  assert.equal(declaredPlanFiles(bare, 7, '1').found, 1);
  const both = planningRoot({ '7/PLAN.md': plan('bare.md'), '7/PLAN-1.md': plan('numbered.md') });
  assert.deepEqual(declaredPlanFiles(both, 7, '1').files, ['numbered.md']);
});

test('a key naming no plan file is found 0 with a warning - a wrong dispatch, not a pre-plan state', () => {
  const root = planningRoot({ '7/PLAN-1.md': plan('README.md') });
  const r = declaredPlanFiles(root, 7, '4');
  assert.deepEqual(r.files, []);
  assert.equal(r.found, 0);
  assert.equal(r.clean, 0);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /^risk floor: plan 4 names no plan file/);
  // A key outside the PLAN-<k>.md spelling takes the same arm rather than
  // silently widening to the phase union.
  assert.equal(declaredPlanFiles(root, 7, '1-fix').found, 0);
  // ...and so does an absent phase directory, which DOES warn here: the caller
  // named a plan and got nothing back.
  const gone = declaredPlanFiles(planningRoot({}), 7, '1');
  assert.equal(gone.found, 0);
  assert.equal(gone.warnings.length, 1, JSON.stringify(gone.warnings));
});

test('the named face carries the same two failure arms as the union', () => {
  const root = planningRoot({
    '7/PLAN-1.md': '---\nphase: 7\nplan: 1\nfiles:\n  - src/a.mjs\n  not a key line\n---\n\n# Plan\n',
  });
  const bad = declaredPlanFiles(root, 7, '1');
  assert.deepEqual(bad.files, []);
  assert.equal(bad.found, 1);
  assert.equal(bad.clean, 0);
  assert.match(bad.warnings[0], /out of grammar/);
});
