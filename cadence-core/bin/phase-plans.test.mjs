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
import { cursorPhase } from './lib/phase-plans.mjs';
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
