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
import { cursorPhase, declaredPhaseFiles } from './lib/phase-plans.mjs';
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

// --- declaredPhaseFiles: the ordinary reads ----------------------------------

test('a phase with one PLAN returns its declared frontmatter files', () => {
  const root = planningRoot({ '9/PLAN.md': plan('src/auth/login.rs', 'README.md') });
  assert.deepEqual(declaredPhaseFiles(root, 9),
    { files: ['src/auth/login.rs', 'README.md'], warnings: [] });
});

test('a split phase unions PLAN-1.md and PLAN-2.md, in lexicographic file order', () => {
  const root = planningRoot({
    '9/PLAN-2.md': plan('db/migrations/001.sql'),
    '9/PLAN-1.md': plan('src/auth/login.rs'),
  });
  assert.deepEqual(declaredPhaseFiles(root, 9),
    { files: ['src/auth/login.rs', 'db/migrations/001.sql'], warnings: [] });
});

test('a path declared by BOTH plans of a split phase appears once', () => {
  const root = planningRoot({
    '9/PLAN-1.md': plan('src/shared.rs'),
    '9/PLAN-2.md': plan('src/shared.rs', 'src/other.rs'),
  });
  assert.deepEqual(declaredPhaseFiles(root, 9).files, ['src/shared.rs', 'src/other.rs']);
});

test('a decimal phase addresses phases/2.1/ - parseCursor returns a Number', () => {
  const root = planningRoot({ '2.1/PLAN.md': plan('src/auth/x.rs') });
  assert.deepEqual(declaredPhaseFiles(root, 2.1).files, ['src/auth/x.rs']);
});

test('a non-PLAN file in the phase directory contributes nothing', () => {
  const root = planningRoot({
    '9/PLAN.md': plan('README.md'),
    '9/CONTEXT.md': plan('src/auth/login.rs'),
    '9/PLAN.md.bak': plan('db/migrations/001.sql'),
  });
  assert.deepEqual(declaredPhaseFiles(root, 9).files, ['README.md']);
});

// --- declaredPhaseFiles: the fail-open arms (D-08) ---------------------------

test('a missing phase directory is empty with NO warning - the pre-plan state', () => {
  const root = planningRoot({ '9/PLAN.md': plan('README.md') });
  assert.deepEqual(declaredPhaseFiles(root, 8), { files: [], warnings: [] });
});

test('a missing planning root is empty with no warning', () => {
  assert.deepEqual(declaredPhaseFiles(join(tmpdir(), 'cad-no-such-root-12345'), 1),
    { files: [], warnings: [] });
});

test('a phase directory holding no PLAN file is empty with no warning', () => {
  const root = planningRoot({ '9/CONTEXT.md': '# Context\n' });
  assert.deepEqual(declaredPhaseFiles(root, 9), { files: [], warnings: [] });
});

test('an unreadable PLAN yields NO paths and one warning naming the file', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0
    ? 'root bypasses mode bits' : false,
}, () => {
  const root = planningRoot({ '9/PLAN.md': plan('src/auth/login.rs') });
  const file = join(root, 'phases', '9', 'PLAN.md');
  chmodSync(file, 0o000);
  try {
    const r = declaredPhaseFiles(root, 9);
    assert.deepEqual(r.files, []);
    assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
    assert.match(r.warnings[0], /PLAN\.md/);
  } finally {
    chmodSync(file, 0o644);
  }
});

test('an out-of-grammar frontmatter yields EMPTY files plus one warning', () => {
  // Not "whatever half-parsed": a half-parsed `files:` list is an unresolvable
  // input, not a shorter one, and flooring off it floors a phase from a path
  // list the grammar already rejected.
  const root = planningRoot({
    '9/PLAN.md': '---\nfiles:\n  - src/auth/login.rs\nrequirements:["STK-03"]\n---\n\n# Plan\n',
  });
  const r = declaredPhaseFiles(root, 9);
  assert.deepEqual(r.files, [], 'the partially parsed list must NOT survive');
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /PLAN\.md/);
  assert.match(r.warnings[0], /out of grammar/);
});

test('one broken PLAN in a split phase does not suppress its sibling', () => {
  const root = planningRoot({
    '9/PLAN-1.md': '---\nfiles:\n  - src/auth/login.rs\nrequirements:["STK-03"]\n---\n',
    '9/PLAN-2.md': plan('db/migrations/001.sql'),
  });
  const r = declaredPhaseFiles(root, 9);
  assert.deepEqual(r.files, ['db/migrations/001.sql']);
  assert.equal(r.warnings.length, 1);
});

test('a PLAN with no frontmatter at all is empty with no warning', () => {
  const root = planningRoot({ '9/PLAN.md': '# Plan\n\nNo fence here.\n' });
  assert.deepEqual(declaredPhaseFiles(root, 9), { files: [], warnings: [] });
});

// --- the D-01 arm: the FRONTMATTER list, never the task-line union -----------

test('a path named only by a - **Files:** task line is ABSENT from the result', () => {
  // The row that keeps a later refactor from quietly restoring parsePlanFiles'
  // union: under it, a PLAN declaring only README.md would floor the whole
  // phase to critical because one task line happens to name an auth path.
  const root = planningRoot({
    '9/PLAN.md': plan('README.md')
      + '\n### Task 1: do it\n\n- **Files:** src/auth/session.rs\n',
  });
  const r = declaredPhaseFiles(root, 9);
  assert.deepEqual(r.files, ['README.md']);
  assert.equal(r.files.includes('src/auth/session.rs'), false);
});

// --- cursorPhase --------------------------------------------------------------

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
