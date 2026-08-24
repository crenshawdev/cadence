// Zero-dep tests for `planning.mjs seed-reqs`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTree, run } from './planning.test.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

// --- seed-reqs: /cad-plan's Traceability row-insert seam ------------------------

// A .planning tree for seed-reqs tests: REQUIREMENTS.md written raw with an
// `## Active` section (bullets) plus an empty `## Traceability` table -
// `active: null` omits the heading entirely (the no_active_section case),
// makeTree's `reqs` shape cannot express either.
function seedTree({ roadmap, phases, active }) {
  const dir = makeTree({ roadmap, phases });
  const activeSection = active === null ? ''
    : `## Active\n\n${active.map((id) => `- **${id}**: desc\n`).join('')}\n`;
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    `# Requirements: Fixture\n\n${activeSection}## Traceability\n\n` +
    '| Requirement | Phase | Status |\n|---|---|---|\n\nEmpty note.\n');
  return dir;
}

test('seed-reqs: a declared id with an ## Active bullet is seeded at Pending; a second run reports it skipped, file byte-identical', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  const r1 = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.seeded, ['X']);
  assert.deepEqual(r1.skipped, []);
  const after1 = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(after1, /\| X \| Phase 1 \| Pending \|/);

  const r2 = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r2.ok, true);
  assert.deepEqual(r2.seeded, []);
  assert.deepEqual(r2.skipped, ['X']);
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), after1);
});

test('seed-reqs: an id with no ## Active bullet is reported under orphan_ids, no row written, and audit still lists it under orphans.plan_ids', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['Y'] } },
    active: [],
  });
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.seeded, []);
  assert.deepEqual(r.orphan_ids, ['Y']);
  const after = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.equal(after.includes('| Y |'), false);
  const audit = run(['audit'], dir);
  assert.deepEqual(audit.orphans.plan_ids, [{ file: 'phases/1/PLAN.md', ids: ['Y'] }]);
});

test('seed-reqs: a missing ## Active heading returns no_active_section: true', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['Z'] } },
    active: null,
  });
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.no_active_section, true);
  assert.deepEqual(r.orphan_ids, ['Z']);
});

test('seed-reqs: --phase absent/non-numeric/negative all return bad-args, nothing written', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  const before = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  for (const args of [['seed-reqs'], ['seed-reqs', '--phase', 'abc'], ['seed-reqs', '--phase', '-1']]) {
    assert.equal(run(args, dir).reason, 'bad-args');
  }
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), before);
});

test('seed-reqs: a --phase spelling that cannot round-trip is refused before any read (D-07)', () => {
  // The fixture holds BOTH sub-phases, which is what makes the old answer
  // wrong rather than merely odd: `--phase 1.10` used to seed `| B | Phase 1.1
  // | Pending |` - the OTHER phase's row - with ok:true.
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: {
      '1.1': { plan: true, planReqs: ['A'] },
      '1.10': { plan: true, planReqs: ['B'] },
      2: { plan: true, planReqs: ['C'] },
      '2.1': { plan: true, planReqs: ['D'] },
    },
    active: ['A', 'B', 'C', 'D'],
  });
  const before = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  for (const bad of ['1.10', '1.0', '01']) {
    const r = run(['seed-reqs', '--phase', bad], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.equal(r._exit, 1, bad);
    // Both spellings: the caller's fix is retype the flag OR rename the dir.
    assert.ok(r.detail.includes(`"${bad}"`), `${bad}: detail quotes what was sent`);
    assert.ok(r.detail.includes(`"${String(Number(bad))}"`), `${bad}: detail quotes what is accepted`);
  }
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), before, 'nothing written');

  // The spellings that DO round-trip are untouched, sub-phases included.
  for (const [good, id] of [['1.1', 'A'], ['2', 'C'], ['2.1', 'D']]) {
    const r = run(['seed-reqs', '--phase', good], dir);
    assert.equal(r.ok, true, good);
    assert.deepEqual(r.seeded, [id], good);
  }
});

test('seed-reqs: a malformed requirements: line surfaces frontmatter_issues', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
    active: ['X'],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    '---\nphase: 1\nrequirements:["X"]\nfiles: []\n---\n# Plan 1\n');
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.frontmatter_issues, [{
    file: 'phases/1/PLAN.md',
    issues: [{ line: 3, code: 'malformed-key-line', text: 'requirements:["X"]' }],
  }]);
});

test('seed-reqs: absent REQUIREMENTS.md / absent phase dir / no conforming plan file degrade with named reasons', () => {
  const noReqs = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { plan: true } } });
  assert.equal(run(['seed-reqs', '--phase', '1'], noReqs).reason, 'no-requirements');

  const noPhaseDir = seedTree({ roadmap: [{ n: 1, name: 'One' }], active: ['X'] });
  assert.equal(run(['seed-reqs', '--phase', '1'], noPhaseDir).reason, 'no-phase-dir');

  const noPlans = seedTree({ roadmap: [{ n: 1, name: 'One' }], active: ['X'] });
  mkdirSync(join(noPlans, 'phases', '1'), { recursive: true });
  const rNoPlans = run(['seed-reqs', '--phase', '1'], noPlans);
  assert.equal(rNoPlans.reason, 'no-plans');
  assert.equal(rNoPlans.hint, '/cad-plan 1');
});

test('seed-reqs: a seeded row survives renumber insert, reading Phase 2', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  assert.equal(run(['seed-reqs', '--phase', '1'], dir).ok, true);
  assert.equal(run(['renumber', 'insert', '--at', '1'], dir).ok, true);
  const after = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(after, /\| X \| Phase 2 \| Pending \|/);
});
