// Zero-dep tests for `planning.mjs` criteria-size. Run:
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
import { blockPlanTree } from './planning-plans.test.mjs';

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

// --- criteria-size: the criteria ceilings three workflows only stated --------
// The prose said 3-7 and 2-5 and nothing counted either. Both grammars are
// asserted here, including the two live roadmap heading spellings, because a
// parser anchored to the template alone would report "declared nothing" for
// every phase of this repo's own roadmap - and, absence not being zero, would
// say so in silence.

/**
 * A roadmap whose phase `i+1` declares `roadmapCounts[i]` criteria under
 * `spelling`, plus a CONTEXT.md carrying `contexts[n]` acceptance criteria for
 * each phase named there (a phase absent from `contexts` gets no CONTEXT.md).
 */
function criteriaTree(roadmapCounts, spelling, contexts = {}) {
  const dir = makeTree({
    roadmap: roadmapCounts.map((_, i) => ({ n: i + 1, name: `P${i + 1}` })),
  });
  let rm = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  roadmapCounts.forEach((count, i) => {
    const list = Array.from({ length: count }, (_, k) => `${k + 1}. criterion ${k + 1}`).join('\n');
    rm = rm.replace(`### Phase ${i + 1}: P${i + 1}\n`,
      `### Phase ${i + 1}: P${i + 1}\n${spelling}\n${list}\n`);
  });
  writeFileSync(join(dir, 'ROADMAP.md'), rm);
  for (const [n, count] of Object.entries(contexts)) {
    const pdir = join(dir, 'phases', n);
    mkdirSync(pdir, { recursive: true });
    const items = Array.from({ length: count }, (_, k) => `- [ ] AC${k + 1}: does thing ${k + 1}`);
    writeFileSync(join(pdir, 'CONTEXT.md'),
      `# Phase ${n} Context\n\n## Acceptance criteria\n\n${items.join('\n')}\n`);
  }
  return dir;
}

const BOTH_SPELLINGS = ['**Success Criteria:**', 'Success criteria:'];

for (const spelling of BOTH_SPELLINGS) {
  test(`criteria-size: under the floor and over the ceiling are both named, heading \`${spelling}\``, () => {
    // No --phase: every phase the roadmap declares, in one call - what
    // new-project and adopt need at their approval gate.
    const dir = criteriaTree([1, 6, 3], spelling);
    const r = run(['criteria-size', '--roadmap-min', '2', '--roadmap-max', '5'], dir);
    assert.equal(r.ok, true);
    assert.equal(r.within, false);
    assert.deepEqual(r.compared, ['roadmap_min', 'roadmap_max']);
    assert.deepEqual(r.over.map((o) => [o.phase, o.kind, o.measured, o.ceiling]), [
      [1, 'roadmap-criteria-too-few', 1, 2],
      [2, 'roadmap-criteria-too-many', 6, 5],
    ]);
    assert.deepEqual(r.phases.map((p) => [p.phase, p.roadmap_criteria, p.roadmap_found]),
      [[1, 1, true], [2, 6, true], [3, 3, true]]);
  });
}

test('criteria-size: an absent CONTEXT.md is not-found, never compared, and never a pass', () => {
  // The absence-is-not-zero arm on the CONTEXT half: 0 criteria is under every
  // floor, so an unwritten CONTEXT would otherwise read as a phase that failed
  // the ceiling it was never measured against.
  const dir = criteriaTree([3], 'Success criteria:');
  const r = run(['criteria-size', '--phase', '1', '--context-min', '3', '--context-max', '7'], dir);
  assert.equal(r.phases[0].context_found, false);
  assert.equal(r.phases[0].context_criteria, 0);
  assert.deepEqual(r.over, []);
  assert.deepEqual(r.compared, []);
  assert.equal(r.within, null);
});

test('criteria-size: a CONTEXT that declared its criteria IS compared, both bounds', () => {
  const dir = criteriaTree([3, 3], 'Success criteria:', { 1: 2, 2: 5 });
  const r = run(['criteria-size', '--context-min', '3', '--context-max', '7'], dir);
  assert.deepEqual(r.compared, ['context_min', 'context_max']);
  assert.deepEqual(r.over.map((o) => [o.phase, o.kind, o.measured]),
    [[1, 'context-criteria-too-few', 2]]);
  assert.equal(r.within, false);
  assert.equal(r.phases[1].context_criteria, 5);
});

test('criteria-size: no ceiling flags compares nothing and reports within: null', () => {
  const dir = criteriaTree([1, 9], 'Success criteria:', { 1: 1 });
  const r = run(['criteria-size'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.compared, []);
  assert.equal(r.within, null);
  assert.deepEqual(r.over, []);
  // The counts are still reported - a caller that supplied no bound still
  // learns what is there, exactly as plan-size does.
  assert.deepEqual(r.phases.map((p) => p.roadmap_criteria), [1, 9]);
  assert.equal(r.roadmap_min, undefined);
});

test('criteria-size: a phase with no criteria heading is not-found, and a floor never fires on it', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'P1' }] });
  const r = run(['criteria-size', '--roadmap-min', '2'], dir);
  assert.equal(r.phases[0].roadmap_found, false);
  assert.equal(r.phases[0].roadmap_criteria, 0);
  assert.deepEqual(r.over, []);
  assert.equal(r.within, null);
});

test('criteria-size: a non-integer bound is bad-args, never a coerced comparison', () => {
  const dir = criteriaTree([3], 'Success criteria:');
  assert.equal(run(['criteria-size', '--roadmap-min', 'x'], dir).reason, 'bad-args');
  assert.equal(run(['criteria-size', '--phase', 'x'], dir).reason, 'bad-args');
});

test('plan-overlap: block-form files: lists intersect like inline ones (#48.1)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - src/a.rs\n  - src/shared.rs\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n  - src/c.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.equal(r.undeclared, undefined); // both plans declared files
});

test('plan-overlap: a comment line inside each files: block list does not truncate it - both share src/shared.rs (D-04 acceptance criterion)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - src/a.rs\n  # shared with plan 2\n  - src/shared.rs\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  # also touches plan 1\'s file\n  - src/shared.rs\n  - src/c.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.equal(r.undeclared, undefined);
});

test('audit + plan-overlap: a stray line BETWEEN two block ids is reported and skipped, not a terminator', () => {
  const withStray = blockPlanTree('requirements:\n  - "#41"\n  this line is not an item\n  - "#46"\nfiles: []');
  const clean = blockPlanTree('requirements:\n  - "#41"\n  - "#46"\nfiles: []');

  const a = run(['audit'], withStray);
  assert.equal(a.ok, true);
  const byId = Object.fromEntries(a.requirements.map((q) => [q.id, q]));
  assert.equal(byId['#41'].plan, 'phases/1/PLAN.md');
  assert.equal(byId['#46'].plan, 'phases/1/PLAN.md');
  assert.deepEqual(a.frontmatter_issues, [{
    file: 'phases/1/PLAN.md',
    issues: [{ line: 6, code: 'unknown-line', text: 'this line is not an item' }],
  }]);
  assert.deepEqual(a.counts, run(['audit'], clean).counts);

  const o = run(['plan-overlap', '--phase', '1'], withStray);
  assert.equal(o.ok, true);
  assert.deepEqual(o.frontmatter_issues, [{
    plan: 'PLAN.md',
    issues: [{ line: 6, code: 'unknown-line', text: 'this line is not an item' }],
  }]);
});

test('audit + plan-overlap: the frontmatter_issues diagnostic is not key-scoped', () => {
  // A stray line under `requirements:` (which plan-overlap never reads) must
  // still reach plan-overlap's envelope - the diagnostic is whole-pass, not
  // per-key.
  const underRequirements = blockPlanTree('requirements:\n  - "#41"\n  - "#46"\n  stray under requirements\nfiles: []');
  const o1 = run(['plan-overlap', '--phase', '1'], underRequirements);
  assert.equal(o1.ok, true);
  assert.equal(o1.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'), true);

  // A stray line between two INLINE keys - the shipped template shape, where
  // no block scan runs at all - must reach BOTH envelopes.
  const betweenInline = blockPlanTree('requirements: ["#41", "#46"]\nstray between inline keys\nfiles: []');
  const a = run(['audit'], betweenInline);
  assert.equal(a.ok, true);
  assert.equal(a.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'), true);
  const o2 = run(['plan-overlap', '--phase', '1'], betweenInline);
  assert.equal(o2.ok, true);
  assert.equal(o2.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'), true);
});
