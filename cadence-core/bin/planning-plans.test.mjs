// Zero-dep tests for `planning.mjs` on the plan file itself - plan-size, plan-overlap, the frontmatter grammar and the lease spellings. Run:
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
import { dirname, join } from 'node:path';
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

// `blockPlanTree` and `oneIdPlanTree` are declared here, with the plan-file
// arms they were written for, and exported for the two regions that also
// drive them - the `audit` arms in planning-audit.test.mjs and the
// criteria ceilings in planning-criteria-size.test.mjs. Imported by name,
// never copied: a second copy is how two fixtures drift apart.
// A one-phase tree whose PLAN.md frontmatter is written raw, plus REQUIREMENTS
// rows for #41/#46. `frontmatter` is spliced between the --- fences.
export function blockPlanTree(frontmatter, body = '') {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
    reqs: [['#41', 1, 'Pending'], ['#46', 1, 'Pending']],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    `---\nphase: 1\nplan: 1\n${frontmatter}\n---\n\n# Plan 1\n${body}`);
  return dir;
}

// Like blockPlanTree, but seeds a SINGLE requirement (#41) - Task 5's
// per-code payload table test needs every fixture and its twin to declare
// the SAME id count, or a delta in counts.broken measures the fixture's id
// count rather than the code's payload behavior. #41 is Complete against a
// CHECKED phase box, so a fixture that maps it cleanly is fully traced
// (counts.broken: 0) and a fixture that drops the mapping is `no-plan`
// (counts.broken: 1) - a Pending row against an unchecked box would be
// `not-verified` (also broken:1) whether or not the id was ever dropped,
// which would make every fixture indistinguishable from the twin.
export function oneIdPlanTree(frontmatter, body = '') {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One', checked: true }],
    phases: { 1: { plan: true } },
    reqs: [['#41', 1, 'Complete']],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    `---\nphase: 1\nplan: 1\n${frontmatter}\n---\n\n# Plan 1\n${body}`);
  return dir;
}

// --- plan-size: the two counts that were soft until v2.7.0 --------------------

/** A phase whose ROADMAP detail block names `ids`, plus `plans` of N tasks. */
function sizeTree(ids, plans) {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  if (ids) {
    const rm = readFileSync(join(dir, 'ROADMAP.md'), 'utf8')
      .replace('**Goal:** goal 1\n', `**Goal:** goal 1\n**Requirements:** ${ids.join(', ')}\n`);
    writeFileSync(join(dir, 'ROADMAP.md'), rm);
  }
  const pdir = join(dir, 'phases', '1');
  mkdirSync(pdir, { recursive: true });
  for (const [file, n] of Object.entries(plans || {})) {
    const tasks = Array.from({ length: n }, (_, i) =>
      `### Task ${i + 1}: do ${i + 1}\n\n- **Files:** src/a.rs\n`).join('\n');
    writeFileSync(join(pdir, file), `# Plan\n\n## Tasks\n\n${tasks}`);
  }
  return dir;
}

test('plan-size: counts the requirements a ROADMAP detail block names, deduped', () => {
  const dir = sizeTree(['STOR-01', 'STOR-02', 'STOR-02', 'IDENT-01'], {});
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.requirements_found, true);
  assert.equal(r.requirements, 3, JSON.stringify(r.requirement_ids));
});

test('plan-size: a phase over --max-reqs is phase-too-big, naming both numbers', () => {
  const dir = sizeTree(['STOR-01', 'STOR-02', 'STOR-03', 'STOR-04'], {});
  const r = run(['plan-size', '--phase', '1', '--max-reqs', '3'], dir);
  assert.equal(r.within, false);
  const hit = r.over.find((o) => o.kind === 'phase-too-big');
  assert.ok(hit, JSON.stringify(r.over));
  assert.equal(hit.measured, 4);
  assert.equal(hit.ceiling, 3);
});

test('plan-size: NO detail block is unmeasured, never zero - it is not compared', () => {
  // The whole point of `requirements_found`. A count of 0 is under every
  // ceiling, so an unwritten roadmap would otherwise read as a small phase.
  const dir = sizeTree(null, {});
  const r = run(['plan-size', '--phase', '1', '--max-reqs', '3'], dir);
  assert.equal(r.requirements_found, false);
  assert.equal(r.requirements, 0);
  assert.deepEqual(r.over, []);
  // No ceiling ran, so there is no verdict to report: `within: true` here was
  // a clean bill of health for a comparison that never happened.
  assert.deepEqual(r.compared, []);
  assert.equal(r.within, null);
});

test('plan-size: the task ceiling is PER PLAN - 4+4+4 against a ceiling of 4 is within', () => {
  // The ambiguity this seam settled: `max_plan_tasks` is named per plan while
  // the workflow said "delivering this phase". A phase splitting into three
  // conforming plans is the move the ceiling is meant to produce.
  const dir = sizeTree(['STOR-01'], { 'PLAN-1.md': 4, 'PLAN-2.md': 4, 'PLAN-3.md': 4 });
  const r = run(['plan-size', '--phase', '1', '--max-tasks', '4'], dir);
  assert.equal(r.tasks, 12);
  assert.deepEqual(r.over, []);
  assert.equal(r.within, true);
});

test('plan-size: ONE plan over the ceiling is flagged, naming the plan file', () => {
  const dir = sizeTree(['STOR-01'], { 'PLAN-1.md': 3, 'PLAN-2.md': 8 });
  const r = run(['plan-size', '--phase', '1', '--max-tasks', '4'], dir);
  const hit = r.over.find((o) => o.kind === 'plan-too-many-tasks');
  assert.ok(hit, JSON.stringify(r.over));
  assert.equal(hit.plan, 'PLAN-2.md');
  assert.equal(hit.measured, 8);
  assert.equal(r.over.filter((o) => o.kind === 'plan-too-many-tasks').length, 1);
});

test('plan-size: an unwritten plan is never over its ceiling', () => {
  const dir = sizeTree(['STOR-01'], {});
  const r = run(['plan-size', '--phase', '1', '--max-tasks', '1'], dir);
  assert.equal(r.tasks, 0);
  assert.deepEqual(r.plans, []);
  assert.deepEqual(r.over, []);
});

test('plan-size: no ceiling flags nothing but still reports the counts', () => {
  const dir = sizeTree(['STOR-01', 'STOR-02'], { 'PLAN.md': 9 });
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.requirements, 2);
  assert.equal(r.tasks, 9);
  assert.deepEqual(r.over, []);
  assert.equal(r.max_tasks, undefined);
});

test('plan-size: a missing --phase is bad-args, never the cursor', () => {
  const dir = sizeTree(['STOR-01'], {});
  assert.equal(run(['plan-size'], dir).reason, 'bad-args');
  assert.equal(run(['plan-size', '--phase', 'x'], dir).reason, 'bad-args');
});

// --- plan-size: the DECLARED BYTES a plan hands its executor (BUD-03) --------

/**
 * A one-phase tree whose PLAN.md carries `frontmatter` verbatim between the
 * fences, plus `files` (relative path -> body) written into the REPO root - the
 * planning root's PARENT, which is where a repo-relative declared path
 * resolves. Returns the planning dir, so `run` addresses it like every other
 * arm here.
 */
function bytesTree(frontmatter, files = {}) {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: {} } });
  const repoRoot = dirname(dir);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(repoRoot, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    `---\nphase: 1\nplan: 1\n${frontmatter}\n---\n\n# Plan 1\n`);
  return dir;
}

test('plan-size: a plan reports the summed on-disk bytes its files: frontmatter declares', () => {
  const dir = bytesTree('files:\n  - src/a.rs\n  - src/b.rs',
    { 'src/a.rs': 'x'.repeat(1200), 'src/b.rs': 'y'.repeat(345) });
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.plans.length, 1);
  assert.equal(r.plans[0].bytes, 1545);
  assert.equal(r.plans[0].absent, 0);
});

test('plan-size: a declared path that is not on disk counts zero bytes and one absent', () => {
  // The creation-heavy plan D-10 exists for: without the count beside it, 1200
  // reads as "comfortably under the ceiling" while measuring one file of two.
  const dir = bytesTree('files:\n  - src/a.rs\n  - src/not-yet.rs',
    { 'src/a.rs': 'x'.repeat(1200) });
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.plans[0].bytes, 1200);
  assert.equal(r.plans[0].absent, 1);
});

test('plan-size: a declared DIRECTORY and a path climbing out both land on absent, unread', () => {
  // Neither is stat'd for its size: the escape is refused by SPELLING before any
  // stat, and a directory is refused by what the path IS. Both make the total
  // measure less than what was declared, which is the count's whole job.
  const dir = bytesTree('files:\n  - src\n  - ../outside.rs\n  - /etc/passwd\n  - src/a.rs',
    { 'src/a.rs': 'x'.repeat(10) });
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.plans[0].bytes, 10);
  assert.equal(r.plans[0].absent, 3);
});

test('plan-size: a files: list out of grammar reports null bytes, never 0', () => {
  // No-salvage, `readOnePlan`'s rule: 0 would state that the plan declares
  // nothing, which is absence of evidence reported as absence of surface.
  const dir = bytesTree('files:\n  - src/a.rs\n  this line is not an item',
    { 'src/a.rs': 'x'.repeat(1200) });
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.plans[0].bytes, null);
  assert.equal(r.plans[0].absent, null);
});

// --- frontmatter grammar: normalization + the diagnostic's both envelopes ---

test('audit + plan-overlap: a CRLF-checked-out PLAN.md reads identically to its LF twin', () => {
  const build = (dir) => {
    const pdir = join(dir, 'phases', '1');
    writeFileSync(join(pdir, 'PLAN-1.md'),
      '---\nphase: 1\nplan: 1\nrequirements: ["#41", "#46"]\nfiles:\n  - src/a.rs\n  - src/shared.rs\n---\n# Plan 1\n');
    writeFileSync(join(pdir, 'PLAN-2.md'),
      '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n  - src/c.rs\n---\n# Plan 2\n');
  };
  const spec = {
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
    reqs: [['#41', 1, 'Pending'], ['#46', 1, 'Pending']],
  };
  const lf = makeTree(spec);
  build(lf);
  const crlf = makeTree(spec);
  build(crlf);
  // Only PLAN-1.md is checked out CRLF - the sibling parsers stay out (D-10).
  const plan1 = join(crlf, 'phases', '1', 'PLAN-1.md');
  writeFileSync(plan1, readFileSync(plan1, 'utf8').replace(/\n/g, '\r\n'));

  const lfAudit = run(['audit'], lf);
  const crlfAudit = run(['audit'], crlf);
  assert.deepEqual(
    crlfAudit.requirements.map((r) => [r.id, r.break]).sort(),
    lfAudit.requirements.map((r) => [r.id, r.break]).sort(),
  );
  assert.equal(crlfAudit.frontmatter_issues, undefined);

  // The files path, not only the ids: plan-overlap reaches PLAN-1.md's CRLF
  // files: block list identically to the LF twin's.
  const lfOverlap = run(['plan-overlap', '--phase', '1'], lf);
  const crlfOverlap = run(['plan-overlap', '--phase', '1'], crlf);
  assert.deepEqual(crlfOverlap.overlaps, lfOverlap.overlaps);
  assert.deepEqual(crlfOverlap.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.equal(crlfOverlap.frontmatter_issues, undefined);
});

test('audit: a BOM + leading blank line PLAN.md reads identically to its plain twin', () => {
  const plain = blockPlanTree('requirements: ["#41", "#46"]\nfiles: []');
  const bomDir = blockPlanTree('requirements: ["#41", "#46"]\nfiles: []');
  const planPath = join(bomDir, 'phases', '1', 'PLAN.md');
  // The BOM must be the file's actual first byte; the leading blank line
  // follows it.
  writeFileSync(planPath, `﻿\n${readFileSync(planPath, 'utf8')}`);
  const plainAudit = run(['audit'], plain);
  const bomAudit = run(['audit'], bomDir);
  assert.deepEqual(
    bomAudit.requirements.map((r) => [r.id, r.break]).sort(),
    plainAudit.requirements.map((r) => [r.id, r.break]).sort(),
  );
  assert.equal(bomAudit.frontmatter_issues, undefined);
});

test('audit + plan-overlap: an unterminated frontmatter fence reports on both envelopes, audit stays ok:true', () => {
  // blockPlanTree writes exactly one PLAN.md, so plan-overlap hits its
  // fewer-than-two-plans early return - deliberately, since that envelope
  // must carry the diagnostic too. Overwrite it with a fence that never
  // closes.
  const dir = blockPlanTree('requirements: ["#41", "#46"]\nfiles: []');
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    '---\nphase: 1\nplan: 1\nrequirements: ["#41", "#46"]\nfiles: []\n\n# Plan 1 (fence never closes)\n');
  const a = run(['audit'], dir);
  assert.equal(a.ok, true);
  assert.deepEqual(a.frontmatter_issues,
    [{ file: 'phases/1/PLAN.md', issues: [{ line: 1, code: 'unterminated-frontmatter', text: '---' }] }]);
  const o = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(o.ok, true);
  assert.equal(o.note, 'fewer than two plans - nothing to intersect');
  assert.deepEqual(o.frontmatter_issues,
    [{ plan: 'PLAN.md', issues: [{ line: 1, code: 'unterminated-frontmatter', text: '---' }] }]);
});

// Task 5: falsify `references/plan-frontmatter.md`'s per-code Payload column
// at the audit seam - not a reading of the prose. Every fixture and the twin
// declare the SAME single id (#41) so a delta in counts.broken is
// attributable only to the code under test (see oneIdPlanTree).
test('audit: the per-code payload table is falsifiable - each dropping code moves counts.broken, each preserving code does not', () => {
  const twin = run(['audit'], oneIdPlanTree('requirements:\n  - "#41"\nfiles: []'));
  assert.equal(twin.ok, true);
  assert.equal(twin.frontmatter_issues, undefined);

  const dropping = {
    'unterminated-inline-list': 'requirements: ["#41"\nfiles: []',
    'unterminated-quote': 'requirements: ["#41]\nfiles: []',
    'malformed-key-line': 'requirements:["#41"]\nfiles: []',
    'item-without-key': 'requirements: []\n  - "#41"\nfiles: []',
  };
  for (const [code, frontmatter] of Object.entries(dropping)) {
    const r = run(['audit'], oneIdPlanTree(frontmatter));
    assert.equal(r.ok, true, code);
    assert.ok(r.frontmatter_issues[0].issues.some((i) => i.code === code), `${code}: missing from frontmatter_issues`);
    assert.ok(r.counts.broken > twin.counts.broken, `${code}: expected counts.broken > twin (payload dropped)`);
  }

  const preserving = {
    'trailing-inline-content': 'requirements: ["#41"] stray\nfiles: []',
    'trailing-value-content': 'requirements:\n  - "#41" stray\nfiles: []',
    'residual-quote': 'requirements:\n  - "#41"\nfiles: ["a\\"]',
  };
  for (const [code, frontmatter] of Object.entries(preserving)) {
    const r = run(['audit'], oneIdPlanTree(frontmatter));
    assert.equal(r.ok, true, code);
    assert.ok(r.frontmatter_issues[0].issues.some((i) => i.code === code), `${code}: missing from frontmatter_issues`);
    assert.equal(r.counts.broken, twin.counts.broken, `${code}: expected counts.broken === twin (payload preserved)`);
  }

  // commented-key-line drops nothing itself, but does not terminate the open
  // block, so the id still folds through - equal broken, and the folded
  // orphan (D-14's stated, accepted over-read) is provably present.
  const commented = run(['audit'], oneIdPlanTree('requirements:\n- "#41"\n# files:\n  - src/shared.rs'));
  assert.equal(commented.ok, true);
  assert.ok(commented.frontmatter_issues[0].issues.some((i) => i.code === 'commented-key-line'));
  assert.equal(commented.counts.broken, twin.counts.broken);
  assert.ok(commented.orphans.plan_ids.some((p) => p.ids.includes('src/shared.rs')));

  // unterminated-frontmatter drops the WHOLE block.
  const unterminatedDir = oneIdPlanTree('requirements: ["#41"]\nfiles: []');
  writeFileSync(join(unterminatedDir, 'phases', '1', 'PLAN.md'),
    '---\nphase: 1\nplan: 1\nrequirements: ["#41"]\nfiles: []\n\n# Plan 1 (fence never closes)\n');
  const unterminated = run(['audit'], unterminatedDir);
  assert.equal(unterminated.ok, true);
  assert.ok(unterminated.frontmatter_issues[0].issues.some((i) => i.code === 'unterminated-frontmatter'));
  assert.ok(unterminated.counts.broken > twin.counts.broken);

  // unknown-line is the one CONDITIONAL code (D-15) - two rows, since one
  // row of either shape would pin half the behavior and read as the whole
  // of it: a stray prose line drops nothing (equal to the twin) ...
  const strayProse = run(['audit'], oneIdPlanTree('requirements:\n  - "#41"\n  this line is not an item\nfiles: []'));
  assert.equal(strayProse.ok, true);
  assert.ok(strayProse.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'));
  assert.equal(strayProse.counts.broken, twin.counts.broken);

  // ... but a data-carrying malformed line that falls through to unknown-line
  // (fails malformed-key-line's own `/^[A-Za-z_]/` start) drops a whole key.
  const malformedData = run(['audit'], oneIdPlanTree('1requirements: ["#41"]\nfiles: []'));
  assert.equal(malformedData.ok, true);
  assert.ok(malformedData.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'));
  assert.ok(malformedData.counts.broken > twin.counts.broken);

  // backtick-wrapped-value is the second CONDITIONAL code, and for a different
  // reason than unknown-line: it always PRESERVES its bytes, but "preserves"
  // is a claim about bytes, not about tracing. On files: nothing traces, so
  // counts cannot move ...
  const backtickFile = run(['audit'], oneIdPlanTree('requirements:\n  - "#41"\nfiles:\n  - `src/shared.rs`'));
  assert.equal(backtickFile.ok, true);
  assert.ok(backtickFile.frontmatter_issues[0].issues.some((i) => i.code === 'backtick-wrapped-value'));
  assert.equal(backtickFile.counts.broken, twin.counts.broken);

  // ... but the same preserved bytes on requirements: are not a real id, so
  // the requirement goes untraced and counts.broken moves anyway. This row is
  // twin-shaped (same single id, same key as the twin) so it can actually
  // fail - the files: row above cannot, which is why one row alone would be
  // a test that passes by construction.
  const backtickId = run(['audit'], oneIdPlanTree('requirements:\n  - `#41`\nfiles: []'));
  assert.equal(backtickId.ok, true);
  assert.ok(backtickId.frontmatter_issues[0].issues.some((i) => i.code === 'backtick-wrapped-value'));
  assert.ok(backtickId.counts.broken > twin.counts.broken,
    'backtick-wrapped-value on requirements: must move counts.broken - a preserved `#41` is not the id #41');
});

test('plan-overlap: a trailing-annotated block item still overlaps, with the diagnostic naming which plan (UAT-9)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - "src/shared.rs" (new)\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.deepEqual(r.frontmatter_issues, [{
    plan: 'PLAN-1.md',
    issues: [{ line: 6, code: 'trailing-value-content', text: '- "src/shared.rs" (new)' }],
  }]);
});

test('plan-overlap: a backtick-wrapped path does not silently miss a real collision (UAT-21)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - `src/shared.rs`\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  // The path stays byte-exact (D-19), so the two spellings genuinely do not
  // overlap - but the diagnostic is what keeps that from being SILENT, and
  // choose_path routes a phase carrying frontmatter_issues to sequential.
  assert.deepEqual(r.overlaps, []);
  assert.deepEqual(r.frontmatter_issues, [{
    plan: 'PLAN-1.md',
    issues: [{ line: 6, code: 'backtick-wrapped-value', text: '- `src/shared.rs`' }],
  }]);
});

test('plan-overlap: a markdown-decorated path does not silently miss a real collision (FRM-02)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - **src/shared.rs**\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  // Two plans that DO write one file. The decorated spelling and the plain one
  // are not the same string, and D-04 keeps them from being made one: overlaps
  // means "these two declarations intersect", never "intersect after repair".
  // What stops the pair being cleared into two worktrees is the DIAGNOSTIC -
  // workflows/execute.md routes any non-empty frontmatter_issues to the
  // sequential path, which is the whole point this test pins.
  assert.deepEqual(r.overlaps, []);
  assert.deepEqual(r.frontmatter_issues, [{
    plan: 'PLAN-1.md',
    issues: [{ line: 6, code: 'markdown-decorated-path', text: '- **src/shared.rs**' }],
  }]);
});

test('plan-overlap: a block item under an inline files: key is diagnosed and dropped on both plans, not overlapped (D-13)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles: [src/a.rs]  # comment\n  - src/shared.rs\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles: [src/b.rs]  # comment\n  - src/shared.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, []);
  assert.equal(r.undeclared, undefined);
  const byPlan = Object.fromEntries(r.frontmatter_issues.map((d) => [d.plan, d.issues]));
  assert.ok(byPlan['PLAN-1.md'].some((i) => i.code === 'item-without-key'));
  assert.ok(byPlan['PLAN-2.md'].some((i) => i.code === 'item-without-key'));
  // The dropped line is absent from the FILES LISTS specifically, never a
  // whole-envelope substring check (false by construction: the diagnostic
  // itself quotes the dropped line, since text: issueText(line) reaches the
  // envelope verbatim - naming the dropped line is the point of it).
  const plans = run(['plan-overlap', '--phase', '1'], dir).plans;
  assert.deepEqual(plans, [{ plan: 'PLAN-1.md', files: 1 }, { plan: 'PLAN-2.md', files: 1 }]);
});

// --- plan-overlap: the parallel-safety gate ------------------------------------

/** A two-plan phase whose PLAN files declare the given file lists. */
function overlapTree(filesA, filesB, taskLineB) {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    `---\nphase: 1\nplan: 1\nrequirements: [REQ-1]\nfiles: [${filesA.join(', ')}]\n---\n# Plan 1\n`);
  writeFileSync(join(pdir, 'PLAN-2.md'),
    `---\nphase: 1\nplan: 2\nrequirements: [REQ-2]\nfiles: [${filesB.join(', ')}]\n---\n# Plan 2\n` +
    (taskLineB ? `\n### Task 1: t\n\n- **Files:** ${taskLineB}\n- **Action:** x\n- **Verify:** y\n` : ''));
  return dir;
}

test('plan-overlap: disjoint declared lists come back clean', () => {
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs', 'src/b.rs'], ['src/c.rs']));
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, []);
  assert.deepEqual(r.plans, [{ plan: 'PLAN-1.md', files: 2 }, { plan: 'PLAN-2.md', files: 1 }]);
  assert.equal(r.undeclared, undefined);
});

test('plan-overlap: a shared file is reported with both plan names', () => {
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs', 'src/shared.rs'], ['src/shared.rs', 'src/c.rs']));
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
});

// The two defective pairs the lease grammar's two readers disagree about: the
// pre-flight gate compares declarations by exact string equality, while
// `lease-check` reads a trailing slash as a directory prefix. A phase declaring
// `src/` in one plan and `src/auth.js` in another therefore passes the
// parallel-safety gate and is then refused, plan by plan, at the commit step.
// Both spellings ride `overlaps[].files` as separate strings (D-06); the ORDER
// is not pinned here, because it is not this pair's subject.

test('plan-overlap: a directory lease src/ overlaps the file src/auth.js the other plan declares', () => {
  const r = run(['plan-overlap', '--phase', '1'], overlapTree(['src/'], ['src/auth.js']));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.overlaps.length, 1, JSON.stringify(r));
  assert.deepEqual(r.overlaps[0].plans, ['PLAN-1.md', 'PLAN-2.md']);
  assert.ok(r.overlaps[0].files.includes('src/'), JSON.stringify(r.overlaps[0]));
  assert.ok(r.overlaps[0].files.includes('src/auth.js'), JSON.stringify(r.overlaps[0]));
  assert.equal(r.overlaps[0].files.length, 2, JSON.stringify(r.overlaps[0]));
});

test('plan-overlap: a directory lease src/ overlaps the nested directory lease src/auth/', () => {
  const r = run(['plan-overlap', '--phase', '1'], overlapTree(['src/'], ['src/auth/']));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.overlaps.length, 1, JSON.stringify(r));
  assert.deepEqual(r.overlaps[0].plans, ['PLAN-1.md', 'PLAN-2.md']);
  assert.ok(r.overlaps[0].files.includes('src/'), JSON.stringify(r.overlaps[0]));
  assert.ok(r.overlaps[0].files.includes('src/auth/'), JSON.stringify(r.overlaps[0]));
  assert.equal(r.overlaps[0].files.length, 2, JSON.stringify(r.overlaps[0]));
});

test('plan-overlap: task **Files:** lines count even when frontmatter omits them', () => {
  // PLAN-2 frontmatter declares nothing, but its task line touches src/a.rs.
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs'], [], 'src/a.rs (edit), src/d.rs'));
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual(r.overlaps[0].files, ['src/a.rs']);
});

test('plan-overlap: a task **Files:** annotation still normalizes to the bare path - the frontmatter narrowing is scoped to one arm (D-19)', () => {
  // PLAN-1's frontmatter declares the bare path; PLAN-2 declares it only on
  // an annotated task line. No frontmatter twin exists for the raw
  // "src/a.rs (edit)" form, so only the normalized path overlaps.
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs'], [], 'src/a.rs (edit)'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/a.rs'] }]);
});

test('plan-overlap: frontmatter-declared paths with parens or a backtick overlap byte-exact, unmangled by add() (acceptance criterion 5)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  const body = (p) => `---\nphase: 1\nplan: ${p}\nrequirements: []\nfiles:\n  - src/x(1)\n  - lib/a\`b.mjs\n---\n# Plan ${p}\n`;
  writeFileSync(join(pdir, 'PLAN-1.md'), body(1));
  writeFileSync(join(pdir, 'PLAN-2.md'), body(2));
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps,
    [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/x(1)', 'lib/a`b.mjs'] }]);
  assert.equal(r.frontmatter_issues, undefined);
});

test('plan-overlap: a frontmatter path with parens overlaps its raw twin declared only on a task line (the cross-arm bridge)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - src/x(1)\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles: []\n---\n# Plan 2\n\n' +
    '### Task 1: t\n\n- **Files:** src/x(1)\n- **Action:** x\n- **Verify:** y\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/x(1)'] }]);
});

test('plan-overlap: a frontmatter backtick-bearing path overlaps its raw twin declared only on a task line (the cross-arm bridge, other direction)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles: []\n---\n# Plan 1\n\n' +
    '### Task 1: t\n\n- **Files:** lib/a`b.mjs\n- **Action:** x\n- **Verify:** y\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - lib/a`b.mjs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['lib/a`b.mjs'] }]);
});

// --- the refused lease spellings, through BOTH declaration doors -------------
//
// `./a.txt` and `src//a.txt` name the same file as their plain spelling, which
// lib/lease-grammar.mjs reads as a different file. They are refused at
// declaration time and never reach either reader. The matrix below is FULL -
// two spellings by two doors - because a wiring defect on one arm passes
// happily on the diagonal: refusing on the frontmatter arm alone leaves the
// spelling reaching `lease-check` through the task line with no diagnostic.

/**
 * A two-plan phase where PLAN-1 declares `bad` through ONE door plus a plain
 * `keep.txt`, and PLAN-2 declares `plain` - the same file, spelled legally -
 * plus `keep.txt`. So the legitimate overlap survives while the refused
 * declaration is absent from it. Returns the tree and the line `bad` is
 * declared on.
 */
function refusalTree(bad, plain, door) {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  const one = door === 'frontmatter'
    ? `---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - ${bad}\n  - keep.txt\n---\n# Plan 1\n`
    : `---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - keep.txt\n---\n# Plan 1\n\n`
      + `### Task 1: t\n\n- **Files:** ${bad}\n- **Action:** x\n- **Verify:** y\n`;
  writeFileSync(join(pdir, 'PLAN-1.md'), one);
  writeFileSync(join(pdir, 'PLAN-2.md'),
    `---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - ${plain}\n  - keep.txt\n---\n# Plan 2\n`);
  return { dir, line: one.split('\n').findIndex((l) => l.includes(bad)) + 1 };
}

for (const [bad, plain] of [['./a.txt', 'a.txt'], ['src//a.txt', 'src/a.txt']]) {
  for (const door of ['frontmatter', 'task line']) {
    test(`plan-overlap: ${bad} declared on the ${door} is refused as redundant-path-segment and reaches neither reader`, () => {
      const { dir, line } = refusalTree(bad, plain, door);
      const r = run(['plan-overlap', '--phase', '1'], dir);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.deepEqual(r.frontmatter_issues,
        [{ plan: 'PLAN-1.md', issues: [{ line, code: 'redundant-path-segment', text: r.frontmatter_issues[0].issues[0].text }] }],
        JSON.stringify(r.frontmatter_issues));
      assert.ok(r.frontmatter_issues[0].issues[0].text.includes(bad),
        r.frontmatter_issues[0].issues[0].text);
      // The refused declaration is absent from the overlap; the legitimate one
      // is still there, so this is a DROP and not a dead gate.
      assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['keep.txt'] }]);
      assert.equal(r.undeclared, undefined);
    });
  }
}

test('plan-overlap: the same refused spelling twice in one files: list reports two issues on their OWN lines', () => {
  // A cursor advances past each match, so the second diagnostic does not point
  // back at the first occurrence's line.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: ["#41"]\nfiles:\n  - ./a.txt\n  - keep.txt\n  - ./a.txt\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - keep.txt\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.frontmatter_issues[0].issues.map((i) => [i.line, i.code]),
    [[6, 'redundant-path-segment'], [8, 'redundant-path-segment']],
    JSON.stringify(r.frontmatter_issues));
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['keep.txt'] }]);
});

test('plan-overlap: a plan with no declared files is flagged undeclared', () => {
  const r = run(['plan-overlap', '--phase', '1'], overlapTree(['src/a.rs'], []));
  assert.deepEqual(r.overlaps, []);
  assert.deepEqual(r.undeclared, ['PLAN-2.md']);
});

test('plan-overlap: single plan and missing phase degrade predictably', () => {
  const single = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { plan: true } } });
  const r = run(['plan-overlap', '--phase', '1'], single);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, []);
  assert.match(r.note, /fewer than two/);
  assert.equal(run(['plan-overlap', '--phase', '9'], single).reason, 'no-phase-dir');
  assert.equal(run(['plan-overlap'], single).reason, 'bad-args');
});
